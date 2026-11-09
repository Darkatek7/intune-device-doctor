import { Check, ClipboardCopy, Printer } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { de } from '../i18n/de';
import { TicketNoteDialog } from './TicketNoteDialog';

interface Props {
  /** Erzeugt die Markdown-Notiz aus den aktuell angezeigten Kacheln (rein lokal). */
  getNote: () => string;
  /** Solange Kacheln laden: nicht benutzbar */
  disabled?: boolean;
}

const FEEDBACK_MS = 2000;

/**
 * "Ticket-Notiz kopieren": schreibt die Befunde als Markdown in die Zwischenablage. Ist die
 * Zwischenablage nicht verfügbar oder abgelehnt, öffnet sich ein Textfeld zum manuellen Kopieren.
 * Nichts verlässt den Browser.
 */
export function TicketNoteButton({ getNote, disabled = false }: Props) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<{ text: string; reason: 'clipboard' | 'print' } | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const printRef = useRef<HTMLButtonElement>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onClick = async () => {
    const text = getNote();
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), FEEDBACK_MS);
    } catch {
      setCopied(false);
      setFallback({ text, reason: 'clipboard' });
    }
  };

  const closeFallback = () => {
    const reason = fallback?.reason;
    setFallback(null);
    (reason === 'print' ? printRef : buttonRef).current?.focus();
  };

  return (
    <div className="flex items-center gap-2">
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1 text-sm font-medium text-label"
      >
        {copied && (
          <>
            <Check aria-hidden="true" size={16} className="text-ok" strokeWidth={2.5} />
            {de.ticket.copied}
          </>
        )}
      </span>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => void onClick()}
        title={de.ticket.buttonHint}
        className="inline-flex items-center gap-1.5 rounded-full bg-control px-3.5 py-1.5 text-sm font-medium text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ClipboardCopy aria-hidden="true" size={16} />
        {de.ticket.button}
      </button>
      <button
        ref={printRef}
        type="button"
        disabled={disabled}
        onClick={() => setFallback({ text: getNote(), reason: 'print' })}
        title={de.comfort.printHint}
        className="inline-flex items-center gap-1.5 rounded-full bg-control px-3.5 py-1.5 text-sm font-medium text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Printer aria-hidden="true" size={16} />
        {de.comfort.printButton}
      </button>
      <AnimatePresence>
        {fallback !== null && (
          <TicketNoteDialog
            key="ticket-dialog"
            text={fallback.text}
            reason={fallback.reason}
            onClose={closeFallback}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
