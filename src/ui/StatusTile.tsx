import { Ban, Lock, Minus, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { Ref } from 'react';
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

  return (
    <button
      ref={ref}
      type="button"
      data-tile-id={tile.id}
      aria-haspopup="dialog"
      onClick={(event) => onOpen(tile, event.currentTarget)}
      className="hc-edge flex min-h-36 w-full cursor-pointer flex-col gap-3 rounded-tile bg-surface p-5 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_rgb(0_0_0/0.04)] outline-none transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_20px_rgb(0_0_0/0.07)] focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-secondary-label">
          <Icon aria-hidden="true" size={20} className="shrink-0" />
          <span className="truncate text-sm font-medium">{tile.title}</span>
        </span>
        {availability && AvailabilityIcon ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-unknown/12 px-2 py-0.5 text-xs font-medium text-label">
            <AvailabilityIcon
              aria-hidden="true"
              size={14}
              strokeWidth={2.25}
              className={AVAILABILITY_ICON_CLASS[availability]}
            />
            {de.availability[availability]}
          </span>
        ) : (
          <SeverityBadge severity={tile.severity} />
        )}
      </span>
      <span className="mt-auto flex flex-col gap-1">
        <span
          className={`line-clamp-2 text-title font-semibold tabular-nums ${
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
