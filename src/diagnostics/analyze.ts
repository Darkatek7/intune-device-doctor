/**
 * Clientseitige Analyse eines Intune-"Collect diagnostics"-ZIPs (docs/diaglogs-format.md).
 * Kein Netzwerkzugriff, kein Upload: die Datei wird ausschließlich im Browser gelesen.
 * Nur Text-Einträge werden bei Bedarf entpackt; Binärdateien (.evtx/.etl/.cab …) nie.
 */
import { de } from '../i18n/de';
import { parseCmTrace } from './parsers/cmtrace';
import { parseDsregcmd } from './parsers/dsregcmd';
import { extractEnrollments, isEnrollmentRootKey } from './parsers/enrollments';
import { splitFoldersFilesName } from './parsers/entryName';
import { parseRegExport, type RegKey } from './parsers/regExport';
import { interpretHresult, parseResultsXml, type CollectionKind } from './parsers/resultsXml';
import { extractWin32Apps, isWin32AppsKey } from './parsers/win32Apps';
import type {
  CmTraceEntry,
  CollectionFailure,
  DiagEntry,
  DiagnosticsReport,
  DsregStatus,
  EnrollmentInfo,
  Win32AppState,
} from './types';
import { DEFAULT_MAX_TEXT_BYTES, extensionOf, isBinaryEntry, openZip } from './zip/reader';

export type AnalysisStage = 'opening' | 'results' | 'dsregcmd' | 'registry' | 'imeLogs' | 'done';

export interface AnalysisProgress {
  stage: AnalysisStage;
  /** Deutscher Anzeigetext aus src/i18n/de.ts */
  message: string;
  completed: number;
  total: number;
}

export interface AnalyzeOptions {
  onProgress?: (progress: AnalysisProgress) => void;
  signal?: AbortSignal;
  /** Größenlimit je Text-Eintrag (Standard 8 MiB) */
  maxTextBytes?: number;
  /** Größenlimit je .reg-Export (Standard 32 MiB; IME-Exporte sind mehrere MB groß) */
  maxRegBytes?: number;
}

export const MAX_IME_ISSUES_PER_FILE = 200;
const DEFAULT_MAX_REG_BYTES = 32 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Dateiname
// ---------------------------------------------------------------------------

const FILE_NAME_RE =
  /^DiagLogs-(.+)-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z(?: \(\d+\))?\.zip$/i;

/** DiagLogs-<NAME>-<yyyyMMddTHHmmssZ>.zip → Gerätename + UTC-Zeitstempel (NAME darf '-' enthalten). */
export function parseDiagFileName(fileName: string): {
  deviceName: string | null;
  collectedAtUtc: string | null;
} {
  const m = FILE_NAME_RE.exec(fileName);
  if (!m) return { deviceName: null, collectedAtUtc: null };
  const [, name, y, mo, d, h, mi, s] = m;
  return {
    deviceName: name ?? null,
    collectedAtUtc: `${y}-${mo}-${d}T${h}:${mi}:${s}Z`,
  };
}

// ---------------------------------------------------------------------------
// Sammlungsfehler
// ---------------------------------------------------------------------------

