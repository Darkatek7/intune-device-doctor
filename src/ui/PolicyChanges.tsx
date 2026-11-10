/**
 * „Änderungen an dieser Richtlinie“ (M20/S2) im Richtlinien-Detail: Einträge des Intune-
 * Überwachungsprotokolls, deren Ressourcen-ID der Richtlinie entspricht. Liegt eine Änderung kurz vor
 * gemeldeten Problemen, erscheint ein ruhiger Hinweis – ausdrücklich ohne Kausalität.
 * Daten kommen ausschließlich über useAuditEvents (Provider-Schnittstelle).
 */
import { History, Info, Lock } from 'lucide-react';
import { useMemo } from 'react';
import { formatDateTime } from '../domain/format';
import type { PolicyDeviceStatusEntry } from '../domain/types';
import { useAuditEvents } from '../hooks/useTenantPolicies';
import { de } from '../i18n/de';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import {
  AUDIT_COLUMNS,
  auditCellLang,
  auditRows,
  changeBeforeProblems,
  changesForResource,
} from '../rules/fleet';
import { THRESHOLDS } from '../rules/thresholds';

const a = de.fleet.audit;

interface Props {
  provider: DeviceDataProvider;
  policyId: string;
  title: string;
  /** Gerätestatus mit Problem (Fehler, Konflikt, nicht konform …) */
  problems: PolicyDeviceStatusEntry[];
}

export function PolicyChanges({ provider, policyId, title, problems }: Props) {
  const { state } = useAuditEvents(provider);
  const section = state.status === 'done' ? state.data : null;
  const changes = useMemo(
    () => (section?.status === 'ok' ? changesForResource(section.data, policyId) : []),
    [section, policyId],
  );
  const hint = useMemo(() => changeBeforeProblems(changes, problems), [changes, problems]);

  return (
    <section
      aria-labelledby="policy-changes-heading"
      data-testid="policy-changes"
      className="flex flex-col gap-3"
    >
      <h2
        id="policy-changes-heading"
        className="inline-flex items-center gap-2 text-lg font-semibold text-label"
      >
        <History aria-hidden="true" size={18} className="text-secondary-label" />
        {a.policyTitle}
      </h2>

      {state.status === 'loading' && (
        <p className="text-sm text-secondary-label" aria-busy="true">
          {a.policyLoading}
        </p>
      )}
      {state.status === 'error' && (
        <p className="rounded-2xl bg-fill p-3 text-sm text-secondary-label">
          {a.policyUnavailable(state.error.message)}
        </p>
      )}
      {section?.status === 'forbidden' && (
        <p className="flex items-start gap-2 rounded-2xl bg-fill p-3 text-sm text-secondary-label">
          <Lock aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          <span>
            {a.policyForbidden(section.error.requiredScope ?? de.rules.common.unknownScope)}
          </span>
        </p>
      )}
      {(section?.status === 'unavailable' ||
        section?.status === 'notApplicable' ||
        section?.status === 'error') && (
        <p className="rounded-2xl bg-fill p-3 text-sm text-secondary-label">
          {a.policyUnavailable(section.status === 'error' ? section.error.message : section.reason)}
        </p>
      )}

      {section?.status === 'ok' && hint && (
        <p
          data-testid="policy-change-hint"
          className="flex items-start gap-2 rounded-2xl bg-fill p-3 text-sm text-label"
        >
          <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-secondary-label" />
          <span>
            {a.changedBeforeProblems(
              hint.change.activityDateTime
                ? formatDateTime(hint.change.activityDateTime)
                : a.noValue,
              hint.change.activity ?? a.noValue,
              hint.devices,
            )}{' '}
            <span className="text-secondary-label">
              {a.changedBeforeProblemsNote(THRESHOLDS.auditChangeBeforeErrorDays)}
            </span>
          </span>
        </p>
      )}

      {section?.status === 'ok' &&
        (changes.length === 0 ? (
          <p className="rounded-2xl bg-fill p-4 text-sm text-secondary-label">{a.policyNone}</p>
        ) : (
          <div
            role="region"
            aria-label={a.policyTableLabel(title)}
            tabIndex={0}
            className="overflow-x-auto rounded-tile material-card hc-edge outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
              <caption className="sr-only">{a.policyTableLabel(title)}</caption>
              <thead>
                <tr className="border-b border-separator text-xs text-secondary-label">
                  {AUDIT_COLUMNS.map((column) => (
                    <th key={column} scope="col" className="px-4 py-2.5 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-separator">
                {auditRows(changes).map((cells, index) => (
                  <tr key={changes[index]!.id} data-testid="policy-change-row">
                    {cells.map((value, column) => (
                      <td
                        key={column}
                        lang={auditCellLang(value, column) ?? undefined}
                        className="px-4 py-2.5 break-words text-label"
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {section?.status === 'ok' && (
        <p className="px-1 text-xs text-secondary-label">
          {a.policyMatchNote}
          {section.data.truncated ? ` ${a.truncatedTitle(section.data.pagesRead)}.` : ''}
        </p>
      )}
    </section>
  );
}
