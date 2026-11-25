/**
 * Katalog des App-Schutzes: „Data Protection Framework using app protection policies“, Stufe 1–3
 * (Sollwerte gegengeprüft 2026-11-25). Eigenschaften: iosManagedAppProtection bzw.
 * androidManagedAppProtection (v1.0, geerbt von managedAppProtection).
 *
 * Nicht als Prüfung aufgenommen: Learn-Werte, die jede Einstellung erfüllt (Stufe 1 „Allow“, „All apps“,
 * „Any app“, „Not required“, „PIN type: Numeric“ – jeder Zeichensatz erfüllt ihn; Stufe 2 „Transfer
 * telecommunication data to: Any dialer app“ – die am wenigsten strenge Option), Zeilen ohne festen Wert
 * (Stufe 3 „Dialer App URL Scheme“, „Select keyboards to approve“ – Teil von appDialerIos bzw.
 * appApprovedKeyboards) sowie Windows-Zeilen. Alle übrigen Zeilen der drei Tabellen stehen als Prüfung
 * oder als „nicht prüfbar“ im Katalog (Zeile für Zeile abgeglichen 2026-11-25).
 * Zuordnungen nach Beschreibung der Graph-Eigenschaft (auf Learn so beschrieben):
 * - „Recheck the access requirements after (minutes of inactivity)“ ↔ periodOnlineBeforeAccessCheck
 * - „Offline grace period … Block access“ ↔ periodOfflineBeforeAccessCheck
 * - „Offline grace period … Wipe data“ ↔ periodOfflineBeforeWipeIsEnforced
 * - „App PIN when device PIN is set: Require“ ↔ disableAppPinIfDevicePinIsSet = false
 * - „Encrypt org data on enrolled devices: Require“ ↔ disableAppEncryptionIfDeviceEncryptionIsEnabled = false
 */
import type { PostureLevel } from '../../../domain/posture';
import { dePosture } from '../../../i18n/de-posture';
import { Docs } from '../../knowledge/docs';
import type {
  CatalogCheck,
  PostureFramework,
  UncheckableId,
  UncheckableRecommendation,
} from '../types';
import {
  anyValueSet,
  custom,
  durationMaximum,
  enumAtLeast,
  maximum,
  minimum,
  requireValue,
  type Where,
} from './build';
import { allOf, bool, oneOf } from './compare';

const enums = dePosture.values.enums;
type AppPlatform = 'ios' | 'android';
const BOTH: readonly AppPlatform[] = ['ios', 'android'];
const ANDROID: readonly AppPlatform[] = ['android'];
const IOS: readonly AppPlatform[] = ['ios'];

const DOCS: Record<PostureLevel, string> = {
  1: Docs.postureDataProtectionLevel1,
  2: Docs.postureDataProtectionLevel2,
  3: Docs.postureDataProtectionLevel3,
};
const at = (level: PostureLevel): Where => ({ level, docsUrl: DOCS[level] });

const DAY = 24 * 60;

interface Entry {
  platforms: readonly AppPlatform[];
  check: CatalogCheck;
}

