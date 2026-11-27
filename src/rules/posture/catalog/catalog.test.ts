/** M21/S2: Katalog der Empfehlungen – Quellen, Vergleichsrichtung, Texte, Graph-Eigenschaftsnamen. */
import { describe, expect, it } from 'vitest';
import { dePosture } from '../../../i18n/de-posture';
import { parseIsoDurationMinutes } from '../duration';
import {
  ALL_FRAMEWORKS,
  ANDROID_FULLY_MANAGED_COMPLIANCE,
  ANDROID_WORK_PROFILE_COMPLIANCE,
  APP_PROTECTION_ANDROID,
  APP_PROTECTION_IOS,
  IOS_COMPLIANCE,
  WINDOWS_COMPLIANCE,
} from './index';
import type { CatalogCheck, PolicySubject } from '../types';

const LEARN = /^https:\/\/learn\.microsoft\.com\//;

/**
 * Eigenschaften der v1.0-Ressourcen laut Learn (abgerufen 2026-11-25). Der Katalog darf nur diese Namen
 * verwenden – sonst wäre es eine erfundene Zuordnung.
 */
const V1_PROPERTIES = {
  windows10CompliancePolicy: [
    'passwordRequired',
    'passwordBlockSimple',
    'passwordRequiredToUnlockFromIdle',
    'passwordMinutesOfInactivityBeforeLock',
    'passwordExpirationDays',
    'passwordMinimumLength',
    'passwordMinimumCharacterSetCount',
    'passwordRequiredType',
    'passwordPreviousPasswordBlockCount',
    'requireHealthyDeviceReport',
    'osMinimumVersion',
    'osMaximumVersion',
    'mobileOsMinimumVersion',
    'mobileOsMaximumVersion',
    'earlyLaunchAntiMalwareDriverEnabled',
    'bitLockerEnabled',
    'secureBootEnabled',
    'codeIntegrityEnabled',
    'storageRequireEncryption',
  ],
  iosCompliancePolicy: [
    'passcodeBlockSimple',
    'passcodeExpirationDays',
    'passcodeMinimumLength',
    'passcodeMinutesOfInactivityBeforeLock',
    'passcodePreviousPasscodeBlockCount',
    'passcodeMinimumCharacterSetCount',
    'passcodeRequiredType',
    'passcodeRequired',
    'osMinimumVersion',
    'osMaximumVersion',
    'securityBlockJailbrokenDevices',
    'deviceThreatProtectionEnabled',
    'deviceThreatProtectionRequiredSecurityLevel',
    'managedEmailProfileRequired',
  ],
  androidWorkProfileCompliancePolicy: [
    'passwordRequired',
    'passwordMinimumLength',
    'passwordRequiredType',
    'passwordMinutesOfInactivityBeforeLock',
    'passwordExpirationDays',
    'passwordPreviousPasswordBlockCount',
    'securityPreventInstallAppsFromUnknownSources',
    'securityDisableUsbDebugging',
    'securityRequireVerifyApps',
    'deviceThreatProtectionEnabled',
    'deviceThreatProtectionRequiredSecurityLevel',
    'securityBlockJailbrokenDevices',
    'osMinimumVersion',
    'osMaximumVersion',
    'minAndroidSecurityPatchLevel',
    'storageRequireEncryption',
    'securityRequireSafetyNetAttestationBasicIntegrity',
    'securityRequireSafetyNetAttestationCertifiedDevice',
    'securityRequireGooglePlayServices',
    'securityRequireUpToDateSecurityProviders',
    'securityRequireCompanyPortalAppIntegrity',
  ],
  managedAppProtection: [
    'periodOfflineBeforeAccessCheck',
    'periodOnlineBeforeAccessCheck',
    'allowedInboundDataTransferSources',
    'allowedOutboundDataTransferDestinations',
    'organizationalCredentialsRequired',
    'allowedOutboundClipboardSharingLevel',
    'dataBackupBlocked',
    'deviceComplianceRequired',
    'managedBrowserToOpenLinksRequired',
    'saveAsBlocked',
    'periodOfflineBeforeWipeIsEnforced',
    'pinRequired',
    'maximumPinRetries',
    'simplePinBlocked',
    'minimumPinLength',
    'pinCharacterSet',
    'periodBeforePinReset',
    'contactSyncBlocked',
    'printBlocked',
    'fingerprintBlocked',
    'disableAppPinIfDevicePinIsSet',
    'minimumRequiredOsVersion',
    'minimumWarningOsVersion',
    'minimumRequiredAppVersion',
    'minimumWarningAppVersion',
    'managedBrowser',
  ],
  iosManagedAppProtection: [
    'appDataEncryptionType',
    'minimumRequiredSdkVersion',
    'deployedAppCount',
    'faceIdBlocked',
    'customBrowserProtocol',
  ],
  androidManagedAppProtection: [
    'screenCaptureBlocked',
    'disableAppEncryptionIfDeviceEncryptionIsEnabled',
    'encryptAppData',
    'deployedAppCount',
    'minimumRequiredPatchVersion',
    'minimumWarningPatchVersion',
    'customBrowserPackageId',
    'customBrowserDisplayName',
  ],
};

