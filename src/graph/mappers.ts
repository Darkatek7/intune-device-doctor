/**
 * Graph-DTO → Domain-Modell. Null-sicher: Graph liefert fehlende Werte oft als null oder lässt
 * Felder weg. Unbekannte Enum-Werte werden – wo der Domain-Typ es zulässt – zu 'unknown'.
 */
import type {
  BitLockerKeyInfo,
  BitLockerVolumeType,
  DataSource,
  DetectedMalware,
  DeviceSearchResult,
  EntraDeviceInfo,
  ManagedDeviceInfo,
  PolicyStateInfo,
  WindowsProtectionInfo,
} from '../domain/types';
import { osFamilyFrom } from '../domain/format';
import type {
  ComplianceState,
  ComplianceStatus,
  DeviceEnrollmentType,
  GraphBitlockerRecoveryKey,
  GraphDevicePolicyState,
  GraphEntraDevice,
  GraphManagedDevice,
  GraphPolicySettingState,
  GraphWindowsDeviceMalwareState,
  GraphWindowsProtectionState,
  ManagedDevicePartnerReportedHealthState,
  ManagementAgentType,
  PolicyPlatformType,
  WindowsDeviceHealthState,
  WindowsMalwareSeverity,
  WindowsMalwareState,
  WindowsMalwareThreatState,
} from './dto';
import { Endpoints, type EndpointId } from './endpoints';

// ---------- Hilfen ----------

/** Quelle für die UI: Endpoint-`display` + Doku-Link. */
export function graphSource(endpoint: EndpointId): DataSource {
  const def = Endpoints[endpoint];
  return { kind: 'graph', label: def.display, docsUrl: def.docsUrl };
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function pickOrNull<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const bool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);
const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

// ---------- Erlaubte Enum-Werte (exakt nach docs/graph-api-reference.md) ----------

const COMPLIANCE_STATES: readonly ComplianceState[] = [
  'unknown',
  'compliant',
  'noncompliant',
  'conflict',
  'error',
  'inGracePeriod',
  'configManager',
];

const MANAGEMENT_AGENTS: readonly ManagementAgentType[] = [
  'eas',
  'mdm',
  'easMdm',
  'intuneClient',
  'easIntuneClient',
  'configurationManagerClient',
  'configurationManagerClientMdm',
  'configurationManagerClientMdmEas',
  'unknown',
  'jamf',
  'googleCloudDevicePolicyController',
];

const ENROLLMENT_TYPES: readonly DeviceEnrollmentType[] = [
  'unknown',
  'userEnrollment',
  'deviceEnrollmentManager',
  'appleBulkWithUser',
  'appleBulkWithoutUser',
  'windowsAzureADJoin',
  'windowsBulkUserless',
  'windowsAutoEnrollment',
  'windowsBulkAzureDomainJoin',
  'windowsCoManagement',
  'windowsAzureADJoinUsingDeviceAuth',
  'appleUserEnrollment',
  'appleUserEnrollmentWithServiceAccount',
];

const PARTNER_STATES: readonly ManagedDevicePartnerReportedHealthState[] = [
  'unknown',
  'activated',
  'deactivated',
  'secured',
  'lowSeverity',
  'mediumSeverity',
  'highSeverity',
  'unresponsive',
  'compromised',
  'misconfigured',
];

const DEVICE_HEALTH_STATES: readonly WindowsDeviceHealthState[] = [
  'clean',
  'fullScanPending',
  'rebootPending',
  'manualStepsPending',
  'offlineScanPending',
  'critical',
];

const MALWARE_SEVERITIES: readonly WindowsMalwareSeverity[] = [
  'unknown',
  'low',
  'moderate',
  'high',
  'severe',
];

const MALWARE_STATES: readonly WindowsMalwareState[] = [
  'unknown',
  'detected',
  'cleaned',
  'quarantined',
  'removed',
  'allowed',
  'blocked',
  'cleanFailed',
  'quarantineFailed',
  'removeFailed',
  'allowFailed',
  'abandoned',
  'blockFailed',
];

const MALWARE_THREAT_STATES: readonly WindowsMalwareThreatState[] = [
  'active',
  'actionFailed',
  'manualStepsRequired',
  'fullScanRequired',
  'rebootRequired',
  'remediatedWithNonCriticalFailures',
  'quarantined',
  'removed',
  'cleaned',
  'allowed',
  'noStatusCleared',
];

const COMPLIANCE_STATUSES: readonly ComplianceStatus[] = [
  'unknown',
  'notApplicable',
  'compliant',
  'remediated',
  'nonCompliant',
  'error',
  'conflict',
  'notAssigned',
];

