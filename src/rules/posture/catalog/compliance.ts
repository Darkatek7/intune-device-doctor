/**
 * Katalog der Compliance-Empfehlungen (Sollwerte gegengeprüft 2026-11-25).
 *
 * - Windows 10 und neuer: Tabelle „Recommended compliance settings for Windows 10 and later“ der
 *   Zero-Trust-Seite (ohne Stufen). Eigenschaften: windows10CompliancePolicy (v1.0).
 * - iOS/iPadOS: „iOS/iPadOS device compliance security configurations“ – keine Stufe 1, Stufe 2 ist das
 *   empfohlene Minimum, Stufe 3 ergänzt. Eigenschaften: iosCompliancePolicy (v1.0).
 * - Android Enterprise, persönliches Gerät mit Arbeitsprofil: „Device compliance (level 2/3)“ – keine
 *   Stufe 1. Eigenschaften: androidWorkProfileCompliancePolicy (v1.0).
 * - Android Enterprise, vollständig verwaltet (Nachtrag, Sollwerte gegengeprüft **2026-11-27**, dritte
 *   freigegebene Beta-Ausnahme): „Device compliance (level 1/2/3)“. Eigenschaften:
 *   androidDeviceOwnerCompliancePolicy – **nur in der Beta-API dokumentiert**; die Namen unterscheiden sich
 *   vom Arbeitsprofil (z. B. `passwordPreviousPasswordCountToBlock`, `securityRequireIntuneAppIntegrity`).
 *   Der Graph-Typ gilt auch für dedizierte Geräte und unternehmenseigene Geräte mit Arbeitsprofil; die
 *   Learn-Empfehlung nennt „fully managed mobile users“ (Hinweis in der Kachel).
 *   Stufe-3-Zeile „Minimum OS version, Example: 11.0“: wie Stufe 1 nur Format und Beispiel, kein fester
 *   Wert → dieselbe Prüfung „gesetzt“ (Stufe 1), keine zweite.
 *   Stufe-1-Zeile „Minimum security patch level: Not configured“: keine Prüfung (jede Einstellung erfüllt).
 *   Stufe 3 „machine risk score: Clear“: Die Eigenschaft `advancedThreatProtectionRequiredSecurityLevel`
 *   ist dokumentiert, Learn nennt aber nicht, welcher Wert von deviceThreatProtectionLevel dem Portalwert
 *   „Clear“ entspricht → `uncheckable` (`valueMappingUndocumented`), nicht geraten.
 *
 * Stufe 3 „Device Threat Level: Secured“: Learn empfiehlt Defender for Endpoint **oder** Mobile Threat
 * Defense („It isn't necessary to deploy both“) – ist die Bedrohungsstufe nicht aktiviert, ist die
 * Empfehlung nicht prüfbar (die Defender-Risikobewertung ist über v1.0 nicht lesbar), keine Abweichung.
 *
 * Bewusst **ohne** Prüfung (kein fester Sollwert oder jede Einstellung erfüllt ihn):
 * Windows „Password type: Device default“, Betriebssystemversionen „Enter appropriate values“,
 * „Require device compliance from Configuration Manager“ (abhängig von Co-Verwaltung), Android
 * „Minimum security patch level: Not configured“. Einträge ohne v1.0-Eigenschaft stehen in `uncheckable`.
 */
import type { PostureFramework, UncheckableRecommendation } from '../types';
import { dePosture } from '../../../i18n/de-posture';
import { Docs } from '../../knowledge/docs';
import {
  anyValueSet,
  custom,
  enumAtLeast,
  maximum,
  minimum,
  requireValue,
  type Where,
} from './build';
import { deviceThreatLevelSecured, markNoncompliantImmediately, rankedEnum } from './compare';

const enums = dePosture.values.enums;
const values = dePosture.values;

// ---------- Windows 10 und neuer (ohne Stufen) ----------

const WIN: Where = { level: null, docsUrl: Docs.postureWindowsCompliance };
const winUncheckable = (id: UncheckableRecommendation['id']): UncheckableRecommendation => ({
  id,
  level: null,
  docsUrl: Docs.postureWindowsCompliance,
  reason: 'noV1Property',
});

