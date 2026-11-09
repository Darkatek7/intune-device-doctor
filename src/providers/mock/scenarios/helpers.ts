/**
 * Bausteine für Demo-Szenarien. Alle Daten sind fiktiv (Contoso), Zeitwerte relativ zu `now`.
 */
import type {
  DeviceGroupsInfo,
  AutopilotInfo,
  AppInstallStateInfo,
  AppliedPolicyInfo,
  BitLockerKeyInfo,
  EntraDeviceInfo,
  HealthAttestationInfo,
  LocalAdminInfo,
  ManagedDeviceInfo,
  PolicySettingInfo,
  PolicyStateInfo,
  SignInEntry,
  SignInsInfo,
  WindowsProtectionInfo,
} from '../../../domain/types';
import { SIGN_IN_WINDOW_DAYS } from '../../../graph/endpoints';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** ISO-Zeitpunkt in der Vergangenheit relativ zu now. */
export function ago(now: Date, span: { days?: number; hours?: number; minutes?: number }): string {
  const ms = (span.days ?? 0) * DAY + (span.hours ?? 0) * HOUR + (span.minutes ?? 0) * MINUTE;
  return new Date(now.getTime() - ms).toISOString();
}

/** ISO-Zeitpunkt in der Zukunft relativ zu now. */
export function inFuture(now: Date, span: { days?: number; hours?: number }): string {
  const ms = (span.days ?? 0) * DAY + (span.hours ?? 0) * HOUR;
  return new Date(now.getTime() + ms).toISOString();
}

/** Fiktive, eindeutig erkennbare GUIDs: 00000000-0000-4000-8000-0000000000NN */
export function demoGuid(
  group: 'device' | 'entra' | 'object' | 'policy' | 'key' | 'user',
  n: number,
): string {
  const groupDigit = { device: '8', entra: '9', object: 'a', policy: 'b', key: 'c', user: 'd' }[
    group
  ];
  return `00000000-0000-4000-${groupDigit}000-${n.toString(16).padStart(12, '0')}`;
}

const GB = 1024 ** 3;

export type DeviceBase = Omit<ManagedDeviceInfo, 'source'>;

/** Gesundes Windows-11-Gerät (Entra-joined, Intune-MDM). Szenarien überschreiben gezielt Felder. */
export function windowsDevice(now: Date, n: number, overrides: Partial<DeviceBase>): DeviceBase {
  return {
    id: demoGuid('device', n),
    deviceName: `CONTOSO-PC${n.toString().padStart(3, '0')}`,
    osFamily: 'windows',
    operatingSystem: 'Windows',
    osVersion: '10.0.26200.9711',
    model: 'Surface Laptop 6',
    manufacturer: 'Microsoft Corporation',
    serialNumber: `DEMO-${n.toString().padStart(6, '0')}`,
    userId: demoGuid('user', n),
    userPrincipalName: 'max.mustermann@contoso.com',
    userDisplayName: 'Max Mustermann',
    complianceState: 'compliant',
    complianceGracePeriodExpirationDateTime: null,
    lastSyncDateTime: ago(now, { hours: 2 }),
    enrolledDateTime: ago(now, { days: 210 }),
    managementAgent: 'mdm',
    deviceEnrollmentType: 'windowsAzureADJoin',
    isEncrypted: true,
    jailBroken: 'Unknown',
    azureADDeviceId: demoGuid('entra', n),
    partnerReportedThreatState: 'secured',
    freeStorageSpaceInBytes: 182 * GB,
    totalStorageSpaceInBytes: 476 * GB,
    managementCertificateExpirationDate: inFuture(now, { days: 155 }),
    isSupervised: null,
    androidSecurityPatchLevel: null,
    enrollmentProfileName: null,
    ...overrides,
  };
}

export function healthyProtection(
  now: Date,
  overrides: Partial<WindowsProtectionInfo> = {},
): WindowsProtectionInfo {
  return {
    malwareProtectionEnabled: true,
    realTimeProtectionEnabled: true,
    networkInspectionSystemEnabled: true,
    tamperProtectionEnabled: true,
    deviceState: 'clean',
    productStatus: ['noStatus'],
    signatureVersion: '1.441.112.0',
    engineVersion: '1.1.25090.3',
    antiMalwareVersion: '4.18.25090.2',
    signatureUpdateOverdue: false,
    quickScanOverdue: false,
    fullScanOverdue: false,
    fullScanRequired: false,
    rebootRequired: false,
    lastQuickScanDateTime: ago(now, { hours: 9 }),
    lastFullScanDateTime: ago(now, { days: 6 }),
    lastReportedDateTime: ago(now, { hours: 2 }),
    isVirtualMachine: false,
    detectedMalware: [],
    ...overrides,
  };
}

export function setting(overrides: Partial<PolicySettingInfo>): PolicySettingInfo {
  return {
    setting: null,
    settingName: null,
    instanceDisplayName: null,
    state: 'compliant',
    errorCode: 0,
    errorDescription: null,
    currentValue: null,
    sources: [],
    ...overrides,
  };
}

