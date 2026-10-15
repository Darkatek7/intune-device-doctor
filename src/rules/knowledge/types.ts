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
}