export const WINDOWS_COMPLIANCE: PostureFramework = {
  id: 'windowsCompliance',
  levels: null,
  docsUrl: Docs.postureWindowsCompliance,
  checks: [
    // Device health › Windows Health Attestation Service evaluation rules
    requireValue('winBitLocker', 'bitLockerEnabled', true, WIN),
    requireValue('winSecureBoot', 'secureBootEnabled', true, WIN),
    requireValue('winCodeIntegrity', 'codeIntegrityEnabled', true, WIN),
    // System security › Password
    requireValue('winPasswordRequired', 'passwordRequired', true, WIN),
    requireValue('winPasswordBlockSimple', 'passwordBlockSimple', true, WIN),
    minimum('winPasswordMinLength', 'passwordMinimumLength', 6, 'characters', WIN),
    maximum('winPasswordInactivity', 'passwordMinutesOfInactivityBeforeLock', 15, 'minutes', WIN),
    maximum('winPasswordExpiration', 'passwordExpirationDays', 41, 'days', WIN),
    minimum('winPasswordReuse', 'passwordPreviousPasswordBlockCount', 5, 'count', WIN),
    requireValue('winPasswordIdle', 'passwordRequiredToUnlockFromIdle', true, WIN),
    // System security › Encryption
    requireValue('winEncryption', 'storageRequireEncryption', true, WIN),
  ],
  // windows10CompliancePolicy (v1.0) hat keine Eigenschaften für Firewall, Antivirus, Antispyware,
  // Defender und Computerrisiko – diese Learn-Werte sind über die dokumentierte API nicht prüfbar.
  uncheckable: [
    winUncheckable('winFirewall'),
    winUncheckable('winAntivirus'),
    winUncheckable('winAntispyware'),
    winUncheckable('winDefender'),
    winUncheckable('winDefenderVersion'),
    winUncheckable('winSignatures'),
    winUncheckable('winRealTime'),
    winUncheckable('winMdeRisk'),
  ],
};

// ---------- iOS/iPadOS (Stufe 2 und 3) ----------

const IOS2: Where = { level: 2, docsUrl: Docs.postureIosComplianceLevel2 };
const IOS3: Where = { level: 3, docsUrl: Docs.postureIosComplianceLevel3 };

/**
 * „Require the device to be at or under the Device Threat Level: Secured“ – aktiviert: nur `secured`
 * erfüllt; nicht aktiviert: nicht prüfbar (Learn: Defender for Endpoint **oder** MTD, siehe compare.ts).
 */
const threatLevelSecured = custom(
  'iosThreatLevel',
  ['deviceThreatProtectionEnabled', 'deviceThreatProtectionRequiredSecurityLevel'],
  IOS3,
  deviceThreatLevelSecured(enums.deviceThreatProtectionLevel),
  {
    settings: {
      deviceThreatProtectionEnabled: true,
      deviceThreatProtectionRequiredSecurityLevel: 'secured',
    },
  },
  {
    settings: {
      deviceThreatProtectionEnabled: true,
      deviceThreatProtectionRequiredSecurityLevel: 'medium',
    },
  },
);

const markImmediately = (
  id: 'iosMarkNoncompliant' | 'awpMarkNoncompliant' | 'afmMarkNoncompliant',
  where: Where,
) =>
  custom(
    id,
    [],
    where,
    markNoncompliantImmediately(),
    { settings: {}, scheduledActions: [{ actionType: 'block', gracePeriodHours: 0 }] },
    { settings: {}, scheduledActions: [{ actionType: 'block', gracePeriodHours: 72 }] },
  );

export const IOS_COMPLIANCE: PostureFramework = {
  id: 'iosCompliance',
  levels: [2, 3],
  docsUrl: Docs.postureIosComplianceLevel2,
  checks: [
    requireValue('iosJailbreak', 'securityBlockJailbrokenDevices', true, IOS2),
    anyValueSet('iosOsMinimum', 'osMinimumVersion', '17.0', IOS2),
    requireValue('iosPasscodeRequired', 'passcodeRequired', true, IOS2),
    requireValue('iosPasscodeBlockSimple', 'passcodeBlockSimple', true, IOS2),
    minimum('iosPasscodeMinLength', 'passcodeMinimumLength', 6, 'characters', IOS2),
    // requiredPasswordType: numeric (Learn) oder alphanumeric (strenger); deviceDefault weicht ab
    enumAtLeast(
      'iosPasscodeType',
      'passcodeRequiredType',
      ['numeric', 'alphanumeric'],
      'deviceDefault',
      enums.requiredPasswordType,
      IOS2,
    ),
    // „Maximum minutes after screen lock before password is required“ ↔ Minutes of inactivity before a passcode is required.
    // Das Portal bietet „Immediately“ an (ref-ios-ipados-settings); wie Graph das kodiert, ist nicht
    // dokumentiert → 0 ist nicht prüfbar. Android-Arbeitsprofil (1 Minute bis 8 Stunden) und Windows
    // („Enter the idle time“) kennen laut Learn kein „Sofort“ – dort bleibt 0 „nicht konfiguriert“.
    maximum('iosPasscodeAfterLock', 'passcodeMinutesOfInactivityBeforeLock', 5, 'minutes', IOS2, {
      zeroUndocumented: true,
    }),
    markImmediately('iosMarkNoncompliant', IOS2),
    threatLevelSecured,
    maximum('iosPasscodeExpiration', 'passcodeExpirationDays', 365, 'days', IOS3),
  ],
  uncheckable: [
    // „Maximum minutes of inactivity until screen locks“: keine v1.0-Eigenschaft
    {
      id: 'iosScreenLock',
      level: 2,
      docsUrl: Docs.postureIosComplianceLevel2,
      reason: 'noV1Property',
    },
    // „Require the device to be at or under the machine risk score: Clear“: keine v1.0-Eigenschaft
    {
      id: 'iosMdeRisk',
      level: 3,
      docsUrl: Docs.postureIosComplianceLevel3,
      reason: 'noV1Property',
    },
  ],
};

