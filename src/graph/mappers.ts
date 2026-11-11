/**
 * Graph-DTO → Domain-Modell. Null-sicher: Graph liefert fehlende Werte oft als null oder lässt
 * Felder weg. Unbekannte Enum-Werte werden – wo der Domain-Typ es zulässt – zu 'unknown'.
 */
import type {
  AppliedPolicyInfo,
  EnrollmentLimitInfo,
  IntuneLicensePlanInfo,
  IntunePlanName,
  UserLicenseInfo,
  AssignmentEntry,
  AssignmentTarget,
  AutopilotInfo,
  DeviceGroupsInfo,
  DuplicateDevicesInfo,
  HealthAttestationInfo,
  LocalAdminInfo,
  ApplePushCertificateInfo,
  AppInfo,
  AppInstallStateInfo,
  BitLockerKeyInfo,
  BitLockerVolumeType,
  DataSource,
  DetectedMalware,
  DeviceSearchResult,
  EntraDeviceInfo,
  ManagedDeviceInfo,
  PolicyStateInfo,
  SecurityAlertEntry,
  SecurityAlertsInfo,
  SignInEntry,
  SignInsInfo,
  VppTokenInfo,
  WindowsProtectionInfo,
  OsFamily,
  PolicyDeviceOverview,
  PolicyDeviceStatusEntry,
  TenantPolicyInfo,
  TenantPolicyKind,
  EnrollmentFailureEvent,
  EnrollmentFailuresInfo,
  ServiceHealthEntry,
  ServiceHealthInfo,
  ServiceHealthIssueInfo,
  ServiceHealthKind,
} from '../domain/types';
import { osFamilyFrom } from '../domain/format';
import type {
  AppliedConditionalAccessPolicyResult,
  AutopilotEnrollmentState,
  ComplianceState,
  ComplianceStatus,
  ConditionalAccessStatus,
  DeviceEnrollmentType,
  GraphAppliedConditionalAccessPolicy,
  GraphAssignment,
  GraphDeviceEnrollmentConfiguration,
  GraphLicenseDetails,
  ServicePlanProvisioningStatus,
  GraphApplePushNotificationCertificate,
  GraphDirectoryObject,
  GraphManagedDeviceHealthAttestation,
  GraphWindowsAutopilotDeviceIdentity,
  GraphBitlockerRecoveryKey,
  GraphDeviceLocalCredentialInfo,
  GraphDevicePolicyState,
  GraphEntraDevice,
  GraphManagedDevice,
  GraphMobileApp,
  GraphMobileAppIntentAndState,
  MobileAppAssignmentIntent,
  MobileAppIntent,
  ResultantAppState,
  GraphPolicySettingState,
  GraphSecurityAlert,
  GraphSecurityDeviceEvidence,
  GraphSignIn,
  GraphVppToken,
  GraphPolicyDeviceOverview,
  GraphPolicyDeviceStatus,
  GraphTenantPolicy,
  GraphWindowsDeviceMalwareState,
  GraphWindowsProtectionState,
  ManagedDevicePartnerReportedHealthState,
  ManagementAgentType,
  PolicyPlatformType,
  WindowsDeviceHealthState,
  WindowsMalwareSeverity,
  WindowsMalwareState,
  WindowsMalwareThreatState,
  GraphServiceHealth,
  GraphServiceHealthIssue,
  GraphTroubleshootingEvent,
} from './dto';
import {
  DEVICE_ENROLLMENT_FAILURE_REASONS,
  SERVICE_HEALTH_CLASSIFICATIONS,
  SERVICE_HEALTH_STATUSES,
  TROUBLESHOOTING_ENROLLMENT_TYPES,
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

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

/** Datumswerte; Graph meldet "nicht gesetzt" teils als 0001-01-01 → null. */
function validDate(value: unknown): string | null {
  const text = str(value);
  if (!text) return null;
  const time = Date.parse(text);
  return Number.isNaN(time) || new Date(time).getUTCFullYear() < 2000 ? null : text;
}

/** Leere Strings und die Null-GUID (Geräte ohne Benutzer) → null. */
function usableId(value: unknown): string | null {
  const id = typeof value === 'string' ? value.trim() : '';
  return id && id !== EMPTY_GUID ? id : null;
}

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
    userId: usableId(dto.userId),
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
    managementCertificateExpirationDate: validDate(dto.managementCertificateExpirationDate),
    isSupervised: bool(dto.isSupervised),
    androidSecurityPatchLevel: str(dto.androidSecurityPatchLevel)?.trim() || null,
    enrollmentProfileName: str(dto.enrollmentProfileName)?.trim() || null,
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
    serialNumber: str(dto.serialNumber)?.trim() || null,
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

// ---------- Gleichnamige Entra-Objekte (M14/S1) ----------

/**
 * Gleichnamige Objekte aus `GET /devices?$filter=displayName eq '…'`. `isCurrent` = deviceId ==
 * azureADDeviceId des Intune-Geräts (Groß-/Kleinschreibung egal). `differentOs` nur, wenn beide
 * Betriebssystem-Familien bekannt sind und sich unterscheiden. Neueste Registrierung zuerst; das
 * aktuelle Objekt steht vorn. physicalIds/deviceMetadata werden nie gelesen.
 */
export function mapDuplicateDevices(
  entries: GraphEntraDevice[],
  device: { azureADDeviceId: string | null; osFamily: ManagedDeviceInfo['osFamily'] },
  moreAvailable: boolean,
): DuplicateDevicesInfo {
  const current = usableId(device.azureADDeviceId)?.toLowerCase() ?? null;
  const devices = entries
    .filter((entry) => entry && typeof entry.id === 'string')
    .map((entry) => {
      const deviceId = str(entry.deviceId);
      const family = osFamilyFrom(str(entry.operatingSystem));
      return {
        objectId: entry.id,
        deviceId,
        trustType: pickOrNull(entry.trustType, TRUST_TYPES),
        accountEnabled: bool(entry.accountEnabled),
        approximateLastSignInDateTime: validDate(entry.approximateLastSignInDateTime),
        isCompliant: bool(entry.isCompliant),
        isManaged: bool(entry.isManaged),
        registrationDateTime: validDate(entry.registrationDateTime),
        operatingSystem: str(entry.operatingSystem),
        isCurrent: current !== null && deviceId?.toLowerCase() === current,
        differentOs:
          family !== 'other' && device.osFamily !== 'other' && family !== device.osFamily,
      };
    })
    .sort(
      (a, b) =>
        Number(b.isCurrent) - Number(a.isCurrent) ||
        (Date.parse(b.registrationDateTime ?? '') || 0) -
          (Date.parse(a.registrationDateTime ?? '') || 0),
    );
  return { devices, moreAvailable };
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

/** mobileApp → AppInfo; ohne Anzeigenamen gibt es nichts aufzulösen (null). */
export function mapMobileApp(dto: GraphMobileApp): AppInfo | null {
  const displayName = dto.displayName?.trim();
  if (!dto.id || !displayName) return null;
  return { id: dto.id, displayName, publisher: dto.publisher?.trim() || null };
}

// ---------- App-Installationsstatus (beta) ----------

const APP_INTENTS: readonly MobileAppIntent[] = [
  'available',
  'notAvailable',
  'requiredInstall',
  'requiredUninstall',
  'requiredAndAvailableInstall',
  'availableInstallWithoutEnrollment',
  'exclude',
];

const APP_STATES: readonly ResultantAppState[] = [
  'installed',
  'failed',
  'notInstalled',
  'uninstallFailed',
  'pendingInstall',
  'unknown',
  'notApplicable',
];

/**
 * mobileAppIntentAndStates liefert Einträge für alle Geräte eines Benutzers; übernommen werden nur
 * die Apps des Geräts, dessen managedDeviceIdentifier zur Intune- oder Entra-Geräte-ID passt
 * (doppelte App-IDs einmal). `matched` = mindestens ein Eintrag gehörte zu diesem Gerät.
 */
export function mapAppInstallStates(
  entries: GraphMobileAppIntentAndState[],
  deviceIds: Array<string | null>,
): { apps: AppInstallStateInfo[]; matched: boolean } {
  const wanted = new Set(
    deviceIds.filter((id): id is string => Boolean(id)).map((id) => id.toLowerCase()),
  );
  const apps = new Map<string, AppInstallStateInfo>();
  let matched = false;
  for (const entry of entries) {
    const id = str(entry.managedDeviceIdentifier)?.toLowerCase();
    if (!id || !wanted.has(id)) continue;
    matched = true;
    for (const detail of Array.isArray(entry.mobileAppList) ? entry.mobileAppList : []) {
      const appId = str(detail?.applicationId);
      if (!appId || apps.has(appId.toLowerCase())) continue;
      apps.set(appId.toLowerCase(), {
        appId,
        displayName: str(detail.displayName)?.trim() || appId,
        version: str(detail.displayVersion),
        intent: pickOrNull(detail.mobileAppIntent, APP_INTENTS),
        installState: pick(detail.installState, APP_STATES, 'unknown'),
      });
    }
  }
  return { apps: [...apps.values()], matched };
}

// ---------- Apple-MDM-Push-Zertifikat (Tenant) ----------

/**
 * Akzeptiert das Objekt direkt (echte Graph-Antwort) oder – wie im Doku-Beispiel – unter `value`.
 * Nur Zeitstempel werden übernommen; ungültige Werte und Jahre < 2000 werden zu null.
 */
export function mapApplePushCertificate(
  dto:
    | Partial<GraphApplePushNotificationCertificate>
    | { value?: Partial<GraphApplePushNotificationCertificate> | null }
    | null
    | undefined,
): ApplePushCertificateInfo {
  const raw = dto && typeof dto === 'object' && 'value' in dto && dto.value ? dto.value : dto;
  const cert = (
    raw && typeof raw === 'object' ? raw : {}
  ) as Partial<GraphApplePushNotificationCertificate>;
  return {
    expirationDateTime: validDate(cert.expirationDateTime),
    lastModifiedDateTime: validDate(cert.lastModifiedDateTime),
  };
}

// ---------- Anmeldeprotokoll ----------

const CA_STATUSES: readonly ConditionalAccessStatus[] = [
  'success',
  'failure',
  'notApplied',
  'unknownFutureValue',
];

const CA_POLICY_RESULTS: readonly AppliedConditionalAccessPolicyResult[] = [
  'success',
  'failure',
  'notApplied',
  'notEnabled',
  'unknown',
  'unknownFutureValue',
];

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

function mapAppliedPolicy(dto: GraphAppliedConditionalAccessPolicy): AppliedPolicyInfo {
  return {
    id: str(dto?.id),
    displayName: str(dto?.displayName),
    result: pickOrNull(dto?.result, CA_POLICY_RESULTS),
    enforcedGrantControls: strings(dto?.enforcedGrantControls),
    enforcedSessionControls: strings(dto?.enforcedSessionControls),
  };
}

function mapSignInEntry(dto: GraphSignIn): SignInEntry {
  return {
    id: dto.id,
    createdDateTime: validDate(dto.createdDateTime),
    appDisplayName: str(dto.appDisplayName),
    resourceDisplayName: str(dto.resourceDisplayName),
    clientAppUsed: str(dto.clientAppUsed),
    isInteractive: bool(dto.isInteractive),
    correlationId: str(dto.correlationId),
    conditionalAccessStatus: pickOrNull(dto.conditionalAccessStatus, CA_STATUSES),
    errorCode: num(dto.status?.errorCode),
    failureReason: str(dto.status?.failureReason),
    additionalDetails: str(dto.status?.additionalDetails),
    deviceIsCompliant: bool(dto.deviceDetail?.isCompliant),
    deviceIsManaged: bool(dto.deviceDetail?.isManaged),
    // Fehlt das Feld, darf das Konto Conditional-Access-Daten nicht lesen (kein 403!).
    appliedPolicies: Array.isArray(dto.appliedConditionalAccessPolicies)
      ? dto.appliedConditionalAccessPolicies.map(mapAppliedPolicy)
      : null,
  };
}

/**
 * Die Abfrage filtert nur auf Benutzer und Zeitraum (deviceDetail/deviceId ist laut Doku nicht
 * filterbar) – hier wird clientseitig auf die Entra-Geräte-ID des Geräts eingegrenzt (ohne
 * Beachtung der Groß-/Kleinschreibung), neueste zuerst. IP-Adresse, Standort und Risikoangaben
 * der Antwort werden nie übernommen.
 */
export function mapSignIns(
  entries: GraphSignIn[],
  azureAdDeviceId: string,
  meta: { windowDays: number; moreAvailable: boolean },
): SignInsInfo {
  const wanted = azureAdDeviceId.trim().toLowerCase();
  const forDevice = entries
    .filter((entry) => str(entry?.deviceDetail?.deviceId)?.trim().toLowerCase() === wanted)
    .map(mapSignInEntry)
    .sort((a, b) => Date.parse(b.createdDateTime ?? '') - Date.parse(a.createdDateTime ?? '') || 0);
  return {
    windowDays: meta.windowDays,
    totalForUser: entries.length,
    moreAvailable: meta.moreAvailable,
    entries: forDevice,
  };
}

// ---------- Windows LAPS ----------

/**
 * Nur Metadaten. Die Antwort kann laut Doku-Beispiel direkt oder unter `value` liegen – beide Formen
 * werden akzeptiert. Eine Eigenschaft `credentials` wird nie gelesen oder weitergereicht.
 */
export function mapLocalAdmin(
  dto:
    | Partial<GraphDeviceLocalCredentialInfo>
    | { value?: Partial<GraphDeviceLocalCredentialInfo> | null }
    | null
    | undefined,
): LocalAdminInfo {
  const raw = dto && typeof dto === 'object' && 'value' in dto && dto.value ? dto.value : dto;
  const info = (
    raw && typeof raw === 'object' ? raw : {}
  ) as Partial<GraphDeviceLocalCredentialInfo>;
  return {
    deviceName: str(info.deviceName),
    lastBackupDateTime: validDate(info.lastBackupDateTime),
    refreshDateTime: validDate(info.refreshDateTime),
  };
}

// ---------- Windows Autopilot ----------

const AUTOPILOT_STATES: readonly AutopilotEnrollmentState[] = [
  'unknown',
  'enrolled',
  'pendingReset',
  'failed',
  'notContacted',
];

/**
 * Sucht das Gerät in einer Seite der Autopilot-Liste: zuerst über managedDeviceId (= Intune-Geräte-ID),
 * sonst über die Seriennummer (ohne Beachtung der Groß-/Kleinschreibung). Kein Treffer → null.
 * Seriennummer, Benutzer und Produktschlüssel werden nie übernommen.
 */
export function mapAutopilot(
  entries: GraphWindowsAutopilotDeviceIdentity[],
  device: { id: string; serialNumber: string | null },
): AutopilotInfo | null {
  const id = device.id.trim().toLowerCase();
  const serial = device.serialNumber?.trim().toLowerCase() || null;
  const byManaged = entries.find((e) => usableId(e?.managedDeviceId)?.toLowerCase() === id);
  const bySerial =
    serial === null
      ? undefined
      : entries.find((e) => str(e?.serialNumber)?.trim().toLowerCase() === serial);
  const hit = byManaged ?? bySerial;
  if (!hit) return null;
  return {
    groupTag: str(hit.groupTag)?.trim() || null,
    enrollmentState: pickOrNull(hit.enrollmentState, AUTOPILOT_STATES),
    lastContactedDateTime: validDate(hit.lastContactedDateTime),
    manufacturer: str(hit.manufacturer),
    model: str(hit.model),
    matchedBy: byManaged ? 'managedDeviceId' : 'serialNumber',
  };
}

// ---------- Gruppen des Geräts ----------

/**
 * Nur `#microsoft.graph.group` wird angezeigt (Name + ID). Gruppen ohne Namen – so kommen Objekte ohne
 * Leserecht laut Doku zurück – zählen als „ausgeblendet“. Andere Typen (z. B. Verwaltungseinheiten)
 * werden ignoriert. Sortiert nach Name.
 */
export function mapDeviceGroups(
  objects: GraphDirectoryObject[],
  truncated: boolean,
): DeviceGroupsInfo {
  const groups: DeviceGroupsInfo['groups'] = [];
  let hiddenCount = 0;
  for (const object of objects) {
    if (object?.['@odata.type'] !== '#microsoft.graph.group') continue;
    const id = str(object.id)?.trim();
    const name = str(object.displayName)?.trim();
    if (id && name) groups.push({ id, displayName: name });
    else hiddenCount += 1;
  }
  groups.sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));
  return { groups, hiddenCount, truncated };
}

