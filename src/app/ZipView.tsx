/**
 * Reine ZIP-Ansicht: Header, Kachel-Grid und Detail-Sheet für die Befunde einer DiagLogs-ZIP.
 * Wenn im aktuellen Modus ein Gerät gleichen Namens existiert, erscheint das Angebot zum Zusammenführen.
 */
import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiagnosticsReport } from '../diagnostics/types';
import type { Tile } from '../domain/types';
import { useResolvedApps } from '../hooks/useResolvedApps';
import { de } from '../i18n/de';
import { useProviderContext } from './providerContextValue';
import { sortTiles, summarize } from '../rules/evaluate';
import { buildTicketNote } from '../rules/ticketNote';
import { evaluateDiagnosticsTiles } from '../rules/tiles/diagnostics';
import type { AmbientTone } from '../ui/AmbientGlow';
import { DetailSheet } from '../ui/DetailSheet';
import { MergeOffer } from '../ui/MergeOffer';
import { TicketNoteButton } from '../ui/TicketNoteButton';
import { TileGrid } from '../ui/TileGrid';
import { ZipHeader } from '../ui/ZipHeader';
import { zipTitle } from '../ui/zipTitle';

interface Props {
  report: DiagnosticsReport;
  /** Gefundenes Intune-Gerät gleichen Namens (null = kein Angebot) */
  offer: { deviceName: string } | null;
  onMerge: () => void;
  onBack: () => void;
  /** Gesamtzustand für das Umgebungslicht */
  onToneChange?: (tone: AmbientTone) => void;
}

export function ZipView({ report: rawReport, offer, onMerge, onBack, onToneChange }: Props) {
  const { provider } = useProviderContext();
  const report = useResolvedApps(provider, rawReport);
  const [now] = useState(() => new Date());
  const [openId, setOpenId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<DOMRect | null>(null);

  const tiles = useMemo(() => sortTiles(evaluateDiagnosticsTiles(report, now)), [report, now]);
  const summary = useMemo(() => summarize(tiles), [tiles]);
  useEffect(() => {
    onToneChange?.(summary.worst);
  }, [summary.worst, onToneChange]);
  const openTile = openId ? tiles.find((tile) => tile.id === openId) : undefined;

  const title = zipTitle(report);
  const getTicketNote = useCallback(
    () =>
      buildTicketNote({
        title,
        details: [de.zipView.kind, report.fileName],
        mode: 'zip',
        tiles,
        now: new Date(),
      }),
    [title, report.fileName, tiles],
  );
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} – ${de.app.name}`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  // Fokus kehrt zur Kachel zurück, sobald das Sheet geschlossen wird.
  const previousOpen = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousOpen.current;
    previousOpen.current = openTile?.id ?? null;
    if (previous && !openTile) {
      document.querySelector<HTMLElement>(`[data-tile-id="${previous}"]`)?.focus();
    }
  }, [openTile]);

  const handleOpen = useCallback((tile: Tile, element: HTMLButtonElement) => {
    setOrigin(element.getBoundingClientRect());
    setOpenId(tile.id);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <ZipHeader
        report={report}
        summary={summary}
        onBack={onBack}
        actions={<TicketNoteButton getNote={getTicketNote} />}
      />
      {offer && <MergeOffer deviceName={offer.deviceName} onMerge={onMerge} />}
      <TileGrid tiles={tiles} onOpen={handleOpen} />
      <AnimatePresence>
        {openTile && (
          <DetailSheet
            key="detail-sheet"
            tile={openTile}
            origin={origin}
            notices={[]}
            onClose={() => setOpenId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
