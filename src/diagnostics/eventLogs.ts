/**
 * Gezielte Auswertung von Ereignisprotokollen (.evtx) aus dem DiagLogs-ZIP: nur
 * „DeviceManagement-Enterprise-Diagnostics-Provider/Admin“ und – falls vorhanden – „AAD/Operational“.
 * Alles andere bleibt unausgewertet (docs/diaglogs-format.md). Läuft im Analyse-Worker.
 *
 * Übernommen werden nur Kritisch/Fehler/Warnung im Zeitfenster vor dem ZIP-Zeitstempel; sensible
 * Werte (UPN, GUIDs/Tenant-IDs, Seriennummern, SIDs, ChannelURI) werden schon hier maskiert,
 * damit sie den Worker nie unmaskiert verlassen.
 */
import { maskId, maskUpn, maskUserPaths } from '../domain/format';
import { DEFAULT_MAX_EVTX_BYTES } from './limits';
import { EvtxFormatError, parseEvtx } from './parsers/evtx';
import { maskMac } from './parsers/ipconfig';
import type { DiagEntry, DiagEvent, DiagEventLog, DiagEventLogId } from './types';
import type { OpenedZip } from './zip/reader';

/** Höchstzahl übernommener Ereignisse je Protokoll (jüngste zuerst behalten) */
export const MAX_EVENTS_PER_LOG = 5000;
/** Höchstzahl dekodierter Datensätze je Protokoll */
export const MAX_RECORDS_PER_LOG = 20_000;
const MAX_FIELDS_PER_EVENT = 12;
const MAX_VALUE_LENGTH = 300;
const DAY_MS = 86_400_000;

const normalize = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Welches Ereignisprotokoll gehört zu diesem ZIP-Eintrag? (Namen sind flach/abgeschnitten → tolerant) */
export function eventLogIdFor(entry: DiagEntry): DiagEventLogId | null {
  if (entry.kind !== 'Events' || entry.isDirectory || entry.failedHresult) return null;
  if (!/\.evtx$/i.test(entry.path)) return null;
  const name = normalize(entry.name);
  // „Diagnostics-Provider“ (Protokollname) bzw. „Diagnostic-Provider“ (Ereignisanzeige) – beides zulassen
  if (/devicemanagemententerprisediagnostics?provider/.test(name) && name.includes('admin'))
    return 'mdmAdmin';
  if (/(^|[^a-z])aad/i.test(entry.name) && name.includes('operational')) return 'aadOperational';
  if (name.includes('microsoftwindowsaadoperational')) return 'aadOperational';
  return null;
}

export interface SelectedEventLog {
  id: DiagEventLogId;
  entry: DiagEntry;
}

/** Je Protokoll genau ein Eintrag (bei Mehrfachtreffern der größte). */
export function selectEventLogEntries(entries: DiagEntry[]): SelectedEventLog[] {
  const best = new Map<DiagEventLogId, DiagEntry>();
  for (const entry of entries) {
    const id = eventLogIdFor(entry);
    if (!id) continue;
    const known = best.get(id);
    if (!known || entry.uncompressedSize > known.uncompressedSize) best.set(id, entry);
  }
  const order: DiagEventLogId[] = ['mdmAdmin', 'aadOperational'];
  return order.flatMap((id) => {
    const entry = best.get(id);
    return entry ? [{ id, entry }] : [];
  });
}

// ---------------------------------------------------------------------------
// Maskierung
// ---------------------------------------------------------------------------