// ---------- Weitere Geräte des Benutzers ----------

/** Geräte des Benutzers ohne das aktuelle Gerät, alphabetisch; nur Name, Plattform, Compliance. */
export function mapUserDevices(
  entries: Array<Partial<GraphManagedDevice> & { id: string }>,
  currentDeviceId: string,
): DeviceSearchResult[] {
  const current = currentDeviceId.trim().toLowerCase();
  return entries
    .filter((entry) => typeof entry?.id === 'string' && entry.id.toLowerCase() !== current)
    .map(mapSearchResult)
    .sort((a, b) => a.deviceName.localeCompare(b.deviceName, 'de'));
}

// ---------- Integritätsnachweis ----------

const text = (value: unknown): string | null => {
  const v = typeof value === 'string' ? value.trim() : '';
  return v ? v : null;
};

/** Übernimmt die dokumentierten String-Rohwerte unverändert (leer → null); virtualSecureMode u. a. nie. */
export function mapHealthAttestation(
  dto: GraphManagedDeviceHealthAttestation | null | undefined,
): HealthAttestationInfo {
  const state = dto?.deviceHealthAttestationState ?? {};
  return {
    lastUpdateDateTime: text(state.lastUpdateDateTime),
    issuedDateTime: text(state.issuedDateTime),
    secureBoot: text(state.secureBoot),
    bitLockerStatus: text(state.bitLockerStatus),
    codeIntegrity: text(state.codeIntegrity),
    earlyLaunchAntiMalwareDriverProtection: text(state.earlyLaunchAntiMalwareDriverProtection),
    bootDebugging: text(state.bootDebugging),
    testSigning: text(state.testSigning),
    tpmVersion: text(state.tpmVersion),
    healthStatusMismatchInfo: text(state.healthStatusMismatchInfo),
    healthAttestationSupportedStatus: text(state.healthAttestationSupportedStatus),
  };
}

