/**
 * Regel-Engine: DeviceSnapshot → Tile[]. Reine Funktionen, "now" wird übergeben.
 * Jede Kachel hat eine eigene Funktion in ./tiles; eine Kachel ist "loading", solange eine der
 * benötigten Sections noch undefined ist.
 */
import type { DeviceSnapshot, Severity, Tile, TileId } from '../domain/types';
import { evaluateBitLocker } from './tiles/bitlocker';
import { evaluateCheckIn } from './tiles/checkIn';
import { evaluateCompliance } from './tiles/compliance';
import { evaluateDefender } from './tiles/defender';
import { evaluateDeviceStatus } from './tiles/deviceStatus';
import { evaluateOsVersion } from './tiles/osVersion';
import { evaluatePolicies } from './tiles/policies';
import { evaluateDiagnosticsTiles } from './tiles/diagnostics';
import { de } from '../i18n/de';
import { IntunePortal } from '../links/intunePortal';

/** Standard-Reihenfolge der Kacheln (vor der Sortierung nach Schweregrad). */
export const TILE_ORDER: TileId[] = [
  'deviceStatus',
  'compliance',
  'checkIn',
  'osVersion',
  'bitlocker',
  'defender',
  'policies',
  'entraJoin',
  'win32Apps',
  'enrollment',
  'diagCollection',
];

export function evaluateTiles(snapshot: DeviceSnapshot, now: Date): Tile[] {
  const tiles: Tile[] = [
    evaluateDeviceStatus(snapshot, now),
    evaluateCompliance(snapshot, now),
    evaluateCheckIn(snapshot, now),
    evaluateOsVersion(snapshot, now),
    evaluateBitLocker(snapshot, now),
    evaluateDefender(snapshot, now),
    evaluatePolicies(snapshot, now),
  ];
  if (snapshot.diagnostics) tiles.push(...evaluateDiagnosticsTiles(snapshot.diagnostics, now));
  return withPortalLinks(tiles, snapshot);
}

/** Befunde zu Compliance und Richtlinien verlinken auf das Gerät im Intune Admin Center. */
function withPortalLinks(tiles: Tile[], snapshot: DeviceSnapshot): Tile[] {
  const deviceLink = { label: de.links.openDevice, url: IntunePortal.device(snapshot.device.id) };
  const policyListLink = {
    label: de.links.configurationPolicies,
    url: IntunePortal.configurationPolicies,
  };
  return tiles.map((tile) => {
    if (tile.id !== 'compliance' && tile.id !== 'policies') return tile;
    const extra = tile.id === 'policies' ? [deviceLink, policyListLink] : [deviceLink];
    return {
      ...tile,
      findings: tile.findings.map((finding) => ({
        ...finding,
        links: [...(finding.links ?? []), ...extra],
      })),
    };
  });
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, unknown: 2, ok: 3 };

/** critical → warning → unknown → ok; stabil innerhalb einer Stufe; Kacheln, die noch laden, ans Ende. */
export function sortTiles(tiles: Tile[]): Tile[] {
  return tiles
    .map((tile, index) => ({ tile, index }))
    .sort((a, b) => {
      const la = a.tile.state === 'loading' ? 1 : 0;
      const lb = b.tile.state === 'loading' ? 1 : 0;
      if (la !== lb) return la - lb;
      const diff = SEVERITY_RANK[a.tile.severity] - SEVERITY_RANK[b.tile.severity];
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map(({ tile }) => tile);
}

export interface TileSummary {
  critical: number;
  warning: number;
  unknown: number;
  ok: number;
  loading: number;
  /** Schlechteste Severity der fertigen Kacheln (ok, wenn keine Probleme) */
  worst: Severity;
}

/** Zusammenfassung für den Geräte-Header ("3 Probleme · 1 Hinweis"). */
export function summarize(tiles: Tile[]): TileSummary {
  const summary: TileSummary = {
    critical: 0,
    warning: 0,
    unknown: 0,
    ok: 0,
    loading: 0,
    worst: 'ok',
  };
  for (const tile of tiles) {
    if (tile.state === 'loading') {
      summary.loading++;
      continue;
    }
    summary[tile.severity]++;
  }
  const ready = summary.critical + summary.warning + summary.unknown + summary.ok;
  summary.worst =
    ready === 0
      ? 'unknown'
      : summary.critical
        ? 'critical'
        : summary.warning
          ? 'warning'
          : summary.unknown
            ? 'unknown'
            : 'ok';
  return summary;
}
