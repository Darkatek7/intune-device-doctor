/** M21/S1: Ansicht „Empfehlungen“ im GraphProvider (je Quelle ok/403/404/429, Seitengrenzen, nur GET, keine IDs). */
import { describe, expect, it, vi } from 'vitest';
import type { SectionResult } from '../../domain/types';
import type { SleepFn } from '../../graph/client';
import {
  MAX_BASELINE_COMPARISONS,
  MAX_COMPLIANCE_POLICY_DETAILS,
  MAX_LIST_PAGES,
} from '../../graph/endpoints';
import { dePosture } from '../../i18n/de-posture';
import { createGraphProvider } from './GraphProvider';
import {
  collection,
  createFakeFetch,
  graphError,
  jsonResponse,
  type FakeCall,
  type FakeHandler,
} from './fakeGraph';

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const GROUP_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const TENANT_ID = 'eeeeeeee-0000-4000-8000-000000000005';
const UPN = 'anna.schmidt@contoso.com';

type Route = (call: FakeCall) => Response | undefined;

function setup(routes: Route[] = []) {
  const handler: FakeHandler = (call) => {
    for (const route of routes) {
      const response = route(call);
      if (response) return response;
    }
    return contosoPostureHandler(call);
  };
  const fake = createFakeFetch(handler);
  const sleep = vi.fn<SleepFn>(async () => undefined);
  const provider = createGraphProvider(async () => 'token', {
    fetchImpl: fake.fetchImpl,
    sleep,
    log: vi.fn(),
    now: () => new Date('2026-11-25T12:00:00Z'),
  });
  return { ...fake, sleep, provider };
}

/** Antwortet auf pathname-Muster (v1.0 und beta) mit fiktiven Contoso-Daten. */
function on(pattern: RegExp, respond: (call: FakeCall) => Response): Route {
  return (call) =>
    pattern.test(decodeURIComponent(call.parsed.pathname)) ? respond(call) : undefined;
}

const win = (id: string, modified: string) => ({
  '@odata.type': '#microsoft.graph.windows10CompliancePolicy',
  id,
  displayName: `Contoso Windows ${id}`,
  lastModifiedDateTime: modified,
  bitLockerEnabled: true,
  passwordMinimumLength: 8,
  description: 'nie',
});

const baseline = (id: string, modified: string, templateId: string | null = 'tpl-1') => ({
  id,
  name: `Contoso Baseline ${id}`,
  platforms: 'windows10',
  technologies: 'mdm',
  lastModifiedDateTime: modified,
  isAssigned: true,
  templateReference: { templateId, templateFamily: 'baseline', templateDisplayVersion: 'v1' },
});

