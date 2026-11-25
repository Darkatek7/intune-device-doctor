/** M21/S1: Mapper der Ansicht „Empfehlungen“ (fiktive Contoso-Daten). */
import { describe, expect, it } from 'vitest';
import {
  ANDROID_APP_PROTECTION_FIELDS,
  ANDROID_COMPLIANCE_SETTING_FIELDS,
  IOS_APP_PROTECTION_FIELDS,
  IOS_COMPLIANCE_SETTING_FIELDS,
  MACOS_COMPLIANCE_SETTING_FIELDS,
  WINDOWS10_COMPLIANCE_SETTING_FIELDS,
} from './dto';
import {
  htmlToPlainText,
  mapAppProtectionPolicies,
  mapBaselineComparison,
  mapCatalogPolicies,
  mapCompliancePolicies,
  mapComplianceTenantSettings,
  mapConditionalAccessPolicies,
  mapPlatformCounts,
  mapPolicyTemplates,
  mapScheduledActionItems,
  mapSecureScore,
} from './mappers';

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const GROUP_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const ROLE_ID = 'cccccccc-0000-4000-8000-000000000003';
const APP_ID = 'dddddddd-0000-4000-8000-000000000004';
const TENANT_ID = 'eeeeeeee-0000-4000-8000-000000000005';

describe('mapComplianceTenantSettings', () => {
  it('übernimmt secureByDefault und die Prüfintervall-Tage, ignoriert isScheduledActionEnabled', () => {
    const result = mapComplianceTenantSettings({
      settings: {
        secureByDefault: true,
        deviceComplianceCheckinThresholdDays: 30,
        isScheduledActionEnabled: true,
      },
    });
    expect(result).toEqual({ secureByDefault: true, deviceComplianceCheckinThresholdDays: 30 });
  });
  it('liefert null ohne settings, null-Werte bleiben null', () => {
    expect(mapComplianceTenantSettings({})).toBeNull();
    expect(mapComplianceTenantSettings(null)).toBeNull();
    expect(mapComplianceTenantSettings({ settings: { secureByDefault: null } })).toEqual({
      secureByDefault: null,
      deviceComplianceCheckinThresholdDays: null,
    });
  });
});

describe('mapPlatformCounts', () => {
  it('liest die Zähler und zählt Android nicht doppelt', () => {
    const counts = mapPlatformCounts({
      enrolledDeviceCount: 42,
      deviceOperatingSystemSummary: {
        windowsCount: 20,
        iosCount: 8,
        macOSCount: 3,
        androidCount: 11,
        androidFullyManagedCount: 4,
        androidWorkProfileCount: 7,
      },
    });
    // Unternehmenseigen unbekannt: COPE- und Dediziert-Zähler fehlen
    expect(counts).toEqual({
      windows: 20,
      ios: 8,
      macos: 3,
      android: 11,
      androidPersonal: 7,
      androidCorporate: null,
      total: 42,
    });
  });
  it('trennt Android in persönlich (Arbeitsprofil) und unternehmenseigen; Geräteadministrator in keiner Gruppe', () => {
    const counts = mapPlatformCounts({
      deviceOperatingSystemSummary: {
        androidCount: 20,
        androidWorkProfileCount: 11,
        androidFullyManagedCount: 2,
        androidCorporateWorkProfileCount: 1,
        androidDedicatedCount: 1,
        androidDeviceAdminCount: 5,
      },
    });
    expect(counts.android).toBe(20);
    expect(counts.androidPersonal).toBe(11);
    expect(counts.androidCorporate).toBe(4);
  });
  it('unternehmenseigen ist unbekannt, wenn ein Teilzähler fehlt oder -1 ist', () => {
    expect(
      mapPlatformCounts({
        deviceOperatingSystemSummary: {
          androidFullyManagedCount: 0,
          androidCorporateWorkProfileCount: -1,
          androidDedicatedCount: 0,
        },
      }).androidCorporate,
    ).toBeNull();
    expect(
      mapPlatformCounts({
        deviceOperatingSystemSummary: {
          androidFullyManagedCount: 0,
          androidCorporateWorkProfileCount: 0,
          androidDedicatedCount: 0,
        },
      }).androidCorporate,
    ).toBe(0);
  });
  it('nutzt die Summe der Untertypen, wenn sie größer ist; fehlende Werte → null', () => {
    expect(
      mapPlatformCounts({
        deviceOperatingSystemSummary: {
          androidCount: 0,
          androidDedicatedCount: 2,
          androidDeviceAdminCount: 1,
        },
      }).android,
    ).toBe(3);
    expect(mapPlatformCounts(null)).toEqual({
      windows: null,
      ios: null,
      macos: null,
      android: null,
      androidPersonal: null,
      androidCorporate: null,
      total: null,
    });
    expect(
      mapPlatformCounts({ deviceOperatingSystemSummary: { windowsCount: -1 } }).windows,
    ).toBeNull();
  });
});

