/**
 * Ansicht „Flotte“ (M22): alle verwalteten Geräte des Mandanten, auffällige zuerst, Klick öffnet das Gerät.
 * Daten kommen ausschließlich über useFleetDevices (Provider-Schnittstelle). Ausgewertet wird auf den
 * Rohdaten (Zählen, Sortieren); Liste, Suche und Export laufen über die maskierte Sicht (Präsentationsmodus).
 * Alle Zahlen folgen der Auswahl: Gesamtbild und Versionsverteilung zählen die Zeilen der Liste, jede
 * Filterleiste zählt mit den jeweils anderen Filtern (`fleetFacets`).
 */
import {
  Check,
  ChevronLeft,
  Download,
  Info,
  Lock,
  MonitorSmartphone,
  OctagonAlert,
  RotateCw,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { OsFamily } from '../domain/types';
import { useFleetDevices } from '../hooks/useFleetDevices';
import { de } from '../i18n/de';
import { downloadTextFile } from '../lib/download';
import { PrivacyViewProvider } from '../privacy/PrivacyProvider';
import { useBuildPrivacyView } from '../privacy/privacyContext';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import {
  evaluateFleet,
  FLEET_MANAGEMENTS,
  fleetFacets,
  type FleetIssue,
  type FleetManagement,
  type FleetRow,
} from '../rules/fleetDevices';
import { fleetDevicesCsv, fleetExportFileName } from '../rules/fleetDevicesExport';
import type { AmbientTone } from '../ui/AmbientGlow';
import { ChoiceChip } from '../ui/ChoiceChip';
import { ErrorState } from '../ui/ErrorState';
import { FleetDeviceRow, FLEET_GRID_COLUMNS } from '../ui/FleetDeviceRow';
import { FleetVersions } from '../ui/FleetVersions';
import { TONE_CLASS } from '../ui/tone';

const t = de.fleetDevices;
const PAGE_SIZE = 50;

const ACTION_BUTTON =
  'inline-flex items-center gap-1.5 rounded-full bg-fill px-3 py-1.5 text-sm font-medium text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60';

export interface FleetFilterState {
  issue: FleetIssue | 'any' | null;
  platform: OsFamily | null;
  /** „Verwaltet von“, Mehrfachauswahl; leer = alle */
  managements: readonly FleetManagement[];
}

interface Props {
  provider: DeviceDataProvider;
  /** Aus der URL: ?issue=… (null = alle Geräte) */
  issue: FleetIssue | 'any' | null;
  /** Aus der URL: ?platform=… (null = alle) */
  platform: OsFamily | null;
  /** Aus der URL: ?managed=… (leer = alle); die Referenz muss zwischen Renderings stabil sein */
  managements: readonly FleetManagement[];
  onFilterChange: (filter: FleetFilterState) => void;
  onOpenDevice: (device: { id: string; deviceName: string }) => void;
  onBack: () => void;
  /** Gesamtzustand für das Umgebungslicht (accent, solange geladen wird) */
  onToneChange?: (tone: AmbientTone) => void;
}

function PanelNote({
  icon,
  title,
  children,
  role,
  onRetry,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  role?: 'alert';
  onRetry?: () => void;
}) {
  return (
    <div
      role={role}
      className="material-card hc-edge flex flex-wrap items-start gap-3 rounded-2xl p-4 text-sm"
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-label">{title}</p>
        {children && <div className="mt-1 text-secondary-label">{children}</div>}
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className={ACTION_BUTTON}>
          <RotateCw aria-hidden="true" size={15} />
          {t.states.retry}
        </button>
      )}
    </div>
  );
}

