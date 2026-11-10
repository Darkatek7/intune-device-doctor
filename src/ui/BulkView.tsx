import { ChevronLeft, Download, FileUp, Hourglass, TriangleAlert } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { formatDateTime, formatRelativeTime } from '../domain/format';
import type { BulkState } from '../hooks/useBulkCheck';
import { de } from '../i18n/de';
import { usePrivacyView } from '../privacy/privacyContext';
import { downloadTextFile } from '../lib/download';
import {
  BULK_MAX_INPUT_CHARS,
  BULK_MAX_NAMES,
  bulkRowsToCsv,
  checkInSeverity,
  parseDeviceNames,
  type BulkCsvLabels,
  type BulkRow,
} from '../rules/bulkCheck';
import { SeverityBadge } from './SeverityBadge';

interface Props {
  state: BulkState;
  onStart: (names: string[]) => void;
  onCancel: () => void;
  onReset: () => void;
  onBack: () => void;
  /** Genau ein Treffer: Gerät öffnen */
  onOpenDevice: (device: { id: string; deviceName: string }) => void;
  /** Mehrere Treffer: normale Suche nach dem Namen */
  onSearchName: (name: string) => void;
}

const PRIMARY_BUTTON =
  'inline-flex items-center gap-1.5 rounded-full bg-accent-fill px-4 py-1.5 text-sm font-medium text-white outline-none transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60';
const SECONDARY_BUTTON =
  'inline-flex items-center gap-1.5 rounded-full bg-control px-3.5 py-1.5 text-sm font-medium text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60';
const LINK_BUTTON =
  'rounded-md text-left font-semibold text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent';

const complianceText = (state: string): string =>
  (de.picker.compliance as Record<string, string>)[state] ?? state;

function csvLabels(): BulkCsvLabels {
  return {
    header: de.bulk.csv.header,
    matchNone: de.bulk.match.none,
    matchOne: de.bulk.match.one,
    matchMany: de.bulk.match.manyShort,
    pending: de.bulk.match.pending,
    error: de.bulk.match.error,
    cancelled: de.bulk.match.cancelled,
    compliance: complianceText,
    severity: de.severity,
  };
}

