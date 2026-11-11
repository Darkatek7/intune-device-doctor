/**
 * M20/S1: Compliance- und Konfigurations-Übersicht des Mandanten – reine Funktionen für die Ansicht
 * „Mandant“.
 *
 * Severity (begründet):
 * - errorDeviceCount > 0 → warning („Prüfen“): Laut Microsoft bleibt der Compliance-Status bei einer
 *   Einstellung im Zustand „Error“ bis zu sieben Tage unverändert, danach wird das Gerät nicht konform
 *   (Docs.complianceSettingError) – also Handlungsbedarf, bevor es Benutzer trifft.
 * - conflictDeviceCount > 0 → warning: widersprüchliche Richtlinien (Docs.policyConflicts).
 * - nonCompliantDeviceCount: Anteil an der Summe der Zähler ≥ THRESHOLDS.tenantNonCompliantShareWarning
 *   (10 %, EIGENER Richtwert, keine Microsoft-Vorgabe) → warning; darunter Hinweis (unknown).
 * - Nie critical: es sind Mandanten-Summen, kein einzelnes Gerät ist dadurch belegt defekt.
 * - Alle Zähler 0/leer → unknown („keine Geräte gemeldet“).
 */
import { formatDateTime, formatPercent, formatRelativeTime } from '../domain/format';
import type {
  AuditEventEntry,
  AuditEventsInfo,
  ComplianceSettingSummariesInfo,
  ComplianceSettingSummaryInfo,
  DeviceStateSummaryInfo,
  Finding,
  FindingTable,
  SectionResult,
  Severity,
  Tile,
  TileFact,
} from '../domain/types';
import type { DeviceStateCountField } from '../graph/dto';
import { de } from '../i18n/de';
import { sectionIssueFinding, sortFindings, worstActionable } from './helpers';
import { Docs } from './knowledge/docs';
import { issueTile } from './service';
import { THRESHOLDS } from './thresholds';

const s = de.fleet.summary;

/** Reihenfolge und Ton der Segmente im Anteilsbalken (Ton = Severity-Farbe, nie allein bedeutungstragend). */
export const SUMMARY_SEGMENTS: ReadonlyArray<{ field: DeviceStateCountField; tone: Severity }> = [
  { field: 'compliantDeviceCount', tone: 'ok' },
  { field: 'remediatedDeviceCount', tone: 'ok' },
  { field: 'inGracePeriodCount', tone: 'warning' },
  { field: 'nonCompliantDeviceCount', tone: 'critical' },
  { field: 'errorDeviceCount', tone: 'critical' },
  { field: 'conflictDeviceCount', tone: 'warning' },
  { field: 'unknownDeviceCount', tone: 'unknown' },
  { field: 'notApplicableDeviceCount', tone: 'unknown' },
  { field: 'configManagerCount', tone: 'unknown' },
];

export function countLabel(summary: DeviceStateSummaryInfo, field: DeviceStateCountField): string {
  return (
    (summary.kind === 'configuration' ? s.configurationCount[field] : undefined) ?? s.count[field]
  );
}

export interface SummarySegment {
  field: DeviceStateCountField;
  label: string;
  count: number;
  /** Anteil an der Summe der Zähler (0–1) */
  share: number;
  tone: Severity;
}

/** Summe aller gelieferten Zähler (Grundlage der Anteile). */
export function summaryTotal(summary: DeviceStateSummaryInfo): number {
  return Object.values(summary.counts).reduce<number>((sum, n) => sum + (n ?? 0), 0);
}

/** Segmente des Anteilsbalkens (nur Zähler > 0, feste Reihenfolge). */
export function summarySegments(summary: DeviceStateSummaryInfo): SummarySegment[] {
  const total = summaryTotal(summary);
  if (total === 0) return [];
  return SUMMARY_SEGMENTS.filter(({ field }) => (summary.counts[field] ?? 0) > 0).map(
    ({ field, tone }) => {
      const count = summary.counts[field] ?? 0;
      return { field, label: countLabel(summary, field), count, share: count / total, tone };
    },
  );
}