// ---------- Zuweisungen (M14/S2) ----------

const GUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

/** Nur echte GUIDs werden als Richtlinien-/App-ID abgefragt (kein Request mit zusammengesetzten IDs). */
export function isGuid(value: string): boolean {
  return GUID_PATTERN.test(value.trim());
}

const ASSIGNMENT_INTENTS: readonly MobileAppAssignmentIntent[] = [
  'available',
  'required',
  'uninstall',
  'availableWithoutEnrollment',
];

/**
 * Ziel einer Zuweisung. Das `@odata.type` steht in der Praxis mit führendem `#`, in den Doku-Beispielen
 * teils ohne → beides wird akzeptiert. Alles andere (z. B. scopeTagGroupAssignmentTarget) bleibt
 * `unknown` und wird nicht gedeutet. Gruppenziele ohne groupId ebenfalls.
 */
export function mapAssignmentTarget(target: GraphAssignment['target']): AssignmentTarget {
  const rawType = str(target?.['@odata.type']);
  const odataType = rawType ? rawType.replace(/^#/, '') : null;
  const groupId = str(target?.groupId)?.trim() || null;
  switch (odataType) {
    case 'microsoft.graph.groupAssignmentTarget':
      return groupId ? { kind: 'group', groupId } : { kind: 'unknown', odataType };
    case 'microsoft.graph.exclusionGroupAssignmentTarget':
      return groupId ? { kind: 'exclusionGroup', groupId } : { kind: 'unknown', odataType };
    case 'microsoft.graph.allDevicesAssignmentTarget':
      return { kind: 'allDevices' };
    case 'microsoft.graph.allLicensedUsersAssignmentTarget':
      return { kind: 'allUsers' };
    default:
      return { kind: 'unknown', odataType };
  }
}

/** Zuweisungsliste eines Objekts. Einträge ohne `target` zählen als unbekanntes Ziel. */
export function mapAssignments(entries: GraphAssignment[] | null | undefined): AssignmentEntry[] {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      target: mapAssignmentTarget(entry.target),
      intent: pickOrNull(entry.intent, ASSIGNMENT_INTENTS),
    }));
}

