/**
 * Bausteine für Demo-Szenarien. Alle Daten sind fiktiv (Contoso), Zeitwerte relativ zu `now`.
 */
import type {
  BitLockerKeyInfo,
  EntraDeviceInfo,
  ManagedDeviceInfo,
  PolicySettingInfo,
  PolicyStateInfo,
  WindowsProtectionInfo,
} from '../../../domain/types';

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
  group: 'device' | 'entra' | 'object' | 'policy' | 'key',
  n: number,
): string {
  const groupDigit = { device: '8', entra: '9', object: 'a', policy: 'b', key: 'c' }[group];
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
