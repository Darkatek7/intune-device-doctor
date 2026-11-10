/**
 * Ansicht „Richtlinien“ (M15): umgekehrte Sicht Richtlinie → betroffene Geräte. Liste aller
 * Konfigurationsprofile und Compliance-Richtlinien mit den Zählern aus deviceStatusOverview, sortiert
 * nach Problemen, mit Namensfilter; ein Klick öffnet den Gerätestatus (PolicyDetailView). Daten kommen
 * ausschließlich über useTenantPolicies (Provider-Schnittstelle).
 */
import { motion, useReducedMotion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Info,
  ListChecks,
  Lock,
  RotateCw,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  filterPolicies,
  flattenPolicies,
  notRequestedCount,
  parsePolicyUrlKey,
  policySeverity,
  policyUrlKey,
  sortPolicies,
} from '../domain/policyOverview';
import { formatDateTime, formatRelativeTime } from '../domain/format';
import type {
  SectionResult,
  Severity,
  TenantPolicyInfo,
  TenantPolicyKind,
  TenantPolicyList,
} from '../domain/types';
import { useTenantPolicies } from '../hooks/useTenantPolicies';
import { de } from '../i18n/de';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import type { AmbientTone } from '../ui/AmbientGlow';
import { ErrorState } from '../ui/ErrorState';
import { fade, spring, STAGGER } from '../ui/motion';
import { SeverityBadge, SeverityIcon } from '../ui/SeverityBadge';
import { TONE_CLASS } from '../ui/tone';
import { PolicyDetailView } from './PolicyDetailView';

const t = de.policies;

interface Props {
  provider: DeviceDataProvider;
  /** Aus der URL: ?policy=<kind>:<id> */
  openPolicyKey: string | null;
  onOpenPolicy: (key: string) => void;
  onClosePolicy: () => void;
  onBack: () => void;
  /** Gerät über die normale Suche öffnen (der Gerätestatus kennt keine dokumentierte Geräte-ID) */
  onOpenDeviceByName: (deviceName: string) => void;
  onToneChange?: (tone: AmbientTone) => void;
}

const BACK_BUTTON =
  '-ml-1 inline-flex items-center gap-0.5 rounded-full py-1 pr-2 pl-1 text-sm font-medium text-accent outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]';
const REFRESH_BUTTON =
  'inline-flex items-center gap-1.5 self-start rounded-full bg-fill px-3 py-1.5 text-sm font-medium text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 sm:self-end';

