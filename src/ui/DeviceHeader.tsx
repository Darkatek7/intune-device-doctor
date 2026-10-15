import type { ManagedDeviceInfo } from '../domain/types';
import { formatDate } from '../domain/format';
import { de } from '../i18n/de';
import type { TileSummary } from '../rules/evaluate';
import { SeverityIcon } from './SeverityBadge';
import { summaryParts, summarySentence } from './summaryText';

interface Props {
  device: ManagedDeviceInfo | null;
  summary: TileSummary | null;
  totalTiles: number;
}

/** Geräte-Header: Name groß, Metazeile, rechts die Zusammenfassung mit Severity-Icons. */
export function DeviceHeader({ device, summary, totalTiles }: Props) {
  const loading = !device || !summary || summary.loading > 0;
  const meta = device
    ? [
        device.model,
        device.userDisplayName ?? device.userPrincipalName,
        [device.operatingSystem, device.osVersion].filter(Boolean).join(' ') || null,
        device.enrolledDateTime ? de.header.enrolled(formatDate(device.enrolledDateTime)) : null,
      ].filter((part): part is string => Boolean(part))
    : [];

  const liveText = !device
    ? de.header.loadingDevice
    : loading
      ? de.a11y.deviceLoading(device.deviceName)
      : de.a11y.deviceDone(device.deviceName, summarySentence(summary));

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-3xl font-semibold tracking-tight text-label sm:text-display">
          {device ? device.deviceName : <span className="text-secondary-label">…</span>}
        </h1>
        <p className="mt-1 text-sm text-secondary-label">
          {device ? meta.join(' · ') : de.header.loadingDevice}
        </p>
      </div>
      <div
        aria-label={de.header.summaryLabel}
        className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-label sm:pb-1"
      >
        {device && summary && !loading ? (
          summaryParts(summary).map((part) => (
            <span key={part.severity} className="inline-flex items-center gap-1.5">
              <SeverityIcon severity={part.severity} size={18} />
              {part.text}
            </span>
          ))
        ) : device && summary ? (
          <span className="text-secondary-label">
            {de.header.checking(totalTiles - summary.loading, totalTiles)}
          </span>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite" role="status">
        {liveText}
      </p>
    </div>
  );
}
