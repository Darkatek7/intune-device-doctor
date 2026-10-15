import type { Tile } from '../domain/types';
import { de } from '../i18n/de';
import { TILE_ICON } from './tileIcons';

/** Platzhalter in Kachelform, solange die benötigten Sections laden. */
export function TileSkeleton({ tile }: { tile: Pick<Tile, 'id' | 'title'> }) {
  const Icon = TILE_ICON[tile.id];
  return (
    <div
      aria-busy="true"
      aria-label={`${tile.title}: ${de.states.loading}`}
      role="group"
      data-tile-skeleton={tile.id}
      className="material-card hc-edge flex h-full min-h-36 flex-col rounded-tile p-5 sm:min-h-44"
    >
      <span aria-hidden="true" className="squircle size-9 bg-fill text-secondary-label">
        <Icon size={19} />
      </span>
      <span className="mt-3.5 text-sm font-medium text-secondary-label">{tile.title}</span>
      <div className="skeleton mt-auto mb-2 h-7 w-2/3 rounded-md" />
      <div className="skeleton h-4 w-full rounded-md" />
    </div>
  );
}
