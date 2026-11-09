/**
 * Welche Richtlinien/Apps eines Geräts werden auf ihre Zuweisungen geprüft (M14/S2)? Es zählen nur
 * Objekte, die bereits in den Gerätezuständen erscheinen. Auffällige Objekte (Fehler, Konflikt, nicht
 * konform, fehlgeschlagene oder fehlende Apps) kommen zuerst, damit sie bei der Obergrenze nicht
 * herausfallen.
 */
import type { AssignmentLookup, DeviceSnapshot } from './types';

const PROBLEM_POLICY_STATES = new Set(['error', 'conflict', 'nonCompliant']);
const KIND_ORDER: Record<AssignmentLookup['kind'], number> = {
  compliance: 0,
  configuration: 1,
  app: 2,
};

export function assignmentLookups(
  snapshot: Partial<
    Pick<DeviceSnapshot, 'compliancePolicies' | 'configurationPolicies' | 'appInstallStates'>
  >,
): AssignmentLookup[] {
  const candidates: Array<AssignmentLookup & { tier: number }> = [];
  for (const section of [snapshot.compliancePolicies, snapshot.configurationPolicies]) {
    if (section?.status !== 'ok') continue;
    for (const policy of section.data) {
      candidates.push({
        kind: policy.kind,
        id: policy.id,
        displayName: policy.displayName,
        tier: PROBLEM_POLICY_STATES.has(policy.state) ? 0 : 1,
      });
    }
  }
  if (snapshot.appInstallStates?.status === 'ok') {
    for (const app of snapshot.appInstallStates.data) {
      const required =
        app.intent === 'requiredInstall' || app.intent === 'requiredAndAvailableInstall';
      const problem =
        app.installState === 'failed' ||
        app.installState === 'uninstallFailed' ||
        app.installState === 'pendingInstall' ||
        (required && app.installState === 'notInstalled');
      candidates.push({
        kind: 'app',
        id: app.appId,
        displayName: app.displayName,
        tier: problem ? 0 : 1,
      });
    }
  }
  const seen = new Set<string>();
  return candidates
    .filter((c) => {
      const id = c.id.trim();
      const key = `${c.kind === 'app' ? 'app' : c.kind}:${id.toLowerCase()}`;
      if (!id || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.tier - b.tier || KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
    .map(({ kind, id, displayName }) => ({ kind, id: id.trim(), displayName }));
}
