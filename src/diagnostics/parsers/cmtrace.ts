/**
 * Parser für CMTrace-Logs (IME-Logs). Einträge können mehrzeilig sein
 * (docs/diaglogs-format.md). Reine Funktion, regex-basiert.
 */
import { maskUpn } from '../../domain/format';
import type { CmTraceEntry } from '../types';

const ENTRY_RE =
  /<!\[LOG\[([\s\S]*?)\]LOG\]!><time="([^"]+)" date="([^"]+)" component="([^"]*)" context="([^"]*)" type="(\d)" thread="(\d+)" file="([^"]*)">/g;

const EMAIL_RE = /[^\s@,;<>"'()[\]]+@[^\s@,;<>"'()[\]]+\.[A-Za-z]{2,}/g;
const MAX_MESSAGE_LENGTH = 2000;

export interface CmTraceOptions {
  /** Nur Typ 2 (Warnung) und 3 (Fehler) zurückgeben */
  onlyIssues?: boolean;
  /**
   * Höchstzahl zurückgegebener Einträge. Bei Überschreitung bleiben die LETZTEN (jüngsten)
   * Einträge. Standard: unbegrenzt.
   */
  limit?: number;
}

/** "10-14-2026" + "12:50:11.1000001" → "2026-10-14T12:50:11.100" (lokale Zeit des Geräts, ohne Zone). */
function toTimestamp(date: string, time: string): string | null {
  const d = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?/.exec(time.trim());
  if (!d || !t) return null;
  const pad = (v: string | undefined, len = 2): string => (v ?? '').padStart(len, '0');
  const millis = (t[4] ?? '').padEnd(3, '0').slice(0, 3);
  return `${d[3]}-${pad(d[1])}-${pad(d[2])}T${pad(t[1])}:${t[2]}:${t[3]}.${millis}`;
}

/** UPNs in Lognachrichten maskieren und überlange Nachrichten kürzen. */
function cleanMessage(message: string): string {
  let text = message.replace(/\r\n/g, '\n').trim();
  if (text.length > MAX_MESSAGE_LENGTH) text = `${text.slice(0, MAX_MESSAGE_LENGTH)}…`;
  return text.replace(EMAIL_RE, (m) => maskUpn(m) ?? '…');
}

export function parseCmTrace(
  text: string,
  file: string,
  options: CmTraceOptions = {},
): CmTraceEntry[] {
  const entries: CmTraceEntry[] = [];
  for (const match of text.matchAll(ENTRY_RE)) {
    const [, message, time, date, component, , typeText, thread] = match;
    const type = Number(typeText);
    if (type !== 1 && type !== 2 && type !== 3) continue;
    if (options.onlyIssues && type === 1) continue;
    entries.push({
      file,
      message: cleanMessage(message ?? ''),
      component: component ?? '',
      type,
      timestamp: toTimestamp(date ?? '', time ?? ''),
      thread: thread === undefined ? null : Number(thread),
    });
  }
  const { limit } = options;
  return limit !== undefined && entries.length > limit ? entries.slice(-limit) : entries;
}
