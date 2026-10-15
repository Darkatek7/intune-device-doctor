/**
 * Microsoft Graph DTOs – Feldnamen und Enum-Werte exakt nach Microsoft Learn (v1.0).
 * Nur Felder, die die App liest. Quellen: docs/graph-api-reference.md.
 *
 * Regel: Hier wird NICHTS ergänzt, was nicht in der offiziellen Doku steht.
 * Graph liefert fehlende Werte oft als null – deshalb sind fast alle Felder nullable.
 */

// ---------- Gemeinsame Hüllen ----------

export interface GraphCollection<T> {
  '@odata.context'?: string;
  '@odata.nextLink'?: string;
  value: T[];
}

/** https://learn.microsoft.com/en-us/graph/errors */
export interface GraphErrorBody {
  error: {
    code: string;
    message: string;
    innerError?: {
      code?: string;
      'request-id'?: string;
      'client-request-id'?: string;
      date?: string;
    };
    details?: Array<{ code: string; message: string; target?: string }>;
  };
}

// ---------- managedDevice (v1.0) ----------
// https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-manageddevice?view=graph-rest-1.0

export type ComplianceState =
  | 'unknown'
  | 'compliant'
  | 'noncompliant'
  | 'conflict'
  | 'error'
  | 'inGracePeriod'
  | 'configManager';

export type ManagementAgentType =
  | 'eas'
  | 'mdm'
  | 'easMdm'
  | 'intuneClient'
  | 'easIntuneClient'
  | 'configurationManagerClient'
  | 'configurationManagerClientMdm'
  | 'configurationManagerClientMdmEas'
  | 'unknown'
  | 'jamf'
  | 'googleCloudDevicePolicyController';

export type DeviceEnrollmentType =
  | 'unknown'
  | 'userEnrollment'
  | 'deviceEnrollmentManager'
  | 'appleBulkWithUser'
  | 'appleBulkWithoutUser'
  | 'windowsAzureADJoin'
  | 'windowsBulkUserless'
  | 'windowsAutoEnrollment'
  | 'windowsBulkAzureDomainJoin'
  | 'windowsCoManagement'
  | 'windowsAzureADJoinUsingDeviceAuth'
  | 'appleUserEnrollment'
  | 'appleUserEnrollmentWithServiceAccount';

export type ManagedDevicePartnerReportedHealthState =
  | 'unknown'
  | 'activated'
  | 'deactivated'
  | 'secured'
  | 'lowSeverity'
  | 'mediumSeverity'
  | 'highSeverity'
  | 'unresponsive'
  | 'compromised'
  | 'misconfigured';

export interface GraphManagedDevice {
  id: string;
  deviceName: string | null;
  userPrincipalName: string | null;
  userDisplayName: string | null;
  operatingSystem: string | null;
  osVersion: string | null;
  model: string | null;
  manufacturer: string | null;
  serialNumber: string | null;
  complianceState: ComplianceState;
  complianceGracePeriodExpirationDateTime: string | null;
  lastSyncDateTime: string | null;
  enrolledDateTime: string | null;
  managementAgent: ManagementAgentType;
  deviceEnrollmentType: DeviceEnrollmentType;
  isEncrypted: boolean | null;
  jailBroken: string | null;
  azureADDeviceId: string | null;
  partnerReportedThreatState: ManagedDevicePartnerReportedHealthState;
  freeStorageSpaceInBytes: number | null;
  totalStorageSpaceInBytes: number | null;
}

/** Felder für die Trefferliste der Suche ($select). */
export const MANAGED_DEVICE_LIST_SELECT = [
  'id',
  'deviceName',
  'userPrincipalName',
  'userDisplayName',
  'operatingSystem',
  'osVersion',
  'model',
  'manufacturer',
  'complianceState',
  'lastSyncDateTime',
] as const;

// ---------- windowsProtectionState (v1.0) ----------
// https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-windowsprotectionstate?view=graph-rest-1.0

export type WindowsDeviceHealthState =
  | 'clean'
  | 'fullScanPending'
  | 'rebootPending'
  | 'manualStepsPending'
  | 'offlineScanPending'
  | 'critical';

export interface GraphWindowsProtectionState {
  id: string;
  malwareProtectionEnabled: boolean | null;
  deviceState: WindowsDeviceHealthState | null;
  realTimeProtectionEnabled: boolean | null;
  networkInspectionSystemEnabled: boolean | null;
  quickScanOverdue: boolean | null;
  fullScanOverdue: boolean | null;
  signatureUpdateOverdue: boolean | null;
  rebootRequired: boolean | null;
  fullScanRequired: boolean | null;
  engineVersion: string | null;
  signatureVersion: string | null;
  antiMalwareVersion: string | null;
  lastQuickScanDateTime: string | null;
  lastFullScanDateTime: string | null;
  lastQuickScanSignatureVersion: string | null;
  lastFullScanSignatureVersion: string | null;
  lastReportedDateTime: string | null;
  /** windowsDefenderProductStatus – Flags-Enum, kommaseparierter String (z. B. "avSignaturesOutOfDate,rebootPending"). */
  productStatus: string | null;
  isVirtualMachine: boolean | null;
  tamperProtectionEnabled: boolean | null;
}

