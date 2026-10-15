import type { Severity } from '../domain/types';
import { de } from '../i18n/de';
import type { TileSummary } from '../rules/evaluate';

export interface SummaryPart {
  severity: Severity;
  text: string;
}

/** Zerlegt die Kachel-Zusammenfassung in anzeigbare Teile ("2 Probleme", "1 Hinweis" …). */
export function summaryParts(summary: TileSummary): SummaryPart[] {
  const parts: SummaryPart[] = [];
  if (summary.critical)
    parts.push({ severity: 'critical', text: de.header.critical(summary.critical) });
  if (summary.warning)
    parts.push({ severity: 'warning', text: de.header.warning(summary.warning) });
  if (summary.unknown)
    parts.push({ severity: 'unknown', text: de.header.unknown(summary.unknown) });
  if (parts.length === 0) parts.push({ severity: 'ok', text: de.header.allOk });
  return parts;
}

export function summarySentence(summary: TileSummary): string {
  return summaryParts(summary)
    .map((p) => p.text)
    .join(' · ');
}
