import { History } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useRef, useState } from 'react';
import type { TileId } from '../domain/types';
import { de } from '../i18n/de';
import type { TimelineEvent } from '../rules/timeline';
import { TimelineSheet } from './TimelineSheet';

interface Props {
  events: readonly TimelineEvent[];
  openableTiles: ReadonlySet<TileId>;
  /** Öffnet die Kachel; die Zeitachse ist dann bereits geschlossen */
  onOpenTile: (tileId: TileId) => void;
  disabled?: boolean;
}

/** Schaltfläche „Zeitachse“ im Geräte-/ZIP-Header; verwaltet das Panel und die Fokus-Rückgabe. */
export function TimelineButton({ events, openableTiles, onOpenTile, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        title={de.analysis.timeline.buttonHint}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-control px-3.5 py-1.5 text-sm font-medium text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <History aria-hidden="true" size={16} />
        {de.analysis.timeline.button}
      </button>
      <AnimatePresence>
        {open && (
          <TimelineSheet
            key="timeline-sheet"
            events={events}
            openableTiles={openableTiles}
            onClose={close}
            onOpenTile={(tileId) => {
              // Fokus geht an die Kachel (Aufrufer), nicht zurück an die Schaltfläche
              setOpen(false);
              onOpenTile(tileId);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