// https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-windowsdevicemalwarestate?view=graph-rest-1.0
export type WindowsMalwareSeverity = 'unknown' | 'low' | 'moderate' | 'high' | 'severe';
export type WindowsMalwareExecutionState =
  'unknown' | 'blocked' | 'allowed' | 'running' | 'notRunning';
export type WindowsMalwareState =
  | 'unknown'
  | 'detected'
  | 'cleaned'
  | 'quarantined'
  | 'removed'
  | 'allowed'
  | 'blocked'
  | 'cleanFailed'
  | 'quarantineFailed'
  | 'removeFailed'
  | 'allowFailed'
  | 'abandoned'
  | 'blockFailed';
export type WindowsMalwareThreatState =
  | 'active'
  | 'actionFailed'
  | 'manualStepsRequired'
  | 'fullScanRequired'
  | 'rebootRequired'
  | 'remediatedWithNonCriticalFailures'
  | 'quarantined'
  | 'removed'
  | 'cleaned'
  | 'allowed'
  | 'noStatusCleared';

export interface GraphWindowsDeviceMalwareState {
  id: string;
  displayName: string | null;
  additionalInformationUrl: string | null;
  severity: WindowsMalwareSeverity;
  executionState: WindowsMalwareExecutionState;
  state: WindowsMalwareState;
  threatState: WindowsMalwareThreatState;
  initialDetectionDateTime: string | null;
  lastStateChangeDateTime: string | null;
  detectionCount: number | null;
  /** windowsMalwareCategory – ca. 50 Werte, daher als string typisiert. */
  category: string | null;
}

// ---------- Compliance- / Konfigurations-Status pro Gerät (v1.0) ----------
// Route existiert in v1.0 (PowerShell SDK: Get-MgDeviceManagementManagedDeviceCompliancePolicyState /
// ...ConfigurationState), es gibt aber keine REST-Referenzseite für den Parent-Typ.
// Kind-Typ dokumentiert: https://learn.microsoft.com/en-us/graph/api/resources/intune-deviceconfig-devicecompliancepolicysettingstate?view=graph-rest-1.0

export type ComplianceStatus =
  | 'unknown'
  | 'notApplicable'
  | 'compliant'
  | 'remediated'
  | 'nonCompliant'
  | 'error'
  | 'conflict'
  | 'notAssigned';

export type PolicyPlatformType =
  | 'android'
  | 'androidForWork'
  | 'iOS'
  | 'macOS'
  | 'windowsPhone81'
  | 'windows81AndLater'
  | 'windows10AndLater'
  | 'all';

export interface GraphSettingSource {
  id: string | null;
  displayName: string | null;
  sourceType?: string | null;
}

export interface GraphPolicySettingState {
  setting: string | null;
  settingName: string | null;
  instanceDisplayName: string | null;
  state: ComplianceStatus;
  errorCode: number | null;
  errorDescription: string | null;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userPrincipalName: string | null;
  sources: GraphSettingSource[] | null;
  currentValue: string | null;
}

/** deviceCompliancePolicyState bzw. deviceConfigurationState (gleiche Form). */
export interface GraphDevicePolicyState {
  id: string;
  displayName: string | null;
  version: number | null;
  platformType: PolicyPlatformType | null;
  state: ComplianceStatus;
  settingCount: number | null;
  settingStates: GraphPolicySettingState[] | null;
}

// ---------- Entra-Gerät (v1.0) ----------
// https://learn.microsoft.com/en-us/graph/api/resources/device?view=graph-rest-1.0

export interface GraphEntraDevice {
  id: string;
  deviceId: string | null;
  displayName: string | null;
  accountEnabled: boolean | null;
  /** Workplace | AzureAd | ServerAd */
  trustType: 'Workplace' | 'AzureAd' | 'ServerAd' | null;
  approximateLastSignInDateTime: string | null;
  isCompliant: boolean | null;
  isManaged: boolean | null;
  operatingSystem: string | null;
  operatingSystemVersion: string | null;
  registrationDateTime: string | null;
  managementType?: string | null;
}

export const ENTRA_DEVICE_SELECT = [
  'id',
  'deviceId',
  'displayName',
  'accountEnabled',
  'trustType',
  'approximateLastSignInDateTime',
  'isCompliant',
  'isManaged',
  'operatingSystem',
  'operatingSystemVersion',
  'registrationDateTime',
] as const;

// ---------- BitLocker-Recovery-Key-Metadaten (v1.0) ----------
// https://learn.microsoft.com/en-us/graph/api/bitlocker-list-recoverykeys?view=graph-rest-1.0
// WICHTIG: niemals $select=key anfordern – die App zeigt nur, OB Schlüssel hinterlegt sind.

export interface GraphBitlockerRecoveryKey {
  id: string;
  createdDateTime: string | null;
  deviceId: string | null;
  /** volumeType: operatingSystemVolume(1) | fixedDataVolume(2) | removableDataVolume(3) | unknownFutureValue(4) – Mapper muss Name ODER Zahl akzeptieren. */
  volumeType: string | number | null;
}
