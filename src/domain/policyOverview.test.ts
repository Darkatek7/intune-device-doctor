import { describe, expect, it } from 'vitest';
import {
  filterPolicies,
  isProblemStatus,
  parsePolicyUrlKey,
  policySeverity,
  policyUrlKey,
  sortPolicies,
  sortStatuses,
  statusSeverity,
} from './policyOverview';
import type { PolicyDeviceOverview, PolicyDeviceStatusEntry, TenantPolicyInfo } from './types';

const SOURCE = { kind: 'mock' as const, label: 'GET …' };

function policy(
  name: string,
  counts: Partial<PolicyDeviceOverview> | null,
  overrides: Partial<TenantPolicyInfo> = {},
): TenantPolicyInfo {
  return {
    id: name,
    kind: 'configuration',
    displayName: name,
    platform: 'windows',
    version: 1,
    lastModifiedDateTime: null,
    overview: counts
      ? {
          status: 'ok',
          source: SOURCE,
          fetchedAt: '',
          data: {
            pendingCount: 0,
            notApplicableCount: 0,
            successCount: 0,
            errorCount: 0,
            failedCount: 0,
            lastUpdateDateTime: null,
            configurationVersion: 1,
            ...counts,
          },
        }
      : null,
    ...overrides,
  };
}

describe('policyOverview', () => {
  it('Bewertung: Fehler/fehlgeschlagen → critical, nur ausstehend → warning, ohne Zähler oder ohne Geräte → unknown', () => {
    expect(policySeverity(policy('a', { errorCount: 1 }))).toBe('critical');
    expect(policySeverity(policy('a', { failedCount: 2, successCount: 5 }))).toBe('critical');
    expect(policySeverity(policy('a', { pendingCount: 3, successCount: 5 }))).toBe('warning');
    expect(policySeverity(policy('a', { successCount: 5 }))).toBe('ok');
    expect(policySeverity(policy('a', {}))).toBe('unknown');
    expect(policySeverity(policy('a', null))).toBe('unknown');
    expect(
      policySeverity(
        policy('a', null, {
          overview: {
            status: 'forbidden',
            source: SOURCE,
            error: { code: 'forbidden', message: '' },
          },
        }),
      ),
    ).toBe('unknown');
  });

  it('sortiert nach Problemen: critical (meiste zuerst) → warning → unknown → ok, dann Name', () => {
    const sorted = sortPolicies([
      policy('OK B', { successCount: 3 }),
      policy('Ohne Zähler', null),
      policy('Wenig Fehler', { errorCount: 1 }),
      policy('Ausstehend', { pendingCount: 2 }),
      policy('OK A', { successCount: 3 }),
      policy('Viele Fehler', { errorCount: 2, failedCount: 3 }),
    ]).map((p) => p.displayName);
    expect(sorted).toEqual([
      'Viele Fehler',
      'Wenig Fehler',
      'Ausstehend',
      'Ohne Zähler',
      'OK A',
      'OK B',
    ]);
  });

  it('Namensfilter ohne Groß-/Kleinschreibung, leerer Filter = alle', () => {
    const list = [policy('Contoso – VPN Always On', null), policy('Contoso – WLAN', null)];
    expect(filterPolicies(list, ' vpn ').map((p) => p.displayName)).toEqual([
      'Contoso – VPN Always On',
    ]);
    expect(filterPolicies(list, '')).toHaveLength(2);
  });

  it('URL-Schlüssel kind:id hin und zurück; ungültige Werte → null', () => {
    const key = policyUrlKey({ kind: 'compliance', id: 'abc:1' });
    expect(key).toBe('compliance:abc:1');
    expect(parsePolicyUrlKey(key)).toEqual({ kind: 'compliance', id: 'abc:1' });
    expect(parsePolicyUrlKey('settingsCatalog:1')).toBeNull();
    expect(parsePolicyUrlKey(null)).toBeNull();
  });

  it('Gerätestatus: Fehler, Konflikt, nicht konform sind Probleme und stehen vorn', () => {
    expect(['error', 'conflict', 'nonCompliant'].every((s) => isProblemStatus(s as never))).toBe(
      true,
    );
    expect(isProblemStatus('compliant')).toBe(false);
    expect(statusSeverity('remediated')).toBe('ok');
    expect(statusSeverity('notApplicable')).toBe('unknown');
    const entry = (name: string, status: PolicyDeviceStatusEntry['status']) => ({
      id: name,
      deviceDisplayName: name,
      userPrincipalName: null,
      userName: null,
      deviceModel: null,
      status,
      lastReportedDateTime: null,
    });
    expect(
      sortStatuses([entry('B', 'compliant'), entry('C', 'conflict'), entry('A', 'compliant')]).map(
        (e) => e.deviceDisplayName,
      ),
    ).toEqual(['C', 'A', 'B']);
  });
});