// ---------- Lizenz des Benutzers (M14/S3) ----------

/**
 * Intune-Serviceplans nach servicePlanId (Quelle: Licensing service plan reference,
 * https://learn.microsoft.com/entra/identity/users/licensing-service-plan-reference). INTUNE_O365 ist
 * „Mobile Device Management for Office 365“ – kein Intune-Plan im engeren Sinn.
 */
export const INTUNE_PLAN_IDS: Record<string, IntunePlanName> = {
  'c1ec4a95-1f05-45b3-a911-aa3fa01094f5': 'INTUNE_A',
  '3e170737-c728-4eae-bbb9-3f3360f7184c': 'INTUNE_A_VL',
  'da24caf9-af8e-485c-b7c8-e73336da2693': 'INTUNE_EDU',
  '882e1d05-acd1-4ccb-8708-6ee03664b117': 'INTUNE_O365',
};

const PLAN_STATUSES: readonly ServicePlanProvisioningStatus[] = [
  'Success',
  'Disabled',
  'Error',
  'PendingInput',
  'PendingActivation',
  'PendingProvisioning',
];

/** Reduziert die Lizenzdetails auf die Intune-Serviceplans; alles andere wird verworfen. */
export function mapUserLicense(entries: GraphLicenseDetails[] | null | undefined): UserLicenseInfo {
  const licenses = (Array.isArray(entries) ? entries : []).filter(
    (entry) => entry && typeof entry === 'object',
  );
  const plans: IntuneLicensePlanInfo[] = [];
  for (const license of licenses) {
    for (const servicePlan of Array.isArray(license.servicePlans) ? license.servicePlans : []) {
      const plan = INTUNE_PLAN_IDS[(str(servicePlan?.servicePlanId) ?? '').toLowerCase()];
      if (!plan) continue;
      plans.push({
        plan,
        skuPartNumber: str(license.skuPartNumber),
        provisioningStatus: pickOrNull(servicePlan.provisioningStatus, PLAN_STATUSES),
      });
    }
  }
  return { plans, licenseCount: licenses.length };
}

