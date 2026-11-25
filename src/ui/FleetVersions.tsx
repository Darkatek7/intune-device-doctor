/**
 * Versionsverteilung der Ansicht „Flotte“: je Plattform die gemeldeten Betriebssystemversionen mit Anzahl
 * und Anteil. Reine Zählung – bewusst ohne Wertung („veraltet“). Der Balken hat daneben immer den Text
 * (Anzahl und Prozent), er ist nur Zugabe.
 */
import { useState } from 'react';
import { formatPercent } from '../domain/format';
import { de } from '../i18n/de';
import type { FleetOsVersions } from '../rules/fleetDevices';

const t = de.fleetDevices.versions;
const VISIBLE = 5;

function PlatformVersions({ entry }: { entry: FleetOsVersions }) {
  const [expanded, setExpanded] = useState(false);
  const platformName = de.fleetDevices.platform.names[entry.platform];
  const shown = expanded ? entry.versions : entry.versions.slice(0, VISIBLE);
  return (
    <section
      aria-label={t.platformTitle(platformName, entry.total)}
      data-testid={`fleet-versions-${entry.platform}`}
      className="material-card hc-edge flex min-w-0 flex-col gap-3 rounded-tile p-4"
    >
      <h3 className="text-sm font-semibold text-label">
        {t.platformTitle(platformName, entry.total)}
      </h3>
      <ul aria-label={t.barLabel(platformName)} className="flex flex-col gap-2">
        {shown.map((item) => {
          const share = item.count / entry.total;
          const version = item.version ?? t.unknown;
          return (
            <li key={item.version ?? '∅'} className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
                <span className="min-w-0 break-all tabular-nums text-label">{version}</span>
                <span className="tabular-nums text-secondary-label">
                  {item.count} ({formatPercent(share)})
                </span>
              </span>
              <span
                aria-hidden="true"
                className="h-1.5 w-full overflow-hidden rounded-full bg-fill"
              >
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${Math.max(share * 100, 1.5)}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
      {entry.versions.length > VISIBLE && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="self-start rounded-full px-1 text-sm font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {expanded ? t.showLess : t.showAll(entry.versions.length)}
        </button>
      )}
    </section>
  );
}

export function FleetVersions({ versions }: { versions: readonly FleetOsVersions[] }) {
  if (versions.length === 0) return null;
  return (
    <section aria-labelledby="fleet-versions-title" className="flex flex-col gap-3">
      <div>
        <h2 id="fleet-versions-title" className="text-lg font-semibold text-label">
          {t.title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-secondary-label">{t.hint}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {versions.map((entry) => (
          <PlatformVersions key={entry.platform} entry={entry} />
        ))}
      </div>
    </section>
  );
}
