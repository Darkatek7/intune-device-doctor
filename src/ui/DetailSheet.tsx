import { animate, motion, useMotionValue, usePresence, useReducedMotion } from 'motion/react';
import { Ban, CircleCheck, Lock, Minus, RotateCw, TriangleAlert, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type { DataSource, Tile } from '../domain/types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { de } from '../i18n/de';
import { FindingCard, SourceLine } from './FindingCard';
import { fade, spring } from './motion';
import type { SectionNotice } from './sectionNotices';
import { SeverityBadge } from './SeverityBadge';
import { TILE_ICON } from './tileIcons';

interface Props {
  tile: Tile;
  /** Bounding-Box der angeklickten Kachel – Start-/Endpunkt der Animation (null = ohne Herkunft) */
  origin: DOMRect | null;
  notices: SectionNotice[];
  onClose: () => void;
  /** Lädt die fehlgeschlagenen Sections der Kachel neu */
  onRetry?: () => void;
}

const NOTICE_ICON = {
  forbidden: Lock,
  notApplicable: Ban,
  unavailable: Minus,
  error: TriangleAlert,
};

/** Gummiband oberhalb der Ruheposition: je weiter gezogen, desto zäher. */
function rubberBand(offset: number, dimension = 120): number {
  return -dimension * (1 - 1 / ((Math.abs(offset) * 0.55) / dimension + 1));
}

const SHEET_ICON_CLASS = {
  ok: 'bg-ok/15 text-ok',
  warning: 'bg-warning/15 text-warning',
  critical: 'bg-critical/15 text-critical',
  unknown: 'bg-fill text-secondary-label',
} as const;

function uniqueSources(sources: DataSource[]): DataSource[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const k = `${s.kind}:${s.label}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Modales Detail-Sheet: Desktop rechts (32rem), mobil Bottom-Sheet mit Drag-to-dismiss.
 * Öffnet aus der Kachel heraus (Bounding-Box) und schließt auf demselben Weg zurück.
 * Muss unter <AnimatePresence> stehen, damit die Austritts-Animation laufen kann.
 */
export function DetailSheet({ tile, origin, notices, onClose, onRetry }: Props) {
  const reduced = useReducedMotion();
  const desktop = useMediaQuery('(min-width: 40rem)', true);
  const [isPresent, safeToRemove] = usePresence();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const finalRect = useRef<DOMRect | null>(null);
  const initialized = useRef(false);
  const drag = useRef<{ startY: number; lastY: number; lastT: number; velocity: number } | null>(
    null,
  );

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scaleX = useMotionValue(1);
  const scaleY = useMotionValue(1);
  const panelOpacity = useMotionValue(0);
  const contentOpacity = useMotionValue(0);
  const scrimOpacity = useMotionValue(0);

  const close = useCallback(() => {
    if (isPresent) onClose();
  }, [isPresent, onClose]);

  useFocusTrap(panelRef, isPresent, close);

  // Hintergrund inert (kein Fokus, nicht für Screenreader erreichbar), solange das Sheet offen ist.
  // Beginnt die Austritts-Animation, wird inert sofort aufgehoben, damit der Fokus zur Kachel
  // zurückkehren kann.
  useEffect(() => {
    if (!isPresent) return;
    const changed: Element[] = [];
    for (const element of Array.from(document.body.children)) {
      if (element === rootRef.current || element.hasAttribute('inert')) continue;
      element.setAttribute('inert', '');
      changed.push(element);
    }
    return () => changed.forEach((element) => element.removeAttribute('inert'));
  }, [isPresent]);

  // Hintergrund nicht scrollbar, solange das Sheet offen ist
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  // Ein-/Austritt. Läuft bei jedem Wechsel von isPresent; laufende Animationen werden gestoppt,
  // die nächste startet vom aktuellen Wert (unterbrechbar).
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (!finalRect.current) finalRect.current = panel.getBoundingClientRect();
    const target = finalRect.current;
    const morph = !reduced && origin && target.width > 0 && target.height > 0;

    const hidden = morph
      ? {
          x: origin.left - target.left,
          y: origin.top - target.top,
          scaleX: origin.width / target.width,
          scaleY: origin.height / target.height,
        }
      : { x: 0, y: reduced ? 0 : 24, scaleX: 1, scaleY: 1 };

    const move = reduced ? fade : spring;
    const runs: Array<ReturnType<typeof animate>> = [];
    let cancelled = false;

    if (isPresent) {
      if (!initialized.current) {
        initialized.current = true;
        x.set(hidden.x);
        y.set(hidden.y);
        scaleX.set(hidden.scaleX);
        scaleY.set(hidden.scaleY);
      }
      runs.push(
        animate(x, 0, move),
        animate(y, 0, move),
        animate(scaleX, 1, move),
        animate(scaleY, 1, move),
        animate(panelOpacity, 1, { duration: 0.12, ease: 'easeOut' }),
        animate(contentOpacity, 1, { duration: 0.2, delay: morph ? 0.1 : 0, ease: 'easeOut' }),
        animate(scrimOpacity, 1, { duration: 0.25, ease: 'easeOut' }),
      );
    } else {
      runs.push(
        animate(x, hidden.x, move),
        animate(y, hidden.y, move),
        animate(scaleX, hidden.scaleX, move),
        animate(scaleY, hidden.scaleY, move),
        animate(panelOpacity, 0, { duration: 0.2, delay: morph ? 0.15 : 0, ease: 'easeIn' }),
        animate(contentOpacity, 0, { duration: 0.1, ease: 'easeIn' }),
        animate(scrimOpacity, 0, { duration: 0.25, ease: 'easeIn' }),
      );
      void Promise.all(runs).then(() => {
        if (!cancelled) safeToRemove?.();
      });
    }
    return () => {
      cancelled = true;
      runs.forEach((run) => run.stop());
    };
    // Nur der Presence-Wechsel steuert die Animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent]);

  // ---- Drag-to-dismiss (nur Bottom-Sheet) ----
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (desktop || !isPresent) return;
    if ((event.target as HTMLElement).closest('button')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    y.stop();
    drag.current = {
      startY: event.clientY,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
    };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state) return;
    const dy = event.clientY - state.startY;
    y.set(dy < 0 ? rubberBand(dy) : dy);
    const dt = event.timeStamp - state.lastT;
    if (dt > 0) {
      const instant = ((event.clientY - state.lastY) / dt) * 1000;
      state.velocity = state.velocity * 0.6 + instant * 0.4;
      state.lastY = event.clientY;
      state.lastT = event.timeStamp;
    }
  };
  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    drag.current = null;
    if (!state) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const height = panelRef.current?.offsetHeight ?? 400;
    const dy = event.clientY - state.startY;
    // Projektion des Auslaufs: v/1000 * 0.998 / (1 - 0.998)
    const projected = dy + (state.velocity / 1000) * (0.998 / (1 - 0.998));
    if (projected > height * 0.4) onClose();
    else animate(y, 0, { type: 'spring', bounce: 0.15, duration: 0.35, velocity: state.velocity });
  };

  const Icon = TILE_ICON[tile.id];
  const loading = tile.state === 'loading';
  const allGood = !loading && tile.findings.length === 0 && !tile.availability;
  const sources = uniqueSources(tile.sources);
  const hasError = notices.some((n) => n.status === 'error');

  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-40">
      <motion.div
        aria-hidden="true"
        data-testid="sheet-scrim"
        style={{ opacity: scrimOpacity }}
        onClick={close}
        className="absolute inset-0 bg-black/25 dark:bg-black/50"
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={loading || undefined}
        tabIndex={-1}
        style={{ x, y, scaleX, scaleY, opacity: panelOpacity, transformOrigin: '0 0' }}
        className="absolute bottom-0 left-0 right-0 flex max-h-[90dvh] flex-col overflow-hidden hc-edge rounded-t-sheet bg-surface text-label shadow-[inset_0_1px_0_var(--c-highlight),0_-8px_40px_rgb(0_0_0/0.18)] outline-none sm:bottom-2 sm:left-auto sm:right-2 sm:top-2 sm:max-h-none sm:w-[32rem] sm:max-w-[calc(100%-1rem)] sm:rounded-sheet sm:shadow-[inset_0_1px_0_var(--c-highlight),0_24px_64px_rgb(0_0_0/0.35)]"
      >
        <motion.div style={{ opacity: contentOpacity }} className="flex min-h-0 flex-1 flex-col">
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="shrink-0 touch-none px-5 pb-3 pt-2 sm:touch-auto sm:pt-5"
          >
            <div
              aria-hidden="true"
              title={de.sheet.dragHandle}
              className="mx-auto mb-3 h-1 w-9 rounded-full bg-separator sm:hidden"
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-3 text-secondary-label">
                  <span
                    aria-hidden="true"
                    className={`squircle size-10 ${
                      loading || tile.availability
                        ? 'bg-fill text-secondary-label'
                        : SHEET_ICON_CLASS[tile.severity]
                    }`}
                  >
                    <Icon size={22} />
                  </span>
                  <h2
                    id={titleId}
                    className="text-title font-semibold tracking-[-0.016em] text-label"
                  >
                    {tile.title}
                  </h2>
                </div>
                {!loading && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={tile.severity} />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={close}
                aria-label={de.detail.close}
                className="grid size-8 shrink-0 place-items-center rounded-full bg-control text-secondary-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pb-8">
            {loading ? (
              <p className="text-secondary-label">{de.sheet.loading}</p>
            ) : (
              <>
                <div>
                  <p className="display-type text-[1.75rem] font-semibold tabular-nums">
                    {tile.value}
                  </p>
                  {tile.summary && (
                    <p className="mt-1 text-sm text-secondary-label">{tile.summary}</p>
                  )}
                </div>

                {notices.map((notice) => {
                  const NoticeIcon = NOTICE_ICON[notice.status];
                  return (
                    <section
                      key={notice.key}
                      data-notice={notice.status}
                      className="hc-edge flex gap-3 rounded-2xl bg-fill p-4"
                    >
                      <NoticeIcon
                        aria-hidden="true"
                        size={18}
                        className={`mt-0.5 shrink-0 ${notice.status === 'error' ? 'text-critical' : notice.status === 'forbidden' ? 'text-warning' : 'text-unknown'}`}
                      />
                      <div className="min-w-0 space-y-1 text-sm">
                        <h3 className="font-semibold text-label">{notice.title}</h3>
                        <p className="text-label">{notice.message}</p>
                        {notice.requiredScope && (
                          <p className="text-secondary-label">
                            {de.sheet.requiredScope}:{' '}
                            <code className="break-all font-mono text-xs">
                              {notice.requiredScope}
                            </code>
                          </p>
                        )}
                        {notice.requestId && (
                          <p className="text-secondary-label">
                            {de.errorState.requestId}:{' '}
                            <code className="break-all font-mono text-xs">{notice.requestId}</code>
                          </p>
                        )}
                      </div>
                    </section>
                  );
                })}

                {hasError && onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex w-fit items-center gap-2 rounded-full bg-accent-fill px-4 py-2 text-sm font-medium text-white outline-none transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent active:scale-[0.97]"
                  >
                    <RotateCw aria-hidden="true" size={16} />
                    {de.sheet.retry}
                  </button>
                )}

                {allGood && (
                  <section className="hc-edge flex gap-3 rounded-2xl bg-ok/12 p-4">
                    <CircleCheck aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-ok" />
                    <div>
                      <h3 className="font-semibold text-label">{de.sheet.allGood}</h3>
                      <p className="text-sm text-label">{de.sheet.allGoodHint}</p>
                    </div>
                  </section>
                )}

                {tile.facts.length > 0 && (
                  <section aria-label={de.sheet.facts}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary-label">
                      {de.sheet.facts}
                    </h3>
                    <dl className="mt-2 hc-edge divide-y divide-separator rounded-2xl bg-fill px-4 text-sm">
                      {tile.facts.map((fact) => (
                        <div
                          key={fact.label}
                          className="flex items-baseline justify-between gap-4 py-2"
                        >
                          <dt className="shrink-0 text-secondary-label">{fact.label}</dt>
                          <dd
                            title={fact.title}
                            className={`min-w-0 break-words text-right text-label ${
                              fact.mono ? 'break-all font-mono text-xs tabular-nums' : ''
                            }`}
                          >
                            {fact.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}

                {tile.findings.map((finding) => (
                  <FindingCard key={finding.id} finding={finding} />
                ))}

                {sources.length > 0 && (
                  <section aria-label={de.sheet.sources} className="space-y-1">
                    {sources.map((source) => (
                      <SourceLine key={`${source.kind}:${source.label}`} source={source} />
                    ))}
                  </section>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>,
    document.body,
  );
}
