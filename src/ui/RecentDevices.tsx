import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { formatDateTime, formatRelativeTime } from '../domain/format';
import type { DataMode } from '../domain/types';
import type { RecentDevice } from '../hooks/useRecentDevices';
import { de } from '../i18n/de';
import { EXAMPLE_CHIP_CLASS } from './chipStyles';
import { DEVICE_ICON, osIconKind } from './deviceIcon';

interface Props {
  devices: RecentDevice[];
  mode: DataMode;
  onOpen: (device: RecentDevice) => void;
  onClear: () => void;
}

/** "Zuletzt geöffnet" unter dem Suchfeld der Startseite. Bei leerem Verlauf: nichts. */
export function RecentDevices({ devices, mode, onOpen, onClear }: Props) {
  // Relative Zeiten beziehen sich auf den Moment, in dem die Startseite erscheint.
  const [now] = useState(() => new Date());
  if (devices.length === 0) return null;

  return (
    <div className="w-full">
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2
          title={mode === 'live' ? de.comfort.recentLocalOnly : undefined}
          className="text-xs font-semibold uppercase tracking-[0.06em] text-secondary-label"
        >
          {de.comfort.recentTitle}
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md px-1.5 py-0.5 text-xs font-medium text-accent outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
        >
          {de.comfort.recentClear}
        </button>
      </div>
      {mode === 'live' && (
        <p className="-mt-1 mb-3 px-1 text-xs text-secondary-label">{de.comfort.recentLocalOnly}</p>
      )}
      <ul
        aria-label={de.comfort.recentList}
        className="grid grid-cols-1 gap-2.5 min-[30rem]:grid-cols-2 sm:grid-cols-3"
      >
        {devices.map((device) => {
          const Icon = DEVICE_ICON[osIconKind(device.osFamily)];
          return (
            <li key={device.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onOpen(device)}
                aria-label={de.comfort.recentOpen(device.deviceName)}
                className={EXAMPLE_CHIP_CLASS}
              >
                <span aria-hidden="true" className="squircle size-8 bg-fill text-secondary-label">
                  <Icon size={17} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-label">
                    {device.deviceName}
                  </span>
                  <span
                    title={formatDateTime(device.openedAt)}
                    className="truncate text-xs text-secondary-label"
                  >
                    {formatRelativeTime(device.openedAt, now)}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden="true"
                  size={16}
                  className="shrink-0 text-tertiary-label"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