// ---------- Gerätelimit (M14/S3) ----------

/**
 * Gerätelimit-Konfigurationen aus der gemischten Liste der Registrierungskonfigurationen (Erkennung am
 * `@odata.type`, mit oder ohne `#`). `assignments` je Konfigurations-ID; fehlt ein Eintrag, sind die
 * Ziele nicht lesbar (null). Sortiert nach Priorität (niedrigster Wert zuerst).
 */
export function mapEnrollmentLimits(
  configs: GraphDeviceEnrollmentConfiguration[] | null | undefined,
  assignments: ReadonlyMap<string, GraphAssignment[]>,
): EnrollmentLimitInfo[] {
  return (Array.isArray(configs) ? configs : [])
    .filter(
      (config) =>
        config &&
        typeof config.id === 'string' &&
        str(config['@odata.type'])?.replace(/^#/, '') ===
          'microsoft.graph.deviceEnrollmentLimitConfiguration',
    )
    .map((config) => {
      const entries = assignments.get(config.id);
      return {
        id: config.id,
        displayName: str(config.displayName)?.trim() || config.id,
        priority: num(config.priority),
        limit: num(config.limit),
        targets: entries ? mapAssignments(entries).map((entry) => entry.target) : null,
      };
    })
    .sort(
      (a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER),
    );
}

/** Ob eine Konfiguration ein Gerätelimit ist (für den Provider: nur dafür Zuweisungen lesen). */
export function isEnrollmentLimitConfig(config: GraphDeviceEnrollmentConfiguration): boolean {
  return (
    str(config?.['@odata.type'])?.replace(/^#/, '') ===
    'microsoft.graph.deviceEnrollmentLimitConfiguration'
  );
}

// ---------- Sicherheitswarnungen (M14/S4) ----------

const DEVICE_EVIDENCE_TYPE = 'microsoft.graph.security.deviceEvidence';
const ALERT_SEVERITIES = ['high', 'medium', 'low', 'informational'] as const;
const ALERT_STATUSES = ['new', 'inProgress', 'resolved'] as const;
/** deviceRiskScore (deviceEvidence) */
const DEVICE_RISK_SCORES = ['none', 'informational', 'low', 'medium', 'high'] as const;
/** defenderAvStatus (deviceEvidence) */
const DEFENDER_AV_STATUSES = [
  'notReporting',
  'disabled',
  'notUpdated',
  'updated',
  'unknown',
  'notSupported',
] as const;
const PORTAL_HOST = /(^|\.)microsoft\.(com|us)$/i;

/** Link ins Defender-Portal: nur https auf Microsoft-Domains, sonst kein Link. */
export function safeAlertWebUrl(value: unknown): string | null {
  const text = str(value)?.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && PORTAL_HOST.test(url.hostname) ? text : null;
  } catch {
    return null;
  }
}

/** Gerätename für den Vergleich: kleingeschrieben, ohne Domänensuffix (Name vor dem ersten Punkt). */
const shortDeviceName = (value: unknown): string | null => {
  const name = str(value)?.trim().toLowerCase().split('.')[0];
  return name ? name : null;
};

/**
 * Gehört diese Geräte-Evidenz zum Gerät? Mit Entra-Geräte-ID auf beiden Seiten entscheidet nur die ID
 * (ein gleichnamiges anderes Gerät passt nicht). Fehlt die ID auf einer Seite, gilt der Gerätename
 * (hostName bzw. deviceDnsName vor dem ersten Punkt, ohne Beachtung der Groß-/Kleinschreibung).
 */
function matchDeviceEvidence(
  evidence: GraphSecurityDeviceEvidence,
  device: { azureAdDeviceId: string | null; deviceName: string },
): 'azureAdDeviceId' | 'deviceName' | null {
  const evidenceId = str(evidence.azureAdDeviceId)?.trim().toLowerCase();
  const wantedId = device.azureAdDeviceId?.trim().toLowerCase();
  if (evidenceId && evidenceId !== EMPTY_GUID && wantedId && wantedId !== EMPTY_GUID) {
    return evidenceId === wantedId ? 'azureAdDeviceId' : null;
  }
  const wantedName = shortDeviceName(device.deviceName);
  if (!wantedName) return null;
  const names = [shortDeviceName(evidence.hostName), shortDeviceName(evidence.deviceDnsName)];
  return names.includes(wantedName) ? 'deviceName' : null;
}

/**
 * Warnungen → die offenen Warnungen dieses Geräts. Whitelist: übernommen werden nur Titel, Schweregrad,
 * Status, Zeiten, Kategorien, Portal-Link sowie Risikostufe/AV-Status der Geräte-Evidenz. Nie übernommen
 * werden loggedOnUsers, ipInterfaces, assignedTo, Kommentare und Benutzer-/Datei-/Prozess-Evidenz.
 * Behobene Warnungen (status = resolved) werden nur gezählt. Doppelte IDs (Seitenüberlappung) zählen einmal.
 */
export function mapSecurityAlerts(
  entries: GraphSecurityAlert[] | null | undefined,
  device: { azureAdDeviceId: string | null; deviceName: string },
  meta: { moreAvailable: boolean },
): SecurityAlertsInfo {
  const list = (Array.isArray(entries) ? entries : []).filter(
    (entry) => entry && typeof entry === 'object',
  );
  const seen = new Set<string>();
  const alerts: SecurityAlertEntry[] = [];
  let resolvedCount = 0;
  for (const alert of list) {
    const id = str(alert.id);
    if (!id || seen.has(id)) continue;
    const evidence = (Array.isArray(alert.evidence) ? alert.evidence : []).filter(
      (item) => str(item?.['@odata.type'])?.replace(/^#/, '') === DEVICE_EVIDENCE_TYPE,
    );
    let matchedBy: 'azureAdDeviceId' | 'deviceName' | null = null;
    let matched: GraphSecurityDeviceEvidence | null = null;
    for (const item of evidence) {
      const result = matchDeviceEvidence(item, device);
      if (result) {
        matchedBy = result;
        matched = item;
        break;
      }
    }
    if (!matched || !matchedBy) continue;
    seen.add(id);
    const status = pickOrNull(alert.status, ALERT_STATUSES) ?? 'unknown';
    if (status === 'resolved') {
      resolvedCount += 1;
      continue;
    }
    alerts.push({
      id,
      title: str(alert.title)?.trim() || null,
      severity: pickOrNull(alert.severity, ALERT_SEVERITIES) ?? 'unknown',
      status,
      createdDateTime: validDate(alert.createdDateTime),
      lastUpdateDateTime: validDate(alert.lastUpdateDateTime),
      categories: strings(alert.categories),
      alertWebUrl: safeAlertWebUrl(alert.alertWebUrl),
      matchedBy,
      deviceRiskScore: pickOrNull(matched.riskScore, DEVICE_RISK_SCORES),
      defenderAvStatus: pickOrNull(matched.defenderAvStatus, DEFENDER_AV_STATUSES),
    });
  }
  alerts.sort(
    (a, b) => Date.parse(b.createdDateTime ?? '') - Date.parse(a.createdDateTime ?? '') || 0,
  );
  return { alerts, resolvedCount, evaluated: list.length, moreAvailable: meta.moreAvailable };
}

// ---------- Mandanten-Status: VPP-Tokens (M14/S5) ----------

const VPP_ACCOUNT_TYPES = ['business', 'education'] as const;
const VPP_STATES = ['unknown', 'valid', 'expired', 'invalid', 'assignedToExternalMDM'] as const;
const VPP_SYNC_STATUSES = ['none', 'inProgress', 'completed', 'failed'] as const;

/**
 * VPP-Tokens → Whitelist-Modell, frühester Ablauf zuerst. Die Antwort enthält `token` und `appleId`;
 * beides wird nie übernommen (jedes Feld wird einzeln gelesen, es gibt kein Durchreichen des Objekts).
 */
export function mapVppTokens(entries: GraphVppToken[] | null | undefined): VppTokenInfo[] {
  const mapped: VppTokenInfo[] = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const id = entry && typeof entry === 'object' ? str(entry.id) : null;
    if (!id) continue;
    mapped.push({
      id,
      organizationName: str(entry.organizationName)?.trim() || null,
      accountType: pickOrNull(entry.vppTokenAccountType, VPP_ACCOUNT_TYPES),
      expirationDateTime: validDate(entry.expirationDateTime),
      lastSyncDateTime: validDate(entry.lastSyncDateTime),
      state: pickOrNull(entry.state, VPP_STATES),
      lastSyncStatus: pickOrNull(entry.lastSyncStatus, VPP_SYNC_STATUSES),
      countryOrRegion: str(entry.countryOrRegion)?.trim() || null,
      lastAppCount: num(entry.lastAppCount),
    });
  }
  const time = (token: VppTokenInfo) =>
    token.expirationDateTime ? Date.parse(token.expirationDateTime) : Number.MAX_SAFE_INTEGER;
  return mapped.sort((a, b) => time(a) - time(b));
}

// ---------- Richtlinien → Geräte (M15) ----------

/**
 * Plattform aus dem abgeleiteten Typ einer Richtlinie. Der Basistyp hat kein Plattform-Feld; die
 * dokumentierten abgeleiteten Typen tragen die Plattform am Anfang des Namens (z. B.
 * windows10GeneralConfiguration, iosCompliancePolicy, macOSGeneralDeviceConfiguration,
 * androidWorkProfileCompliancePolicy, aospDeviceOwnerCompliancePolicy). Alles andere (auch
 * windowsPhone81…) → null, nichts wird geraten.
 */
export function policyPlatformFromODataType(odataType: unknown): OsFamily | null {
  const name = str(odataType)?.replace(/^#?microsoft\.graph\./, '') ?? '';
  if (!name) return null;
  if (name.startsWith('windowsPhone')) return null;
  if (name.startsWith('windows')) return 'windows';
  if (name.startsWith('ios')) return 'ios';
  if (name.startsWith('macOS')) return 'macos';
  if (name.startsWith('android') || name.startsWith('aosp')) return 'android';
  return null;
}

/** Richtlinien-Liste → Domain (ohne Zähler). Einträge ohne ID werden verworfen; description nie. */
export function mapTenantPolicies(
  entries: GraphTenantPolicy[] | null | undefined,
  kind: TenantPolicyKind,
): TenantPolicyInfo[] {
  const mapped: TenantPolicyInfo[] = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const id = entry && typeof entry === 'object' ? str(entry.id)?.trim() : null;
    if (!id) continue;
    mapped.push({
      id,
      kind,
      displayName: str(entry.displayName)?.trim() || id,
      platform: policyPlatformFromODataType(entry['@odata.type']),
      version: num(entry.version),
      lastModifiedDateTime: validDate(entry.lastModifiedDateTime),
      overview: null,
    });
  }
  return mapped;
}

const count = (value: unknown): number | null => {
  const n = num(value);
  return n !== null && n >= 0 ? Math.trunc(n) : null;
};

/** deviceStatusOverview → Zähler. Akzeptiert das Objekt direkt oder unter `value` (Doku-Beispiel). */
export function mapPolicyOverview(
  dto: GraphPolicyDeviceOverview | { value?: GraphPolicyDeviceOverview } | null | undefined,
): PolicyDeviceOverview {
  const raw: GraphPolicyDeviceOverview =
    dto && typeof dto === 'object' && 'value' in dto && dto.value && typeof dto.value === 'object'
      ? dto.value
      : ((dto as GraphPolicyDeviceOverview | null | undefined) ?? {});
  return {
    pendingCount: count(raw.pendingCount),
    notApplicableCount: count(raw.notApplicableCount),
    successCount: count(raw.successCount),
    errorCount: count(raw.errorCount),
    failedCount: count(raw.failedCount),
    lastUpdateDateTime: validDate(raw.lastUpdateDateTime),
    configurationVersion: num(raw.configurationVersion),
  };
}

/** deviceStatuses → Einträge (nur die Whitelist; unbekannter Status → unknown). */
export function mapPolicyDeviceStatuses(
  entries: GraphPolicyDeviceStatus[] | null | undefined,
): PolicyDeviceStatusEntry[] {
  const mapped: PolicyDeviceStatusEntry[] = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const id = entry && typeof entry === 'object' ? str(entry.id) : null;
    if (!id) continue;
    mapped.push({
      id,
      deviceDisplayName: str(entry.deviceDisplayName)?.trim() || null,
      userPrincipalName: str(entry.userPrincipalName)?.trim() || null,
      userName: str(entry.userName)?.trim() || null,
      deviceModel: str(entry.deviceModel)?.trim() || null,
      status: pick(entry.status, COMPLIANCE_STATUSES, 'unknown'),
      lastReportedDateTime: validDate(entry.lastReportedDateTime),
    });
  }
  return mapped;
}

