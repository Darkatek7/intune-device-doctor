import type { DiagnosticsReport } from '../diagnostics/types';

/** Name des Geräts aus dem Dateinamen; ohne erkennbares Schema der Dateiname ohne Endung. */
export function zipTitle(report: DiagnosticsReport): string {
  return report.deviceNameFromFile ?? report.fileName.replace(/\.zip$/i, '');
}