const PLATFORM_TYPES: readonly PolicyPlatformType[] = [
  'android',
  'androidForWork',
  'iOS',
  'macOS',
  'windowsPhone81',
  'windows81AndLater',
  'windows10AndLater',
  'all',
];

const TRUST_TYPES = ['Workplace', 'AzureAd', 'ServerAd'] as const;

// ---------- managedDevice ----------

export function mapManagedDevice(dto: GraphManagedDevice): ManagedDeviceInfo {
  return {
    id: dto.id,
    deviceName: str(dto.deviceName)?.trim() || '–',
    osFamily: osFamilyFrom(dto.operatingSystem),
    operatingSystem: str(dto.operatingSystem),
    osVersion: str(dto.osVersion),
    model: str(dto.model),
    manufacturer: str(dto.manufacturer),
    serialNumber: str(dto.serialNumber),
    userPrincipalName: str(dto.userPrincipalName),
    userDisplayName: str(dto.userDisplayName),
    complianceState: pick(dto.complianceState, COMPLIANCE_STATES, 'unknown'),
    complianceGracePeriodExpirationDateTime: str(dto.complianceGracePeriodExpirationDateTime),
    lastSyncDateTime: str(dto.lastSyncDateTime),
    enrolledDateTime: str(dto.enrolledDateTime),
    managementAgent: pick(dto.managementAgent, MANAGEMENT_AGENTS, 'unknown'),
    deviceEnrollmentType: pick(dto.deviceEnrollmentType, ENROLLMENT_TYPES, 'unknown'),
    isEncrypted: bool(dto.isEncrypted),
    jailBroken: str(dto.jailBroken),
    azureADDeviceId: str(dto.azureADDeviceId),
    partnerReportedThreatState: pick(dto.partnerReportedThreatState, PARTNER_STATES, 'unknown'),
    freeStorageSpaceInBytes: num(dto.freeStorageSpaceInBytes),
    totalStorageSpaceInBytes: num(dto.totalStorageSpaceInBytes),
    source: graphSource('managedDevice'),
  };
}

/** Trefferliste (nur $select-Felder aus MANAGED_DEVICE_LIST_SELECT). */
export function mapSearchResult(
  dto: Partial<GraphManagedDevice> & { id: string },
): DeviceSearchResult {
  return {
    id: dto.id,
    deviceName: str(dto.deviceName)?.trim() || '–',
    userPrincipalName: str(dto.userPrincipalName),
    userDisplayName: str(dto.userDisplayName),
    operatingSystem: str(dto.operatingSystem),
    osVersion: str(dto.osVersion),
    model: str(dto.model),
    complianceState: pick(dto.complianceState, COMPLIANCE_STATES, 'unknown'),
    lastSyncDateTime: str(dto.lastSyncDateTime),
  };
}

// ---------- Defender ----------