export function PoliciesView({
  provider,
  openPolicyKey,
  onOpenPolicy,
  onClosePolicy,
  onBack,
  onOpenDeviceByName,
  onToneChange,
}: Props) {
  const { state, reload } = useTenantPolicies(provider);
  const [query, setQuery] = useState('');
  const reduced = useReducedMotion();

  const all = useMemo(
    () => (state.status === 'done' ? sortPolicies(flattenPolicies(state.data)) : []),
    [state],
  );
  const shown = useMemo(() => filterPolicies(all, query), [all, query]);
  const problemCount = all.filter((policy) => policySeverity(policy) === 'critical').length;

  const openKey = parsePolicyUrlKey(openPolicyKey);
  const openPolicy = openKey
    ? all.find((policy) => policy.kind === openKey.kind && policy.id === openKey.id)
    : undefined;

  const listTone: AmbientTone =
    state.status !== 'done'
      ? 'accent'
      : problemCount > 0
        ? 'critical'
        : all.some((policy) => policySeverity(policy) === 'warning')
          ? 'warning'
          : 'ok';
  const [detailTone, setDetailTone] = useState<AmbientTone>('accent');
  const tone = openKey ? detailTone : listTone;
  useEffect(() => {
    onToneChange?.(tone);
  }, [tone, onToneChange]);

  useEffect(() => {
    const previous = document.title;
    document.title = `${openPolicy ? openPolicy.displayName : t.title} – ${de.app.name}`;
    return () => {
      document.title = previous;
    };
  }, [openPolicy]);

  // Fokus kehrt zur Zeile zurück, sobald der Gerätestatus geschlossen wird.
  const previousKey = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousKey.current;
    previousKey.current = openPolicyKey;
    if (previous && !openPolicyKey) {
      document.querySelector<HTMLElement>(`[data-policy-key="${CSS.escape(previous)}"]`)?.focus();
    }
  }, [openPolicyKey]);

  if (state.status === 'error') {
    return <ErrorState error={state.error} onRetry={reload} />;
  }

  const transition = reduced ? fade : spring;
  const loading = state.status === 'loading';

  if (openKey) {
    return (
      <motion.div
        key={policyUrlKey(openKey)}
        initial={reduced ? { opacity: 0 } : { opacity: 0, x: 16 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
        transition={transition}
      >
        <PolicyDetailView
          provider={provider}
          policyKey={openKey}
          policy={openPolicy ?? null}
          listLoading={loading}
          onBack={onClosePolicy}
          onOpenDeviceByName={onOpenDeviceByName}
          onToneChange={setDetailTone}
        />
      </motion.div>
    );
  }

  const data = state.status === 'done' ? state.data : null;
  const skipped = notRequestedCount(all);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <button type="button" onClick={onBack} className={BACK_BUTTON}>
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
              <ListChecks size={30} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h1 className="display-type break-words text-3xl font-semibold text-label sm:text-display">
                {t.title}
              </h1>
              <p className="mt-1.5 text-sm text-secondary-label">{t.subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={reload} disabled={loading} className={REFRESH_BUTTON}>
            <RotateCw aria-hidden="true" size={15} className={loading ? 'animate-spin' : ''} />
            {t.refresh}
          </button>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {loading ? t.a11y.loading : t.a11y.done(all.length, problemCount)}
        </p>
      </div>

      {data && (
        <div className="flex flex-col gap-3">
          <ListNotice kind="configuration" list={data.configurations} onRetry={reload} />
          <ListNotice kind="compliance" list={data.compliancePolicies} onRetry={reload} />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-sm">
          <span className="sr-only">{t.filterLabel}</span>
          <Search
            aria-hidden="true"
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-secondary-label"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.filterPlaceholder}
            disabled={loading}
            className="h-10 w-full rounded-full bg-control pr-4 pl-9 text-base text-label outline-none placeholder:text-secondary-label focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 sm:text-sm"
          />
        </label>
        {!loading && (
          <p role="status" aria-live="polite" className="text-sm tabular-nums text-secondary-label">
            {t.count(shown.length, all.length)}
          </p>
        )}
      </div>

      {loading ? (
        <ul aria-busy="true" aria-label={t.listLabel} className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((n) => (
            <li
              key={n}
              data-policy-skeleton
              className="material-card hc-edge flex items-center gap-3 rounded-2xl p-4"
            >
              <span aria-hidden="true" className="skeleton size-9 rounded-xl" />
              <span className="flex flex-1 flex-col gap-2">
                <span className="skeleton h-4 w-1/2 rounded-md" />
                <span className="skeleton h-3 w-1/3 rounded-md" />
              </span>
            </li>
          ))}
        </ul>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl bg-fill p-4 text-sm text-secondary-label">
          {all.length > 0 && query.trim() ? t.emptyFilter(query.trim()) : t.empty}
        </p>
      ) : (
        <ul aria-label={t.listLabel} className="flex flex-col gap-2">
          {shown.map((policy, index) => (
            <motion.li
              key={policyUrlKey(policy)}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ ...transition, delay: Math.min(index, 12) * STAGGER }}
            >
              <PolicyRow
                policy={policy}
                now={state.status === 'done' ? state.now : new Date()}
                onOpen={() => onOpenPolicy(policyUrlKey(policy))}
              />
            </motion.li>
          ))}
        </ul>
      )}

      {data && (
        <div className="flex flex-col gap-3 text-sm text-secondary-label">
          {skipped > 0 && (
            <Note icon={<Info aria-hidden="true" size={16} />}>
              {t.notes.notRequested(data.overviewLimit, skipped)}
            </Note>
          )}
          <Note icon={<Info aria-hidden="true" size={16} />}>{t.notes.counts}</Note>
          <Note icon={<TriangleAlert aria-hidden="true" size={16} className="text-warning" />}>
            <span className="font-medium text-label">{t.notes.betaTitle}:</span> {t.notes.beta}
          </Note>
        </div>
      )}
    </div>
  );
}

function Note({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-fill p-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  );
}