describe('mapCompliancePolicies', () => {
  it('übernimmt je Typ genau die dokumentierten Einstellungen unter Graph-Namen', () => {
    const [win, ios, mac, android, work] = mapCompliancePolicies([
      {
        '@odata.type': '#microsoft.graph.windows10CompliancePolicy',
        id: 'w',
        displayName: 'Contoso Windows',
        lastModifiedDateTime: '2026-10-01T10:00:00Z',
        bitLockerEnabled: true,
        passwordMinimumLength: 8,
        passwordRequiredType: 'alphanumeric',
        osMinimumVersion: null,
        description: 'wird nie übernommen',
        version: 3,
      } as never,
      {
        '@odata.type': '#microsoft.graph.iosCompliancePolicy',
        id: 'i',
        passcodeRequired: true,
      } as never,
      {
        '@odata.type': '#microsoft.graph.macOSCompliancePolicy',
        id: 'm',
        firewallEnabled: false,
      } as never,
      {
        '@odata.type': '#microsoft.graph.androidCompliancePolicy',
        id: 'a',
        securityBlockJailbrokenDevices: true,
      } as never,
      {
        '@odata.type': '#microsoft.graph.androidWorkProfileCompliancePolicy',
        id: 'p',
        storageRequireEncryption: true,
      } as never,
    ]);
    expect(win).toMatchObject({
      id: 'w',
      displayName: 'Contoso Windows',
      type: 'windows10',
      odataType: '#microsoft.graph.windows10CompliancePolicy',
      lastModifiedDateTime: '2026-10-01T10:00:00Z',
      assigned: null,
      scheduledActions: null,
    });
    expect(win!.settings).toEqual({
      bitLockerEnabled: true,
      passwordMinimumLength: 8,
      passwordRequiredType: 'alphanumeric',
      osMinimumVersion: null,
    });
    expect(ios).toMatchObject({ type: 'ios', settings: { passcodeRequired: true } });
    expect(mac).toMatchObject({ type: 'macos', settings: { firewallEnabled: false } });
    expect(android).toMatchObject({
      type: 'androidDeviceAdministrator',
      settings: { securityBlockJailbrokenDevices: true },
    });
    expect(work).toMatchObject({
      type: 'androidWorkProfile',
      settings: { storageRequireEncryption: true },
    });
  });

  it('andere Typen → other ohne Einstellungen; unbekannte Felder werden nie durchgereicht', () => {
    const [other, win] = mapCompliancePolicies([
      {
        '@odata.type': '#microsoft.graph.androidDeviceOwnerCompliancePolicy',
        id: 'o',
        passwordRequired: true,
      } as never,
      {
        '@odata.type': '#microsoft.graph.windows10CompliancePolicy',
        id: 'w',
        somethingNew: true,
        passcodeRequired: true, // iOS-Feld an einer Windows-Richtlinie
        bitLockerEnabled: { nested: true },
      } as never,
      { id: '' } as never,
    ]);
    expect(other).toMatchObject({ type: 'other', settings: {} });
    expect(win!.settings).toEqual({});
  });

  it('Allowlists enthalten keine Basiseigenschaften', () => {
    const base = [
      'id',
      'displayName',
      'description',
      'version',
      'createdDateTime',
      'lastModifiedDateTime',
    ];
    for (const list of [
      WINDOWS10_COMPLIANCE_SETTING_FIELDS,
      IOS_COMPLIANCE_SETTING_FIELDS,
      MACOS_COMPLIANCE_SETTING_FIELDS,
      ANDROID_COMPLIANCE_SETTING_FIELDS,
      IOS_APP_PROTECTION_FIELDS,
      ANDROID_APP_PROTECTION_FIELDS,
    ]) {
      for (const field of base) expect(list as readonly string[]).not.toContain(field);
    }
  });
});

