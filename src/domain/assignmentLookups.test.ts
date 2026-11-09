import { describe, expect, it } from 'vitest';
import { MockProvider } from '../providers/mock/MockProvider';
import { loadFullSnapshot } from '../test/snapshot';
import { assignmentLookups } from './assignmentLookups';

const NOW = new Date('2026-10-15T12:00:00Z');

describe('assignmentLookups', () => {
  it('nimmt nur Objekte aus den Gerätezuständen; auffällige zuerst, danach Compliance → Profil → App', async () => {
    const snapshot = await loadFullSnapshot(
      new MockProvider({ latency: false, now: () => NOW }),
      'CONTOSO-PC042',
    );
    const lookups = assignmentLookups(snapshot);
    const names = lookups.map((l) => l.displayName);
    // Problemfälle zuerst: nonCompliant, conflict, error, fehlgeschlagene App, „verfügbar“-App ist unauffällig
    expect(names.slice(0, 4)).toEqual([
      'Contoso – Windows 11 Basis-Compliance',
      'Contoso – Edge Sicherheitsbaseline',
      'Contoso – VPN Always On',
      'Contoso VPN Client 5.1',
    ]);
    expect(new Set(lookups.map((l) => l.kind))).toEqual(
      new Set(['compliance', 'configuration', 'app']),
    );
    expect(lookups.every((l) => l.id.length > 0)).toBe(true);
  });

  it('ignoriert nicht geladene und nicht erfolgreiche Sections und entfernt doppelte IDs', async () => {
    const snapshot = await loadFullSnapshot(
      new MockProvider({ latency: false, now: () => NOW }),
      'CONTOSO-PC001',
    );
    expect(assignmentLookups({})).toEqual([]);
    const forbidden = {
      ...snapshot,
      compliancePolicies: undefined,
      configurationPolicies: snapshot.configurationPolicies,
    };
    const lookups = assignmentLookups(forbidden);
    expect(lookups.some((l) => l.kind === 'compliance')).toBe(false);
    const doubled = assignmentLookups({
      configurationPolicies: snapshot.configurationPolicies,
      compliancePolicies: undefined,
    });
    const again = assignmentLookups({
      configurationPolicies:
        snapshot.configurationPolicies?.status === 'ok'
          ? {
              ...snapshot.configurationPolicies,
              data: [
                ...snapshot.configurationPolicies.data,
                ...snapshot.configurationPolicies.data,
              ],
            }
          : undefined,
    });
    expect(again).toEqual(doubled);
  });
});
