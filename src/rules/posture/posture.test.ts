/** M21/S2: Regelwerk „Empfehlungen“ – Kacheln, Stufenlogik, Gesamtbild. Testdaten fiktiv (Contoso). */
import { describe, expect, it } from 'vitest';
import type {
  AppProtectionPolicyConfig,
  CatalogPolicyConfig,
  CompliancePolicyConfig,
  ConditionalAccessPolicyConfig,
  PlatformDeviceCounts,
  PostureLevel,
  PostureSettings,
  SecureScoreControl,
  TenantPosture,
} from '../../domain/posture';
import type { DataSource, SectionResult, Tile, TileId } from '../../domain/types';
import {
  ALL_FRAMEWORKS,
  POSTURE_SECTIONS,
  evaluatePosture,
  evaluatePostureChecks,
  groupPostureTiles,
  postureScore,
} from './index';
import {
  ANDROID_FULLY_MANAGED_COMPLIANCE,
  ANDROID_WORK_PROFILE_COMPLIANCE,
  APP_PROTECTION_ANDROID,
  APP_PROTECTION_IOS,
  IOS_COMPLIANCE,
  WINDOWS_COMPLIANCE,
} from './catalog';
import { evaluateFramework } from './kit';
import type { CatalogCheck, CheckOutcome, PostureFramework, PostureTile } from './types';

const LEARN = /^https:\/\/learn\.microsoft\.com\//;
const NOW = new Date('2026-11-25T12:00:00Z');
const SOURCE: DataSource = { kind: 'mock', label: 'Contoso (Demo)' };

// ---------- Builder ----------

/** Gerätezähler; Android standardmäßig komplett persönlich (Arbeitsprofil). */
function counts(overrides: Partial<PlatformDeviceCounts> = {}): PlatformDeviceCounts {
  const base = { windows: 10, ios: 5, macos: 0, android: 3, total: 18, ...overrides };
  return {
    androidPersonal: base.android,
    androidCorporate: base.android === null ? null : 0,
    ...base,
  };
}

const ok = <T>(data: T): SectionResult<T> => ({
  status: 'ok',
  data,
  source: SOURCE,
  fetchedAt: '2026-11-25T11:00:00Z',
});
const forbidden = <T>(scope = 'Policy.Read.All'): SectionResult<T> => ({
  status: 'forbidden',
  source: SOURCE,
  error: { code: 'forbidden', message: 'Verboten', httpStatus: 403, requiredScope: scope },
});
const unavailable = <T>(): SectionResult<T> => ({
  status: 'unavailable',
  source: SOURCE,
  reason: 'Nicht verfügbar (Test)',
});
const failed = <T>(): SectionResult<T> => ({
  status: 'error',
  source: SOURCE,
  error: { code: 'throttled', message: 'Zu viele Anfragen', httpStatus: 429 },
});
const ISSUES = [
  ['forbidden', forbidden],
  ['unavailable', unavailable],
  ['error', failed],
] as const;

function posture(overrides: Partial<TenantPosture> = {}): TenantPosture {
  return {
    complianceSettings: ok({ secureByDefault: true, deviceComplianceCheckinThresholdDays: 30 }),
    platformCounts: ok(counts()),
    compliancePolicies: ok({ policies: [], truncated: false }),
    appProtectionPolicies: ok({ policies: [], truncated: false }),
    conditionalAccess: ok({ policies: [], truncated: false }),
    secureScore: ok({
      currentScore: 40,
      maxScore: 100,
      createdDateTime: '2026-11-24T00:00:00Z',
      controls: [],
    }),
    catalogPolicies: ok({ policies: [], truncated: false }),
    policyTemplates: ok({ templates: [], truncated: false }),
    ...overrides,
  };
}

/** Einstellungen, die alle Prüfungen eines Frameworks erfüllen (aus den Katalog-Beispielen). */
function satisfying(framework: PostureFramework): PostureSettings {
  return Object.assign({}, ...framework.checks.map((check) => check.satisfiedBy.settings));
}

let counter = 0;
function compliance(
  type: CompliancePolicyConfig['type'],
  settings: PostureSettings,
  overrides: Partial<CompliancePolicyConfig> = {},
): CompliancePolicyConfig {
  counter += 1;
  return {
    id: `cp-${counter}`,
    displayName: `Contoso Compliance ${counter}`,
    type,
    odataType: null,
    lastModifiedDateTime: null,
    settings,
    assigned: true,
    scheduledActions: [{ actionType: 'block', gracePeriodHours: 0 }],
    ...overrides,
  };
}

function appPolicy(
  platform: 'ios' | 'android',
  settings: PostureSettings,
  overrides: Partial<AppProtectionPolicyConfig> = {},
): AppProtectionPolicyConfig {
  counter += 1;
  return {
    id: `app-${counter}`,
    displayName: `Contoso App-Schutz ${counter}`,
    platform,
    lastModifiedDateTime: null,
    settings,
    assigned: true,
    deployedAppCount: 11,
    ...overrides,
  };
}

function caPolicy(
  overrides: Partial<ConditionalAccessPolicyConfig>,
): ConditionalAccessPolicyConfig {
  counter += 1;
  return {
    id: `ca-${counter}`,
    displayName: `Contoso CA ${counter}`,
    state: 'enabled',
    builtInControls: ['compliantDevice'],
    grantOperator: 'OR',
    includesAllUsers: true,
    includesAllApplications: true,
    hasUserExclusions: true,
    includePlatforms: [],
    ...overrides,
  };
}

function catalogPolicy(overrides: Partial<CatalogPolicyConfig>): CatalogPolicyConfig {
  counter += 1;
  return {
    id: `cat-${counter}`,
    name: `Contoso Richtlinie ${counter}`,
    platforms: 'windows10',
    technologies: 'mdm',
    templateFamily: 'none',
    templateId: null,
    templateDisplayName: null,
    templateDisplayVersion: null,
    settingCount: 10,
    isAssigned: true,
    lastModifiedDateTime: null,
    comparison: null,
    ...overrides,
  };
}

function control(overrides: Partial<SecureScoreControl>): SecureScoreControl {
  counter += 1;
  return {
    id: `control${counter}`,
    title: `Turn on example protection ${counter}`,
    category: 'Device',
    service: 'MDATP',
    score: 0,
    maxScore: 10,
    description: 'Example description from Microsoft.',
    remediation: 'Example remediation.',
    actionUrl: null,
    implementationCost: 'Low',
    userImpact: 'Low',
    deprecated: false,
    ...overrides,
  };
}

function tileOf(tiles: Tile[], id: TileId): PostureTile {
  const tile = tiles.find((entry) => entry.id === id);
  if (!tile) throw new Error(`Kachel ${id} fehlt`);
  return tile as PostureTile;
}

function run(overrides: Partial<TenantPosture> = {}, level: PostureLevel = 2): PostureTile[] {
  return evaluatePosture(posture(overrides), { level, now: NOW });
}

const policies = (list: CompliancePolicyConfig[], truncated = false) =>
  ok({ policies: list, truncated });

/** Quelle der Beta-Liste der Compliance-Richtlinien (dritte freigegebene Beta-Ausnahme). */
const BETA_SOURCE: DataSource = {
  kind: 'mock',
  label: 'GET /beta/deviceManagement/deviceCompliancePolicies',
};
const policiesWithBeta = (
  list: CompliancePolicyConfig[],
  status: 'ok' | 'failed' = 'ok',
  betaTruncated = false,
) =>
  ok({
    policies: list,
    truncated: false,
    betaRead: { status, source: BETA_SOURCE, truncated: betaTruncated },
  });
const DEVICE_OWNER_TYPE = '#microsoft.graph.androidDeviceOwnerCompliancePolicy';

// ---------- Struktur ----------

describe('evaluatePosture – Struktur', () => {
  it('liefert alle zwölf Kacheln in der Reihenfolge der Abschnitte', () => {
    const tiles = run();
    expect(tiles.map((tile) => tile.id)).toEqual(POSTURE_SECTIONS.flatMap((s) => s.tiles));
    expect(groupPostureTiles(tiles).map((section) => section.key)).toEqual([
      'basics',
      'compliance',
      'appProtection',
      'endpoint',
      'secureScore',
    ]);
  });

  it('groupPostureTiles lässt leere Abschnitte weg', () => {
    const tiles = run().filter((tile) => tile.id === 'postureSecureScore');
    expect(groupPostureTiles(tiles)).toEqual([{ key: 'secureScore', tiles }]);
  });

  it('jede Prüfung und jeder Befund verweist auf Microsoft Learn', () => {
    const tiles = run(
      {
        compliancePolicies: policies([
          compliance('windows10', {}),
          compliance('ios', {}),
          compliance('androidWorkProfile', {}),
        ]),
        appProtectionPolicies: ok({
          policies: [appPolicy('ios', {}), appPolicy('android', {})],
          truncated: false,
        }),
        secureScore: ok({
          currentScore: 1,
          maxScore: 2,
          createdDateTime: null,
          controls: [control({})],
        }),
      },
      3,
    );
    for (const tile of tiles) {
      for (const check of tile.checks) expect(check.docsUrl, check.id).toMatch(LEARN);
      for (const finding of tile.findings) {
        if (finding.docsUrl !== undefined) expect(finding.docsUrl, finding.id).toMatch(LEARN);
      }
    }
  });

  it.each(ISSUES)(
    'Quelle %s → jede abhängige Kachel „nicht prüfbar“ mit Grund, nie eine Aussage',
    (_name, issue) => {
      const tiles = run({
        complianceSettings: issue(),
        platformCounts: issue(),
        compliancePolicies: issue(),
        appProtectionPolicies: issue(),
        conditionalAccess: issue(),
        secureScore: issue(),
        catalogPolicies: issue(),
        policyTemplates: issue(),
      });
      for (const tile of tiles) {
        expect(tile.availability, tile.id).toBe(_name);
        expect(tile.severity, tile.id).toBe('unknown');
        expect(tile.checks, tile.id).toEqual([]);
        expect(tile.findings[0]?.id, tile.id).toBe(`${tile.id}-${_name}`);
      }
      expect(postureScore(tiles)).toEqual({ met: 0, deviating: 0, notChecked: 0, total: 0 });
    },
  );

  it('fehlende Berechtigung nennt den Scope', () => {
    const tile = tileOf(run({ conditionalAccess: forbidden('Policy.Read.All') }), 'postureAccess');
    expect(tile.summary).toContain('Policy.Read.All');
    expect(tile.findings[0]?.evidence?.requiredScope).toBe('Policy.Read.All');
  });
});

