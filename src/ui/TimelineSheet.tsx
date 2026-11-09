import { motion, useReducedMotion } from 'motion/react';
import { CalendarClock, X } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDateTime } from '../domain/format';
import type { TileId } from '../domain/types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { de } from '../i18n/de';
import { isProblemEvent, type TimelineEvent } from '../rules/timeline';
import { fade, spring } from './motion';
import { SeverityIcon } from './SeverityBadge';

const t = de.analysis.timeline;

const TIME_FORMAT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
const DAY_FORMAT = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

interface Props {
  events: readonly TimelineEvent[];
  /** Kacheln, die in der aktuellen Ansicht existieren – nur dafür gibt es einen Öffnen-Knopf */
  openableTiles: ReadonlySet<TileId>;
  /** Öffnet die zugehörige Kachel (der Aufrufer schließt die Zeitachse) */
  onOpenTile: (tileId: TileId) => void;
  onClose: () => void;
}

interface DayGroup {
  key: string;
  label: string;
  events: TimelineEvent[];
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** Ereignisse (bereits neueste zuerst) nach lokalem Kalendertag gruppieren. */
function groupByDay(events: readonly TimelineEvent[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const event of events) {
    const date = new Date(event.time);
    const key = dayKey(date);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.events.push(event);
    else groups.push({ key, label: DAY_FORMAT.format(date), events: [event] });
  }
  return groups;
}

/**
 * Zeitachse als modales Panel (Desktop rechts, mobil Bottom-Sheet), gruppiert nach Tag, neueste oben.
 * Muss unter <AnimatePresence> stehen.
 */
export function TimelineSheet({ events, openableTiles, onOpenTile, onClose }: Props) {
  const reduced = useReducedMotion();
  const desktop = useMediaQuery('(min-width: 40rem)', true);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);

  useFocusTrap(panelRef, true, onClose);

  const shown = useMemo(
    () => (onlyProblems ? events.filter(isProblemEvent) : events),
    [events, onlyProblems],
  );
  const groups = useMemo(() => groupByDay(shown), [shown]);
  const hidden = reduced ? { opacity: 0 } : desktop ? { opacity: 0, x: 24 } : { opacity: 0, y: 32 };
  const shownPose = { opacity: 1, x: 0, y: 0 };

  return createPortal(
    <div className="fixed inset-0 z-40">
      <motion.div
        aria-hidden="true"
        data-testid="timeline-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={fade}
        onClick={onClose}
        className="absolute inset-0 bg-black/25 dark:bg-black/50"
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid="timeline-sheet"
        initial={hidden}
        animate={shownPose}
        exit={hidden}
        transition={reduced ? fade : spring}
        className="hc-edge absolute bottom-0 left-0 right-0 flex max-h-[90dvh] flex-col overflow-hidden rounded-t-sheet bg-surface text-label shadow-[inset_0_1px_0_var(--c-highlight),0_-8px_40px_rgb(0_0_0/0.18)] outline-none sm:bottom-2 sm:left-auto sm:right-2 sm:top-2 sm:max-h-none sm:w-[32rem] sm:max-w-[calc(100%-1rem)] sm:rounded-sheet sm:shadow-[inset_0_1px_0_var(--c-highlight),0_24px_64px_rgb(0_0_0/0.35)]"
      >
        <div className="shrink-0 px-5 pb-3 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className="squircle size-10 bg-fill text-secondary-label">
                <CalendarClock size={22} />
              </span>
              <h2 id={titleId} className="text-title font-semibold tracking-[-0.016em]">
                {t.dialogTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.close}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-control text-secondary-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
          <p className="mt-3 text-sm text-secondary-label">{t.intro}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div
              role="group"
              aria-label={t.filterLabel}
              className="inline-flex rounded-full bg-control p-0.5"
            >
              {[
                { value: false, label: t.filterAll },
                { value: true, label: t.filterProblems },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={onlyProblems === option.value}
                  onClick={() => setOnlyProblems(option.value)}
                  className={`rounded-full px-3 py-1 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                    onlyProblems === option.value
                      ? 'bg-surface text-label shadow-sm'
                      : 'text-secondary-label'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p
              role="status"
              aria-live="polite"
              className="text-sm tabular-nums text-secondary-label"
            >
              {t.count(shown.length, events.length)}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8">
          {groups.length === 0 ? (
            <p className="rounded-2xl bg-fill p-4 text-sm text-secondary-label">
              {onlyProblems && events.length > 0 ? t.emptyProblems : t.empty}
            </p>
          ) : (
            <ol aria-label={t.listLabel} className="flex flex-col gap-5">
              {groups.map((group) => (
                <li key={group.key}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary-label">
                    {group.label}
                  </h3>
                  <ol className="mt-2 flex flex-col gap-2">
                    {group.events.map((event) => (
                      <EventRow
                        key={event.id}
                        event={event}
                        openable={event.tileId !== null && openableTiles.has(event.tileId)}
                        onOpen={onOpenTile}
                      />
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          )}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

function EventRow({
  event,
  openable,
  onOpen,
}: {
  event: TimelineEvent;
  openable: boolean;
  onOpen: (tileId: TileId) => void;
}) {
  const date = new Date(event.time);
  const tileTitle = event.tileId ? de.tiles[event.tileId] : null;
  const body = (
    <>
      <span className="mt-0.5">
        <SeverityIcon severity={event.severity} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <time
            dateTime={event.time}
            title={formatDateTime(event.time)}
            className="text-sm font-medium tabular-nums text-secondary-label"
          >
            {TIME_FORMAT.format(date)}
          </time>
          {event.planned && (
            <span className="rounded-full bg-accent/12 px-2 py-0.5 text-xs font-medium text-label">
              {t.planned}
            </span>
          )}
          <span className="text-xs text-secondary-label">
            {t.kind[event.kind] ?? event.kind} · {t.source[event.source]}
          </span>
        </span>
        <span className="mt-0.5 block break-words text-sm font-medium text-label">
          <span className="sr-only">{de.severity[event.severity]}: </span>
          {event.title}
        </span>
        {event.detail && (
          <span className="mt-0.5 block break-words text-sm text-secondary-label">
            {event.detail}
          </span>
        )}
      </span>
    </>
  );
  const base = 'hc-edge flex w-full items-start gap-3 rounded-2xl bg-fill p-3 text-left';
  return (
    <li data-severity={event.severity} data-planned={event.planned || undefined}>
      {openable && tileTitle ? (
        <button
          type="button"
          aria-label={t.open(event.title, tileTitle)}
          onClick={() => event.tileId && onOpen(event.tileId)}
          className={`${base} outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.985]`}
        >
          {body}
        </button>
      ) : (
        <div className={base}>{body}</div>
      )}
    </li>
  );
}
