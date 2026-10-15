import { Ban, Lock, Minus, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { PointerEvent, Ref } from 'react';
import type { Tile, TileAvailability } from '../domain/types';
import { de } from '../i18n/de';
import { SeverityBadge } from './SeverityBadge';
import { TILE_ICON } from './tileIcons';

const AVAILABILITY_ICON: Record<TileAvailability, LucideIcon> = {
  forbidden: Lock,
  notApplicable: Ban,
  unavailable: Minus,
  error: TriangleAlert,
};

const AVAILABILITY_ICON_CLASS: Record<TileAvailability, string> = {
  forbidden: 'text-warning',
  notApplicable: 'text-unknown',
  unavailable: 'text-unknown',
  error: 'text-critical',
};

/** Icon-Squircle: nur Problem/Prüfen werden eingefärbt – gesunde Kacheln bleiben ruhig. */
const ICON_TONE_CLASS = {
  critical: 'bg-critical/15 text-critical',
  warning: 'bg-warning/15 text-warning',
  neutral: 'bg-fill text-secondary-label',
} as const;

/** Lichtfleck folgt dem Zeiger 1:1 (CSS-Variablen, kein Re-Render). */
function trackPointer(event: PointerEvent<HTMLButtonElement>) {
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${event.clientX - rect.left}px`);
  el.style.setProperty('--my', `${event.clientY - rect.top}px`);
}

interface Props {
  tile: Tile;
  onOpen: (tile: Tile, element: HTMLButtonElement) => void;
  ref?: Ref<HTMLButtonElement>;
}

/** Fertige Kachel: ganze Fläche ist ein Button, der das Detail-Sheet öffnet. */
export function StatusTile({ tile, onOpen, ref }: Props) {
  const Icon = TILE_ICON[tile.id];
  const availability = tile.availability;
  const muted = availability === 'notApplicable' || availability === 'unavailable';
  const AvailabilityIcon = availability ? AVAILABILITY_ICON[availability] : null;
  const tone =
    !availability && (tile.severity === 'critical' || tile.severity === 'warning')
      ? tile.severity
      : 'neutral';

  return (
    <button
      ref={ref}
      type="button"
      data-tile-id={tile.id}
      data-severity={availability ? undefined : tile.severity}
      aria-haspopup="dialog"
      onClick={(event) => onOpen(tile, event.currentTarget)}
      onPointerMove={trackPointer}
      onPointerDown={trackPointer}
      className="tile material-card hc-edge grid h-full min-h-36 w-full cursor-pointer sm:min-h-44 grid-cols-[auto_1fr] grid-rows-[auto_auto_1fr] content-start gap-x-2 rounded-tile p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/* DOM-Reihenfolge: Titel zuerst (zugänglicher Name beginnt mit dem Titel), optisch unter dem Icon */}
      <span
        data-tile-title=""
        className="col-span-2 row-start-2 mt-3.5 truncate text-sm font-medium tracking-[0.005em] text-secondary-label"
      >
        {tile.title}
      </span>
      <span
        aria-hidden="true"
        className={`squircle col-start-1 row-start-1 size-9 ${ICON_TONE_CLASS[tone]}`}
      >
        <Icon size={19} strokeWidth={2} />
      </span>
      <span className="col-start-2 row-start-1 justify-self-end">
        {availability && AvailabilityIcon ? (
          <span
            title={de.availability[availability]}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-unknown/12 px-2 py-0.5 text-xs font-medium text-label"
          >
            <AvailabilityIcon
              aria-hidden="true"
              size={14}
              strokeWidth={2.25}
              className={AVAILABILITY_ICON_CLASS[availability]}
            />
            {de.availabilityShort[availability]}
          </span>
        ) : (
          <SeverityBadge severity={tile.severity} />
        )}
      </span>
      <span className="col-span-2 row-start-3 mt-0.5 flex flex-col gap-1">
        <span
          className={`line-clamp-2 text-[1.5rem] leading-[1.15] font-semibold tracking-[-0.018em] tabular-nums ${
            muted ? 'text-secondary-label' : 'text-label'
          }`}
        >
          {tile.value}
        </span>
        <span className="line-clamp-1 text-sm text-secondary-label">{tile.summary}</span>
      </span>
    </button>
  );
}