/** Textalternative des Balkens („Konform: 40 (80 %), …“). */
export function summaryText(summary: DeviceStateSummaryInfo): string {
  return s.bar.text(
    summarySegments(summary).map((segment) =>
      s.bar.part(segment.label, segment.count, formatPercent(segment.share)),
    ),
  );
}

export function settingPlatformLabel(setting: ComplianceSettingSummaryInfo): string {
  return setting.platform ? s.platform[setting.platform] : s.platformRaw(setting.platformRaw);
}

const n = (value: number | null | undefined) => value ?? 0;
const cell = (value: number | null) => (value === null ? s.noValue : String(value));

function countsFinding(
  idPrefix: string,
  summary: DeviceStateSummaryInfo,
  source: Tile['sources'][number],
  docsUrl: string,
): Finding {
  return {
    id: `${idPrefix}-counts`,
    severity: 'unknown',
    title: s.countsTitle,
    detail: s.countsDetail,
    cause: s.countsCause,
    remediation: [...s.countsRemediation],
    table: {
      columns: [s.columns.category, s.columns.count, s.columns.field],
      rows: (Object.keys(summary.counts) as DeviceStateCountField[]).map((field) => ({
        cells: [countLabel(summary, field), cell(summary.counts[field] ?? null), field],
      })),
    },
    source,
    docsUrl,
  };
}

function problemFindings(
  idPrefix: string,
  summary: DeviceStateSummaryInfo,
  source: Tile['sources'][number],
): Finding[] {
  const findings: Finding[] = [];
  const errors = n(summary.counts.errorDeviceCount);
  const conflicts = n(summary.counts.conflictDeviceCount);
  const configuration = summary.kind === 'configuration';
  if (errors > 0) {
    findings.push({
      id: `${idPrefix}-error`,
      severity: 'warning',
      title: s.errorTitle(errors),
      detail: configuration ? s.configurationErrorDetail : s.errorDetail,
      cause: s.errorCause,
      remediation: configuration ? [...s.configurationErrorRemediation] : [...s.errorRemediation],
      evidence: { errorDeviceCount: errors },
      source,
      docsUrl: configuration ? Docs.configurationProfileMonitor : Docs.complianceSettingError,
    });
  }
  if (conflicts > 0) {
    findings.push({
      id: `${idPrefix}-conflict`,
      severity: 'warning',
      title: s.conflictTitle(conflicts),
      detail: s.conflictDetail,
      cause: s.conflictCause,
      remediation: [...s.conflictRemediation],
      evidence: { conflictDeviceCount: conflicts },
      source,
      docsUrl: Docs.policyConflicts,
    });
  }
  return findings;
}

function topViolationsFinding(
  info: ComplianceSettingSummariesInfo,
  source: Tile['sources'][number],
): Finding {
  const violating = info.settings.filter((setting) => n(setting.nonCompliantDeviceCount) > 0);
  const top = violating.slice(0, THRESHOLDS.tenantTopViolations);
  return {
    id: 'tenantCompliance-top',
    severity: 'unknown',
    title: s.topTitle,
    detail: top.length > 0 ? s.topDetail(top.length, violating.length) : s.topNone,
    cause: s.topCause,
    remediation: [...s.topRemediation],
    ...(top.length > 0
      ? {
          table: {
            columns: [
              s.topColumns.setting,
              s.topColumns.platform,
              s.topColumns.nonCompliant,
              s.topColumns.error,
              s.topColumns.conflict,
            ],
            // Einstellungsnamen sind Microsoft-Originalwerte (englisch)
            columnLangs: ['en', null, null, null, null],
            rows: top.map((setting) => ({
              cells: [
                setting.name,
                settingPlatformLabel(setting),
                cell(setting.nonCompliantDeviceCount),
                cell(setting.errorDeviceCount),
                cell(setting.conflictDeviceCount),
              ],
            })),
          },
        }
      : {}),
    source,
    docsUrl: Docs.complianceDashboard,
  };
}

