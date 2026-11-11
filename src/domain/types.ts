/**
 * Domain-Modell der App – unabhängig davon, ob Daten aus Mock, Graph oder einem DiagLogs-ZIP stammen.
 * Enum-Werte werden 1:1 aus den Graph-DTOs übernommen (offizielles Microsoft-Datenmodell).
 */
import type {
  AppliedConditionalAccessPolicyResult,
  AutopilotEnrollmentState,
  ComplianceState,
  ComplianceStatus,
  ConditionalAccessStatus,
  DeviceEnrollmentFailureReason,
  DeviceEnrollmentType,
  ManagedDevicePartnerReportedHealthState,
  ManagementAgentType,
  MobileAppAssignmentIntent,
  MobileAppIntent,
  PolicyPlatformType,
  ResultantAppState,
  ServiceHealthClassificationType,
  ServiceHealthStatus,
  ServicePlanProvisioningStatus,
  TroubleshootingEnrollmentType,
  WindowsDeviceHealthState,
  WindowsMalwareSeverity,
  WindowsMalwareState,
  WindowsMalwareThreatState,
} from '../graph/dto';
import type { DiagnosticsReport } from '../diagnostics/types';

export type DataMode = 'demo' | 'live';
export type Severity = 'ok' | 'warning' | 'critical' | 'unknown';
export type OsFamily = 'windows' | 'macos' | 'ios' | 'android' | 'linux' | 'other';

// ---------- Herkunft & Fehler ----------

/** Woher ein Wert/Befund stammt – wird in der Detailansicht als "Quelle" angezeigt. */
export interface DataSource {
  kind: 'graph' | 'mock' | 'zip';
  /** z. B. "GET /deviceManagement/managedDevices/{id}" oder ZIP-Eintragsname */
  label: string;
  docsUrl?: string;
}

export type AppErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'notFound'
  | 'throttled'
  | 'network'
  | 'aborted'
  | 'graph'
  | 'parse'
  | 'unknown';

export interface AppError {
  code: AppErrorCode;
  message: string;
  httpStatus?: number;
  /** Graph error.code, z. B. "Authorization_RequestDenied" */
  graphCode?: string;
  requestId?: string;
  retryAfterSeconds?: number;
  /** Bei 403: welcher Scope für diesen Aufruf nötig ist */
  requiredScope?: string;
}

/**
 * Ergebnis eines einzelnen Datenbereichs. Jede Kachel hängt an einer oder mehreren Sections und
 * kann unabhängig laden, fehlschlagen oder "nicht verfügbar" sein – nie ein globaler Absturz.
 */
export type SectionResult<T> =
  | { status: 'ok'; data: T; source: DataSource; fetchedAt: string }
  /** Fehlende Berechtigung/Rolle/Lizenz */
  | { status: 'forbidden'; error: AppError; source: DataSource }
  /** Für dieses Gerät fachlich nicht anwendbar (z. B. Defender auf iOS) */
  | { status: 'notApplicable'; reason: string; source: DataSource }
  /** Daten über dokumentierte APIs/ZIP nicht verfügbar (z. B. Settings-Catalog-Status) */
  | { status: 'unavailable'; reason: string; source: DataSource }
  | { status: 'error'; error: AppError; source: DataSource };

// ---------- Gerät ----------

export interface DeviceSearchResult {
  id: string;
  deviceName: string;
  userPrincipalName: string | null;
  userDisplayName: string | null;
  operatingSystem: string | null;
  osVersion: string | null;
  model: string | null;
  /** Seriennummer laut Intune (für die Suche per Seriennummer und die Anzeige des Treffers) */
  serialNumber: string | null;
  complianceState: ComplianceState;
  lastSyncDateTime: string | null;
}

export interface ManagedDeviceInfo {
  id: string;
  deviceName: string;
  osFamily: OsFamily;
  operatingSystem: string | null;
  osVersion: string | null;
  model: string | null;
  manufacturer: string | null;
  serialNumber: string | null;
  /** Entra-Objekt-ID des primären Benutzers (null bei Geräten ohne Benutzer) */
  userId: string | null;
  userPrincipalName: string | null;
  userDisplayName: string | null;
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
  managementCertificateExpirationDate: string | null;
  isSupervised: boolean | null;
  androidSecurityPatchLevel: string | null;
  enrollmentProfileName: string | null;
  source: DataSource;
}

export interface DetectedMalware {
  id: string;
  displayName: string | null;
  severity: WindowsMalwareSeverity;
  state: WindowsMalwareState;
  threatState: WindowsMalwareThreatState;
  category: string | null;
  initialDetectionDateTime: string | null;
  lastStateChangeDateTime: string | null;
  detectionCount: number | null;
  additionalInformationUrl: string | null;
}