// ---------- Dienststatus (M18) ----------

/**
 * Enum-Wert ohne Rücksicht auf die Schreibweise des ersten Buchstabens: Die Doku nennt die Werte
 * camelCase (`serviceOperational`, `incident`), ihre Beispielantworten aber PascalCase
 * („ServiceOperational“, „Incident“). Andere Werte → null (der Rohwert bleibt separat erhalten).
 */
export function pickEnumLoose<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const text = str(value)?.trim();
  if (!text) return null;
  const normalized = text.charAt(0).toLowerCase() + text.slice(1);
  return (allowed as readonly string[]).includes(normalized) ? (normalized as T) : null;
}

/**
 * Zuordnung eines Dienstes zu Intune bzw. Entra über den Namen/die ID. Microsoft dokumentiert keine
 * festen Namen („Use the list healthOverviews operation to get exact string names“) – deshalb nur ein
 * Teilstring-Vergleich, live zu verifizieren (docs/graph-api-reference.md › „Live zu verifizieren (M18)“).
 */
export function serviceHealthKind(service: string, id: string): ServiceHealthKind | null {
  const text = `${service} ${id}`.toLowerCase();
  if (text.includes('intune')) return 'intune';
  if (text.includes('entra')) return 'entra';
  return null;
}

function mapServiceHealthIssue(dto: GraphServiceHealthIssue): ServiceHealthIssueInfo | null {
  const id = dto && typeof dto === 'object' ? str(dto.id) : null;
  if (!id) return null;
  return {
    id,
    title: str(dto.title)?.trim() || null,
    classification: pickEnumLoose(dto.classification, SERVICE_HEALTH_CLASSIFICATIONS),
    status: pickEnumLoose(dto.status, SERVICE_HEALTH_STATUSES),
    statusRaw: str(dto.status)?.trim() || null,
    startDateTime: validDate(dto.startDateTime),
    lastModifiedDateTime: validDate(dto.lastModifiedDateTime),
    feature: str(dto.feature)?.trim() || null,
    featureGroup: str(dto.featureGroup)?.trim() || null,
    impactDescription: str(dto.impactDescription)?.trim() || null,
  };
}