/** Hinweis je Liste: fehlende Berechtigung, Fehler, nicht verfügbar oder unvollständig gelesen. */
function ListNotice({
  kind,
  list,
  onRetry,
}: {
  kind: TenantPolicyKind;
  list: SectionResult<TenantPolicyList>;
  onRetry: () => void;
}) {
  const name = t.listName[kind];
  if (list.status === 'ok') {
    return list.data.truncated ? (
      <Note icon={<Info aria-hidden="true" size={16} />}>{t.notes.listTruncated(name)}</Note>
    ) : null;
  }
  if (list.status === 'forbidden') {
    return (
      <div
        role="alert"
        data-testid={`policies-${kind}-forbidden`}
        className="material-card hc-edge flex items-start gap-3 rounded-2xl p-4 text-sm"
      >
        <Lock aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-critical" />
        <div className="min-w-0">
          <p className="font-medium text-label">{t.listForbidden(name)}</p>
          <p className="mt-1 text-secondary-label">{list.error.message}</p>
          {list.error.requiredScope && (
            <p className="mt-1 text-secondary-label">
              {t.requiredScope}:{' '}
              <code className="break-all font-mono text-xs">{list.error.requiredScope}</code>
            </p>
          )}
        </div>
      </div>
    );
  }
  if (list.status === 'error') {
    return (
      <div
        role="alert"
        className="material-card hc-edge flex flex-wrap items-start gap-3 rounded-2xl p-4 text-sm"
      >
        <TriangleAlert aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-critical" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-label">{t.listError(name)}</p>
          <p className="mt-1 text-secondary-label">{list.error.message}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full bg-fill px-3 py-1.5 font-medium text-label outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
        >
          <RotateCw aria-hidden="true" size={14} />
          {t.retry}
        </button>
      </div>
    );
  }
  return (
    <Note icon={<Info aria-hidden="true" size={16} />}>
      {t.listUnavailable(name)} – {list.reason}
    </Note>
  );
}

const CHIP_TINT: Record<Severity, string> = {
  critical: 'bg-critical/12',
  warning: 'bg-warning/12',
  ok: 'bg-fill',
  unknown: 'bg-fill',
};

function CountChip({ severity, label }: { severity: Severity; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums text-label ${CHIP_TINT[severity]}`}
    >
      <SeverityIcon severity={severity} size={13} />
      {label}
    </span>
  );
}

/** Zähler einer Richtlinie als Chips (Zahl + Text, nie nur Farbe) bzw. der Grund, warum keine da sind. */
function PolicyCounts({ policy }: { policy: TenantPolicyInfo }) {
  const overview = policy.overview;
  if (overview === null)
    return <SeverityBadge severity="unknown" label={t.overview.notRequested} />;
  if (overview.status === 'forbidden') {
    return <SeverityBadge severity="unknown" label={t.overview.forbidden} />;
  }
  if (overview.status === 'error')
    return <SeverityBadge severity="unknown" label={t.overview.error} />;
  if (overview.status !== 'ok') {
    return <SeverityBadge severity="unknown" label={t.overview.unavailable} />;
  }
  const { errorCount, failedCount, pendingCount, successCount } = overview.data;
  const chips: ReactNode[] = [];
  if (errorCount)
    chips.push(<CountChip key="e" severity="critical" label={t.countChip.error(errorCount)} />);
  if (failedCount) {
    chips.push(<CountChip key="f" severity="critical" label={t.countChip.failed(failedCount)} />);
  }
  if (pendingCount) {
    chips.push(<CountChip key="p" severity="warning" label={t.countChip.pending(pendingCount)} />);
  }
  if (successCount) {
    chips.push(<CountChip key="s" severity="ok" label={t.countChip.success(successCount)} />);
  }
  if (chips.length === 0)
    return <span className="text-xs text-secondary-label">{t.noDevices}</span>;
  return <>{chips}</>;
}

function PolicyRow({
  policy,
  now,
  onOpen,
}: {
  policy: TenantPolicyInfo;
  now: Date;
  onOpen: () => void;
}) {
  const severity = policySeverity(policy);
  const platform = policy.platform ? t.platform[policy.platform] : t.platformUnknown;
  return (
    <button
      type="button"
      onClick={onOpen}
      data-policy-key={policyUrlKey(policy)}
      data-severity={severity}
      data-testid="policy-row"
      title={t.openPolicy}
      className="tile material-card hc-edge flex w-full items-center gap-3 rounded-2xl p-4 text-left outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.99]"
    >
      <span aria-hidden="true" className={`squircle size-9 shrink-0 ${TONE_CLASS[severity]}`}>
        <SeverityIcon severity={severity} size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
        <span className="min-w-0 flex-1">
          <span className="block break-words font-medium text-label">{policy.displayName}</span>
          <span className="mt-0.5 block text-xs text-secondary-label">
            {t.kind[policy.kind]} · {platform}
            {policy.lastModifiedDateTime && (
              <>
                {' · '}
                <span title={formatDateTime(policy.lastModifiedDateTime)}>
                  {t.modified(formatRelativeTime(policy.lastModifiedDateTime, now))}
                </span>
              </>
            )}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          <PolicyCounts policy={policy} />
        </span>
      </span>
      <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-tertiary-label" />
    </button>
  );
}
