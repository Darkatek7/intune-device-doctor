/**
 * Demo-Daten der Ansicht „Richtlinien“ (M15) – abgeleitet aus den Demo-Geräten, damit beide Sichten
 * zusammenpassen: Jede Richtlinie, die ein Szenario in seinen Richtlinienzuständen meldet, erscheint hier
 * mit genau diesen Geräten (z. B. „Contoso – Edge Sicherheitsbaseline“ mit Konflikt auf CONTOSO-PC042).
 * Szenarien ohne lesbare Richtlinien (z. B. fehlende Berechtigung) tragen nichts bei.
 *
 * Die Zähler (deviceStatusOverview) sind Demo-Werte aus diesen Gerätestatus. Wie Intune die Status auf
 * die Zähler verteilt, beschreibt die Doku nicht; die Demo ordnet so zu: compliant/remediated →
 * erfolgreich, error → Fehler, nonCompliant/conflict → fehlgeschlagen, unknown → ausstehend,
 * notApplicable/notAssigned → nicht anwendbar.
 */
import type {
  OsFamily,
  PolicyDeviceOverview,
  PolicyDeviceStatusEntry,
  PolicyStateInfo,
  TenantPolicyInfo,
  TenantPolicyKind,
} from '../../domain/types';
import type { PolicyPlatformType } from '../../graph/dto';
import { ago, demoGuid } from './scenarios/helpers';
import type { MockDeviceFixture } from './types';

export interface MockPolicyData {
  policy: Omit<TenantPolicyInfo, 'overview'>;
  overview: PolicyDeviceOverview;
  statuses: PolicyDeviceStatusEntry[];
}

const PLATFORM: Record<PolicyPlatformType, OsFamily | null> = {
  android: 'android',
  androidForWork: 'android',
  iOS: 'ios',
  macOS: 'macos',
  windowsPhone81: null,
  windows81AndLater: 'windows',
  windows10AndLater: 'windows',
  all: null,
};

/** Kürzlich geänderte Richtlinien (Rollout-Fall): Tage seit der letzten Änderung, sonst 30 + n. */
const MODIFIED_DAYS_AGO: Record<string, number> = {
  [demoGuid('policy', 23)]: 1,
  [demoGuid('policy', 21)]: 2,
  [demoGuid('policy', 1)]: 4,
};

/** Richtlinie ohne gemeldete Geräte (z. B. noch keiner Gruppe zugewiesen) – zeigt den leeren Zustand. */
const UNUSED_POLICY = {
  id: demoGuid('policy', 90),
  kind: 'configuration' as const,
  displayName: 'Contoso – Windows Kiosk (Lager)',
  platform: 'windows' as const,
  version: 1,
};

type CountField =
  'pendingCount' | 'notApplicableCount' | 'successCount' | 'errorCount' | 'failedCount';

function bucket(state: PolicyStateInfo['state']): CountField {
  switch (state) {
    case 'compliant':
    case 'remediated':
      return 'successCount';
    case 'error':
      return 'errorCount';
    case 'nonCompliant':
    case 'conflict':
      return 'failedCount';
    case 'unknown':
      return 'pendingCount';
    case 'notApplicable':
    case 'notAssigned':
      return 'notApplicableCount';
  }
}

function policyNumber(id: string): number {
  return parseInt(id.slice(-4), 16) || 0;
}

function modifiedAt(now: Date, id: string): string {
  return ago(now, { days: MODIFIED_DAYS_AGO[id] ?? 30 + (policyNumber(id) % 40) });
}

export function policyKey(kind: TenantPolicyKind, id: string): string {
  return `${kind}:${id}`;
}

/** Alle Demo-Richtlinien mit Zählern und Gerätestatus, Schlüssel `kind:id`. */
export function buildMockPolicies(
  fixtures: MockDeviceFixture[],
  now: Date,
): Map<string, MockPolicyData> {
  const result = new Map<string, MockPolicyData>();
  const ensure = (state: PolicyStateInfo): MockPolicyData => {
    const key = policyKey(state.kind, state.id);
    let entry = result.get(key);
    if (!entry) {
      entry = {
        policy: {
          id: state.id,
          kind: state.kind,
          displayName: state.displayName,
          platform: state.platformType ? PLATFORM[state.platformType] : null,
          version: state.version,
          lastModifiedDateTime: modifiedAt(now, state.id),
        },
        overview: {
          pendingCount: 0,
          notApplicableCount: 0,
          successCount: 0,
          errorCount: 0,
          failedCount: 0,
          lastUpdateDateTime: null,
          configurationVersion: state.version,
        },
        statuses: [],
      };
      result.set(key, entry);
    }
    return entry;
  };

  for (const fixture of fixtures) {
    const { device } = fixture;
    for (const section of [fixture.compliancePolicies, fixture.configurationPolicies]) {
      if (section.status !== 'ok') continue;
      for (const state of section.data) {
        const entry = ensure(state);
        entry.statuses.push({
          id: `${state.id}_${device.id}`,
          deviceDisplayName: device.deviceName,
          userPrincipalName: device.userPrincipalName,
          userName: device.userDisplayName,
          deviceModel: device.model,
          status: state.state,
          lastReportedDateTime: device.lastSyncDateTime,
        });
        const field = bucket(state.state);
        entry.overview[field] = (entry.overview[field] ?? 0) + 1;
        const reported = device.lastSyncDateTime;
        if (
          reported &&
          (!entry.overview.lastUpdateDateTime ||
            Date.parse(reported) > Date.parse(entry.overview.lastUpdateDateTime))
        ) {
          entry.overview.lastUpdateDateTime = reported;
        }
      }
    }
  }

  result.set(policyKey(UNUSED_POLICY.kind, UNUSED_POLICY.id), {
    policy: { ...UNUSED_POLICY, lastModifiedDateTime: ago(now, { days: 12 }) },
    overview: {
      pendingCount: 0,
      notApplicableCount: 0,
      successCount: 0,
      errorCount: 0,
      failedCount: 0,
      lastUpdateDateTime: null,
      configurationVersion: 1,
    },
    statuses: [],
  });
  return result;
}