const KIND_ORDER: Record<ServiceHealthKind, number> = { intune: 0, entra: 1 };

/** healthOverviews (mit `$expand=issues`) → Domain. Nur offene Einträge (isResolved ≠ true) bleiben erhalten. */
export function mapServiceHealth(
  entries: GraphServiceHealth[] | null | undefined,
  truncated: boolean,
): ServiceHealthInfo {
  const services: ServiceHealthEntry[] = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const id = entry && typeof entry === 'object' ? str(entry.id) : null;
    if (!id) continue;
    const service = str(entry.service)?.trim() || id;
    const issues = (Array.isArray(entry.issues) ? entry.issues : [])
      .filter((issue) => issue && typeof issue === 'object')
      .map((issue) => ({ issue, mapped: mapServiceHealthIssue(issue) }));
    const open = issues
      .filter(({ issue, mapped }) => mapped && issue.isResolved !== true)
      .map(({ mapped }) => mapped!);
    const time = (issue: ServiceHealthIssueInfo) =>
      Date.parse(issue.lastModifiedDateTime ?? issue.startDateTime ?? '') || 0;
    services.push({
      id,
      service,
      kind: serviceHealthKind(service, id),
      status: pickEnumLoose(entry.status, SERVICE_HEALTH_STATUSES),
      statusRaw: str(entry.status)?.trim() || null,
      openIssues: open.sort((a, b) => time(b) - time(a)),
      resolvedCount: issues.filter(({ issue }) => issue.isResolved === true).length,
    });
  }
  const rank = (entry: ServiceHealthEntry) => (entry.kind ? KIND_ORDER[entry.kind] : 2);
  services.sort((a, b) => rank(a) - rank(b) || a.service.localeCompare(b.service, 'de'));
  return { services, truncated };
}

