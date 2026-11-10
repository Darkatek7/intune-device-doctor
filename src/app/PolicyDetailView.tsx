/**
 * Gerätestatus einer Richtlinie (M15, Unterseite der Ansicht „Richtlinien“): Tabelle Gerät, Benutzer,
 * Modell, Status, zuletzt gemeldet – standardmäßig nur Probleme. Der Gerätestatus trägt keine
 * dokumentierte managedDevice-ID, deshalb öffnet ein Klick auf den Namen die normale Gerätesuche.
 */
import { ChevronLeft, ExternalLink, Info, Lock, RotateCw, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { isProblemStatus, sortStatuses, statusSeverity } from '../domain/policyOverview';
import { formatDateTime, formatRelativeTime } from '../domain/format';
import type { TenantPolicyInfo, TenantPolicyKind } from '../domain/types';
import { usePolicyDeviceStatuses } from '../hooks/useTenantPolicies';
import { de } from '../i18n/de';
import { usePrivacy } from '../privacy/privacyContext';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import type { AmbientTone } from '../ui/AmbientGlow';
import { SeverityBadge, SeverityIcon } from '../ui/SeverityBadge';
import { TONE_CLASS } from '../ui/tone';

const t = de.policies;
const d = de.policies.detail;

const LINK_BUTTON =
  'rounded-md text-left font-semibold text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent';

interface Props {
  provider: DeviceDataProvider;
  policyKey: { kind: TenantPolicyKind; id: string };
  /** Eintrag aus der geladenen Liste; null = (noch) nicht in der Liste */
  policy: TenantPolicyInfo | null;
  listLoading: boolean;
  onBack: () => void;
  onOpenDeviceByName: (deviceName: string) => void;
  onToneChange?: (tone: AmbientTone) => void;
}

function Note({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-fill p-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  );
}

export function PolicyDetailView({
  provider,
  policyKey,
  policy,
  listLoading,
  onBack,
  onOpenDeviceByName,
  onToneChange,
}: Props) {
  const { enabled: privacyOn, masker } = usePrivacy();
  const { state, reload } = usePolicyDeviceStatuses(provider, policyKey);
  const [onlyProblems, setOnlyProblems] = useState(true);

  const section = state.status === 'done' ? state.data : null;
  const entries = useMemo(
    () => (section?.status === 'ok' ? sortStatuses(section.data.entries) : []),
    [section],
  );
  const problems = entries.filter((entry) => isProblemStatus(entry.status));
  const shown = onlyProblems ? problems : entries;

  const tone: AmbientTone =
    section?.status !== 'ok' ? 'accent' : problems.length > 0 ? 'critical' : 'ok';
  useEffect(() => {
    onToneChange?.(tone);
  }, [tone, onToneChange]);

  const loading = state.status === 'loading';
  const title = policy?.displayName ?? (listLoading ? t.title : masker.text(policyKey.id, null));
  const now = state.status === 'done' ? state.now : new Date();
  const source = section?.source;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 inline-flex items-center gap-0.5 rounded-full py-1 pr-2 pl-1 text-sm font-medium text-accent outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
          >
            <ChevronLeft aria-hidden="true" size={18} />
            {d.back}
          </button>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span
              aria-hidden="true"
              className={`squircle mt-1 size-14 shadow-[inset_0_1px_0_var(--c-highlight)] transition-colors duration-500 sm:size-16 ${TONE_CLASS[tone]}`}
            >
              <SeverityIcon severity={tone === 'accent' ? 'unknown' : tone} size={28} />
            </span>
            <div className="min-w-0">
              <h1 className="display-type break-words text-2xl font-semibold text-label sm:text-[2rem] sm:leading-tight">
                {title}
              </h1>
              <p className="mt-1.5 text-sm text-secondary-label">
                {t.kind[policyKey.kind]}
                {policy && (
                  <>
                    {' · '}
                    {policy.platform ? t.platform[policy.platform] : t.platformUnknown}
                    {policy.lastModifiedDateTime && (
                      <>
                        {' · '}
                        <span title={formatDateTime(policy.lastModifiedDateTime)}>
                          {t.modified(formatRelativeTime(policy.lastModifiedDateTime, now))}
                        </span>
                      </>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-fill px-3 py-1.5 text-sm font-medium text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 sm:self-end"
          >
            <RotateCw aria-hidden="true" size={15} className={loading ? 'animate-spin' : ''} />
            {t.refresh}
          </button>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {loading ? t.a11y.detailLoading : t.a11y.detailDone(shown.length, entries.length)}
        </p>
      </div>

      {!policy && !listLoading && (
        <Note icon={<Info aria-hidden="true" size={16} />}>
          <span className="font-medium text-label">{d.notFoundTitle}:</span> {d.notFoundBody}
        </Note>
      )}

      {state.status === 'error' && (
        <div
          role="alert"
          className="material-card hc-edge flex flex-wrap items-start gap-3 rounded-2xl p-4 text-sm"
        >
          <TriangleAlert aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-critical" />
          <p className="min-w-0 flex-1 text-label">{state.error.message}</p>
          <RetryButton onClick={reload} />
        </div>
      )}

      {section?.status === 'forbidden' && (
        <div
          role="alert"
          data-testid="policy-statuses-forbidden"
          className="material-card hc-edge flex items-start gap-3 rounded-2xl p-4 text-sm"
        >
          <Lock aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-critical" />
          <div className="min-w-0">
            <p className="font-medium text-label">{de.states.forbidden}</p>
            <p className="mt-1 text-secondary-label">{section.error.message}</p>
            {section.error.requiredScope && (
              <p className="mt-1 text-secondary-label">
                {t.requiredScope}:{' '}
                <code className="break-all font-mono text-xs">{section.error.requiredScope}</code>
              </p>
            )}
          </div>
        </div>
      )}

      {section?.status === 'error' && (
        <div
          role="alert"
          className="material-card hc-edge flex flex-wrap items-start gap-3 rounded-2xl p-4 text-sm"
        >
          <TriangleAlert aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-critical" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-label">{de.states.error}</p>
            <p className="mt-1 text-secondary-label">{section.error.message}</p>
          </div>
          <RetryButton onClick={reload} />
        </div>
      )}

      {(section?.status === 'unavailable' || section?.status === 'notApplicable') && (
        <Note icon={<Info aria-hidden="true" size={16} />}>
          <span className="font-medium text-label">{de.states.unavailable}:</span> {section.reason}
        </Note>
      )}

      {(loading || section?.status === 'ok') && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              role="group"
              aria-label={d.filterLabel}
              className="inline-flex rounded-full bg-control p-0.5"
            >
              {[
                { value: true, label: d.filterProblems },
                { value: false, label: d.filterAll },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={onlyProblems === option.value}
                  onClick={() => setOnlyProblems(option.value)}
                  className={`rounded-full px-3 py-1 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                    onlyProblems === option.value
                      ? 'bg-surface text-label shadow-sm'
                      : 'text-secondary-label'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {!loading && (
              <p className="text-sm tabular-nums text-secondary-label">
                {t.a11y.detailDone(shown.length, entries.length)}
              </p>
            )}
          </div>

          {loading ? (
            <div
              aria-busy="true"
              aria-label={t.a11y.detailLoading}
              role="group"
              className="material-card hc-edge flex flex-col gap-3 rounded-tile p-4"
            >
              {[0, 1, 2].map((n) => (
                <div key={n} className="skeleton h-5 w-full rounded-md" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="rounded-2xl bg-fill p-4 text-sm text-secondary-label">
              {onlyProblems && entries.length > 0 ? d.emptyProblems : d.empty}
            </p>
          ) : (
            <div
              role="region"
              aria-label={d.tableLabel(title)}
              tabIndex={0}
              className="overflow-x-auto rounded-tile material-card hc-edge outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                <caption className="sr-only">{d.tableLabel(title)}</caption>
                <thead>
                  <tr className="border-b border-separator text-xs text-secondary-label">
                    {(['device', 'user', 'model', 'status', 'lastReported'] as const).map((key) => (
                      <th key={key} scope="col" className="px-4 py-2.5 font-semibold">
                        {d.columns[key]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {shown.map((entry) => {
                    const deviceName =
                      entry.deviceDisplayName && privacyOn
                        ? masker.device(entry.deviceDisplayName)
                        : entry.deviceDisplayName;
                    const userText = privacyOn
                      ? entry.userPrincipalName
                        ? masker.upn(entry.userPrincipalName)
                        : entry.userName
                          ? masker.user(entry.userName)
                          : null
                      : (entry.userPrincipalName ?? entry.userName);
                    return (
                      <tr key={entry.id} data-testid="policy-status-row" data-status={entry.status}>
                        <th scope="row" className="px-4 py-2.5 font-semibold text-label">
                          {entry.deviceDisplayName ? (
                            <button
                              type="button"
                              onClick={() => onOpenDeviceByName(entry.deviceDisplayName!)}
                              title={d.openDevice}
                              className={LINK_BUTTON}
                            >
                              {deviceName}
                            </button>
                          ) : (
                            d.noValue
                          )}
                        </th>
                        <td className="px-4 py-2.5 break-all text-label">
                          {userText ?? d.noValue}
                        </td>
                        <td className="px-4 py-2.5 text-label">{entry.deviceModel ?? d.noValue}</td>
                        <td className="px-4 py-2.5">
                          <SeverityBadge
                            severity={statusSeverity(entry.status)}
                            label={t.status[entry.status]}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-label">
                          {entry.lastReportedDateTime ? (
                            <span
                              title={formatDateTime(entry.lastReportedDateTime)}
                              className="tabular-nums"
                            >
                              {formatRelativeTime(entry.lastReportedDateTime, now)}
                            </span>
                          ) : (
                            d.noValue
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 text-sm text-secondary-label">
        {section?.status === 'ok' && section.data.truncated && (
          <Note icon={<Info aria-hidden="true" size={16} />}>
            {d.truncated(section.data.pagesRead)}
          </Note>
        )}
        <Note icon={<Info aria-hidden="true" size={16} />}>
          {d.deviceHint} {d.platformNote}
        </Note>
        {policyKey.kind === 'configuration' && (
          <Note icon={<TriangleAlert aria-hidden="true" size={16} className="text-warning" />}>
            {d.deprecation}
          </Note>
        )}
        {source && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs">
            <span>{d.source}:</span>
            <code className="break-all font-mono">{source.label}</code>
            {source.docsUrl && (
              <a
                href={source.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
              >
                {d.docs}
                <ExternalLink aria-hidden="true" size={12} />
              </a>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full bg-fill px-3 py-1.5 font-medium text-label outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
    >
      <RotateCw aria-hidden="true" size={14} />
      {t.retry}
    </button>
  );
}
