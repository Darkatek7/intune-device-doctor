/**
 * Reine Hilfen der Ansicht „Richtlinien“ (M15): Bewertung, Sortierung und Filter. Keine Deutung über die
 * Doku hinaus – die Zähler werden nur addiert und verglichen.
 */
import type { ComplianceStatus } from '../graph/dto';
import type {
  PolicyDeviceStatusEntry,
  Severity,
  TenantPolicies,
  TenantPolicyInfo,
  TenantPolicyKind,
} from './types';

/** Alle geladenen Richtlinien beider Listen. */
export function flattenPolicies(policies: TenantPolicies): TenantPolicyInfo[] {
  return [policies.configurations, policies.compliancePolicies].flatMap((list) =>
    list.status === 'ok' ? list.data.policies : [],
  );
}

/** Fehler + fehlgeschlagen laut Übersicht; null, wenn keine Zähler vorliegen. */
export function policyProblemCount(policy: TenantPolicyInfo): number | null {
  if (policy.overview?.status !== 'ok') return null;
  const { errorCount, failedCount } = policy.overview.data;
  if (errorCount === null && failedCount === null) return null;
  return (errorCount ?? 0) + (failedCount ?? 0);
}

function pendingCount(policy: TenantPolicyInfo): number {
  return policy.overview?.status === 'ok' ? (policy.overview.data.pendingCount ?? 0) : 0;
}

/** Problem (Fehler/fehlgeschlagen) → critical, nur ausstehend → warning, ohne Zähler → unknown. */
export function policySeverity(policy: TenantPolicyInfo): Severity {
  const problems = policyProblemCount(policy);
  if (problems === null) return 'unknown';
  if (problems > 0) return 'critical';
  if (pendingCount(policy) > 0) return 'warning';
  // Kein Gerät gemeldet (alle Zähler 0) → keine Aussage möglich
  return policy.overview?.status === 'ok' && (policy.overview.data.successCount ?? 0) > 0
    ? 'ok'
    : 'unknown';
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, unknown: 2, ok: 3 };

/** Sortiert nach Problemen: critical → warning → unknown → ok, innerhalb nach Anzahl, dann Name. */
export function sortPolicies(policies: readonly TenantPolicyInfo[]): TenantPolicyInfo[] {
  return [...policies].sort((a, b) => {
    const severity = SEVERITY_ORDER[policySeverity(a)] - SEVERITY_ORDER[policySeverity(b)];
    if (severity !== 0) return severity;
    const problems = (policyProblemCount(b) ?? 0) - (policyProblemCount(a) ?? 0);
    if (problems !== 0) return problems;
    const pending = pendingCount(b) - pendingCount(a);
    if (pending !== 0) return pending;
    return a.displayName.localeCompare(b.displayName, 'de');
  });
}

/** Namensfilter (Teilstring, ohne Groß-/Kleinschreibung). */
export function filterPolicies(
  policies: readonly TenantPolicyInfo[],
  query: string,
): TenantPolicyInfo[] {
  const q = query.trim().toLocaleLowerCase('de');
  if (!q) return [...policies];
  return policies.filter((policy) => policy.displayName.toLocaleLowerCase('de').includes(q));
}

/** Anzahl Richtlinien, deren Zähler nicht abgefragt wurden (Grenze). */
export function notRequestedCount(policies: readonly TenantPolicyInfo[]): number {
  return policies.filter((policy) => policy.overview === null).length;
}

/** URL-Schlüssel einer Richtlinie: `configuration:<id>` bzw. `compliance:<id>`. */
export function policyUrlKey(policy: { kind: TenantPolicyKind; id: string }): string {
  return `${policy.kind}:${policy.id}`;
}

export function parsePolicyUrlKey(
  value: string | null | undefined,
): { kind: TenantPolicyKind; id: string } | null {
  const match = /^(configuration|compliance):(.+)$/.exec(value ?? '');
  return match ? { kind: match[1] as TenantPolicyKind, id: match[2]! } : null;
}

const PROBLEM_STATUSES: ReadonlySet<ComplianceStatus> = new Set([
  'error',
  'conflict',
  'nonCompliant',
]);

/** Fehler, Konflikt und „nicht konform“ gelten als Problem. */
export function isProblemStatus(status: ComplianceStatus): boolean {
  return PROBLEM_STATUSES.has(status);
}

export function statusSeverity(status: ComplianceStatus): Severity {
  if (isProblemStatus(status)) return 'critical';
  if (status === 'compliant' || status === 'remediated') return 'ok';
  return 'unknown';
}

/** Probleme zuerst, dann nach Gerätename. */
export function sortStatuses(
  entries: readonly PolicyDeviceStatusEntry[],
): PolicyDeviceStatusEntry[] {
  return [...entries].sort((a, b) => {
    const order =
      SEVERITY_ORDER[statusSeverity(a.status)] - SEVERITY_ORDER[statusSeverity(b.status)];
    if (order !== 0) return order;
    return (a.deviceDisplayName ?? '').localeCompare(b.deviceDisplayName ?? '', 'de');
  });
}