const UPN_RE = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const GUID_RE = /\{?\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b\}?/gi;
const SID_RE = /\bS-1-\d+(?:-\d+){3,}\b/g;
const URL_QUERY_RE = /(https?:\/\/[^\s"'<>?]+)\?[^\s"'<>]*/gi;
const SERIAL_INLINE_RE = /(serial(?:\s*number)?\s*[:=]\s*)([A-Za-z0-9-]{4,})/gi;
const CHANNEL_INLINE_RE = /(channeluri\s*[:=]\s*)\S+/gi;
const MAC_RE = /\b[0-9A-F]{2}(?:[-:][0-9A-F]{2}){5}\b/gi;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

/** Maskiert einen EventData-/UserData-Wert für die Anzeige (Regel: CLAUDE.md, Privatsphäre im ZIP-Modus). */
export function maskEventValue(key: string, raw: string): string {
  let value = raw.replace(CONTROL_RE, '').replace(/\s+/g, ' ').trim();
  if (/channeluri/i.test(key)) return value ? '…' : '';
  if (/serial/i.test(key)) return value ? (maskId(value) ?? '…') : '';
  value = value
    .replace(UPN_RE, (match) => maskUpn(match) ?? '…')
    .replace(GUID_RE, (match) => maskId(match.replace(/[{}]/g, '')) ?? '…')
    .replace(SID_RE, 'S-1-…')
    .replace(URL_QUERY_RE, '$1?…')
    .replace(SERIAL_INLINE_RE, (_m, lead: string, id: string) => `${lead}${maskId(id) ?? '…'}`)
    .replace(CHANNEL_INLINE_RE, '$1…')
    .replace(MAC_RE, (match) => maskMac(match));
  value = maskUserPaths(value);
  return value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value;
}

function maskData(data: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data).slice(0, MAX_FIELDS_PER_EVENT)) {
    const name = key.slice(0, 60);
    out[name] = maskEventValue(key, value);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Auswertung
// ---------------------------------------------------------------------------

export interface EventLogOptions {
  /** Referenzzeitpunkt (ZIP-Zeitstempel, ISO UTC); ohne Angabe gilt das jüngste Ereignis im Protokoll */
  referenceUtc: string | null;
  /** Fensterbreite in Tagen */
  windowDays: number;
}

export function emptyLog(sel: SelectedEventLog, status: DiagEventLog['status']): DiagEventLog {
  return {
    id: sel.id,
    entryName: sel.entry.name,
    entryPath: sel.entry.path,
    sizeBytes: sel.entry.uncompressedSize,
    status,
    windowStartUtc: null,
    windowEndUtc: null,
    scanned: 0,
    counts: { critical: 0, error: 0, warning: 0 },
    events: [],
    incomplete: false,
    skippedRecords: 0,
    capped: false,
  };
}

/** Dekodiert die Bytes eines Ereignisprotokolls zu einer Auswertung (reine Funktion). */
export function analyzeEventLog(
  bytes: Uint8Array,
  sel: SelectedEventLog,
  options: EventLogOptions,
): DiagEventLog {
  const referenceMs = options.referenceUtc ? Date.parse(options.referenceUtc) : NaN;
  const windowMs = options.windowDays * DAY_MS;
  const since = Number.isFinite(referenceMs) ? referenceMs - windowMs : undefined;

  // Zeit und Stufe aller dekodierten Ereignisse (für Zähler und das Fenster ohne Referenz)
  const times: number[] = [];
  const levels: number[] = [];
  let parsed;
  try {
    parsed = parseEvtx(bytes, {
      maxRecords: MAX_RECORDS_PER_LOG,
      maxEvents: MAX_EVENTS_PER_LOG,
      ...(since !== undefined ? { since } : {}),
      filter: (event) => {
        times.push(event.timeCreated ? Date.parse(event.timeCreated) : NaN);
        levels.push(event.level ?? 99);
        return event.level !== null && event.level >= 1 && event.level <= 3;
      },
    });
  } catch (error) {
    if (error instanceof EvtxFormatError) return emptyLog(sel, 'invalid');
    return emptyLog(sel, 'unreadable');
  }

  let newest = NaN;
  for (const ms of times) if (Number.isFinite(ms) && !(ms <= newest)) newest = ms;
  const endMs = Number.isFinite(referenceMs) ? referenceMs : newest;
  const startMs = Number.isFinite(endMs) ? endMs - windowMs : NaN;
  const inWindow = (ms: number): boolean => !Number.isFinite(startMs) || !(ms < startMs);

  const counts = { critical: 0, error: 0, warning: 0 };
  let scanned = 0;
  times.forEach((ms, i) => {
    if (!inWindow(ms)) return;
    scanned++;
    const level = levels[i];
    if (level === 1) counts.critical++;
    else if (level === 2) counts.error++;
    else if (level === 3) counts.warning++;
  });

  const events: DiagEvent[] = [];
  for (const event of parsed.events) {
    if (event.eventId === null || event.level === null) continue;
    if (!inWindow(event.timeCreated ? Date.parse(event.timeCreated) : NaN)) continue;
    events.push({
      recordId: event.recordId,
      eventId: event.eventId,
      level: event.level as 1 | 2 | 3,
      timeUtc: event.timeCreated,
      provider: event.provider,
      data: maskData(event.data),
    });
  }

  const { stats } = parsed;
  return {
    ...emptyLog(sel, 'ok'),
    windowStartUtc: Number.isFinite(startMs) ? new Date(startMs).toISOString() : null,
    windowEndUtc: Number.isFinite(endMs) ? new Date(endMs).toISOString() : null,
    scanned,
    counts,
    events,
    incomplete: stats.truncated || stats.chunksInvalid > 0 || stats.recordsFailed > 0,
    skippedRecords: stats.recordsFailed,
    capped: stats.capped || stats.timedOut,
  };
}

/** Liest das Protokoll aus dem ZIP (Größenlimit!) und wertet es aus. Fehler ergeben einen Status statt einer Ausnahme. */
export async function loadEventLog(
  zip: Pick<OpenedZip, 'readBytes'>,
  sel: SelectedEventLog,
  options: EventLogOptions & { maxBytes?: number },
): Promise<DiagEventLog> {
  const read = await zip.readBytes(sel.entry, options.maxBytes ?? DEFAULT_MAX_EVTX_BYTES);
  if (!read.ok) {
    return emptyLog(sel, read.reason === 'tooLarge' ? 'tooLarge' : 'unreadable');
  }
  return analyzeEventLog(read.bytes, sel, options);
}