// ---------- Registrierungsfehler (M18) ----------

const ENROLLMENT_EVENT_TYPE = '#microsoft.graph.enrollmentTroubleshootingEvent';

/**
 * Nur Registrierungsfehler: die Liste ist laut Doku eine Sammlung des Basistyps
 * deviceManagementTroubleshootingEvent (ohne Registrierungsfelder). Übernommen werden Einträge mit dem
 * abgeleiteten Typ enrollmentTroubleshootingEvent – oder ohne `@odata.type`, wenn sie die Felder des
 * abgeleiteten Typs tragen.
 */
function isEnrollmentEvent(dto: GraphTroubleshootingEvent): boolean {
  const type = str(dto['@odata.type']);
  if (type) return type === ENROLLMENT_EVENT_TYPE;
  return 'failureCategory' in dto || 'enrollmentType' in dto;
}

export function mapEnrollmentFailure(
  dto: GraphTroubleshootingEvent,
): EnrollmentFailureEvent | null {
  const id = dto && typeof dto === 'object' ? str(dto.id) : null;
  if (!id || !isEnrollmentEvent(dto)) return null;
  return {
    id,
    eventDateTime: validDate(dto.eventDateTime),
    correlationId: str(dto.correlationId)?.trim() || null,
    operatingSystem: str(dto.operatingSystem)?.trim() || null,
    osVersion: str(dto.osVersion)?.trim() || null,
    userId: usableId(dto.userId),
    enrollmentType: pickOrNull(dto.enrollmentType, TROUBLESHOOTING_ENROLLMENT_TYPES),
    enrollmentTypeRaw: str(dto.enrollmentType)?.trim() || null,
    failureCategory: pickOrNull(dto.failureCategory, DEVICE_ENROLLMENT_FAILURE_REASONS),
    failureCategoryRaw: str(dto.failureCategory)?.trim() || null,
    failureReason: str(dto.failureReason)?.trim() || null,
  };
}

/**
 * troubleshootingEvents → Registrierungsfehler, neueste zuerst (eine Sortierung ist nicht dokumentiert,
 * deshalb clientseitig). Mit `filterUserId` nur die Einträge dieses Benutzers (Vergleich ohne Groß-/
 * Kleinschreibung).
 */
export function mapEnrollmentFailures(
  entries: GraphTroubleshootingEvent[] | null | undefined,
  options: { pagesRead: number; truncated: boolean; filterUserId?: string | null },
): EnrollmentFailuresInfo {
  const filter = options.filterUserId?.toLowerCase() ?? null;
  const events = (Array.isArray(entries) ? entries : [])
    .map(mapEnrollmentFailure)
    .filter((event): event is EnrollmentFailureEvent => event !== null)
    .filter((event) => !filter || event.userId?.toLowerCase() === filter);
  const time = (event: EnrollmentFailureEvent) => Date.parse(event.eventDateTime ?? '') || 0;
  return {
    events: events.sort((a, b) => time(b) - time(a)),
    pagesRead: options.pagesRead,
    truncated: options.truncated,
    filteredUserId: options.filterUserId ?? null,
  };
}
