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
      className="hc-edge flex min-h-36 flex-col gap-3 rounded-tile bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_rgb(0_0_0/0.04)]"
    >
      <div className="flex items-center gap-2 text-secondary-label">
        <Icon aria-hidden="true" size={20} className="shrink-0" />
        <span className="text-sm font-medium">{tile.title}</span>
      </div>
      <div className="skeleton mt-2 h-6 w-2/3 rounded-md" />
      <div className="skeleton h-4 w-full rounded-md" />
    </div>
  );
}
