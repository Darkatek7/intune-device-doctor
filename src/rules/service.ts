/**
 * M18: Dienststatus und Registrierungsfehler – reine Funktionen für die Ansicht „Mandant“ und die
 * Gerätekachel „Registrierung (Benutzer)“.
 *
 * Dienststatus – Abbildung serviceHealthStatus → Severity (Beschreibungen laut Microsoft Learn,
 * Ressource serviceHealthIssue › „serviceHealthStatus values“):
 * - serviceInterruption („affect the ability for users to access the service … significant“) → critical
 * - serviceDegradation, investigating, restoringService, extendedRecovery (Problem bestätigt bzw. in
 *   Untersuchung/Behebung, Dienst noch beeinträchtigt) → warning
 * - serviceOperational, verifyingService („verified that the service is healthy“), serviceRestored,
 *   postIncidentReviewPublished, falsePositive → ok
 * - investigationSuspended (Microsoft wartet auf Kundendaten, meldet sich bei Bedarf) → unknown (Hinweis)
 * - resolved, mitigatedExternal, mitigated, resolvedExternal, confirmed, reported („Reserved for future
 *   use“), unknownFutureValue, fehlende/nicht dokumentierte Werte → unknown – keine Deutung
 * Ein offener Eintrag erbt die Severity seines Status; ein Hinweis (advisory) zählt höchstens als warning;
 * ein offener Eintrag mit „gesundem“ Status (z. B. verifyingService) bleibt als Hinweis (unknown) sichtbar.
 */
import { formatDateTime, formatRelativeTime } from '../domain/format';
import type {
  DataSource,
  EnrollmentFailureEvent,
  EnrollmentFailuresInfo,
  Finding,
  SectionResult,
  ServiceHealthEntry,
  ServiceHealthInfo,
  ServiceHealthIssueInfo,
  Severity,
  Tile,
  TileFact,
} from '../domain/types';
import type { DeviceEnrollmentFailureReason, ServiceHealthStatus } from '../graph/dto';
import { de } from '../i18n/de';
import { sectionIssueFinding, sortFindings, worstActionable } from './helpers';
import { Docs } from './knowledge/docs';
import { ENROLLMENT_FAILURE_KNOWLEDGE } from './knowledge/enrollmentFailureCategories';

const h = de.service.health;
const f = de.service.failures;

// ---------- Dienststatus ----------

export const SERVICE_STATUS_SEVERITY: Record<ServiceHealthStatus, Severity> = {
  serviceOperational: 'ok',
  investigating: 'warning',
  restoringService: 'warning',
  verifyingService: 'ok',
  serviceRestored: 'ok',
  postIncidentReviewPublished: 'ok',
  serviceDegradation: 'warning',
  serviceInterruption: 'critical',
  extendedRecovery: 'warning',
  falsePositive: 'ok',
  investigationSuspended: 'unknown',
  resolved: 'unknown',
  mitigatedExternal: 'unknown',
  mitigated: 'unknown',
  resolvedExternal: 'unknown',
  confirmed: 'unknown',
  reported: 'unknown',
  unknownFutureValue: 'unknown',
};

export function serviceStatusSeverity(status: ServiceHealthStatus | null): Severity {
  return status ? SERVICE_STATUS_SEVERITY[status] : 'unknown';
}

export function serviceStatusLabel(status: ServiceHealthStatus | null, raw: string | null): string {
  return status && status !== 'unknownFutureValue' ? h.status[status] : h.statusUnknown(raw);
}

/** Severity eines offenen Eintrags (siehe Kopfkommentar). */
export function issueSeverity(issue: ServiceHealthIssueInfo): Severity {
  const base = serviceStatusSeverity(issue.status);
  if (base === 'ok') return 'unknown';
  if (issue.classification === 'advisory' && base === 'critical') return 'warning';
  return base;
}

function classificationLabel(issue: ServiceHealthIssueInfo): string {
  return issue.classification ? h.classification[issue.classification] : h.classificationUnknown;
}

/** Offene Vorfälle (Einstufung „incident“) für Intune – Grundlage des Hinweises in der Geräteansicht. */
export function openIntuneIncidents(info: ServiceHealthInfo): ServiceHealthIssueInfo[] {
  return info.services
    .filter((service) => service.kind === 'intune')
    .flatMap((service) => service.openIssues)
    .filter((issue) => issue.classification === 'incident');
}

function serviceName(entry: ServiceHealthEntry): string {
  return entry.service;
}