/**
 * Eigenschaften der Beta-Ressource androidDeviceOwnerCompliancePolicy laut Learn (abgerufen 2026-11-27,
 * dritte freigegebene Beta-Ausnahme). Dieselbe Allowlist steht in `src/graph/dto.ts`
 * (`ANDROID_DEVICE_OWNER_COMPLIANCE_SETTING_FIELDS`) – nur diese Schlüssel liefert der Graph-Provider.
 */
const BETA_ANDROID_DEVICE_OWNER_PROPERTIES = [
  'deviceThreatProtectionEnabled',
  'deviceThreatProtectionRequiredSecurityLevel',
  'advancedThreatProtectionRequiredSecurityLevel',
  'securityBlockJailbrokenDevices',
  'securityRequireSafetyNetAttestationBasicIntegrity',
  'securityRequireSafetyNetAttestationCertifiedDevice',
  'osMinimumVersion',
  'osMaximumVersion',
  'minAndroidSecurityPatchLevel',
  'passwordRequired',
  'passwordMinimumLength',
  'passwordMinimumLetterCharacters',
  'passwordMinimumLowerCaseCharacters',
  'passwordMinimumNonLetterCharacters',
  'passwordMinimumNumericCharacters',
  'passwordMinimumSymbolCharacters',
  'passwordMinimumUpperCaseCharacters',
  'passwordRequiredType',
  'passwordMinutesOfInactivityBeforeLock',
  'passwordExpirationDays',
  'passwordPreviousPasswordCountToBlock',
  'storageRequireEncryption',
  'securityRequireIntuneAppIntegrity',
  'requireNoPendingSystemUpdates',
  'securityRequiredAndroidSafetyNetEvaluationType',
];

const ALLOWED_PROPERTIES = new Map([
  [WINDOWS_COMPLIANCE, V1_PROPERTIES.windows10CompliancePolicy],
  [IOS_COMPLIANCE, V1_PROPERTIES.iosCompliancePolicy],
  [ANDROID_WORK_PROFILE_COMPLIANCE, V1_PROPERTIES.androidWorkProfileCompliancePolicy],
  [ANDROID_FULLY_MANAGED_COMPLIANCE, BETA_ANDROID_DEVICE_OWNER_PROPERTIES],
  [
    APP_PROTECTION_IOS,
    [...V1_PROPERTIES.managedAppProtection, ...V1_PROPERTIES.iosManagedAppProtection],
  ],
  [
    APP_PROTECTION_ANDROID,
    [...V1_PROPERTIES.managedAppProtection, ...V1_PROPERTIES.androidManagedAppProtection],
  ],
]);

/**
 * Prüfungen, bei denen „nicht konfiguriert“ (null) bewusst nicht prüfbar ist: Bedrohungsstufe nicht
 * aktiviert – Learn empfiehlt Defender for Endpoint ODER Mobile Threat Defense, die Defender-Bewertung ist
 * über v1.0 nicht lesbar (vollständig verwaltet: Zuordnung des Portalwerts „Clear“ nicht dokumentiert).
 */
const NULL_NOT_CHECKED = new Set(['iosThreatLevel', 'awpThreatLevel', 'afmThreatLevel']);