function base(id: 'tenantCompliance' | 'tenantConfiguration') {
  return { id, title: de.tiles[id], state: 'ready' as const, sections: [] };
}

function shareFacts(summary: DeviceStateSummaryInfo, shareLabel: string): TileFact[] {
  const total = summaryTotal(summary);
  const facts: TileFact[] = (Object.keys(summary.counts) as DeviceStateCountField[]).map(
    (field) => ({ label: countLabel(summary, field), value: cell(summary.counts[field] ?? null) }),
  );
  facts.push({ label: s.facts.total, value: String(total) });
  if (total > 0) {
    facts.push({
      label: shareLabel,
      value: formatPercent(n(summary.counts.compliantDeviceCount) / total),
    });
  }
  return facts;
}

export function evaluateTenantCompliance(
  status: SectionResult<DeviceStateSummaryInfo>,
  settings: SectionResult<ComplianceSettingSummariesInfo>,
): Tile {
  const tileBase = base('tenantCompliance');
  if (status.status !== 'ok') return issueTile(tileBase, status);

  const summary = status.data;
  const total = summaryTotal(summary);
  const nonCompliant = n(summary.counts.nonCompliantDeviceCount);
  const share = total > 0 ? nonCompliant / total : 0;
  const findings = problemFindings('tenantCompliance', summary, status.source);
  if (nonCompliant > 0) {
    const threshold = THRESHOLDS.tenantNonCompliantShareWarning;
    findings.push({
      id: 'tenantCompliance-nonCompliant',
      severity: share >= threshold ? 'warning' : 'unknown',
      title: s.nonCompliantTitle(nonCompliant, formatPercent(share)),
      detail: s.nonCompliantDetail(Math.round(threshold * 100)),
      cause: s.nonCompliantCause,
      remediation: [...s.nonCompliantRemediation],
      evidence: { nonCompliantDeviceCount: nonCompliant, total, ownThreshold: threshold },
      source: status.source,
      docsUrl: Docs.complianceDashboard,
    });
  }
  if (settings.status === 'ok') {
    findings.push(topViolationsFinding(settings.data, settings.source));
    if (settings.data.truncated) {
      findings.push({
        id: 'tenantCompliance-truncated',
        severity: 'unknown',
        title: s.truncatedTitle(settings.data.pagesRead),
        detail: s.truncatedDetail,
        cause: s.truncatedCause,
        remediation: [...s.truncatedRemediation],
        evidence: { pagesRead: settings.data.pagesRead },
        source: settings.source,
        docsUrl: Docs.complianceSettingSummariesList,
      });
    }
  } else {
    findings.push({
      ...sectionIssueFinding('tenantCompliance-top', settings),
      title: s.settingsIssueTitle,
    });
  }
  findings.push(
    countsFinding('tenantCompliance', summary, status.source, Docs.complianceSummaryGet),
  );

  const problems = n(summary.counts.errorDeviceCount) + n(summary.counts.conflictDeviceCount);
  return {
    ...tileBase,
    severity: worstActionable(findings, total > 0 ? 'ok' : 'unknown'),
    value:
      total > 0
        ? s.valueShare(formatPercent(n(summary.counts.compliantDeviceCount) / total))
        : s.valueNone,
    summary: total > 0 ? s.summary(nonCompliant, problems) : s.summaryNone,
    findings: sortFindings(findings),
    sources: settings.status === 'ok' ? [status.source, settings.source] : [status.source],
    facts: shareFacts(summary, s.facts.share),
  };
}