describe('mapScheduledActionItems', () => {
  it('nimmt actionType und gracePeriodHours, nie Vorlage oder CC-Gruppen', () => {
    const actions = mapScheduledActionItems([
      {
        actionType: 'block',
        gracePeriodHours: 24,
        notificationTemplateId: 'tpl',
        notificationMessageCCList: [GROUP_ID],
      } as never,
      { actionType: 'notification', gracePeriodHours: -1 },
      { gracePeriodHours: 1 },
    ]);
    expect(actions).toEqual([
      { actionType: 'block', gracePeriodHours: 24 },
      { actionType: 'notification', gracePeriodHours: null },
    ]);
    expect(JSON.stringify(actions)).not.toContain(GROUP_ID);
  });
});

describe('mapAppProtectionPolicies', () => {
  it('übernimmt geerbte und plattformeigene Einstellungen; isAssigned und deployedAppCount getrennt', () => {
    const [ios] = mapAppProtectionPolicies(
      [
        {
          id: 'p1',
          displayName: 'Contoso iOS MAM',
          lastModifiedDateTime: '2026-09-01T00:00:00Z',
          isAssigned: true,
          deployedAppCount: 6,
          pinRequired: true,
          minimumPinLength: 6,
          allowedDataStorageLocations: ['oneDriveForBusiness', 'sharePoint'],
          faceIdBlocked: false,
          screenCaptureBlocked: true, // Android-Feld an iOS-Richtlinie
          description: 'nie',
        } as never,
      ],
      'ios',
    );
    expect(ios).toMatchObject({ platform: 'ios', assigned: true, deployedAppCount: 6 });
    expect(ios!.settings).toEqual({
      pinRequired: true,
      minimumPinLength: 6,
      allowedDataStorageLocations: 'oneDriveForBusiness,sharePoint',
      faceIdBlocked: false,
    });
    const [android] = mapAppProtectionPolicies(
      [
        {
          id: 'p2',
          screenCaptureBlocked: true,
          allowedDataStorageLocations: [],
          isAssigned: null,
        } as never,
      ],
      'android',
    );
    expect(android!.settings).toEqual({
      screenCaptureBlocked: true,
      allowedDataStorageLocations: '',
    });
    expect(android).toMatchObject({ assigned: null, deployedAppCount: null, displayName: 'p2' });
  });
});