export interface WindowsProtectionInfo {
  malwareProtectionEnabled: boolean | null;
  realTimeProtectionEnabled: boolean | null;
  networkInspectionSystemEnabled: boolean | null;
  tamperProtectionEnabled: boolean | null;
  deviceState: WindowsDeviceHealthState | null;
  /** Einzelwerte aus dem windowsDefenderProductStatus-Flags-String */
  productStatus: string[];
  signatureVersion: string | null;
  engineVersion: string | null;
  antiMalwareVersion: string | null;
  signatureUpdateOverdue: boolean | null;
  quickScanOverdue: boolean | null;
  fullScanOverdue: boolean | null;
  fullScanRequired: boolean | null;
  rebootRequired: boolean | null;
  lastQuickScanDateTime: string | null;
  lastFullScanDateTime: string | null;
  lastReportedDateTime: string | null;
  isVirtualMachine: boolean | null;
  detectedMalware: DetectedMalware[];
  /** Gesetzt, wenn die Malware-Liste (detectedMalwareState) nicht abgerufen werden konnte */
  detectedMalwareError?: AppError;
}

export interface PolicySettingInfo {
  setting: string | null;
  settingName: string | null;
  instanceDisplayName: string | null;
  state: ComplianceStatus;
  errorCode: number | null;
  errorDescription: string | null;
  currentValue: string | null;
  sources: Array<{ id: string | null; displayName: string | null }>;
}

export interface PolicyStateInfo {
  id: string;
  kind: 'compliance' | 'configuration';
  displayName: string;
  state: ComplianceStatus;
  platformType: PolicyPlatformType | null;
  version: number | null;
  settingCount: number | null;
  settings: PolicySettingInfo[];
}

export interface EntraDeviceInfo {
  objectId: string;
  deviceId: string | null;
  displayName: string | null;
  accountEnabled: boolean | null;
  trustType: 'Workplace' | 'AzureAd' | 'ServerAd' | null;
  approximateLastSignInDateTime: string | null;
  isCompliant: boolean | null;
  isManaged: boolean | null;
  operatingSystemVersion: string | null;
  registrationDateTime: string | null;
}

/**
 * Ein Entra-Geräteobjekt mit demselben Namen wie das Intune-Gerät (M14/S1). Ohne physicalIds und
 * deviceMetadata.
 */
export interface SameNameEntraDevice {
  objectId: string;
  deviceId: string | null;
  trustType: 'Workplace' | 'AzureAd' | 'ServerAd' | null;
  accountEnabled: boolean | null;
  approximateLastSignInDateTime: string | null;
  isCompliant: boolean | null;
  isManaged: boolean | null;
  registrationDateTime: string | null;
  /** Rohwert laut Graph (z. B. "Windows", "MacMDM") */
  operatingSystem: string | null;
  /** deviceId == azureADDeviceId des Intune-Geräts */
  isCurrent: boolean;
  /** true = anderes Betriebssystem als das Intune-Gerät → nur „gleichnamig“, kein Duplikat */
  differentOs: boolean;
}

/** Entra-Objekte mit dem Gerätenamen (erste Seite). Enthält das aktuelle Objekt, sofern gefunden. */
export interface DuplicateDevicesInfo {
  devices: SameNameEntraDevice[];
  /** true = es gibt weitere Seiten, die nicht gelesen wurden */
  moreAvailable: boolean;
}

export type BitLockerVolumeType =
  'operatingSystemVolume' | 'fixedDataVolume' | 'removableDataVolume' | 'unknown';

/** Nur Metadaten – niemals der Schlüssel selbst. */
export interface BitLockerKeyInfo {
  id: string;
  createdDateTime: string | null;
  volumeType: BitLockerVolumeType;
}

/** App-Absicht und Installationsstatus auf dem Gerät (Graph beta: mobileAppIntentAndStates). */
export interface AppInstallStateInfo {
  appId: string;
  displayName: string;
  version: string | null;
  intent: MobileAppIntent | null;
  installState: ResultantAppState;
}

/** Tenant-weites Apple-MDM-Push-Zertifikat (nur Zeitstempel; keine Apple-ID). */
export interface ApplePushCertificateInfo {
  expirationDateTime: string | null;
  lastModifiedDateTime: string | null;
}

/** Eine von Conditional Access ausgewertete Richtlinie eines Anmeldeeintrags. */
export interface AppliedPolicyInfo {
  id: string | null;
  displayName: string | null;
  result: AppliedConditionalAccessPolicyResult | null;
  enforcedGrantControls: string[];
  enforcedSessionControls: string[];
}