function contosoPostureHandler(call: FakeCall): Response {
  const path = decodeURIComponent(call.parsed.pathname);
  switch (path) {
    case '/v1.0/deviceManagement':
      return jsonResponse({
        settings: { secureByDefault: true, deviceComplianceCheckinThresholdDays: 30 },
      });
    case '/v1.0/deviceManagement/managedDeviceOverview':
      return jsonResponse({
        enrolledDeviceCount: 10,
        deviceOperatingSystemSummary: {
          windowsCount: 6,
          iosCount: 2,
          macOSCount: 1,
          androidCount: 1,
          androidWorkProfileCount: 1,
          androidFullyManagedCount: 0,
          androidCorporateWorkProfileCount: 0,
          androidDedicatedCount: 0,
        },
      });
    case '/v1.0/deviceManagement/deviceCompliancePolicies':
      return collection([
        win('w1', '2026-10-01T00:00:00Z'),
        { '@odata.type': '#microsoft.graph.iosCompliancePolicy', id: 'i1', passcodeRequired: true },
      ]);
    case '/v1.0/deviceAppManagement/iosManagedAppProtections':
      return collection([
        { id: 'mi', displayName: 'Contoso iOS MAM', isAssigned: true, pinRequired: true },
      ]);
    case '/v1.0/deviceAppManagement/androidManagedAppProtections':
      return collection([
        {
          id: 'ma',
          displayName: 'Contoso Android MAM',
          isAssigned: false,
          screenCaptureBlocked: true,
        },
      ]);
    case '/v1.0/identity/conditionalAccess/policies':
      return collection([
        {
          id: 'ca-1',
          displayName: 'Contoso: konformes Gerät',
          state: 'enabled',
          conditions: {
            users: { includeUsers: ['All'], excludeUsers: [USER_ID], excludeGroups: [GROUP_ID] },
            applications: { includeApplications: ['All'] },
            platforms: { includePlatforms: ['all'] },
          },
          grantControls: { operator: 'OR', builtInControls: ['compliantDevice'] },
        },
      ]);
    case '/v1.0/security/secureScores':
      return collection([
        {
          id: 'ss-1',
          azureTenantId: TENANT_ID,
          createdDateTime: '2026-11-24T00:00:00Z',
          currentScore: 100,
          maxScore: 200,
          controlScores: [
            {
              controlName: 'IntuneCompliance',
              controlCategory: 'Device',
              score: 3,
              description: '<p>Compliance</p>',
            },
          ],
        },
      ]);
    case '/v1.0/security/secureScoreControlProfiles':
      return collection([
        {
          id: 'IntuneCompliance',
          title: 'Enable compliance',
          service: 'Intune',
          maxScore: 10,
          remediation: 'Do <b>this</b>',
          controlStateUpdates: [{ updatedBy: UPN }],
          azureTenantId: TENANT_ID,
        },
      ]);
    case '/beta/deviceManagement/configurationPolicies':
      return collection([
        baseline('b1', '2026-10-05T00:00:00Z'),
        {
          id: 'c1',
          name: 'Contoso Katalog',
          lastModifiedDateTime: '2026-10-06T00:00:00Z',
          templateReference: { templateFamily: 'none' },
        },
      ]);
    case '/beta/deviceManagement/configurationPolicyTemplates':
      return collection([
        {
          id: 'tpl-1',
          baseId: 'base',
          displayName: 'Windows baseline',
          lifecycleState: 'active',
          templateFamily: 'baseline',
        },
      ]);
    case '/beta/deviceManagement/configurationPolicies/b1/settings':
      return collection([
        {
          id: '1',
          settingInstance: { settingDefinitionId: 'd_a', choiceSettingValue: { value: 'd_a_0' } },
        },
        {
          id: '2',
          settingInstance: { settingDefinitionId: 'd_b', simpleSettingValue: { value: 5 } },
        },
      ]);
    case '/beta/deviceManagement/configurationPolicyTemplates/tpl-1/settingTemplates':
      return collection([
        {
          settingInstanceTemplate: {
            settingDefinitionId: 'd_a',
            isRequired: true,
            choiceSettingValueTemplate: { defaultValue: { settingDefinitionOptionId: 'd_a_1' } },
          },
        },
        {
          settingInstanceTemplate: {
            settingDefinitionId: 'd_b',
            isRequired: true,
            simpleSettingValueTemplate: { defaultValue: { constantValue: 5 } },
          },
        },
      ]);
  }
  if (/^\/v1\.0\/deviceManagement\/deviceCompliancePolicies\/[^/]+\/assignments$/.test(path)) {
    return collection(path.includes('/w1/') ? [{ id: 'a1', target: { groupId: GROUP_ID } }] : []);
  }
  if (/\/scheduledActionsForRule$/.test(path))
    return collection([{ id: 'rule-1', ruleName: 'PasswordRequired' }]);
  if (/\/scheduledActionConfigurations$/.test(path)) {
    return collection([
      { id: 'x', actionType: 'block', gracePeriodHours: 24, notificationMessageCCList: [GROUP_ID] },
    ]);
  }
  return graphError(404, 'NotFound');
}

function expectStatus<T, S extends SectionResult<T>['status']>(
  result: SectionResult<T>,
  status: S,
): Extract<SectionResult<T>, { status: S }> {
  expect(result.status).toBe(status);
  return result as Extract<SectionResult<T>, { status: S }>;
}

const SECTION_KEYS = [
  'complianceSettings',
  'platformCounts',
  'compliancePolicies',
  'appProtectionPolicies',
  'conditionalAccess',
  'secureScore',
  'catalogPolicies',
  'policyTemplates',
] as const;

