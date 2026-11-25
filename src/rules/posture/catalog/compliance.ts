/**
 * Katalog der Compliance-Empfehlungen (Sollwerte gegengeprüft 2026-11-25).
 *
 * - Windows 10 und neuer: Tabelle „Recommended compliance settings for Windows 10 and later“ der
 *   Zero-Trust-Seite (ohne Stufen). Eigenschaften: windows10CompliancePolicy (v1.0).
 * - iOS/iPadOS: „iOS/iPadOS device compliance security configurations“ – keine Stufe 1, Stufe 2 ist das
 *   empfohlene Minimum, Stufe 3 ergänzt. Eigenschaften: iosCompliancePolicy (v1.0).
 * - Android Enterprise, persönliches Gerät mit Arbeitsprofil: „Device compliance (level 2/3)“ – keine
 *   Stufe 1. Eigenschaften: androidWorkProfileCompliancePolicy (v1.0).
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
import { allOf, bool, markNoncompliantImmediately, oneOf } from './compare';

const enums = dePosture.values.enums;

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

/** „Require the device to be at or under the Device Threat Level: Secured“ – nur `secured` erfüllt. */
const threatLevelSecured = custom(
  'iosThreatLevel',
  ['deviceThreatProtectionEnabled', 'deviceThreatProtectionRequiredSecurityLevel'],
  IOS3,
  allOf(
    bool('deviceThreatProtectionEnabled', true),
    oneOf(
      'deviceThreatProtectionRequiredSecurityLevel',
      ['secured'],
      enums.deviceThreatProtectionLevel,
    ),
  ),
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

const markImmediately = (id: 'iosMarkNoncompliant' | 'awpMarkNoncompliant', where: Where) =>
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
    // „Maximum minutes after screen lock before password is required“ ↔ Minutes of inactivity before a passcode is required
    maximum('iosPasscodeAfterLock', 'passcodeMinutesOfInactivityBeforeLock', 5, 'minutes', IOS2),
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
