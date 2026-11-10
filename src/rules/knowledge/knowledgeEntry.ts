import { hexToSignedDecimal, normalizeHex } from '../../domain/format';
import type { KnowledgeEntry } from './types';

/**
 * Wissensbasis-Eintrag aus der Hex-Form bauen. Die signierte Dezimalform wird berechnet statt
 * abgeschrieben – Microsoft-Seiten enthalten vereinzelt falsche Dezimalwerte.
 */
export function knowledgeEntry(
  hex: string,
  data: Omit<KnowledgeEntry, 'hex' | 'decimal'>,
): KnowledgeEntry {
  const normalized = normalizeHex(hex);
  const decimal = hexToSignedDecimal(hex);
  if (normalized === null || decimal === null) throw new Error(`Ungültiger Hex-Code: ${hex}`);
  return { hex: normalized, decimal, ...data };
}
