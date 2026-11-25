/**
 * ISO-8601-Dauern aus Graph (Typ `Duration`, z. B. `PT30M`, `P90D`, `PT10080M`, `P1DT12H`).
 * Unterstützt Wochen, Tage, Stunden, Minuten und Sekunden; Jahre und Monate sind nicht eindeutig in
 * Minuten umrechenbar und ergeben null (→ Prüfung „nicht prüfbar“, nie geraten).
 */
import { dePosture } from '../../i18n/de-posture';

const PATTERN =
  /^P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/** Dauer in Minuten; null bei leerem, ungültigem oder nicht eindeutig umrechenbarem Wert. */
export function parseIsoDurationMinutes(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().toUpperCase();
  if (text === '' || text === 'P' || text.endsWith('T')) return null;
  const match = PATTERN.exec(text);
  if (!match) return null;
  const [, weeks, days, hours, minutes, seconds] = match;
  if ([weeks, days, hours, minutes, seconds].every((part) => part === undefined)) return null;
  const n = (part: string | undefined) => (part === undefined ? 0 : Number(part));
  return n(weeks) * 7 * 24 * 60 + n(days) * 24 * 60 + n(hours) * 60 + n(minutes) + n(seconds) / 60;
}

/** „30 Minuten“, „12 Stunden“, „90 Tage“ – größte Einheit, die ohne Rest aufgeht. */
export function formatDurationMinutes(minutes: number): string {
  const v = dePosture.values;
  if (minutes > 0 && minutes % (24 * 60) === 0) return v.days(minutes / (24 * 60));
  if (minutes > 0 && minutes % 60 === 0) return v.hours(minutes / 60);
  return v.minutes(Math.round(minutes * 100) / 100);
}
