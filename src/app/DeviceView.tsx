/**
 * Ergebnisansicht eines Geräts: Header, Kachel-Grid und Detail-Sheet.
 * Daten kommen ausschließlich über useDeviceSnapshot (Provider-Schnittstelle).
 */
import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiagnosticsReport } from '../diagnostics/types';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { de } from '../i18n/de';
import { useDeviceSnapshot } from '../hooks/useDeviceSnapshot';
import { evaluateTiles, sortTiles, summarize, TILE_ORDER } from '../rules/evaluate';
import type { Tile } from '../domain/types';
import { DetailSheet } from '../ui/DetailSheet';
import { DeviceHeader } from '../ui/DeviceHeader';
import { DiagnosticsChip } from '../ui/DiagnosticsChip';
import { ErrorState } from '../ui/ErrorState';
import { sectionNotices } from '../ui/sectionNotices';
import { TileGrid } from '../ui/TileGrid';
import { TileSkeleton } from '../ui/TileSkeleton';

interface Props {
  provider: DeviceDataProvider;
  deviceId: string;
  /** Aus der URL: ?tile=<id> */
  openTileId: string | null;
  onOpenTile: (tileId: string) => void;
  onCloseTile: () => void;
  onRetryDevice: () => void;
  /** Befunde einer DiagLogs-ZIP, die mit diesem Gerät zusammengeführt wurden */
  diagnostics?: DiagnosticsReport;
  onRemoveDiagnostics?: () => void;
}

/** Anzahl der Standard-Kacheln (ohne ZIP-Kacheln) – für Platzhalter und Fortschritt. */
const BASE_TILE_IDS = TILE_ORDER.slice(0, 7);

export function DeviceView({
  provider,
  deviceId,
  openTileId,
  onOpenTile,
  onCloseTile,
  onRetryDevice,
  diagnostics,
  onRemoveDiagnostics,
}: Props) {
  const { status, snapshot, error, now, retrySection } = useDeviceSnapshot(
    provider,
    deviceId,
    diagnostics,
  );
  const [origin, setOrigin] = useState<DOMRect | null>(null);

  const tiles = useMemo<Tile[]>(
    () => (snapshot && now ? evaluateTiles(snapshot, now) : []),
    [snapshot, now],
  );
  const summary = useMemo(() => summarize(tiles), [tiles]);
  const stillLoading = tiles.some((tile) => tile.state === 'loading');
  // Sortierung erst, wenn nichts mehr lädt – vorher springt sonst die Anordnung.
  const ordered = useMemo(() => (stillLoading ? tiles : sortTiles(tiles)), [tiles, stillLoading]);

  const openTile = openTileId ? tiles.find((tile) => tile.id === openTileId) : undefined;

  // Seitentitel
  const deviceName = snapshot?.device.deviceName;
  useEffect(() => {
    if (!deviceName) return;
    const previous = document.title;
    document.title = `${deviceName} – ${de.app.name}`;
    return () => {
      document.title = previous;
    };
  }, [deviceName]);

  // Fokus kehrt zur Kachel zurück, sobald das Sheet geschlossen wird (Escape, Scrim, Zurück).
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

  if (status === 'error' && error) {
    return <ErrorState error={error} onRetry={onRetryDevice} />;
  }

  const retryTile = (tile: Tile) => {
    if (!snapshot) return;
    const failed = tile.sections.filter((key) => snapshot[key]?.status === 'error');
    for (const key of failed.length > 0 ? failed : tile.sections) retrySection(key);
  };

  return (
    <div className="flex flex-col gap-6">
      <DeviceHeader
        device={snapshot?.device ?? null}
        summary={snapshot ? summary : null}
        totalTiles={tiles.length}
        badges={
          diagnostics && onRemoveDiagnostics ? (
            <DiagnosticsChip fileName={diagnostics.fileName} onRemove={onRemoveDiagnostics} />
          ) : undefined
        }
      />
      {snapshot ? (
        <TileGrid tiles={ordered} onOpen={handleOpen} />
      ) : (
        <ul
          aria-label={de.grid.label}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {BASE_TILE_IDS.map((id) => (
            <li key={id}>
              <TileSkeleton tile={{ id, title: de.tiles[id] }} />
            </li>
          ))}
        </ul>
      )}
      <AnimatePresence>
        {snapshot && openTile && (
          <DetailSheet
            key="detail-sheet"
            tile={openTile}
            origin={origin}
            notices={sectionNotices(snapshot, openTile)}
            onClose={onCloseTile}
            onRetry={() => retryTile(openTile)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
