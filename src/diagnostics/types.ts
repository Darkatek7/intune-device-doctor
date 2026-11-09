/**
 * Ergebnis der clientseitigen Analyse eines Intune-"Collect diagnostics"-ZIPs
 * (DiagLogs-<Gerät>-<UTC-Zeitstempel>.zip). Format: docs/diaglogs-format.md.
 * Das ZIP verlässt den Browser nie.
 */
import type { AppInfo } from '../domain/types';

export type DiagEntryKind = 'RegistryKey' | 'Command' | 'Events' | 'FoldersFiles' | 'results';

export interface DiagEntry {
  /** Originaler Pfad im ZIP */
  path: string;
  /** (N)-Präfix – NICHT stabil zwischen Archiven */
  index: number | null;
  kind: DiagEntryKind;
  /** Name ohne Präfix/Suffix, z. B. "windir_system32_Dsregcmd_exe_status" */
  name: string;
  /** Bei "No Results - Error [0x…]"-Einträgen */
  failedHresult: string | null;
  uncompressedSize: number;
  isDirectory: boolean;
}

export interface CollectionFailure {
  kind: Exclude<DiagEntryKind, 'results'>;
  /** Quellpfad aus results.xml bzw. Eintragsname */
  target: string;
  hresult: string;
  /** Kurzdeutung, falls bekannt (z. B. "Pfad nicht gefunden") */
  meaning?: string;
}

export interface DsregField {
  key: string;
  value: string;
}

export interface DsregSection {
  name: string;
  fields: DsregField[];
  /** Verschachtelte Blöcke wie AcquirePrtDiagnostics / RefreshPrtDiagnostics */
  blocks: Array<{ name: string; fields: DsregField[] }>;
}

export interface DsregStatus {
  sections: DsregSection[];
  /** Bequemer Zugriff auf häufig genutzte Felder (Wert wie in der Ausgabe, z. B. "YES") */
  azureAdJoined?: string;
  domainJoined?: string;
  deviceAuthStatus?: string;
  tpmProtected?: string;
  azureAdPrt?: string;
  wamDefaultSet?: string;
  prtAttemptStatus?: string;
  prtHttpError?: string;
}

export interface CmTraceEntry {
  file: string;
  message: string;
  component: string;
  /** 1 = Info, 2 = Warnung, 3 = Fehler (3 markiert auch manche Infos – nur als Hinweis werten) */
  type: 1 | 2 | 3;
  timestamp: string | null;
  thread: number | null;
}

export interface EnrollmentInfo {
  enrollmentId: string;
  providerId: string | null;
  enrollmentState: number | null;
  enrollmentType: number | null;
  /** UPN wird nur maskiert gespeichert */
  upnMasked: string | null;
}

export interface Win32AppState {
  appId: string;
  /** z. B. Installed, Failed, NotApplicable, InstalledPendingReboot */
  status: string | null;
  /** Signiertes HRESULT als Hex (0x80070642) */
  errorCodeHex: string | null;
  errorCodeDecimal: number | null;
}

/** Zertifikat aus `certutil -store` (Antragsteller/Seriennummer bereits maskiert). */
export interface CertificateInfo {
  /** Kopfzeile der Ausgabe, z. B. `My "Personal"` (lokalisiert) */
  store: string | null;
  /** Aussteller (GUIDs/E-Mail-Adressen maskiert) */
  issuer: string | null;
  subjectMasked: string | null;
  serialMasked: string | null;
  /** ISO-Zeitstempel; certutil gibt lokale Zeit ohne Zone aus, sie wird hier wie UTC behandelt */
  notBefore: string | null;
  notAfter: string | null;
  /** Ablaufdatum unverändert aus der Ausgabe (falls nicht lesbar: nur dieser Wert) */
  notAfterRaw: string | null;
}

/** Adapter aus `ipconfig /all` – reine Rohdaten, MAC-Adresse maskiert. */
export interface NetworkAdapterInfo {
  /** Kopfzeile ohne Doppelpunkt, z. B. "Ethernet-Adapter Ethernet" */
  name: string;
  description: string | null;
  macMasked: string | null;
  dhcpEnabled: boolean | null;
  mediaDisconnected: boolean;
  ipv4: string[];
  dnsServers: string[];
  dnsSuffix: string | null;
}

export interface NetworkInfo {
  primaryDnsSuffix: string | null;
  dnsSuffixSearchList: string[];
  adapters: NetworkAdapterInfo[];
}

/** Ausgewertete Ereignisprotokolle (.evtx). */
export type DiagEventLogId = 'mdmAdmin' | 'aadOperational';

export interface DiagEvent {
  recordId: number;
  eventId: number;
  /** 1 = Kritisch, 2 = Fehler, 3 = Warnung (Information/Ausführlich werden nicht übernommen) */
  level: 1 | 2 | 3;
  timeUtc: string | null;
  provider: string | null;
  /** EventData bzw. UserData (Name → Wert); Werte sind maskiert (UPN, GUID, Seriennummer …) und gekürzt */
  data: Record<string, string>;
}

export interface DiagEventLog {
  id: DiagEventLogId;
  /** Eintragsname im ZIP (ohne Präfix/Suffix) */
  entryName: string;
  entryPath: string;
  sizeBytes: number;
  /** ok = ausgewertet; sonst Grund: zu groß, nicht lesbar oder keine gültige EVTX-Datei */
  status: 'ok' | 'tooLarge' | 'unreadable' | 'invalid';
  /** Zeitfenster der Auswertung (ISO, UTC) – Ende = ZIP-Zeitstempel bzw. jüngstes Ereignis */
  windowStartUtc: string | null;
  windowEndUtc: string | null;
  /** Im Fenster dekodierte Ereignisse aller Stufen */
  scanned: number;
  counts: { critical: number; error: number; warning: number };
  /** Kritisch/Fehler/Warnung im Fenster, aufsteigend nach RecordID (begrenzt) */
  events: DiagEvent[];
  /** Datei gekappt bzw. Chunks/Datensätze nicht lesbar */
  incomplete: boolean;
  skippedRecords: number;
  /** Mengen- oder Zeitbegrenzung erreicht – ältere Ereignisse im Fenster fehlen */
  capped: boolean;
}

