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
  AppError,
  AppInfo,
  BitLockerKeyInfo,
  DataMode,
  DeviceSearchResult,
  EntraDeviceInfo,
  ManagedDeviceInfo,
  PolicyStateInfo,
  SectionResult,
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