export function FleetView({
  provider,
  issue,
  platform,
  managements,
  onFilterChange,
  onOpenDevice,
  onBack,
  onToneChange,
}: Props) {
  const { state, reload } = useFleetDevices(provider);
  const [query, setQuery] = useState('');
  const [limitState, setLimitState] = useState({ key: '', count: PAGE_SIZE });
  const listRef = useRef<HTMLUListElement>(null);
  const focusIndex = useRef<number | null>(null);

  const info = state.section?.status === 'ok' ? state.section.data : null;
  const now = state.now;

  // Auswertung auf Rohdaten; Anzeige, Suche und Export auf der (ggf. maskierten) Sicht.
  const overview = useMemo(() => (info && now ? evaluateFleet(info, now) : null), [info, now]);
  const view = useBuildPrivacyView(info);
  const shownRows = useMemo(() => (overview ? view.deep(overview.rows) : []), [overview, view]);
  const rawByShown = useMemo(() => {
    const map = new Map<FleetRow, FleetRow>();
    overview?.rows.forEach((raw, index) => map.set(shownRows[index]!, raw));
    return map;
  }, [overview, shownRows]);
  const facets = useMemo(
    () => fleetFacets(shownRows, { issue, platform, managements, query }),
    [shownRows, issue, platform, managements, query],
  );
  const filtered = facets.rows;

  const filterKey = `${issue ?? ''}|${platform ?? ''}|${managements.join(',')}|${query}`;
  const limit = limitState.key === filterKey ? limitState.count : PAGE_SIZE;
  const visibleRows = filtered.slice(0, limit);
  const remaining = filtered.length - visibleRows.length;

  const tone: AmbientTone = !overview
    ? 'accent'
    : overview.critical > 0
      ? 'critical'
      : overview.warning > 0
        ? 'warning'
        : 'ok';
  useEffect(() => {
    onToneChange?.(tone);
  }, [tone, onToneChange]);

  useEffect(() => {
    const previous = document.title;
    document.title = `${t.title} – ${de.app.name}`;
    return () => {
      document.title = previous;
    };
  }, []);

  // Nach „Weitere anzeigen“ springt der Fokus auf die erste neue Zeile (der Button verschwindet evtl.).
  useEffect(() => {
    if (focusIndex.current === null) return;
    const target =
      listRef.current?.querySelectorAll<HTMLElement>('[data-fleet-row]')[focusIndex.current];
    focusIndex.current = null;
    target?.focus();
  }, [visibleRows.length]);

  if (state.status === 'error') {
    return <ErrorState error={state.error} onRetry={reload} />;
  }

  const loading = state.status === 'loading';
  const section = state.section;
  const filterActive =
    issue !== null || platform !== null || managements.length > 0 || query.trim() !== '';
  // Gesamtbild: ohne Filter die ganze Flotte, mit Filter genau die Zeilen der Liste.
  const counts = facets.counts;

  const exportCsv = () => {
    if (!now) return;
    // Exportiert wird, was angezeigt wird: die gefilterte, ggf. maskierte Liste.
    downloadTextFile(fleetExportFileName(now), fleetDevicesCsv(filtered), 'text/csv;charset=utf-8');
  };
  const showMore = () => {
    focusIndex.current = visibleRows.length;
    setLimitState({ key: filterKey, count: limit + PAGE_SIZE });
  };
  const resetFilters = () => {
    setQuery('');
    onFilterChange({ issue: null, platform: null, managements: [] });
  };
  const toggleIssue = (next: FleetIssue | 'any' | null) =>
    onFilterChange({ issue: next === issue ? null : next, platform, managements });
  const toggleManagement = (management: FleetManagement) =>
    onFilterChange({
      issue,
      platform,
      // feste Reihenfolge, damit dieselbe Auswahl immer dieselbe URL ergibt
      managements: FLEET_MANAGEMENTS.filter(
        (entry) => managements.includes(entry) !== (entry === management),
      ),
    });

  // Gruppen der ganzen Flotte plus gewählte (auch wenn die URL eine Gruppe ohne Geräte nennt).
  const managementChoices = FLEET_MANAGEMENTS.filter(
    (management) =>
      managements.includes(management) ||
      overview?.managements.some((entry) => entry.management === management),
  );

  const liveText = loading
    ? t.states.loading
    : overview
      ? t.states.loaded(overview.total, overview.withIssues)
      : '';

  return (
    <PrivacyViewProvider view={view}>
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span
                aria-hidden="true"
                className={`squircle mt-1 size-14 shadow-[inset_0_1px_0_var(--c-highlight)] transition-colors duration-500 sm:size-16 ${TONE_CLASS[tone]}`}
              >
                <MonitorSmartphone size={30} strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <h1 className="display-type break-words text-3xl font-semibold text-label sm:text-display">
                  {t.title}
                </h1>
                <p className="mt-1.5 text-sm text-secondary-label">{t.subtitle}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end sm:pb-1">
              <button
                type="button"
                onClick={exportCsv}
                disabled={loading || !overview || filtered.length === 0}
                className={ACTION_BUTTON}
              >
                <Download aria-hidden="true" size={15} />
                {t.export.button}
              </button>
              <button type="button" onClick={reload} disabled={loading} className={ACTION_BUTTON}>
                <RotateCw aria-hidden="true" size={15} className={loading ? 'animate-spin' : ''} />
                {t.refresh}
              </button>
            </div>
          </div>
          <p className="max-w-3xl text-sm text-secondary-label">{t.note}</p>
          {overview && (
            <div
              role="group"
              aria-label={t.summary.label}
              data-testid="fleet-summary"
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm"
            >
              <span className="font-semibold tabular-nums text-label">
                {filterActive
                  ? overview.truncated
                    ? t.summary.filteredMin(counts.total, overview.total)
                    : t.summary.filtered(counts.total, overview.total)
                  : overview.truncated
                    ? t.summary.totalMin(overview.total)
                    : t.summary.total(overview.total)}
              </span>
              {counts.withIssues === 0 ? (
                <span className="text-secondary-label">{t.summary.allClear}</span>
              ) : (
                <>
                  <span className="tabular-nums text-label">
                    {t.summary.withIssues(counts.withIssues)}
                  </span>
                  {counts.critical > 0 && (
                    <span className="inline-flex items-center gap-1 font-medium tabular-nums text-critical">
                      <OctagonAlert aria-hidden="true" size={14} />
                      {t.summary.critical(counts.critical)}
                    </span>
                  )}
                  {counts.warning > 0 && (
                    <span className="inline-flex items-center gap-1 font-medium tabular-nums text-warning">
                      <TriangleAlert aria-hidden="true" size={14} />
                      {t.summary.warning(counts.warning)}
                    </span>
                  )}
                </>
              )}
              {filterActive && (
                <span className="text-xs text-secondary-label">{t.summary.filterNote}</span>
              )}
            </div>
          )}
          {overview?.truncated && (
            <div
              data-testid="fleet-truncated"
              className="flex max-w-3xl items-start gap-2 rounded-2xl bg-fill p-3 text-sm"
            >
              <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-warning" />
              <p className="text-secondary-label">
                <span className="font-medium text-label">{t.truncated.title}. </span>
                {t.truncated.body}
              </p>
            </div>
          )}
          <p className="sr-only" role="status" aria-live="polite">
            {liveText}
          </p>
        </div>

        {section && section.status === 'forbidden' && (
          <PanelNote
            role="alert"
            icon={<Lock aria-hidden="true" size={18} className="text-critical" />}
            title={de.states.forbidden}
          >
            <p>{section.error.message || t.states.forbiddenBody}</p>
            {section.error.requiredScope && (
              <p className="mt-1">
                {t.states.requiredScope}:{' '}
                <code className="break-all font-mono text-xs">{section.error.requiredScope}</code>
              </p>
            )}
          </PanelNote>
        )}
        {section && section.status === 'error' && (
          <PanelNote
            role="alert"
            icon={<TriangleAlert aria-hidden="true" size={18} className="text-critical" />}
            title={t.states.errorTitle}
            onRetry={reload}
          >
            <p>{section.error.message}</p>
          </PanelNote>
        )}
        {section && (section.status === 'unavailable' || section.status === 'notApplicable') && (
          <PanelNote
            icon={<Info aria-hidden="true" size={18} className="text-secondary-label" />}
            title={t.states.unavailableTitle}
          >
            <p>{section.reason}</p>
          </PanelNote>
        )}

        {loading && (
          <div aria-busy="true" aria-label={t.states.loading} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="skeleton h-20 rounded-2xl" />
              ))}
            </div>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
        )}

        {overview && overview.total === 0 && (
          <PanelNote
            icon={<Info aria-hidden="true" size={18} className="text-secondary-label" />}
            title={t.states.emptyTitle}
          >
            <p>{t.states.emptyBody}</p>
          </PanelNote>
        )}

        {overview && overview.total > 0 && (
          <>
            <section aria-labelledby="fleet-issues-title" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 id="fleet-issues-title" className="text-lg font-semibold text-label">
                    {t.issues.label}
                  </h2>
                  <p className="text-xs text-secondary-label">{t.issues.hint}</p>
                </div>
                <div role="group" aria-label={t.issues.label} className="flex flex-wrap gap-2">
                  <ChoiceChip
                    pressed={issue === null}
                    onClick={() => onFilterChange({ issue: null, platform, managements })}
                  >
                    {t.issues.all}
                  </ChoiceChip>
                  <ChoiceChip pressed={issue === 'any'} onClick={() => toggleIssue('any')}>
                    {t.issues.any}
                  </ChoiceChip>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {overview.groups.map((group) => {
                  const pressed = issue === group.issue;
                  const groupCount = facets.issues[group.issue];
                  const Icon = group.severity === 'critical' ? OctagonAlert : TriangleAlert;
                  return (
                    <li key={group.issue}>
                      <button
                        type="button"
                        aria-pressed={pressed}
                        data-issue={group.issue}
                        onClick={() => toggleIssue(group.issue)}
                        className={`material-card hc-edge flex h-full w-full flex-col items-start gap-1 rounded-2xl p-3 text-left outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] ${
                          pressed ? 'ring-2 ring-accent' : ''
                        }`}
                      >
                        <span
                          className={`flex items-center gap-1 text-xs font-medium ${
                            groupCount === 0
                              ? 'text-secondary-label'
                              : group.severity === 'critical'
                                ? 'text-critical'
                                : 'text-warning'
                          }`}
                        >
                          <Icon aria-hidden="true" size={13} />
                          {t.issues.severity[group.severity]}
                          {pressed && <Check aria-hidden="true" size={13} />}
                        </span>
                        <span
                          className={`text-sm font-medium ${
                            groupCount === 0 ? 'text-secondary-label' : 'text-label'
                          }`}
                        >
                          {t.issues.names[group.issue]}
                        </span>
                        <span
                          className={`text-2xl font-semibold tabular-nums ${
                            groupCount === 0 ? 'text-secondary-label' : 'text-label'
                          }`}
                        >
                          {groupCount}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="fleet-list-title" className="flex flex-col gap-3">
              <h2 id="fleet-list-title" className="sr-only">
                {t.list.label}
              </h2>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div role="group" aria-label={t.platform.label} className="flex flex-wrap gap-2">
                  <ChoiceChip
                    pressed={platform === null}
                    onClick={() => onFilterChange({ issue, platform: null, managements })}
                  >
                    {t.platform.all}
                  </ChoiceChip>
                  {overview.platforms.map((entry) => (
                    <ChoiceChip
                      key={entry.platform}
                      pressed={platform === entry.platform}
                      onClick={() =>
                        onFilterChange({
                          issue,
                          platform: platform === entry.platform ? null : entry.platform,
                          managements,
                        })
                      }
                    >
                      {t.platform.names[entry.platform]} ({facets.platforms[entry.platform]})
                    </ChoiceChip>
                  ))}
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <label htmlFor="fleet-search" className="sr-only">
                    {t.search.label}
                  </label>
                  <Search
                    aria-hidden="true"
                    size={16}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-secondary-label"
                  />
                  <input
                    id="fleet-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t.search.placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-full bg-fill py-2 pr-9 pl-9 text-sm text-label outline-none placeholder:text-secondary-label focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-search-cancel-button]:appearance-none"
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label={t.search.clear}
                      onClick={() => setQuery('')}
                      className="absolute top-1/2 right-1.5 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-secondary-label outline-none hover:text-label focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <X aria-hidden="true" size={15} />
                    </button>
                  )}
                </div>
              </div>

              {(overview.managements.length > 1 || managements.length > 0) && (
                <div className="flex flex-col gap-1.5">
                  <div
                    role="group"
                    aria-label={t.management.label}
                    data-testid="fleet-management"
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span aria-hidden="true" className="text-xs font-medium text-secondary-label">
                      {t.management.label}
                    </span>
                    <ChoiceChip
                      pressed={managements.length === 0}
                      onClick={() => onFilterChange({ issue, platform, managements: [] })}
                    >
                      {t.management.all}
                    </ChoiceChip>
                    {managementChoices.map((management) => (
                      <ChoiceChip
                        key={management}
                        pressed={managements.includes(management)}
                        onClick={() => toggleManagement(management)}
                      >
                        {t.management.names[management]} ({facets.managements[management]})
                      </ChoiceChip>
                    ))}
                  </div>
                  <p className="text-xs text-secondary-label">{t.management.hint}</p>
                </div>
              )}

              <p
                role="status"
                aria-live="polite"
                data-testid="fleet-counter"
                className="text-sm tabular-nums text-secondary-label"
              >
                {t.list.counter(visibleRows.length, filtered.length)}
              </p>

              {filtered.length === 0 ? (
                <div className="material-card hc-edge flex flex-col items-center gap-2 rounded-2xl p-8 text-center">
                  <p className="font-medium text-label">{t.list.empty.title}</p>
                  <p className="text-sm text-secondary-label">{t.list.empty.body}</p>
                  {filterActive && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className={`${ACTION_BUTTON} mt-1`}
                    >
                      {t.list.empty.reset}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div
                    aria-hidden="true"
                    className={`hidden gap-x-4 pr-3.5 pl-[calc(0.875rem+4px)] text-xs font-medium text-secondary-label lg:grid ${FLEET_GRID_COLUMNS}`}
                  >
                    <span>{t.list.columns.device}</span>
                    <span>{t.list.columns.user}</span>
                    <span>{t.list.columns.platform}</span>
                    <span>{t.list.columns.compliance}</span>
                    <span>{t.list.columns.encryption}</span>
                    <span>{t.list.columns.checkIn}</span>
                    <span>{t.list.columns.issues}</span>
                  </div>
                  <ul ref={listRef} aria-label={t.list.label} className="flex flex-col gap-2">
                    {visibleRows.map((row) => (
                      <FleetDeviceRow
                        key={rawByShown.get(row)?.device.id ?? row.device.id}
                        row={row}
                        now={now!}
                        onOpen={() => {
                          // Geöffnet wird mit den echten Werten, angezeigt werden die maskierten.
                          const raw = rawByShown.get(row)?.device ?? row.device;
                          onOpenDevice({ id: raw.id, deviceName: raw.deviceName });
                        }}
                      />
                    ))}
                  </ul>
                  {remaining > 0 && (
                    <button
                      type="button"
                      onClick={showMore}
                      className={`${ACTION_BUTTON} self-center`}
                    >
                      {t.list.showMore(Math.min(remaining, PAGE_SIZE))}
                    </button>
                  )}
                </>
              )}
            </section>

            <FleetVersions versions={counts.osVersions} />
          </>
        )}
      </div>
    </PrivacyViewProvider>
  );
}