// ---------- Android Enterprise, persönliches Gerät mit Arbeitsprofil (Stufe 2 und 3) ----------

const AWP2: Where = { level: 2, docsUrl: Docs.postureAndroidWorkProfileLevel2 };
const AWP3: Where = { level: 3, docsUrl: Docs.postureAndroidWorkProfileLevel3 };

export const ANDROID_WORK_PROFILE_COMPLIANCE: PostureFramework = {
  id: 'androidWorkProfileCompliance',
  levels: [2, 3],
  docsUrl: Docs.postureAndroidWorkProfileLevel2,
  checks: [
    requireValue('awpRooted', 'securityBlockJailbrokenDevices', true, AWP2),
    requireValue('awpPlayServices', 'securityRequireGooglePlayServices', true, AWP2),
    requireValue('awpSecurityProvider', 'securityRequireUpToDateSecurityProviders', true, AWP2),
    // „Play Integrity Verdict: Check basic integrity & device integrity“ → zwei Eigenschaften
    requireValue(
      'awpBasicIntegrity',
      'securityRequireSafetyNetAttestationBasicIntegrity',
      true,
      AWP2,
    ),
    requireValue(
      'awpDeviceIntegrity',
      'securityRequireSafetyNetAttestationCertifiedDevice',
      true,
      AWP2,
    ),
    anyValueSet('awpOsMinimum', 'osMinimumVersion', '13.0', AWP2),
    requireValue('awpEncryption', 'storageRequireEncryption', true, AWP2),
    requireValue('awpUnknownSources', 'securityPreventInstallAppsFromUnknownSources', true, AWP2),
    requireValue(
      'awpCompanyPortalIntegrity',
      'securityRequireCompanyPortalAppIntegrity',
      true,
      AWP2,
    ),
    requireValue('awpUsbDebugging', 'securityDisableUsbDebugging', true, AWP2),
    requireValue('awpPasswordRequired', 'passwordRequired', true, AWP2),
    // Reihenfolge laut Learn (ref-android-enterprise-settings): numeric < numericComplex <
    // alphabetic < alphanumeric < alphanumericWithSymbols – „Numeric complex“ oder strenger erfüllt.
    enumAtLeast(
      'awpPasswordType',
      'passwordRequiredType',
      ['numericComplex', 'alphabetic', 'alphanumeric', 'alphanumericWithSymbols'],
      'numeric',
      enums.androidRequiredPasswordType,
      AWP2,
    ),
    minimum('awpPasswordMinLength', 'passwordMinimumLength', 6, 'characters', AWP2),
    maximum('awpPasswordInactivity', 'passwordMinutesOfInactivityBeforeLock', 5, 'minutes', AWP2),
    markImmediately('awpMarkNoncompliant', AWP2),
    custom(
      'awpThreatLevel',
      ['deviceThreatProtectionEnabled', 'deviceThreatProtectionRequiredSecurityLevel'],
      AWP3,
      threatLevelSecured.evaluate,
      threatLevelSecured.satisfiedBy,
      threatLevelSecured.deviatingWith,
    ),
    maximum('awpPasswordExpiration', 'passwordExpirationDays', 365, 'days', AWP3),
    minimum('awpPasswordReuse', 'passwordPreviousPasswordBlockCount', 5, 'count', AWP3),
  ],
  uncheckable: [
    // „Check strong integrity using hardware-backed security features“: keine v1.0-Eigenschaft
    {
      id: 'awpStrongIntegrity',
      level: 2,
      docsUrl: Docs.postureAndroidWorkProfileLevel2,
      reason: 'noV1Property',
    },
    {
      id: 'awpMdeRisk',
      level: 3,
      docsUrl: Docs.postureAndroidWorkProfileLevel3,
      reason: 'noV1Property',
    },
  ],
};

// ---------- Android Enterprise, vollständig verwaltet (Stufe 1 bis 3, Eigenschaften nur beta) ----------

const AFM1: Where = { level: 1, docsUrl: Docs.postureAndroidFullyManagedLevel1 };
const AFM2: Where = { level: 2, docsUrl: Docs.postureAndroidFullyManagedLevel2 };
const AFM3: Where = { level: 3, docsUrl: Docs.postureAndroidFullyManagedLevel3 };