export function evaluateTenantConfiguration(status: SectionResult<DeviceStateSummaryInfo>): Tile {
  const tileBase = base('tenantConfiguration');
  if (status.status !== 'ok') return issueTile(tileBase, status);

  const summary = status.data;
  const total = summaryTotal(summary);
  const findings = problemFindings('tenantConfiguration', summary, status.source);
  findings.push(
    countsFinding('tenantConfiguration', summary, status.source, Docs.configurationSummaryGet),
  );
  const problems = n(summary.counts.errorDeviceCount) + n(summary.counts.conflictDeviceCount);
  return {
    ...tileBase,
    severity: worstActionable(findings, total > 0 ? 'ok' : 'unknown'),
    value:
      total > 0
        ? s.configurationValue(formatPercent(n(summary.counts.compliantDeviceCount) / total))
        : s.valueNone,
    summary:
      total > 0
        ? s.summaryConfiguration(n(summary.counts.nonCompliantDeviceCount), problems)
        : s.summaryNone,
    findings: sortFindings(findings),
    sources: [status.source],
    facts: shareFacts(summary, s.facts.shareConfiguration),
  };
}

// ---------- S2: Änderungsprotokoll ----------
//
// Die Kachel „Letzte Änderungen“ ist eine Übersicht: Aktivität und Ergebnis sind freie Zeichenketten
// (keine Werte dokumentiert) und werden nicht gedeutet → Severity ok (Daten gelesen) bzw. unknown bei
// Grenzen. Kein Befund behauptet eine Ursache.

const a = de.fleet.audit;
const DAY_MS = 86_400_000;
/** Höchstzahl der Zeilen in der Tabelle der Kachel */
export const MAX_AUDIT_ROWS = 50;

export function actorLabel(event: AuditEventEntry): string {
  const { actor } = event;
  if (!actor.name) return a.actor.unknown;
  return actor.kind === 'application' ? a.actor.application(actor.name) : a.actor.user(actor.name);
}

function categoryCell(event: AuditEventEntry): string {
  const parts = [event.category, event.componentName].filter(
    (part, index, all): part is string => !!part && all.indexOf(part) === index,
  );
  return parts.length > 0 ? parts.join(' / ') : a.noValue;
}

function objectCell(event: AuditEventEntry): string {
  if (event.resources.length === 0) return a.noValue;
  return event.resources.map((r) => a.objectCell(r.displayName, r.type)).join(', ');
}

/** Ereignisse im Zeitfenster (activityDateTime innerhalb der letzten `days` Tage). */
export function eventsWithin(info: AuditEventsInfo, now: Date, days: number): AuditEventEntry[] {
  const from = now.getTime() - days * DAY_MS;
  return info.events.filter((event) => {
    const ms = Date.parse(event.activityDateTime ?? '');
    return !Number.isNaN(ms) && ms >= from;
  });
}

/** Zeilen der Änderungstabelle (Zeitpunkt, Aktivität, Kategorie, Ergebnis, Objekt, Wer). */
export function auditRows(events: AuditEventEntry[]): string[][] {
  return events.map((event) => [
    event.activityDateTime ? formatDateTime(event.activityDateTime) : a.noValue,
    event.activity ?? a.noValue,
    categoryCell(event),
    event.activityResult ?? a.noValue,
    objectCell(event),
    actorLabel(event),
  ]);
}

/**
 * Sprache der Spalten: Aktivität, Kategorie, Ergebnis und Objekttyp sind Microsoft-Originalwerte
 * (englisch); Zeitpunkt und „Wer“ nicht. Platzhalter „–“ bleiben deutsch.
 */
export const AUDIT_COLUMN_LANGS: Array<'en' | null> = [null, 'en', 'en', 'en', 'en', null];

export function auditCellLang(cell: string, column: number): 'en' | null {
  return cell && cell !== a.noValue ? (AUDIT_COLUMN_LANGS[column] ?? null) : null;
}

function auditTable(events: AuditEventEntry[]): FindingTable {
  return {
    columns: [...AUDIT_COLUMNS],
    columnLangs: AUDIT_COLUMN_LANGS,
    rows: auditRows(events).map((cells) => ({
      cells,
      cellLangs: cells.map((cell, column) => auditCellLang(cell, column)),
    })),
  };
}

export const AUDIT_COLUMNS = [
  a.columns.time,
  a.columns.activity,
  a.columns.category,
  a.columns.result,
  a.columns.object,
  a.columns.actor,
];