const ENTRIES: readonly Entry[] = [
  // ----- Stufe 1 -----
  { platforms: BOTH, check: requireValue('appPinRequired', 'pinRequired', true, at(1)) },
  { platforms: BOTH, check: minimum('appPinMinLength4', 'minimumPinLength', 4, 'count', at(1)) },
  {
    platforms: BOTH,
    check: requireValue('appPinWhenDevicePin', 'disableAppPinIfDevicePinIsSet', false, at(1)),
  },
  {
    platforms: BOTH,
    check: durationMaximum(
      'appRecheckAccess',
      'periodOnlineBeforeAccessCheck',
      30,
      'PT30M',
      'PT60M',
      at(1),
    ),
  },
  { platforms: BOTH, check: maximum('appMaxPinRetries', 'maximumPinRetries', 5, 'count', at(1)) },
  {
    platforms: BOTH,
    check: durationMaximum(
      'appOfflineBlock',
      'periodOfflineBeforeAccessCheck',
      10080,
      'PT10080M',
      'P14D',
      at(1),
    ),
  },
  {
    platforms: BOTH,
    check: durationMaximum(
      'appOfflineWipe90',
      'periodOfflineBeforeWipeIsEnforced',
      90 * DAY,
      'P90D',
      'P180D',
      at(1),
    ),
  },
  { platforms: ANDROID, check: requireValue('appEncryptData', 'encryptAppData', true, at(1)) },
  {
    platforms: ANDROID,
    check: requireValue(
      'appEncryptEnrolled',
      'disableAppEncryptionIfDeviceEncryptionIsEnabled',
      false,
      at(1),
    ),
  },

  // ----- Stufe 2 -----
  { platforms: BOTH, check: requireValue('appBackupBlocked', 'dataBackupBlocked', true, at(2)) },
  {
    platforms: BOTH,
    // managedAppDataTransferLevel: allApps < managedApps < none
    check: enumAtLeast(
      'appSendOrgData',
      'allowedOutboundDataTransferDestinations',
      ['managedApps', 'none'],
      'allApps',
      enums.managedAppDataTransferLevel,
      at(2),
    ),
  },
  { platforms: BOTH, check: requireValue('appSaveAsBlocked', 'saveAsBlocked', true, at(2)) },
  {
    platforms: BOTH,
    // managedAppClipboardSharingLevel: allApps < managedAppsWithPasteIn < managedApps < blocked
    check: enumAtLeast(
      'appClipboard',
      'allowedOutboundClipboardSharingLevel',
      ['managedAppsWithPasteIn', 'managedApps', 'blocked'],
      'allApps',
      enums.managedAppClipboardSharingLevel,
      at(2),
    ),
  },
  {
    platforms: BOTH,
    check: custom(
      'appWebContentEdge',
      ['managedBrowserToOpenLinksRequired', 'managedBrowser'],
      at(2),
      allOf(
        bool('managedBrowserToOpenLinksRequired', true),
        oneOf('managedBrowser', ['microsoftEdge'], enums.managedBrowserType),
      ),
      { settings: { managedBrowserToOpenLinksRequired: true, managedBrowser: 'microsoftEdge' } },
      { settings: { managedBrowserToOpenLinksRequired: false, managedBrowser: 'notConfigured' } },
    ),
  },
  {
    platforms: BOTH,
    check: durationMaximum(
      'appOfflineWipe30',
      'periodOfflineBeforeWipeIsEnforced',
      30 * DAY,
      'P30D',
      'P90D',
      at(2),
    ),
  },
  { platforms: BOTH, check: anyValueSet('appMinOs', 'minimumRequiredOsVersion', '17.0', at(2)) },
  {
    platforms: ANDROID,
    check: requireValue('appScreenCapture', 'screenCaptureBlocked', true, at(2)),
  },
  {
    platforms: ANDROID,
    check: anyValueSet('appMinPatch', 'minimumRequiredPatchVersion', '2026-01-01', at(2)),
  },

  // ----- Stufe 3 -----
  {
    platforms: BOTH,
    check: enumAtLeast(
      'appReceiveOrgData',
      'allowedInboundDataTransferSources',
      ['managedApps', 'none'],
      'allApps',
      enums.managedAppDataTransferLevel,
      at(3),
    ),
  },
  { platforms: BOTH, check: requireValue('appPrintBlocked', 'printBlocked', true, at(3)) },
  { platforms: BOTH, check: requireValue('appSimplePinBlocked', 'simplePinBlocked', true, at(3)) },
  { platforms: BOTH, check: minimum('appPinMinLength6', 'minimumPinLength', 6, 'count', at(3)) },
  {
    platforms: BOTH,
    // „PIN reset after number of days: Yes“ + „Number of days: 365“
    check: durationMaximum(
      'appPinReset365',
      'periodBeforePinReset',
      365 * DAY,
      'P365D',
      'PT0S',
      at(3),
    ),
  },
];