export function policy(
  kind: PolicyStateInfo['kind'],
  n: number,
  displayName: string,
  overrides: Partial<PolicyStateInfo> = {},
): PolicyStateInfo {
  return {
    id: demoGuid('policy', n),
    kind,
    displayName,
    state: 'compliant',
    platformType: 'windows10AndLater',
    version: 1,
    settingCount: overrides.settings?.length ?? 0,
    settings: [],
    ...overrides,
  };
}

/** Standard-Compliance-Richtlinien eines gesunden Windows-Geräts. */
export function healthyCompliancePolicies(): PolicyStateInfo[] {
  return [
    policy('compliance', 1, 'Contoso – Windows 11 Basis-Compliance', {
      version: 4,
      settingCount: 6,
    }),
    policy('compliance', 2, 'Contoso – Defender & BitLocker', { version: 2, settingCount: 4 }),
  ];
}

/** Standard-Konfigurationsprofile eines gesunden Windows-Geräts. */
export function healthyConfigurationPolicies(): PolicyStateInfo[] {
  return [
    policy('configuration', 11, 'Contoso – WLAN Firmennetz', { version: 3, settingCount: 5 }),
    policy('configuration', 12, 'Contoso – Endpoint Protection', { version: 7, settingCount: 18 }),
    policy('configuration', 13, 'Contoso – Windows Update Ring Broad', {
      version: 2,
      settingCount: 9,
    }),
  ];
}

export function entraDevice(
  now: Date,
  device: DeviceBase,
  overrides: Partial<EntraDeviceInfo> = {},
): EntraDeviceInfo {
  return {
    objectId: demoGuid('object', parseInt(device.id.slice(-4), 16)),
    deviceId: device.azureADDeviceId,
    displayName: device.deviceName,
    accountEnabled: true,
    trustType: 'AzureAd',
    approximateLastSignInDateTime: ago(now, { hours: 5 }),
    isCompliant: device.complianceState === 'compliant',
    isManaged: true,
    operatingSystemVersion: device.osVersion,
    registrationDateTime: device.enrolledDateTime,
    ...overrides,
  };
}

export function osVolumeKey(now: Date, n: number, createdDaysAgo = 200): BitLockerKeyInfo {
  return {
    id: demoGuid('key', n),
    createdDateTime: ago(now, { days: createdDaysAgo }),
    volumeType: 'operatingSystemVolume',
  };
}

/** App-Status aus dem fiktiven Katalog (src/providers/mock/apps.ts). */
export function appState(
  appId: string,
  displayName: string,
  overrides: Partial<AppInstallStateInfo> = {},
): AppInstallStateInfo {
  return {
    appId,
    displayName,
    version: null,
    intent: 'requiredInstall',
    installState: 'installed',
    ...overrides,
  };
}

/** Standard: Pflicht-Apps installiert, eine verfügbare App nicht installiert. */
export function defaultAppStates(device: Pick<DeviceBase, 'osFamily'>): AppInstallStateInfo[] {
  if (device.osFamily === 'macos') {
    return [
      appState('00000000-0000-0000-0000-0000000000A3', 'Contoso Mac Tools', { version: '2.0' }),
    ];
  }
  return [
    appState('00000000-0000-0000-0000-0000000000A2', 'Contoso VPN Client 5.1', {
      version: '5.1.2',
    }),
    appState('00000000-0000-0000-0000-0000000000A5', 'Northwind CRM Desktop', { version: '8.4' }),
    appState('00000000-0000-0000-0000-0000000000A4', 'Fabrikam PDF Studio 12', {
      intent: 'available',
      installState: 'notInstalled',
    }),
  ];
}

/** Ein Eintrag des Anmeldeprotokolls (erfolgreich, ohne Conditional-Access-Eingriff). */
export function signInEntry(
  now: Date,
  n: number,
  ago_: { days?: number; hours?: number },
  overrides: Partial<SignInEntry> = {},
): SignInEntry {
  return {
    id: `00000000-0000-4000-e000-${n.toString(16).padStart(12, '0')}`,
    createdDateTime: ago(now, ago_),
    appDisplayName: 'Microsoft Office 365 Portal',
    resourceDisplayName: 'Microsoft 365',
    clientAppUsed: 'Browser',
    isInteractive: true,
    correlationId: `00000000-0000-4000-f000-${n.toString(16).padStart(12, '0')}`,
    conditionalAccessStatus: 'success',
    errorCode: 0,
    failureReason: null,
    additionalDetails: null,
    deviceIsCompliant: true,
    deviceIsManaged: true,
    appliedPolicies: [
      caPolicy('Contoso – Kompatibles Gerät erforderlich', 'success', [
        'Require device to be marked as compliant',
      ]),
    ],
    ...overrides,
  };
}