export function evaluateTenantChanges(status: SectionResult<AuditEventsInfo>, now: Date): Tile {
  const tileBase = {
    id: 'tenantChanges' as const,
    title: de.tiles.tenantChanges,
    state: 'ready' as const,
    sections: [],
  };
  if (status.status !== 'ok') return issueTile(tileBase, status);

  const days = THRESHOLDS.auditWindowDays;
  const info = status.data;
  const recent = eventsWithin(info, now, days);
  const findings: Finding[] = [];
  if (recent.length > 0) {
    const rows = recent.slice(0, MAX_AUDIT_ROWS);
    findings.push({
      id: 'tenantChanges-list',
      severity: 'unknown',
      title: a.listTitle(days),
      detail: a.listDetail(rows.length, recent.length),
      cause: a.listCause,
      remediation: [...a.listRemediation],
      table: auditTable(rows),
      source: status.source,
      docsUrl: Docs.intuneAuditLogs,
    });
  } else {
    findings.push({
      id: 'tenantChanges-none',
      severity: 'unknown',
      title: a.noneTitle(days),
      detail: a.noneDetail(info.events.length),
      cause: a.listCause,
      remediation: [...a.listRemediation],
      source: status.source,
      docsUrl: Docs.intuneAuditLogs,
    });
  }
  if (info.truncated) {
    findings.push({
      id: 'tenantChanges-truncated',
      severity: 'unknown',
      title: a.truncatedTitle(info.pagesRead),
      detail: a.truncatedDetail,
      cause: a.truncatedCause,
      remediation: [...a.truncatedRemediation],
      evidence: { pagesRead: info.pagesRead },
      source: status.source,
      docsUrl: Docs.auditEventsList,
    });
  }
  const latest = recent[0]?.activityDateTime ?? null;
  return {
    ...tileBase,
    severity: info.truncated && recent.length === 0 ? 'unknown' : 'ok',
    value: a.value(recent.length),
    summary:
      recent.length > 0
        ? a.summary(days, latest ? formatRelativeTime(latest, now) : null)
        : a.summaryNone(days),
    findings,
    sources: [status.source],
    facts: [
      { label: a.facts.window, value: a.windowValue(days) },
      { label: a.facts.count, value: String(recent.length) },
      { label: a.facts.read, value: String(info.events.length) },
      { label: a.facts.pages, value: String(info.pagesRead) },
    ],
  };
}

/** Änderungen an einem Objekt (Abgleich über auditResource.resourceId, ohne Groß-/Kleinschreibung). */
export function changesForResource(info: AuditEventsInfo, resourceId: string): AuditEventEntry[] {
  const id = resourceId.toLowerCase();
  return info.events.filter((event) =>
    event.resources.some((resource) => resource.resourceId?.toLowerCase() === id),
  );
}

/**
 * Ruhiger Hinweis: Gab es eine Änderung höchstens THRESHOLDS.auditChangeBeforeErrorDays Tage (eigener
 * Richtwert) vor gemeldeten Problemen? Liefert die jüngste solche Änderung und die Zahl der Geräte, die
 * danach ein Problem gemeldet haben. Behauptet keine Kausalität – nur zeitliche Nähe.
 */
export function changeBeforeProblems(
  changes: AuditEventEntry[],
  problemReports: Array<{ lastReportedDateTime: string | null }>,
): { change: AuditEventEntry; devices: number } | null {
  const windowMs = THRESHOLDS.auditChangeBeforeErrorDays * DAY_MS;
  for (const change of changes) {
    const changed = Date.parse(change.activityDateTime ?? '');
    if (Number.isNaN(changed)) continue;
    const devices = problemReports.filter((entry) => {
      const reported = Date.parse(entry.lastReportedDateTime ?? '');
      return !Number.isNaN(reported) && reported >= changed && reported - changed <= windowMs;
    }).length;
    if (devices > 0) return { change, devices };
  }
  return null;
}
