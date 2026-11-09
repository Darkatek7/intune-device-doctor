/**
 * Kachel „MDM-Ereignisse“ aus einem DiagLogs-ZIP: Kritisch/Fehler/Warnung der Ereignisprotokolle
 * „DeviceManagement-Enterprise-Diagnostics-Provider/Admin“ (und – falls vorhanden – „AAD/Operational“)
 * im Zeitfenster vor dem ZIP-Zeitstempel, gruppiert nach Ereignis-ID.
 *
 * Event-IDs werden nur gedeutet, wenn eine Microsoft-Learn-Quelle sie belegt (knowledge/events.ts);
 * HRESULTs in den Ereignisdaten laufen über die vorhandene Wissensbasis (explainCode), unbekannte Codes
 * erscheinen als „Unbekannter Code“ mit Hex/Dezimal. Der Schwellwert „Fehler → Warnung“ ist ein eigener
 * Richtwert (rules/thresholds.ts), keine Microsoft-Aussage.
 */
import { DEFAULT_MAX_EVTX_BYTES } from '../../diagnostics/limits';
import type {
  DiagEntry,
  DiagEvent,
  DiagEventLog,
  DiagEventLogId,
  DiagnosticsReport,
} from '../../diagnostics/types';
import { formatDate, formatDateTime, maskUserPaths } from '../../domain/format';
import type { DataSource, Finding, Severity, Tile, TileFact } from '../../domain/types';
import { de } from '../../i18n/de';
import { sortFindings, worstActionable } from '../helpers';
import { Docs } from '../knowledge/docs';
import { findEventKnowledge } from '../knowledge/events';
import { explainCode } from '../knowledge/win32';
import { THRESHOLDS } from '../thresholds';

const m = de.rules.zip.mdmEvents;
const z = de.rules.zip;

const LOG_ORDER: DiagEventLogId[] = ['mdmAdmin', 'aadOperational'];
const HEX_CODE_RE = /0x[0-9a-f]{8}/gi;
const CODE_FIELD_RE = /result|error|status|hresult|code/i;
const MAX_SAMPLE_FIELDS = 3;
const MAX_EVIDENCE_FIELDS = 8;

const utc = (iso: string | null): string => (iso ? `${formatDateTime(iso, 'UTC')} UTC` : '–');

function zipSource(entry: DiagEntry | undefined, fallback: string): DataSource {
  return { kind: 'zip', label: `${z.sourcePrefix} · ${maskUserPaths(entry?.path ?? fallback)}` };
}

// ---------------------------------------------------------------------------
// HRESULTs in den Ereignisdaten
// ---------------------------------------------------------------------------

function codesOf(data: Record<string, string>): Array<string | number> {
  const found: Array<string | number> = [];
  const seen = new Set<string>();
  const add = (code: string | number): void => {
    const hex = explainCode(code).hex;
    if (seen.has(hex) || found.length >= 2) return;
    seen.add(hex);
    found.push(code);
  };
  for (const value of Object.values(data))
    for (const match of value.matchAll(HEX_CODE_RE)) add(match[0]);
  for (const [key, value] of Object.entries(data))
    if (CODE_FIELD_RE.test(key) && /^-?\d{5,10}$/.test(value.trim())) add(Number(value.trim()));
  return found;
}

/** Deutung nur über die Wissensbasis; sonst „Unbekannter Code“ + Hex/Dezimal. */
function codeText(code: string | number): string {
  const ex = explainCode(code);
  if (ex.name && ex.text) return m.codeKnown(ex.hex, ex.name, ex.text);
  if (ex.kind === 'win32' && ex.baseCode !== null)
    return de.rules.policies.codeWin32(ex.hex, ex.baseCode, ex.name);
  return de.rules.policies.codeUnknown(ex.hex, ex.decimal);
}

// ---------------------------------------------------------------------------
// Gruppen
// ---------------------------------------------------------------------------

interface Group {
  log: DiagEventLog;
  eventId: number;
  /** Schlimmste Stufe in der Gruppe (1 = Kritisch) */
  level: 1 | 2 | 3;
  count: number;
  lastUtc: string | null;
  latest: DiagEvent;
}

