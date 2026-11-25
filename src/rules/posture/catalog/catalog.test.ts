/** M21/S2: Katalog der Empfehlungen – Quellen, Vergleichsrichtung, Texte, Graph-Eigenschaftsnamen. */
import { describe, expect, it } from 'vitest';
import { dePosture } from '../../../i18n/de-posture';
import { parseIsoDurationMinutes } from '../duration';
import {
  ALL_FRAMEWORKS,
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

const ALLOWED_PROPERTIES = new Map([
  [WINDOWS_COMPLIANCE, V1_PROPERTIES.windows10CompliancePolicy],
  [IOS_COMPLIANCE, V1_PROPERTIES.iosCompliancePolicy],
  [ANDROID_WORK_PROFILE_COMPLIANCE, V1_PROPERTIES.androidWorkProfileCompliancePolicy],
  [
    APP_PROTECTION_IOS,
    [...V1_PROPERTIES.managedAppProtection, ...V1_PROPERTIES.iosManagedAppProtection],
  ],
  [
    APP_PROTECTION_ANDROID,
    [...V1_PROPERTIES.managedAppProtection, ...V1_PROPERTIES.androidManagedAppProtection],
  ],
]);

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

  it('verwendet nur auf Learn dokumentierte v1.0-Eigenschaftsnamen', () => {
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
    expect(APP_PROTECTION_IOS.levels).toEqual([1, 2, 3]);
  });
});

describe('Katalog – Vergleichsrichtung', () => {
  it.each(allChecks.map(({ framework, check }) => [`${framework.id}/${check.id}`, check] as const))(
    '%s: Beispiel erfüllt, Gegenbeispiel weicht ab, null weicht ab, fehlender Wert nicht prüfbar',
    (_name, check) => {
      expect(check.evaluate(check.satisfiedBy).status).toBe('met');
      expect(check.evaluate(check.deviatingWith).status).toBe('deviating');
      if (check.properties.length > 0) {
        expect(check.evaluate(withNull(check.satisfiedBy, check)).status).toBe('deviating');
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

  it('Bedrohungsstufe: nur „secured“ erfüllt', () => {
    const check = byId('iosThreatLevel');
    const subject = (level: string, enabled = true) => ({
      settings: {
        deviceThreatProtectionEnabled: enabled,
        deviceThreatProtectionRequiredSecurityLevel: level,
      },
    });
    expect(check?.evaluate(subject('secured')).status).toBe('met');
    expect(check?.evaluate(subject('low')).status).toBe('deviating');
    expect(check?.evaluate(subject('secured', false)).status).toBe('deviating');
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
