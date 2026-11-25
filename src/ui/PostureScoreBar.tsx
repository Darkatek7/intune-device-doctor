/**
 * Gesamtbild der Ansicht „Empfehlungen“ (M21/S4): „x von y Empfehlungen erfüllt“ mit Anteilsbalken. Wie
 * bei ShareBar steckt der Status nie nur in der Farbe: Der Balken hat eine Textalternative
 * (role="img" + aria-label), darunter steht eine Legende mit Beschriftung und Anzahl je Kategorie.
 */
import type { PostureScore } from '../rules/posture';
import { de } from '../i18n/de';

const t = de.posture.view.overall;

const SEGMENTS = [
  { key: 'met', label: t.met, className: 'bg-ok' },
  { key: 'deviating', label: t.deviating, className: 'bg-warning' },
  { key: 'notChecked', label: t.notChecked, className: 'bg-unknown/60' },
] as const;

export function PostureScoreBar({ score }: { score: PostureScore }) {
  return (
    <figure
      data-testid="posture-score"
      className="material-card hc-edge flex min-w-0 flex-col gap-3 rounded-tile p-4"
    >
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold text-label">{t.title}</span>
        <span className="text-sm font-medium text-label tabular-nums">
          {score.total === 0 ? t.empty : t.headline(score.met, score.total)}
        </span>
      </figcaption>
      {score.total > 0 && (
        <>
          <div
            role="img"
            aria-label={t.barLabel(score.met, score.deviating, score.notChecked, score.total)}
            className="flex h-3 w-full overflow-hidden rounded-full bg-fill"
          >
            {SEGMENTS.map((segment) =>
              score[segment.key] > 0 ? (
                <span
                  key={segment.key}
                  className={`h-full ${segment.className}`}
                  style={{ width: `${(score[segment.key] / score.total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <ul
            aria-label={t.legend}
            className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary-label"
          >
            {SEGMENTS.map((segment) => (
              <li key={segment.key} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`inline-block size-2 rounded-full ${segment.className}`}
                />
                <span className="text-label">{segment.label}</span>
                <span className="tabular-nums">{score[segment.key]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </figure>
  );
}
