/**
 * Gemeinsame Schnittstelle für Demo- (MockProvider) und Live-Daten (GraphProvider).
 * Die UI kennt NUR diese Schnittstelle – der Modus wird ausschließlich beim Erzeugen gewählt.
 *
 * Verträge:
 * - Read-only: kein Provider verändert Intune-/Entra-Objekte.
 * - searchDevices/getDevice werfen bei Fehlern eine ProviderError (AppError).
 * - Alle get*-Section-Methoden werfen NIE (außer bei Abort) – sie liefern SectionResult mit
 *   status forbidden / notApplicable / unavailable / error.
 */
import type {
  AssignmentLookup,
  AssignmentsInfo,
  EnrollmentFailuresInfo,
  EnrollmentLimitsInfo,
  SecurityAlertsInfo,
  ServiceHealthInfo,
  TenantStatus,
  TenantPolicies,
  TenantPolicyKind,
  PolicyDeviceStatusesInfo,
  UserLicenseInfo,
  HealthAttestationInfo,
  DeviceGroupsInfo,
  DuplicateDevicesInfo,
  AutopilotInfo,
  AppError,
  ApplePushCertificateInfo,
  EndpointProbeResult,
  AppInfo,
  AppInstallStateInfo,
  BitLockerKeyInfo,
  DataMode,
  DeviceSearchResult,
  EntraDeviceInfo,
  LocalAdminInfo,
  ManagedDeviceInfo,
  PolicyStateInfo,
  SectionResult,
  SignInsInfo,
  WindowsProtectionInfo,
} from '../domain/types';

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface DeviceDataProvider {
  readonly mode: DataMode;

  /** Exakter Name zuerst, sonst Teilstring. Leeres Array = nichts gefunden. */
  searchDevices(query: string, options?: RequestOptions): Promise<DeviceSearchResult[]>;

  getDevice(managedDeviceId: string, options?: RequestOptions): Promise<ManagedDeviceInfo>;

  getProtectionState(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<WindowsProtectionInfo>>;

  getCompliancePolicyStates(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<PolicyStateInfo[]>>;

  getConfigurationPolicyStates(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<PolicyStateInfo[]>>;

  getEntraDevice(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<EntraDeviceInfo | null>>;

  /**
   * Entra-Objekte mit demselben Namen wie das Gerät (erste Seite, M14/S1). Dient dem Befund „doppelte
   * Objekte“ (z. B. Dual State hybrid joined + registriert).
   */
  getDuplicateDevices(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<DuplicateDevicesInfo>>;

  getBitLockerKeys(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<BitLockerKeyInfo[]>>;

  /** App-Absicht + Installationsstatus der Apps auf diesem Gerät (pro primärem Benutzer). */
  getAppInstallStates(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<AppInstallStateInfo[]>>;

  /**
   * Tenant-weites Apple-MDM-Push-Zertifikat (Ablauf). Nur für macOS/iOS/iPadOS; sonst
   * notApplicable ohne Request.
   */
  getApplePushCertificate(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<ApplePushCertificateInfo>>;

  /**
   * Anmeldungen des primären Benutzers der letzten Tage, eingegrenzt auf dieses Gerät (Entra-
   * Anmeldeprotokoll). Ohne primären Benutzer oder Entra-Geräte-ID nicht anwendbar bzw. nicht verfügbar.
   */
  getSignIns(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<SignInsInfo>>;

  /**
   * Windows LAPS (nur Windows): Zeitpunkte der letzten Sicherung und der nächsten Aktualisierung des
   * lokalen Administrator-Kennworts aus Entra. Das Kennwort selbst wird nie angefordert.
   */
  getLocalAdmin(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<LocalAdminInfo>>;

  /**
   * Windows Autopilot (nur Windows): Eintrag des Geräts in der Autopilot-Geräteliste. data null =
   * Liste vollständig gelesen, Gerät nicht darin; innerhalb der Seitengrenze nicht gefunden → unavailable.
   */
  getAutopilot(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<AutopilotInfo | null>>;

  /**
   * Gruppen des Geräts in Entra (transitiveMemberOf, höchstens 5 Seiten). Gruppen des Benutzers sind
   * nicht enthalten (dafür wäre ein weiterer Scope nötig).
   */
  getDeviceGroups(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<DeviceGroupsInfo>>;

  /**
   * Weitere Geräte des primären Benutzers (nur Name, Plattform, Compliance), ohne das aktuelle Gerät.
   * Ohne Benutzer-UPN nicht anwendbar.
   */
  getUserDevices(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<DeviceSearchResult[]>>;

  /**
   * Device Health Attestation (nur Windows): Rohwerte aus managedDevice.deviceHealthAttestationState
   * (eigener Aufruf mit $select).
   */
  getHealthAttestation(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<HealthAttestationInfo>>;

  /**
   * Lizenz des primären Benutzers (M14/S3): nur die Intune-Serviceplans aus `licenseDetails`. Ohne
   * primären Benutzer notApplicable; optionaler Scope LicenseAssignment.Read.All (403 → forbidden).
   */
  getUserLicense(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<UserLicenseInfo>>;

  /**
   * Status mandantenweiter Zertifikate und Token (M14/S5, Ansicht „Mandant“): Apple-MDM-Push-Zertifikat
   * und Apple-VPP-Tokens. Unabhängig von einem Gerät; jede Quelle ist ein eigenes SectionResult
   * (403/404/Fehler betreffen nur ihre Kachel). Die VPP-Antwort enthält `token` und `appleId` – beides
   * wird nie gelesen. Wirft nur bei Abbruch.
   */
  getTenantStatus(options?: RequestOptions): Promise<TenantStatus>;

  /**
   * Microsoft-365-Dienststatus (M18): alle abonnierten Dienste mit ihren offenen Vorfällen/Hinweisen
   * (`healthOverviews?$expand=issues`). Teil von getTenantStatus; einzeln abrufbar für den Hinweis in der
   * Geräteansicht. Optionaler Scope ServiceHealth.Read.All (403 → forbidden).
   */
  getServiceHealth(options?: RequestOptions): Promise<SectionResult<ServiceHealthInfo>>;

  /**
   * Fehlgeschlagene Registrierungen des primären Benutzers (M18): die Registrierungsfehler des Mandanten
   * (höchstens MAX_TROUBLESHOOTING_EVENT_PAGES Seiten), clientseitig auf die `userId` des Geräts gefiltert.
   * Ohne primären Benutzer notApplicable.
   */
  getEnrollmentFailures(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<EnrollmentFailuresInfo>>;

  /**
   * Richtlinien des Mandanten (M15, Ansicht „Richtlinien“): Konfigurationsprofile und
   * Compliance-Richtlinien (je ein SectionResult) mit den Zählern aus `deviceStatusOverview` – höchstens
   * für MAX_POLICY_OVERVIEWS Richtlinien (zuletzt geänderte zuerst), der Rest `overview: null` („nicht
   * abgefragt“). Settings-Catalog/Endpoint-Security fehlen (nur beta). Wirft nur bei Abbruch.
   */
  getTenantPolicies(options?: RequestOptions): Promise<TenantPolicies>;

  /**
   * Gerätestatus einer Richtlinie (M15): `…/{id}/deviceStatuses`, höchstens MAX_POLICY_STATUS_PAGES
   * Seiten (danach `truncated`). Die Einträge tragen keine dokumentierte managedDevice-ID.
   */
  getPolicyDeviceStatuses(
    policy: { kind: TenantPolicyKind; id: string },
    options?: RequestOptions,
  ): Promise<SectionResult<PolicyDeviceStatusesInfo>>;

  /**
   * Offene Defender-for-Endpoint-Warnungen dieses Geräts (M14/S4): die neuesten Warnungen des Mandanten
   * (höchstens 3 Seiten à 100), clientseitig dem Gerät zugeordnet; behobene ausgeblendet. Optionaler
   * Scope SecurityAlert.Read.All (403 → forbidden).
   */
  getSecurityAlerts(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<SecurityAlertsInfo>>;

  /**
   * Gerätelimit-Konfigurationen des Mandanten mit ihren Zielen (M14/S3). Ohne primären Benutzer
   * notApplicable; optionaler Scope DeviceManagementServiceConfig.Read.All.
   */
  getEnrollmentLimits(
    device: ManagedDeviceInfo,
    options?: RequestOptions,
  ): Promise<SectionResult<EnrollmentLimitsInfo>>;

  /**
   * Zuweisungen der Richtlinien/Apps, die in den Gerätezuständen erscheinen (M14/S2): je Objekt ein GET
   * auf `…/{id}/assignments`, höchstens 30 Objekte, 4 parallel. Hängt von anderen Sections ab, deshalb
   * bekommt die Methode die nachzuschlagenden Objekte übergeben (siehe `assignmentLookups`). Ohne Objekte
   * notApplicable; fehlende Berechtigung betrifft alle Objekte → forbidden.
   */
  getAssignments(
    device: ManagedDeviceInfo,
    lookups: AssignmentLookup[],
    options?: RequestOptions,
  ): Promise<SectionResult<AssignmentsInfo>>;

  /**
   * App-Namen zu Intune-App-IDs (z. B. Win32-Apps aus einem DiagLogs-ZIP). Unbekannte IDs fehlen im
   * Ergebnis einfach; eine fehlende Berechtigung liefert "forbidden".
   */
  getMobileApps(appIds: string[], options?: RequestOptions): Promise<SectionResult<AppInfo[]>>;

  /**
   * Verbindungstest (M14/S6, nur Live): ruft jeden Endpunkt der Registry für dieses Gerät genau einmal
   * lesend auf, nacheinander. Liefert je Endpunkt nur Ergebnis, Dauer, Anzahl der Einträge und
   * Feldnamen – nie Werte. `onResult` meldet jedes Ergebnis sofort (Fortschritt). Wirft nur bei Abbruch.
   * Fehlt im Demo-Modus (die UI blendet den Einstieg dann aus).
   */
  testConnection?(
    device: ManagedDeviceInfo,
    options?: RequestOptions & {
      onResult?: (result: EndpointProbeResult, index: number, total: number) => void;
    },
  ): Promise<EndpointProbeResult[]>;
}

export class ProviderError extends Error {
  readonly error: AppError;
  constructor(error: AppError) {
    super(error.message);
    this.name = 'ProviderError';
    this.error = error;
  }
}