/** Von Conditional Access ausgewertete Richtlinie (fiktiv). */
export function caPolicy(
  displayName: string,
  result: AppliedPolicyInfo['result'],
  grantControls: string[] = [],
): AppliedPolicyInfo {
  return {
    id: `00000000-0000-4000-b100-${(displayName.length * 7919).toString(16).padStart(12, '0')}`,
    displayName,
    result,
    enforcedGrantControls: grantControls,
    enforcedSessionControls: [],
  };
}

/** Anmeldungen eines Geräts; `totalForUser` zählt auch Anmeldungen an anderen Geräten. */
export function signInsInfo(
  entries: SignInEntry[],
  overrides: Partial<SignInsInfo> = {},
): SignInsInfo {
  return {
    windowDays: SIGN_IN_WINDOW_DAYS,
    totalForUser: entries.length,
    moreAvailable: false,
    entries,
    ...overrides,
  };
}

/** Standard: zwei erfolgreiche Anmeldungen der letzten Tage, ohne Befund. */
export function defaultSignIns(now: Date, _device: Pick<DeviceBase, 'osFamily'>): SignInsInfo {
  void _device;
  return signInsInfo([signInEntry(now, 1, { hours: 5 }), signInEntry(now, 2, { days: 2 })], {
    totalForUser: 9,
  });
}

/** Windows-LAPS-Metadaten (fiktiv): Sicherung vor `backupDaysAgo` Tagen, nächste Rotation in `refreshInDays`. */
export function localAdminInfo(
  now: Date,
  deviceName: string,
  span: { backupDaysAgo: number; refreshInDays: number },
): LocalAdminInfo {
  return {
    deviceName,
    lastBackupDateTime: ago(now, { days: span.backupDaysAgo }),
    refreshDateTime:
      span.refreshInDays >= 0
        ? inFuture(now, { days: span.refreshInDays })
        : ago(now, { days: -span.refreshInDays }),
  };
}

/** Standard: Kennwort vor wenigen Tagen gesichert, nächste Rotation steht an. */
export function defaultLocalAdmin(
  now: Date,
  device: Pick<DeviceBase, 'deviceName'>,
): LocalAdminInfo {
  return localAdminInfo(now, device.deviceName, { backupDaysAgo: 3, refreshInDays: 27 });
}

/** Autopilot-Eintrag (fiktiv). */
export function autopilotInfo(now: Date, overrides: Partial<AutopilotInfo> = {}): AutopilotInfo {
  return {
    groupTag: 'Contoso-Standard',
    enrollmentState: 'enrolled',
    lastContactedDateTime: ago(now, { days: 2 }),
    manufacturer: 'Microsoft Corporation',
    model: 'Surface Laptop 6',
    matchedBy: 'managedDeviceId',
    ...overrides,
  };
}

/** Standard: bei Autopilot registriert und eingeschrieben. */
export function defaultAutopilot(
  now: Date,
  device: Pick<DeviceBase, 'manufacturer' | 'model'>,
): AutopilotInfo {
  return autopilotInfo(now, { manufacturer: device.manufacturer, model: device.model });
}

/** Gruppen des Geräts (fiktiv). */
export function deviceGroupsInfo(
  names: string[],
  overrides: Partial<DeviceGroupsInfo> = {},
): DeviceGroupsInfo {
  return {
    groups: names.map((displayName, i) => ({
      id: demoGuid('object', 200 + i),
      displayName,
    })),
    hiddenCount: 0,
    truncated: false,
    ...overrides,
  };
}

/** Standard: drei Gruppen je nach Plattform. */
export function defaultDeviceGroups(device: Pick<DeviceBase, 'osFamily'>): DeviceGroupsInfo {
  const platform =
    device.osFamily === 'windows'
      ? 'Contoso – Windows-Geräte'
      : device.osFamily === 'macos'
        ? 'Contoso – macOS-Geräte'
        : 'Contoso – Mobilgeräte';
  return deviceGroupsInfo(['Contoso – Alle Geräte', platform, 'Contoso – Pilot']);
}

/**
 * Device Health Attestation (fiktive Demo-Rohwerte). Microsoft dokumentiert für die String-Felder
 * keine Werte – die Demo-Werte dienen nur der Darstellung.
 */
export function healthAttestationInfo(
  now: Date,
  overrides: Partial<HealthAttestationInfo> = {},
): HealthAttestationInfo {
  return {
    lastUpdateDateTime: ago(now, { hours: 6 }),
    issuedDateTime: ago(now, { hours: 6 }),
    secureBoot: 'enabled',
    bitLockerStatus: 'enabled',
    codeIntegrity: 'enabled',
    earlyLaunchAntiMalwareDriverProtection: 'enabled',
    bootDebugging: 'disabled',
    testSigning: 'disabled',
    tpmVersion: '2.0',
    healthStatusMismatchInfo: null,
    healthAttestationSupportedStatus: 'supported',
    ...overrides,
  };
}

/** Standard: unauffällige Rohwerte, keine gemeldete Abweichung. */
export function defaultHealthAttestation(now: Date): HealthAttestationInfo {
  return healthAttestationInfo(now);
}