describe('GraphProvider.getTenantPosture – alles ok', () => {
  it('füllt alle acht Quellen', async () => {
    const { provider } = setup();
    const posture = await provider.getTenantPosture();
    for (const key of SECTION_KEYS) expect(posture[key].status).toBe('ok');

    expect(expectStatus(posture.complianceSettings, 'ok').data).toEqual({
      secureByDefault: true,
      deviceComplianceCheckinThresholdDays: 30,
    });
    expect(expectStatus(posture.platformCounts, 'ok').data).toEqual({
      windows: 6,
      ios: 2,
      macos: 1,
      android: 1,
      androidPersonal: 1,
      androidCorporate: 0,
      total: 10,
    });

    const compliance = expectStatus(posture.compliancePolicies, 'ok');
    expect(compliance.data.truncated).toBe(false);
    const [w1, i1] = compliance.data.policies;
    expect(w1).toMatchObject({
      id: 'w1',
      type: 'windows10',
      assigned: true,
      scheduledActions: [{ actionType: 'block', gracePeriodHours: 24 }],
      settings: { bitLockerEnabled: true, passwordMinimumLength: 8 },
    });
    expect(i1).toMatchObject({
      type: 'ios',
      assigned: false,
      settings: { passcodeRequired: true },
    });

    const mam = expectStatus(posture.appProtectionPolicies, 'ok');
    expect(mam.data.policies.map((p) => [p.platform, p.assigned])).toEqual([
      ['ios', true],
      ['android', false],
    ]);
    expect(mam.source.label).toContain('iosManagedAppProtections');
    expect(mam.source.label).toContain('androidManagedAppProtections');

    expect(expectStatus(posture.conditionalAccess, 'ok').data.policies[0]).toMatchObject({
      includesAllUsers: true,
      hasUserExclusions: true,
      builtInControls: ['compliantDevice'],
    });

    const score = expectStatus(posture.secureScore, 'ok').data;
    expect(score.controls[0]).toMatchObject({
      id: 'IntuneCompliance',
      service: 'Intune',
      description: 'Compliance',
      remediation: 'Do this',
    });

    const catalog = expectStatus(posture.catalogPolicies, 'ok').data.policies;
    const comparison = expectStatus(catalog[0]!.comparison!, 'ok').data;
    expect(comparison).toMatchObject({ comparedCount: 2, skippedCount: 0, truncated: false });
    expect(comparison.deviations).toEqual([
      {
        settingDefinitionId: 'd_a',
        settingName: null,
        configuredValue: 'd_a_0',
        defaultValue: 'd_a_1',
      },
    ]);
    expect(catalog[1]!.comparison).toBeNull();
    expect(expectStatus(posture.policyTemplates, 'ok').data.templates[0]).toMatchObject({
      lifecycleState: 'active',
    });
  });

  it('enthält keine Benutzer-, Gruppen- oder Mandanten-IDs und keine UPNs im Modell', async () => {
    const { provider } = setup();
    const json = JSON.stringify(await provider.getTenantPosture());
    for (const secret of [USER_ID, GROUP_ID, TENANT_ID, UPN, 'azureTenantId', 'updatedBy']) {
      expect(json).not.toContain(secret);
    }
  });

  it('sendet ausschließlich GET; beta nur für die vier freigegebenen Beta-Endpunkte', async () => {
    const { provider, calls } = setup();
    await provider.getTenantPosture();
    expect(calls.length).toBeGreaterThan(10);
    for (const call of calls) {
      expect(call.method).toBe('GET');
      expect(call.parsed.host).toBe('graph.microsoft.com');
    }
    const beta = new Set(
      calls
        .filter((call) => call.parsed.pathname.startsWith('/beta/'))
        .map((call) =>
          call.parsed.pathname.replace(/\/[^/]*(?=\/(settings|settingTemplates)$)/, '/{id}'),
        ),
    );
    expect([...beta].sort()).toEqual([
      '/beta/deviceManagement/configurationPolicies',
      '/beta/deviceManagement/configurationPolicies/{id}/settings',
      '/beta/deviceManagement/configurationPolicyTemplates',
      '/beta/deviceManagement/configurationPolicyTemplates/{id}/settingTemplates',
    ]);
  });

  it('fragt nur dokumentierte Query-Optionen an', async () => {
    const { provider, calls } = setup();
    await provider.getTenantPosture();
    const queries = calls
      .filter((call) => call.parsed.search)
      .map((call) => call.parsed.pathname + call.parsed.search);
    expect(queries.sort()).toEqual(
      [
        '/v1.0/deviceManagement?$select=settings',
        '/v1.0/identity/conditionalAccess/policies?$select=id%2CdisplayName%2Cstate%2Cconditions%2CgrantControls',
        '/v1.0/security/secureScores?$top=1',
      ].sort(),
    );
  });
});