/** Abschnitt in MDMDiagReport.xml: gleichnamige direkte Kindelemente der Wurzel (Rohdaten, Aufbau nicht dokumentiert). */
export interface MdmDiagSection {
  name: string;
  /** Anzahl gleichnamiger direkter Kindelemente des Wurzelelements */
  count: number;
  /** Namen der Kindelemente (ohne Duplikate, begrenzt) */
  childNames: string[];
}

/**
 * Auswertung von MDMDiagReport.xml. Belegt (Microsoft Learn) ist nur der Knoten `Multivariant` mit
 * `Condition`; der übrige Aufbau wird als Rohdaten (Elementnamen, Anzahl) wiedergegeben – ohne Werte.
 */
export interface MdmDiagReportSummary {
  rootElement: string;
  elementCount: number;
  /** Elementgrenze erreicht – der Rest des Dokuments wurde nicht gelesen */
  truncated: boolean;
  sections: MdmDiagSection[];
  sectionsTruncated: boolean;
  /** `Condition`-Werte aller `//Multivariant`-Knoten (roh, maskiert, begrenzt) */
  multivariant: string[];
  multivariantTotal: number;
}

/** Zustand eines Pakets im MDM-Diagnosepaket (`mdmlogs-*.cab`). */
export type MdmDiagMemberStatus =
  'ok' | 'missing' | 'tooLarge' | 'unreadable' | 'unsupported' | 'invalid';

export interface MdmDiagMember {
  /** Dateiname im Cabinet (maskiert, gekürzt) */
  name: string;
  sizeBytes: number;
}

export type MdmDiagUnsupportedReason = 'lzx' | 'quantum' | 'unknown' | 'multiVolume';

/** Ausgewertetes MDM-Diagnosepaket `mdmlogs-*.cab` aus dem ZIP (Cabinet-Format, siehe docs/diaglogs-format.md). */
export interface MdmDiagPackage {
  entryPath: string;
  entryName: string;
  sizeBytes: number;
  /** ok = Cabinet gelesen; sonst Grund: zu groß, nicht lesbar oder kein gültiges Cabinet */
  status: 'ok' | 'tooLarge' | 'unreadable' | 'invalid';
  /** Cabinet kürzer als im Kopf angegeben bzw. Dateiliste unvollständig */
  truncated: boolean;
  /** Verfahren, das nicht entpackt werden kann (LZX, Quantum, mehrteilig …); sonst null */
  unsupportedReason: MdmDiagUnsupportedReason | null;
  /** Anzahl Dateien laut Dateiliste */
  fileCount: number;
  /** Dateiliste (begrenzt) */
  files: MdmDiagMember[];
  /** Status von MDMDiagReport.xml und Auswertung */
  reportStatus: MdmDiagMemberStatus;
  report: MdmDiagReportSummary | null;
  /** MdmDiagLogMetadata.json (laut Learn: Kommandozeilenargumente des Tools) als Schlüssel/Wert-Rohdaten, maskiert */
  metadataStatus: MdmDiagMemberStatus;
  metadata: Array<{ key: string; value: string }>;
  /** Das MDM-Admin-Ereignisprotokoll in `eventLogs` stammt aus diesem Paket (nicht direkt aus dem ZIP) */
  adminLogFromPackage: boolean;
}

export interface DiagnosticsReport {
  fileName: string;
  /** Aus dem Dateinamen DiagLogs-<NAME>-<Zeitstempel>.zip */
  deviceNameFromFile: string | null;
  collectedAtUtc: string | null;
  entryCount: number;
  totalUncompressedBytes: number;
  entries: DiagEntry[];
  collectionFailures: CollectionFailure[];
  dsregcmd: DsregStatus | null;
  enrollments: EnrollmentInfo[];
  win32Apps: Win32AppState[];
  /** Ausgewählte Fehler-/Warnzeilen aus IME-Logs (begrenzt) */
  imeIssues: CmTraceEntry[];
  /** Zertifikate aus certutil-Ausgaben (OEM-Codepage); leer, wenn keine Ausgabe im Archiv */
  certificates: CertificateInfo[];
  /** Ausgabe von `ipconfig /all` (OEM-Codepage); null, wenn nicht im Archiv */
  network: NetworkInfo | null;
  /** Gezielt ausgewertete Ereignisprotokolle (MDM-Admin, optional Entra/AAD Operational) */
  eventLogs: DiagEventLog[];
  /** MDM-Diagnosepaket `mdmlogs-*.cab` (MDMDiagReport.xml u. a.); fehlt, wenn das ZIP keines enthält */
  mdmDiag?: MdmDiagPackage;
  /**
   * App-Namen zu Win32-App-IDs (Schlüssel: ID in Kleinschreibung). Stammt nicht aus dem ZIP, sondern
   * wird nach der Analyse über den aktiven Provider (Graph bzw. Mock-Katalog) nachgeladen.
   */
  resolvedApps?: Record<string, AppInfo>;
  /** Hinweise zur Analyse selbst (übersprungene Binärdateien, unbekanntes Encoding …) */
  analysisNotes: string[];
}
