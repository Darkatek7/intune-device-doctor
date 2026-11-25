/**
 * Vertrag der Ansicht „Flotte“ (M22): die mandantenweite Geräteliste.
 *
 * Quelle ist allein die dokumentierte v1.0-Liste `GET /deviceManagement/managedDevices` mit `$select`.
 * Die Feldnamen sind die exakten Graph-Eigenschaftsnamen von `managedDevice` – so erkennt der
 * Präsentationsmodus Gerätenamen, Benutzer und Seriennummern ohne Sonderregel.
 *
 * **Vertrag – Änderungen bewusst und überall nachziehen** (Provider, Mapper, Regeln, Demo-Daten).
 */
import type { ComplianceState } from '../graph/dto';

/** Eine Zeile der Geräteliste: nur, was die Liste liefert (kein Nachladen je Gerät). */
export interface FleetDevice {
  id: string;
  deviceName: string;
  userPrincipalName: string | null;
  userDisplayName: string | null;
  operatingSystem: string | null;
  osVersion: string | null;
  model: string | null;
  manufacturer: string | null;
  serialNumber: string | null;
  complianceState: ComplianceState;
  /** null = von Graph nicht geliefert bzw. Datum ohne Aussage (Jahr 0001/9999) */
  lastSyncDateTime: string | null;
  enrolledDateTime: string | null;
  /** null = nicht geliefert */
  isEncrypted: boolean | null;
  /** Rohwert von Graph: `'True'`, `'False'` oder `'Unknown'`; null = nicht geliefert */
  jailBroken: string | null;
}

export interface FleetDevicesInfo {
  devices: FleetDevice[];
  /** true = Seitenlimit erreicht, die Liste ist unvollständig */
  truncated: boolean;
  pagesRead: number;
}