describe('GraphProvider.getTenantPosture – 403', () => {
  it('jede Quelle liefert forbidden mit dem Scope ihrer Endpunkt-Definition', async () => {
    const { provider } = setup([on(/./, () => graphError(403, 'Forbidden'))]);
    const posture = await provider.getTenantPosture();
    const scopes = Object.fromEntries(
      SECTION_KEYS.map((key) => [
        key,
        expectStatus<unknown, 'forbidden'>(posture[key], 'forbidden').error.requiredScope,
      ]),
    );
    expect(scopes).toEqual({
      complianceSettings: 'DeviceManagementConfiguration.Read.All',
      platformCounts: 'DeviceManagementManagedDevices.Read.All',
      compliancePolicies: 'DeviceManagementConfiguration.Read.All',
      appProtectionPolicies: 'DeviceManagementApps.Read.All',
      conditionalAccess: 'Policy.Read.All',
      secureScore: 'SecurityEvents.Read.All',
      catalogPolicies: 'DeviceManagementConfiguration.Read.All',
      policyTemplates: 'DeviceManagementConfiguration.Read.All',
    });
  });

  it('eine verweigerte Quelle reißt die anderen nicht mit', async () => {
    const { provider } = setup([
      on(/conditionalAccess/, () => graphError(403, 'Forbidden')),
      on(/secureScore/, () => graphError(403, 'Forbidden')),
    ]);
    const posture = await provider.getTenantPosture();
    expectStatus(posture.conditionalAccess, 'forbidden');
    expectStatus(posture.secureScore, 'forbidden');
    for (const key of [
      'complianceSettings',
      'platformCounts',
      'compliancePolicies',
      'appProtectionPolicies',
      'catalogPolicies',
      'policyTemplates',
    ] as const) {
      expect(posture[key].status).toBe('ok');
    }
  });

  it('schlägt nur eine App-Schutz-Liste fehl, ist die Quelle der Fehler (keine halbe Liste)', async () => {
    const { provider } = setup([
      on(/androidManagedAppProtections/, () => graphError(403, 'Forbidden')),
    ]);
    const posture = await provider.getTenantPosture();
    expectStatus(posture.appProtectionPolicies, 'forbidden');
  });

  it('403 auf den Profilen des Secure Score → Quelle forbidden, Scope SecurityEvents.Read.All', async () => {
    const { provider } = setup([
      on(/secureScoreControlProfiles/, () => graphError(403, 'Forbidden')),
    ]);
    const posture = await provider.getTenantPosture();
    expect(expectStatus(posture.secureScore, 'forbidden').error.requiredScope).toBe(
      'SecurityEvents.Read.All',
    );
  });
});

describe('GraphProvider.getTenantPosture – 404', () => {
  it('jede Quelle liefert unavailable mit Grund', async () => {
    const { provider } = setup([on(/./, () => graphError(404, 'NotFound'))]);
    const posture = await provider.getTenantPosture();
    for (const key of SECTION_KEYS) {
      const result = expectStatus<unknown, 'unavailable'>(posture[key], 'unavailable');
      expect(result.reason.length).toBeGreaterThan(10);
      expect(result.source.kind).toBe('graph');
    }
    expect(expectStatus(posture.catalogPolicies, 'unavailable').reason).toBe(
      dePosture.reasons.catalogPoliciesNotFound,
    );
  });

  it('Antwort ohne settings bzw. ohne Secure Score → unavailable', async () => {
    const { provider } = setup([
      on(/^\/v1\.0\/deviceManagement$/, () => jsonResponse({})),
      on(/secureScores$/, () => collection([])),
    ]);
    const posture = await provider.getTenantPosture();
    expectStatus(posture.complianceSettings, 'unavailable');
    expect(expectStatus(posture.secureScore, 'unavailable').reason).toBe(
      dePosture.reasons.secureScoreNotReported,
    );
  });

  it('nicht lesbare Zuweisungen/Aktionen einer Richtlinie → null, Richtlinie bleibt', async () => {
    const { provider } = setup([
      on(/\/assignments$/, () => graphError(404, 'NotFound')),
      on(/scheduledActionsForRule$/, () => graphError(403, 'Forbidden')),
    ]);
    const posture = await provider.getTenantPosture();
    const compliance = expectStatus(posture.compliancePolicies, 'ok');
    expect(compliance.data.policies).toHaveLength(2);
    expect(
      compliance.data.policies.every((p) => p.assigned === null && p.scheduledActions === null),
    ).toBe(true);
  });
});