function issueFinding(
  entry: ServiceHealthEntry,
  issue: ServiceHealthIssueInfo,
  source: DataSource,
): Finding {
  return {
    id: `tenantServiceHealth-issue-${issue.id}`,
    severity: issueSeverity(issue),
    title: issue.title ?? `${classificationLabel(issue)} ${issue.id}`,
    ...(issue.title ? { titleLang: 'en' as const } : {}),
    detail: issue.impactDescription ?? h.issueDetailMissing,
    ...(issue.impactDescription ? { detailLang: 'en' as const } : {}),
    cause: h.issueCause(serviceName(entry)),
    remediation: [...h.issueRemediation],
    evidence: {
      service: entry.service,
      id: issue.id,
      classification: classificationLabel(issue),
      status: serviceStatusLabel(issue.status, issue.statusRaw),
      statusRaw: issue.statusRaw,
      startDateTime: issue.startDateTime ? formatDateTime(issue.startDateTime) : null,
      lastModifiedDateTime: issue.lastModifiedDateTime
        ? formatDateTime(issue.lastModifiedDateTime)
        : null,
      feature: issue.feature,
      featureGroup: issue.featureGroup,
    },
    source,
    docsUrl: Docs.serviceCommunicationsOverview,
  };
}

function serviceFindings(entry: ServiceHealthEntry, source: DataSource): Finding[] {
  const findings: Finding[] = [];
  const severity = serviceStatusSeverity(entry.status);
  const label = serviceStatusLabel(entry.status, entry.statusRaw);
  if (severity !== 'ok') {
    findings.push({
      id: `tenantServiceHealth-service-${entry.id}`,
      severity,
      title: h.serviceTitle(entry.service, label),
      detail: h.serviceDetail(entry.service, entry.statusRaw),
      cause: severity === 'unknown' ? h.serviceCause.unknown : h.serviceCause.problem,
      remediation: [...h.serviceRemediation],
      evidence: { service: entry.service, id: entry.id, status: entry.statusRaw },
      source,
      docsUrl: severity === 'unknown' ? Docs.serviceHealthIssueResource : Docs.m365ServiceHealth,
    });
  }
  findings.push(...entry.openIssues.map((issue) => issueFinding(entry, issue, source)));
  return findings;
}

export function issueTile(
  base: Pick<Tile, 'id' | 'title' | 'state' | 'sections'>,
  section: Exclude<SectionResult<unknown>, { status: 'ok' }>,
): Tile {
  return {
    ...base,
    severity: 'unknown',
    value: de.availability[section.status],
    summary:
      section.status === 'forbidden'
        ? de.rules.common.forbiddenSummary(
            section.error.requiredScope ?? de.rules.common.unknownScope,
          )
        : section.status === 'error'
          ? section.error.message
          : section.reason,
    findings: [sectionIssueFinding(base.id, section)],
    sources: [section.source],
    facts: [],
    availability: section.status,
  };
}

export function evaluateServiceHealth(status: SectionResult<ServiceHealthInfo>, _now: Date): Tile {
  void _now;
  const base = {
    id: 'tenantServiceHealth' as const,
    title: de.tiles.tenantServiceHealth,
    state: 'ready' as const,
    sections: [],
  };
  if (status.status !== 'ok') return issueTile(base, status);

  const { services, truncated } = status.data;
  const relevant = services.filter((service) => service.kind !== null);
  const intune = services.find((service) => service.kind === 'intune');
  const entra = services.find((service) => service.kind === 'entra');
  const findings: Finding[] = relevant.flatMap((entry) => serviceFindings(entry, status.source));

  if (!intune) {
    findings.push({
      id: 'tenantServiceHealth-notFound',
      severity: 'unknown',
      title: h.notFoundTitle,
      detail: h.notFoundDetail(services.length),
      cause: h.notFoundCause,
      remediation: [...h.notFoundRemediation],
      source: status.source,
      docsUrl: Docs.serviceHealthOverviewsList,
    });
  }
  findings.push({
    id: 'tenantServiceHealth-overview',
    severity: 'unknown',
    title: h.overviewTitle,
    detail: h.overviewDetail(services.length, truncated),
    cause: h.overviewCause,
    remediation: [...h.serviceRemediation],
    table: {
      columns: [h.columns.service, h.columns.status, h.columns.open, h.columns.resolved],
      rows: services.map((service) => ({
        cells: [
          service.service,
          serviceStatusLabel(service.status, service.statusRaw),
          String(service.openIssues.length),
          String(service.resolvedCount),
        ],
        ...(service.kind ? { highlight: true } : {}),
      })),
    },
    source: status.source,
    docsUrl: Docs.serviceHealthOverviewsList,
  });

  const open = relevant.flatMap((service) => service.openIssues);
  const incidents = open.filter((issue) => issue.classification === 'incident').length;
  const facts: TileFact[] = [
    {
      label: h.facts.intune,
      value: intune ? serviceStatusLabel(intune.status, intune.statusRaw) : h.facts.notListed,
    },
    {
      label: h.facts.entra,
      value: entra ? serviceStatusLabel(entra.status, entra.statusRaw) : h.facts.notListed,
    },
    { label: h.facts.open, value: String(open.length) },
  ];
  return {
    ...base,
    severity: worstActionable(findings, intune ? 'ok' : 'unknown'),
    value: open.length > 0 ? h.valueIssues(open.length) : intune ? h.valueOk : h.valueNotFound,
    summary:
      open.length > 0
        ? h.summaryIssues(incidents, open.length - incidents)
        : intune
          ? h.summaryOk
          : h.summaryNotFound,
    findings: sortFindings(findings),
    sources: [status.source],
    facts,
  };
}