describe('mapConditionalAccessPolicies', () => {
  const policy = {
    id: 'ca-1',
    displayName: 'Contoso: Konformes Gerät verlangen',
    state: 'enabled',
    conditions: {
      users: {
        includeUsers: ['All'],
        excludeUsers: [USER_ID],
        excludeGroups: [GROUP_ID],
        excludeRoles: [ROLE_ID],
      },
      applications: { includeApplications: ['All'], excludeApplications: [APP_ID] },
      platforms: { includePlatforms: ['android', 'iOS'] },
    },
    grantControls: { operator: 'OR', builtInControls: ['compliantDevice', 'mfa'] },
  };

  it('übernimmt nur boolesche Merkmale und Steuerelemente – keine IDs', () => {
    const [mapped] = mapConditionalAccessPolicies([policy as never]);
    expect(mapped).toEqual({
      id: 'ca-1',
      displayName: 'Contoso: Konformes Gerät verlangen',
      state: 'enabled',
      builtInControls: ['compliantDevice', 'mfa'],
      grantOperator: 'OR',
      includesAllUsers: true,
      includesAllApplications: true,
      hasUserExclusions: true,
      includePlatforms: ['android', 'iOS'],
    });
    const json = JSON.stringify(mapped);
    for (const secret of [USER_ID, GROUP_ID, ROLE_ID, APP_ID]) expect(json).not.toContain(secret);
  });

  it('erkennt fehlende Ausschlüsse, unbekannten Zustand und fehlende Bedingungen', () => {
    const [a, b] = mapConditionalAccessPolicies([
      {
        id: 'x',
        state: 'unknownFutureValue',
        conditions: { users: { includeUsers: [USER_ID], excludeUsers: [], excludeGroups: null } },
      } as never,
      { id: 'y', state: 'enabledForReportingButNotEnforced' } as never,
    ]);
    expect(a).toMatchObject({
      state: 'unknown',
      includesAllUsers: false,
      hasUserExclusions: false,
      builtInControls: [],
      grantOperator: null,
    });
    expect(JSON.stringify(a)).not.toContain(USER_ID);
    expect(b).toMatchObject({ state: 'enabledForReportingButNotEnforced', includePlatforms: [] });
  });

  it('Ausschluss von Gäste-Gruppen zählt als Ausschluss', () => {
    const [mapped] = mapConditionalAccessPolicies([
      {
        id: 'g',
        conditions: {
          users: {
            excludeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'b2bCollaborationGuest' },
          },
        },
      } as never,
    ]);
    expect(mapped!.hasUserExclusions).toBe(true);
  });
});

describe('htmlToPlainText', () => {
  it('entfernt Tags, dekodiert Entitäten einmal, bricht Zeilen um', () => {
    expect(
      htmlToPlainText(
        '<p>Enable <b>MFA</b> &amp; review</p><ul><li>Step&nbsp;1</li><li>Step 2</li></ul>',
      ),
    ).toBe('Enable MFA & review\nStep 1\nStep 2');
    expect(htmlToPlainText('a<br>b<br/>c')).toBe('a\nb\nc');
    expect(htmlToPlainText('&amp;lt;b&amp;gt;')).toBe('&lt;b&gt;');
    expect(htmlToPlainText('&#65;&#x42;&#0;&#xD800;&unknown;')).toBe('AB&#0;&#xD800;&unknown;');
  });
  it('entfernt Skript-/Stilblöcke und Kommentare samt Inhalt; Tags aus Entitäten bleiben Text', () => {
    expect(htmlToPlainText('x<script>alert(1)</script><style>p{}</style><!-- c -->y')).toBe('x y');
    expect(htmlToPlainText('&lt;img src=x onerror=1&gt;')).toBe('<img src=x onerror=1>');
  });
  it('leer, nicht-String → null; constructor-Entität wird nicht aufgelöst', () => {
    expect(htmlToPlainText('  <p> </p> ')).toBeNull();
    expect(htmlToPlainText(null)).toBeNull();
    expect(htmlToPlainText(5)).toBeNull();
    expect(htmlToPlainText('&constructor;')).toBe('&constructor;');
  });
});

