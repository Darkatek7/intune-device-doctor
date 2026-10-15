/**
 * Form der Demo-Szenarien. Szenarien liefern Domain-Daten (Enum-Werte exakt wie Graph),
 * der MockProvider ergänzt Quelle/Zeitstempel und verpackt alles in SectionResult.
 */
import type {
  AppError,
  BitLockerKeyInfo,
  EntraDeviceInfo,
  ManagedDeviceInfo,
  PolicyStateInfo,
  WindowsProtectionInfo,
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
}

export interface MockScenario {
  /** Gerätename, z. B. "CONTOSO-PC001" */
  deviceName: string;
  /** Kurzbeschreibung (Deutsch) – für Beispiel-Chips im leeren Zustand */
  label: string;
  /** Datumswerte relativ zu now berechnen */
  build: (now: Date) => MockDeviceFixture;
}
