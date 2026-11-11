import { Ban, Lock, Minus, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { Ref } from 'react';
import type { Tile, TileAvailability } from '../domain/types';
import { de } from '../i18n/de';
import { SeverityIcon } from './SeverityBadge';
import { TILE_ICON } from './tileIcons';

const AVAILABILITY_ICON: Record<TileAvailability, LucideIcon> = {
  forbidden: Lock,
  notApplicable: Ban,
  unavailable: Minus,
  error: TriangleAlert,
};

interface Props {
  tile: Tile;
  onOpen: (tile: Tile, element: HTMLButtonElement) => void;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Kompakte Kachel für unauffällige Befunde („In Ordnung“, „Nicht anwendbar“): eine Zeile mit Icon,
 * Titel, Hauptwert und Status-Icon. Ist wie die große Kachel ein `<button>` mit demselben
 * zugänglichen Namen (Titel, Status, Wert, Kontext) und öffnet dasselbe Detail-Sheet.
 */
export function CompactTile({ tile, onOpen, ref }: Props) {
  const Icon = TILE_ICON[tile.id];
  const availability = tile.availability;
  const AvailabilityIcon = availability ? AVAILABILITY_ICON[availability] : null;
  const statusText = availability ? de.availabilityShort[availability] : de.severity[tile.severity];
  const muted = Boolean(availability);

  return (
    <button
      ref={ref}
      type="button"
      data-tile-id={tile.id}
      data-tile-compact=""
      data-severity={availability ? undefined : tile.severity}
      aria-haspopup="dialog"
      onClick={(event) => onOpen(tile, event.currentTarget)}
      className="tile material-card hc-edge flex h-full min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/* DOM-Reihenfolge wie bei der großen Kachel: Titel, Status, Wert, Kontext */}
      <span aria-hidden="true" className="squircle order-first size-7 bg-fill text-secondary-label">
        <Icon size={15} strokeWidth={2} />
      </span>
      <span
        data-tile-title=""
        className="min-w-min flex-1 text-sm leading-tight font-medium tracking-[0.005em] text-secondary-label"
      >
        {tile.title}
      </span>
      <span className="order-last inline-flex shrink-0 items-center" title={statusText}>
        {AvailabilityIcon ? (
          <AvailabilityIcon
            aria-hidden="true"
            size={16}
            strokeWidth={2.25}
            className="text-unknown"
          />
        ) : (
          <SeverityIcon severity={tile.severity} size={16} />
        )}
        <span className="sr-only">{statusText}</span>
      </span>
      <span
        className={`min-w-min shrink text-right text-sm leading-tight font-semibold tabular-nums ${
          muted ? 'text-secondary-label' : 'text-label'
        }`}
      >
        {tile.value}
      </span>
      <span className="sr-only">{tile.summary}</span>
    </button>
  );
}