const allChecks = ALL_FRAMEWORKS.flatMap((framework) =>
  framework.checks.map((check) => ({ framework, check })),
);

function withoutKeys(subject: PolicySubject, check: CatalogCheck): PolicySubject {
  const settings = { ...subject.settings };
  for (const property of check.properties) delete settings[property];
  return { settings, scheduledActions: null };
}

function withNull(subject: PolicySubject, check: CatalogCheck): PolicySubject {
  const settings = { ...subject.settings };
  for (const property of check.properties) settings[property] = null;
  return { settings, scheduledActions: subject.scheduledActions };
}

describe('Katalog – Quellen und Texte', () => {
  it('jede Prüfung und jede nicht prüfbare Empfehlung hat eine Learn-URL', () => {
    for (const framework of ALL_FRAMEWORKS) {
      expect(framework.docsUrl).toMatch(LEARN);
      for (const check of framework.checks) expect(check.docsUrl, check.id).toMatch(LEARN);
      for (const item of framework.uncheckable) expect(item.docsUrl, item.id).toMatch(LEARN);
    }
  });

  it('jede Prüfung hat Bezeichnung und Sollwert-Text', () => {
    for (const { check } of allChecks) {
      expect(dePosture.catalog[check.id].label, check.id).toBeTruthy();
      expect(dePosture.catalog[check.id].expected, check.id).toBeTruthy();
    }
    for (const framework of ALL_FRAMEWORKS) {
      for (const item of framework.uncheckable) {
        expect(dePosture.uncheckable[item.id].label, item.id).toBeTruthy();
        expect(dePosture.uncheckableReason[item.reason]).toBeTruthy();
      }
    }
  });

  it('IDs sind je Framework eindeutig, Stufen passen zum Framework', () => {
    for (const framework of ALL_FRAMEWORKS) {
      const ids = framework.checks.map((check) => check.id);
      expect(new Set(ids).size, framework.id).toBe(ids.length);
      for (const check of framework.checks) {
        if (framework.levels === null) expect(check.level, check.id).toBeNull();
        else expect(framework.levels, check.id).toContain(check.level);
      }
    }
  });

  it('verwendet nur auf Learn dokumentierte Eigenschaftsnamen (v1.0; vollständig verwaltet: Beta-Ressource)', () => {
    // Jedes Framework hat eine Allowlist – ein neues ohne Liste fiele sonst unbemerkt durch
    expect([...ALLOWED_PROPERTIES.keys()]).toEqual(expect.arrayContaining([...ALL_FRAMEWORKS]));
    for (const [framework, allowed] of ALLOWED_PROPERTIES) {
      for (const check of framework.checks) {
        for (const property of check.properties) {
          expect(allowed, `${framework.id}/${check.id}: ${property}`).toContain(property);
        }
      }
    }
  });

  it('Stufen laut Learn: iOS und Android-Arbeitsprofil ohne Stufe 1, Windows ungestuft', () => {
    expect(WINDOWS_COMPLIANCE.levels).toBeNull();
    expect(IOS_COMPLIANCE.levels).toEqual([2, 3]);
    expect(ANDROID_WORK_PROFILE_COMPLIANCE.levels).toEqual([2, 3]);
    expect(ANDROID_FULLY_MANAGED_COMPLIANCE.levels).toEqual([1, 2, 3]);
    expect(APP_PROTECTION_IOS.levels).toEqual([1, 2, 3]);
  });
});

describe('Katalog – App-Schutz-Tabellen vollständig', () => {
  const uncheckable = (framework: typeof APP_PROTECTION_IOS) =>
    framework.uncheckable.map((item) => [item.id, item.level, item.reason]);

  it('Stufe 2 „Kopien in ausgewählten Diensten speichern“ und Stufe 3 „Daten aus Diensten öffnen“', () => {
    for (const framework of [APP_PROTECTION_IOS, APP_PROTECTION_ANDROID]) {
      expect(uncheckable(framework)).toEqual(
        expect.arrayContaining([
          ['appSaveToServices', 2, 'enumIncomplete'],
          ['appOpenFromServices', 3, 'noV1Property'],
        ]),
      );
    }
    expect(dePosture.uncheckable.appSaveToServices.expected).toContain('Fotobibliothek');
    expect(dePosture.uncheckable.appOpenFromServices.expected).toContain('Kamera');
  });

  it('iOS Stufe 2 „Apps auswählen, die ausgenommen werden sollen“ nur für iOS', () => {
    expect(uncheckable(APP_PROTECTION_IOS)).toContainEqual(['appExemptApps', 2, 'noV1Property']);
    expect(APP_PROTECTION_ANDROID.uncheckable.map((item) => item.id)).not.toContain(
      'appExemptApps',
    );
  });
});