/**
 * Ein Eintrag des Entra-Anmeldeprotokolls für dieses Gerät. Bewusst ohne IP-Adresse, Standort,
 * Risikoangaben und UPN (Datensparsamkeit).
 */
export interface SignInEntry {
  id: string;
  createdDateTime: string | null;
  appDisplayName: string | null;
  resourceDisplayName: string | null;
  clientAppUsed: string | null;
  isInteractive: boolean | null;
  correlationId: string | null;
  conditionalAccessStatus: ConditionalAccessStatus | null;
  /** status.errorCode (0 = Erfolg) */
  errorCode: number | null;
  failureReason: string | null;
  additionalDetails: string | null;
  /** deviceDetail.isCompliant zum Zeitpunkt der Anmeldung */
  deviceIsCompliant: boolean | null;
  deviceIsManaged: boolean | null;
  /** null = Feld fehlt in der Antwort (Konto darf Conditional-Access-Daten nicht lesen) */
  appliedPolicies: AppliedPolicyInfo[] | null;
}

/** Anmeldungen des primären Benutzers im Zeitfenster, eingegrenzt auf dieses Gerät. */
export interface SignInsInfo {
  windowDays: number;
  /** Anzahl der ausgewerteten Anmeldungen des Benutzers (alle Geräte, erste Seite) */
  totalForUser: number;
  /** true = es gibt weitere Seiten, die nicht gelesen wurden (nur die neuesten Einträge geprüft) */
  moreAvailable: boolean;
  /** Anmeldungen genau dieses Geräts (deviceDetail.deviceId == azureADDeviceId), neueste zuerst */
  entries: SignInEntry[];
}

/** Windows LAPS: nur Metadaten des lokalen Administrator-Kennworts – nie das Kennwort selbst. */
export interface LocalAdminInfo {
  deviceName: string | null;
  /** Letzte Sicherung des Kennworts in Entra (lastBackupDateTime) */
  lastBackupDateTime: string | null;
  /** Nächste geplante Aktualisierung/Sicherung (refreshDateTime) */
  refreshDateTime: string | null;
}

/** Windows-Autopilot-Eintrag des Geräts (v1.0). Ohne Seriennummer, Benutzer und Produktschlüssel. */
export interface AutopilotInfo {
  groupTag: string | null;
  enrollmentState: AutopilotEnrollmentState | null;
  lastContactedDateTime: string | null;
  manufacturer: string | null;
  model: string | null;
  /** Wie der Eintrag zugeordnet wurde */
  matchedBy: 'managedDeviceId' | 'serialNumber';
}

/** Gruppe, in der das Entra-Gerät Mitglied ist (nur Name und ID). */
export interface DeviceGroupInfo {
  id: string;
  displayName: string;
}

/** Gruppenmitgliedschaften des Entra-Geräts (direkt und verschachtelt). Gruppen des Benutzers sind nicht enthalten. */
export interface DeviceGroupsInfo {
  groups: DeviceGroupInfo[];
  /** Gruppen, deren Name ohne Leserecht nicht geliefert wurde */
  hiddenCount: number;
  /** true = es gibt weitere Seiten, die nicht gelesen wurden */
  truncated: boolean;
}

/**
 * Device Health Attestation (nur Windows): Rohwerte laut Graph. Microsoft dokumentiert für die meisten
 * Felder keine Werte – sie werden unverändert angezeigt, nicht gedeutet.
 */
export interface HealthAttestationInfo {
  lastUpdateDateTime: string | null;
  issuedDateTime: string | null;
  secureBoot: string | null;
  bitLockerStatus: string | null;
  codeIntegrity: string | null;
  earlyLaunchAntiMalwareDriverProtection: string | null;
  bootDebugging: string | null;
  testSigning: string | null;
  tpmVersion: string | null;
  healthStatusMismatchInfo: string | null;
  healthAttestationSupportedStatus: string | null;
}

// ---------- Zuweisungen (M14/S2) ----------

/** Ziel einer Zuweisung (Graph: deviceAndAppManagementAssignmentTarget). */
export type AssignmentTarget =
  | { kind: 'group'; groupId: string }
  | { kind: 'exclusionGroup'; groupId: string }
  | { kind: 'allDevices' }
  | { kind: 'allUsers' }
  /** Unbekannter `@odata.type` – wird nicht gedeutet */
  | { kind: 'unknown'; odataType: string | null };

export interface AssignmentEntry {
  target: AssignmentTarget;
  /** Nur bei Apps (installIntent der Zuweisung) */
  intent: MobileAppAssignmentIntent | null;
}