export const ANDROID_FULLY_MANAGED_COMPLIANCE: PostureFramework = {
  id: 'androidFullyManagedCompliance',
  levels: [1, 2, 3],
  docsUrl: Docs.postureAndroidFullyManagedLevel1,
  checks: [
    // Stufe 1 – „Play Integrity Verdict: Check basic integrity“
    requireValue(
      'afmBasicIntegrity',
      'securityRequireSafetyNetAttestationBasicIntegrity',
      true,
      AFM1,
    ),
    // „Minimum OS version – Format: Major.Minor, Example: 9.0“ (Stufe 3 nennt nur ein anderes Beispiel)
    anyValueSet('afmOsMinimum', 'osMinimumVersion', '9.0', AFM1),
    requireValue('afmPasswordRequired', 'passwordRequired', true, AFM1),
    // androidDeviceOwnerRequiredPasswordType: „At least numeric“ < „At least numeric with no repeating or
    // ordered sequences“ (numericComplex) < „At least alphabetic“ < alphanumeric < alphanumericWithSymbols.
    // deviceDefault („no intent“) und required („no restrictions on type“) verlangen keinen Typ → weichen ab.
    // lowSecurityBiometric und customPassword haben keinen dokumentierten Rang → nicht prüfbar.
    custom(
      'afmPasswordType',
      ['passwordRequiredType'],
      AFM1,
      rankedEnum(
        'passwordRequiredType',
        ['numericComplex', 'alphabetic', 'alphanumeric', 'alphanumericWithSymbols'],
        ['deviceDefault', 'required', 'numeric'],
        enums.androidDeviceOwnerRequiredPasswordType,
      ),
      { settings: { passwordRequiredType: 'numericComplex' } },
      { settings: { passwordRequiredType: 'numeric' } },
    ),
    minimum('afmPasswordMinLength', 'passwordMinimumLength', 6, 'characters', AFM1),
    // Die Beta-Ressource nennt für diese Eigenschaft weder Wertebereich noch die Bedeutung von 0
    maximum('afmPasswordInactivity', 'passwordMinutesOfInactivityBeforeLock', 5, 'minutes', AFM1, {
      zeroUndocumented: true,
      zeroReason: values.zeroUndocumentedBetaReason,
    }),
    requireValue('afmEncryption', 'storageRequireEncryption', true, AFM1),
    // „Intune app runtime integrity: Require“
    requireValue('afmIntuneAppIntegrity', 'securityRequireIntuneAppIntegrity', true, AFM1),
    markImmediately('afmMarkNoncompliant', AFM1),
    // Stufe 2
    maximum('afmPasswordExpiration', 'passwordExpirationDays', 365, 'days', AFM2),
    minimum('afmPasswordReuse', 'passwordPreviousPasswordCountToBlock', 5, 'count', AFM2),
    // „Play Integrity Verdict: Check basic integrity & device integrity“ → zusätzlich die Geräteintegrität
    requireValue(
      'afmDeviceIntegrity',
      'securityRequireSafetyNetAttestationCertifiedDevice',
      true,
      AFM2,
    ),
    // androidSafetyNetEvaluationType: hardwareBacked = „Strong Integrity checks (such as a hardware-backed
    // proof of boot integrity) were used“; basic = „Default value. Typical measurements …“
    custom(
      'afmStrongIntegrity',
      ['securityRequiredAndroidSafetyNetEvaluationType'],
      AFM2,
      rankedEnum(
        'securityRequiredAndroidSafetyNetEvaluationType',
        ['hardwareBacked'],
        ['basic'],
        enums.androidSafetyNetEvaluationType,
      ),
      { settings: { securityRequiredAndroidSafetyNetEvaluationType: 'hardwareBacked' } },
      { settings: { securityRequiredAndroidSafetyNetEvaluationType: 'basic' } },
    ),
    // Stufe 3 – Defender for Endpoint ODER Mobile Threat Defense (eigener Grund: kein „v1.0“-Bezug)
    custom(
      'afmThreatLevel',
      ['deviceThreatProtectionEnabled', 'deviceThreatProtectionRequiredSecurityLevel'],
      AFM3,
      deviceThreatLevelSecured(
        enums.deviceThreatProtectionLevel,
        values.threatNotEnabledReasonDeviceOwner,
      ),
      threatLevelSecured.satisfiedBy,
      threatLevelSecured.deviatingWith,
    ),
  ],
  uncheckable: [
    // „Require the device to be at or under the machine risk score: Clear“
    {
      id: 'afmMdeRisk',
      level: 3,
      docsUrl: Docs.postureAndroidFullyManagedLevel3,
      reason: 'valueMappingUndocumented',
    },
  ],
};