function groupEvents(log: DiagEventLog): Group[] {
  const groups = new Map<number, Group>();
  for (const event of log.events) {
    const known = groups.get(event.eventId);
    if (!known) {
      groups.set(event.eventId, {
        log,
        eventId: event.eventId,
        level: event.level,
        count: 1,
        lastUtc: event.timeUtc,
        latest: event,
      });
      continue;
    }
    known.count++;
    known.level = Math.min(known.level, event.level) as 1 | 2 | 3;
    // RecordIDs steigen mit der Zeit – das spätere Ereignis liefert die Beispieldaten
    if (event.recordId >= known.latest.recordId) {
      known.latest = event;
      known.lastUtc = event.timeUtc ?? known.lastUtc;
    }
  }
  return [...groups.values()];
}

const isError = (group: Group): boolean => group.level <= 2;

function compareGroups(a: Group, b: Group): number {
  return (
    Number(isError(b)) - Number(isError(a)) ||
    b.count - a.count ||
    (b.lastUtc ?? '').localeCompare(a.lastUtc ?? '')
  );
}

function groupFinding(group: Group, entry: DiagEntry | undefined, errorsFlagged: boolean): Finding {
  const known = findEventKnowledge(group.log.id, group.eventId);
  const level = m.levelLabel[group.level] ?? String(group.level);
  const logLabel = m.logLabel[group.log.id] ?? group.log.id;
  const fields = Object.entries(group.latest.data);
  const sample = fields
    .filter(([, value]) => value !== '')
    .slice(0, MAX_SAMPLE_FIELDS)
    .map(([name, value]) => m.sampleField(name, value))
    .join(' · ');
  const codes = codesOf(group.latest.data);
  const firstCode = codes[0];
  const codeDocsUrl = firstCode === undefined ? null : explainCode(firstCode).docsUrl;
  const severity: Severity = isError(group) && errorsFlagged ? 'warning' : 'unknown';

  return {
    id: `mdmEvents-${group.log.id}-${group.eventId}`,
    severity,
    title: m.groupTitle(group.eventId, level, group.count, known?.title ?? null),
    detail: m.groupDetail(
      group.count,
      level,
      logLabel,
      utc(group.lastUtc),
      sample || null,
      codes.map(codeText),
    ),
    cause: known?.cause ?? (isError(group) ? m.unknownEventCause : m.warningCause),
    remediation: [...(known?.remediation ?? m.genericRemediation)],
    evidence: {
      log: logLabel,
      eventId: group.eventId,
      level,
      count: group.count,
      lastUtc: group.lastUtc,
      ...Object.fromEntries(
        fields.slice(0, MAX_EVIDENCE_FIELDS).map(([name, value]) => [`Data.${name}`, value]),
      ),
    },
    source: zipSource(entry, group.log.entryName),
    docsUrl: known?.docsUrl ?? codeDocsUrl ?? Docs.mdmCollectLogs,
  };
}

// ---------------------------------------------------------------------------
// Kachel
// ---------------------------------------------------------------------------

function reasonFor(log: DiagEventLog | undefined): { key: string; text: string } {
  if (!log) return { key: 'missing', text: m.reasons.missing };
  const label = m.logLabel[log.id] ?? log.id;
  switch (log.status) {
    case 'tooLarge':
      return {
        key: 'tooLarge',
        text: m.reasons.tooLarge(
          label,
          Math.ceil(log.sizeBytes / 1048576),
          Math.round(DEFAULT_MAX_EVTX_BYTES / 1048576),
        ),
      };
    case 'invalid':
      return { key: 'invalid', text: m.reasons.invalid(label) };
    default:
      return { key: 'unreadable', text: m.reasons.unreadable(label) };
  }
}

function unavailableFinding(log: DiagEventLog | undefined, entry: DiagEntry | undefined): Finding {
  const reason = reasonFor(log);
  return {
    id: `mdmEvents-unavailable-${log?.id ?? 'mdmAdmin'}`,
    severity: 'unknown',
    title: m.unavailableTitle,
    detail: reason.text,
    cause: m.unavailableCause[reason.key] ?? m.unavailableCause['unreadable'] ?? '',
    remediation: [...m.unavailableRemediation],
    source: zipSource(entry, log?.entryName ?? 'Events'),
    docsUrl: Docs.mdmCollectLogs,
  };
}