describe('GraphProvider.getTenantPosture – 429', () => {
  it('respektiert Retry-After je Quelle', async () => {
    const hit = new Set<string>();
    const throttleOnce = (pattern: RegExp): Route =>
      on(pattern, (call) => {
        const key = call.parsed.pathname;
        if (hit.has(key)) return contosoPostureHandler(call);
        hit.add(key);
        return graphError(429, 'TooManyRequests', { 'Retry-After': '3' });
      });
    const { provider, sleep } = setup([
      throttleOnce(/^\/v1\.0\/identity\/conditionalAccess\/policies$/),
      throttleOnce(/^\/beta\/deviceManagement\/configurationPolicyTemplates$/),
    ]);
    const posture = await provider.getTenantPosture();
    for (const key of SECTION_KEYS) expect(posture[key].status).toBe('ok');
    expect(sleep).toHaveBeenCalledWith(3000, undefined);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('dauerhaft gedrosselt (max. 3 Versuche) → error, andere Quellen bleiben ok', async () => {
    const { provider, calls } = setup([
      on(/^\/v1\.0\/security\/secureScores$/, () =>
        graphError(429, 'TooManyRequests', { 'Retry-After': '1' }),
      ),
    ]);
    const posture = await provider.getTenantPosture();
    expectStatus(posture.secureScore, 'error');
    expectStatus(posture.conditionalAccess, 'ok');
    expect(calls.filter((c) => c.parsed.pathname === '/v1.0/security/secureScores')).toHaveLength(
      3,
    );
  });
});

describe('GraphProvider.getTenantPosture – Seiten- und Mengengrenzen', () => {
  it('liest höchstens MAX_LIST_PAGES Seiten einer Liste und setzt truncated', async () => {
    let pages = 0;
    const { provider } = setup([
      on(/conditionalAccess\/policies$/, (call) => {
        pages += 1;
        const next = new URL(call.url);
        next.searchParams.set('page', String(pages + 1));
        return collection(
          [{ id: `ca-${pages}`, displayName: `Contoso ${pages}`, state: 'enabled' }],
          next.href,
        );
      }),
    ]);
    const posture = await provider.getTenantPosture();
    const info = expectStatus(posture.conditionalAccess, 'ok').data;
    expect(pages).toBe(MAX_LIST_PAGES);
    expect(info.policies).toHaveLength(MAX_LIST_PAGES);
    expect(info.truncated).toBe(true);
  });

  it('Einzelabrufe nur für die zuletzt geänderten MAX_COMPLIANCE_POLICY_DETAILS Richtlinien', async () => {
    const count = MAX_COMPLIANCE_POLICY_DETAILS + 3;
    const policies = Array.from({ length: count }, (_, i) =>
      win(`p${i}`, new Date(Date.UTC(2026, 0, 1 + i)).toISOString()),
    );
    const { provider, calls } = setup([
      on(/^\/v1\.0\/deviceManagement\/deviceCompliancePolicies$/, () => collection(policies)),
    ]);
    const posture = await provider.getTenantPosture();
    const data = expectStatus(posture.compliancePolicies, 'ok').data;
    expect(data.truncated).toBe(true);
    expect(data.policies).toHaveLength(count);
    // Reihenfolge der Liste bleibt; die drei ältesten (p0..p2) wurden nicht nachgeladen
    expect(
      data.policies.slice(0, 3).every((p) => p.assigned === null && p.scheduledActions === null),
    ).toBe(true);
    expect(
      data.policies.slice(3).every((p) => p.assigned !== null && p.scheduledActions !== null),
    ).toBe(true);
    const assignmentCalls = calls.filter((c) => c.parsed.pathname.endsWith('/assignments'));
    expect(assignmentCalls).toHaveLength(MAX_COMPLIANCE_POLICY_DETAILS);
  });

  it('Baseline-Vergleich nur für die MAX_BASELINE_COMPARISONS zuletzt geänderten Baselines', async () => {
    const baselines = Array.from({ length: MAX_BASELINE_COMPARISONS + 2 }, (_, i) =>
      baseline(`b${i}`, new Date(Date.UTC(2026, 5, 1 + i)).toISOString()),
    );
    const { provider, calls } = setup([
      on(/^\/beta\/deviceManagement\/configurationPolicies$/, () => collection(baselines)),
      on(/configurationPolicies\/[^/]+\/settings$/, () => collection([])),
    ]);
    const posture = await provider.getTenantPosture();
    const list = expectStatus(posture.catalogPolicies, 'ok').data.policies;
    const compared = list.filter((p) => p.comparison !== null).map((p) => p.id);
    expect(compared.sort()).toEqual(['b2', 'b3', 'b4', 'b5', 'b6']);
    expect(calls.filter((c) => c.parsed.pathname.endsWith('/settings'))).toHaveLength(
      MAX_BASELINE_COMPARISONS,
    );
  });

  it('abgeschnittene Einstellungsliste einer Baseline → truncated im Vergleich', async () => {
    let page = 0;
    const { provider } = setup([
      on(/configurationPolicies\/b1\/settings$/, (call) => {
        page += 1;
        const next = new URL(call.url);
        next.searchParams.set('page', String(page + 1));
        return collection([], next.href);
      }),
    ]);
    const posture = await provider.getTenantPosture();
    const comparison = expectStatus(
      expectStatus(posture.catalogPolicies, 'ok').data.policies[0]!.comparison!,
      'ok',
    ).data;
    expect(comparison.truncated).toBe(true);
    // abgeschnitten: „fehlt in der Richtlinie“ ist keine Abweichung
    expect(comparison.deviations).toEqual([]);
  });
});

describe('GraphProvider.getTenantPosture – Beta-Aufwertung der Compliance-Richtlinien', () => {
  const V1_PATH = /^\/v1\.0\/deviceManagement\/deviceCompliancePolicies$/;
  const BETA_PATH = /^\/beta\/deviceManagement\/deviceCompliancePolicies$/;
  const other = { id: 'o1', displayName: 'Contoso Android Vollverwaltet' };
  const betaCalls = (calls: FakeCall[]) =>
    calls.filter((c) => c.parsed.pathname === '/beta/deviceManagement/deviceCompliancePolicies');

  it('ohne `other`-Richtlinie kein Beta-Aufruf, betaRead fehlt', async () => {
    const { provider, calls } = setup();
    const posture = await provider.getTenantPosture();
    const data = expectStatus(posture.compliancePolicies, 'ok').data;
    expect(betaCalls(calls)).toHaveLength(0);
    expect(data.betaRead).toBeUndefined();
    expect(data.policies.every((p) => p.beta === undefined)).toBe(true);
  });

  it('mit `other` genau ein GET auf die Beta-Liste; Typ und Einstellungen werden aufgewertet', async () => {
    const { provider, calls } = setup([
      on(V1_PATH, () => collection([win('w1', '2026-10-01T00:00:00Z'), other])),
      on(BETA_PATH, () =>
        collection([
          {
            '@odata.type': '#microsoft.graph.windows10CompliancePolicy',
            id: 'w1',
            passwordRequired: true,
          },
          {
            '@odata.type': '#microsoft.graph.androidDeviceOwnerCompliancePolicy',
            id: 'o1',
            passwordRequired: true,
            passwordMinimumLength: 6,
            description: 'nie',
          },
          { '@odata.type': '#microsoft.graph.androidDeviceOwnerCompliancePolicy', id: 'nur-beta' },
        ]),
      ),
    ]);
    const posture = await provider.getTenantPosture();
    const data = expectStatus(posture.compliancePolicies, 'ok').data;
    const beta = betaCalls(calls);
    expect(beta).toHaveLength(1);
    expect(beta[0]!.method).toBe('GET');
    expect(beta[0]!.parsed.search).toBe('');
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
    expect(data.policies.map((p) => p.id)).toEqual(['w1', 'o1']);
    expect(data.policies[0]!.type).toBe('windows10');
    expect(data.policies[0]!.beta).toBeUndefined();
    expect(data.policies[1]).toMatchObject({
      type: 'androidDeviceOwner',
      beta: true,
      settings: { passwordRequired: true, passwordMinimumLength: 6 },
    });
    expect(data.betaRead).toEqual({
      status: 'ok',
      truncated: false,
      source: {
        kind: 'graph',
        label: 'GET /beta/deviceManagement/deviceCompliancePolicies',
        docsUrl: expect.stringContaining('graph-rest-beta'),
      },
    });
    expect(data.truncated).toBe(false);
  });

  it('Beta 403 → Sektion bleibt ok, Richtlinien unverändert, betaRead failed', async () => {
    const { provider } = setup([
      on(V1_PATH, () => collection([other])),
      on(BETA_PATH, () => graphError(403, 'Forbidden')),
    ]);
    const posture = await provider.getTenantPosture();
    const data = expectStatus(posture.compliancePolicies, 'ok').data;
    expect(data.policies).toHaveLength(1);
    expect(data.policies[0]).toMatchObject({ type: 'other', settings: {} });
    expect(data.policies[0]!.beta).toBeUndefined();
    expect(data.betaRead?.status).toBe('failed');
    expect(data.truncated).toBe(false);
  });

  it('Beta-Seitenlimit → betaRead.truncated, Sektion-truncated unverändert', async () => {
    let pages = 0;
    const { provider } = setup([
      on(V1_PATH, () => collection([other])),
      on(BETA_PATH, (call) => {
        pages += 1;
        const next = new URL(call.url);
        next.searchParams.set('page', String(pages + 1));
        return collection([], next.href);
      }),
    ]);
    const posture = await provider.getTenantPosture();
    const data = expectStatus(posture.compliancePolicies, 'ok').data;
    expect(pages).toBe(MAX_LIST_PAGES);
    expect(data.betaRead).toMatchObject({ status: 'ok', truncated: true });
    expect(data.truncated).toBe(false);
  });
});

describe('GraphProvider.getTenantPosture – Baseline-Vergleich', () => {
  it('403 auf den Einstellungen einer Baseline → nur ihr Vergleich ist forbidden', async () => {
    const { provider } = setup([
      on(/configurationPolicies\/b1\/settings$/, () => graphError(403, 'Forbidden')),
    ]);
    const posture = await provider.getTenantPosture();
    const catalog = expectStatus(posture.catalogPolicies, 'ok').data.policies;
    expect(expectStatus(catalog[0]!.comparison!, 'forbidden').error.requiredScope).toBe(
      'DeviceManagementConfiguration.Read.All',
    );
    expectStatus(posture.policyTemplates, 'ok');
  });

  it('404 auf den Einstellungsvorlagen → Vergleich unavailable mit Grund', async () => {
    const { provider } = setup([on(/settingTemplates$/, () => graphError(404, 'NotFound'))]);
    const posture = await provider.getTenantPosture();
    const catalog = expectStatus(posture.catalogPolicies, 'ok').data.policies;
    expect(expectStatus(catalog[0]!.comparison!, 'unavailable').reason).toBe(
      dePosture.reasons.baselineTemplateNotFound,
    );
  });

  it('Baseline ohne Vorlagen-ID → unavailable ohne Abruf der Einstellungen', async () => {
    const { provider, calls } = setup([
      on(/^\/beta\/deviceManagement\/configurationPolicies$/, () =>
        collection([baseline('b9', '2026-10-01T00:00:00Z', null)]),
      ),
    ]);
    const posture = await provider.getTenantPosture();
    const catalog = expectStatus(posture.catalogPolicies, 'ok').data.policies;
    expect(expectStatus(catalog[0]!.comparison!, 'unavailable').reason).toBe(
      dePosture.reasons.baselineNoTemplate,
    );
    expect(calls.some((c) => c.parsed.pathname.endsWith('/settings'))).toBe(false);
  });
});

describe('GraphProvider.getTenantPosture – Abbruch', () => {
  it('wirft nur bei Abbruch', async () => {
    const controller = new AbortController();
    const { provider } = setup([
      on(/./, () => {
        controller.abort();
        throw new DOMException('aborted', 'AbortError');
      }),
    ]);
    await expect(provider.getTenantPosture({ signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
