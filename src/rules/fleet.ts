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
import { formatPercent } from '../domain/format';
import type {
  ComplianceSettingSummariesInfo,
  ComplianceSettingSummaryInfo,
  DeviceStateSummaryInfo,
  Finding,
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
      docsUrl: configuration ? Docs.policyConflicts : Docs.complianceSettingError,
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