function stamp(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

function matchText(row: BulkRow): string {
  switch (row.status) {
    case 'pending':
      return de.bulk.match.pending;
    case 'running':
      return de.bulk.match.running;
    case 'error':
      return de.bulk.match.error;
    case 'cancelled':
      return de.bulk.match.cancelled;
    case 'done':
      return row.matchCount === 0
        ? de.bulk.match.none
        : row.matchCount === 1
          ? de.bulk.match.one
          : de.bulk.match.many(row.matchCount);
  }
}

/**
 * Sammelprüfung (M12/B3): Namensliste einfügen oder CSV/TXT wählen, pro Name eine Suche
 * (`provider.searchDevices`), Tabelle mit Compliance und letztem Check-in, CSV-Export.
 * Dateien werden nur lokal gelesen, nichts wird gespeichert.
 */
export function BulkView({
  state,
  onStart,
  onCancel,
  onReset,
  onBack,
  onOpenDevice,
  onSearchName,
}: Props) {
  const base = usePrivacyView();
  // Auch eingetippte Namen ohne Treffer sind Gerätenamen und werden verborgen.
  const view = useMemo(
    () =>
      base.extend(
        state.rows,
        state.rows.map((row) => ({ kind: 'device' as const, value: row.name })),
      ),
    [base, state.rows],
  );
  const { masker } = view;
  const showDevice = (name: string) => (view.enabled ? masker.device(name) : name);
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const parsed = useMemo(() => parseDeviceNames(text), [text]);
  const running = state.status === 'running';
  const hasResult = state.status !== 'idle';
  const finished = state.rows.filter(
    (r) => r.status !== 'pending' && r.status !== 'running',
  ).length;

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > BULK_MAX_INPUT_CHARS * 4) {
      setFileError(de.bulk.fileTooLarge);
      return;
    }
    try {
      const content = await file.text();
      setFileError(null);
      setText(content.slice(0, BULK_MAX_INPUT_CHARS));
    } catch {
      setFileError(de.bulk.fileReadFailed);
    }
  };

  const exportCsv = () =>
    downloadTextFile(
      de.bulk.csv.fileName(stamp(state.checkedAt)),
      view.text(bulkRowsToCsv(state.rows, state.checkedAt, csvLabels())),
      'text/csv;charset=utf-8',
    );

  const statusText = running
    ? de.bulk.progress(finished, state.rows.length)
    : state.status === 'done'
      ? de.bulk.finished(state.rows.length)
      : state.status === 'cancelled'
        ? de.bulk.cancelled
        : '';

  return (
    <section aria-labelledby="bulk-title" className="flex flex-col gap-5">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 inline-flex items-center gap-0.5 rounded-full py-1 pr-2 pl-1 text-sm font-medium text-accent outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
        >
          <ChevronLeft aria-hidden="true" size={18} />
          {de.bulk.back}
        </button>
        <h1
          id="bulk-title"
          className="display-type mt-2 text-3xl font-semibold text-label sm:text-display"
        >
          {de.bulk.title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-secondary-label">{de.bulk.subtitle}</p>
      </div>

      {!hasResult ? (
        <div className="flex max-w-2xl flex-col gap-3">
          <label htmlFor={inputId} className="text-sm font-medium text-label">
            {de.bulk.inputLabel}
          </label>
          <textarea
            id={inputId}
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, BULK_MAX_INPUT_CHARS))}
            placeholder={de.bulk.inputPlaceholder}
            rows={8}
            spellCheck={false}
            autoCapitalize="off"
            className="w-full resize-y rounded-xl bg-surface p-3 font-mono text-sm text-label outline-none ring-1 ring-separator placeholder:text-tertiary-label focus-visible:ring-2 focus-visible:ring-accent"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={parsed.names.length === 0}
              onClick={() => {
                onStart(parsed.names);
                // Präsentationsmodus: Die Eingabeliste verschwindet nach dem Start (auch bei „Neu starten“).
                if (view.enabled) setText('');
              }}
              className={PRIMARY_BUTTON}
            >
              {de.bulk.start}
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={SECONDARY_BUTTON}
            >
              <FileUp aria-hidden="true" size={16} />
              {de.bulk.fileButton}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              hidden
              aria-label={de.bulk.fileLabel}
              data-testid="bulk-file-input"
              onChange={(event) => {
                void readFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            <span role="status" aria-live="polite" className="text-sm text-secondary-label">
              {parsed.names.length > 0 ? de.bulk.namesCount(parsed.names.length) : ''}
            </span>
          </div>
          <p className="text-xs text-secondary-label">{de.bulk.fileLocal}</p>
          <p role="alert" className="text-sm text-critical">
            {fileError}
          </p>
          {parsed.overLimit > 0 && (
            <p role="status" className="flex items-start gap-1.5 text-sm text-label">
              <TriangleAlert
                aria-hidden="true"
                size={16}
                className="mt-0.5 shrink-0 text-warning"
              />
              {de.bulk.overLimit(BULK_MAX_NAMES, parsed.overLimit)}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {running ? (
            <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
              {de.bulk.cancel}
            </button>
          ) : (
            <>
              <button type="button" onClick={onReset} className={SECONDARY_BUTTON}>
                {de.bulk.clear}
              </button>
              <button
                type="button"
                onClick={exportCsv}
                title={
                  view.enabled
                    ? `${de.bulk.exportCsvHint} ${de.privacy.output.bulkCsv}`
                    : de.bulk.exportCsvHint
                }
                className={SECONDARY_BUTTON}
              >
                <Download aria-hidden="true" size={16} />
                {de.bulk.exportCsv}
              </button>
            </>
          )}
          <span role="status" aria-live="polite" className="text-sm font-medium text-label">
            {statusText}
          </span>
          {state.throttleSeconds !== null && (
            <span
              role="status"
              data-testid="bulk-throttle"
              className="inline-flex items-center gap-1.5 text-sm text-secondary-label"
            >
              <Hourglass aria-hidden="true" size={16} className="text-warning" />
              {de.bulk.throttled(state.throttleSeconds)}
            </span>
          )}
        </div>
      )}

      {hasResult && (
        <div
          role="region"
          aria-label={de.bulk.tableLabel}
          tabIndex={0}
          className="overflow-x-auto rounded-tile material-card hc-edge outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <caption className="sr-only">{de.bulk.tableLabel}</caption>
            <thead>
              <tr className="border-b border-separator text-xs text-secondary-label">
                {(['name', 'matches', 'platform', 'compliance', 'lastSync', 'user'] as const).map(
                  (key) => (
                    <th key={key} scope="col" className="px-4 py-2.5 font-semibold">
                      {de.bulk.columns[key]}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-separator">
              {state.rows.map((row, index) => {
                const device = row.device;
                const severity = device
                  ? checkInSeverity(device.lastSyncDateTime, state.checkedAt)
                  : null;
                return (
                  <tr
                    key={`${row.name}:${index}`}
                    data-testid="bulk-row"
                    data-status={row.status}
                    onClick={device ? () => onOpenDevice(device) : undefined}
                    className={device ? 'cursor-pointer hover:bg-fill' : ''}
                  >
                    <th scope="row" className="px-4 py-2.5 font-semibold text-label">
                      {device ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenDevice(device);
                          }}
                          aria-label={de.bulk.openDevice(showDevice(device.deviceName))}
                          className={LINK_BUTTON}
                        >
                          {showDevice(device.deviceName)}
                        </button>
                      ) : row.status === 'done' && row.matchCount > 1 ? (
                        <button
                          type="button"
                          onClick={() => onSearchName(row.name)}
                          aria-label={de.bulk.searchName(showDevice(row.name))}
                          className={LINK_BUTTON}
                        >
                          {showDevice(row.name)}
                        </button>
                      ) : (
                        showDevice(row.name)
                      )}
                    </th>
                    <td className="px-4 py-2.5 text-label">
                      {matchText(row)}
                      {row.status === 'error' && row.errorMessage && (
                        <span className="block text-xs text-secondary-label">
                          {view.text(row.errorMessage)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-label">
                      {device?.operatingSystem ?? de.bulk.noValue}
                    </td>
                    <td className="px-4 py-2.5 text-label">
                      {device ? complianceText(device.complianceState) : de.bulk.noValue}
                    </td>
                    <td className="px-4 py-2.5">
                      {device && severity ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <span
                            title={formatDateTime(device.lastSyncDateTime)}
                            className="tabular-nums text-label"
                          >
                            {formatRelativeTime(device.lastSyncDateTime, state.checkedAt)}
                          </span>
                          <SeverityBadge severity={severity} />
                        </span>
                      ) : (
                        de.bulk.noValue
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-label">
                      {device?.userDisplayName
                        ? view.enabled
                          ? masker.user(device.userDisplayName)
                          : device.userDisplayName
                        : de.bulk.noValue}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
