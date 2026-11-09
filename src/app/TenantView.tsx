/**
 * Ansicht „Mandant“ (M14/S5): mandantenweite Zertifikate und Token als Kacheln – unabhängig von einem
 * Gerät, mit denselben Kachel- und Sheet-Komponenten wie die Geräteansicht. Daten kommen ausschließlich
 * über useTenantStatus (Provider-Schnittstelle).
 */
import { AnimatePresence } from 'motion/react';
import { ChevronLeft, Landmark, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Tile } from '../domain/types';
import { useTenantStatus } from '../hooks/useTenantStatus';
import { de } from '../i18n/de';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { evaluateTenant } from '../rules/tenant';
import { summarize } from '../rules/evaluate';
import type { AmbientTone } from '../ui/AmbientGlow';
import { DetailSheet } from '../ui/DetailSheet';
import { ErrorState } from '../ui/ErrorState';
import { SummaryPills } from '../ui/SummaryPills';
import { summarySentence } from '../ui/summaryText';
import { TileGrid } from '../ui/TileGrid';
import { TileSkeleton } from '../ui/TileSkeleton';
import { TONE_CLASS } from '../ui/tone';

interface Props {
  provider: DeviceDataProvider;
  /** Aus der URL: ?tile=<id> */
  openTileId: string | null;
  onOpenTile: (tileId: string) => void;
  onCloseTile: () => void;
  onBack: () => void;
  /** Gesamtzustand für das Umgebungslicht (accent, solange geladen wird) */
  onToneChange?: (tone: AmbientTone) => void;
}

const SKELETONS = ['tenantApplePush', 'tenantVpp', 'tenantUnavailable'] as const;

export function TenantView({
  provider,
  openTileId,
  onOpenTile,
  onCloseTile,
  onBack,
  onToneChange,
}: Props) {
  const { state, reload } = useTenantStatus(provider);
  const [origin, setOrigin] = useState<DOMRect | null>(null);

  const tiles = useMemo<Tile[]>(
    () => (state.status === 'done' ? evaluateTenant(state.data, state.now) : []),
    [state],
  );
  const summary = useMemo(() => summarize(tiles), [tiles]);
  const tone: AmbientTone = state.status === 'done' ? summary.worst : 'accent';
  useEffect(() => {
    onToneChange?.(tone);
  }, [tone, onToneChange]);

  useEffect(() => {
    const previous = document.title;
    document.title = `${de.tenantView.title} – ${de.app.name}`;
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 inline-flex items-center gap-0.5 rounded-full py-1 pr-2 pl-1 text-sm font-medium text-accent outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
          >
            <ChevronLeft aria-hidden="true" size={18} />
            {de.tenantView.back}
          </button>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span
              aria-hidden="true"
              className={`squircle mt-1 size-14 shadow-[inset_0_1px_0_var(--c-highlight)] transition-colors duration-500 sm:size-16 ${TONE_CLASS[tone]}`}
            >
              <Landmark size={30} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h1 className="display-type break-words text-3xl font-semibold text-label sm:text-display">
                {de.tenantView.title}
              </h1>
              <p className="mt-1.5 text-sm text-secondary-label">{de.tenantView.subtitle}</p>
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
              {de.tenantView.refresh}
            </button>
          </div>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {loading ? de.tenantView.a11y.loading : de.tenantView.a11y.done(summarySentence(summary))}
        </p>
      </div>
      {loading ? (
        <ul
          aria-label={de.grid.label}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {SKELETONS.map((id) => (
            <li key={id}>
              <TileSkeleton tile={{ id, title: de.tiles[id] }} />
            </li>
          ))}
        </ul>
      ) : (
        <TileGrid tiles={tiles} onOpen={handleOpen} />
      )}
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
  );
}
