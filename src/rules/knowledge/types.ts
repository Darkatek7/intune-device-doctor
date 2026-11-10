/**
 * Kontext, in dem ein Code auftritt. Codes aus dem Win32-Bereich (0x8007xxxx) und generische
 * COM-Codes (z. B. 0x8000FFFF) haben je nach Komponente eine andere Bedeutung – z. B. ist 0x800705B4
 * allgemein ERROR_TIMEOUT, in der Autopilot-Registrierung aber laut Microsoft ein Hinweis auf fehlendes
 * TPM 2.0. Solche Einträge gelten nur im passenden Kontext.
 */
export type ErrorCodeContext = 'enrollment' | 'app';

/** Gemeinsame Form aller Wissensbasis-Einträge. Ohne Microsoft-Learn-Quelle kein Eintrag. */
export interface KnowledgeEntry {
  /** Normalisierte Hex-Form, z. B. "0x87D1FDE8" */
  hex: string;
  /** Signierte Dezimalform, wie Intune/Graph sie meldet */
  decimal: number;
  title: string;
  cause: string;
  remediation: string[];
  /** Pflicht: offizielle Microsoft-Learn-Seite */
  docsUrl: string;
  /**
   * Nur in diesem Kontext deuten (für mehrdeutige Win32-/COM-Codes). Fehlt das Feld, ist der Code
   * eindeutig (eigene Facility, z. B. 0x8018xxxx, 0x87D1xxxx) und wird überall gedeutet.
   */
  context?: ErrorCodeContext;
}