// ---------- Registrierungsfehler ----------

/** Gruppenschlüssel: dokumentierte Kategorie oder `raw:<Rohwert>` (nicht dokumentiert → keine Deutung). */
type CategoryKey = DeviceEnrollmentFailureReason | `raw:${string}`;

function categoryKey(event: EnrollmentFailureEvent): CategoryKey {
  return event.failureCategory ?? `raw:${event.failureCategoryRaw ?? ''}`;
}

export function categoryLabel(event: EnrollmentFailureEvent): string {
  return event.failureCategory
    ? f.category[event.failureCategory]
    : f.categoryRaw(event.failureCategoryRaw);
}

export function enrollmentTypeLabel(event: EnrollmentFailureEvent): string {
  return event.enrollmentType
    ? f.enrollmentType[event.enrollmentType]
    : (event.enrollmentTypeRaw ?? f.unknownValue);
}

function osText(event: EnrollmentFailureEvent): string {
  return [event.operatingSystem, event.osVersion].filter(Boolean).join(' ') || f.unknownValue;
}

/** Fehlschläge nach Kategorie, Reihenfolge: meiste zuerst, dann jüngster Fehlschlag. */
export function groupByCategory(
  events: EnrollmentFailureEvent[],
): Array<{ key: CategoryKey; events: EnrollmentFailureEvent[] }> {
  const groups = new Map<CategoryKey, EnrollmentFailureEvent[]>();
  for (const event of events) {
    const key = categoryKey(event);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({ key, events: list }))
    .sort((a, b) => b.events.length - a.events.length);
}

/**
 * Ein Befund je Kategorie (Ursache + Lösung laut Wissensbasis). Fehlgeschlagene Registrierungen sind
 * Handlungsbedarf → warning; nicht dokumentierte Kategorien zeigen nur den Rohwert.
 */
export function categoryFindings(
  idPrefix: string,
  events: EnrollmentFailureEvent[],
  source: DataSource,
  now: Date,
): Finding[] {
  return groupByCategory(events).map(({ key, events: list }) => {
    const first = list[0]!;
    const known = first.failureCategory;
    const reasons = [...new Set(list.map((e) => e.failureReason).filter((r): r is string => !!r))];
    const latest = first.eventDateTime ? formatRelativeTime(first.eventDateTime, now) : null;
    return {
      id: `${idPrefix}-${key}`,
      severity: 'warning' as const,
      title: f.categoryTitle(categoryLabel(first), list.length),
      detail: f.categoryDetail(
        latest,
        reasons.slice(0, 5).map((reason) => `„${reason}“`),
      ),
      cause: known ? f.causes[known] : f.rawCause,
      remediation: known ? [...f.remediation[known]] : [...f.rawRemediation],
      evidence: {
        failureCategory: first.failureCategoryRaw,
        count: list.length,
        latestEventDateTime: first.eventDateTime ? formatDateTime(first.eventDateTime) : null,
        latestCorrelationId: first.correlationId,
      },
      source,
      docsUrl: known
        ? ENROLLMENT_FAILURE_KNOWLEDGE[known].docsUrl
        : Docs.enrollmentFailureReasonEnum,
    };
  });
}

/** Höchstzahl der Zeilen in der Liste der jüngsten Fehlschläge. */
export const MAX_FAILURE_ROWS = 25;

