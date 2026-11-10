/**
 * Anteilsbalken der Compliance-/Konfigurations-Übersicht (M20/S1). Der Status steckt nie nur in der
 * Farbe: Der Balken hat eine Textalternative (role="img" + aria-label), darunter steht eine Legende mit
 * Beschriftung, Anzahl und Anteil jeder Kategorie.
 */
import { formatPercent } from '../domain/format';
import type { DeviceStateSummaryInfo, Severity } from '../domain/types';
import { de } from '../i18n/de';
import { summarySegments, summaryText } from '../rules/fleet';

const s = de.fleet.summary;

const SEGMENT_CLASS: Record<Severity, string> = {
  ok: 'bg-ok',
  warning: 'bg-warning',
  critical: 'bg-critical',
  unknown: 'bg-unknown/60',
};

interface Props {
  summary: DeviceStateSummaryInfo;
}

export function ShareBar({ summary }: Props) {
  const segments = summarySegments(summary);
  if (segments.length === 0) return null;
  const title = summary.kind === 'compliance' ? s.bar.compliance : s.bar.configuration;
  return (
    <figure
      data-testid={`share-bar-${summary.kind}`}
      className="material-card hc-edge flex min-w-0 flex-col gap-3 rounded-tile p-4"
    >
      <figcaption className="text-sm font-semibold text-label">{title}</figcaption>
      <div
        role="img"
        aria-label={`${s.bar.label(title)}: ${summaryText(summary)}`}
        className="flex h-3 w-full overflow-hidden rounded-full bg-fill"
      >
        {segments.map((segment) => (
          <span
            key={segment.field}
            className={`h-full ${SEGMENT_CLASS[segment.tone]}`}
            style={{ width: `${segment.share * 100}%` }}
          />
        ))}
      </div>
      <ul
        aria-label={s.bar.legend}
        className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary-label"
      >
        {segments.map((segment) => (
          <li key={segment.field} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`inline-block size-2 rounded-full ${SEGMENT_CLASS[segment.tone]}`}
            />
            <span className="text-label">{segment.label}</span>
            <span className="tabular-nums">
              {segment.count} ({formatPercent(segment.share)})
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
