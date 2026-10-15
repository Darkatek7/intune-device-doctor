import { ChevronRight } from 'lucide-react';
import type { DeviceSearchResult } from '../domain/types';
import { formatDateTime, formatRelativeTime } from '../domain/format';
import { de } from '../i18n/de';

interface Props {
  results: DeviceSearchResult[];
  query: string;
  now: Date;
  onSelect: (result: DeviceSearchResult) => void;
}

/** Auswahl bei mehrdeutiger Suche: Name, Nutzer, OS, Compliance (Text), letzter Sync relativ. */
export function ResultPicker({ results, query, now, onSelect }: Props) {
  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="text-title font-semibold text-label">{de.picker.title}</h1>
      <p className="mt-1 text-sm text-secondary-label">
        {de.picker.subtitle(results.length, query)}
      </p>
      <ul
        aria-label={de.picker.list}
        className="mt-4 divide-y divide-separator overflow-hidden rounded-tile bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_rgb(0_0_0/0.04)]"
      >
        {results.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r)}
              aria-label={de.picker.select(r.deviceName)}
              className="flex w-full items-center gap-3 px-5 py-3 text-left outline-none transition-colors hover:bg-canvas focus-visible:bg-canvas focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent active:scale-[0.99]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold text-label">
                  {r.deviceName}
                </span>
                <span className="block truncate text-sm text-secondary-label">
                  {[
                    r.userDisplayName ?? r.userPrincipalName ?? de.picker.noUser,
                    [r.operatingSystem, r.osVersion].filter(Boolean).join(' ') || null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end text-xs text-secondary-label">
                <span className="font-medium text-label">
                  {de.picker.compliance[r.complianceState]}
                </span>
                <span title={formatDateTime(r.lastSyncDateTime)}>
                  {de.picker.lastSync}: {formatRelativeTime(r.lastSyncDateTime, now)}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                size={16}
                className="shrink-0 text-secondary-label"
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