/** windowsDefenderProductStatus ist ein Flags-Enum als kommaseparierter String. */
export function splitProductStatus(productStatus: string | null | undefined): string[] {
  if (typeof productStatus !== 'string') return [];
  return productStatus
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function mapDetectedMalware(dto: GraphWindowsDeviceMalwareState): DetectedMalware {
  return {
    id: dto.id,
    displayName: str(dto.displayName),
    severity: pick(dto.severity, MALWARE_SEVERITIES, 'unknown'),
    state: pick(dto.state, MALWARE_STATES, 'unknown'),
    // Der dokumentierte Enum windowsMalwareThreatState kennt kein 'unknown'. Unbekannte/fehlende
    // Werte werden daher als 'unknown' durchgereicht (Regeln vergleichen nur mit bekannten Werten).
    threatState: (pickOrNull(dto.threatState, MALWARE_THREAT_STATES) ??
      'unknown') as WindowsMalwareThreatState,
    category: str(dto.category),
    initialDetectionDateTime: str(dto.initialDetectionDateTime),
    lastStateChangeDateTime: str(dto.lastStateChangeDateTime),
    detectionCount: num(dto.detectionCount),
    additionalInformationUrl: str(dto.additionalInformationUrl),
  };
}

export function mapWindowsProtection(
  dto: GraphWindowsProtectionState,
  malware: GraphWindowsDeviceMalwareState[] = [],
): WindowsProtectionInfo {
  return {
    malwareProtectionEnabled: bool(dto.malwareProtectionEnabled),
    realTimeProtectionEnabled: bool(dto.realTimeProtectionEnabled),
    networkInspectionSystemEnabled: bool(dto.networkInspectionSystemEnabled),
    tamperProtectionEnabled: bool(dto.tamperProtectionEnabled),
    deviceState: pickOrNull(dto.deviceState, DEVICE_HEALTH_STATES),
    productStatus: splitProductStatus(dto.productStatus),
    signatureVersion: str(dto.signatureVersion),
    engineVersion: str(dto.engineVersion),
    antiMalwareVersion: str(dto.antiMalwareVersion),
    signatureUpdateOverdue: bool(dto.signatureUpdateOverdue),
    quickScanOverdue: bool(dto.quickScanOverdue),
    fullScanOverdue: bool(dto.fullScanOverdue),
    fullScanRequired: bool(dto.fullScanRequired),
    rebootRequired: bool(dto.rebootRequired),
    lastQuickScanDateTime: str(dto.lastQuickScanDateTime),
    lastFullScanDateTime: str(dto.lastFullScanDateTime),
    lastReportedDateTime: str(dto.lastReportedDateTime),
    isVirtualMachine: bool(dto.isVirtualMachine),
    detectedMalware: malware.map(mapDetectedMalware),
  };
}

// ---------- Compliance- / Konfigurationsstatus ----------

function mapSettingState(dto: GraphPolicySettingState): PolicyStateInfo['settings'][number] {
  return {
    setting: str(dto.setting),
    settingName: str(dto.settingName),
    instanceDisplayName: str(dto.instanceDisplayName),
    state: pick(dto.state, COMPLIANCE_STATUSES, 'unknown'),
    errorCode: num(dto.errorCode),
    errorDescription: str(dto.errorDescription),
    currentValue: str(dto.currentValue),
    sources: (Array.isArray(dto.sources) ? dto.sources : []).map((source) => ({
      id: str(source?.id),
      displayName: str(source?.displayName),
    })),
  };
}

export function mapPolicyState(
  dto: GraphDevicePolicyState,
  kind: PolicyStateInfo['kind'],
): PolicyStateInfo {
  const settings = Array.isArray(dto.settingStates) ? dto.settingStates.map(mapSettingState) : [];
  return {
    id: dto.id,
    kind,
    displayName: str(dto.displayName)?.trim() || dto.id,
    state: pick(dto.state, COMPLIANCE_STATUSES, 'unknown'),
    platformType: pickOrNull(dto.platformType, PLATFORM_TYPES),
    version: num(dto.version),
    settingCount: num(dto.settingCount),
    settings,
  };
}

// ---------- Entra ----------

export function mapEntraDevice(dto: GraphEntraDevice): EntraDeviceInfo {
  return {
    objectId: dto.id,
    deviceId: str(dto.deviceId),
    displayName: str(dto.displayName),
    accountEnabled: bool(dto.accountEnabled),
    trustType: pickOrNull(dto.trustType, TRUST_TYPES),
    approximateLastSignInDateTime: str(dto.approximateLastSignInDateTime),
    isCompliant: bool(dto.isCompliant),
    isManaged: bool(dto.isManaged),
    operatingSystemVersion: str(dto.operatingSystemVersion),
    registrationDateTime: str(dto.registrationDateTime),
  };
}

// ---------- BitLocker (nur Metadaten) ----------

const VOLUME_TYPE_BY_NUMBER: Record<number, BitLockerVolumeType> = {
  1: 'operatingSystemVolume',
  2: 'fixedDataVolume',
  3: 'removableDataVolume',
};

const VOLUME_TYPE_NAMES: readonly BitLockerVolumeType[] = [
  'operatingSystemVolume',
  'fixedDataVolume',
  'removableDataVolume',
];

/** volumeType kann als Name oder als Zahl (1/2/3) kommen; alles andere (inkl. unknownFutureValue) → 'unknown'. */
export function mapVolumeType(value: string | number | null | undefined): BitLockerVolumeType {
  if (typeof value === 'number') return VOLUME_TYPE_BY_NUMBER[value] ?? 'unknown';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return VOLUME_TYPE_BY_NUMBER[Number(trimmed)] ?? 'unknown';
    return pick(trimmed, VOLUME_TYPE_NAMES, 'unknown');
  }
  return 'unknown';
}

/** Es wird bewusst nur id/createdDateTime/volumeType übernommen – nie ein Schlüsselwert. */
export function mapBitlockerKey(dto: GraphBitlockerRecoveryKey): BitLockerKeyInfo {
  return {
    id: dto.id,
    createdDateTime: str(dto.createdDateTime),
    volumeType: mapVolumeType(dto.volumeType),
  };
}