describe('mapSecureScore', () => {
  const score = {
    id: 'ss',
    createdDateTime: '2026-11-24T00:00:00Z',
    currentScore: 120.5,
    maxScore: 300,
    azureTenantId: TENANT_ID,
    controlScores: [
      {
        controlName: 'IntuneCompliance',
        controlCategory: 'Device',
        score: 5,
        description: '<p>Use <b>compliance</b> policies</p>',
      },
      { controlName: 'Unbekannt', score: 1 },
      { controlCategory: 'Device' },
    ],
  };
  const profiles = [
    {
      id: 'IntuneCompliance',
      title: 'Enable compliance policies',
      controlCategory: 'Device',
      service: 'Intune',
      maxScore: 10,
      remediation: 'Go to <a href="x">Intune</a> &amp; configure.',
      actionUrl: 'https://intune.microsoft.com/#view',
      implementationCost: 'Low',
      userImpact: 'Moderate',
      deprecated: false,
      azureTenantId: TENANT_ID,
      controlStateUpdates: [{ updatedBy: 'anna.schmidt@contoso.com' }],
    },
    { id: 'Andere', title: 'x', actionUrl: 'javascript:alert(1)' },
  ];

  it('verbindet controlScores mit Profilen über den Kontrollnamen; Texte als reiner Text; keine Mandanten-ID', () => {
    const info = mapSecureScore(score as never, profiles as never);
    expect(info).toMatchObject({
      currentScore: 120.5,
      maxScore: 300,
      createdDateTime: '2026-11-24T00:00:00Z',
    });
    expect(info!.controls).toHaveLength(2);
    expect(info!.controls[0]).toEqual({
      id: 'IntuneCompliance',
      title: 'Enable compliance policies',
      category: 'Device',
      service: 'Intune',
      score: 5,
      maxScore: 10,
      description: 'Use compliance policies',
      remediation: 'Go to Intune & configure.',
      actionUrl: 'https://intune.microsoft.com/#view',
      implementationCost: 'Low',
      userImpact: 'Moderate',
      deprecated: false,
    });
    expect(info!.controls[1]).toMatchObject({
      id: 'Unbekannt',
      title: null,
      service: null,
      maxScore: null,
    });
    const json = JSON.stringify(info);
    expect(json).not.toContain(TENANT_ID);
    expect(json).not.toContain('anna.schmidt');
  });

  it('nur https-Links als actionUrl; fehlender Score → null', () => {
    const info = mapSecureScore(
      { controlScores: [{ controlName: 'Andere', score: 0 }] } as never,
      profiles as never,
    );
    expect(info!.controls[0]!.actionUrl).toBeNull();
    expect(mapSecureScore(null, [])).toBeNull();
  });
});

describe('mapCatalogPolicies / mapPolicyTemplates', () => {
  it('übernimmt templateReference und gibt comparison null', () => {
    const [policy, plain] = mapCatalogPolicies([
      {
        id: 'p1',
        name: 'Contoso Baseline',
        platforms: 'windows10',
        technologies: 'mdm',
        settingCount: 120,
        isAssigned: true,
        lastModifiedDateTime: '2026-10-10T00:00:00Z',
        templateReference: {
          templateId: 't1',
          templateFamily: 'baseline',
          templateDisplayName: 'Windows security baseline',
          templateDisplayVersion: 'Version 24H2',
        },
      },
      { id: 'p2', name: 'Katalog' },
      { id: '' } as never,
    ]);
    expect(policy).toMatchObject({
      templateFamily: 'baseline',
      templateId: 't1',
      templateDisplayName: 'Windows security baseline',
      settingCount: 120,
      isAssigned: true,
      comparison: null,
    });
    expect(plain).toMatchObject({ templateFamily: 'none', templateId: null, isAssigned: null });
  });
  it('Vorlagen: lifecycleState und baseId', () => {
    expect(
      mapPolicyTemplates([
        {
          id: 't1',
          baseId: 'b',
          displayName: 'Baseline',
          displayVersion: 'v2',
          lifecycleState: 'active',
          templateFamily: 'baseline',
          platforms: 'windows10',
        },
      ]),
    ).toEqual([
      {
        id: 't1',
        baseId: 'b',
        displayName: 'Baseline',
        displayVersion: 'v2',
        lifecycleState: 'active',
        templateFamily: 'baseline',
        platforms: 'windows10',
      },
    ]);
  });
});

