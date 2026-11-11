/**
 * Form der Demo-Szenarien. Szenarien liefern Domain-Daten (Enum-Werte exakt wie Graph),
 * der MockProvider ergänzt Quelle/Zeitstempel und verpackt alles in SectionResult.
 */
import type {
  AssignmentEntry,
  AssignmentsInfo,
  DeviceSearchResult,
  DeviceGroupsInfo,
  DuplicateDevicesInfo,
  AutopilotInfo,
  AppError,
  ApplePushCertificateInfo,
  AppInstallStateInfo,
  BitLockerKeyInfo,
  EnrollmentFailuresInfo,
  EnrollmentLimitsInfo,
  ServiceHealthInfo,
  EntraDeviceInfo,
  HealthAttestationInfo,
  LocalAdminInfo,
  ManagedDeviceInfo,
  PolicyStateInfo,
  SecurityAlertsInfo,
  SignInsInfo,
  UserLicenseInfo,
  VppTokenInfo,
  WindowsProtectionInfo,
  PolicyDeviceStatusesInfo,
  TenantPolicyList,
} from '../../domain/types';

/** Wie eine Section im Demo-Modus antwortet. */
export type MockSection<T> =
  | { status: 'ok'; data: T }
  /** Simuliert HTTP 403 – der Provider setzt requiredScope aus der Endpoint-Definition */
  | { status: 'forbidden'; graphCode?: string }
  | { status: 'notApplicable'; reason: string }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; error: AppError };

export interface MockDeviceFixture {
  device: Omit<ManagedDeviceInfo, 'source'>;
  protection: MockSection<WindowsProtectionInfo>;
  compliancePolicies: MockSection<PolicyStateInfo[]>;
  configurationPolicies: MockSection<PolicyStateInfo[]>;
  /** data null = kein Entra-Objekt gefunden */
  entraDevice: MockSection<EntraDeviceInfo | null>;
  bitlockerKeys: MockSection<BitLockerKeyInfo[]>;
  /** Optional – ohne Angabe: nur das aktuelle Entra-Objekt (kein Duplikat); ohne Entra-Objekt leer. */
  duplicateDevices?: MockSection<DuplicateDevicesInfo>;
  /** Optional – ohne Angabe liefert der MockProvider den Standard-App-Satz (alle installiert). */
  appInstallStates?: MockSection<AppInstallStateInfo[]>;
  /** Optional – ohne Angabe: Apple-Geräte ok (läuft in ~200 Tagen ab), andere notApplicable. */
  applePushCertificate?: MockSection<ApplePushCertificateInfo>;
  /** Optional – ohne Angabe: Geräte mit Benutzer ok (zwei erfolgreiche Anmeldungen), sonst notApplicable. */
  signIns?: MockSection<SignInsInfo>;
  /** Optional – ohne Angabe: Windows ok (Sicherung vor wenigen Tagen), sonst notApplicable. */
  localAdmin?: MockSection<LocalAdminInfo>;
  /** Optional – ohne Angabe: Windows ok (registriert, Group Tag „Contoso-Standard“), sonst notApplicable. data null = nicht registriert. */
  autopilot?: MockSection<AutopilotInfo | null>;
  /** Optional – ohne Angabe: drei Standardgruppen (ok). */
  deviceGroups?: MockSection<DeviceGroupsInfo>;
  /** Optional – ohne Angabe: andere Szenarien mit demselben Benutzer (UPN), ohne das Gerät selbst. */
  userDevices?: MockSection<DeviceSearchResult[]>;
  /** Optional – ohne Angabe: Windows ok (unauffällige Rohwerte), sonst notApplicable. */
  healthAttestation?: MockSection<HealthAttestationInfo>;
  /** Optional (M14/S3) – ohne Angabe: Benutzer hat INTUNE_A (Success); ohne primären Benutzer notApplicable. */
  userLicense?: MockSection<UserLicenseInfo>;
  /** Optional (M14/S4) – ohne Angabe: ok, keine offene Warnung für dieses Gerät. */
  securityAlerts?: MockSection<SecurityAlertsInfo>;
  /** Optional (M14/S3) – ohne Angabe: zwei Gerätelimit-Konfigurationen (5 und 15 Geräte); ohne Benutzer notApplicable. */
  enrollmentLimits?: MockSection<EnrollmentLimitsInfo>;
  /**
   * Optional (M18) – ohne Angabe: die Registrierungsfehler des Demo-Mandanten, gefiltert auf den Benutzer
   * des Geräts; ohne Benutzer notApplicable.
   */
  enrollmentFailures?: MockSection<EnrollmentFailuresInfo>;
  /**
   * Optional (M14/S2) – ohne Angabe: jedes nachgeschlagene Objekt ist der Gruppe „Contoso – Alle Geräte“
   * zugewiesen. Ein `ok`-Wert ersetzt die abgeleitete Antwort vollständig; die anderen Status simulieren
   * z. B. fehlende Berechtigung.
   */
  assignments?: MockSection<AssignmentsInfo>;
  /** Optional (M14/S2): Zuweisungen einzelner Objekte (Schlüssel = Richtlinien-/App-ID) statt der Standardzuweisung. */
  assignmentTargets?: Record<string, AssignmentEntry[]>;
}

export interface MockScenario {
  /** Gerätename, z. B. "CONTOSO-PC001" */
  deviceName: string;
  /** Kurzbeschreibung (Deutsch) – für Beispiel-Chips im leeren Zustand */
  label: string;
  /** Datumswerte relativ zu now berechnen */
  build: (now: Date) => MockDeviceFixture;
}

/** Demo-Daten der Ansicht „Mandant“ (M14/S5). Ohne Angabe: gültiges Push-Zertifikat, zwei VPP-Tokens (eines läuft in 20 Tagen ab). */
export interface MockTenantFixture {
  applePushCertificate?: MockSection<ApplePushCertificateInfo>;
  vppTokens?: MockSection<VppTokenInfo[]>;
  /** M18: Dienststatus (Standard: offener Intune-Vorfall, siehe ../mock/service.ts) */
  serviceHealth?: MockSection<ServiceHealthInfo>;
  /** M18: Registrierungsfehler des Mandanten (Standard: sieben Fehlschläge in fünf Kategorien) */
  enrollmentFailures?: MockSection<EnrollmentFailuresInfo>;
  /** Ansicht „Richtlinien“ (M15): ersetzt die aus den Demo-Geräten abgeleitete Liste (z. B. forbidden in Tests). */
  configurations?: MockSection<TenantPolicyList>;
  compliancePolicies?: MockSection<TenantPolicyList>;
  /** Gerätestatus einzelner Richtlinien (Schlüssel `kind:id`) statt der abgeleiteten Werte. */
  policyStatuses?: Record<string, MockSection<PolicyDeviceStatusesInfo>>;
  /** Höchstzahl abgefragter Zähler (Standard MAX_POLICY_OVERVIEWS) – für Tests der Grenze. */
  policyOverviewLimit?: number;
}
