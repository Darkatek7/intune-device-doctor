/**
 * Ansicht „Verbindungstest“ (M14/S6, nur Live): ruft jeden von MDM Doctor verwendeten Graph-Endpunkt für das
 * gewählte Gerät genau einmal lesend auf und zeigt je Endpunkt nur Ergebnis, Dauer, Anzahl der Einträge
 * und die Namen der Felder – keine Werte. Der Bericht lässt sich als Markdown kopieren (ohne IDs/Namen).
 * Daten kommen ausschließlich über useConnectionTest (Provider-Schnittstelle).
 */
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardCopy,
  MinusCircle,
  Play,
  RotateCw,
  SearchX,
  ShieldOff,
  Square,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildConnectionTestReport, countOutcomes } from '../domain/connectionTestReport';
import type { EndpointProbeResult, ProbeOutcome } from '../domain/types';
import { useConnectionTest } from '../hooks/useConnectionTest';
import { de } from '../i18n/de';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import type { AmbientTone } from '../ui/AmbientGlow';
import { ErrorState } from '../ui/ErrorState';
import { TONE_CLASS } from '../ui/tone';

interface Props {
  provider: DeviceDataProvider;
  deviceId: string;
  onBack: () => void;
  /** Gesamtzustand für das Umgebungslicht (accent, solange nichts Auffälliges vorliegt) */
  onToneChange?: (tone: AmbientTone) => void;
}

const t = de.connectionTest;
const FEEDBACK_MS = 2000;
const NO_RESULTS: EndpointProbeResult[] = [];

const OUTCOME_VIEW: Record<ProbeOutcome, { icon: LucideIcon; className: string }> = {
  ok: { icon: CheckCircle2, className: 'text-ok' },
  forbidden: { icon: ShieldOff, className: 'text-warning' },
  notFound: { icon: SearchX, className: 'text-warning' },
  badRequest: { icon: AlertTriangle, className: 'text-critical' },
  error: { icon: AlertTriangle, className: 'text-critical' },
  skipped: { icon: MinusCircle, className: 'text-secondary-label' },
};

const BUTTON =
  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60';

function OutcomeCell({ result }: { result: EndpointProbeResult }) {
  const { icon: Icon, className } = OUTCOME_VIEW[result.outcome];
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Icon aria-hidden="true" size={16} className="shrink-0" />
      <span className="text-label">
        {t.outcome[result.outcome]}
        {result.outcome === 'error' && result.httpStatus !== null ? ` (${result.httpStatus})` : ''}
      </span>
    </span>
  );
}

function tone(results: EndpointProbeResult[], finished: boolean): AmbientTone {
  if (!finished) return 'accent';
  const counts = countOutcomes(results);
  return counts.error + counts.badRequest > 0
    ? 'critical'
    : counts.forbidden + counts.notFound > 0
      ? 'warning'
      : 'ok';
}

