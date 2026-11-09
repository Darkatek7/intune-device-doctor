/**
 * Sicherheitswarnungen – offene Microsoft-Defender-for-Endpoint-Warnungen dieses Geräts (M14/S4,
 * optionaler Scope SecurityAlert.Read.All). Die Warnungen sind clientseitig dem Gerät zugeordnet und
 * behobene (status = resolved) ausgeblendet (siehe mapSecurityAlerts).
 * - offene Warnung mit Schweregrad high → critical, medium → warning, sonst Hinweis (unknown)
 * - keine offene Warnung → ok, mit Hinweis, wie viele Warnungen geprüft wurden
 * - weitere Seiten nicht gelesen → Hinweis „nur die neuesten Warnungen geprüft“
 * Es werden keine Personendaten angezeigt (angemeldete Benutzer, IP-Adressen, Bearbeiter fehlen im Modell).
 */
import { formatDateTime, formatRelativeTime } from '../../domain/format';
import type {
  DeviceSnapshot,
  Finding,
  SecurityAlertEntry,
  SecurityAlertSeverityLevel,
  Severity,
  Tile,
  TileFact,
} from '../../domain/types';
import { de } from '../../i18n/de';
import {
  loadingTile,
  sectionsLoaded,
  sortFindings,
  unavailableTile,
  worstActionable,
} from '../helpers';
import { Docs } from '../knowledge/docs';

const t = de.rules.securityAlerts;

/** Höchstens so viele Warnungen einzeln als Befund (schwerste zuerst, dann neueste). */
export const MAX_ALERT_FINDINGS = 5;

const RANK: Record<SecurityAlertSeverityLevel, number> = {
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
  unknown: 0,
};

function findingSeverity(alert: SecurityAlertEntry): Severity {
  if (alert.severity === 'high') return 'critical';
  if (alert.severity === 'medium') return 'warning';
  return 'unknown';
}

function alertFinding(alert: SecurityAlertEntry, source: Finding['source'], now: Date): Finding {
  return {
    id: `securityAlerts-alert-${alert.id}`,
    severity: findingSeverity(alert),
    title: alert.title ?? t.untitled,
    detail: t.alertDetail({
      severity: t.severity[alert.severity] ?? alert.severity,
      status: t.status[alert.status] ?? alert.status,
      created: alert.createdDateTime ? formatRelativeTime(alert.createdDateTime, now) : null,
      categories: alert.categories,
      byName: alert.matchedBy === 'deviceName',
    }),
    cause: t.causeBySeverity[alert.severity] ?? t.causeBySeverity.unknown!,
    remediation: [...t.remediation],
    evidence: {
      alertId: alert.id,
      severity: alert.severity,
      status: alert.status,
      createdDateTime: alert.createdDateTime,
      lastUpdateDateTime: alert.lastUpdateDateTime,
      categories: alert.categories.join(', ') || null,
      matchedBy: alert.matchedBy,
      deviceRiskScore: alert.deviceRiskScore,
      defenderAvStatus: alert.defenderAvStatus,
    },
    source,
    docsUrl: Docs.defenderAlertsQueue,
    links: alert.alertWebUrl ? [{ label: de.links.openInDefender, url: alert.alertWebUrl }] : [],
  };
}

export function evaluateSecurityAlerts(snapshot: DeviceSnapshot, now: Date): Tile {
  const sections: Tile['sections'] = ['securityAlerts'];
  if (!sectionsLoaded(snapshot, sections)) return loadingTile('securityAlerts', sections);
  const section = snapshot.securityAlerts!;
  if (section.status !== 'ok') return unavailableTile('securityAlerts', sections, section);

  const { alerts, resolvedCount, evaluated, moreAvailable } = section.data;
  const findings: Finding[] = [];

  // schwerste zuerst, bei gleichem Schweregrad die neueste (Eingabe ist bereits neueste zuerst)
  const ranked = alerts
    .map((alert, index) => ({ alert, index }))
    .sort((a, b) => RANK[b.alert.severity] - RANK[a.alert.severity] || a.index - b.index)
    .map((entry) => entry.alert);
  for (const alert of ranked.slice(0, MAX_ALERT_FINDINGS)) {
    findings.push(alertFinding(alert, section.source, now));
  }
  if (ranked.length > MAX_ALERT_FINDINGS) {
    findings.push({
      id: 'securityAlerts-more',
      severity: 'unknown',
      title: t.moreTitle(ranked.length - MAX_ALERT_FINDINGS),
      detail: t.moreDetail(MAX_ALERT_FINDINGS),
      cause: t.moreCause,
      remediation: [...t.moreRemediation],
      source: section.source,
      docsUrl: Docs.defenderInvestigateAlerts,
    });
  }

  if (alerts.length === 0) {
    findings.push({
      id: 'securityAlerts-none',
      severity: 'unknown',
      title: t.noneTitle,
      detail: t.noneDetail(evaluated, moreAvailable, resolvedCount),
      cause: t.noneCause,
      remediation: [...t.noneRemediation],
      evidence: { evaluatedAlerts: evaluated, moreAvailable, resolvedHidden: resolvedCount },
      source: section.source,
      docsUrl: Docs.securityAlertsList,
    });
  }

  if (moreAvailable) {
    findings.push({
      id: 'securityAlerts-partial',
      severity: 'unknown',
      title: t.partialTitle,
      detail: t.partialDetail(evaluated),
      cause: t.partialCause,
      remediation: [...t.partialRemediation],
      evidence: { evaluatedAlerts: evaluated, moreAvailable },
      source: section.source,
      docsUrl: Docs.securityAlertsList,
    });
  }

  const high = alerts.filter((alert) => alert.severity === 'high').length;
  const medium = alerts.filter((alert) => alert.severity === 'medium').length;
  const facts: TileFact[] = [
    { label: t.facts.open, value: String(alerts.length) },
    { label: t.facts.highMedium, value: `${high} / ${medium}` },
  ];
  if (resolvedCount > 0) facts.push({ label: t.facts.resolved, value: String(resolvedCount) });
  const risk = alerts.find((alert) => alert.deviceRiskScore !== null)?.deviceRiskScore;
  if (risk) facts.push({ label: t.facts.deviceRisk, value: t.risk[risk] ?? risk });
  facts.push({
    label: t.facts.evaluated,
    value: moreAvailable ? t.facts.evaluatedMore(evaluated) : String(evaluated),
  });
  const latest = alerts[0]?.createdDateTime;
  if (latest) {
    facts.push({
      label: t.facts.latest,
      value: formatRelativeTime(latest, now),
      title: formatDateTime(latest),
    });
  }

  return {
    id: 'securityAlerts',
    title: de.tiles.securityAlerts,
    state: 'ready',
    severity: worstActionable(findings, 'ok'),
    value: alerts.length > 0 ? t.valueOpen(alerts.length) : t.valueNone,
    summary:
      alerts.length > 0
        ? t.summary(alerts.length, high, medium)
        : t.summaryNone(evaluated, moreAvailable),
    findings: sortFindings(findings),
    sources: [section.source],
    facts,
    sections,
  };
}