// ---------- Mandanten-Einstellungen ----------

describe('postureTenantSettings', () => {
  const tile = (overrides: Partial<TenantPosture>) =>
    tileOf(run(overrides), 'postureTenantSettings');
  const settings = (secureByDefault: boolean | null, days: number | null = 30) =>
    ok({ secureByDefault, deviceComplianceCheckinThresholdDays: days });
  const ca = (list: ConditionalAccessPolicyConfig[]) => ok({ policies: list, truncated: false });

  it('„nicht konform“ → erfüllt', () => {
    const t = tile({ complianceSettings: settings(true) });
    expect(t.severity).toBe('ok');
    expect(t.checks.map((c) => c.status)).toEqual(['met']);
  });

  it('„konform“ + aktive Richtlinie verlangt konformes Gerät → critical', () => {
    const t = tile({ complianceSettings: settings(false), conditionalAccess: ca([caPolicy({})]) });
    expect(t.severity).toBe('critical');
    expect(t.checks[0]?.status).toBe('deviating');
    expect(
      t.findings.find((f) => f.id === 'postureTenantSettings-secureByDefault')?.docsUrl,
    ).toMatch(/compliance\/overview#compliance-policy-settings/);
  });

  it('„konform“ + aktive ODER-Richtlinie (Konformität als Alternative) → ebenfalls critical', () => {
    // Konsistent mit postureAccess: Die ODER-Richtlinie wirkt auf den Zugriff – ein Gerät ohne Richtlinie
    // gilt als konform und erfüllt damit die Alternative
    const t = tile({
      complianceSettings: settings(false),
      conditionalAccess: ca([caPolicy({ builtInControls: ['compliantDevice', 'mfa'] })]),
    });
    expect(t.severity).toBe('critical');
  });

  it('„konform“ + nur Berichtsmodus → warning', () => {
    const t = tile({
      complianceSettings: settings(false),
      conditionalAccess: ca([caPolicy({ state: 'enabledForReportingButNotEnforced' })]),
    });
    expect(t.severity).toBe('warning');
  });

  it('„konform“ ohne Bedingten Zugriff mit Konformität → keine Prüfung, nur Hinweis', () => {
    const t = tile({ complianceSettings: settings(false), conditionalAccess: ca([]) });
    expect(t.checks).toEqual([]);
    expect(t.severity).toBe('unknown');
  });

  it('„konform“ und Bedingter Zugriff nicht lesbar → nicht prüfbar', () => {
    const t = tile({ complianceSettings: settings(false), conditionalAccess: forbidden() });
    expect(t.checks[0]?.status).toBe('notChecked');
    expect(t.availability).toBeUndefined();
  });

  it('Wert nicht geliefert (null) → nicht prüfbar; Gültigkeitszeitraum nur Fakt und Hinweis', () => {
    const t = tile({ complianceSettings: settings(null, null) });
    expect(t.checks[0]?.status).toBe('notChecked');
    expect(
      t.findings.some((f) => f.id === 'postureTenantSettings-validity' && f.severity === 'unknown'),
    ).toBe(true);
  });

  it.each(ISSUES)('Quelle %s → Kachel nicht verfügbar', (name, issue) => {
    expect(tile({ complianceSettings: issue() }).availability).toBe(name);
  });
});

// ---------- Abdeckung ----------

describe('postureCoverage', () => {
  const tile = (overrides: Partial<TenantPosture>) => tileOf(run(overrides), 'postureCoverage');

  it('jede genutzte Plattform mit zugewiesener Richtlinie → erfüllt; macOS ohne Geräte nicht geprüft', () => {
    const t = tile({
      compliancePolicies: policies([
        compliance('windows10', {}),
        compliance('ios', {}),
        compliance('androidWorkProfile', {}),
      ]),
    });
    expect(t.checks.map((c) => [c.id, c.status])).toEqual([
      ['postureCoverage:windows', 'met'],
      ['postureCoverage:ios', 'met'],
      ['postureCoverage:androidPersonal', 'met'],
    ]);
    expect(t.severity).toBe('ok');
    expect(t.value).toBe('3 von 3 abgedeckt');
  });

  it('Plattform mit Geräten ohne Richtlinie → critical', () => {
    const t = tile({ compliancePolicies: policies([compliance('windows10', {})]) });
    expect(t.severity).toBe('critical');
    expect(t.findings.map((f) => f.id)).toContain('postureCoverage-missing-ios');
  });

  it('nicht zugewiesene Richtlinie deckt nicht ab; Windows 8.1-Typ zählt nicht für Windows', () => {
    const t = tile({
      compliancePolicies: policies([
        compliance('windows10', {}, { assigned: false }),
        compliance('other', {}, { odataType: '#microsoft.graph.windows81CompliancePolicy' }),
      ]),
    });
    expect(t.checks.find((c) => c.id === 'postureCoverage:windows')?.status).toBe('deviating');
  });

  describe('Android: zwei getrennte Empfehlungen', () => {
    const android = (personal: number | null, corporate: number | null) =>
      ok(
        counts({
          windows: 0,
          ios: 0,
          android: (personal ?? 0) + (corporate ?? 0),
          androidPersonal: personal,
          androidCorporate: corporate,
        }),
      );
    const deviceOwner = (overrides: Partial<CompliancePolicyConfig> = {}) =>
      compliance(
        'other',
        {},
        { odataType: '#microsoft.graph.androidDeviceOwnerCompliancePolicy', ...overrides },
      );
    const status = (t: PostureTile, id: string) =>
      t.checks.find((c) => c.id === `postureCoverage:${id}`)?.status;

    it('Arbeitsprofil-Richtlinie deckt nur persönliche Geräte ab, nicht unternehmenseigene', () => {
      const t = tile({
        platformCounts: android(11, 4),
        compliancePolicies: policies([compliance('androidWorkProfile', {})]),
      });
      expect(status(t, 'androidPersonal')).toBe('met');
      // keine Richtlinie für vollständig verwaltet gefunden → nicht prüfbar (Typ nur beta), keine Abweichung
      expect(status(t, 'androidCorporate')).toBe('notChecked');
      expect(t.checks.find((c) => c.id === 'postureCoverage:androidCorporate')?.docsUrl).toContain(
        '#compliance-policies-protect-fully-managed-and-corporate-owned-android-devices',
      );
      expect(t.findings.map((f) => f.id)).toContain('postureCoverage-androidCorporate-beta');
      expect(t.severity).toBe('ok');
    });

    it('Geräteeigner-Richtlinie (beta-Typ) deckt nur unternehmenseigene Geräte ab', () => {
      const t = tile({
        platformCounts: android(11, 4),
        compliancePolicies: policies([deviceOwner()]),
      });
      expect(status(t, 'androidCorporate')).toBe('met');
      expect(status(t, 'androidPersonal')).toBe('deviating');
      expect(t.findings.map((f) => f.id)).toContain('postureCoverage-missing-androidPersonal');
      expect(t.severity).toBe('critical');
    });

    it('zugewiesene Richtlinie vom Typ androidDeviceOwner (aus der Beta-Liste) → erfüllt, Beta ausgewiesen', () => {
      const t = tile({
        platformCounts: android(0, 4),
        compliancePolicies: policiesWithBeta([
          compliance('androidDeviceOwner', {}, { odataType: DEVICE_OWNER_TYPE, beta: true }),
        ]),
      });
      expect(status(t, 'androidCorporate')).toBe('met');
      expect(t.findings.map((f) => f.id)).not.toContain('postureCoverage-androidCorporate-beta');
      expect(t.sources).toContainEqual(BETA_SOURCE);
      expect(t.facts).toContainEqual({
        label: 'Datenquelle',
        value: 'Microsoft Graph Beta-API (freigegebene Ausnahme)',
      });
      // ohne Richtlinie aus der Beta-Liste keine Beta-Kennzeichnung
      const plain = tile({
        platformCounts: android(11, 0),
        compliancePolicies: policies([compliance('androidWorkProfile', {})]),
      });
      expect(plain.sources).not.toContainEqual(BETA_SOURCE);
      expect(plain.facts.map((f) => f.label)).not.toContain('Datenquelle');
    });

    it('nicht zugewiesene androidDeviceOwner-Richtlinie bzw. keine → nicht prüfbar, nie Abweichung', () => {
      const unassigned = tile({
        platformCounts: android(0, 4),
        compliancePolicies: policiesWithBeta([
          compliance(
            'androidDeviceOwner',
            {},
            { odataType: DEVICE_OWNER_TYPE, beta: true, assigned: false },
          ),
        ]),
      });
      expect(status(unassigned, 'androidCorporate')).toBe('notChecked');
      const none = tile({
        platformCounts: android(11, 4),
        compliancePolicies: policies([compliance('androidWorkProfile', {})]),
      });
      const check = none.checks.find((c) => c.id === 'postureCoverage:androidCorporate');
      expect(check?.status).toBe('notChecked');
      // Der Grund behauptet nicht mehr, der Typ sei „über v1.0 nicht lesbar“
      expect(check?.reason).toContain('kein sicherer Nachweis');
      expect(check?.reason).not.toContain('über v1.0 nicht sicher lesbar');
      expect(none.findings.filter((f) => f.severity === 'critical')).toEqual([]);
    });

    it('Beta-Liste nicht lesbar → Grund und Befund sagen das, weiterhin nicht prüfbar', () => {
      const t = tile({
        platformCounts: android(0, 4),
        compliancePolicies: policiesWithBeta(
          [compliance('other', {}, { displayName: 'Contoso – Android Lager' })],
          'failed',
        ),
      });
      const check = t.checks.find((c) => c.id === 'postureCoverage:androidCorporate');
      expect(check?.status).toBe('notChecked');
      expect(check?.reason).toContain('Beta-Liste der Compliance-Richtlinien konnte nicht gelesen');
      const finding = t.findings.find((f) => f.id === 'postureCoverage-androidCorporate-beta');
      expect(finding?.severity).toBe('unknown');
      expect(finding?.detail).toContain('konnte nicht gelesen werden');
      expect(finding?.source).toEqual(BETA_SOURCE);
      expect(t.sources).toContainEqual(BETA_SOURCE);
    });

    it('Geräteeigner-Richtlinie nicht zugewiesen → weiterhin nicht prüfbar, nie Abweichung', () => {
      const t = tile({
        platformCounts: android(0, 4),
        compliancePolicies: policies([deviceOwner({ assigned: false })]),
      });
      expect(status(t, 'androidCorporate')).toBe('notChecked');
      expect(t.checks.map((c) => c.id)).not.toContain('postureCoverage:androidPersonal');
    });

    it('Geräteadministrator-Richtlinie deckt keine der beiden Gruppen ab', () => {
      const t = tile({
        platformCounts: android(3, 0),
        compliancePolicies: policies([compliance('androidDeviceAdministrator', {})]),
      });
      expect(status(t, 'androidPersonal')).toBe('deviating');
      expect(t.checks.map((c) => c.id)).not.toContain('postureCoverage:androidCorporate');
    });

    it('Gruppenzahl nicht geliefert → nicht prüfbar; Android gesamt 0 → beide nicht genutzt', () => {
      const unknown = tile({
        platformCounts: ok(counts({ windows: 0, ios: 0, android: 5, androidPersonal: null })),
        compliancePolicies: policies([]),
      });
      expect(status(unknown, 'androidPersonal')).toBe('notChecked');
      const none = tile({
        platformCounts: ok(counts({ android: 0, androidPersonal: null, androidCorporate: null })),
      });
      expect(none.checks.map((c) => c.id)).not.toContain('postureCoverage:androidPersonal');
      expect(none.checks.map((c) => c.id)).not.toContain('postureCoverage:androidCorporate');
    });
  });

  it('Zuweisung unbekannt bzw. Liste abgeschnitten → nicht prüfbar statt Abweichung', () => {
    const unknown = tile({
      compliancePolicies: policies([compliance('ios', {}, { assigned: null })]),
    });
    expect(unknown.checks.find((c) => c.id === 'postureCoverage:ios')?.status).toBe('notChecked');
    const truncated = tile({ compliancePolicies: policies([], true) });
    expect(truncated.checks.every((c) => c.status === 'notChecked')).toBe(true);
  });

  it('Geräteanzahl fehlt → nicht prüfbar', () => {
    const t = tile({
      platformCounts: ok(counts({ windows: null, ios: 0, macos: 0, android: 0, total: null })),
    });
    expect(t.checks).toHaveLength(1);
    expect(t.checks[0]?.status).toBe('notChecked');
  });

  it.each(ISSUES)('Gerätezähler %s → Kachel nicht verfügbar', (name, issue) => {
    expect(tile({ platformCounts: issue() }).availability).toBe(name);
  });
});

// ---------- Bedingter Zugriff ----------

describe('postureAccess', () => {
  const tile = (list: ConditionalAccessPolicyConfig[], truncated = false) =>
    tileOf(run({ conditionalAccess: ok({ policies: list, truncated }) }), 'postureAccess');

  it('aktive Richtlinien für konformes Gerät (alle Benutzer/Ressourcen) und App-Schutz → erfüllt', () => {
    const t = tile([
      caPolicy({}),
      caPolicy({ builtInControls: ['approvedApplication', 'compliantApplication'] }),
    ]);
    expect(t.checks.map((c) => c.status)).toEqual(['met', 'met', 'met']);
    expect(t.severity).toBe('ok');
  });

  it('nur Berichtsmodus bzw. nur als ODER-Alternative → weicht ab', () => {
    expect(tile([caPolicy({ state: 'enabledForReportingButNotEnforced' })]).checks[0]?.status).toBe(
      'deviating',
    );
    const alternative = tile([
      caPolicy({ builtInControls: ['compliantDevice', 'mfa'], grantOperator: 'OR' }),
    ]);
    expect(alternative.checks[0]?.status).toBe('deviating');
    // eigener Text: Konformität wirkt auf den Zugriff, ist aber nur eine zulässige Alternative
    const finding = alternative.findings.find((f) => f.id === 'postureAccess-compliantDevice');
    expect(finding?.title).toBe('Konformes Gerät ist nur eine von mehreren zulässigen Steuerungen');
    expect(finding?.detail).not.toContain(
      'wirkt sich das Ergebnis der Compliance-Richtlinien nicht',
    );
    expect(finding?.detail).toContain('wirkt sich damit auf den Zugriff aus');
    const reportOnly = tile([caPolicy({ state: 'enabledForReportingButNotEnforced' })]);
    expect(
      reportOnly.findings.find((f) => f.id === 'postureAccess-compliantDevice')?.detail,
    ).toContain('nicht auf den Zugriff aus');
    const both = tile([
      caPolicy({ builtInControls: ['compliantDevice', 'mfa'], grantOperator: 'AND' }),
    ]);
    expect(both.checks[0]?.status).toBe('met');
  });

  it('Geltungsbereich nur für einen Teil → weicht ab (warning, nie critical)', () => {
    const t = tile([caPolicy({ includesAllUsers: false })]);
    expect(t.checks.find((c) => c.id === 'postureAccess:scope')?.status).toBe('deviating');
    expect(t.severity).toBe('warning');
  });

  it('keine Richtlinie → zwei Abweichungen; abgeschnittene Liste → nicht prüfbar', () => {
    expect(tile([]).checks.map((c) => c.status)).toEqual(['deviating', 'deviating']);
    expect(tile([], true).checks.map((c) => c.status)).toEqual(['notChecked', 'notChecked']);
  });

  it('deaktivierte Richtlinie zählt nicht', () => {
    expect(tile([caPolicy({ state: 'disabled' })]).checks[0]?.status).toBe('deviating');
  });
});

// ---------- Compliance ----------

describe('Compliance-Kacheln', () => {
  const windowsOk = () => compliance('windows10', satisfying(WINDOWS_COMPLIANCE));
  const tile = (
    list: CompliancePolicyConfig[],
    id: TileId,
    level: PostureLevel = 2,
    truncated = false,
  ) => tileOf(run({ compliancePolicies: policies(list, truncated) }, level), id);

  it('Windows erfüllt → alle Prüfungen erfüllt, nicht prüfbare Learn-Werte einmal je Kachel', () => {
    const t = tile([windowsOk()], 'postureComplianceWindows');
    const met = t.checks.filter((c) => c.status === 'met');
    expect(met).toHaveLength(WINDOWS_COMPLIANCE.checks.length);
    expect(t.checks.filter((c) => c.status === 'notChecked')).toHaveLength(
      WINDOWS_COMPLIANCE.uncheckable.length,
    );
    expect(t.severity).toBe('ok');
    expect(t.value).toBe(`${met.length} von ${met.length} erfüllt`);
  });

  it('Windows abweichend und nicht konfiguriert → warning mit Tabelle (Einstellung | Ist | Empfehlung | Stufe/Status)', () => {
    const t = tile(
      [
        compliance('windows10', {
          ...satisfying(WINDOWS_COMPLIANCE),
          passwordMinimumLength: 4,
          bitLockerEnabled: null,
        }),
      ],
      'postureComplianceWindows',
    );
    expect(t.severity).toBe('warning');
    const finding = t.findings.find((f) => f.id.startsWith('postureComplianceWindows-policy-'));
    expect(finding?.table?.columns).toEqual(['Einstellung', 'Ist', 'Empfehlung', 'Stufe/Status']);
    expect(finding?.table?.rows.map((r) => r.cells[1])).toEqual([
      'Nicht konfiguriert',
      '4 Zeichen',
    ]);
    expect(finding?.docsUrl).toMatch(LEARN);
    expect(finding?.remediation.length).toBeGreaterThan(0);
  });

  it('strenger als empfohlen ist keine Abweichung (Mindestlänge 8 bei Empfehlung 6)', () => {
    const t = tile(
      [compliance('windows10', { ...satisfying(WINDOWS_COMPLIANCE), passwordMinimumLength: 8 })],
      'postureComplianceWindows',
    );
    expect(t.checks.find((c) => c.id.includes('winPasswordMinLength'))?.status).toBe('met');
  });

  it('iOS: Stufe 1 gibt es nicht → bewertet wird gegen Stufe 2', () => {
    const settings = satisfying(IOS_COMPLIANCE);
    const t = tile(
      [compliance('ios', { ...settings, passcodeExpirationDays: null })],
      'postureComplianceIos',
      1,
    );
    expect(t.checks.every((c) => c.level === null || c.level <= 2)).toBe(true);
    expect(t.facts.find((f) => f.label === 'Bewertete Stufe')?.value).toContain('Stufe 2');
    // iOS Stufe 2 enthält eine Learn-Empfehlung ohne v1.0-Eigenschaft → „soweit prüfbar“
    expect(t.value).toBe('Stufe 2 erreicht, soweit prüfbar');
  });

  it('iOS Stufenlogik: Stufe 3 nicht erreicht, wenn eine Stufe-3-Prüfung abweicht', () => {
    const settings = { ...satisfying(IOS_COMPLIANCE), passcodeExpirationDays: 400 };
    const level2 = tile([compliance('ios', settings)], 'postureComplianceIos', 2);
    expect(level2.value).toBe('Stufe 2 erreicht, soweit prüfbar');
    expect(level2.facts.some((f) => f.value.includes('Stufe 2 erreicht'))).toBe(true);
    const level3 = tile([compliance('ios', settings)], 'postureComplianceIos', 3);
    expect(level3.severity).toBe('warning');
    expect(level3.value).not.toContain('Stufe');
    const full = tile([compliance('ios', satisfying(IOS_COMPLIANCE))], 'postureComplianceIos', 3);
    expect(full.value).toBe('Stufe 3 erreicht, soweit prüfbar');
  });

  describe('Stufe 3: Defender for Endpoint ODER Mobile Threat Defense', () => {
    const level3 = (settings: PostureSettings) =>
      tile(
        [compliance('ios', { ...satisfying(IOS_COMPLIANCE), ...settings })],
        'postureComplianceIos',
        3,
      );
    const threat = (t: PostureTile) => t.checks.find((c) => c.id.includes(':iosThreatLevel:'));

    it('Bedrohungsstufe nicht aktiviert → nicht prüfbar (nicht „weicht ab“), Stufe 3 nicht verhindert', () => {
      const t = level3({
        deviceThreatProtectionEnabled: false,
        deviceThreatProtectionRequiredSecurityLevel: 'notSet',
      });
      expect(threat(t)?.status).toBe('notChecked');
      expect(threat(t)?.reason).toContain(
        'Defender for Endpoint oder eine Mobile-Threat-Defense-Lösung',
      );
      expect(t.checks.filter((c) => c.status === 'deviating')).toEqual([]);
      // Stufe gilt nur „soweit prüfbar“ als erreicht – nicht fälschlich bestätigt
      expect(t.value).toBe('Stufe 3 erreicht, soweit prüfbar');
      expect(t.facts.some((f) => f.value.includes('Stufe 3 erreicht, soweit prüfbar'))).toBe(true);
      const finding = t.findings.find((f) => f.id.startsWith('postureComplianceIos-policy-'));
      expect(finding?.severity).toBe('unknown');
      expect(finding?.detail).toContain('„Soweit prüfbar“');
    });

    it('aktiviert mit anderer Stufe als „Geschützt“ → weicht ab, Stufe 3 nicht erreicht', () => {
      const t = level3({
        deviceThreatProtectionEnabled: true,
        deviceThreatProtectionRequiredSecurityLevel: 'medium',
      });
      expect(threat(t)?.status).toBe('deviating');
      expect(threat(t)?.actual).toBe('Bedrohungsstufe aktiviert · Mittel');
      expect(t.value).not.toContain('Stufe 3');
      expect(t.facts.some((f) => f.value.includes('Stufe 2 erreicht'))).toBe(true);
    });

    it('aktiviert mit „Geschützt“ → erfüllt', () => {
      expect(threat(level3({}))?.status).toBe('met');
    });
  });

  it('iOS: keine Stufe erreicht, wenn eine Stufe-2-Prüfung abweicht', () => {
    const t = tile(
      [compliance('ios', { ...satisfying(IOS_COMPLIANCE), securityBlockJailbrokenDevices: false })],
      'postureComplianceIos',
    );
    expect(t.facts.some((f) => f.value.includes('keine Stufe vollständig erreicht'))).toBe(true);
  });

  it('mehrere Richtlinien werden einzeln bewertet', () => {
    const good = compliance('androidWorkProfile', satisfying(ANDROID_WORK_PROFILE_COMPLIANCE));
    const weak = compliance('androidWorkProfile', {
      ...satisfying(ANDROID_WORK_PROFILE_COMPLIANCE),
      passwordMinimumLength: 4,
    });
    const t = tile([good, weak], 'postureComplianceAndroid');
    expect(
      t.findings
        .filter((f) => f.id.startsWith('postureComplianceAndroid-policy-'))
        .map((f) => f.evidence?.policyId),
    ).toEqual([weak.id]);
    expect(t.facts.filter((f) => f.label.startsWith('Richtlinie „'))).toHaveLength(2);
    expect(
      t.checks.filter((c) => c.subject === good.displayName).every((c) => c.status === 'met'),
    ).toBe(true);
  });

  it('nicht zugewiesene Richtlinie: gekennzeichnet, Hinweis statt Warnung, zählt nicht', () => {
    const t = tile(
      [
        compliance(
          'windows10',
          { passwordRequired: false },
          { assigned: false, displayName: 'Contoso Entwurf' },
        ),
      ],
      'postureComplianceWindows',
    );
    expect(t.severity).toBe('unknown');
    expect(t.facts.some((f) => f.label.includes('(nicht zugewiesen)'))).toBe(true);
    expect(postureScore([t])).toEqual({ met: 0, deviating: 0, notChecked: 0, total: 0 });
  });

  it('Android-Geräteadministrator → kein Sollwert; Android-Typ ohne Einstellungen (other) → nicht prüfbar', () => {
    const t = tile(
      [
        compliance('androidDeviceAdministrator', {}),
        compliance('other', {}, { odataType: DEVICE_OWNER_TYPE }),
      ],
      'postureComplianceAndroid',
    );
    expect(t.findings.map((f) => f.id)).toEqual(
      expect.arrayContaining([
        'postureComplianceAndroid-noTarget',
        'postureComplianceAndroid-betaOnly',
      ]),
    );
    expect(t.checks.map((c) => c.status)).toEqual(['notChecked']);
    expect(t.value).toBe('Nicht prüfbar');
    // Kein Framework bewertet → die Kachel behauptet auch keines
    expect(t.facts.map((f) => f.label)).not.toContain('Bewertetes Framework');
    // Texte behaupten nicht mehr, „vollständig verwaltet“ sei grundsätzlich nicht lesbar
    const finding = t.findings.find((f) => f.id === 'postureComplianceAndroid-betaOnly');
    expect(finding?.detail).toContain('Über die Beta-API liest sie nur Richtlinien des Typs');
    expect(JSON.stringify(t)).not.toContain('werden nicht bewertet');
  });

  it('Android: der Fakt nennt nur das tatsächlich bewertete Framework', () => {
    const t = tile(
      [compliance('androidWorkProfile', satisfying(ANDROID_WORK_PROFILE_COMPLIANCE))],
      'postureComplianceAndroid',
    );
    expect(t.facts.find((f) => f.label === 'Bewertetes Framework')?.value).toBe(
      'Android Enterprise, persönliches Gerät mit Arbeitsprofil',
    );
    // ohne Richtlinie aus der Beta-Liste: keine Beta-Kennzeichnung, kein Hinweis zum Richtlinientyp
    expect(t.facts.map((f) => f.label)).not.toContain('Datenquelle');
    expect(t.facts.map((f) => f.label)).not.toContain('Geltung des Richtlinientyps');
    expect(t.summary).not.toContain('Beta-API');
  });

  it('iOS „Maximale Minuten nach Bildschirmsperre“ = 0 → nicht prüfbar (Bedeutung nicht dokumentiert)', () => {
    const t = tile(
      [
        compliance('ios', {
          ...satisfying(IOS_COMPLIANCE),
          passcodeMinutesOfInactivityBeforeLock: 0,
        }),
      ],
      'postureComplianceIos',
    );
    const check = t.checks.find((c) => c.id.includes(':iosPasscodeAfterLock:'));
    expect(check?.status).toBe('notChecked');
    expect(check?.reason).toContain('„Sofort“');
    const unset = tile(
      [
        compliance('ios', {
          ...satisfying(IOS_COMPLIANCE),
          passcodeMinutesOfInactivityBeforeLock: null,
        }),
      ],
      'postureComplianceIos',
    );
    expect(unset.checks.find((c) => c.id.includes(':iosPasscodeAfterLock:'))?.status).toBe(
      'deviating',
    );
  });

  it('macOS: Microsoft dokumentiert keinen Sollwert', () => {
    const t = tileOf(
      run({
        platformCounts: ok(counts({ windows: 0, ios: 0, macos: 4, android: 0, total: 4 })),
        compliancePolicies: policies([compliance('macos', {})]),
      }),
      'postureComplianceMacos',
    );
    expect(t.value).toBe('Kein Sollwert');
    expect(t.checks).toEqual([]);
    expect(t.findings[0]?.title).toBe('Microsoft dokumentiert dafür keinen Sollwert');
  });

  it('keine Richtlinie: ohne Geräte „nicht genutzt“, mit Geräten Hinweis', () => {
    const macos = tile([], 'postureComplianceMacos');
    expect(macos.value).toBe('Nicht genutzt');
    expect(macos.findings).toEqual([]);
    const ios = tile([], 'postureComplianceIos');
    expect(ios.value).toBe('Keine Richtlinie');
    expect(ios.severity).toBe('unknown');
  });

  it('Richtlinie ohne erkennbaren Typ: Plattform ohne eigene Richtlinie → „Nicht prüfbar“ statt „Keine Richtlinie“', () => {
    const untyped = compliance('other', {}, { displayName: 'Contoso – Android Kiosk' });
    const base = compliance(
      'other',
      {},
      {
        displayName: 'Contoso – Android Lager',
        odataType: '#microsoft.graph.deviceCompliancePolicy',
      },
    );
    const ios = tile([untyped, base], 'postureComplianceIos');
    expect(ios.value).toBe('Nicht prüfbar');
    expect(ios.severity).toBe('unknown');
    expect(ios.checks).toEqual([]);
    expect(ios.findings.map((f) => f.id)).toEqual(['postureComplianceIos-unclassified']);
    expect(ios.findings[0]?.title).toBe('2 Richtlinien ohne erkennbare Plattform');
    expect(ios.findings[0]?.detail).toContain('„Contoso – Android Kiosk“');
    expect(ios.findings[0]?.detail).toContain('„Contoso – Android Lager“');
    expect(ios.findings[0]?.evidence).toEqual({
      odataTypes: 'kein Typ geliefert, #microsoft.graph.deviceCompliancePolicy',
    });
    // Plattform nachweislich ohne Geräte bleibt „nicht genutzt“
    expect(tile([untyped], 'postureComplianceMacos').value).toBe('Nicht genutzt');
  });

  it('Richtlinie ohne erkennbaren Typ steht bei Plattformen mit eigener Richtlinie als Fakt dabei', () => {
    const t = tile(
      [windowsOk(), compliance('other', {}, { displayName: 'Contoso – Android Kiosk' })],
      'postureComplianceWindows',
    );
    expect(t.facts.find((f) => f.label === 'Richtlinien ohne erkennbare Plattform')?.value).toBe(
      '„Contoso – Android Kiosk“',
    );
    expect(t.findings.map((f) => f.id)).not.toContain('postureComplianceWindows-unclassified');
    expect(tile([windowsOk()], 'postureComplianceWindows').facts.map((f) => f.label)).not.toContain(
      'Richtlinien ohne erkennbare Plattform',
    );
  });

  it('abgeschnittene Liste wird ausgewiesen', () => {
    const t = tile([windowsOk()], 'postureComplianceWindows', 2, true);
    expect(t.findings.map((f) => f.id)).toContain('postureComplianceWindows-truncated');
  });

  it.each(ISSUES)('Quelle %s → alle Compliance-Kacheln nicht verfügbar', (name, issue) => {
    const tiles = run({ compliancePolicies: issue() });
    for (const id of [
      'postureComplianceWindows',
      'postureComplianceIos',
      'postureComplianceAndroid',
      'postureComplianceMacos',
    ] as const) {
      expect(tileOf(tiles, id).availability).toBe(name);
    }
  });
});

// ---------- Compliance: Android Enterprise vollständig verwaltet (Beta) ----------

describe('Compliance: Android vollständig verwaltet (androidDeviceOwner, Beta-Liste)', () => {
  const AFM = ANDROID_FULLY_MANAGED_COMPLIANCE;
  const ID = 'postureComplianceAndroid';
  const fullyManaged = (
    settings: PostureSettings = {},
    overrides: Partial<CompliancePolicyConfig> = {},
  ) =>
    compliance(
      'androidDeviceOwner',
      { ...satisfying(AFM), ...settings },
      { odataType: DEVICE_OWNER_TYPE, beta: true, ...overrides },
    );
  const workProfile = (settings: PostureSettings = {}) =>
    compliance('androidWorkProfile', {
      ...satisfying(ANDROID_WORK_PROFILE_COMPLIANCE),
      ...settings,
    });
  const tile = (
    list: CompliancePolicyConfig[],
    level: PostureLevel,
    status: 'ok' | 'failed' = 'ok',
    betaTruncated = false,
  ) =>
    tileOf(run({ compliancePolicies: policiesWithBeta(list, status, betaTruncated) }, level), ID);
  const checkOf = (t: PostureTile, checkId: string) =>
    t.checks.find((c) => c.id.includes(`:${checkId}`));
  const fact = (t: PostureTile, label: string) => t.facts.find((f) => f.label === label)?.value;
  const level1Count = AFM.checks.filter((check) => check.level === 1).length;
  const level2Count = AFM.checks.filter((check) => (check.level ?? 0) <= 2).length;

  it('Stufe 1: nur Stufe-1-Prüfungen; erfüllt → „Stufe 1 erreicht“ (vollständig prüfbar)', () => {
    // Stufe-2-Werte fehlen/weichen ab – bei Stufe 1 ohne Belang
    const t = tile(
      [
        fullyManaged({
          passwordExpirationDays: null,
          passwordPreviousPasswordCountToBlock: null,
          securityRequiredAndroidSafetyNetEvaluationType: 'basic',
        }),
      ],
      1,
    );
    expect(t.checks).toHaveLength(level1Count);
    expect(t.checks.every((c) => c.level === 1 && c.status === 'met')).toBe(true);
    expect(t.value).toBe('Stufe 1 erreicht');
    expect(t.severity).toBe('ok');
    expect(fact(t, 'Bewertete Stufe')).toBe('Stufe 1 (Basis)');
    expect(fact(t, 'Bewertetes Framework')).toBe('Android Enterprise, vollständig verwaltet');
    for (const check of t.checks) expect(check.docsUrl).toContain('#device-compliance-level-1');
  });

  it('Stufe 2: Abweichungen → warning mit Tabelle; der Befund nennt dedizierte Geräte', () => {
    const policy = fullyManaged({
      passwordPreviousPasswordCountToBlock: 3,
      securityRequiredAndroidSafetyNetEvaluationType: 'basic',
    });
    const t = tile([policy], 2);
    expect(t.checks).toHaveLength(level2Count);
    expect(t.checks.filter((c) => c.status === 'deviating').map((c) => c.id)).toEqual([
      `${ID}:afmPasswordReuse:${policy.id}`,
      `${ID}:afmStrongIntegrity:${policy.id}`,
    ]);
    expect(t.value).toBe(`${level2Count - 2} von ${level2Count} erfüllt`);
    expect(t.severity).toBe('warning');
    const finding = t.findings.find((f) => f.id === `${ID}-policy-${policy.id}`);
    expect(finding?.table?.rows.map((r) => r.cells.slice(0, 3))).toEqual([
      ['Anzahl vorheriger Kennwörter, die nicht wiederverwendet werden dürfen', '3', '5 oder mehr'],
      [
        'Starke Integrität mit hardwaregestützten Sicherheitsfunktionen',
        'Standard (ohne starke Integrität)',
        'Starke Integrität prüfen',
      ],
    ]);
    expect(finding?.detail).toContain('Stufe 1 erreicht');
    expect(finding?.detail).toContain('dedizierte Geräte (Kiosk)');
    expect(finding?.docsUrl).toContain('android-fully-managed');
    expect(checkOf(t, 'afmPasswordReuse')?.properties).toEqual([
      'passwordPreviousPasswordCountToBlock',
    ]);
  });

  it('Stufe 3: alles erfüllt → „soweit prüfbar“; die Defender-Zeile ist mit eigenem Grund nicht prüfbar', () => {
    const t = tile([fullyManaged()], 3);
    expect(t.checks.filter((c) => c.status === 'deviating')).toEqual([]);
    expect(t.value).toBe('Stufe 3 erreicht, soweit prüfbar');
    const mde = t.checks.find((c) => c.id === `${ID}:afmMdeRisk`);
    expect(mde).toMatchObject({
      status: 'notChecked',
      level: 3,
      expected: 'Frei',
      reason:
        'Die Eigenschaft ist dokumentiert, die Zuordnung des Werts im Intune Admin Center zum Enum-Wert der API aber nicht',
    });
    expect(mde?.docsUrl).toContain('#device-compliance-level-3');
    const finding = t.findings.find((f) => f.id === `${ID}-uncheckable`);
    expect(finding?.detail).toContain('Die Eigenschaft der Graph-API ist dokumentiert');
    expect(finding?.detail).not.toContain('v1.0');
    // Stufe 2 hat keine nicht prüfbare Empfehlung → dort vollständig
    expect(tile([fullyManaged()], 2).value).toBe('Stufe 2 erreicht');
  });

  describe('Stufe 3: Defender for Endpoint ODER Mobile Threat Defense', () => {
    const threat = (settings: PostureSettings) => {
      const t = tile([fullyManaged(settings)], 3);
      return { t, check: checkOf(t, 'afmThreatLevel:') };
    };

    it('Bedrohungsstufe nicht aktiviert → nicht prüfbar, keine Abweichung, kein „v1.0“ im Grund', () => {
      const { t, check } = threat({
        deviceThreatProtectionEnabled: false,
        deviceThreatProtectionRequiredSecurityLevel: 'unavailable',
      });
      expect(check?.status).toBe('notChecked');
      expect(check?.reason).toContain(
        'Defender for Endpoint oder eine Mobile-Threat-Defense-Lösung',
      );
      expect(check?.reason).not.toContain('v1.0');
      expect(t.checks.filter((c) => c.status === 'deviating')).toEqual([]);
      expect(t.value).toBe('Stufe 3 erreicht, soweit prüfbar');
    });

    it('aktiviert mit anderer Stufe als „Geschützt“ → weicht ab; mit „Geschützt“ → erfüllt', () => {
      const medium = threat({
        deviceThreatProtectionEnabled: true,
        deviceThreatProtectionRequiredSecurityLevel: 'medium',
      });
      expect(medium.check?.status).toBe('deviating');
      expect(medium.check?.actual).toBe('Bedrohungsstufe aktiviert · Mittel');
      expect(medium.t.value).not.toContain('Stufe 3');
      expect(threat({}).check?.status).toBe('met');
    });
  });

  it.each(['lowSecurityBiometric', 'customPassword'])(
    'Kennworttyp %s → nicht prüfbar: weder Abweichung noch bestätigte Stufe',
    (type) => {
      const t = tile([fullyManaged({ passwordRequiredType: type })], 1);
      const check = checkOf(t, 'afmPasswordType:');
      expect(check?.status).toBe('notChecked');
      expect(check?.reason).toContain('keinen Rang gegenüber dem empfohlenen Wert');
      expect(t.checks.filter((c) => c.status === 'deviating')).toEqual([]);
      expect(t.value).toBe('Stufe 1 erreicht, soweit prüfbar');
      expect(t.findings.every((f) => f.severity === 'unknown')).toBe(true);
    },
  );

  it('Kennworttyp „numerisch“ weicht ab, „alphanumerisch“ erfüllt', () => {
    const weak = tile([fullyManaged({ passwordRequiredType: 'numeric' })], 1);
    expect(checkOf(weak, 'afmPasswordType:')?.status).toBe('deviating');
    expect(weak.value).toBe(`${level1Count - 1} von ${level1Count} erfüllt`);
    const strict = tile([fullyManaged({ passwordRequiredType: 'alphanumeric' })], 1);
    expect(checkOf(strict, 'afmPasswordType:')?.status).toBe('met');
  });

  it('„Maximale Inaktivität“ = 0 → nicht prüfbar (Bedeutung in der Beta-Ressource nicht dokumentiert)', () => {
    const t = tile([fullyManaged({ passwordMinutesOfInactivityBeforeLock: 0 })], 1);
    const check = checkOf(t, 'afmPasswordInactivity:');
    expect(check?.status).toBe('notChecked');
    expect(check?.actual).toBe('0 (Bedeutung nicht dokumentiert)');
    expect(check?.reason).toContain('weder einen Wertebereich noch die Bedeutung von 0');
    expect(
      checkOf(
        tile([fullyManaged({ passwordMinutesOfInactivityBeforeLock: 10 })], 1),
        'afmPasswordInactivity:',
      )?.status,
    ).toBe('deviating');
  });

  it('starke Integrität: basic weicht ab (Stufe 2), hardwareBacked erfüllt', () => {
    const basic = tile(
      [fullyManaged({ securityRequiredAndroidSafetyNetEvaluationType: 'basic' })],
      2,
    );
    expect(checkOf(basic, 'afmStrongIntegrity:')?.status).toBe('deviating');
    expect(checkOf(tile([fullyManaged()], 2), 'afmStrongIntegrity:')).toMatchObject({
      status: 'met',
      actual: 'Starke Integrität (hardwaregestützt)',
    });
  });

  describe('Beta-Kennzeichnung', () => {
    it('Richtlinie aus der Beta-Liste (beta: true) → Fakt, Zusammenfassung und Quelle weisen Beta aus', () => {
      const t = tile([fullyManaged()], 2);
      expect(fact(t, 'Datenquelle')).toBe('Microsoft Graph Beta-API (freigegebene Ausnahme)');
      expect(t.summary.endsWith(' · Beta-API')).toBe(true);
      expect(t.sources).toContainEqual(BETA_SOURCE);
      expect(t.sources).toContainEqual(SOURCE);
    });

    it('ohne beta: true keine Kennzeichnung – auch wenn die Beta-Liste gelesen wurde', () => {
      const t = tile([workProfile()], 2);
      expect(t.facts.map((f) => f.label)).not.toContain('Datenquelle');
      expect(t.summary).not.toContain('Beta-API');
      expect(t.sources).not.toContainEqual(BETA_SOURCE);
      // andere Plattformen bleiben unberührt
      const ios = tileOf(
        run({
          compliancePolicies: policiesWithBeta([
            compliance('ios', satisfying(IOS_COMPLIANCE)),
            fullyManaged(),
          ]),
        }),
        'postureComplianceIos',
      );
      expect(ios.summary).not.toContain('Beta-API');
      expect(ios.sources).not.toContainEqual(BETA_SOURCE);
    });

    it('Hinweis: Der Richtlinientyp gilt auch für dedizierte Geräte', () => {
      const t = tile([fullyManaged()], 2);
      const note = fact(t, 'Geltung des Richtlinientyps');
      expect(note).toContain('Empfehlung für vollständig verwaltete Geräte');
      expect(note).toContain('dedizierte Geräte (Kiosk)');
      expect(note).toContain('unternehmenseigene Geräte mit Arbeitsprofil');
      expect(note).toContain('Abweichungen beabsichtigt');
    });
  });

  describe('gemischte Kachel: Arbeitsprofil (Stufe 2/3) und vollständig verwaltet (Stufe 1–3)', () => {
    const unique = (values: string[]) => expect(new Set(values).size).toBe(values.length);

    it('Nutzerstufe 1: unterschiedliche effektive Stufen (2 bzw. 1) → Zählwert statt „Stufe N erreicht“', () => {
      const t = tile([workProfile(), fullyManaged()], 1);
      expect(t.checks.filter((c) => c.status === 'deviating')).toEqual([]);
      expect(t.value).not.toContain('Stufe');
      const evaluated = t.checks.filter((c) => c.counted && c.status !== 'notChecked').length;
      expect(t.value).toBe(`${evaluated} von ${evaluated} erfüllt`);
      expect(fact(t, 'Bewertete Stufe (Arbeitsprofil)')).toContain('Stufe 2');
      expect(fact(t, 'Bewertete Stufe (vollständig verwaltet)')).toBe('Stufe 1 (Basis)');
      expect(t.facts.map((f) => f.label)).not.toContain('Bewertete Stufe');
      expect(fact(t, 'Bewertete Frameworks')).toBe(
        'Android Enterprise, persönliches Gerät mit Arbeitsprofil · Android Enterprise, vollständig verwaltet',
      );
      // Arbeitsprofil gegen Stufe 2, vollständig verwaltet nur gegen Stufe 1
      expect(t.checks.filter((c) => c.id.includes(':afm')).every((c) => c.level === 1)).toBe(true);
      expect(t.checks.some((c) => c.id.includes(':awp') && c.level === 2)).toBe(true);
      unique(t.facts.map((f) => f.label));
    });

    it('Nutzerstufe 2: gleiche Stufe, alle erreichen sie → „Stufe 2 erreicht, soweit prüfbar“', () => {
      const t = tile([workProfile(), fullyManaged()], 2);
      // Arbeitsprofil hat auf Stufe 2 eine Empfehlung ohne v1.0-Eigenschaft
      expect(t.value).toBe('Stufe 2 erreicht, soweit prüfbar');
      expect(fact(t, 'Bewertete Stufe')).toBe('Stufe 2 (erweitert)');
      expect(t.facts.filter((f) => f.label.startsWith('Bewertete Stufe'))).toHaveLength(1);
      unique(t.facts.map((f) => f.label));
    });

    it('Nutzerstufe 2: eine Richtlinie erreicht die Stufe nicht → Zählwert', () => {
      const t = tile([workProfile(), fullyManaged({ passwordExpirationDays: 400 })], 2);
      expect(t.value).not.toContain('Stufe');
      expect(t.severity).toBe('warning');
      const other = tile([workProfile({ passwordMinimumLength: 4 }), fullyManaged()], 2);
      expect(other.value).not.toContain('Stufe');
    });

    it('Nutzerstufe 1: auch eine nicht zugewiesene Richtlinie des anderen Frameworks verhindert „Stufe N erreicht“', () => {
      // Die Fakten nennen zwei unterschiedliche Stufen – der Kopfwert darf dann keine einzelne behaupten
      const t = tile([workProfile(), fullyManaged({}, { assigned: false })], 1);
      expect(t.value).not.toContain('Stufe');
      const evaluated = t.checks.filter((c) => c.counted && c.status !== 'notChecked').length;
      expect(t.value).toBe(`${evaluated} von ${evaluated} erfüllt`);
      expect(fact(t, 'Bewertete Stufe (vollständig verwaltet)')).toBe('Stufe 1 (Basis)');
      // bei gleicher Stufe zählt die nicht zugewiesene Richtlinie nicht gegen die Stufe
      const level2 = tile(
        [workProfile(), fullyManaged({ passwordExpirationDays: 400 }, { assigned: false })],
        2,
      );
      expect(level2.value).toBe('Stufe 2 erreicht, soweit prüfbar');
    });

    it('Nutzerstufe 3: Befunde, Fakten und Prüfungen bleiben eindeutig; je Framework ein eigener Hinweis', () => {
      const t = tile([workProfile(), fullyManaged()], 3);
      unique(t.findings.map((f) => f.id));
      unique(t.facts.map((f) => f.label));
      unique(t.checks.map((c) => c.id));
      const awp = t.findings.find((f) => f.id === `${ID}-uncheckable-androidWorkProfileCompliance`);
      const afm = t.findings.find(
        (f) => f.id === `${ID}-uncheckable-androidFullyManagedCompliance`,
      );
      expect(awp?.table?.rows).toHaveLength(ANDROID_WORK_PROFILE_COMPLIANCE.uncheckable.length);
      expect(awp?.detail).toContain('v1.0');
      expect(afm?.table?.rows).toHaveLength(1);
      expect(afm?.detail).not.toContain('v1.0');
      expect(afm?.docsUrl).toContain('android-fully-managed');
      expect(t.findings.map((f) => f.id)).not.toContain(`${ID}-uncheckable`);
      expect(t.value).toBe('Stufe 3 erreicht, soweit prüfbar');
    });
  });

  describe('Beta-Liste nicht lesbar bzw. anderer Beta-Typ (type: other)', () => {
    const kiosk = () =>
      compliance(
        'other',
        {},
        { displayName: 'Contoso – Android Kiosk', odataType: DEVICE_OWNER_TYPE },
      );

    it('Abruf gescheitert → Befund, Grund und Fakt sagen, dass die Beta-Liste nicht lesbar war', () => {
      const t = tile([kiosk()], 2, 'failed');
      expect(t.value).toBe('Nicht prüfbar');
      expect(t.severity).toBe('unknown');
      const finding = t.findings.find((f) => f.id === `${ID}-betaOnly`);
      expect(finding?.detail).toContain(
        'Der Abruf der Beta-Liste der Compliance-Richtlinien ist gescheitert',
      );
      expect(finding?.cause).toContain('konnte nicht gelesen werden');
      expect(finding?.source).toEqual(BETA_SOURCE);
      expect(finding?.evidence).toMatchObject({ betaList: 'failed' });
      expect(t.checks[0]?.reason).toContain('konnte nicht gelesen werden');
      expect(fact(t, 'Beta-Liste der Compliance-Richtlinien')).toContain('Nicht lesbar');
      expect(t.sources).toContainEqual(BETA_SOURCE);
      // nichts aus der Beta-Liste angezeigt → keine Beta-Kennzeichnung der Kachel
      expect(t.facts.map((f) => f.label)).not.toContain('Datenquelle');
      expect(t.facts.map((f) => f.label)).not.toContain('Bewertetes Framework');
      // die alten Aussagen stimmen nicht mehr
      expect(JSON.stringify(t)).not.toContain('nur in der Beta-API mit Einstellungen dokumentiert');
    });

    it('Abruf gescheitert, Richtlinie ohne erkennbare Plattform → der Befund nennt die Beta-Liste', () => {
      const t = tile(
        [compliance('other', {}, { displayName: 'Contoso – Android Lager' })],
        2,
        'failed',
      );
      expect(t.value).toBe('Nicht prüfbar');
      const finding = t.findings.find((f) => f.id === `${ID}-unclassified`);
      expect(finding?.detail).toContain('„Contoso – Android Lager“');
      expect(finding?.detail).toContain('konnte nicht gelesen werden');
      expect(finding?.cause).toContain(
        'Beta-Liste der Compliance-Richtlinien konnte nicht gelesen',
      );
      expect(finding?.evidence).toEqual({ odataTypes: 'kein Typ geliefert', betaList: 'failed' });
      expect(fact(t, 'Beta-Liste der Compliance-Richtlinien')).toContain('Nicht lesbar');
    });

    it('Beta-Liste gelesen, Richtlinie weiter ohne Plattform → „weder v1.0 noch die Beta-Liste“', () => {
      const t = tile([compliance('other', {}, { displayName: 'Contoso – Android Lager' })], 2);
      const finding = t.findings.find((f) => f.id === `${ID}-unclassified`);
      expect(finding?.cause).toContain('Weder v1.0 noch die Beta-Liste');
      expect(finding?.detail).toContain('Auch die Beta-Liste');
      expect(t.facts.map((f) => f.label)).not.toContain('Beta-Liste der Compliance-Richtlinien');
    });

    it('anderer Beta-Typ (z. B. AOSP) → nicht prüfbar mit zutreffendem Grund, als Beta gekennzeichnet', () => {
      const aosp = compliance(
        'other',
        {},
        { odataType: '#microsoft.graph.aospDeviceOwnerCompliancePolicy', beta: true },
      );
      const t = tile([aosp], 2);
      expect(t.checks.map((c) => c.status)).toEqual(['notChecked']);
      expect(t.checks[0]?.actual).toBe('#microsoft.graph.aospDeviceOwnerCompliancePolicy');
      expect(t.checks[0]?.reason).toContain(
        'Für diesen Richtlinientyp liest die App keine Einstellungen',
      );
      const finding = t.findings.find((f) => f.id === `${ID}-betaOnly`);
      expect(finding?.detail).not.toContain('gescheitert');
      // der Typ stammt aus der Beta-Liste
      expect(fact(t, 'Datenquelle')).toBe('Microsoft Graph Beta-API (freigegebene Ausnahme)');
      expect(t.facts.map((f) => f.label)).not.toContain('Geltung des Richtlinientyps');
    });

    it('Beta-Liste abgeschnitten → der Grund nennt die Seitengrenze', () => {
      const t = tile([kiosk()], 2, 'ok', true);
      expect(t.checks[0]?.reason).toContain('nicht vollständig gelesen (Seitengrenze)');
      expect(fact(t, 'Beta-Liste der Compliance-Richtlinien')).toContain('Seitengrenze');
    });

    it('neben einer bewerteten Richtlinie bleibt die nicht lesbare sichtbar und zählt als nicht prüfbar', () => {
      const t = tile([workProfile(), kiosk()], 2, 'failed');
      expect(t.findings.map((f) => f.id)).toContain(`${ID}-betaOnly`);
      expect(fact(t, 'Bewertetes Framework')).toBe(
        'Android Enterprise, persönliches Gerät mit Arbeitsprofil',
      );
      expect(fact(t, 'Richtlinie „Contoso – Android Kiosk“')).toBe('Nicht prüfbar');
    });
  });
});

// ---------- App-Schutz ----------

describe('App-Schutz-Kacheln', () => {
  const tile = (list: AppProtectionPolicyConfig[], id: TileId, level: PostureLevel = 2) =>
    tileOf(run({ appProtectionPolicies: ok({ policies: list, truncated: false }) }, level), id);

  it.each([
    ['ios', APP_PROTECTION_IOS, 'postureAppProtectionIos'],
    ['android', APP_PROTECTION_ANDROID, 'postureAppProtectionAndroid'],
  ] as const)('%s: Stufe 3 vollständig erfüllt → „Stufe 3 erreicht“', (platform, framework, id) => {
    const t = tile([appPolicy(platform, satisfying(framework))], id, 3);
    // App-Schutz enthält auf jeder Stufe Learn-Empfehlungen ohne v1.0-Eigenschaft
    expect(t.value).toBe('Stufe 3 erreicht, soweit prüfbar');
    expect(t.severity).toBe('ok');
  });

  it('Stufe 1 bewertet nur Stufe-1-Prüfungen', () => {
    const t = tile(
      [appPolicy('ios', { ...satisfying(APP_PROTECTION_IOS), dataBackupBlocked: false })],
      'postureAppProtectionIos',
      1,
    );
    expect(t.checks.every((c) => c.level === null || c.level <= 1)).toBe(true);
    expect(t.value).toBe('Stufe 1 erreicht, soweit prüfbar');
  });

  it('Abweichung auf Stufe 2 → warning, Tabelle nennt Ist und Empfehlung', () => {
    const t = tile(
      [
        appPolicy('android', {
          ...satisfying(APP_PROTECTION_ANDROID),
          allowedOutboundDataTransferDestinations: 'allApps',
        }),
      ],
      'postureAppProtectionAndroid',
    );
    expect(t.severity).toBe('warning');
    const row = t.findings.find((f) => f.table)?.table?.rows[0]?.cells;
    expect(row?.slice(1, 3)).toEqual([
      'Alle Apps',
      'Durch Richtlinie verwaltete Apps (oder strenger)',
    ]);
  });

  it('keine Richtlinie bei genutzter Plattform → warning; ohne Geräte „nicht genutzt“', () => {
    expect(tile([], 'postureAppProtectionIos').severity).toBe('warning');
    const unused = tileOf(
      run({ platformCounts: ok(counts({ windows: 1, ios: 0, macos: 0, android: 0, total: 1 })) }),
      'postureAppProtectionIos',
    );
    expect(unused.value).toBe('Nicht genutzt');
  });

  it('nur nicht zugewiesene Richtlinie → Abdeckung weicht ab', () => {
    const t = tile(
      [appPolicy('ios', satisfying(APP_PROTECTION_IOS), { assigned: false })],
      'postureAppProtectionIos',
    );
    expect(t.checks.find((c) => c.id.endsWith(':coverage'))?.status).toBe('deviating');
  });

  it.each(ISSUES)('Quelle %s → Kachel nicht verfügbar', (name, issue) => {
    expect(
      tileOf(run({ appProtectionPolicies: issue() }), 'postureAppProtectionIos').availability,
    ).toBe(name);
  });
});

// ---------- Baselines ----------

describe('postureBaselines', () => {
  const baseline = (overrides: Partial<CatalogPolicyConfig> = {}) =>
    catalogPolicy({
      name: 'Contoso Windows-Baseline',
      templateFamily: 'baseline',
      templateId: 'tpl-new',
      templateDisplayName: 'Security Baseline for Windows 10 and later',
      templateDisplayVersion: 'Version 24H2',
      comparison: ok({ comparedCount: 120, deviations: [], truncated: false, skippedCount: 3 }),
      ...overrides,
    });
  const templates = ok({
    templates: [
      {
        id: 'tpl-new',
        baseId: 'b',
        displayName: 'Windows',
        displayVersion: 'Version 24H2',
        lifecycleState: 'active',
        templateFamily: 'baseline',
        platforms: 'windows10',
      },
      {
        id: 'tpl-old',
        baseId: 'b',
        displayName: 'Windows',
        displayVersion: 'Version 23H2',
        lifecycleState: 'superseded',
        templateFamily: 'baseline',
        platforms: 'windows10',
      },
    ],
    truncated: false,
  });
  const tile = (list: CatalogPolicyConfig[], extra: Partial<TenantPosture> = {}) =>
    tileOf(
      run({
        catalogPolicies: ok({ policies: list, truncated: false }),
        policyTemplates: templates,
        ...extra,
      }),
      'postureBaselines',
    );

  it('aktuelle, zugewiesene Baseline mit Standardwerten → erfüllt, als Beta gekennzeichnet', () => {
    const t = tile([baseline()]);
    expect(t.checks.map((c) => c.status)).toEqual(['met', 'met', 'met']);
    expect(t.summary).toContain('Beta-API');
    expect(t.facts[0]?.value).toContain('Beta-API');
  });

  it('ältere Version und Abweichungen vom Standard → warning; englische Originalwerte als en gekennzeichnet', () => {
    const t = tile([
      baseline({
        templateId: 'tpl-old',
        comparison: ok({
          comparedCount: 100,
          deviations: [
            {
              settingDefinitionId: 'device_vendor_msft_x',
              settingName: 'Turn on behavior monitoring',
              configuredValue: 'Disabled',
              defaultValue: 'Enabled',
            },
            {
              settingDefinitionId: 'device_vendor_msft_y',
              settingName: null,
              configuredValue: null,
              defaultValue: 'Enabled',
            },
          ],
          truncated: false,
          skippedCount: 0,
        }),
      }),
    ]);
    expect(t.severity).toBe('warning');
    expect(t.checks.map((c) => c.status)).toEqual(['met', 'deviating', 'deviating']);
    const table = t.findings.find((f) => f.table)?.table;
    expect(table?.columnLangs).toEqual(['en', 'en', 'en']);
    expect(table?.rows[1]?.cells).toEqual([
      'device_vendor_msft_y',
      'Nicht in der Richtlinie',
      'Enabled',
    ]);
    expect(table?.rows[1]?.cellLangs).toEqual(['en', null, 'en']);
  });

  it('keine Baseline bei Windows-Geräten → warning', () => {
    const t = tile([]);
    expect(t.checks.map((c) => c.status)).toEqual(['deviating']);
    expect(t.severity).toBe('warning');
  });

  it('Vergleich nicht abgefragt bzw. Vorlagen nicht lesbar → nicht prüfbar', () => {
    const t = tile([baseline({ comparison: null })], {
      policyTemplates: forbidden('DeviceManagementConfiguration.Read.All'),
    });
    expect(t.checks.map((c) => c.status)).toEqual(['met', 'notChecked', 'notChecked']);
  });

  it('nicht zugewiesene Baseline: gekennzeichnet und nicht gezählt', () => {
    const t = tile([baseline({ isAssigned: false, templateId: 'tpl-old' })]);
    expect(t.checks.filter((c) => !c.counted)).toHaveLength(2);
    expect(t.findings.map((f) => f.id)).toContain('postureBaselines-unassigned');
  });

  it.each(ISSUES)('Quelle %s → Kachel nicht verfügbar', (name, issue) => {
    expect(tileOf(run({ catalogPolicies: issue() }), 'postureBaselines').availability).toBe(name);
  });
});

// ---------- Endpunktsicherheit ----------

describe('postureEndpointSecurity', () => {
  const families = [
    'endpointSecurityAntivirus',
    'endpointSecurityDiskEncryption',
    'endpointSecurityFirewall',
    'endpointSecurityAttackSurfaceReduction',
    'endpointSecurityAccountProtection',
  ];
  const tile = (
    list: CatalogPolicyConfig[],
    deviceCounts = counts({ windows: 10, ios: 0, macos: 2, android: 0, total: 12 }),
  ) =>
    tileOf(
      run({
        catalogPolicies: ok({ policies: list, truncated: false }),
        platformCounts: ok(deviceCounts),
      }),
      'postureEndpointSecurity',
    );

  /** Vorlagenname des empfohlenen Profils je Familie (Windows) laut Learn */
  const PROFILE: Record<string, string> = {
    endpointSecurityAntivirus: 'Microsoft Defender Antivirus',
    endpointSecurityDiskEncryption: 'BitLocker',
    endpointSecurityFirewall: 'Windows Firewall',
    endpointSecurityAttackSurfaceReduction: 'Attack Surface Reduction Rules',
    endpointSecurityAccountProtection: 'Local user group membership',
  };
  const status = (t: PostureTile, key: string) =>
    t.checks.find((c) => c.id === `postureEndpointSecurity:${key}`)?.status;

  it('alle Bereiche für Windows und macOS zugewiesen → erfüllt', () => {
    const list = [
      ...families.map((family) =>
        // Groß-/Kleinschreibung egal
        catalogPolicy({
          templateFamily: family,
          templateDisplayName: PROFILE[family]?.toUpperCase(),
        }),
      ),
      ...[
        'endpointSecurityAntivirus',
        'endpointSecurityDiskEncryption',
        'endpointSecurityFirewall',
      ].map((family) => catalogPolicy({ templateFamily: family, platforms: 'macOS' })),
    ];
    const t = tile(list);
    expect(t.checks).toHaveLength(8);
    expect(t.checks.every((c) => c.status === 'met')).toBe(true);
    expect(t.value).toBe('8 von 8 abgedeckt');
    expect(t.summary).toContain('Beta-API');
  });

  it('macOS ohne Geräte wird nicht geprüft; fehlende Bereiche → warning', () => {
    const t = tile(
      [
        catalogPolicy({
          templateFamily: 'endpointSecurityAntivirus',
          templateDisplayName: 'Microsoft Defender Antivirus',
        }),
      ],
      counts({ windows: 10, ios: 0, macos: 0, android: 0, total: 10 }),
    );
    expect(t.checks).toHaveLength(5);
    expect(t.checks.filter((c) => c.status === 'deviating')).toHaveLength(4);
    expect(t.severity).toBe('warning');
  });

  it('nicht zugewiesene Richtlinie erfüllt nicht', () => {
    const t = tile([
      catalogPolicy({
        templateFamily: 'endpointSecurityFirewall',
        templateDisplayName: 'Windows Firewall',
        isAssigned: false,
      }),
    ]);
    expect(t.checks.find((c) => c.id.endsWith('firewallWindows'))?.status).toBe('deviating');
  });

  describe('Bereich ≠ empfohlenes Profil (Zuordnung über den Vorlagennamen)', () => {
    it('Windows LAPS erfüllt „lokale Gruppenmitgliedschaft“ nicht → nicht prüfbar mit Liste', () => {
      const t = tile([
        catalogPolicy({
          name: 'Contoso LAPS',
          templateFamily: 'endpointSecurityAccountProtection',
          templateDisplayName: 'Local admin password solution (Windows LAPS)',
        }),
      ]);
      expect(status(t, 'accountProtectionWindows')).toBe('notChecked');
      const check = t.checks.find((c) => c.id.endsWith(':accountProtectionWindows'));
      expect(check?.expected).toContain('„Local user group membership“');
      expect(check?.reason).toContain('Profiltyp nicht eindeutig');
      const finding = t.findings.find(
        (f) => f.id === 'postureEndpointSecurity-accountProtectionWindows-ambiguous',
      );
      expect(finding?.severity).toBe('unknown');
      expect(finding?.table?.rows[0]?.cells).toEqual([
        'Contoso LAPS',
        'Local admin password solution (Windows LAPS)',
        'Ja',
      ]);
      expect(finding?.table?.rows[0]?.cellLangs).toEqual([null, 'en', null]);
      expect(finding?.docsUrl).toMatch(LEARN);
    });

    it('Device control erfüllt „ASR-Regeln“ nicht; fehlender Vorlagenname → nicht prüfbar', () => {
      const t = tile([
        catalogPolicy({
          templateFamily: 'endpointSecurityAttackSurfaceReduction',
          templateDisplayName: 'Device Control',
        }),
        catalogPolicy({
          templateFamily: 'endpointSecurityDiskEncryption',
          templateDisplayName: null,
        }),
      ]);
      expect(status(t, 'asrWindows')).toBe('notChecked');
      expect(status(t, 'diskEncryptionWindows')).toBe('notChecked');
      const disk = t.findings.find(
        (f) => f.id === 'postureEndpointSecurity-diskEncryptionWindows-ambiguous',
      );
      expect(disk?.table?.rows[0]?.cells[1]).toBe('Kein Vorlagenname geliefert');
    });

    it('passendes Profil zugewiesen → erfüllt, auch neben anderen Profilen der Familie', () => {
      const t = tile([
        catalogPolicy({
          templateFamily: 'endpointSecurityAttackSurfaceReduction',
          templateDisplayName: 'Device control',
        }),
        catalogPolicy({
          templateFamily: 'endpointSecurityAttackSurfaceReduction',
          templateDisplayName: ' Attack Surface Reduction Rules ',
        }),
      ]);
      expect(status(t, 'asrWindows')).toBe('met');
      expect(t.findings.map((f) => f.id)).not.toContain(
        'postureEndpointSecurity-asrWindows-ambiguous',
      );
    });

    it('nur nicht zugewiesene Richtlinien der Familie → weicht ab (wie bisher)', () => {
      const t = tile([
        catalogPolicy({
          templateFamily: 'endpointSecurityAccountProtection',
          templateDisplayName: 'Account protection',
          isAssigned: false,
        }),
      ]);
      expect(status(t, 'accountProtectionWindows')).toBe('deviating');
      const finding = t.findings.find(
        (f) => f.id === 'postureEndpointSecurity-accountProtectionWindows',
      );
      expect(finding?.detail).toContain('„Local user group membership“');
    });

    it('macOS: FileVault ist das einzige Profil der Familie → kein Namensvergleich', () => {
      const t = tile([
        catalogPolicy({
          templateFamily: 'endpointSecurityDiskEncryption',
          platforms: 'macOS',
          templateDisplayName: null,
        }),
      ]);
      expect(status(t, 'diskEncryptionMacos')).toBe('met');
    });

    it('die Heuristik ist in der Kachel ausgewiesen', () => {
      const t = tile([]);
      expect(t.facts.find((f) => f.label === 'Zuordnung zum Profil')?.value).toContain('Heuristik');
    });
  });
});

// ---------- Secure Score ----------

describe('postureSecureScore', () => {
  const tile = (controls: SecureScoreControl[]) =>
    tileOf(
      run({
        secureScore: ok({
          currentScore: 50,
          maxScore: 100,
          createdDateTime: '2026-11-24T00:00:00Z',
          controls,
        }),
      }),
      'postureSecureScore',
    );

  it('filtert auf die Kategorie Device, zählt volle Punktzahl als erfüllt, Microsoft-Texte als en', () => {
    const t = tile([
      control({ score: 10, maxScore: 10 }),
      control({ score: 4, maxScore: 10 }),
      control({ score: null }),
      control({ category: 'Identity', service: 'AzureAD' }),
      // Dienst „Intune“ allein genügt nicht mehr – nur die Kategorie zählt
      control({ category: 'Apps', service: 'Intune' }),
      control({ deprecated: true }),
    ]);
    expect(t.checks.map((c) => c.status)).toEqual(['met', 'deviating', 'notChecked']);
    expect(t.findings.find((f) => f.id === 'postureSecureScore-open')?.detail).toContain(
      '„Risiko akzeptiert“',
    );
    expect(t.facts.find((f) => f.label === 'Bearbeitungsstatus')?.value).toContain(
      'Risiko akzeptiert',
    );
    expect(t.severity).toBe('warning');
    const open = t.findings.find((f) => f.id === 'postureSecureScore-open');
    expect(open?.table?.columnLangs).toEqual(['en', null, 'en', 'en']);
    const detail = t.findings.find((f) => f.id.startsWith('postureSecureScore-control-'));
    expect(detail?.titleLang).toBe('en');
    expect(detail?.detailLang).toBe('en');
  });

  it('keine Geräte-Empfehlungen → ruhiger Hinweis, nie „erfüllt“', () => {
    const t = tile([control({ category: 'Identity', service: 'AzureAD' })]);
    expect(t.severity).toBe('unknown');
    expect(t.checks).toEqual([]);
    expect(t.value).toBe('Keine Geräte-Empfehlungen gemeldet');
    expect(t.value).not.toContain('erfüllt');
    expect(postureScore([t]).total).toBe(0);
  });

  it.each(ISSUES)('Quelle %s → Kachel nicht verfügbar', (name, issue) => {
    expect(tileOf(run({ secureScore: issue() }), 'postureSecureScore').availability).toBe(name);
  });
});

// ---------- Stufenlogik „soweit prüfbar“ ----------

describe('evaluateFramework – erreichte Stufe soweit prüfbar', () => {
  const check = (
    id: CatalogCheck['id'],
    level: PostureLevel,
    status: CheckOutcome['status'],
  ): CatalogCheck => ({
    id,
    properties: [],
    level,
    docsUrl: 'https://learn.microsoft.com/',
    satisfiedBy: { settings: {} },
    deviatingWith: { settings: {} },
    evaluate: () => ({ status, actual: status }),
  });
  const framework = (
    checks: CatalogCheck[],
    uncheckable: PostureFramework['uncheckable'] = [],
  ): PostureFramework => ({
    id: 'synthetic',
    levels: [2, 3],
    docsUrl: 'https://learn.microsoft.com/',
    checks,
    uncheckable,
  });

  it('alles prüfbar und erfüllt → Stufe vollständig erreicht', () => {
    const result = evaluateFramework(
      framework([check('iosJailbreak', 2, 'met'), check('iosPasscodeExpiration', 3, 'met')]),
      { settings: {} },
      3,
    );
    expect(result).toMatchObject({ reached: 3, reachedComplete: true });
  });

  it('nicht prüfbare Prüfung verhindert die Stufe nicht, bestätigt sie aber nicht', () => {
    const result = evaluateFramework(
      framework([check('iosJailbreak', 2, 'met'), check('iosThreatLevel', 3, 'notChecked')]),
      { settings: {} },
      3,
    );
    expect(result).toMatchObject({ reached: 3, reachedComplete: false });
  });

  it('Learn-Empfehlung ohne v1.0-Eigenschaft bis zur Stufe → nur soweit prüfbar', () => {
    const result = evaluateFramework(
      framework(
        [check('iosJailbreak', 2, 'met')],
        [
          {
            id: 'iosMdeRisk',
            level: 3,
            docsUrl: 'https://learn.microsoft.com/',
            reason: 'noV1Property',
          },
        ],
      ),
      { settings: {} },
      3,
    );
    expect(result).toMatchObject({ reached: 3, reachedComplete: false });
    // Für Stufe 2 allein ist alles prüfbar
    const level2 = evaluateFramework(
      framework(
        [check('iosJailbreak', 2, 'met'), check('iosPasscodeExpiration', 3, 'deviating')],
        [
          {
            id: 'iosMdeRisk',
            level: 3,
            docsUrl: 'https://learn.microsoft.com/',
            reason: 'noV1Property',
          },
        ],
      ),
      { settings: {} },
      3,
    );
    expect(level2).toMatchObject({ reached: 2, reachedComplete: true });
  });
});

// ---------- Gesamtbild ----------

describe('postureScore', () => {
  it('zählt gezählte Einzelprüfungen aller Kacheln, auch über Kopien hinweg', () => {
    const tiles = run({
      compliancePolicies: policies([
        compliance('windows10', satisfying(WINDOWS_COMPLIANCE)),
        compliance('ios', satisfying(IOS_COMPLIANCE)),
        compliance('androidWorkProfile', satisfying(ANDROID_WORK_PROFILE_COMPLIANCE)),
      ]),
      conditionalAccess: ok({ policies: [caPolicy({})], truncated: false }),
    });
    const checks = evaluatePostureChecks(
      posture({
        compliancePolicies: policies([
          compliance('windows10', satisfying(WINDOWS_COMPLIANCE)),
          compliance('ios', satisfying(IOS_COMPLIANCE)),
          compliance('androidWorkProfile', satisfying(ANDROID_WORK_PROFILE_COMPLIANCE)),
        ]),
        conditionalAccess: ok({ policies: [caPolicy({})], truncated: false }),
      }),
      { level: 2, now: NOW },
    ).filter((c) => c.counted);
    const score = postureScore(tiles.map((tile) => ({ ...tile })));
    expect(score.total).toBe(checks.length);
    expect(score.met + score.deviating + score.notChecked).toBe(score.total);
    expect(score.met).toBe(checks.filter((c) => c.status === 'met').length);
    expect(score.deviating).toBeGreaterThan(0); // u. a. App-Schutz und Baselines fehlen
  });

  it('gewöhnliche Kacheln ohne Prüfungen zählen nicht', () => {
    const plain: Tile = { ...run()[0]!, checks: undefined } as unknown as Tile;
    expect(postureScore([plain])).toEqual({ met: 0, deviating: 0, notChecked: 0, total: 0 });
  });

  it('Katalog ist vollständig über ALL_FRAMEWORKS erreichbar', () => {
    expect(ALL_FRAMEWORKS).toHaveLength(6);
  });
});