export function ConnectionTestView({ provider, deviceId, onBack, onToneChange }: Props) {
  const { device, test, supported, start, cancel, reloadDevice } = useConnectionTest(
    provider,
    deviceId,
  );
  const [copied, setCopied] = useState(false);
  const [clipboardFailed, setClipboardFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportRef = useRef<HTMLTextAreaElement>(null);

  const results = test.phase === 'idle' ? NO_RESULTS : test.results;
  const running = test.phase === 'running';
  const finished = test.phase === 'done' || test.phase === 'cancelled';
  const counts = useMemo(() => countOutcomes(results), [results]);
  const summaryText = t.summary(counts);

  const viewTone = tone(results, finished);
  useEffect(() => {
    onToneChange?.(viewTone);
  }, [viewTone, onToneChange]);

  useEffect(() => {
    const previous = document.title;
    document.title = `${t.title} – ${de.app.name}`;
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const report = useMemo(
    () =>
      finished && device.status === 'ready'
        ? buildConnectionTestReport(test.results, {
            osFamily: device.device.osFamily,
            date: test.finishedAt,
            complete: test.phase === 'done',
          })
        : '',
    [finished, device, test],
  );

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(report);
      setClipboardFailed(false);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), FEEDBACK_MS);
    } catch {
      setCopied(false);
      setClipboardFailed(true);
      reportRef.current?.focus();
      reportRef.current?.select();
    }
  };

  if (device.status === 'error') {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 inline-flex items-center gap-0.5 rounded-full py-1 pr-2 pl-1 text-sm font-medium text-accent outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
          >
            <ChevronLeft aria-hidden="true" size={18} />
            {t.back}
          </button>
        </div>
        <ErrorState error={device.error} title={t.failedToStart} onRetry={reloadDevice} />
      </div>
    );
  }

  const deviceReady = device.status === 'ready';
  const total = test.phase === 'running' ? test.total : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 inline-flex items-center gap-0.5 rounded-full py-1 pr-2 pl-1 text-sm font-medium text-accent outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
          >
            <ChevronLeft aria-hidden="true" size={18} />
            {t.back}
          </button>
        </div>
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden="true"
            className={`squircle mt-1 size-14 shadow-[inset_0_1px_0_var(--c-highlight)] transition-colors duration-500 sm:size-16 ${TONE_CLASS[viewTone]}`}
          >
            <Activity size={30} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h1 className="display-type break-words text-3xl font-semibold text-label sm:text-display">
              {t.title}
            </h1>
            <p className="mt-1.5 text-sm text-secondary-label">{t.subtitle}</p>
            {deviceReady && (
              <p className="mt-1 text-sm text-secondary-label">
                {device.device.deviceName}
                <span aria-hidden="true"> · </span>
                {device.device.osFamily}
              </p>
            )}
            <p className="mt-1 text-sm text-secondary-label">{t.deviceHint}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {running ? (
          <button type="button" onClick={cancel} className={`${BUTTON} bg-control text-label`}>
            <Square aria-hidden="true" size={15} />
            {t.cancel}
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={!deviceReady || !supported}
            className={`${BUTTON} bg-accent-fill text-white`}
          >
            {finished || test.phase === 'failed' ? (
              <RotateCw aria-hidden="true" size={15} />
            ) : (
              <Play aria-hidden="true" size={15} />
            )}
            {finished || test.phase === 'failed' ? t.restart : t.start}
          </button>
        )}
        {running && (
          <span className="text-sm text-secondary-label">
            {total !== null ? t.running(results.length, total) : t.a11y.running}
          </span>
        )}
        {test.phase === 'done' && (
          <span className="text-sm text-secondary-label">{t.finished}</span>
        )}
        {test.phase === 'cancelled' && (
          <span className="text-sm text-secondary-label">{t.cancelled}</span>
        )}
        {results.length > 0 && !running && summaryText && (
          <span className="text-sm font-medium text-label">{summaryText}</span>
        )}
      </div>

      {total !== null && (
        <div
          aria-hidden="true"
          className="h-1 w-full max-w-md overflow-hidden rounded-full bg-fill"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${Math.min(100, (results.length / total) * 100)}%` }}
          />
        </div>
      )}

      {test.phase === 'failed' && (
        <div role="alert" className="rounded-2xl bg-critical/12 p-4 text-sm text-label">
          {test.error.message}
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {running ? t.a11y.running : finished && summaryText ? t.a11y.done(summaryText) : ''}
      </p>

      {results.length > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-sm">
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <caption className="sr-only">{t.tableLabel}</caption>
            <thead>
              <tr className="text-xs text-secondary-label">
                <th scope="col" className="px-4 py-3 font-medium">
                  {t.columns.endpoint}
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  {t.columns.version}
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  {t.columns.scope}
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  {t.columns.result}
                </th>
                <th scope="col" className="px-3 py-3 text-right font-medium">
                  {t.columns.duration}
                </th>
                <th scope="col" className="px-3 py-3 text-right font-medium">
                  {t.columns.entries}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t.columns.fields}
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr
                  key={result.endpointId}
                  data-endpoint-id={result.endpointId}
                  className="border-t border-separator align-top"
                >
                  <td className="px-4 py-2.5 font-mono text-xs break-words text-label">
                    {result.display}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {result.version}
                    {result.version === 'beta' && (
                      <span
                        title={t.betaTitle}
                        className="ml-1.5 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning"
                      >
                        {t.betaBadge}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs break-all text-secondary-label">
                    {result.scope}
                  </td>
                  <td className="px-3 py-2.5">
                    <OutcomeCell result={result} />
                    {result.skipReason && (
                      <p className="mt-0.5 text-xs text-secondary-label">{result.skipReason}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                    {result.durationMs !== null ? `${result.durationMs} ms` : t.report.none}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {result.entryCount !== null ? result.entryCount : t.report.none}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs break-words text-secondary-label">
                    {result.fieldNames.length > 0 ? result.fieldNames.join(', ') : t.report.none}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {finished && report && (
        <section className="flex flex-col gap-3" aria-label={t.reportLabel}>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void copy()}
              className={`${BUTTON} bg-control text-label`}
            >
              <ClipboardCopy aria-hidden="true" size={16} />
              {t.copy}
            </button>
            <span
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-1 text-sm font-medium text-label"
            >
              {copied && (
                <>
                  <Check aria-hidden="true" size={16} className="text-ok" strokeWidth={2.5} />
                  {t.copied}
                </>
              )}
            </span>
          </div>
          {clipboardFailed && <p className="text-sm text-secondary-label">{t.copyFallback}</p>}
          <textarea
            ref={reportRef}
            readOnly
            value={report}
            rows={10}
            aria-label={t.reportLabel}
            className="w-full rounded-2xl bg-surface p-3 font-mono text-xs text-label outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <p className="text-xs text-secondary-label">{t.privacy}</p>
        </section>
      )}
    </div>
  );
}