export function mdmEventsTile(report: DiagnosticsReport): Tile {
  const logs = report.eventLogs ?? [];
  const byId = (id: DiagEventLogId): DiagEventLog | undefined => logs.find((l) => l.id === id);
  const entryOf = (log: DiagEventLog | undefined): DiagEntry | undefined =>
    log ? report.entries.find((e) => e.path === log.entryPath) : undefined;
  const mdm = byId('mdmAdmin');
  const mdmOk = mdm?.status === 'ok';
  const days = THRESHOLDS.eventLogWindowDays;

  const findings: Finding[] = [];
  const sources: DataSource[] = [];
  const facts: TileFact[] = [];
  let errors = 0;
  let warnings = 0;
  let scanned = 0;
  let groupCount = 0;

  // Fehler zählen vorab, damit die Schwelle für alle Gruppen gleich gilt
  const okLogs = LOG_ORDER.map(byId).filter((l): l is DiagEventLog => l?.status === 'ok');
  for (const log of okLogs) {
    for (const event of log.events) {
      if (event.level <= 2) errors++;
      else warnings++;
    }
    scanned += log.scanned;
  }
  const errorsFlagged = errors >= THRESHOLDS.eventLogErrorWarningCount;

  for (const id of LOG_ORDER) {
    const log = byId(id);
    const entry = entryOf(log);
    if (!log) {
      if (id === 'mdmAdmin') findings.push(unavailableFinding(undefined, undefined));
      continue;
    }
    sources.push(zipSource(entry, log.entryName));
    if (log.status !== 'ok') {
      findings.push(unavailableFinding(log, entry));
      continue;
    }
    const groups = groupEvents(log).sort(compareGroups);
    groupCount += groups.length;
    const shown = groups.slice(0, THRESHOLDS.eventLogMaxFindings);
    for (const group of shown) findings.push(groupFinding(group, entry, errorsFlagged));
    const rest = groups.slice(shown.length);
    if (rest.length > 0) {
      findings.push({
        id: `mdmEvents-more-${id}`,
        severity: 'unknown',
        title: m.moreTitle(rest.length),
        detail: m.moreDetail(
          rest
            .map((g) => `${g.eventId} (${m.levelLabel[g.level] ?? g.level}, ${g.count}×)`)
            .join(', '),
        ),
        cause: m.moreCause,
        remediation: [...m.moreRemediation],
        source: zipSource(entry, log.entryName),
        docsUrl: Docs.mdmCollectLogs,
      });
    }
    if (log.incomplete || log.capped) {
      findings.push({
        id: `mdmEvents-incomplete-${id}`,
        severity: 'unknown',
        title: m.incompleteTitle,
        detail: m.incompleteDetail(m.logLabel[id] ?? id, log.skippedRecords, log.capped),
        cause: m.incompleteCause,
        remediation: [...m.incompleteRemediation],
        source: zipSource(entry, log.entryName),
        docsUrl: Docs.mdmCollectLogs,
      });
    }
    facts.push({
      label: m.factLog(m.logShort[id] ?? id),
      value: m.factLogValue(
        log.scanned,
        log.counts.critical + log.counts.error,
        log.counts.warning,
      ),
    });
  }

  const window = okLogs.find((l) => l.windowStartUtc && l.windowEndUtc);
  if (window?.windowStartUtc && window.windowEndUtc)
    facts.unshift({
      label: m.factWindow,
      value: m.factWindowValue(
        formatDate(window.windowStartUtc, 'UTC'),
        formatDate(window.windowEndUtc, 'UTC'),
        days,
      ),
    });

  if (!mdmOk) {
    // Hauptprotokoll fehlt/ist nicht lesbar → Kachel „nicht verfügbar“ (mit Grund), ggf. mit AAD-Befunden
    const reason = reasonFor(mdm);
    return {
      id: 'mdmEvents',
      title: de.tiles.mdmEvents,
      state: 'ready',
      severity: worstActionable(findings, 'unknown'),
      value: de.availability.unavailable,
      summary: reason.text,
      findings: sortFindings(findings),
      sources: sources.length > 0 ? sources : [zipSource(undefined, 'Events')],
      facts,
      sections: [],
    };
  }

  const severity = worstActionable(findings, 'ok');
  return {
    id: 'mdmEvents',
    title: de.tiles.mdmEvents,
    state: 'ready',
    severity,
    value:
      errors > 0
        ? m.valueErrors(errors)
        : warnings > 0
          ? m.valueOkWithWarnings(warnings)
          : m.valueOk,
    summary: errors > 0 ? m.summaryErrors(groupCount, days) : m.summaryOk(scanned, days),
    findings: sortFindings(findings),
    sources,
    facts,
    sections: [],
  };
}