export type AssignmentObjectKind = 'compliance' | 'configuration' | 'app';

/** Ein Objekt (aus den Gerätezuständen), dessen Zuweisungen nachgeschlagen werden. */
export interface AssignmentLookup {
  kind: AssignmentObjectKind;
  id: string;
  displayName: string;
}

export interface AssignmentObjectInfo extends AssignmentLookup {
  /**
   * ok = Zuweisungen gelesen (ggf. leer); notFound = Graph kennt unter dieser ID kein Objekt dieses
   * Typs (404); notEvaluable = ID nicht abfragbar (keine GUID, kein Request); error = anderer Fehler
   */
  status: 'ok' | 'notFound' | 'notEvaluable' | 'error';
  assignments: AssignmentEntry[];
}

/** Zuweisungen der Richtlinien/Apps eines Geräts (höchstens 30 Objekte, die übrigen zählen als `skipped`). */
export interface AssignmentsInfo {
  objects: AssignmentObjectInfo[];
  /** Objekte, die wegen der Obergrenze nicht abgefragt wurden */
  skipped: number;
}

// ---------- Registrierung des Benutzers: Lizenz und Gerätelimit (M14/S3) ----------

/** Intune-relevante Serviceplan-Namen laut Lizenz-Referenz (Match über die servicePlanId). */
export type IntunePlanName = 'INTUNE_A' | 'INTUNE_A_VL' | 'INTUNE_EDU' | 'INTUNE_O365';

export interface IntuneLicensePlanInfo {
  plan: IntunePlanName;
  /** SKU der Lizenz, in der der Plan enthalten ist (z. B. "SPE_E3") */
  skuPartNumber: string | null;
  provisioningStatus: ServicePlanProvisioningStatus | null;
}

/** Lizenzen des primären Benutzers, reduziert auf die Intune-Serviceplans. Ohne Benutzerangaben. */
export interface UserLicenseInfo {
  /** Gefundene Intune-Pläne (INTUNE_A, INTUNE_A_VL, INTUNE_EDU, INTUNE_O365) aller Lizenzen */
  plans: IntuneLicensePlanInfo[];
  /** Anzahl der dem Benutzer zugewiesenen Lizenzen (SKUs) */
  licenseCount: number;
}

/** Eine Gerätelimit-Konfiguration (deviceEnrollmentLimitConfiguration) mit ihren Zielen. */
export interface EnrollmentLimitInfo {
  id: string;
  displayName: string;
  /** Benutzer unterliegen nur der Konfiguration mit dem niedrigsten Wert */
  priority: number | null;
  limit: number | null;
  /** null = Zuweisungen konnten nicht gelesen werden */
  targets: AssignmentTarget[] | null;
}

export interface EnrollmentLimitsInfo {
  limits: EnrollmentLimitInfo[];
  /** Limit-Konfigurationen, die wegen der Obergrenze nicht gelesen wurden */
  omitted: number;
}

// ---------- Sicherheitswarnungen (Defender for Endpoint, M14/S4) ----------

export type SecurityAlertSeverityLevel = 'high' | 'medium' | 'low' | 'informational' | 'unknown';
export type SecurityAlertStatusLevel = 'new' | 'inProgress' | 'resolved' | 'unknown';

/**
 * Eine offene Warnung, die diesem Gerät zugeordnet ist. Bewusst ohne Personenbezug: keine angemeldeten
 * Benutzer, keine IP-Adressen, keine Bearbeiter, keine Datei-/Prozess-/Benutzer-Evidenz.
 */
export interface SecurityAlertEntry {
  id: string;
  title: string | null;
  severity: SecurityAlertSeverityLevel;
  status: SecurityAlertStatusLevel;
  createdDateTime: string | null;
  lastUpdateDateTime: string | null;
  categories: string[];
  /** Link ins Defender-Portal (nur https auf Microsoft-Domains, sonst null) */
  alertWebUrl: string | null;
  /** Wie die Warnung dem Gerät zugeordnet wurde */
  matchedBy: 'azureAdDeviceId' | 'deviceName';
  /** Risikostufe des Geräts laut Defender (deviceEvidence.riskScore) */
  deviceRiskScore: string | null;
  /** Zustand des Defender-Antivirus laut Evidenz (deviceEvidence.defenderAvStatus) */
  defenderAvStatus: string | null;
}

