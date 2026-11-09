/**
 * Ergebnisansicht eines Geräts: Header, Kachel-Grid und Detail-Sheet.
 * Daten kommen ausschließlich über useDeviceSnapshot (Provider-Schnittstelle).
 */
import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiagnosticsReport } from '../diagnostics/types';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { de } from '../i18n/de';
import { SECTION_KEYS, useDeviceSnapshot } from '../hooks/useDeviceSnapshot';
import { useResolvedApps } from '../hooks/useResolvedApps';
import { evaluateTiles, sortTiles, summarize, TILE_ORDER } from '../rules/evaluate';
import { buildTicketNote } from '../rules/ticketNote';
import { correlate } from '../rules/correlate';
import { buildTimeline } from '../rules/timeline';
import type { DeviceSearchResult, ManagedDeviceInfo, Tile, TileId } from '../domain/types';
import type { AmbientTone } from '../ui/AmbientGlow';
import { DetailSheet } from '../ui/DetailSheet';
import { DeviceHeader } from '../ui/DeviceHeader';
import { deviceMeta } from '../ui/deviceMeta';
import { DiagnosticsChip } from '../ui/DiagnosticsChip';
import { ErrorState } from '../ui/ErrorState';
import { InsightCard } from '../ui/InsightCard';
import { TimelineButton } from '../ui/TimelineButton';
import { sectionNotices } from '../ui/sectionNotices';
import { TileGrid } from '../ui/TileGrid';
import { TicketNoteButton } from '../ui/TicketNoteButton';
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
  /** Gesamtzustand für das Umgebungslicht (accent, solange geladen wird) */
  onToneChange?: (tone: AmbientTone) => void;
  /** Gerät wurde geladen – für „Zuletzt geöffnet“ (nur id, Name, Plattform) */
  onDeviceLoaded?: (device: Pick<ManagedDeviceInfo, 'id' | 'deviceName' | 'osFamily'>) => void;
  /** Öffnet ein anderes Gerät (Zeile „Weitere Geräte“ im Header) */
  onOpenDevice?: (device: Pick<DeviceSearchResult, 'id' | 'deviceName'>) => void;
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
  onToneChange,
  onDeviceLoaded,
  onOpenDevice,
}: Props) {
  const namedDiagnostics = useResolvedApps(provider, diagnostics);
  const { status, snapshot, error, now, retrySection } = useDeviceSnapshot(
    provider,
    deviceId,
    namedDiagnostics,
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

  const tone: AmbientTone = !snapshot || stillLoading ? 'accent' : summary.worst;
  useEffect(() => {
    onToneChange?.(tone);
  }, [tone, onToneChange]);

  // Drosselung (HTTP 429): mind. eine Section ist mit code "throttled" fehlgeschlagen.
  const throttle = useMemo(() => {
    if (!snapshot) return null;
    const waits: number[] = [];
    let throttled = false;
    for (const key of SECTION_KEYS) {
      const section = snapshot[key];
      if (section?.status === 'error' && section.error.code === 'throttled') {
        throttled = true;
        if (section.error.retryAfterSeconds) waits.push(section.error.retryAfterSeconds);
      }
    }
    if (!throttled) return null;
    return waits.length > 0 ? { retryAfterSeconds: Math.max(...waits) } : {};
  }, [snapshot]);

  // M12/A: Zeitachse und „Wahrscheinlichste Ursache“ – erst, wenn alle Kacheln fertig sind
  const timeline = useMemo(
    () => (snapshot && now && !stillLoading ? buildTimeline({ snapshot, now }) : []),
    [snapshot, now, stillLoading],
  );
  const insights = useMemo(() => (stillLoading ? [] : correlate(tiles)), [tiles, stillLoading]);
  const openableTiles = useMemo(() => new Set<TileId>(tiles.map((tile) => tile.id)), [tiles]);
  const openTileById = useCallback(
    (tileId: TileId) => {
      const element = document.querySelector<HTMLElement>(`[data-tile-id="${tileId}"]`);
      setOrigin(element?.getBoundingClientRect() ?? null);
      onOpenTile(tileId);
    },
    [onOpenTile],
  );

  const getTicketNote = useCallback(() => {
    if (!snapshot) return '';
    return buildTicketNote({
      title: snapshot.device.deviceName,
      details: deviceMeta(snapshot.device, tiles, { enrolled: false }),
      mode: provider.mode,
      tiles,
      now: new Date(),
      insights,
      timeline,
    });
  }, [snapshot, tiles, provider.mode, insights, timeline]);

  const openTile = openTileId ? tiles.find((tile) => tile.id === openTileId) : undefined;

  // „Zuletzt geöffnet“: erst merken, wenn das Gerät tatsächlich geladen wurde.
  const loadedDeviceId = snapshot?.device.id;
  const loadedDeviceName = snapshot?.device.deviceName;
  const loadedOsFamily = snapshot?.device.osFamily;
  useEffect(() => {
    if (!loadedDeviceId || !loadedDeviceName || !loadedOsFamily) return;
    onDeviceLoaded?.({
      id: loadedDeviceId,
      deviceName: loadedDeviceName,
      osFamily: loadedOsFamily,
    });
  }, [loadedDeviceId, loadedDeviceName, loadedOsFamily, onDeviceLoaded]);

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
        tiles={tiles}
        tone={tone}
        throttle={throttle}
        otherDevices={
          snapshot?.userDevices?.status === 'ok' ? snapshot.userDevices.data : undefined
        }
        onOpenDevice={onOpenDevice}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <TimelineButton
              events={timeline}
              openableTiles={openableTiles}
              onOpenTile={openTileById}
              disabled={!snapshot || stillLoading}
            />
            <TicketNoteButton getNote={getTicketNote} disabled={!snapshot || stillLoading} />
          </div>
        }
        badges={
          diagnostics && onRemoveDiagnostics ? (
            <DiagnosticsChip fileName={diagnostics.fileName} onRemove={onRemoveDiagnostics} />
          ) : undefined
        }
      />
      {insights.length > 0 && (
        <InsightCard insights={insights} openableTiles={openableTiles} onOpenTile={openTileById} />
      )}
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
