/** Schwellwerte der Regeln – zentral, damit sie leicht angepasst werden können. */
export const THRESHOLDS = {
  /** Check-in gilt bis zu dieser Zeit als aktuell */
  checkInOkHours: 24,
  /** Bis zu dieser Zeit nur Warnung, danach kritisch */
  checkInWarningDays: 7,
  /** Unter diesem Anteil freien Speichers → Warnung */
  lowStorageRatio: 0.1,
  /** Supportende einer Windows-Version innerhalb dieser Tage → Warnung */
  osEndOfUpdatesWarningDays: 60,
  /** Ab hier wird die Entra-Anmeldung als alt hervorgehoben (nur Hinweis, keine Severity) */
  entraSignInStaleDays: 30,
} as const;
