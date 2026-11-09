/**
 * Auswertung des MDM-Diagnosepakets `mdmlogs-*.cab` aus dem DiagLogs-ZIP (Cabinet-Format,
 * docs/diaglogs-format.md). Läuft im Analyse-Worker; das Cabinet wird nur gezielt gelesen:
 * Dateiliste, `MDMDiagReport.xml`, `MdmDiagLogMetadata.json` und – nur wenn das ZIP kein eigenes
 * MDM-Admin-Ereignisprotokoll enthält – dessen `.evtx`. Alles andere im Paket bleibt ungelesen.
 */
import { maskUserPaths } from '../domain/format';
import {
  analyzeEventLog,
  emptyLog,
  eventLogIdFor,
  maskEventValue,
  type SelectedEventLog,
} from './eventLogs';
import {
  DEFAULT_MAX_MDM_CAB_BYTES,
  DEFAULT_MAX_MDM_CAB_FILE_BYTES,
  DEFAULT_MAX_MDM_DIAG_XML_BYTES,
} from './limits';
import {
  cabBaseName,
  CabFormatError,
  CabLimitError,
  CabUnsupportedError,
  openCab,
  type CabArchive,
  type CabFileInfo,
} from './parsers/cab';
import { decodeText } from './parsers/encoding';
import { summarizeMdmDiagReport } from './parsers/mdmDiagReport';
import { splitFoldersFilesName } from './parsers/entryName';
import type {
  DiagEntry,
  DiagEventLog,
  MdmDiagMember,
  MdmDiagMemberStatus,
  MdmDiagPackage,
  MdmDiagUnsupportedReason,
} from './types';
import type { OpenedZip } from './zip/reader';

/** Höchstzahl aufgeführter Dateien des Pakets */
export const MAX_MDM_CAB_LISTED_FILES = 200;
/** Höchstzahl übernommener Metadatenfelder */
export const MAX_MDM_METADATA_FIELDS = 12;
const MAX_MEMBER_NAME_LENGTH = 120;

/** Dateinamen laut Microsoft Learn („Collect MDM logs“, Abschnitt „Understanding zip structure“) */
const REPORT_FILE = 'mdmdiagreport.xml';
const METADATA_FILE = 'mdmdiaglogmetadata.json';

/**
 * Annahme: `mdmlogs-<Datum>.cab` liegt als FoldersFiles-Eintrag im ZIP (Verzeichnis/Datei); der
 * Verzeichnisname ist nicht dokumentiert, daher wird nur der Dateiname geprüft.
 */
const MDM_CAB_RE = /(^|[/\\_ ])mdmlogs-[^/\\]*\.cab$/i;

export function isMdmCabEntry(entry: DiagEntry): boolean {
  if (entry.kind !== 'FoldersFiles' || entry.isDirectory || entry.failedHresult) return false;
  const { file } = splitFoldersFilesName(entry.name);
  return MDM_CAB_RE.test(file ?? entry.name);
}

/** Genau ein Paket: bei mehreren das mit dem lexikografisch größten Namen (Datum im Namen), dann das größte. */
export function selectMdmCabEntry(entries: DiagEntry[]): DiagEntry | undefined {
  let best: DiagEntry | undefined;
  for (const entry of entries) {
    if (!isMdmCabEntry(entry)) continue;
    if (
      !best ||
      entry.name > best.name ||
      (entry.name === best.name && entry.uncompressedSize > best.uncompressedSize)
    )
      best = entry;
  }
  return best;
}

export interface MdmCabOptions {
  /** Referenzzeitpunkt (ZIP-Zeitstempel) und Fensterbreite für das MDM-Admin-Log aus dem Paket */
  referenceUtc: string | null;
  windowDays: number;
  /** Das MDM-Admin-Ereignisprotokoll aus dem Paket auswerten (nur, wenn das ZIP keines enthält) */
  wantAdminLog: boolean;
  maxCabBytes?: number;
  maxFileBytes?: number;
  maxXmlBytes?: number;
}

export interface MdmCabResult {
  pkg: MdmDiagPackage;
  /** MDM-Admin-Log aus dem Paket (nur wenn angefordert und im Paket vorhanden) */
  adminLog: DiagEventLog | null;
}

const baseOf = (file: CabFileInfo): string => cabBaseName(file.name).toLowerCase();

const shown = (name: string): string => maskUserPaths(name).slice(0, MAX_MEMBER_NAME_LENGTH);

function emptyPackage(entry: DiagEntry, status: MdmDiagPackage['status']): MdmDiagPackage {
  return {
    entryPath: entry.path,
    entryName: entry.name,
    sizeBytes: entry.uncompressedSize,
    status,
    truncated: false,
    unsupportedReason: null,
    fileCount: 0,
    files: [],
    reportStatus: 'missing',
    report: null,
    metadataStatus: 'missing',
    metadata: [],
    adminLogFromPackage: false,
  };
}

type Extracted =
  | { ok: true; bytes: Uint8Array }
  | {
      ok: false;
      status: Exclude<MdmDiagMemberStatus, 'ok' | 'missing'>;
      unsupported?: MdmDiagUnsupportedReason;
    };

