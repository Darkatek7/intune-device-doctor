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
  /** Primärer Benutzer (Entra-Objekt-ID); leer bzw. Null-GUID bei Geräten ohne Benutzer */
  userId: string | null;
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
  /** Ablauf des MDM-Gerätezertifikats */
  managementCertificateExpirationDate: string | null;
  /** iOS/iPadOS: beaufsichtigt (supervised) */
  isSupervised: boolean | null;
  /** Android: Sicherheitspatch-Level, z. B. "2026-09-01" */
  androidSecurityPatchLevel: string | null;
  enrollmentProfileName: string | null;
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
}

export interface GraphPolicySettingState {
  setting: string | null;
  settingName: string | null;
  instanceDisplayName: string | null;
  state: ComplianceStatus;
  errorCode: number | null;
  errorDescription: string | null;
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

// ---------- mobileApp (v1.0) ----------
// https://learn.microsoft.com/en-us/graph/api/intune-apps-mobileapp-get?view=graph-rest-1.0

export interface GraphMobileApp {
  id: string;
  displayName: string | null;
  publisher: string | null;
}

export const MOBILE_APP_SELECT = ['id', 'displayName', 'publisher'] as const;

// ---------- applePushNotificationCertificate (v1.0, Tenant) ----------
// https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-applepushnotificationcertificate?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/intune-devices-applepushnotificationcertificate-get?view=graph-rest-1.0

export interface GraphApplePushNotificationCertificate {
  id: string;
  expirationDateTime: string | null;
  lastModifiedDateTime: string | null;
}

/** Bewusst ohne appleIdentifier (Apple-ID, personenbezogen) und ohne certificate. */
export const APPLE_PUSH_CERTIFICATE_SELECT = [
  'expirationDateTime',
  'lastModifiedDateTime',
] as const;

// ---------- App-Absicht und Installationsstatus pro Benutzer/Gerät (BETA) ----------
// https://learn.microsoft.com/en-us/graph/api/intune-troubleshooting-mobileappintentandstate-list?view=graph-rest-beta
// https://learn.microsoft.com/en-us/graph/api/resources/intune-troubleshooting-mobileappintentandstatedetail?view=graph-rest-beta

export type MobileAppIntent =
  | 'available'
  | 'notAvailable'
  | 'requiredInstall'
  | 'requiredUninstall'
  | 'requiredAndAvailableInstall'
  | 'availableInstallWithoutEnrollment'
  | 'exclude';

/** resultantAppState */
export type ResultantAppState =
  | 'installed'
  | 'failed'
  | 'notInstalled'
  | 'uninstallFailed'
  | 'pendingInstall'
  | 'unknown'
  | 'notApplicable';

export interface GraphMobileAppIntentAndStateDetail {
  applicationId: string | null;
  displayName: string | null;
  mobileAppIntent: MobileAppIntent | null;
  displayVersion: string | null;
  installState: ResultantAppState | null;
}

export interface GraphMobileAppIntentAndState {
  id: string;
  managedDeviceIdentifier: string | null;
  userId: string | null;
  mobileAppList: GraphMobileAppIntentAndStateDetail[] | null;
}

// ---------- Anmeldeprotokoll (v1.0, auditLogs/signIns) ----------
// https://learn.microsoft.com/en-us/graph/api/signin-list?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/signin?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/devicedetail?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/appliedconditionalaccesspolicy?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/signinstatus?view=graph-rest-1.0
// Die Antwort enthält weitere Felder (ipAddress, location, Risiko-Felder, userPrincipalName …). Sie
// stehen bewusst NICHT in diesem DTO und werden nie in das Domain-Modell übernommen (Datensparsamkeit).

/** conditionalAccessStatus */
export type ConditionalAccessStatus = 'success' | 'failure' | 'notApplied' | 'unknownFutureValue';

/**
 * appliedConditionalAccessPolicyResult. Die reportOnly*-Werte liefert Graph nur mit dem Header
 * `Prefer: include-unknown-enum-members` – die App fordert ihn nicht an.
 */
export type AppliedConditionalAccessPolicyResult =
  'success' | 'failure' | 'notApplied' | 'notEnabled' | 'unknown' | 'unknownFutureValue';

export interface GraphAppliedConditionalAccessPolicy {
  id: string | null;
  displayName: string | null;
  enforcedGrantControls: string[] | null;
  enforcedSessionControls: string[] | null;
  result: AppliedConditionalAccessPolicyResult | null;
}

export interface GraphSignInStatus {
  /** 5–6-stelliger Entra-Fehlercode (Int32), 0 = Erfolg */
  errorCode: number | null;
  failureReason: string | null;
  additionalDetails: string | null;
}

export interface GraphSignInDeviceDetail {
  /** Nur für in Entra registrierte Geräte gefüllt */
  deviceId: string | null;
  isCompliant: boolean | null;
  isManaged: boolean | null;
  trustType: string | null;
  operatingSystem: string | null;
}

export interface GraphSignIn {
  id: string;
  createdDateTime: string | null;
  appDisplayName: string | null;
  resourceDisplayName: string | null;
  clientAppUsed: string | null;
  isInteractive: boolean | null;
  /** Anfrage-ID des Clients – nur zum Wiederfinden des Eintrags im Entra Admin Center */
  correlationId: string | null;
  conditionalAccessStatus: ConditionalAccessStatus | null;
  status: GraphSignInStatus | null;
  deviceDetail: GraphSignInDeviceDetail | null;
  /** Fehlt komplett (kein Fehler!), wenn dem Konto das Leserecht auf Conditional-Access-Daten fehlt. */
  appliedConditionalAccessPolicies?: GraphAppliedConditionalAccessPolicy[] | null;
}

// ---------- Windows LAPS (v1.0, directory/deviceLocalCredentials) ----------
// https://learn.microsoft.com/en-us/graph/api/devicelocalcredentialinfo-get?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/devicelocalcredentialinfo?view=graph-rest-1.0

/**
 * Nur Metadaten. Die Eigenschaft `credentials` (Kennwort, nur mit `$select=credentials` und dem
 * Scope DeviceLocalCredential.Read.All lesbar) steht bewusst NICHT in diesem DTO und wird nie angefordert.
 */
export const LAPS_SELECT = ['id', 'deviceName', 'lastBackupDateTime', 'refreshDateTime'] as const;

export interface GraphDeviceLocalCredentialInfo {
  /** = deviceId des Entra-Geräts (= azureADDeviceId des Intune-Geräts) */
  id: string | null;
  deviceName: string | null;
  /** Zeitpunkt der letzten Sicherung des lokalen Administrator-Kennworts in Entra */
  lastBackupDateTime: string | null;
  /** Zeitpunkt der nächsten geplanten Aktualisierung (Rotation) und Sicherung */
  refreshDateTime: string | null;
}

// ---------- Windows Autopilot (v1.0, deviceManagement/windowsAutopilotDeviceIdentities) ----------
// https://learn.microsoft.com/en-us/graph/api/intune-enrollment-windowsautopilotdeviceidentity-list?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/intune-enrollment-windowsautopilotdeviceidentity?view=graph-rest-1.0
// Bewusst NICHT im DTO: productKey, userPrincipalName/addressableUserName, azureActiveDirectoryDeviceId
// („to be deprecated“) sowie alle Felder, die es nur in beta gibt (z. B. deploymentProfileAssignmentStatus).

/** enrollmentState (v1.0) */
export type AutopilotEnrollmentState =
  'unknown' | 'enrolled' | 'pendingReset' | 'failed' | 'notContacted';

export interface GraphWindowsAutopilotDeviceIdentity {
  id: string;
  groupTag: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  enrollmentState: AutopilotEnrollmentState | null;
  lastContactedDateTime: string | null;
  managedDeviceId: string | null;
}

// ---------- Gruppen des Geräts (v1.0, devices(deviceId='…')/transitiveMemberOf) ----------
// https://learn.microsoft.com/en-us/graph/api/device-list-transitivememberof?view=graph-rest-1.0
// Ohne Leserecht auf einen Objekttyp kommen Mitglieder laut Doku nur mit @odata.type und id zurück.

export interface GraphDirectoryObject {
  '@odata.type'?: string;
  id?: string | null;
  displayName?: string | null;
}
