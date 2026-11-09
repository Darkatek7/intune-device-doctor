/**
 * Anmeldungen (Entra-Anmeldeprotokoll, optionaler Scope AuditLog.Read.All):
 * Anmeldungen des primären Benutzers an diesem Gerät in den letzten Tagen.
 * - conditionalAccessStatus = failure → warning (App, Zeitpunkt, fehlgeschlagene Richtlinie(n), Fehlercode)
 * - Fehlercodes nur mit belegter Deutung (knowledge/entraSignInErrors.ts), sonst „Unbekannter Code“
 * - deviceDetail.isCompliant = false, obwohl Intune „konform“ meldet → Hinweis (kein Urteil)
 * - fehlt appliedConditionalAccessPolicies (kein Leserecht auf CA-Daten): „Richtliniendetails nicht sichtbar“
 * Keine Anmeldungen des Geräts → neutral mit Hinweis auf die Grenzen der Datenquelle.
 */
import { formatDateTime, formatRelativeTime } from '../../domain/format';
import type { DeviceSnapshot, Finding, SignInEntry, Tile, TileFact } from '../../domain/types';
import { de } from '../../i18n/de';
import {
  availabilityOf,
  loadingTile,
  sectionsLoaded,
  sortFindings,
  unavailableTile,
  worstActionable,
} from '../helpers';
import { Docs } from '../knowledge/docs';
import { POLICY_REMEDIATION, findEntraSignInError } from '../knowledge/entraSignInErrors';

const t = de.rules.signIns;

interface FailureGroup {
  app: string;
  entries: SignInEntry[];
}

/** Fehlgeschlagene Richtlinien eines Eintrags; null = Details nicht sichtbar. */
function failedPolicyNames(entry: SignInEntry): string[] | null {
  if (entry.appliedPolicies === null) return null;
  return entry.appliedPolicies
    .filter((policy) => policy.result === 'failure')
    .map((policy) => policy.displayName ?? policy.id ?? '–');
}

function groupKey(entry: SignInEntry): string {
  const policies = failedPolicyNames(entry);
  return `${entry.appDisplayName ?? ''}|${policies === null ? 'hidden' : policies.slice().sort().join(',')}`;
}

