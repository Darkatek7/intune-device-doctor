/**
 * Eine Zeile der Geräteliste (Ansicht „Flotte“). Die ganze Zeile ist ein Button, der das Gerät öffnet. Ab
 * `lg` Tabellenzeile in Spalten, darunter eine gestapelte Karte mit sichtbaren Feldbezeichnungen – dieselbe
 * DOM-Struktur, nur andere Raster. Auffälligkeiten stehen als Chips mit Icon und Text, nie nur in Farbe.
 */
import { OctagonAlert, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDateTime, formatRelativeTime } from '../domain/format';
import { de } from '../i18n/de';
import { FLEET_ISSUE_SEVERITY, type FleetRow } from '../rules/fleetDevices';

const t = de.fleetDevices;

/** Spalten ab `lg`; die Kopfzeile in der Ansicht nutzt dieselbe Vorlage. */
export const FLEET_GRID_COLUMNS =
  'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.05fr)_minmax(0,1.35fr)_minmax(0,0.85fr)_minmax(0,0.95fr)_minmax(0,0.85fr)_minmax(0,1.5fr)]';

/** Chip-Text bleibt `text-label` (Kontrast), Farbe tönt nur Fläche und Icon – wie `SeverityBadge`. */
const CHIP_CLASS = {
  critical: 'bg-critical/12',
  warning: 'bg-warning/12',
} as const;
const CHIP_ICON = { critical: 'text-critical', warning: 'text-warning' } as const;

const ROW_EDGE = {
  critical: 'border-l-critical',
  warning: 'border-l-warning',
  ok: 'border-l-transparent',
} as const;

export function IssueChip({ issue }: { issue: FleetRow['issues'][number] }) {
  const severity = FLEET_ISSUE_SEVERITY[issue];
  const Icon = severity === 'critical' ? OctagonAlert : TriangleAlert;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-label ${CHIP_CLASS[severity]}`}
    >
      <Icon aria-hidden="true" size={12} className={`shrink-0 ${CHIP_ICON[severity]}`} />
      {t.issues.names[issue]}
    </span>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-secondary-label lg:sr-only">{label}</span>
      <span className="min-w-0 break-words text-sm text-label">{children}</span>
    </span>
  );
}

interface Props {
  row: FleetRow;
  now: Date;
  onOpen: () => void;
}

export function FleetDeviceRow({ row, now, onOpen }: Props) {
  const { device } = row;
  const c = t.list.columns;
  const encryption =
    device.isEncrypted === null
      ? t.list.encryption.unknown
      : device.isEncrypted
        ? t.list.encryption.yes
        : t.list.encryption.no;
  return (
    <li>
      <button
        type="button"
        data-fleet-row=""
        data-severity={row.severity}
        onClick={onOpen}
        className={`material-card hc-edge grid w-full grid-cols-2 items-start gap-x-4 gap-y-2.5 rounded-2xl border-l-4 p-3.5 text-left outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.995] sm:grid-cols-4 lg:items-center lg:gap-y-0 ${FLEET_GRID_COLUMNS} ${ROW_EDGE[row.severity]}`}
      >
        <span className="col-span-2 flex min-w-0 flex-col sm:col-span-4 lg:col-span-1">
          <span className="break-words text-base font-semibold text-label">
            {device.deviceName}
          </span>
          <span className="break-words text-xs text-secondary-label">
            {device.model ?? t.list.noModel}
          </span>
        </span>
        <span className="min-w-0 sm:col-span-2 lg:col-span-1">
          <Cell label={c.user}>
            {device.userDisplayName ?? device.userPrincipalName ?? t.list.noUser}
          </Cell>
        </span>
        <span className="min-w-0 sm:col-span-2 lg:col-span-1">
          <Cell label={c.platform}>
            {t.platform.names[row.platform]}{' '}
            <span className="tabular-nums text-secondary-label">
              {device.osVersion ?? t.list.noVersion}
            </span>
          </Cell>
        </span>
        <Cell label={c.compliance}>{de.picker.compliance[device.complianceState]}</Cell>
        <Cell label={c.encryption}>{encryption}</Cell>
        <span className="col-span-2 min-w-0 sm:col-span-2 lg:col-span-1">
          <Cell label={c.checkIn}>
            {device.lastSyncDateTime ? (
              <time
                dateTime={device.lastSyncDateTime}
                title={formatDateTime(device.lastSyncDateTime)}
              >
                {formatRelativeTime(device.lastSyncDateTime, now)}
              </time>
            ) : (
              t.list.noCheckIn
            )}
          </Cell>
        </span>
        <span className="col-span-2 flex min-w-0 flex-wrap gap-1.5 sm:col-span-4 lg:col-span-1">
          <span className="sr-only">{c.issues}: </span>
          {row.issues.length === 0 ? (
            <span className="text-sm text-secondary-label">{t.list.noIssues}</span>
          ) : (
            row.issues.map((issue) => <IssueChip key={issue} issue={issue} />)
          )}
        </span>
      </button>
    </li>
  );
}
