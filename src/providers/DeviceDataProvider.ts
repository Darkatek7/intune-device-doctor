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
  AutopilotInfo,
  AppError,
  ApplePushCertificateInfo,
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
   * App-Namen zu Intune-App-IDs (z. B. Win32-Apps aus einem DiagLogs-ZIP). Unbekannte IDs fehlen im
   * Ergebnis einfach; eine fehlende Berechtigung liefert "forbidden".
   */
  getMobileApps(appIds: string[], options?: RequestOptions): Promise<SectionResult<AppInfo[]>>;
}

export class ProviderError extends Error {
  readonly error: AppError;
  constructor(error: AppError) {
    super(error.message);
    this.name = 'ProviderError';
    this.error = error;
  }
}
