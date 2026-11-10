import { CircleCheck } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Fragment } from 'react';
import type { Tile } from '../domain/types';
import { de } from '../i18n/de';
import { CompactTile } from './CompactTile';
import { isHealthyTile } from './tileGroups';
import { fade, spring, STAGGER } from './motion';
import { StatusTile } from './StatusTile';
import { TileSkeleton } from './TileSkeleton';

interface Props {
  /** Bereits in Anzeigereihenfolge (Sortierung erst nach Abschluss des Ladens) */
  tiles: Tile[];
  onOpen: (tile: Tile, element: HTMLButtonElement) => void;
  /**
   * Alles geladen → unauffällige Kacheln wandern in den kompakten Abschnitt „In Ordnung“.
   * Standard: keine Kachel lädt mehr.
   */
  settled?: boolean;
}

/**
 * Zwölfspaltiges Raster, damit große und kompakte Kacheln in EINER Liste stehen (stabile Keys →
 * beim Abschluss des Ladens wandern die Kacheln per Layout-Animation statt neu aufzubauen).
 * Große Karte: 1/2/3/4 Spalten wie bisher; kompakte Kachel: 1/2/3 Spalten.
 */
const LARGE_SPAN = 'col-span-12 sm:col-span-6 lg:col-span-4 xl:col-span-3';
const COMPACT_SPAN = 'col-span-12 sm:col-span-6 lg:col-span-4';

/** Responsives Kachel-Grid; gestaffeltes Einblenden, Umsortieren per layout-Animation. */
export function TileGrid({ tiles, onOpen, settled }: Props) {
  const reduced = useReducedMotion();
  const done = settled ?? !tiles.some((tile) => tile.state === 'loading');
  const healthyCount = done ? tiles.filter(isHealthyTile).length : 0;
  const attentionCount = tiles.length - healthyCount;
  const firstHealthyId = done ? tiles.find(isHealthyTile)?.id : undefined;

  const motionProps = (index: number) => ({
    layout: reduced ? (false as const) : ('position' as const),
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: reduced ? { opacity: 1 } : { opacity: 1, y: 0 },
    transition: reduced ? fade : { default: { ...spring, delay: index * STAGGER }, layout: spring },
  });

  return (
    <ul aria-label={de.grid.label} className="grid grid-cols-12 gap-3 sm:gap-4">
      {tiles.map((tile, index) => {
        const compact = done && isHealthyTile(tile);
        return (
          <Fragment key={tile.id}>
            {tile.id === firstHealthyId && (
              <motion.li
                key="healthy-intro"
                layout={reduced ? false : 'position'}
                transition={spring}
                data-testid="healthy-section"
                className="col-span-12 flex flex-col gap-3 pt-2"
              >
                {attentionCount === 0 && (
                  <div
                    data-testid="all-ok-banner"
                    className="flex items-center gap-3 rounded-tile bg-ok/10 p-4"
                  >
                    <span aria-hidden="true" className="squircle size-10 bg-ok/15 text-ok">
                      <CircleCheck size={22} strokeWidth={2} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-label">{de.grid.allOkTitle}</p>
                      <p className="text-sm text-secondary-label">
                        {de.grid.allOkBody(tiles.length)}
                      </p>
                    </div>
                  </div>
                )}
                <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.06em] text-secondary-label">
                  {de.grid.healthyTitle(healthyCount)}
                </h2>
              </motion.li>
            )}
            <motion.li
              {...motionProps(index)}
              className={`min-w-0 ${compact ? COMPACT_SPAN : LARGE_SPAN}`}
            >
              {tile.state === 'loading' ? (
                <TileSkeleton tile={tile} />
              ) : (
                <motion.div
                  key={compact ? 'compact' : 'large'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={fade}
                  className="h-full"
                >
                  {compact ? (
                    <CompactTile tile={tile} onOpen={onOpen} />
                  ) : (
                    <StatusTile tile={tile} onOpen={onOpen} />
                  )}
                </motion.div>
              )}
            </motion.li>
          </Fragment>
        );
      })}
    </ul>
  );
}
