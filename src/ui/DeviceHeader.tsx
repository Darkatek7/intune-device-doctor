import type { ReactNode } from 'react';
import { Hourglass, Laptop } from 'lucide-react';
import type { ManagedDeviceInfo, Tile } from '../domain/types';
import { de } from '../i18n/de';
import type { TileSummary } from '../rules/evaluate';
import type { AmbientTone } from './AmbientGlow';
import { deviceMeta } from './deviceMeta';
import { TONE_CLASS } from './tone';
import { summarySentence } from './summaryText';
import { SummaryPills } from './SummaryPills';

interface Props {
  device: ManagedDeviceInfo | null;
  summary: TileSummary | null;
  totalTiles: number;
  /** Chips unter der Metazeile, z. B. "+ DiagLogs-ZIP" */
  badges?: ReactNode;
  /** Aktuelle Kacheln – die OS-Angabe der Metazeile kommt aus der Betriebssystem-Kachel */
  tiles?: readonly Tile[];
  /** Aktionen rechts unter der Zusammenfassung, z. B. "Ticket-Notiz kopieren" */
  actions?: ReactNode;
  /** Gesetzt, wenn mind. eine Section von Microsoft Graph gedrosselt wurde (429) */
  throttle?: { retryAfterSeconds?: number } | null;
  /** Gesamtzustand – färbt das Geräte-Icon */
  tone?: AmbientTone;
}

/** Geräte-Header: Name groß, Metazeile, rechts die Zusammenfassung mit Severity-Icons. */
export function DeviceHeader({
  device,
  summary,
  totalTiles,
  badges,
  tiles,
  actions,
  throttle,
  tone = 'accent',
}: Props) {
  const loading = !device || !summary || summary.loading > 0;
  const meta = device ? deviceMeta(device, tiles) : [];

  const liveText = !device
    ? de.header.loadingDevice
    : loading
      ? de.a11y.deviceLoading(device.deviceName)
      : de.a11y.deviceDone(device.deviceName, summarySentence(summary));

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <span
          aria-hidden="true"
          className={`squircle mt-1 size-14 shadow-[inset_0_1px_0_var(--c-highlight)] transition-colors duration-500 sm:size-16 ${TONE_CLASS[tone]}`}
        >
          <Laptop size={30} strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h1 className="display-type break-words text-3xl font-semibold text-label sm:text-display">
            {device ? device.deviceName : <span className="text-secondary-label">…</span>}
          </h1>
          <p className="mt-1.5 text-sm text-secondary-label">
            {device ? meta.join(' · ') : de.header.loadingDevice}
          </p>
          {badges && <div className="mt-2 flex flex-wrap items-center gap-2">{badges}</div>}
          {throttle && (
            <p
              role="status"
              aria-live="polite"
              data-testid="throttle-notice"
              className="mt-2 flex items-start gap-1.5 text-sm text-secondary-label"
            >
              <Hourglass aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-warning" />
              <span>
                {de.states.throttled}
                {throttle.retryAfterSeconds
                  ? ` ${de.states.retryAfter(throttle.retryAfterSeconds)}`
                  : ''}
              </span>
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2.5 sm:items-end sm:pb-1">
        <div
          aria-label={de.header.summaryLabel}
          className="flex flex-wrap items-center gap-2 text-sm font-medium text-label"
        >
          {device && summary && !loading ? (
            <SummaryPills summary={summary} />
          ) : device && summary ? (
            <span className="text-secondary-label">
              {de.header.checking(totalTiles - summary.loading, totalTiles)}
            </span>
          ) : null}
        </div>
        {actions}
      </div>
      <p className="sr-only" aria-live="polite" role="status">
        {liveText}
      </p>
    </div>
  );
}
