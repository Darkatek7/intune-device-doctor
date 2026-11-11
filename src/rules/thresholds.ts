/** Schwellwerte der Regeln – zentral, damit sie leicht angepasst werden können. */
export const THRESHOLDS = {
  /** Check-in gilt bis zu dieser Zeit als aktuell, danach Warnung */
  checkInWarningDays: 7,
  /** Ab hier kritisch (entspricht der Standard-Gültigkeitsdauer des Compliance-Status) */
  checkInCriticalDays: 30,
  /** MDM-Gerätezertifikat bzw. Apple-Push-Zertifikat läuft innerhalb dieser Tage ab → Warnung */
  certificateWarningDays: 30,
  /** Apple-VPP-Token läuft innerhalb dieser Tage ab → Warnung (eigener Richtwert, keine Microsoft-Vorgabe) */
  vppTokenWarningDays: 30,
  /** Android-Sicherheitspatch älter als diese Tage → Warnung (eigener Richtwert, keine Microsoft-Vorgabe) */
  androidPatchWarningDays: 90,
  /** Unter diesem Anteil freien Speichers → Warnung */
  lowStorageRatio: 0.1,
  /** Supportende einer Windows-Version innerhalb dieser Tage → Warnung */
  osEndOfUpdatesWarningDays: 60,
  /** Windows LAPS: Kennwortsicherung älter als so viele Tage → Warnung (eigener Richtwert, keine Microsoft-Vorgabe) */
  lapsBackupWarningDays: 30,
  /** Windows LAPS: geplante Aktualisierung (refreshDateTime) länger als so viele Tage her → Hinweis (eigener Richtwert, keine Microsoft-Vorgabe) */
  lapsRefreshOverdueDays: 7,
  /** Ab hier wird die Entra-Anmeldung als alt hervorgehoben (nur Hinweis, keine Severity) */
  entraSignInStaleDays: 30,
  /** Ereignisprotokolle (DiagLogs-ZIP): Auswertungsfenster in Tagen vor dem ZIP-Zeitstempel – eigener Richtwert, keine Microsoft-Vorgabe */
  eventLogWindowDays: 14,
  /** Ab so vielen Fehlerereignissen (Kritisch/Fehler) im Fenster → Warnung – eigener Richtwert, keine Microsoft-Vorgabe */
  eventLogErrorWarningCount: 1,
  /** Höchstzahl der Ereignisgruppen, die als einzelne Befunde erscheinen */
  eventLogMaxFindings: 8,
  /** Mandant (M20/S1): ab diesem Anteil nicht konformer Geräte → Warnung (eigener Richtwert, keine Microsoft-Vorgabe) */
  tenantNonCompliantShareWarning: 0.1,
  /** Mandant (M20/S1): so viele Einstellungen zeigt „Häufigste Verstöße“ höchstens */
  tenantTopViolations: 10,
  /** Änderungsprotokoll (M20/S2): Zeitfenster der Ansicht „Mandant“ in Tagen */
  auditWindowDays: 7,
  /** Änderungsprotokoll (M20/S2): Änderung höchstens so viele Tage vor einem gemeldeten Fehler → ruhiger Hinweis (eigener Richtwert) */
  auditChangeBeforeErrorDays: 7,
  /** App-Schutz (M20/S3): letzte Synchronisierung älter als so viele Tage → Warnung (eigener Richtwert, keine Microsoft-Vorgabe) */
  appProtectionSyncWarningDays: 30,
  /** Remote-Aktionen (M20/S4): fehlgeschlagene Aktionen höchstens so viele Tage zurück als Befund (eigener Richtwert) */
  remoteActionRecentDays: 30,
} as const;