function normalizeTarget(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Eintragsnamen können abgeschnitten sein → Präfix-Vergleich (ab 20 Zeichen). */
function sameTarget(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 20 && long.startsWith(short);
}

export function mergeCollectionFailures(
  fromEntries: CollectionFailure[],
  fromResults: CollectionFailure[],
): CollectionFailure[] {
  const merged: CollectionFailure[] = [];
  const keys: Array<{ kind: CollectionKind; norm: string }> = [];
  for (const failure of [...fromEntries, ...fromResults]) {
    const norm = normalizeTarget(failure.target);
    if (keys.some((k) => k.kind === failure.kind && sameTarget(k.norm, norm))) continue;
    keys.push({ kind: failure.kind, norm });
    merged.push(failure);
  }
  return merged;
}

function failuresFromEntries(entries: DiagEntry[]): CollectionFailure[] {
  const failures: CollectionFailure[] = [];
  for (const entry of entries) {
    if (!entry.failedHresult || entry.kind === 'results') continue;
    const hex = entry.failedHresult;
    const interpretation = interpretHresult(entry.kind, parseInt(hex.slice(2), 16));
    const failure: CollectionFailure = { kind: entry.kind, target: entry.name, hresult: hex };
    // "No Results"-Einträge sind immer Fehlschläge; eine Erfolgs-Deutung (z. B. RegistryKey
    // 0x80070003 = Export ok) passt dazu nicht und wird nicht angezeigt.
    if (!interpretation.ok && interpretation.meaning) failure.meaning = interpretation.meaning;
    failures.push(failure);
  }
  return failures;
}

// ---------------------------------------------------------------------------
// IME-Logs
// ---------------------------------------------------------------------------

const IME_DIR_RE = /IntuneManagementExtension_Logs/i;
const ROTATED_RE = /^(.*?)[-_](\d{8})(?:[-_](\d{4,6}))?\.log$/i;

/**
 * Aktuelle IME-Logs plus je Logname die jüngste Rotation (Datumssuffix). Ältere Rotationen
 * werden nicht ausgewertet.
 */
export function selectImeLogEntries(entries: DiagEntry[]): DiagEntry[] {
  const current: DiagEntry[] = [];
  const newestRotated = new Map<string, { stamp: string; entry: DiagEntry }>();

  for (const entry of entries) {
    if (entry.kind !== 'FoldersFiles' || entry.isDirectory || entry.failedHresult) continue;
    const { directory, file } = splitFoldersFilesName(entry.name);
    if (!file || !IME_DIR_RE.test(directory) || !/\.log$/i.test(file)) continue;

    const rotated = ROTATED_RE.exec(file);
    if (!rotated) {
      current.push(entry);
      continue;
    }
    const base = (rotated[1] ?? '').toLowerCase();
    const stamp = `${rotated[2] ?? ''}${(rotated[3] ?? '').padEnd(6, '0')}`;
    const known = newestRotated.get(base);
    if (!known || stamp > known.stamp) newestRotated.set(base, { stamp, entry });
  }

  return [...current, ...[...newestRotated.values()].map((v) => v.entry)];
}

function logFileName(entry: DiagEntry): string {
  return splitFoldersFilesName(entry.name).file ?? entry.name;
}

// ---------------------------------------------------------------------------
// Analyse
// ---------------------------------------------------------------------------

export async function analyzeDiagnosticsZip(
  file: Blob & { name: string },
  options: AnalyzeOptions = {},
): Promise<DiagnosticsReport> {
  const { onProgress, signal } = options;
  const maxTextBytes = options.maxTextBytes ?? DEFAULT_MAX_TEXT_BYTES;
  const maxRegBytes = options.maxRegBytes ?? DEFAULT_MAX_REG_BYTES;
  const t = de.diagnostics;
  const notes: string[] = [];

  let total = 5;
  let completed = 0;
  const report = (stage: AnalysisStage, message: string): void => {
    signal?.throwIfAborted();
    onProgress?.({ stage, message, completed, total });
  };

  report('opening', t.progress.opening);
  const zip = await openZip(file);
  try {
    completed = 1;
    const { entries, unrecognizedPaths } = zip;
    const evaluated = new Set<string>();

    const readText = async (entry: DiagEntry, maxBytes: number): Promise<string | null> => {
      signal?.throwIfAborted();
      const result = await zip.readText(entry, maxBytes);
      if (!result.ok) {
        if (result.reason === 'tooLarge') {
          notes.push(t.notes.tooLarge(entry.name, Math.ceil(entry.uncompressedSize / 1048576)));
        } else if (result.reason === 'error') {
          notes.push(t.notes.unreadable(entry.name));
        }
        return null;
      }
      evaluated.add(entry.path);
      if (result.text.includes('�')) notes.push(t.notes.suspectEncoding(entry.name));
      return result.text;
    };

    // --- results.xml + No-Results-Einträge --------------------------------------------------
    report('results', t.progress.results);
    let resultFailures: CollectionFailure[] = [];
    const resultsEntry = entries.find((e) => e.kind === 'results');
    if (resultsEntry) {
      const xml = await readText(resultsEntry, maxTextBytes);
      if (xml) {
        resultFailures = parseResultsXml(xml).flatMap((item): CollectionFailure[] => {
          const interpretation = interpretHresult(item.kind, item.hresultDecimal);
          if (interpretation.ok) return [];
          const failure: CollectionFailure = {
            kind: item.kind,
            target: item.target,
            hresult: item.hresultHex,
          };
          if (interpretation.meaning) failure.meaning = interpretation.meaning;
          return [failure];
        });
      }
    }
    const collectionFailures = mergeCollectionFailures(
      failuresFromEntries(entries),
      resultFailures,
    );
    completed = 2;

    // --- dsregcmd ---------------------------------------------------------------------------
    report('dsregcmd', t.progress.dsregcmd);
    let dsregcmd: DsregStatus | null = null;
    const dsregEntry = entries.find(
      (e) => e.kind === 'Command' && !e.failedHresult && /dsregcmd_exe_status/i.test(e.name),
    );
    if (dsregEntry) {
      const text = await readText(dsregEntry, maxTextBytes);
      if (text) dsregcmd = parseDsregcmd(text);
    }
    if (!dsregcmd) notes.push(t.notes.noDsregcmd);
    completed = 3;

    // --- Registry-Exporte -------------------------------------------------------------------
    report('registry', t.progress.registry);
    const enrollmentKeys: RegKey[] = [];
    const imeKeys: RegKey[] = [];
    let sawEnrollmentExport = false;
    let sawImeExport = false;
    for (const entry of entries) {
      if (entry.kind !== 'RegistryKey' || entry.failedHresult || entry.isDirectory) continue;
      if (/(^|_)Microsoft_Enrollments$/i.test(entry.name)) {
        sawEnrollmentExport = true;
        const text = await readText(entry, maxRegBytes);
        if (text) enrollmentKeys.push(...parseRegExport(text, { keyFilter: isEnrollmentRootKey }));
      } else if (/(^|_)Microsoft_IntuneManagementExtension$/i.test(entry.name)) {
        sawImeExport = true;
        const text = await readText(entry, maxRegBytes);
        if (text) imeKeys.push(...parseRegExport(text, { keyFilter: isWin32AppsKey }));
      }
    }
    const enrollments: EnrollmentInfo[] = extractEnrollments(enrollmentKeys);
    const win32Apps: Win32AppState[] = extractWin32Apps(imeKeys);
    if (!sawEnrollmentExport) notes.push(t.notes.noEnrollments);
    if (!sawImeExport) notes.push(t.notes.noWin32Apps);
    completed = 4;

    // --- IME-Logs ---------------------------------------------------------------------------
    const logEntries = selectImeLogEntries(entries);
    total = 5 + logEntries.length;
    const imeIssues: CmTraceEntry[] = [];
    let logsDone = 0;
    for (const entry of logEntries) {
      report('imeLogs', t.progress.imeLogs(logsDone, logEntries.length));
      const text = await readText(entry, maxTextBytes);
      if (text) {
        imeIssues.push(
          ...parseCmTrace(text, logFileName(entry), {
            onlyIssues: true,
            limit: MAX_IME_ISSUES_PER_FILE,
          }),
        );
      }
      logsDone++;
      completed = 4 + logsDone;
    }
    if (logEntries.length === 0) notes.push(t.notes.noImeLogs);

    // --- Hinweise zur Analyse ---------------------------------------------------------------
    const binaries = entries.filter((e) => !e.isDirectory && isBinaryEntry(e.path));
    if (binaries.length > 0) {
      const counts = new Map<string, number>();
      for (const e of binaries) {
        const ext = extensionOf(e.path);
        counts.set(ext, (counts.get(ext) ?? 0) + 1);
      }
      const byExtension = [...counts].map(([ext, n]) => `${ext}: ${n}`).join(', ');
      notes.unshift(t.notes.binarySkipped(binaries.length, byExtension));
    }
    const notEvaluated = entries.filter(
      (e) =>
        !e.isDirectory &&
        !e.failedHresult &&
        e.uncompressedSize > 0 &&
        !isBinaryEntry(e.path) &&
        !evaluated.has(e.path),
    ).length;
    if (notEvaluated > 0) notes.push(t.notes.textNotEvaluated(notEvaluated));
    if (unrecognizedPaths.length > 0) notes.push(t.notes.unknownEntries(unrecognizedPaths.length));

    completed = total;
    report('done', t.progress.done);

    const { deviceName, collectedAtUtc } = parseDiagFileName(file.name);
    return {
      fileName: file.name,
      deviceNameFromFile: deviceName,
      collectedAtUtc,
      entryCount: entries.length + unrecognizedPaths.length,
      totalUncompressedBytes: entries.reduce((sum, e) => sum + e.uncompressedSize, 0),
      entries,
      collectionFailures,
      dsregcmd,
      enrollments,
      win32Apps,
      imeIssues,
      analysisNotes: notes,
    };
  } finally {
    await zip.close();
  }
}