export interface SecurityAlertsInfo {
  /** Nicht behobene Warnungen dieses Geräts, neueste zuerst */
  alerts: SecurityAlertEntry[];
  /** Als „resolved“ geführte Warnungen dieses Geräts (ausgeblendet) */
  resolvedCount: number;
  /** Anzahl der gelesenen Warnungen (alle Geräte) */
  evaluated: number;
  /** true = es gibt weitere Seiten, die nicht gelesen wurden (nur die neuesten Warnungen geprüft) */
  moreAvailable: boolean;
}

// ---------- Mandanten-Status (M14/S5) ----------

export type VppTokenStateLevel =
  'unknown' | 'valid' | 'expired' | 'invalid' | 'assignedToExternalMDM';
export type VppSyncStatusLevel = 'none' | 'inProgress' | 'completed' | 'failed';

/**
 * Ein Apple-VPP-Token des Mandanten. Bewusst ohne das Token selbst und ohne Apple-ID (beides liefert
 * die Graph-Antwort mit, beides wird nie gelesen).
 */
export interface VppTokenInfo {
  id: string;
  organizationName: string | null;
  accountType: 'business' | 'education' | null;
  expirationDateTime: string | null;
  lastSyncDateTime: string | null;
  state: VppTokenStateLevel | null;
  lastSyncStatus: VppSyncStatusLevel | null;
  countryOrRegion: string | null;
  /** Anzahl der Apps seit der letzten Synchronisierung */
  lastAppCount: number | null;
}

/**
 * Status mandantenweiter Zertifikate und Token (Ansicht „Mandant“, unabhängig von einem Gerät). Jede
 * Quelle ist ein eigenes SectionResult – eine fehlende Berechtigung betrifft nur ihre Kachel.
 */
export interface TenantStatus {
  applePushCertificate: SectionResult<ApplePushCertificateInfo>;
  vppTokens: SectionResult<VppTokenInfo[]>;
  /** Microsoft-365-Dienststatus (M18, optionaler Scope ServiceHealth.Read.All) */
  serviceHealth: SectionResult<ServiceHealthInfo>;
  /** Fehlgeschlagene Registrierungen im Mandanten (M18, seitenbegrenzt) */
  enrollmentFailures: SectionResult<EnrollmentFailuresInfo>;
}

// ---------- Dienststatus (M18) ----------

/**
 * Welcher Dienst gemeint ist. Der genaue `service`-Name ist laut Doku Mandanten-Datum („Use the list
 * healthOverviews operation to get exact string names“) – die Zuordnung erfolgt deshalb über den Namen
 * (enthält „Intune“ bzw. „Entra“) und ist unter „Live zu verifizieren (M18)“ notiert.
 */
export type ServiceHealthKind = 'intune' | 'entra';

/** Ein offener Vorfall oder Hinweis. Texte bleiben englisch (Microsoft-Original, nicht übersetzt). */
export interface ServiceHealthIssueInfo {
  id: string;
  title: string | null;
  /** null = Wert fehlt oder ist nicht dokumentiert */
  classification: ServiceHealthClassificationType | null;
  /** null = Wert fehlt oder ist nicht dokumentiert; der Rohwert steht in statusRaw */
  status: ServiceHealthStatus | null;
  statusRaw: string | null;
  startDateTime: string | null;
  lastModifiedDateTime: string | null;
  feature: string | null;
  featureGroup: string | null;
  impactDescription: string | null;
}

export interface ServiceHealthEntry {
  id: string;
  service: string;
  kind: ServiceHealthKind | null;
  status: ServiceHealthStatus | null;
  statusRaw: string | null;
  /** Nur nicht behobene Vorfälle/Hinweise (isResolved ≠ true), neueste Aktualisierung zuerst */
  openIssues: ServiceHealthIssueInfo[];
  /** Als behoben gemeldete (ausgeblendete) Einträge */
  resolvedCount: number;
}

export interface ServiceHealthInfo {
  /** Alle gemeldeten Dienste (Intune/Entra zuerst) */
  services: ServiceHealthEntry[];
  /** Weitere Seiten vorhanden, aber nicht gelesen */
  truncated: boolean;
}

// ---------- Registrierungsfehler (M18) ----------

/**
 * Ein fehlgeschlagener Registrierungsversuch (enrollmentTroubleshootingEvent). Die Ressource nennt nur die
 * `userId` (GUID) – ein Name ist mit den vorhandenen Berechtigungen nicht abrufbar.
 */
export interface EnrollmentFailureEvent {
  id: string;
  eventDateTime: string | null;
  correlationId: string | null;
  operatingSystem: string | null;
  osVersion: string | null;
  userId: string | null;
  /** null = Wert fehlt; nicht dokumentierte Werte stehen nur in enrollmentTypeRaw */
  enrollmentType: TroubleshootingEnrollmentType | null;
  enrollmentTypeRaw: string | null;
  /** null = Wert fehlt oder ist nicht dokumentiert; Rohwert in failureCategoryRaw */
  failureCategory: DeviceEnrollmentFailureReason | null;
  failureCategoryRaw: string | null;
  failureReason: string | null;
}

