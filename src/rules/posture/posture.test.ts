/** M21/S2: Regelwerk „Empfehlungen“ – Kacheln, Stufenlogik, Gesamtbild. Testdaten fiktiv (Contoso). */
import { describe, expect, it } from 'vitest';
import type {
  AppProtectionPolicyConfig,
  CatalogPolicyConfig,
  CompliancePolicyConfig,
  ConditionalAccessPolicyConfig,
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
  ANDROID_WORK_PROFILE_COMPLIANCE,
  APP_PROTECTION_ANDROID,
  APP_PROTECTION_IOS,
  IOS_COMPLIANCE,
  WINDOWS_COMPLIANCE,
} from './catalog';
import type { PostureFramework, PostureTile } from './types';

const LEARN = /^https:\/\/learn\.microsoft\.com\//;
const NOW = new Date('2026-11-25T12:00:00Z');
const SOURCE: DataSource = { kind: 'mock', label: 'Contoso (Demo)' };

// ---------- Builder ----------

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
    platformCounts: ok({ windows: 10, ios: 5, macos: 0, android: 3, total: 18 }),
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
      ['postureCoverage:android', 'met'],
    ]);
    expect(t.severity).toBe('ok');
    expect(t.value).toBe('3 von 3 Plattformen abgedeckt');
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

  it('beta-Typ (vollständig verwaltet) zählt für Android', () => {
    const t = tile({
      compliancePolicies: policies([
        compliance(
          'other',
          {},
          { odataType: '#microsoft.graph.androidDeviceOwnerCompliancePolicy' },
        ),
      ]),
    });
    expect(t.checks.find((c) => c.id === 'postureCoverage:android')?.status).toBe('met');
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
      platformCounts: ok({ windows: null, ios: 0, macos: 0, android: 0, total: null }),
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
    expect(t.value).toBe('Stufe 2 erreicht');
  });

  it('iOS Stufenlogik: Stufe 3 nicht erreicht, wenn eine Stufe-3-Prüfung abweicht', () => {
    const settings = { ...satisfying(IOS_COMPLIANCE), passcodeExpirationDays: 400 };
    const level2 = tile([compliance('ios', settings)], 'postureComplianceIos', 2);
    expect(level2.value).toBe('Stufe 2 erreicht');
    expect(level2.facts.some((f) => f.value.includes('Stufe 2 erreicht'))).toBe(true);
    const level3 = tile([compliance('ios', settings)], 'postureComplianceIos', 3);
    expect(level3.severity).toBe('warning');
    expect(level3.value).not.toContain('Stufe');
    const full = tile([compliance('ios', satisfying(IOS_COMPLIANCE))], 'postureComplianceIos', 3);
    expect(full.value).toBe('Stufe 3 erreicht');
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

  it('Android-Geräteadministrator → kein Sollwert; vollständig verwaltet (beta) → nicht prüfbar', () => {
    const t = tile(
      [
        compliance('androidDeviceAdministrator', {}),
        compliance(
          'other',
          {},
          { odataType: '#microsoft.graph.androidDeviceOwnerCompliancePolicy' },
        ),
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
  });

  it('macOS: Microsoft dokumentiert keinen Sollwert', () => {
    const t = tileOf(
      run({
        platformCounts: ok({ windows: 0, ios: 0, macos: 4, android: 0, total: 4 }),
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

// ---------- App-Schutz ----------

describe('App-Schutz-Kacheln', () => {
  const tile = (list: AppProtectionPolicyConfig[], id: TileId, level: PostureLevel = 2) =>
    tileOf(run({ appProtectionPolicies: ok({ policies: list, truncated: false }) }, level), id);

  it.each([
    ['ios', APP_PROTECTION_IOS, 'postureAppProtectionIos'],
    ['android', APP_PROTECTION_ANDROID, 'postureAppProtectionAndroid'],
  ] as const)('%s: Stufe 3 vollständig erfüllt → „Stufe 3 erreicht“', (platform, framework, id) => {
    const t = tile([appPolicy(platform, satisfying(framework))], id, 3);
    expect(t.value).toBe('Stufe 3 erreicht');
    expect(t.severity).toBe('ok');
  });

  it('Stufe 1 bewertet nur Stufe-1-Prüfungen', () => {
    const t = tile(
      [appPolicy('ios', { ...satisfying(APP_PROTECTION_IOS), dataBackupBlocked: false })],
      'postureAppProtectionIos',
      1,
    );
    expect(t.checks.every((c) => c.level === null || c.level <= 1)).toBe(true);
    expect(t.value).toBe('Stufe 1 erreicht');
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
      run({ platformCounts: ok({ windows: 1, ios: 0, macos: 0, android: 0, total: 1 }) }),
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
    counts = { windows: 10, ios: 0, macos: 2, android: 0, total: 12 },
  ) =>
    tileOf(
      run({
        catalogPolicies: ok({ policies: list, truncated: false }),
        platformCounts: ok(counts),
      }),
      'postureEndpointSecurity',
    );

  it('alle Bereiche für Windows und macOS zugewiesen → erfüllt', () => {
    const list = [
      ...families.map((family) => catalogPolicy({ templateFamily: family })),
      ...[
        'endpointSecurityAntivirus',
        'endpointSecurityDiskEncryption',
        'endpointSecurityFirewall',
      ].map((family) => catalogPolicy({ templateFamily: family, platforms: 'macOS' })),
    ];
    const t = tile(list);
    expect(t.checks).toHaveLength(8);
    expect(t.checks.every((c) => c.status === 'met')).toBe(true);
    expect(t.value).toBe('8 von 8 Bereichen abgedeckt');
    expect(t.summary).toContain('Beta-API');
  });

  it('macOS ohne Geräte wird nicht geprüft; fehlende Bereiche → warning', () => {
    const t = tile([catalogPolicy({ templateFamily: 'endpointSecurityAntivirus' })], {
      windows: 10,
      ios: 0,
      macos: 0,
      android: 0,
      total: 10,
    });
    expect(t.checks).toHaveLength(5);
    expect(t.checks.filter((c) => c.status === 'deviating')).toHaveLength(4);
    expect(t.severity).toBe('warning');
  });

  it('nicht zugewiesene Richtlinie erfüllt nicht', () => {
    const t = tile([
      catalogPolicy({ templateFamily: 'endpointSecurityFirewall', isAssigned: false }),
    ]);
    expect(t.checks.find((c) => c.id.endsWith('firewallWindows'))?.status).toBe('deviating');
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

  it('filtert auf Gerät/Intune, zählt volle Punktzahl als erfüllt, Microsoft-Texte als en', () => {
    const t = tile([
      control({ score: 10, maxScore: 10 }),
      control({ score: 4, maxScore: 10 }),
      control({ category: 'Identity', service: 'AzureAD' }),
      control({ category: 'Apps', service: 'Intune', score: null }),
      control({ deprecated: true }),
    ]);
    expect(t.checks.map((c) => c.status)).toEqual(['met', 'deviating', 'notChecked']);
    expect(t.severity).toBe('warning');
    const open = t.findings.find((f) => f.id === 'postureSecureScore-open');
    expect(open?.table?.columnLangs).toEqual(['en', null, 'en', 'en']);
    const detail = t.findings.find((f) => f.id.startsWith('postureSecureScore-control-'));
    expect(detail?.titleLang).toBe('en');
    expect(detail?.detailLang).toBe('en');
  });

  it('keine Geräte-Empfehlungen → Hinweis', () => {
    const t = tile([control({ category: 'Identity', service: 'AzureAD' })]);
    expect(t.severity).toBe('unknown');
    expect(t.checks).toEqual([]);
  });

  it.each(ISSUES)('Quelle %s → Kachel nicht verfügbar', (name, issue) => {
    expect(tileOf(run({ secureScore: issue() }), 'postureSecureScore').availability).toBe(name);
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
    expect(ALL_FRAMEWORKS).toHaveLength(5);
  });
});
