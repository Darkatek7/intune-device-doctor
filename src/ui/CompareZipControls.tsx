import { GitCompareArrows } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { useProviderContext } from '../app/providerContextValue';
import type { DiagnosticsReport } from '../diagnostics/types';
import type { Tile } from '../domain/types';
import { isZipFileName, useDiagnosticsAnalysis } from '../hooks/useDiagnosticsAnalysis';
import { useResolvedApps } from '../hooks/useResolvedApps';
import { de } from '../i18n/de';
import { evaluateDiagnosticsTiles } from '../rules/tiles/diagnostics';
import { buildSnapshotFile, type SnapshotFile } from '../rules/snapshotCompare';
import { CompareDialog } from './CompareDialog';
import { zipTitle } from './zipTitle';

interface Props {
  /** Die geöffnete ZIP samt ihren bereits ausgewerteten Kacheln */
  report: DiagnosticsReport;
  tiles: readonly Tile[];
}

const BUTTON_CLASS =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-control px-3.5 py-1.5 text-sm font-medium text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60';

const toSnapshot = (report: DiagnosticsReport, tiles: readonly Tile[], now: Date): SnapshotFile =>
  buildSnapshotFile({
    tiles,
    mode: 'zip',
    deviceName: report.deviceNameFromFile,
    collectedAt: report.collectedAtUtc ?? null,
    now,
  });

/**
 * „Mit weiterer ZIP vergleichen“ (M12/B2): die zweite Datei wird – wie die erste – ausschließlich
 * lokal analysiert. Die ältere Sammlung gilt als „Vorher“; fehlt ein Sammelzeitpunkt, ist die
 * geöffnete ZIP „Vorher“.
 */
export function CompareZipControls({ report, tiles }: Props) {
  const { provider } = useProviderContext();
  const { state, analyze, reset } = useDiagnosticsAnalysis();
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [notZip, setNotZip] = useState(false);
  const [now] = useState(() => new Date());

  const second = useResolvedApps(provider, state.status === 'done' ? state.report : undefined);
  const secondTiles = useMemo(
    () => (second ? evaluateDiagnosticsTiles(second, now) : null),
    [second, now],
  );

  const pair = useMemo(() => {
    if (!second || !secondTiles) return null;
    const current = toSnapshot(report, tiles, now);
    const other = toSnapshot(second, secondTiles, now);
    const currentTime = current.collectedAt ? Date.parse(current.collectedAt) : null;
    const otherTime = other.collectedAt ? Date.parse(other.collectedAt) : null;
    const otherIsOlder = currentTime !== null && otherTime !== null && otherTime < currentTime;
    return otherIsOlder
      ? { before: other, after: current, beforeLabel: second.fileName, afterLabel: report.fileName }
      : {
          before: current,
          after: other,
          beforeLabel: report.fileName,
          afterLabel: second.fileName,
        };
  }, [second, secondTiles, report, tiles, now]);

  const running = state.status === 'running';
  const errorText = notZip
    ? de.zipView.errors.notZip
    : state.status === 'error'
      ? state.error
      : null;

  const close = () => {
    reset();
    buttonRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <button
        ref={buttonRef}
        type="button"
        disabled={running}
        onClick={() => inputRef.current?.click()}
        title={`${de.compare.zipHint} ${de.compare.fileLocal}`}
        className={BUTTON_CLASS}
      >
        <GitCompareArrows aria-hidden="true" size={16} />
        {de.compare.zipButton}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        hidden
        data-testid="compare-zip-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          if (!isZipFileName(file.name)) {
            setNotZip(true);
            return;
          }
          setNotZip(false);
          void analyze(file);
        }}
      />
      <p role="status" aria-live="polite" className="text-sm text-secondary-label">
        {running ? de.compare.zipAnalyzing(state.fileName ?? '') : ''}
      </p>
      <p role="alert" className="text-sm text-critical empty:hidden">
        {errorText}
      </p>
      <AnimatePresence>
        {pair && (
          <CompareDialog
            key="compare-zip-dialog"
            before={pair.before}
            after={pair.after}
            beforeLabel={pair.beforeLabel || zipTitle(report)}
            afterLabel={pair.afterLabel}
            onClose={close}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
