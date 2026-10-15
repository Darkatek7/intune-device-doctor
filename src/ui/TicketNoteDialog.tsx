import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { de } from '../i18n/de';
import { fade, spring } from './motion';

interface Props {
  text: string;
  onClose: () => void;
}

/**
 * Fallback, wenn die Zwischenablage nicht verfügbar ist oder abgelehnt wird:
 * Der Text steht markiert in einem Textfeld zum manuellen Kopieren.
 * Muss unter <AnimatePresence> stehen.
 */
export function TicketNoteDialog({ text, onClose }: Props) {
  const reduced = useReducedMotion();
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useFocusTrap(panelRef, true, onClose);
  // Nach der Fokus-Falle (die den Dialog fokussiert) den Text markieren: Strg+C genügt.
  useEffect(() => {
    areaRef.current?.focus({ preventScroll: true });
    areaRef.current?.select();
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={fade}
        onClick={onClose}
        className="absolute inset-0 bg-black/20 dark:bg-black/40"
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
        transition={reduced ? fade : spring}
        className="hc-edge relative flex max-h-[85dvh] w-full max-w-xl flex-col gap-3 overflow-hidden rounded-sheet bg-surface p-5 text-label shadow-[0_8px_40px_rgb(0_0_0/0.22)] outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-title font-semibold">
            {de.ticket.dialogTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={de.detail.close}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-control text-secondary-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <p id={bodyId} className="text-sm text-secondary-label">
          {de.ticket.dialogBody}
        </p>
        <textarea
          ref={areaRef}
          readOnly
          value={text}
          aria-label={de.ticket.textLabel}
          rows={12}
          className="min-h-48 w-full flex-1 resize-none rounded-xl bg-canvas p-3 font-mono text-xs text-label outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </motion.div>
    </div>,
    document.body,
  );
}
