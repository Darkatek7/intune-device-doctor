import { Bookmark, Check, ClipboardCopy, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { de } from '../i18n/de';
import { appBaseUrl, buildBookmarklet } from '../links/bookmarklet';
import { fade, spring } from './motion';

interface Props {
  onClose: () => void;
  /** Testnaht – Standard: aktuelle Origin und Base */
  appUrl?: string;
}

/**
 * Lesezeichen „In MDM Doctor öffnen“ (M12/B4): ein ziehbarer `javascript:`-Link.
 *
 * React 19 blockiert `javascript:`-URLs im `href` (der Link würde durch einen Fehler-Stub ersetzt).
 * Der Link wird deshalb nach dem Rendern per `setAttribute` gesetzt. Das ist hier unbedenklich:
 * der Code ist ein fester, von uns gebauter String ohne Nutzereingabe, und ein Klick in der App wird
 * unterdrückt – er ist nur zum Ziehen in die Lesezeichenleiste gedacht.
 */
export function BookmarkletDialog({ onClose, appUrl }: Props) {
  const reduced = useReducedMotion();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  const base = appUrl ?? appBaseUrl(window.location.origin, import.meta.env.BASE_URL);
  const code = useMemo(() => buildBookmarklet(base, de.bookmarklet.noDeviceMessage), [base]);

  useFocusTrap(panelRef, true, onClose);
  useEffect(() => {
    linkRef.current?.setAttribute('href', code);
  }, [code]);

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      areaRef.current?.focus();
      areaRef.current?.select();
    }
  };

  const b = de.bookmarklet;
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
        tabIndex={-1}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
        transition={reduced ? fade : spring}
        className="hc-edge relative flex max-h-[88dvh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-sheet bg-surface p-5 text-label shadow-[0_8px_40px_rgb(0_0_0/0.22)] outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-title font-semibold">
            {b.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={b.close}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-control text-secondary-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <p className="text-sm text-secondary-label">{b.intro}</p>

        <div className="flex flex-col items-start gap-1.5">
          {/* href wird per setAttribute gesetzt (siehe Kommentar oben) */}
          <a
            ref={linkRef}
            data-testid="bookmarklet-link"
            draggable="true"
            onClick={(event) => event.preventDefault()}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent-fill px-4 py-2 text-sm font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent"
          >
            <Bookmark aria-hidden="true" size={16} />
            {b.linkLabel}
          </a>
          <p className="text-xs text-secondary-label">{b.linkHint}</p>
        </div>

        <section aria-labelledby={`${titleId}-steps`}>
          <h3 id={`${titleId}-steps`} className="text-sm font-semibold">
            {b.stepsTitle}
          </h3>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-label">
            {b.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <p className="text-sm text-secondary-label">{b.privacy}</p>
        <p className="text-xs text-secondary-label">{b.appUrl(base)}</p>

        <details className="rounded-xl bg-fill px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-label outline-none focus-visible:ring-2 focus-visible:ring-accent">
            {b.noDragTitle}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-sm text-secondary-label">{b.noDragBody}</p>
            <textarea
              ref={areaRef}
              readOnly
              value={code}
              rows={4}
              aria-label={b.codeLabel}
              className="w-full resize-none rounded-lg bg-canvas p-2 font-mono text-xs text-label outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void copy()}
                className="inline-flex items-center gap-1.5 rounded-full bg-control px-3.5 py-1.5 text-sm font-medium text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
              >
                <ClipboardCopy aria-hidden="true" size={16} />
                {b.copy}
              </button>
              <span
                role="status"
                aria-live="polite"
                className="inline-flex items-center gap-1 text-sm"
              >
                {copied && (
                  <>
                    <Check aria-hidden="true" size={16} className="text-ok" strokeWidth={2.5} />
                    {b.copied}
                  </>
                )}
              </span>
            </div>
          </div>
        </details>
      </motion.div>
    </div>,
    document.body,
  );
}