describe('Katalog – Vergleichsrichtung', () => {
  it.each(allChecks.map(({ framework, check }) => [`${framework.id}/${check.id}`, check] as const))(
    '%s: Beispiel erfüllt, Gegenbeispiel weicht ab, null weicht ab, fehlender Wert nicht prüfbar',
    (_name, check) => {
      expect(check.evaluate(check.satisfiedBy).status).toBe('met');
      expect(check.evaluate(check.deviatingWith).status).toBe('deviating');
      if (check.properties.length > 0) {
        expect(check.evaluate(withNull(check.satisfiedBy, check)).status).toBe(
          NULL_NOT_CHECKED.has(check.id) ? 'notChecked' : 'deviating',
        );
        expect(check.evaluate(withoutKeys(check.satisfiedBy, check)).status).toBe('notChecked');
      }
    },
  );

  const byId = (id: string) => allChecks.find(({ check }) => check.id === id)?.check;

  it('strenger als empfohlen ist keine Abweichung', () => {
    const s = (settings: Record<string, string | number | boolean | null>) => ({ settings });
    expect(byId('winPasswordMinLength')?.evaluate(s({ passwordMinimumLength: 8 })).status).toBe(
      'met',
    );
    expect(byId('winPasswordMinLength')?.evaluate(s({ passwordMinimumLength: 5 })).status).toBe(
      'deviating',
    );
    expect(byId('winPasswordExpiration')?.evaluate(s({ passwordExpirationDays: 30 })).status).toBe(
      'met',
    );
    // 0 heißt „kein Ablauf“ → nicht strenger, sondern nicht gesetzt
    expect(byId('winPasswordExpiration')?.evaluate(s({ passwordExpirationDays: 0 })).status).toBe(
      'deviating',
    );
    expect(
      byId('winPasswordInactivity')?.evaluate(s({ passwordMinutesOfInactivityBeforeLock: 5 }))
        .status,
    ).toBe('met');
    expect(
      byId('iosPasscodeType')?.evaluate(s({ passcodeRequiredType: 'alphanumeric' })).status,
    ).toBe('met');
    expect(
      byId('awpPasswordType')?.evaluate(s({ passwordRequiredType: 'alphanumericWithSymbols' }))
        .status,
    ).toBe('met');
    expect(byId('awpPasswordType')?.evaluate(s({ passwordRequiredType: 'numeric' })).status).toBe(
      'deviating',
    );
    expect(
      byId('appClipboard')?.evaluate(s({ allowedOutboundClipboardSharingLevel: 'blocked' })).status,
    ).toBe('met');
    expect(
      byId('appSendOrgData')?.evaluate(s({ allowedOutboundDataTransferDestinations: 'none' }))
        .status,
    ).toBe('met');
    expect(
      byId('appOfflineWipe90')?.evaluate(s({ periodOfflineBeforeWipeIsEnforced: 'P30D' })).status,
    ).toBe('met');
    expect(byId('appPinReset365')?.evaluate(s({ periodBeforePinReset: 'P90D' })).status).toBe(
      'met',
    );
  });

  it.each(['iosThreatLevel', 'awpThreatLevel', 'afmThreatLevel'])(
    '%s: aktiviert → nur „secured“ erfüllt; nicht aktiviert → nicht prüfbar (Defender ODER MTD)',
    (id) => {
      const check = byId(id);
      const subject = (level: string | null, enabled: boolean | null = true) => ({
        settings: {
          deviceThreatProtectionEnabled: enabled,
          deviceThreatProtectionRequiredSecurityLevel: level,
        },
      });
      expect(check?.level).toBe(3);
      expect(check?.evaluate(subject('secured')).status).toBe('met');
      expect(check?.evaluate(subject('low')).status).toBe('deviating');
      expect(check?.evaluate(subject(null)).status).toBe('deviating');
      const off = check?.evaluate(subject('secured', false));
      expect(off?.status).toBe('notChecked');
      expect(off?.reason).toContain('Defender for Endpoint oder eine Mobile-Threat-Defense-Lösung');
      expect(check?.evaluate(subject(null, null)).status).toBe('notChecked');
      expect(check?.evaluate({ settings: {} }).status).toBe('notChecked');
    },
  );

  it('„höchstens“: 0 ist bei iOS „nach Bildschirmsperre“ mehrdeutig (Portal kennt „Sofort“), bei Android-Arbeitsprofil und Windows nicht', () => {
    const s = (property: string, value: number | null) => ({ settings: { [property]: value } });
    const afterLock = byId('iosPasscodeAfterLock');
    expect(afterLock?.evaluate(s('passcodeMinutesOfInactivityBeforeLock', 0)).status).toBe(
      'notChecked',
    );
    expect(afterLock?.evaluate(s('passcodeMinutesOfInactivityBeforeLock', 1)).status).toBe('met');
    expect(afterLock?.evaluate(s('passcodeMinutesOfInactivityBeforeLock', null)).status).toBe(
      'deviating',
    );
    // Android-Arbeitsprofil (1 Minute bis 8 Stunden) und Windows kennen laut Learn kein „Sofort“
    expect(
      byId('awpPasswordInactivity')?.evaluate(s('passwordMinutesOfInactivityBeforeLock', 0)).status,
    ).toBe('deviating');
    expect(
      byId('winPasswordInactivity')?.evaluate(s('passwordMinutesOfInactivityBeforeLock', 0)).status,
    ).toBe('deviating');
  });

  it('„Gerät als nicht konform markieren“: block-Aktion mit 0 Stunden', () => {
    const check = byId('iosMarkNoncompliant');
    const actions = (hours: number | null) => ({
      settings: {},
      scheduledActions: [
        { actionType: 'notification', gracePeriodHours: 0 },
        { actionType: 'block', gracePeriodHours: hours },
      ],
    });
    expect(check?.evaluate(actions(0)).status).toBe('met');
    expect(check?.evaluate(actions(24))).toMatchObject({ status: 'deviating' });
    expect(check?.evaluate(actions(null)).status).toBe('notChecked');
    expect(check?.evaluate({ settings: {}, scheduledActions: null }).status).toBe('notChecked');
    // ohne block-Aktion ist die Zuordnung nicht sicher → nicht prüfbar, nicht „weicht ab“
    expect(check?.evaluate({ settings: {}, scheduledActions: [] }).status).toBe('notChecked');
  });

  it('Dauer in unbekanntem Format → nicht prüfbar (nie geraten)', () => {
    const check = byId('appRecheckAccess');
    expect(check?.evaluate({ settings: { periodOnlineBeforeAccessCheck: 'P1M' } }).status).toBe(
      'notChecked',
    );
    expect(parseIsoDurationMinutes('P1M')).toBeNull();
  });
});