function listFinding(info: EnrollmentFailuresInfo, source: DataSource): Finding {
  const rows = info.events.slice(0, MAX_FAILURE_ROWS);
  return {
    id: 'tenantEnrollmentFailures-list',
    severity: 'unknown',
    title: f.listTitle,
    detail: f.listDetail(rows.length, info.events.length),
    cause: f.listCause,
    remediation: [f.truncatedRemediation[0]!],
    table: {
      columns: [
        f.columns.time,
        f.columns.os,
        f.columns.type,
        f.columns.category,
        f.columns.reason,
        f.columns.user,
      ],
      rows: rows.map((event) => ({
        cells: [
          event.eventDateTime ? formatDateTime(event.eventDateTime) : f.unknownValue,
          osText(event),
          enrollmentTypeLabel(event),
          categoryLabel(event),
          event.failureReason ?? f.noReason,
          event.userId ?? f.unknownValue,
        ],
      })),
    },
    source,
    docsUrl: Docs.enrollmentFailuresReport,
  };
}

function truncatedFinding(idPrefix: string, info: EnrollmentFailuresInfo, source: DataSource) {
  return {
    id: `${idPrefix}-truncated`,
    severity: 'unknown' as const,
    title: f.truncatedTitle(info.pagesRead),
    detail: f.truncatedDetail,
    cause: f.truncatedCause,
    remediation: [...f.truncatedRemediation],
    evidence: { pagesRead: info.pagesRead },
    source,
    docsUrl: Docs.troubleshootingEventsList,
  };
}

export function evaluateEnrollmentFailures(
  status: SectionResult<EnrollmentFailuresInfo>,
  now: Date,
): Tile {
  const base = {
    id: 'tenantEnrollmentFailures' as const,
    title: de.tiles.tenantEnrollmentFailures,
    state: 'ready' as const,
    sections: [],
  };
  if (status.status !== 'ok') return issueTile(base, status);

  const info = status.data;
  const { events } = info;
  const findings: Finding[] = [];
  if (events.length > 0) {
    findings.push(...categoryFindings('tenantEnrollmentFailures', events, status.source, now));
    findings.push(listFinding(info, status.source));
  }
  if (info.truncated)
    findings.push(truncatedFinding('tenantEnrollmentFailures', info, status.source));

  const categories = groupByCategory(events).length;
  const latest = events[0]?.eventDateTime ?? null;
  const facts: TileFact[] = [
    { label: f.facts.count, value: String(events.length) },
    { label: f.facts.categories, value: String(categories) },
  ];
  if (latest) {
    facts.push({
      label: f.facts.latest,
      value: formatRelativeTime(latest, now),
      title: formatDateTime(latest),
    });
  }
  facts.push({ label: f.facts.pages, value: String(info.pagesRead) });
  return {
    ...base,
    severity: worstActionable(findings, 'ok'),
    value: events.length > 0 ? f.valueCount(events.length) : f.valueNone,
    summary:
      events.length > 0
        ? f.summary(events.length, categories, latest ? formatRelativeTime(latest, now) : null)
        : f.summaryNone(info.pagesRead, info.truncated),
    findings: sortFindings(findings),
    sources: [status.source],
    facts,
  };
}

/**
 * Teil der Gerätekachel „Registrierung (Benutzer)“: Fehlschläge des primären Benutzers als Befunde
 * (je Kategorie), plus ein Fakt. notApplicable (kein Benutzer) erzeugt keinen Befund.
 */
export function deviceEnrollmentFailures(
  section: SectionResult<EnrollmentFailuresInfo>,
  now: Date,
): { findings: Finding[]; facts: TileFact[] } {
  if (section.status === 'notApplicable') return { findings: [], facts: [] };
  if (section.status !== 'ok') {
    return {
      findings: [sectionIssueFinding('registration-enrollmentFailures', section)],
      facts: [],
    };
  }
  const info = section.data;
  const findings = categoryFindings(
    'registration-enrollmentFailure',
    info.events,
    section.source,
    now,
  );
  if (info.truncated) {
    findings.push(truncatedFinding('registration-enrollmentFailures', info, section.source));
  }
  const value = info.events.length > 0 ? String(info.events.length) : f.deviceFactNone;
  return {
    findings,
    facts: [
      {
        label: f.deviceFact,
        value: info.truncated ? `${value} ${f.deviceFactTruncated(info.pagesRead)}` : value,
      },
    ],
  };
}