interface UncheckableEntry {
  platforms: readonly AppPlatform[];
  id: UncheckableId;
  level: PostureLevel;
  reason?: UncheckableRecommendation['reason'];
}

/** Learn-Werte ohne v1.0-Eigenschaft (bzw. ohne dokumentierte Zuordnung) – nur angezeigt. */
const UNCHECKABLE: readonly UncheckableEntry[] = [
  // iOS „Encrypt org data“: appDataEncryptionType existiert, die Zuordnung zu „Require“ ist nicht dokumentiert
  { platforms: IOS, id: 'appEncryptIos', level: 1, reason: 'noMapping' },
  { platforms: BOTH, id: 'appOverrideBiometrics', level: 1 },
  // „Jailbroken/rooted devices: Block access“ – keine eindeutig dokumentierte v1.0-Eigenschaft
  { platforms: BOTH, id: 'appJailbreakBlock', level: 1, reason: 'noMapping' },
  { platforms: ANDROID, id: 'appPlayIntegrity', level: 1 },
  { platforms: ANDROID, id: 'appThreatScan', level: 1 },
  { platforms: ANDROID, id: 'appDeviceLockLow', level: 1 },
  // „Select apps to exempt: Default / skype;app-settings;…“ – keine v1.0-Eigenschaft
  { platforms: IOS, id: 'appExemptApps', level: 2 },
  // „Allow users to save copies to selected services: OneDrive for Business, SharePoint, Photo Library“ –
  // allowedDataStorageLocations (managedAppDataStorageLocation) kennt „Photo Library“ nicht
  { platforms: BOTH, id: 'appSaveToServices', level: 2, reason: 'enumIncomplete' },
  { platforms: BOTH, id: 'appOrgDataNotifications', level: 2 },
  { platforms: BOTH, id: 'appDisabledAccount', level: 2 },
  { platforms: ANDROID, id: 'appHardwareAttestation', level: 2 },
  { platforms: ANDROID, id: 'appDeviceLockMedium', level: 2 },
  { platforms: ANDROID, id: 'appSamsungKnox', level: 2 },
  { platforms: BOTH, id: 'appOpenIntoOrgDocs', level: 3 },
  // „Allow users to open data from selected services: OneDrive for Business, SharePoint, Camera, Photo
  // Library“ – keine v1.0-Eigenschaft
  { platforms: BOTH, id: 'appOpenFromServices', level: 3 },
  { platforms: IOS, id: 'appThirdPartyKeyboards', level: 3 },
  { platforms: ANDROID, id: 'appApprovedKeyboards', level: 3 },
  { platforms: ANDROID, id: 'appClass3Biometrics', level: 3 },
  { platforms: ANDROID, id: 'appOverrideBiometricsUpdates', level: 3 },
  { platforms: ANDROID, id: 'appDeviceLockHigh', level: 3 },
  { platforms: BOTH, id: 'appJailbreakWipe', level: 3, reason: 'noMapping' },
  { platforms: BOTH, id: 'appMaxThreatLevel', level: 3 },
  { platforms: BOTH, id: 'appMaxOs', level: 3 },
  { platforms: ANDROID, id: 'appSamsungKnoxWipe', level: 3 },
  { platforms: ANDROID, id: 'appDialerAndroid', level: 3 },
  { platforms: IOS, id: 'appDialerIos', level: 3 },
];

function framework(platform: AppPlatform): PostureFramework {
  return {
    id: `appProtection-${platform}`,
    levels: [1, 2, 3],
    docsUrl: Docs.postureDataProtectionLevel1,
    checks: ENTRIES.filter((entry) => entry.platforms.includes(platform)).map(
      (entry) => entry.check,
    ),
    uncheckable: UNCHECKABLE.filter((entry) => entry.platforms.includes(platform)).map((entry) => ({
      id: entry.id,
      level: entry.level,
      docsUrl: DOCS[entry.level],
      reason: entry.reason ?? 'noV1Property',
    })),
  };
}

export const APP_PROTECTION_IOS: PostureFramework = framework('ios');
export const APP_PROTECTION_ANDROID: PostureFramework = framework('android');