export interface EnrollmentFailuresInfo {
  /** Neueste zuerst (clientseitig sortiert – eine Sortierung ist nicht dokumentiert) */
  events: EnrollmentFailureEvent[];
  /** Gelesene Seiten */
  pagesRead: number;
  /** Weitere Seiten vorhanden, aber nicht gelesen (Grenze MAX_TROUBLESHOOTING_EVENT_PAGES) */
  truncated: boolean;
  /** Bei gerätebezogener Abfrage: Benutzer, auf den gefiltert wurde (sonst null) */
  filteredUserId: string | null;
}

// ---------- Richtlinien → Geräte (M15, Ansicht „Richtlinien“) ----------

export type TenantPolicyKind = 'configuration' | 'compliance';

/**
 * Zähler einer Richtlinie (deviceStatusOverview, v1.0). Die Doku beschreibt die Zähler nur knapp
 * („Number of error/failed/pending … devices“); einen Konflikt-Zähler gibt es in v1.0 nicht.
 */
export interface PolicyDeviceOverview {
  pendingCount: number | null;
  notApplicableCount: number | null;
  successCount: number | null;
  errorCount: number | null;
  failedCount: number | null;
  lastUpdateDateTime: string | null;
  configurationVersion: number | null;
}

/** Eine Richtlinie des Mandanten (Konfigurationsprofil oder Compliance-Richtlinie). */
export interface TenantPolicyInfo {
  id: string;
  kind: TenantPolicyKind;
  displayName: string;
  /** Aus dem abgeleiteten Typ (`@odata.type`) – null, wenn der Typ keine Plattform erkennen lässt */
  platform: OsFamily | null;
  version: number | null;
  lastModifiedDateTime: string | null;
  /** null = Zähler nicht abgefragt (Grenze MAX_POLICY_OVERVIEWS) */
  overview: SectionResult<PolicyDeviceOverview> | null;
}

export interface TenantPolicyList {
  policies: TenantPolicyInfo[];
  /** Die Liste hat mehr Seiten als gelesen wurden */
  truncated: boolean;
}

/**
 * Richtlinien des Mandanten (M15). Beide Listen sind eigene SectionResults – eine fehlende
 * Berechtigung oder ein Fehler betrifft nur ihre Liste; die Zähler je Richtlinie ebenso.
 */
export interface TenantPolicies {
  configurations: SectionResult<TenantPolicyList>;
  compliancePolicies: SectionResult<TenantPolicyList>;
  /** Höchstzahl der Richtlinien, deren Zähler abgefragt werden */
  overviewLimit: number;
}

/**
 * Status einer Richtlinie auf einem Gerät (deviceStatuses, v1.0). `id` ist laut Doku nur der Schlüssel
 * des Eintrags – nicht als managedDevice-ID belegt; das Gerät wird deshalb über den Namen gesucht.
 */
export interface PolicyDeviceStatusEntry {
  id: string;
  deviceDisplayName: string | null;
  userPrincipalName: string | null;
  userName: string | null;
  deviceModel: string | null;
  status: ComplianceStatus;
  lastReportedDateTime: string | null;
}

export interface PolicyDeviceStatusesInfo {
  entries: PolicyDeviceStatusEntry[];
  /** Weitere Seiten vorhanden, aber nicht gelesen (Grenze MAX_POLICY_STATUS_PAGES) */
  truncated: boolean;
  pagesRead: number;
}

// ---------- Verbindungstest (M14/S6) ----------

/** Ergebnis eines einzelnen Endpunkt-Aufrufs im Verbindungstest. `skipped` = Aufruf nicht möglich (siehe skipReason). */
export type ProbeOutcome = 'ok' | 'forbidden' | 'notFound' | 'badRequest' | 'error' | 'skipped';

/**
 * Ergebnis eines Endpunkts im Verbindungstest. Bewusst nur Struktur: nie Antwortwerte, IDs oder Namen –
 * von der Antwort bleiben Anzahl der Einträge und die Namen der Felder auf oberster Ebene des ersten
 * Eintrags.
 */
