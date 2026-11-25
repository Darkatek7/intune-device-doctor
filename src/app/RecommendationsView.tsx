/**
 * Ansicht „Empfehlungen“ (M21/S4): Abgleich der Mandanten-Konfiguration mit den auf Microsoft Learn
 * dokumentierten Empfehlungen – mit denselben Kachel- und Sheet-Komponenten wie „Mandant“. Daten kommen
 * ausschließlich über useTenantPosture (Provider-Schnittstelle); die Stufenwahl wertet nur neu aus.
 */
import { AnimatePresence } from 'motion/react';
import { BadgeCheck, ChevronLeft, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_POSTURE_LEVEL, type PostureLevel } from '../domain/posture';
import type { Tile } from '../domain/types';
import { useTenantPosture } from '../hooks/useTenantPosture';
import { de } from '../i18n/de';
import { PrivacyViewProvider } from '../privacy/PrivacyProvider';
import { useBuildPrivacyView } from '../privacy/privacyContext';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { summarize } from '../rules/evaluate';
import {
  evaluatePosture,
  groupPostureTiles,
  POSTURE_SECTIONS,
  postureScore,
} from '../rules/posture';
import type { AmbientTone } from '../ui/AmbientGlow';
import { DetailSheet } from '../ui/DetailSheet';
import { ErrorState } from '../ui/ErrorState';
import { PostureLevelSelect } from '../ui/PostureLevelSelect';
import { PostureScoreBar } from '../ui/PostureScoreBar';
import { SummaryPills } from '../ui/SummaryPills';
import { summarySentence } from '../ui/summaryText';
import { TileGrid } from '../ui/TileGrid';
import { TileSkeleton } from '../ui/TileSkeleton';
import { TONE_CLASS } from '../ui/tone';

const t = de.posture.view;

interface Props {
  provider: DeviceDataProvider;
  /** Aus der URL: ?level=1|2|3 (null = Standard) */
  level: PostureLevel | null;
  onLevelChange: (level: PostureLevel) => void;
  /** Aus der URL: ?tile=<id> */
  openTileId: string | null;
  onOpenTile: (tileId: string) => void;
  onCloseTile: () => void;
  onBack: () => void;
  /** Gesamtzustand für das Umgebungslicht (accent, solange geladen wird) */
  onToneChange?: (tone: AmbientTone) => void;
}

