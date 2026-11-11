import type { DiagnosticsReport } from '../diagnostics/types';
import type { PrivacyView } from '../privacy/view';

/** Name des Geräts aus dem Dateinamen; ohne erkennbares Schema der Dateiname ohne Endung. */
export function zipTitle(report: DiagnosticsReport): string {
  return report.deviceNameFromFile ?? report.fileName.replace(/\.zip$/i, '');
}

/** Titel für die Anzeige: im Präsentationsmodus Pseudonym statt Gerätename bzw. Dateiname. */
export function maskedZipTitle(
  report: DiagnosticsReport,
  view: Pick<PrivacyView, 'enabled' | 'masker'>,
): string {
  if (!view.enabled) return zipTitle(report);
  return report.deviceNameFromFile
    ? view.masker.device(report.deviceNameFromFile)
    : view.masker.fileName(report.fileName).replace(/\.zip$/i, '');
}
