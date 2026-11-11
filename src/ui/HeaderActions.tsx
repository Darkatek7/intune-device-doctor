import { Activity, Download, GitCompareArrows, Printer } from 'lucide-react';
import { useRef } from 'react';
import type { DiagnosticsReport } from '../diagnostics/types';
import type { Tile, TileId } from '../domain/types';
import { de } from '../i18n/de';
import { usePrivacy } from '../privacy/privacyContext';
import type { SnapshotFile } from '../rules/snapshotCompare';
import type { TimelineEvent } from '../rules/timeline';
import { ActionMenu, type ActionMenuItem } from './ActionMenu';
import { CompareControls, type CompareControlsHandle } from './CompareControls';
import { CompareZipControls, type CompareZipHandle } from './CompareZipControls';
import { TicketNoteButton, type TicketNoteHandle } from './TicketNoteButton';
import { TimelineButton } from './TimelineButton';

type Compare =
  /** Geräteansicht: Stand exportieren / mit Stand vergleichen */
  | { kind: 'device'; getCurrent: () => SnapshotFile | null; currentLabel: string }
  /** ZIP-Ansicht: mit weiterer ZIP vergleichen */
  | { kind: 'zip'; report: DiagnosticsReport; tiles: readonly Tile[] };

interface Props {
  timeline: {
    events: readonly TimelineEvent[];
    openableTiles: ReadonlySet<TileId>;
    onOpenTile: (tileId: TileId) => void;
  };
  getTicketNote: () => string;
  compare: Compare;
  /** Solange Kacheln laden: Aktionen nicht benutzbar */
  disabled?: boolean;
  /** Verbindungstest (Live); fehlt → kein Eintrag */
  onOpenConnectionTest?: () => void;
}

/**
 * Aktionsleiste des Geräte- und ZIP-Headers: „Zeitachse“ und „Ticket-Notiz kopieren“ bleiben
 * sichtbar, alles Weitere (Drucken, Export, Vergleich, Verbindungstest) liegt im Menü „Mehr“.
 */
export function HeaderActions({
  timeline,
  getTicketNote,
  compare,
  disabled = false,
  onOpenConnectionTest,
}: Props) {
  const { enabled: privacyOn } = usePrivacy();
  const moreRef = useRef<HTMLButtonElement>(null);
  const ticketRef = useRef<TicketNoteHandle>(null);
  const compareRef = useRef<CompareControlsHandle>(null);
  const zipRef = useRef<CompareZipHandle>(null);

  // Aktionen als eigene Funktionen: Die Refs werden erst beim Auslösen gelesen, nie beim Rendern.
  const openPrint = () => ticketRef.current?.openPrint();
  const exportSnapshot = () => compareRef.current?.exportSnapshot();
  const chooseSnapshot = () => compareRef.current?.chooseFile();
  const chooseZip = () => zipRef.current?.chooseFile();

  const items: ActionMenuItem[] = [
    {
      id: 'print',
      label: de.comfort.printButton,
      icon: Printer,
      hint: de.comfort.printHint,
      disabled,
      onSelect: openPrint,
    },
    ...(compare.kind === 'device'
      ? [
          {
            id: 'export',
            label: de.compare.exportButton,
            icon: Download,
            hint: privacyOn
              ? `${de.compare.exportHint} ${de.privacy.output.export}`
              : de.compare.exportHint,
            disabled,
            onSelect: exportSnapshot,
          },
          {
            id: 'compare',
            label: de.compare.compareButton,
            icon: GitCompareArrows,
            hint: `${de.compare.compareHint} ${de.compare.fileLocal}`,
            disabled,
            onSelect: chooseSnapshot,
          },
        ]
      : [
          {
            id: 'compare-zip',
            label: de.compare.zipButton,
            icon: GitCompareArrows,
            hint: `${de.compare.zipHint} ${de.compare.fileLocal}`,
            onSelect: chooseZip,
          },
        ]),
    ...(onOpenConnectionTest
      ? [
          {
            id: 'connection-test',
            label: de.connectionTest.open,
            icon: Activity,
            hint: de.connectionTest.openHint,
            onSelect: onOpenConnectionTest,
          },
        ]
      : []),
  ];

  return (
    <div
      role="group"
      aria-label={de.actions.label}
      className="flex flex-wrap items-start gap-2 sm:justify-end"
    >
      <TimelineButton
        events={timeline.events}
        openableTiles={timeline.openableTiles}
        onOpenTile={timeline.onOpenTile}
        disabled={disabled}
      />
      <TicketNoteButton
        ref={ticketRef}
        getNote={getTicketNote}
        disabled={disabled}
        showPrint={false}
        printReturnFocusRef={moreRef}
      />
      <ActionMenu items={items} triggerRef={moreRef} />
      {compare.kind === 'device' ? (
        <CompareControls
          ref={compareRef}
          headless
          getCurrent={compare.getCurrent}
          currentLabel={compare.currentLabel}
          disabled={disabled}
          returnFocusRef={moreRef}
        />
      ) : (
        <CompareZipControls
          ref={zipRef}
          headless
          report={compare.report}
          tiles={compare.tiles}
          returnFocusRef={moreRef}
        />
      )}
    </div>
  );
}
