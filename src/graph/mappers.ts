/**
 * Graph-DTO → Domain-Modell. Null-sicher: Graph liefert fehlende Werte oft als null oder lässt
 * Felder weg. Unbekannte Enum-Werte werden – wo der Domain-Typ es zulässt – zu 'unknown'.
 */
import type {
  AppliedPolicyInfo,
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
  SignInEntry,
  SignInsInfo,
  WindowsProtectionInfo,
} from '../domain/types';
import { osFamilyFrom } from '../domain/format';
import type {
  AppliedConditionalAccessPolicyResult,
  ComplianceState,
  ComplianceStatus,
  ConditionalAccessStatus,
  DeviceEnrollmentType,
  GraphAppliedConditionalAccessPolicy,
  GraphApplePushNotificationCertificate,
  GraphBitlockerRecoveryKey,
  GraphDevicePolicyState,
  GraphEntraDevice,
  GraphManagedDevice,
  GraphMobileApp,
  GraphMobileAppIntentAndState,
  MobileAppIntent,
  ResultantAppState,
  GraphPolicySettingState,
  GraphSignIn,
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