export function evaluateSignIns(snapshot: DeviceSnapshot, now: Date): Tile {
  const sections: Tile['sections'] = ['signIns'];
  if (!sectionsLoaded(snapshot, sections)) return loadingTile('signIns', sections);
  const section = snapshot.signIns!;
  if (section.status !== 'ok') return unavailableTile('signIns', sections, section);

  const { data } = section;
  const entries = data.entries;
  const failures = entries.filter((entry) => entry.conditionalAccessStatus === 'failure');
  const findings: Finding[] = [];
  const base = { source: section.source, docsUrl: Docs.signInList };

  // Fehlgeschlagene Conditional-Access-Auswertungen, nach App + Richtlinien gruppiert (neueste zuerst)
  const groups = new Map<string, FailureGroup>();
  for (const entry of failures) {
    const key = groupKey(entry);
    const group = groups.get(key) ?? { app: entry.appDisplayName ?? '–', entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  }
  let anyHidden = false;
  [...groups.values()].slice(0, 3).forEach((group, index) => {
    const latest = group.entries[0]!;
    const policies = failedPolicyNames(latest);
    if (policies === null) anyHidden = true;
    const known = findEntraSignInError(latest.errorCode);
    const detail: string[] = [
      t.failureDetail({
        when: formatDateTime(latest.createdDateTime),
        resource: latest.resourceDisplayName,
        app: group.app,
        client: latest.clientAppUsed,
      }),
    ];
    detail.push(
      policies === null
        ? t.policiesHiddenShort
        : policies.length > 0
          ? t.failedPolicies(policies.join(', '))
          : t.failedPoliciesNone,
    );
    if (latest.errorCode !== null && latest.errorCode !== 0) {
      detail.push(
        known
          ? t.errorLine(latest.errorCode, known.name, latest.failureReason)
          : `${t.unknownCode(latest.errorCode)}${latest.failureReason ? ` ${latest.failureReason}` : ''}`,
      );
    }
    findings.push({
      id: `signIns-failure-${index + 1}`,
      severity: 'warning',
      title: t.failureTitle(group.app, group.entries.length),
      detail: detail.join(' '),
      cause: known ? known.cause : t.failureCause,
      remediation: known ? [...known.remediation] : [...POLICY_REMEDIATION],
      evidence: {
        createdDateTime: latest.createdDateTime,
        app: group.app,
        resource: latest.resourceDisplayName,
        clientAppUsed: latest.clientAppUsed,
        isInteractive: latest.isInteractive,
        conditionalAccessStatus: latest.conditionalAccessStatus,
        errorCode: latest.errorCode,
        failedPolicies: policies === null ? null : policies.join(', '),
        correlationId: latest.correlationId,
        occurrences: group.entries.length,
      },
      source: section.source,
      docsUrl: known?.docsUrl ?? Docs.conditionalAccessTroubleshoot,
    });
  });

  if (anyHidden) {
    findings.push({
      ...base,
      id: 'signIns-policyDetailsHidden',
      severity: 'unknown',
      title: t.hiddenTitle,
      detail: t.hiddenDetail,
      cause: t.hiddenCause,
      remediation: [...t.hiddenRemediation],
      docsUrl: Docs.signInList,
    });
  }

  // Intune sagt „konform“, der Anmeldeeintrag erfasste das Gerät als nicht konform
  const mismatch =
    snapshot.device.complianceState === 'compliant'
      ? entries.find((entry) => entry.deviceIsCompliant === false)
      : undefined;
  if (mismatch) {
    findings.push({
      ...base,
      id: 'signIns-complianceMismatch',
      severity: 'unknown',
      title: t.mismatchTitle,
      detail: t.mismatchDetail(formatDateTime(mismatch.createdDateTime)),
      cause: t.mismatchCause,
      remediation: [...t.mismatchRemediation],
      evidence: {
        createdDateTime: mismatch.createdDateTime,
        deviceDetailIsCompliant: false,
        intuneComplianceState: snapshot.device.complianceState,
        correlationId: mismatch.correlationId,
      },
      docsUrl: Docs.conditionalAccessTroubleshoot,
    });
  }

  if (entries.length === 0) {
    findings.push({
      ...base,
      id: 'signIns-none',
      severity: 'unknown',
      title: t.noneTitle,
      detail: t.noneDetail(data.windowDays, data.totalForUser, data.moreAvailable),
      cause: t.noneCause,
      remediation: [...t.noneRemediation],
      evidence: {
        windowDays: data.windowDays,
        evaluatedUserSignIns: data.totalForUser,
        moreAvailable: data.moreAvailable,
      },
    });
  }

  const policyDetailsHidden = entries.some((entry) => entry.appliedPolicies === null);
  const latest = entries[0];
  const facts: TileFact[] = [
    { label: t.facts.deviceCount(data.windowDays), value: String(entries.length) },
    { label: t.facts.failures, value: String(failures.length) },
  ];
  if (latest?.createdDateTime) {
    facts.push({
      label: t.facts.last,
      value: formatRelativeTime(latest.createdDateTime, now),
      title: formatDateTime(latest.createdDateTime),
    });
  }
  facts.push({
    label: t.facts.userCount,
    value: data.moreAvailable
      ? t.facts.userCountMore(data.totalForUser)
      : String(data.totalForUser),
  });
  if (entries.length > 0) {
    facts.push({
      label: t.facts.policyDetails,
      value: policyDetailsHidden ? t.facts.policyHidden : t.facts.policyVisible,
    });
  }

  const severity = worstActionable(findings, 'ok');
  return {
    id: 'signIns',
    title: de.tiles.signIns,
    state: 'ready',
    severity,
    value:
      failures.length > 0
        ? t.valueFailures(failures.length)
        : entries.length > 0
          ? t.valueOk
          : t.valueNone,
    summary:
      entries.length > 0
        ? t.summary(entries.length, data.windowDays)
        : t.summaryNone(data.windowDays),
    findings: sortFindings(findings),
    sources: [section.source],
    facts,
    availability: availabilityOf(section),
    sections,
  };
}