describe('mapBaselineComparison', () => {
  const choiceTemplate = (definitionId: string, optionId: string | null, extra: object = {}) => ({
    settingInstanceTemplate: {
      settingDefinitionId: definitionId,
      isRequired: true,
      choiceSettingValueTemplate: {
        defaultValue: { settingDefinitionOptionId: optionId, ...extra },
      },
    },
  });
  const simpleTemplate = (
    definitionId: string,
    constantValue: string | number | null,
    isRequired = true,
  ) => ({
    settingInstanceTemplate: {
      settingDefinitionId: definitionId,
      isRequired,
      simpleSettingValueTemplate: { defaultValue: { constantValue } },
    },
  });
  const choice = (definitionId: string, value: string) => ({
    settingInstance: {
      settingDefinitionId: definitionId,
      choiceSettingValue: { value, children: [] },
    },
  });
  const simple = (definitionId: string, value: string | number) => ({
    settingInstance: { settingDefinitionId: definitionId, simpleSettingValue: { value } },
  });
  const noTrunc = { policySettingsTruncated: false, templateSettingsTruncated: false };

  it('vergleicht Auswahl und Einfachwerte, meldet Abweichungen mit Roh-IDs', () => {
    const result = mapBaselineComparison(
      [choice('d_a', 'd_a_1'), choice('d_b', 'd_b_0'), simple('d_c', 14), simple('d_d', 'x')],
      [
        choiceTemplate('d_a', 'd_a_1'),
        choiceTemplate('d_b', 'd_b_1'),
        simpleTemplate('d_c', 14),
        simpleTemplate('d_d', 'y'),
      ] as never,
      noTrunc,
    );
    expect(result.comparedCount).toBe(4);
    expect(result.skippedCount).toBe(0);
    expect(result.truncated).toBe(false);
    expect(result.deviations).toEqual([
      {
        settingDefinitionId: 'd_b',
        settingName: null,
        configuredValue: 'd_b_0',
        defaultValue: 'd_b_1',
      },
      { settingDefinitionId: 'd_d', settingName: null, configuredValue: 'x', defaultValue: 'y' },
    ]);
  });

  it('zählt nicht vergleichbare Einstellungen in skippedCount', () => {
    const result = mapBaselineComparison(
      [choice('d_a', 'd_a_1'), simple('d_s', 'text')],
      [
        choiceTemplate('d_a', 'd_a_1', { children: [{}, {}] }), // 2 Unter-Vorlagen
        choiceTemplate('d_x', null), // kein Standardwert
        { settingInstanceTemplate: { settingDefinitionId: 'd_g' } }, // anderer Typ (z. B. Gruppe)
        { settingInstanceTemplate: null },
        simpleTemplate('d_s', 5), // Typ stimmt (Einfachwert), Wert weicht ab
        simpleTemplate('d_n', 'x', false), // nicht erforderlich und nicht in der Richtlinie
        choiceTemplate('d_m', 'd_m_1'), // Auswahl in Vorlage, fehlt aber nicht erforderlich? → erforderlich ⇒ Abweichung
      ] as never,
      noTrunc,
    );
    expect(result.skippedCount).toBe(2 + 1 + 1 + 1 + 1);
    expect(result.comparedCount).toBe(3);
    expect(result.deviations.map((d) => d.settingDefinitionId)).toEqual(['d_s', 'd_m']);
    expect(result.deviations[1]).toMatchObject({ configuredValue: null, defaultValue: 'd_m_1' });
  });

  it('Typkonflikt (Vorlage Auswahl, Richtlinie Einfachwert) wird übersprungen, nicht verglichen', () => {
    const result = mapBaselineComparison(
      [simple('d_a', 'x')],
      [choiceTemplate('d_a', 'o')] as never,
      noTrunc,
    );
    expect(result).toMatchObject({ comparedCount: 0, skippedCount: 1, deviations: [] });
  });

  it('abgeschnittene Einstellungsliste: „fehlt“ ist keine Abweichung; truncated wird gesetzt', () => {
    const result = mapBaselineComparison([], [choiceTemplate('d_m', 'o')] as never, {
      policySettingsTruncated: true,
      templateSettingsTruncated: false,
    });
    expect(result).toMatchObject({
      comparedCount: 0,
      skippedCount: 1,
      deviations: [],
      truncated: true,
    });
    expect(
      mapBaselineComparison([], [], {
        policySettingsTruncated: false,
        templateSettingsTruncated: true,
      }).truncated,
    ).toBe(true);
  });
});
