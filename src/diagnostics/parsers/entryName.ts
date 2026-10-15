/**
 * Zerlegt ZIP-Eintragsnamen eines Intune-"Collect diagnostics"-Archivs (docs/diaglogs-format.md).
 * Reine Funktion – kein Zugriff auf Dateiinhalte.
 */
import { normalizeHex } from '../../domain/format';
import type { DiagEntry, DiagEntryKind } from '../types';

const ENTRY_RE =
  /^\((\d+)\) (?:No Results - Error \[(0x[0-9A-Fa-f]{8})\] )?(RegistryKey|Command|Events|FoldersFiles) (.+)$/;

const PAYLOAD_SUFFIX: Partial<Record<DiagEntryKind, RegExp>> = {
  RegistryKey: /^(.+) export\.reg$/,
  Command: /^(.+) output\.log$/,
  Events: /^(.+) Events\.evtx$/,
};

const RESULTS_RE = /(^|\/)results\.xml$/i;

/**
 * Eintragspfad → DiagEntry. Unbekannte Namensschemata ergeben `null`
 * (Präfix `(N)` ist nicht stabil, der Rest folgt dem Muster aus dem Formatdokument).
 */
export function parseEntryName(
  path: string,
  uncompressedSize: number,
  isDirectory: boolean,
): DiagEntry | null {
  if (RESULTS_RE.test(path) && !isDirectory) {
    return {
      path,
      index: null,
      kind: 'results',
      name: 'results.xml',
      failedHresult: null,
      uncompressedSize,
      isDirectory,
    };
  }

  const match = ENTRY_RE.exec(path);
  if (!match) return null;
  const [, indexText, failedRaw, kindRaw, payloadRaw] = match;
  if (indexText === undefined || kindRaw === undefined || payloadRaw === undefined) return null;
  const kind = kindRaw as Exclude<DiagEntryKind, 'results'>;

  const payload = payloadRaw;
  const suffixRe = PAYLOAD_SUFFIX[kind];
  const stripped = suffixRe?.exec(payload)?.[1];
  let name = stripped ?? payload;
  if (isDirectory) name = name.replace(/\/+$/, '');

  return {
    path,
    index: Number(indexText),
    kind,
    name,
    failedHresult: failedRaw ? normalizeHex(failedRaw) : null,
    uncompressedSize,
    isDirectory,
  };
}

/**
 * Name eines FoldersFiles-Eintrags "Verzeichnis/Datei" → Teile.
 * Verzeichniseinträge (ohne Datei) liefern `file: null`.
 */
export function splitFoldersFilesName(name: string): { directory: string; file: string | null } {
  const slash = name.indexOf('/');
  if (slash < 0) return { directory: name, file: null };
  const file = name.slice(slash + 1);
  return { directory: name.slice(0, slash), file: file === '' ? null : file };
}
