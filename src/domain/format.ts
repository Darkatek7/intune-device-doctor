/**
 * Formatierungs-Hilfen (deutsch). Reine Funktionen – "now" wird immer übergeben, damit Tests
 * deterministisch sind.
 */
import type { OsFamily } from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const relative = new Intl.RelativeTimeFormat('de', { numeric: 'auto', style: 'short' });

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "vor 3 Std.", "gestern", "vor 41 Tagen". Ungültige/fehlende Werte → "–". */
export function formatRelativeTime(iso: string | null | undefined, now: Date): string {
  const date = parse(iso);
  if (!date) return '–';
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  if (abs < MINUTE) return relative.format(0, 'second');
  if (abs < HOUR) return relative.format(Math.round(diff / MINUTE), 'minute');
  if (abs < DAY) return relative.format(Math.round(diff / HOUR), 'hour');
  if (abs < 60 * DAY) return relative.format(Math.round(diff / DAY), 'day');
  if (abs < 365 * DAY) return relative.format(Math.round(diff / (30 * DAY)), 'month');
  return relative.format(Math.round(diff / (365 * DAY)), 'year');
}

/** Absolutes Datum "15.10.2026, 09:10". */
export function formatDateTime(iso: string | null | undefined, timeZone?: string): string {
  const date = parse(iso);
  if (!date) return '–';
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

/** Nur Datum "15.10.2026". */
export function formatDate(iso: string | null | undefined, timeZone?: string): string {
  const date = parse(iso);
  if (!date) return '–';
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

/** Ganze Tage zwischen iso und now (abgerundet), null bei ungültigem Datum. */
export function daysSince(iso: string | null | undefined, now: Date): number | null {
  const date = parse(iso);
  if (!date) return null;
  return Math.floor((now.getTime() - date.getTime()) / DAY);
}

/** Stunden zwischen iso und now (mit Nachkommastellen), null bei ungültigem Datum. */
export function hoursSince(iso: string | null | undefined, now: Date): number | null {
  const date = parse(iso);
  if (!date) return null;
  return (now.getTime() - date.getTime()) / HOUR;
}

const number1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Binäre Einheiten (wie Windows-Explorer), z. B. "237,5 GB". */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '–';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${number1.format(value)} ${BYTE_UNITS[unit]}`;
}

/** Prozent mit max. einer Nachkommastelle, z. B. "7,4 %". */
export function formatPercent(ratio: number): string {
  return `${number1.format(ratio * 100)} %`;
}

/** managedDevice.operatingSystem → OsFamily (Graph liefert z. B. "Windows", "macOS", "iOS", "Android"). */
export function osFamilyFrom(operatingSystem: string | null | undefined): OsFamily {
  const os = (operatingSystem ?? '').trim().toLowerCase();
  if (!os) return 'other';
  if (os.startsWith('windows')) return 'windows';
  if (os.startsWith('mac')) return 'macos';
  if (os === 'ios' || os === 'ipados' || os.startsWith('iphone') || os.startsWith('ipad'))
    return 'ios';
  if (os.startsWith('android')) return 'android';
  if (os.startsWith('linux') || os === 'ubuntu') return 'linux';
  return 'other';
}

/** "max.mustermann@contoso.com" → "ma…@contoso.com". Ohne "@": nur die ersten 2 Zeichen. */
export function maskUpn(upn: string | null | undefined): string | null {
  if (!upn) return null;
  const at = upn.indexOf('@');
  if (at < 0) return `${upn.slice(0, 2)}…`;
  return `${upn.slice(0, Math.min(2, at))}…${upn.slice(at)}`;
}

const USER_PATH_RE = /(^|[\\/_\s])(Users[\\/_])([^\\/_\s]+)/gi;
const PUBLIC_PROFILES = new Set(['public', 'default', 'all users', 'default user']);

/** Benutzernamen in Pfaden maskieren: "C:\Users\max\…" bzw. "Users_max_…" → "Users\…". */
export function maskUserPaths(text: string): string {
  return text.replace(USER_PATH_RE, (match, lead: string, users: string, name: string) =>
    PUBLIC_PROFILES.has(name.toLowerCase()) ? match : `${lead}${users}…`,
  );
}

/** GUID o. ä. maskieren: "1234abcd-…-…" → "1234…cdef". */
export function maskId(id: string | null | undefined): string | null {
  if (!id) return null;
  if (id.length <= 8) return '…';
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/**
 * Signierte Dezimal-HRESULT (z. B. aus Graph errorCode oder Registry) → "0x80070642".
 * Positive Werte werden ebenfalls als 32-Bit-Hex ausgegeben.
 */
export function hresultToHex(value: number): string {
  return `0x${(value >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

/** "0x80070642" (beliebige Schreibweise) → normalisierte Hex-Form, sonst null. */
export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^0x([0-9a-f]{1,8})$/i.exec(value.trim());
  if (!match?.[1]) return null;
  return `0x${match[1].toUpperCase().padStart(8, '0')}`;
}

/** Hex-HRESULT → signierte Dezimalzahl (Gegenstück zu hresultToHex). */
export function hexToSignedDecimal(hex: string): number | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return parseInt(normalized.slice(2), 16) | 0;
}
