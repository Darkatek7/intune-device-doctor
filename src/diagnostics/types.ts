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
  /**
   * App-Namen zu Win32-App-IDs (Schlüssel: ID in Kleinschreibung). Stammt nicht aus dem ZIP, sondern
   * wird nach der Analyse über den aktiven Provider (Graph bzw. Mock-Katalog) nachgeladen.
   */
  resolvedApps?: Record<string, AppInfo>;
  /** Hinweise zur Analyse selbst (übersprungene Binärdateien, unbekanntes Encoding …) */
  analysisNotes: string[];
}