describe('Katalog – Android Enterprise vollständig verwaltet (Beta-Ressource, Stand 2026-11-27)', () => {
  const afm = ANDROID_FULLY_MANAGED_COMPLIANCE;
  const check = (id: string) => {
    const found = afm.checks.find((entry) => entry.id === id);
    if (!found) throw new Error(`Prüfung ${id} fehlt`);
    return found;
  };
  const s = (settings: Record<string, string | number | boolean | null>) => ({ settings });

  it('Prüfungen je Stufe mit genau den Eigenschaften der Beta-Ressource', () => {
    expect(afm.checks.map((entry) => [entry.id, entry.level, [...entry.properties]])).toEqual([
      ['afmBasicIntegrity', 1, ['securityRequireSafetyNetAttestationBasicIntegrity']],
      ['afmOsMinimum', 1, ['osMinimumVersion']],
      ['afmPasswordRequired', 1, ['passwordRequired']],
      ['afmPasswordType', 1, ['passwordRequiredType']],
      ['afmPasswordMinLength', 1, ['passwordMinimumLength']],
      ['afmPasswordInactivity', 1, ['passwordMinutesOfInactivityBeforeLock']],
      ['afmEncryption', 1, ['storageRequireEncryption']],
      ['afmIntuneAppIntegrity', 1, ['securityRequireIntuneAppIntegrity']],
      ['afmMarkNoncompliant', 1, []],
      ['afmPasswordExpiration', 2, ['passwordExpirationDays']],
      ['afmPasswordReuse', 2, ['passwordPreviousPasswordCountToBlock']],
      ['afmDeviceIntegrity', 2, ['securityRequireSafetyNetAttestationCertifiedDevice']],
      ['afmStrongIntegrity', 2, ['securityRequiredAndroidSafetyNetEvaluationType']],
      [
        'afmThreatLevel',
        3,
        ['deviceThreatProtectionEnabled', 'deviceThreatProtectionRequiredSecurityLevel'],
      ],
    ]);
  });

  it('jede Prüfung verweist auf die Tabelle ihrer Stufe', () => {
    for (const entry of afm.checks) {
      expect(entry.docsUrl, entry.id).toBe(
        `https://learn.microsoft.com/intune/device-security/security-configurations/android-fully-managed#device-compliance-level-${entry.level}`,
      );
    }
  });

  it('Kennworttyp: „Numerisch komplex“ oder strenger erfüllt; schwächere weichen ab', () => {
    const type = (value: string) =>
      check('afmPasswordType').evaluate(s({ passwordRequiredType: value }));
    for (const value of [
      'numericComplex',
      'alphabetic',
      'alphanumeric',
      'alphanumericWithSymbols',
    ]) {
      expect(type(value).status, value).toBe('met');
    }
    for (const value of ['deviceDefault', 'required', 'numeric']) {
      expect(type(value).status, value).toBe('deviating');
    }
    expect(type('numeric').actual).toBe('Mindestens numerisch');
    expect(type('required').actual).toBe('Kennwort erforderlich, Typ beliebig');
  });

  it.each(['lowSecurityBiometric', 'customPassword', 'futureValue'])(
    'Kennworttyp %s hat keinen dokumentierten Rang → nicht prüfbar (weder erfüllt noch abweichend)',
    (value) => {
      const outcome = check('afmPasswordType').evaluate(s({ passwordRequiredType: value }));
      expect(outcome.status).toBe('notChecked');
      expect(outcome.reason).toContain('keinen Rang gegenüber dem empfohlenen Wert');
    },
  );

  it('Kennwort-Wiederverwendung liest passwordPreviousPasswordCountToBlock (nicht den Arbeitsprofil-Namen)', () => {
    const reuse = check('afmPasswordReuse');
    expect(reuse.evaluate(s({ passwordPreviousPasswordCountToBlock: 5 })).status).toBe('met');
    expect(reuse.evaluate(s({ passwordPreviousPasswordCountToBlock: 24 })).status).toBe('met');
    expect(reuse.evaluate(s({ passwordPreviousPasswordCountToBlock: 4 })).status).toBe('deviating');
    // Der v1.0-Name des Arbeitsprofils zählt hier nicht
    expect(reuse.evaluate(s({ passwordPreviousPasswordBlockCount: 5 })).status).toBe('notChecked');
  });

  it('Inaktivität: höchstens 5 Minuten; 0 ist nicht dokumentiert → nicht prüfbar, ohne iOS-Begründung', () => {
    const inactivity = (value: number | null) =>
      check('afmPasswordInactivity').evaluate(s({ passwordMinutesOfInactivityBeforeLock: value }));
    expect(inactivity(5).status).toBe('met');
    expect(inactivity(1).status).toBe('met');
    expect(inactivity(6).status).toBe('deviating');
    expect(inactivity(null).status).toBe('deviating');
    const zero = inactivity(0);
    expect(zero.status).toBe('notChecked');
    expect(zero.reason).toContain('weder einen Wertebereich noch die Bedeutung von 0');
    // Die iOS-Begründung („Admin Center bietet Sofort an“) ist für diesen Typ nicht belegt
    expect(zero.reason).not.toContain('bietet für diese Einstellung');
  });

  it('starke Integrität: nur hardwareBacked erfüllt; basic weicht ab; unbekannter Wert nicht prüfbar', () => {
    const strong = (value: string | null) =>
      check('afmStrongIntegrity').evaluate(
        s({ securityRequiredAndroidSafetyNetEvaluationType: value }),
      );
    expect(strong('hardwareBacked')).toEqual({
      status: 'met',
      actual: 'Starke Integrität (hardwaregestützt)',
    });
    expect(strong('basic').status).toBe('deviating');
    expect(strong(null).status).toBe('deviating');
    expect(strong('futureValue').status).toBe('notChecked');
  });

  it('Kennwortablauf höchstens 365 Tage, Mindestlänge 6, Betriebssystemversion nur „gesetzt“', () => {
    expect(check('afmPasswordExpiration').evaluate(s({ passwordExpirationDays: 90 })).status).toBe(
      'met',
    );
    expect(check('afmPasswordExpiration').evaluate(s({ passwordExpirationDays: 0 })).status).toBe(
      'deviating',
    );
    expect(check('afmPasswordMinLength').evaluate(s({ passwordMinimumLength: 8 })).status).toBe(
      'met',
    );
    // Learn nennt nur Format und Beispiel (9.0 bzw. 11.0) – jeder gesetzte Wert erfüllt
    expect(check('afmOsMinimum').evaluate(s({ osMinimumVersion: '8.0' })).status).toBe('met');
    expect(
      afm.checks.filter((entry) => entry.properties.includes('osMinimumVersion')),
    ).toHaveLength(1);
  });

  it('Bedrohungsstufe nicht aktiviert: Grund nennt die fehlende Zuordnung von „Clear“, nicht „v1.0“', () => {
    const off = check('afmThreatLevel').evaluate(
      s({
        deviceThreatProtectionEnabled: false,
        deviceThreatProtectionRequiredSecurityLevel: null,
      }),
    );
    expect(off.status).toBe('notChecked');
    expect(off.reason).toContain('advancedThreatProtectionRequiredSecurityLevel');
    expect(off.reason).toContain('„Clear“');
    expect(off.reason).not.toContain('v1.0');
  });

  it('Computerrisikobewertung „Clear“: Eigenschaft dokumentiert, Wertzuordnung nicht → nicht prüfbar', () => {
    expect(afm.uncheckable).toEqual([
      {
        id: 'afmMdeRisk',
        level: 3,
        docsUrl:
          'https://learn.microsoft.com/intune/device-security/security-configurations/android-fully-managed#device-compliance-level-3',
        reason: 'valueMappingUndocumented',
      },
    ]);
    expect(dePosture.uncheckableReason.valueMappingUndocumented).toContain(
      'Die Eigenschaft ist dokumentiert',
    );
    // Keine Prüfung liest die Defender-Eigenschaft – sie stünde sonst für eine geratene Zuordnung
    expect(afm.checks.flatMap((entry) => [...entry.properties])).not.toContain(
      'advancedThreatProtectionRequiredSecurityLevel',
    );
  });

  it('kein Ergebnistext dieses Frameworks behauptet „v1.0“', () => {
    const subjects: PolicySubject[] = [
      { settings: {}, scheduledActions: null },
      {
        settings: Object.fromEntries(
          BETA_ANDROID_DEVICE_OWNER_PROPERTIES.map((key) => [key, null]),
        ),
        scheduledActions: [],
      },
      s({
        passwordMinutesOfInactivityBeforeLock: 0,
        passwordRequiredType: 'customPassword',
        deviceThreatProtectionEnabled: false,
        securityRequiredAndroidSafetyNetEvaluationType: 'futureValue',
      }),
    ];
    for (const entry of afm.checks) {
      for (const subject of [...subjects, entry.satisfiedBy, entry.deviatingWith]) {
        const outcome = entry.evaluate(subject);
        expect(`${outcome.actual} ${outcome.reason ?? ''}`, entry.id).not.toContain('v1.0');
      }
    }
  });
});
