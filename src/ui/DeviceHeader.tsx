import type { ReactNode } from 'react';
import { ExternalLink, Hourglass } from 'lucide-react';
import type { DeviceSearchResult, ManagedDeviceInfo, Tile } from '../domain/types';
import { de } from '../i18n/de';
import { IntunePortal } from '../links/intunePortal';
import type { TileSummary } from '../rules/evaluate';
import type { AmbientTone } from './AmbientGlow';
import { DEVICE_ICON, deviceIconKind, searchResultIconKind } from './deviceIcon';
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
  /** Weitere Geräte des primären Benutzers (ohne das aktuelle); leer/fehlend → keine Zeile */
  otherDevices?: readonly DeviceSearchResult[];
  /** Öffnet ein anderes Gerät – derselbe Weg wie ein Suchtreffer */
  onOpenDevice?: (device: Pick<DeviceSearchResult, 'id' | 'deviceName'>) => void;
}

const MAX_OTHER_DEVICES = 5;

/** Compliance-Punkt: Farbe nach complianceState (zusätzlich als Text im Label). */
const COMPLIANCE_DOT: Record<string, string> = {
  compliant: 'bg-ok',
  noncompliant: 'bg-critical',
  conflict: 'bg-critical',
  error: 'bg-critical',
  inGracePeriod: 'bg-warning',
};

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
  otherDevices,
  onOpenDevice,
}: Props) {
  const loading = !device || !summary || summary.loading > 0;
  const meta = device ? deviceMeta(device, tiles) : [];
  const DeviceIcon = DEVICE_ICON[deviceIconKind(device)];

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
          <DeviceIcon size={30} strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h1 className="display-type break-words text-3xl font-semibold text-label sm:text-display">
            {device ? device.deviceName : <span className="text-secondary-label">…</span>}
          </h1>
          <p className="mt-1.5 text-sm text-secondary-label">
            {device ? meta.join(' · ') : de.header.loadingDevice}
          </p>
          {badges && <div className="mt-2 flex flex-wrap items-center gap-2">{badges}</div>}
          {device && (
            <nav
              aria-label={de.header.portalLinks}
              className="mt-2 flex flex-wrap items-center gap-2"
            >
              <span aria-hidden="true" className="text-sm text-secondary-label">
                {de.links.portalPrefix}
              </span>
              {[
                {
                  short: de.links.shortDevice,
                  label: de.links.openDevice,
                  url: IntunePortal.device(device.id),
                },
                {
                  short: de.links.shortManagedApps,
                  label: de.links.openManagedApps,
                  url: IntunePortal.deviceManagedApps(device.id),
                },
                {
                  short: de.links.shortDeviceInventory,
                  label: de.links.openDeviceInventory,
                  url: IntunePortal.deviceInventory(device.id),
                },
              ].map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  aria-label={link.label}
                  title={link.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent/6 px-3 py-1.5 text-sm font-medium text-accent outline-none transition-transform hover:bg-accent/8 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
                >
                  {link.short}
                  <ExternalLink aria-hidden="true" size={14} />
                </a>
              ))}
            </nav>
          )}
          {device && onOpenDevice && otherDevices && otherDevices.length > 0 && (
            <nav
              aria-label={de.header.otherDevicesLabel}
              data-testid="other-devices"
              className="mt-2 flex flex-wrap items-center gap-2"
            >
              <span className="text-sm text-secondary-label">
                {de.header.otherDevices(device.userDisplayName ?? device.userPrincipalName ?? '–')}
              </span>
              {otherDevices.slice(0, MAX_OTHER_DEVICES).map((other) => {
                const Icon = DEVICE_ICON[searchResultIconKind(other)];
                const compliance =
                  (de.picker.compliance as Record<string, string>)[other.complianceState] ?? '';
                return (
                  <button
                    key={other.id}
                    type="button"
                    onClick={() => onOpenDevice(other)}
                    aria-label={de.header.openOtherDevice(other.deviceName, compliance)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-label/6 px-3 py-1.5 text-sm font-medium text-label outline-none transition-transform hover:bg-label/10 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
                  >
                    <Icon aria-hidden="true" size={14} />
                    {other.deviceName}
                    <span
                      aria-hidden="true"
                      className={`size-2 rounded-full ${COMPLIANCE_DOT[other.complianceState] ?? 'bg-unknown'}`}
                    />
                  </button>
                );
              })}
            </nav>
          )}
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
