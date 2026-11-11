import type { Masker } from './masker';

/** DiagLogs-<NAME>-<Zeitstempel>.zip – gleiches Schema wie `parseDiagFileName` (hier ohne das ZIP-Modul zu laden). */
const DIAG_FILE_RE = /^(DiagLogs-)(.+)(-\d{8}T\d{6}Z(?: \(\d+\))?\.zip)$/i;

/**
 * Dateiname für die Anzeige: Bei DiagLogs-ZIPs wird nur der Gerätename durch sein Pseudonym ersetzt (Schema
 * und Zeitstempel bleiben erkennbar, dasselbe Pseudonym wie überall); andere Namen werden komplett ersetzt.
 */
export function maskFileName(masker: Masker, fileName: string): string {
  if (!fileName) return fileName;
  const match = DIAG_FILE_RE.exec(fileName);
  if (match) return `${match[1]}${masker.device(match[2] ?? '')}${match[3]}`;
  return masker.fileName(fileName);
}