export function RecommendationsView({
  provider,
  level: urlLevel,
  onLevelChange,
  openTileId,
  onOpenTile,
  onCloseTile,
  onBack,
  onToneChange,
}: Props) {
  const level = urlLevel ?? DEFAULT_POSTURE_LEVEL;
  const { state, reload } = useTenantPosture(provider);
  const [origin, setOrigin] = useState<DOMRect | null>(null);

  // Auswertung nur bei neuen Daten oder anderer Stufe (kein Neuladen). Das Gesamtbild zählt die
  // unmaskierten Kacheln (mit `checks`); der Präsentationsmodus (M19) wirkt erst auf die Anzeige.
  const rawTiles = useMemo(
    () => (state.status === 'done' ? evaluatePosture(state.data, { level, now: state.now }) : []),
    [state, level],
  );
  const score = useMemo(() => postureScore(rawTiles), [rawTiles]);
  const view = useBuildPrivacyView(state.status === 'done' ? state.data : null);
  const tiles = useMemo<Tile[]>(() => view.deep(rawTiles), [rawTiles, view]);
  const summary = useMemo(() => summarize(tiles), [tiles]);
  const tone: AmbientTone = state.status === 'done' ? summary.worst : 'accent';
  useEffect(() => {
    onToneChange?.(tone);
  }, [tone, onToneChange]);

  useEffect(() => {
    const previous = document.title;
    document.title = `${t.title} – ${de.app.name}`;
    return () => {
      document.title = previous;
    };
  }, []);

  const openTile = openTileId ? tiles.find((tile) => tile.id === openTileId) : undefined;

  // Fokus kehrt zur Kachel zurück, sobald das Sheet geschlossen wird.
  const previousOpen = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousOpen.current;
    previousOpen.current = openTile?.id ?? null;
    if (previous && !openTile) {
      document.querySelector<HTMLElement>(`[data-tile-id="${previous}"]`)?.focus();
    }
  }, [openTile]);

  const handleOpen = useCallback(
    (tile: Tile, element: HTMLButtonElement) => {
      setOrigin(element.getBoundingClientRect());
      onOpenTile(tile.id);
    },
    [onOpenTile],
  );

  if (state.status === 'error') {
    return <ErrorState error={state.error} onRetry={reload} />;
  }

  const loading = state.status === 'loading';
  return (
    <PrivacyViewProvider view={view}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="-ml-1 inline-flex items-center gap-0.5 rounded-full py-1 pr-2 pl-1 text-sm font-medium text-accent outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
            >
              <ChevronLeft aria-hidden="true" size={18} />
              {t.back}
            </button>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span
                aria-hidden="true"
                className={`squircle mt-1 size-14 shadow-[inset_0_1px_0_var(--c-highlight)] transition-colors duration-500 sm:size-16 ${TONE_CLASS[tone]}`}
              >
                <BadgeCheck size={30} strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <h1 className="display-type break-words text-3xl font-semibold text-label sm:text-display">
                  {t.title}
                </h1>
                <p className="mt-1.5 text-sm text-secondary-label">{t.subtitle}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end sm:pb-1">
              {!loading && (
                <div
                  aria-label={de.header.summaryLabel}
                  className="flex flex-wrap items-center gap-2 text-sm font-medium text-label"
                >
                  <SummaryPills summary={summary} />
                </div>
              )}
              <button
                type="button"
                onClick={reload}
                disabled={loading}
                className="inline-flex items-center gap-1.5 self-start rounded-full bg-fill px-3 py-1.5 text-sm font-medium text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 sm:self-end"
              >
                <RotateCw aria-hidden="true" size={15} className={loading ? 'animate-spin' : ''} />
                {t.refresh}
              </button>
            </div>
          </div>
          <p className="max-w-3xl text-sm text-secondary-label">{t.note}</p>
          <p className="sr-only" role="status" aria-live="polite">
            {loading ? t.a11y.loading : t.a11y.done(summarySentence(summary))}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {!loading && <PostureScoreBar score={score} />}
          <div className="flex min-w-0 flex-col gap-2">
            <PostureLevelSelect value={level} onChange={onLevelChange} />
            <p className="max-w-md text-xs text-secondary-label">{t.level.hint}</p>
          </div>
        </div>

        {loading
          ? POSTURE_SECTIONS.map((section) => (
              <section
                key={section.key}
                aria-labelledby={`posture-section-${section.key}`}
                className="flex flex-col gap-3"
              >
                <h2
                  id={`posture-section-${section.key}`}
                  className="text-lg font-semibold text-label"
                >
                  {de.posture.sections[section.key]}
                </h2>
                <ul
                  aria-label={de.grid.label}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                >
                  {section.tiles.map((id) => (
                    <li key={id}>
                      <TileSkeleton tile={{ id, title: de.tiles[id] }} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          : groupPostureTiles(tiles).map((section) => (
              <section
                key={section.key}
                aria-labelledby={`posture-section-${section.key}`}
                data-testid={`posture-section-${section.key}`}
                className="flex flex-col gap-3"
              >
                <h2
                  id={`posture-section-${section.key}`}
                  className="text-lg font-semibold text-label"
                >
                  {de.posture.sections[section.key]}
                </h2>
                <TileGrid tiles={section.tiles} onOpen={handleOpen} />
              </section>
            ))}
        <AnimatePresence>
          {openTile && (
            <DetailSheet
              key="detail-sheet"
              tile={openTile}
              origin={origin}
              notices={[]}
              onClose={onCloseTile}
              onRetry={reload}
            />
          )}
        </AnimatePresence>
      </div>
    </PrivacyViewProvider>
  );
}