export interface EndpointProbeResult {
  /** Schlüssel in `Endpoints` */
  endpointId: string;
  /** Lesbare Form, z. B. "GET /deviceManagement/managedDevices/{id}" (nur Platzhalter, keine Werte) */
  display: string;
  version: 'v1.0' | 'beta';
  scope: string;
  outcome: ProbeOutcome;
  /** HTTP-Status bei Fehlern; bei Erfolg nicht bekannt (null) */
  httpStatus: number | null;
  /** Dauer inkl. Wiederholungen bei Drosselung; null bei skipped */
  durationMs: number | null;
  /** Einträge der Antwort (Sammlung: Länge von value, einzelnes Objekt: 1); null bei Fehler/skipped */
  entryCount: number | null;
  /** Namen der Felder auf oberster Ebene des ersten Eintrags (keine Werte) */
  fieldNames: string[];
  /** Grund, warum der Endpunkt nicht aufgerufen wurde (nur bei skipped) */
  skipReason: string | null;
}

/** Alles, was zu einem Gerät geladen wurde. Jede Section lädt unabhängig (undefined = lädt noch). */
export interface DeviceSnapshot {
  device: ManagedDeviceInfo;
  protection?: SectionResult<WindowsProtectionInfo>;
  compliancePolicies?: SectionResult<PolicyStateInfo[]>;
  configurationPolicies?: SectionResult<PolicyStateInfo[]>;
  /** data null = kein Entra-Objekt gefunden */
  entraDevice?: SectionResult<EntraDeviceInfo | null>;
  /** Entra-Objekte mit demselben Namen (M14/S1, Scope Device.Read.All) */
  duplicateDevices?: SectionResult<DuplicateDevicesInfo>;
  bitlockerKeys?: SectionResult<BitLockerKeyInfo[]>;
  appInstallStates?: SectionResult<AppInstallStateInfo[]>;
  /** Nur macOS/iOS/iPadOS: Ablauf des Tenant-weiten Apple-MDM-Push-Zertifikats */
  applePushCertificate?: SectionResult<ApplePushCertificateInfo>;
  /** Anmeldungen des primären Benutzers an diesem Gerät (Entra-Anmeldeprotokoll, optionaler Scope) */
  signIns?: SectionResult<SignInsInfo>;
  /** Nur Windows: Windows-LAPS-Metadaten aus Entra (optionaler Scope DeviceLocalCredential.ReadBasic.All) */
  localAdmin?: SectionResult<LocalAdminInfo>;
  /**
   * Nur Windows: Eintrag in der Autopilot-Geräteliste. data null = Liste vollständig gelesen, das
   * Gerät steht nicht darin (kein Fehler). Optionaler Scope DeviceManagementServiceConfig.Read.All.
   */
  autopilot?: SectionResult<AutopilotInfo | null>;
  /** Lizenz des primären Benutzers (M14/S3, optionaler Scope LicenseAssignment.Read.All) */
  userLicense?: SectionResult<UserLicenseInfo>;
  /** Gerätelimit-Konfigurationen des Mandanten (M14/S3, optionaler Scope DeviceManagementServiceConfig.Read.All) */
  enrollmentLimits?: SectionResult<EnrollmentLimitsInfo>;
  /** Offene Defender-Warnungen dieses Geräts (M14/S4, optionaler Scope SecurityAlert.Read.All) */
  securityAlerts?: SectionResult<SecurityAlertsInfo>;
  /** Fehlgeschlagene Registrierungen des primären Benutzers (M18, seitenbegrenzt, Kachel „Registrierung“) */
  enrollmentFailures?: SectionResult<EnrollmentFailuresInfo>;
  /** Gruppen des Geräts in Entra (informativ, Scope Device.Read.All) */
  deviceGroups?: SectionResult<DeviceGroupsInfo>;
  /**
   * Weitere Geräte des primären Benutzers (Geräte-Header, keine Kachel). Ohne Treffer, ohne Berechtigung
   * oder bei Fehlern entfällt die Zeile still. Enthält das aktuelle Gerät nicht.
   */
  userDevices?: SectionResult<DeviceSearchResult[]>;
  /** Nur Windows: Device Health Attestation (Integritätsnachweis, Rohwerte) */
  healthAttestation?: SectionResult<HealthAttestationInfo>;
  /**
   * Zuweisungen der Richtlinien und Apps, die in den Gerätezuständen erscheinen (M14/S2). Hängt von
   * compliancePolicies, configurationPolicies, appInstallStates und deviceGroups ab und lädt erst danach.
   */
  assignments?: SectionResult<AssignmentsInfo>;
  /** Optional: Befunde aus einem geladenen DiagLogs-ZIP */
  diagnostics?: DiagnosticsReport;
}

// ---------- Darstellung: Kacheln & Befunde ----------

