import type { TileSummary } from '../rules/evaluate';
import { SeverityIcon } from './SeverityBadge';
import { summaryParts } from './summaryText';

const PILL_CLASS = {
  ok: 'bg-ok/12',
  warning: 'bg-warning/12',
  critical: 'bg-critical/12',
  unknown: 'bg-unknown/12',
} as const;

/** Zusammenfassung als getönte Pills ("1 Problem", "2 Hinweise") – Icon + Text, nie nur Farbe. */
export function SummaryPills({ summary }: { summary: TileSummary }) {
  return summaryParts(summary).map((part) => (
    <span
      key={part.severity}
      className={`inline-flex items-center gap-1.5 rounded-full py-1 pr-3 pl-2 ${PILL_CLASS[part.severity]}`}
    >
      <SeverityIcon severity={part.severity} size={16} />
      {part.text}
    </span>
  ));
}
