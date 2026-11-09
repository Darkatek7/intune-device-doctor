import { ChevronRight, ExternalLink, Lightbulb } from 'lucide-react';
import { useId } from 'react';
import type { TileId } from '../domain/types';
import { de } from '../i18n/de';
import type { Insight } from '../rules/correlate';

const t = de.analysis.insight;

interface Props {
  insights: readonly Insight[];
  /** Kacheln, die in der aktuellen Ansicht existieren – nur dafür gibt es Links */
  openableTiles: ReadonlySet<TileId>;
  onOpenTile: (tileId: TileId) => void;
}

/** Karte „Wahrscheinlichste Ursache“ über dem Kachel-Grid (1–3 priorisierte Einschätzungen). */
export function InsightCard({ insights, openableTiles, onOpenTile }: Props) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      data-testid="insight-card"
      className="material-card hc-edge flex flex-col gap-3 rounded-tile p-5"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="squircle size-9 bg-accent/12 text-accent">
          <Lightbulb size={20} />
        </span>
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-semibold tracking-[-0.012em] text-label">
            {t.heading}
          </h2>
          <p className="text-sm text-secondary-label">{t.note}</p>
        </div>
      </div>
      <ol className="flex flex-col gap-3">
        {insights.map((insight, index) => (
          <li key={insight.id} data-insight={insight.id} className="rounded-2xl bg-fill p-4">
            <p className="flex items-baseline gap-2 text-sm font-semibold text-label">
              <span aria-hidden="true" className="tabular-nums text-secondary-label">
                {index + 1}.
              </span>
              {insight.title}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-secondary-label">{t.related}:</span>
              {insight.relatedTiles.map((tileId) =>
                openableTiles.has(tileId) ? (
                  <button
                    key={tileId}
                    type="button"
                    aria-label={t.openTile(de.tiles[tileId])}
                    onClick={() => onOpenTile(tileId)}
                    className="rounded-full bg-accent/8 px-3 py-1 text-sm font-medium text-accent outline-none transition-transform hover:bg-accent/12 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
                  >
                    {de.tiles[tileId]}
                  </button>
                ) : (
                  <span
                    key={tileId}
                    className="rounded-full bg-control px-3 py-1 text-sm text-label"
                  >
                    {de.tiles[tileId]}
                  </span>
                ),
              )}
            </div>
            <details className="group mt-3">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full text-sm font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  aria-hidden="true"
                  size={16}
                  className="transition-transform group-open:rotate-90"
                />
                {t.why}
              </summary>
              <div className="mt-2 space-y-3 text-sm text-label">
                <p>{insight.explanation}</p>
                <p className="text-secondary-label">{insight.why}</p>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary-label">
                    {t.steps}
                  </h3>
                  <ol className="mt-1 list-decimal space-y-1 pl-5">
                    {insight.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
                <a
                  href={insight.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {t.docs}
                  <ExternalLink aria-hidden="true" size={14} />
                </a>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
