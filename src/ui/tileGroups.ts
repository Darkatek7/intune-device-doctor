import type { Tile } from '../domain/types';

/** Unauffällig = Severity „ok“ oder „nicht anwendbar“; alles andere bleibt eine große Karte. */
export function isHealthyTile(tile: Tile): boolean {
  if (tile.state === 'loading') return false;
  if (tile.availability) return tile.availability === 'notApplicable';
  return tile.severity === 'ok';
}