function extractMember(cab: CabArchive, file: CabFileInfo, maxBytes: number): Extracted {
  try {
    return { ok: true, bytes: cab.extract(file, { maxBytes }) };
  } catch (error) {
    if (error instanceof CabUnsupportedError)
      return { ok: false, status: 'unsupported', unsupported: error.reason };
    if (error instanceof CabLimitError) return { ok: false, status: 'tooLarge' };
    if (error instanceof CabFormatError) return { ok: false, status: 'invalid' };
    return { ok: false, status: 'unreadable' };
  }
}

/** Skalare Felder (und Listen skalarer Werte) der obersten Ebene als maskierte Schlüssel/Wert-Rohdaten. */
function readMetadata(text: string): Array<{ key: string; value: string }> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const out: Array<{ key: string; value: string }> = [];
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (out.length >= MAX_MDM_METADATA_FIELDS) break;
    const scalar = (v: unknown): string | null =>
      typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : null;
    let raw = scalar(value);
    if (raw === null && Array.isArray(value)) {
      const parts = value.map(scalar);
      if (parts.every((p): p is string => p !== null)) raw = parts.join(' ');
    }
    if (raw === null) continue;
    out.push({ key: key.slice(0, 60), value: maskEventValue(key, raw) });
  }
  return out;
}

/** Liest das Paket aus dem ZIP und wertet es aus. Fehler ergeben einen Status statt einer Ausnahme. */
export async function analyzeMdmCab(
  zip: Pick<OpenedZip, 'readBytes'>,
  entry: DiagEntry,
  options: MdmCabOptions,
): Promise<MdmCabResult> {
  const maxCabBytes = options.maxCabBytes ?? DEFAULT_MAX_MDM_CAB_BYTES;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_MDM_CAB_FILE_BYTES;
  const maxXmlBytes = Math.min(options.maxXmlBytes ?? DEFAULT_MAX_MDM_DIAG_XML_BYTES, maxFileBytes);

  const read = await zip.readBytes(entry, maxCabBytes);
  if (!read.ok)
    return {
      pkg: emptyPackage(entry, read.reason === 'tooLarge' ? 'tooLarge' : 'unreadable'),
      adminLog: null,
    };

  let cab: CabArchive;
  try {
    cab = openCab(read.bytes);
  } catch (error) {
    return {
      pkg: emptyPackage(entry, error instanceof CabFormatError ? 'invalid' : 'unreadable'),
      adminLog: null,
    };
  }

  const pkg = emptyPackage(entry, 'ok');
  pkg.truncated = cab.truncated;
  pkg.fileCount = cab.files.length;
  const files: MdmDiagMember[] = cab.files
    .slice(0, MAX_MDM_CAB_LISTED_FILES)
    .map((file) => ({ name: shown(file.name), sizeBytes: file.size }));
  pkg.files = files;
  let adminLog: DiagEventLog | null = null;

  const noteUnsupported = (result: Extracted): void => {
    if (!result.ok && result.unsupported && !pkg.unsupportedReason)
      pkg.unsupportedReason = result.unsupported;
  };

  // MDMDiagReport.xml
  const reportFile = cab.files.find((file) => baseOf(file) === REPORT_FILE);
  if (reportFile) {
    if (reportFile.size > maxXmlBytes) {
      pkg.reportStatus = 'tooLarge';
    } else {
      const extracted = extractMember(cab, reportFile, maxXmlBytes);
      noteUnsupported(extracted);
      if (!extracted.ok) {
        pkg.reportStatus = extracted.status;
      } else {
        const summary = summarizeMdmDiagReport(decodeText(extracted.bytes).text, {
          mask: maskEventValue,
        });
        pkg.report = summary;
        pkg.reportStatus = summary ? 'ok' : 'invalid';
      }
    }
  }

  // MdmDiagLogMetadata.json
  const metadataFile = cab.files.find((file) => baseOf(file) === METADATA_FILE);
  if (metadataFile) {
    if (metadataFile.size > maxXmlBytes) {
      pkg.metadataStatus = 'tooLarge';
    } else {
      const extracted = extractMember(cab, metadataFile, maxXmlBytes);
      noteUnsupported(extracted);
      if (!extracted.ok) {
        pkg.metadataStatus = extracted.status;
      } else {
        const fields = readMetadata(decodeText(extracted.bytes).text);
        pkg.metadata = fields ?? [];
        pkg.metadataStatus = fields ? 'ok' : 'invalid';
      }
    }
  }

  // MDM-Admin-Ereignisprotokoll – nur, wenn das ZIP selbst keines enthält
  if (options.wantAdminLog) {
    for (const file of cab.files) {
      if (!/\.evtx$/i.test(file.name)) continue;
      const member: DiagEntry = {
        path: `${entry.path}!${file.name}`,
        index: null,
        kind: 'Events',
        name: cabBaseName(file.name).replace(/\.evtx$/i, ''),
        failedHresult: null,
        uncompressedSize: file.size,
        isDirectory: false,
      };
      if (eventLogIdFor(member) !== 'mdmAdmin') continue;
      const sel: SelectedEventLog = { id: 'mdmAdmin', entry: member };
      if (file.size > maxFileBytes) {
        adminLog = emptyLog(sel, 'tooLarge');
      } else {
        const extracted = extractMember(cab, file, maxFileBytes);
        noteUnsupported(extracted);
        adminLog = extracted.ok
          ? analyzeEventLog(extracted.bytes, sel, options)
          : emptyLog(sel, extracted.status === 'tooLarge' ? 'tooLarge' : 'unreadable');
      }
      pkg.adminLogFromPackage = true;
      break;
    }
  }

  return { pkg, adminLog };
}
