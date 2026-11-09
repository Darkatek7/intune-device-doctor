/** Schwellwerte der Regeln – zentral, damit sie leicht angepasst werden können. */
export const THRESHOLDS = {
  /** Check-in gilt bis zu dieser Zeit als aktuell, danach Warnung */
  checkInWarningDays: 7,
  /** Ab hier kritisch (entspricht der Standard-Gültigkeitsdauer des Compliance-Status) */
  checkInCriticalDays: 30,
  /** MDM-Gerätezertifikat bzw. Apple-Push-Zertifikat läuft innerhalb dieser Tage ab → Warnung */
  certificateWarningDays: 30,
  /** Android-Sicherheitspatch älter als diese Tage → Warnung (eigener Richtwert, keine Microsoft-Vorgabe) */
  androidPatchWarningDays: 90,
  /** Unter diesem Anteil freien Speichers → Warnung */
  lowStorageRatio: 0.1,
  /** Supportende einer Windows-Version innerhalb dieser Tage → Warnung */
  osEndOfUpdatesWarningDays: 60,
  /** Windows LAPS: Kennwortsicherung älter als so viele Tage → Warnung (eigener Richtwert, keine Microsoft-Vorgabe) */
  lapsBackupWarningDays: 30,
  /** Windows LAPS: geplante Aktualisierung (refreshDateTime) länger als so viele Tage her → Hinweis */
  lapsRefreshOverdueDays: 7,
  /** Ab hier wird die Entra-Anmeldung als alt hervorgehoben (nur Hinweis, keine Severity) */
  entraSignInStaleDays: 30,
} as const;
