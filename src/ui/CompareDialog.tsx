import { ArrowRight, TriangleAlert, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatDateTime } from '../domain/format';
import type { Severity } from '../domain/types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { de } from '../i18n/de';
import {
  compareSnapshots,
  type FindingChange,
  type SnapshotFile,
  type TileChange,
  type TileState,
  type Trend,
} from '../rules/snapshotCompare';
import { fade, spring } from './motion';
import { SeverityBadge, SeverityIcon } from './SeverityBadge';

interface Props {
  before: SnapshotFile;
  after: SnapshotFile;
  /** Bezeichnung der Stände, z. B. Dateiname oder „Aktuell“ */
  beforeLabel: string;
  afterLabel: string;
  onClose: () => void;
}

const TREND_CLASS: Record<Trend, string> = {
  worse: 'bg-critical/12',
  better: 'bg-ok/12',
  added: 'bg-accent/12',
  removed: 'bg-unknown/12',
  same: 'bg-fill',
};

/** Trend nie nur über Farbe: Text steht immer dabei. */
const TREND_SEVERITY: Record<Trend, Severity | null> = {
  worse: 'critical',
  better: 'ok',
  added: null,
  removed: null,
  same: null,
};

function StateBadge({ state }: { state: TileState | null }) {
  if (!state) {
    return <span className="text-xs text-secondary-label">{de.compare.dialog.absent}</span>;
  }
  return <SeverityBadge severity={state.severity} />;
}

function TileRow({ change }: { change: TileChange }) {
  const trendSeverity = TREND_SEVERITY[change.trend];
  const label = de.compare.dialog.trend[change.trend];
  return (
    <li className="flex flex-col gap-1.5 px-5 py-3" data-trend={change.trend}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 text-base font-semibold text-label">{change.title}</span>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-label ${TREND_CLASS[change.trend]}`}
        >
          {trendSeverity && <SeverityIcon severity={trendSeverity} size={14} />}
          {label}
          {change.valueChanged && <> · {de.compare.dialog.valueChanged}</>}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary-label">
        <StateBadge state={change.before} />
        <ArrowRight aria-hidden="true" size={14} className="shrink-0" />
        <span className="sr-only">
          {de.compare.dialog.transition(
            change.before ? de.severity[change.before.severity] : de.compare.dialog.absent,
            change.after ? de.severity[change.after.severity] : de.compare.dialog.absent,
          )}
        </span>
        <StateBadge state={change.after} />
      </div>
      {(change.before || change.after) && (
        <p className="text-sm text-secondary-label">
          {change.before && change.after && change.before.value !== change.after.value ? (
            <>
              <span>{change.before.value}</span>
              <span aria-hidden="true"> → </span>
              <span className="text-label">{change.after.value}</span>
            </>
          ) : (
            (change.after ?? change.before)?.value
          )}
        </p>
      )}
    </li>
  );
}

function FindingList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: readonly FindingChange[];
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-sm font-semibold text-label">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-secondary-label">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li
              key={`${item.tileId}:${item.finding.id}`}
              className="flex items-start gap-2 rounded-xl bg-fill px-3 py-2 text-sm text-label"
            >
              <SeverityIcon severity={item.finding.severity} />
              <span className="min-w-0">
                <span className="text-secondary-label">{item.tileTitle}: </span>
                {item.finding.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SideInfo({
  heading,
  label,
  snapshot,
}: {
  heading: string;
  label: string;
  snapshot: SnapshotFile;
}) {
  const time = snapshot.collectedAt
    ? de.compare.dialog.collectedAt(formatDateTime(snapshot.collectedAt))
    : de.compare.dialog.exportedAt(formatDateTime(snapshot.exportedAt));
  return (
    <div className="min-w-0 rounded-xl bg-fill px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-secondary-label">
        {heading}
      </p>
      <p className="truncate text-sm font-medium text-label" title={label}>
        {label}
      </p>
      <p className="text-xs text-secondary-label">
        {de.compare.dialog.mode[snapshot.mode]} · {time}
      </p>
    </div>
  );
}

/**
 * Vergleichsansicht für Vorher/Nachher (Gerät) und zwei ZIPs. Reine Darstellung von
 * `compareSnapshots`; nichts wird gespeichert oder gesendet.
 */
export function CompareDialog({ before, after, beforeLabel, afterLabel, onClose }: Props) {
  const reduced = useReducedMotion();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const comparison = useMemo(() => compareSnapshots(before, after), [before, after]);
  const { counts } = comparison;
  const changed = comparison.tiles.length - counts.same;
  const d = de.compare.dialog;

  useFocusTrap(panelRef, true, onClose);

  const pills: { trend: Trend; text: string }[] = (
    [
      ['worse', d.worse],
      ['better', d.better],
      ['added', d.added],
      ['removed', d.removed],
      ['same', d.same],
    ] as const
  )
    .filter(([trend]) => counts[trend] > 0)
    .map(([trend, text]) => ({ trend, text: text(counts[trend]) }));

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
        className="hc-edge relative flex max-h-[88dvh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-sheet bg-surface p-5 text-label shadow-[0_8px_40px_rgb(0_0_0/0.22)] outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-title font-semibold">
            {d.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={d.close}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-control text-secondary-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        {comparison.deviceNameMismatch && (
          <p
            role="alert"
            data-testid="compare-name-mismatch"
            className="flex items-start gap-2 rounded-xl bg-warning/12 px-3 py-2 text-sm text-label"
          >
            <TriangleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-warning" />
            {d.nameMismatch(before.deviceName ?? d.unnamed, after.deviceName ?? d.unnamed)}
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <SideInfo heading={d.before} label={beforeLabel} snapshot={before} />
          <SideInfo heading={d.after} label={afterLabel} snapshot={after} />
        </div>

        <div
          role="group"
          aria-label={d.summaryLabel}
          className="flex flex-wrap items-center gap-2 text-sm font-medium"
        >
          {pills.map((pill) => (
            <span
              key={pill.trend}
              data-testid={`compare-count-${pill.trend}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-label ${TREND_CLASS[pill.trend]}`}
            >
              {TREND_SEVERITY[pill.trend] && (
                <SeverityIcon severity={TREND_SEVERITY[pill.trend]!} size={16} />
              )}
              {pill.text}
            </span>
          ))}
        </div>
        {changed === 0 &&
          comparison.newFindings.length === 0 &&
          comparison.resolvedFindings.length === 0 && (
            <p className="text-sm text-secondary-label">{d.noChange}</p>
          )}

        <section aria-labelledby={`${titleId}-tiles`} className="flex flex-col gap-2">
          <h3 id={`${titleId}-tiles`} className="text-sm font-semibold">
            {d.tilesTitle}
          </h3>
          <ul
            aria-label={d.tilesLabel}
            className="divide-y divide-separator overflow-hidden rounded-tile material-card hc-edge"
          >
            {comparison.tiles.map((change) => (
              <TileRow key={change.id} change={change} />
            ))}
          </ul>
        </section>

        <FindingList title={d.newFindings} empty={d.noNewFindings} items={comparison.newFindings} />
        <FindingList
          title={d.resolvedFindings}
          empty={d.noResolvedFindings}
          items={comparison.resolvedFindings}
        />
      </motion.div>
    </div>,
    document.body,
  );
}
