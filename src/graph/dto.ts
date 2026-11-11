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
  /**
   * M20/S4: Ergebnisse der Remote-Aktionen (read-only, ohne $select im Get enthalten).
   * https://learn.microsoft.com/graph/api/resources/intune-devices-deviceactionresult?view=graph-rest-1.0
   */
  deviceActionResults?: GraphDeviceActionResult[] | null;
}

/** actionState (v1.0): dokumentierte Werte. Andere Werte → 'unknown' plus Rohwert. */
export const ACTION_STATES = [
  'none',
  'pending',
  'canceled',
  'active',
  'done',
  'failed',
  'notSupported',
] as const;
export type ActionState = (typeof ACTION_STATES)[number];

/** deviceActionResult (v1.0). Für `actionName` ist keine Werteliste dokumentiert – nur Rohwert. */
export interface GraphDeviceActionResult {
  actionName?: string | null;
  actionState?: string | null;
  startDateTime?: string | null;
  lastUpdatedDateTime?: string | null;
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
  'serialNumber',
  'complianceState',
  'lastSyncDateTime',
] as const;

/** Weitere Geräte desselben Benutzers (Geräte-Header): nur das Nötigste. */
export const USER_DEVICES_SELECT = [
  'id',
  'deviceName',
  'operatingSystem',
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
  /** Nur bei der Abfrage gleichnamiger Objekte angefordert: RegisteredDevice | SecureVM | Printer | Shared | IoT */
  profileType?: string | null;
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

/**
 * Gleichnamige Entra-Geräteobjekte (M14/S1): `GET /devices?$filter=displayName eq '…'`. `eq` auf
 * displayName ist ohne ConsistencyLevel-Header möglich (Standard-Query). Nicht angefordert werden
 * `physicalIds` und `deviceMetadata`.
 * https://learn.microsoft.com/en-us/graph/api/device-list?view=graph-rest-1.0
 * https://learn.microsoft.com/en-us/graph/aad-advanced-queries#device-properties
 */
export const ENTRA_SAME_NAME_SELECT = [
  'id',
  'deviceId',
  'displayName',
  'trustType',
  'accountEnabled',
  'approximateLastSignInDateTime',
  'isCompliant',
  'isManaged',
  'registrationDateTime',
  'profileType',
  'operatingSystem',
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

// ---------- Integritätsnachweis (v1.0, managedDevice.deviceHealthAttestationState) ----------
// https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-devicehealthattestationstate?view=graph-rest-1.0
// Fast alle Felder sind String ohne dokumentierte Werte → nur Rohwerte. `virtualSecureMode` wird nicht
// verwendet (Support in v1.0 beendet; ersetzt durch virtualizationBasedSecurity).

export interface GraphDeviceHealthAttestationState {
  /** String (kein DateTimeOffset!) laut Doku */
  lastUpdateDateTime: string | null;
  issuedDateTime: string | null;
  secureBoot: string | null;
  bitLockerStatus: string | null;
  codeIntegrity: string | null;
  earlyLaunchAntiMalwareDriverProtection: string | null;
  bootDebugging: string | null;
  testSigning: string | null;
  tpmVersion: string | null;
  /** „Erscheint, wenn der DHA-Dienst ein Integritätsproblem erkennt“ (Ressourcenbeschreibung) */
  healthStatusMismatchInfo: string | null;
  healthAttestationSupportedStatus: string | null;
}

export interface GraphManagedDeviceHealthAttestation {
  id?: string;
  deviceHealthAttestationState?: Partial<GraphDeviceHealthAttestationState> | null;
}

// ---------- Zuweisungen (v1.0) – Richtlinien und Apps (M14/S2) ----------
// https://learn.microsoft.com/en-us/graph/api/intune-deviceconfig-deviceconfigurationassignment-list?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/intune-deviceconfig-devicecompliancepolicyassignment-list?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/intune-apps-mobileappassignment-list?view=graph-rest-1.0
// Ziele (deviceAndAppManagementAssignmentTarget): groupAssignmentTarget und exclusionGroupAssignmentTarget
// (je `groupId`), allDevicesAssignmentTarget, allLicensedUsersAssignmentTarget. Das `@odata.type` steht in
// der Praxis mit führendem `#`; die Doku-Beispiele zeigen es teils ohne → der Mapper akzeptiert beides.
// Bewusst NICHT im DTO: `settings` (App-Zuweisungseinstellungen) und Zuweisungsfilter (nur beta).

/** installIntent (mobileAppAssignment.intent) */
export type MobileAppAssignmentIntent =
  'available' | 'required' | 'uninstall' | 'availableWithoutEnrollment';

export interface GraphAssignmentTarget {
  '@odata.type'?: string | null;
  /** Nur bei group-/exclusionGroupAssignmentTarget */
  groupId?: string | null;
}

/** deviceConfigurationAssignment, deviceCompliancePolicyAssignment bzw. mobileAppAssignment */
export interface GraphAssignment {
  id?: string | null;
  /** Nur bei mobileAppAssignment */
  intent?: MobileAppAssignmentIntent | null;
  target?: GraphAssignmentTarget | null;
}

// ---------- Lizenzen des Benutzers (v1.0, users/{id}/licenseDetails) – M14/S3 ----------
// https://learn.microsoft.com/en-us/graph/api/user-list-licensedetails?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/serviceplaninfo?view=graph-rest-1.0
// Scope LicenseAssignment.Read.All (optional). Gelesen werden nur Plan-IDs/-Namen/-Status und die SKU.

/** servicePlanInfo.provisioningStatus */
export type ServicePlanProvisioningStatus =
  'Success' | 'Disabled' | 'Error' | 'PendingInput' | 'PendingActivation' | 'PendingProvisioning';

export interface GraphServicePlanInfo {
  servicePlanId: string | null;
  servicePlanName: string | null;
  provisioningStatus: ServicePlanProvisioningStatus | null;
  /** User | Company */
  appliesTo: string | null;
}

export interface GraphLicenseDetails {
  id?: string | null;
  skuId: string | null;
  skuPartNumber: string | null;
  servicePlans: GraphServicePlanInfo[] | null;
}

export const LICENSE_DETAILS_SELECT = ['id', 'skuId', 'skuPartNumber', 'servicePlans'] as const;

// ---------- Gerätelimit (v1.0, deviceManagement/deviceEnrollmentConfigurations) – M14/S3 ----------
// https://learn.microsoft.com/en-us/graph/api/intune-onboarding-deviceenrollmentconfiguration-list?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/intune-onboarding-deviceenrollmentlimitconfiguration?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/intune-onboarding-enrollmentconfigurationassignment-list?view=graph-rest-1.0
// Die Liste enthält Konfigurationen verschiedener Typen; relevant sind nur Einträge mit
// `@odata.type` = #microsoft.graph.deviceEnrollmentLimitConfiguration (Feld `limit`). Zuweisungen haben
// dieselbe Form wie GraphAssignment (id, target).

export interface GraphDeviceEnrollmentConfiguration {
  '@odata.type'?: string | null;
  id: string;
  displayName: string | null;
  /** Benutzer unterliegen nur der Konfiguration mit dem niedrigsten Prioritätswert */
  priority: number | null;
  /** Nur bei deviceEnrollmentLimitConfiguration: maximale Zahl der Geräte, die ein Benutzer registrieren darf */
  limit?: number | null;
}

// ---------- Sicherheitswarnungen (v1.0, security/alerts_v2) – M14/S4 ----------
// https://learn.microsoft.com/en-us/graph/api/security-list-alerts_v2?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/security-alert?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/security-deviceevidence?view=graph-rest-1.0
// Scope SecurityAlert.Read.All (optional). Die Liste kennt kein $select; die Antwort enthält deshalb mehr
// Felder, als hier deklariert sind (u. a. loggedOnUsers, ipInterfaces, assignedTo, Benutzer-/Datei-
// Evidenz). Deklariert – und im Mapper übernommen – wird nur diese Whitelist ohne Personenbezug.

/** alert.severity */
export type SecurityAlertSeverity =
  'unknown' | 'informational' | 'low' | 'medium' | 'high' | 'unknownFutureValue';

/** alert.status (alertStatus) */
export type SecurityAlertStatus =
  'unknown' | 'new' | 'inProgress' | 'resolved' | 'unknownFutureValue';

/** Nur die Felder von microsoft.graph.security.deviceEvidence, die zur Zuordnung und Anzeige dienen. */
export interface GraphSecurityDeviceEvidence {
  '@odata.type'?: string | null;
  azureAdDeviceId?: string | null;
  mdeDeviceId?: string | null;
  deviceDnsName?: string | null;
  hostName?: string | null;
  /** deviceRiskScore: none | informational | low | medium | high | unknownFutureValue */
  riskScore?: string | null;
  /** defenderAvStatus: notReporting | disabled | notUpdated | updated | unknown | notSupported | unknownFutureValue */
  defenderAvStatus?: string | null;
}

export interface GraphSecurityAlert {
  id: string;
  title?: string | null;
  severity?: SecurityAlertSeverity | null;
  status?: SecurityAlertStatus | null;
  createdDateTime?: string | null;
  lastUpdateDateTime?: string | null;
  categories?: string[] | null;
  alertWebUrl?: string | null;
  /** Gemischte Evidenz-Typen; gelesen werden nur #microsoft.graph.security.deviceEvidence-Einträge. */
  evidence?: GraphSecurityDeviceEvidence[] | null;
}

// ---------- Apple-VPP-Token (v1.0, deviceAppManagement/vppTokens) – M14/S5 ----------
// https://learn.microsoft.com/en-us/graph/api/intune-onboarding-vpptoken-list?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/intune-onboarding-vpptoken?view=graph-rest-1.0
// Scope DeviceManagementServiceConfig.Read.All (optional). Die Antwort enthält auch `token` (das
// VPP-Token selbst) und `appleId`; ein $select ist nicht dokumentiert. Diese beiden Felder sind
// deshalb ABSICHTLICH NICHT deklariert und werden nie gelesen, gespeichert oder protokolliert – der
// Mapper übernimmt nur die Whitelist unten (Tests: mappers.test.ts, GraphProvider.test.ts).

/** vppToken.vppTokenAccountType */
export type VppTokenAccountType = 'business' | 'education';

/** vppToken.state (vppTokenState) */
export type VppTokenState = 'unknown' | 'valid' | 'expired' | 'invalid' | 'assignedToExternalMDM';

/** vppToken.lastSyncStatus (vppTokenSyncStatus) */
export type VppTokenSyncStatus = 'none' | 'inProgress' | 'completed' | 'failed';

export interface GraphVppToken {
  id: string;
  organizationName?: string | null;
  vppTokenAccountType?: VppTokenAccountType | null;
  expirationDateTime?: string | null;
  lastSyncDateTime?: string | null;
  state?: VppTokenState | null;
  lastSyncStatus?: VppTokenSyncStatus | null;
  countryOrRegion?: string | null;
  lastAppCount?: number | null;
}

// ---------- Richtlinien → Geräte (v1.0) – M15 ----------
// Konfigurationsprofile:
// https://learn.microsoft.com/en-us/graph/api/intune-deviceconfig-deviceconfiguration-list?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/intune-deviceconfig-deviceconfiguration?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/intune-deviceconfig-deviceconfigurationdeviceoverview?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/intune-deviceconfig-deviceconfigurationdevicestatus?view=graph-rest-1.0
// Compliance-Richtlinien:
// https://learn.microsoft.com/en-us/graph/api/intune-deviceconfig-devicecompliancepolicy-list?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/intune-deviceconfig-devicecompliancepolicy?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/intune-deviceconfig-devicecompliancedeviceoverview?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/intune-deviceconfig-devicecompliancedevicestatus?view=graph-rest-1.0
// Scope DeviceManagementConfiguration.Read.All (least privileged laut Doku, beim Login angefragt).

/**
 * deviceConfiguration bzw. deviceCompliancePolicy (Basistyp). Die Listen liefern abgeleitete Typen
 * (z. B. #microsoft.graph.windows10GeneralConfiguration); ein Plattform-Feld hat der Basistyp nicht.
 * `description` wird bewusst nicht gelesen (freier Admin-Text).
 */
export interface GraphTenantPolicy {
  '@odata.type'?: string | null;
  id: string;
  displayName?: string | null;
  lastModifiedDateTime?: string | null;
  version?: number | null;
}

/**
 * deviceConfigurationDeviceOverview / deviceComplianceDeviceOverview (gleiche Felder). Ein Zähler für
 * Konflikte existiert in v1.0 nicht. Das Doku-Beispiel zeigt die Antwort unter `value` verpackt.
 */
export interface GraphPolicyDeviceOverview {
  pendingCount?: number | null;
  notApplicableCount?: number | null;
  successCount?: number | null;
  errorCount?: number | null;
  failedCount?: number | null;
  lastUpdateDateTime?: string | null;
  configurationVersion?: number | null;
}

/**
 * deviceConfigurationDeviceStatus / deviceComplianceDeviceStatus (gleiche Felder). Die `id` ist laut
 * Doku nur „Key of the entity“ – dass sie die managedDevice-ID ist, ist NICHT belegt. Ein Plattform-Feld
 * gibt es nicht (nur deviceModel). `complianceGracePeriodExpirationDateTime` wird nicht gelesen.
 */
export interface GraphPolicyDeviceStatus {
  id: string;
  deviceDisplayName?: string | null;
  userName?: string | null;
  deviceModel?: string | null;
  status?: ComplianceStatus | null;
  lastReportedDateTime?: string | null;
  userPrincipalName?: string | null;
}

// ---------- Dienststatus (Service Communications, v1.0) – M18 ----------
// https://learn.microsoft.com/en-us/graph/api/serviceannouncement-list-healthoverviews?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/servicehealth?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/servicehealthissue?view=graph-rest-1.0
// Scope ServiceHealth.Read.All (least privileged laut Doku, optional – nicht beim Login).

/**
 * serviceHealthStatus – vollständige Liste laut Ressource serviceHealthIssue. Die Beispielantworten der
 * Doku schreiben die Werte mit großem Anfangsbuchstaben („ServiceOperational“) – der Mapper vergleicht
 * deshalb ohne Rücksicht auf die Schreibweise des ersten Buchstabens.
 */
export const SERVICE_HEALTH_STATUSES = [
  'serviceOperational',
  'investigating',
  'restoringService',
  'verifyingService',
  'serviceRestored',
  'postIncidentReviewPublished',
  'serviceDegradation',
  'serviceInterruption',
  'extendedRecovery',
  'falsePositive',
  'investigationSuspended',
  'resolved',
  'mitigatedExternal',
  'mitigated',
  'resolvedExternal',
  'confirmed',
  'reported',
  'unknownFutureValue',
] as const;
export type ServiceHealthStatus = (typeof SERVICE_HEALTH_STATUSES)[number];

/** serviceHealthClassificationType laut Ressource serviceHealthIssue. */
export const SERVICE_HEALTH_CLASSIFICATIONS = [
  'advisory',
  'incident',
  'unknownFutureValue',
] as const;
export type ServiceHealthClassificationType = (typeof SERVICE_HEALTH_CLASSIFICATIONS)[number];

/**
 * serviceHealthIssue – nur gelesene Felder. Nicht gelesen: `posts` (Verlauf als HTML), `details`,
 * `origin`, `endDateTime`.
 */
export interface GraphServiceHealthIssue {
  id: string;
  title?: string | null;
  classification?: string | null;
  status?: string | null;
  isResolved?: boolean | null;
  startDateTime?: string | null;
  lastModifiedDateTime?: string | null;
  feature?: string | null;
  featureGroup?: string | null;
  impactDescription?: string | null;
}

/** serviceHealth (ein Eintrag aus healthOverviews), mit `$expand=issues` laut Beispiel 2 der Doku. */
export interface GraphServiceHealth {
  id: string;
  service?: string | null;
  status?: string | null;
  issues?: GraphServiceHealthIssue[] | null;
}

// ---------- Registrierungsfehler (Intune Troubleshooting, v1.0) – M18 ----------
// https://learn.microsoft.com/en-us/graph/api/intune-troubleshooting-enrollmenttroubleshootingevent-list?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/intune-troubleshooting-enrollmenttroubleshootingevent?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/intune-troubleshooting-deviceenrollmentfailurereason?view=graph-rest-1.0
// Scope DeviceManagementManagedDevices.Read.All (beim Login angefragt).

/** deviceEnrollmentFailureReason – vollständig laut Enum-Seite (Werte 0–11). */
export const DEVICE_ENROLLMENT_FAILURE_REASONS = [
  'unknown',
  'authentication',
  'authorization',
  'accountValidation',
  'userValidation',
  'deviceNotSupported',
  'inMaintenance',
  'badRequest',
  'featureNotSupported',
  'enrollmentRestrictionsEnforced',
  'clientDisconnected',
  'userAbandonment',
] as const;
export type DeviceEnrollmentFailureReason = (typeof DEVICE_ENROLLMENT_FAILURE_REASONS)[number];

/**
 * deviceEnrollmentType, wie ihn die Ressource enrollmentTroubleshootingEvent aufzählt (10 Werte – weniger
 * als bei managedDevice).
 */
export const TROUBLESHOOTING_ENROLLMENT_TYPES = [
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
] as const;
export type TroubleshootingEnrollmentType = (typeof TROUBLESHOOTING_ENROLLMENT_TYPES)[number];

/**
 * Eintrag aus `/deviceManagement/troubleshootingEvents`. Die Liste ist laut Doku eine Sammlung von
 * deviceManagementTroubleshootingEvent (Basistyp: nur id, eventDateTime, correlationId); Registrierungs-
 * fehler kommen als abgeleiteter Typ enrollmentTroubleshootingEvent. Nicht gelesen:
 * `managedDeviceIdentifier`, `deviceId`.
 */
export interface GraphTroubleshootingEvent {
  '@odata.type'?: string;
  id: string;
  eventDateTime?: string | null;
  correlationId?: string | null;
  operatingSystem?: string | null;
  osVersion?: string | null;
  userId?: string | null;
  enrollmentType?: string | null;
  failureCategory?: string | null;
  failureReason?: string | null;
}

// ---------- Compliance-/Konfigurations-Übersicht des Mandanten (v1.0) – M20/S1 ----------
// https://learn.microsoft.com/en-us/graph/api/resources/intune-deviceconfig-devicecompliancepolicydevicestatesummary?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/intune-deviceconfig-deviceconfigurationdevicestatesummary?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/intune-deviceconfig-devicecompliancepolicysettingstatesummary?view=graph-rest-1.0
// Scope DeviceManagementConfiguration.Read.All (beim Login angefragt).

/** Zähler von deviceCompliancePolicyDeviceStateSummary – exakt die dokumentierten Int32-Felder. */
export const COMPLIANCE_SUMMARY_FIELDS = [
  'compliantDeviceCount',
  'nonCompliantDeviceCount',
  'inGracePeriodCount',
  'errorDeviceCount',
  'conflictDeviceCount',
  'unknownDeviceCount',
  'notApplicableDeviceCount',
  'remediatedDeviceCount',
  'configManagerCount',
] as const;

/** Zähler von deviceConfigurationDeviceStateSummary (ohne Schonfrist und Configuration Manager). */
export const CONFIGURATION_SUMMARY_FIELDS = [
  'compliantDeviceCount',
  'nonCompliantDeviceCount',
  'errorDeviceCount',
  'conflictDeviceCount',
  'unknownDeviceCount',
  'notApplicableDeviceCount',
  'remediatedDeviceCount',
] as const;

export type DeviceStateCountField = (typeof COMPLIANCE_SUMMARY_FIELDS)[number];

/**
 * Antwort der beiden Summary-Endpunkte (ein Objekt). Die Beispielantwort der Doku verpackt das Objekt in
 * `value` – der Mapper akzeptiert beide Formen (live zu verifizieren, M20).
 */
export type GraphDeviceStateSummary = Partial<Record<DeviceStateCountField, number | null>> & {
  id?: string | null;
};

/** policyPlatformType laut Ressource deviceCompliancePolicySettingStateSummary (9 Werte). */
export const SETTING_SUMMARY_PLATFORM_TYPES = [
  'android',
  'iOS',
  'macOS',
  'windowsPhone81',
  'windows81AndLater',
  'windows10AndLater',
  'androidWorkProfile',
  'linux',
  'all',
] as const;
export type SettingSummaryPlatformType = (typeof SETTING_SUMMARY_PLATFORM_TYPES)[number];

/** deviceCompliancePolicySettingStateSummary – nur gelesene Felder (Beziehung deviceComplianceSettingStates nicht). */
export interface GraphComplianceSettingStateSummary {
  id: string;
  setting?: string | null;
  settingName?: string | null;
  platformType?: string | null;
  compliantDeviceCount?: number | null;
  nonCompliantDeviceCount?: number | null;
  errorDeviceCount?: number | null;
  conflictDeviceCount?: number | null;
  unknownDeviceCount?: number | null;
  notApplicableDeviceCount?: number | null;
  remediatedDeviceCount?: number | null;
}

// ---------- Änderungsprotokoll (Intune-Überwachung, v1.0) – M20/S2 ----------
// https://learn.microsoft.com/en-us/graph/api/intune-auditing-auditevent-list?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/intune-auditing-auditevent?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/intune-auditing-auditactor?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/resources/intune-auditing-auditresource?view=graph-rest-1.0
// Scope DeviceManagementApps.Read.All (optional – nicht beim Login).

/**
 * auditActor – NUR die Felder, die die App liest. Bewusst nie gelesen (Datensparsamkeit): `ipAddress`,
 * `userPermissions`, `userId`, `applicationId`, `servicePrincipalName`. Graph liefert sie mit; der Mapper
 * übernimmt sie nicht, sie verlassen den Mapper nie.
 */
export interface GraphAuditActor {
  type?: string | null;
  auditActorType?: string | null;
  userPrincipalName?: string | null;
  applicationDisplayName?: string | null;
}

/** auditResource – ohne `modifiedProperties` (alte/neue Werte werden nicht gelesen). */
export interface GraphAuditResource {
  displayName?: string | null;
  type?: string | null;
  auditResourceType?: string | null;
  resourceId?: string | null;
}

/** auditEvent – nur gelesene Felder. Alle Texte sind freie Zeichenketten (keine Enums dokumentiert). */
export interface GraphAuditEvent {
  id: string;
  displayName?: string | null;
  componentName?: string | null;
  actor?: GraphAuditActor | null;
  activity?: string | null;
  activityDateTime?: string | null;
  activityType?: string | null;
  activityOperationType?: string | null;
  activityResult?: string | null;
  correlationId?: string | null;
  resources?: GraphAuditResource[] | null;
  category?: string | null;
}

// ---------- App-Schutz (M20/S3) ----------

/** managedAppFlaggedReason (v1.0): dokumentierte Werte. Andere Werte bleiben Rohwerte. */
export const MANAGED_APP_FLAGGED_REASONS = ['none', 'rootedDevice'] as const;

/**
 * mobileAppIdentifier (v1.0): `iosMobileAppIdentifier.bundleId` bzw. `androidMobileAppIdentifier.packageId`.
 * https://learn.microsoft.com/graph/api/resources/intune-mam-mobileappidentifier?view=graph-rest-1.0
 */
export interface GraphMobileAppIdentifier {
  '@odata.type'?: string | null;
  bundleId?: string | null;
  packageId?: string | null;
}

/**
 * managedAppRegistration (v1.0) – nur gelesene Felder. `deviceTag` und `version` werden nicht gelesen;
 * `managedDeviceId`/`azureADDeviceId` gibt es nur in beta (nicht verwendet).
 * https://learn.microsoft.com/graph/api/resources/intune-mam-managedappregistration?view=graph-rest-1.0
 */
export interface GraphManagedAppRegistration {
  id: string;
  createdDateTime?: string | null;
  lastSyncDateTime?: string | null;
  applicationVersion?: string | null;
  managementSdkVersion?: string | null;
  platformVersion?: string | null;
  deviceType?: string | null;
  deviceName?: string | null;
  flaggedReasons?: string[] | null;
  userId?: string | null;
  appIdentifier?: GraphMobileAppIdentifier | null;
}