export type TileId =
  | 'deviceStatus'
  | 'compliance'
  | 'checkIn'
  | 'osVersion'
  | 'bitlocker'
  | 'defender'
  | 'policies'
  | 'apps'
  | 'signIns'
  | 'laps'
  | 'autopilot'
  | 'groups'
  | 'attestation'
  | 'registration'
  | 'securityAlerts'
  // Ansicht „Mandant“ (M14/S5), kein Gerät:
  | 'tenantApplePush'
  | 'tenantVpp'
  | 'tenantServiceHealth'
  | 'tenantEnrollmentFailures'
  | 'tenantUnavailable'
  // nur mit DiagLogs-ZIP:
  | 'entraJoin'
  | 'win32Apps'
  | 'enrollment'
  | 'certsNetwork'
  | 'mdmEvents'
  | 'mdmDiagReport'
  | 'diagCollection';

/** Name einer Intune-App, aufgelöst über GET /deviceAppManagement/mobileApps/{id} (bzw. Mock-Katalog). */
export interface AppInfo {
  id: string;
  displayName: string;
  publisher: string | null;
}

/** Kleine Tabelle innerhalb eines Befunds (z. B. gleichnamige Entra-Objekte). Reiner Text. */
export interface FindingTable {
  columns: string[];
  rows: Array<{ cells: string[]; /** z. B. das aktuelle Objekt */ highlight?: boolean }>;
}

/** Weiterführender Link, z. B. "In Intune öffnen". */
export interface ResourceLink {
  label: string;
  url: string;
}

export interface Finding {
  id: string;
  severity: Severity;
  /** Kurz: "BitLocker ist nicht aktiviert" */
  title: string;
  /**
   * Sprache von `title` bzw. `detail`, wenn sie unverändert von Microsoft stammen (z. B. Vorfälle im
   * Dienststatus, M18) – die UI setzt dann `lang`, damit Screenreader richtig vorlesen.
   */
  titleLang?: 'en';
  detailLang?: 'en';
  /** Was genau beobachtet wurde */
  detail: string;
  /** Wahrscheinliche Ursache(n) */
  cause: string;
  /** Konkrete, read-only formulierte Lösungsschritte für den Admin */
  remediation: string[];
  /** Rohwerte, die den Befund belegen */
  evidence?: Record<string, string | number | boolean | null>;
  /** Optionale Tabelle (Spalten × Zeilen), z. B. gleichnamige Objekte oder Zuweisungen */
  table?: FindingTable;
  source: DataSource;
  docsUrl?: string;
  /** Links ins Intune Admin Center (App, Gerät, Richtlinienübersicht) */
  links?: ResourceLink[];
}

/** Sections eines DeviceSnapshot, die unabhängig laden (und erneut geladen werden können). */
export type SnapshotSectionKey =
  | 'protection'
  | 'compliancePolicies'
  | 'configurationPolicies'
  | 'entraDevice'
  | 'duplicateDevices'
  | 'bitlockerKeys'
  | 'appInstallStates'
  | 'applePushCertificate'
  | 'signIns'
  | 'localAdmin'
  | 'autopilot'
  | 'deviceGroups'
  | 'userDevices'
  | 'healthAttestation'
  | 'userLicense'
  | 'enrollmentLimits'
  | 'securityAlerts'
  | 'enrollmentFailures'
  | 'assignments';

/** Geprüfter Wert, der im Detail-Sheet angezeigt wird (auch wenn alles in Ordnung ist). */
export interface TileFact {
  label: string;
  value: string;
  /** Monospace-Darstellung (IDs, Versionen, Codes) */
  mono?: boolean;
  /** z. B. absolutes Datum als Tooltip zu einer relativen Zeit */
  title?: string;
}

/** Warum eine Kachel (teilweise) nicht ausgewertet werden konnte. */
export type TileAvailability = 'forbidden' | 'notApplicable' | 'unavailable' | 'error';

export interface Tile {
  id: TileId;
  title: string;
  /** 'loading' solange benötigte Sections fehlen */
  state: 'loading' | 'ready';
  severity: Severity;
  /** Hauptwert, z. B. "Nicht konform", "vor 3 Std.", "Windows 11 24H2" */
  value: string;
  /** Eine Zeile Kontext */
  summary: string;
  findings: Finding[];
  sources: DataSource[];
  /** Geprüfte Werte (Key/Value) für das Detail-Sheet */
  facts: TileFact[];
  /** Gesetzt, wenn eine benötigte Section forbidden/notApplicable/unavailable/error ist */
  availability?: TileAvailability;
  /** Sections, von denen die Kachel abhängt (für "Erneut laden" im Detail-Sheet) */
  sections: SnapshotSectionKey[];
}
