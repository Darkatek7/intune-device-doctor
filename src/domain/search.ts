/**
 * Suche per Seriennummer (M15): Graph dokumentiert für `serialNumber` keinen `$filter` (weder v1.0
 * noch Beta), deshalb wird clientseitig über die dokumentierte Geräteliste verglichen.
 */

/** Seriennummer für den Vergleich: ohne Leerzeichen, Groß-/Kleinschreibung egal. */
export function normalizeSerialNumber(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Exakter Vergleich (nach Normalisierung). Bewusst kein Teilstring: Seriennummern werden vom
 * Typenschild abgelesen, ein Teiltreffer wäre eher ein falsches Gerät.
 */
export function matchesSerialNumber(
  serialNumber: string | null | undefined,
  query: string,
): boolean {
  const needle = normalizeSerialNumber(query);
  return needle.length > 0 && normalizeSerialNumber(serialNumber) === needle;
}
