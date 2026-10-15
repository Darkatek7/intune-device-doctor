import { motion, useReducedMotion } from 'motion/react';
import type { Tile } from '../domain/types';
import { de } from '../i18n/de';
import { fade, spring, STAGGER } from './motion';
import { StatusTile } from './StatusTile';
import { TileSkeleton } from './TileSkeleton';

interface Props {
  /** Bereits in Anzeigereihenfolge (Sortierung erst nach Abschluss des Ladens) */
  tiles: Tile[];
  onOpen: (tile: Tile, element: HTMLButtonElement) => void;
}

/** Responsives Kachel-Grid; gestaffeltes Einblenden, Umsortieren per layout-Animation. */
export function TileGrid({ tiles, onOpen }: Props) {
  const reduced = useReducedMotion();
  return (
    <ul
      aria-label={de.grid.label}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {tiles.map((tile, index) => (
        <motion.li
          key={tile.id}
          layout={reduced ? false : 'position'}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={
            reduced ? fade : { default: { ...spring, delay: index * STAGGER }, layout: spring }
          }
          className="min-w-0"
        >
          {tile.state === 'loading' ? (
            <TileSkeleton tile={tile} />
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>
              <StatusTile tile={tile} onOpen={onOpen} />
            </motion.div>
          )}
        </motion.li>
      ))}
    </ul>
  );
}
