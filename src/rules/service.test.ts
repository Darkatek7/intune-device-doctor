/** M18: Regeln für Dienststatus und Registrierungsfehler. */
import { describe, expect, it } from 'vitest';
import type {
  DataSource,
  EnrollmentFailureEvent,
  EnrollmentFailuresInfo,
  SectionResult,
  ServiceHealthEntry,
  ServiceHealthInfo,
  ServiceHealthIssueInfo,
} from '../domain/types';
import { DEVICE_ENROLLMENT_FAILURE_REASONS, SERVICE_HEALTH_STATUSES } from '../graph/dto';
import { de } from '../i18n/de';
import { ENROLLMENT_FAILURE_KNOWLEDGE } from './knowledge/enrollmentFailureCategories';
import {
  SERVICE_STATUS_SEVERITY,
  deviceEnrollmentFailures,
  evaluateEnrollmentFailures,
  evaluateServiceHealth,
  issueSeverity,
  openIntuneIncidents,
  serviceStatusLabel,
} from './service';

const NOW = new Date('2026-11-10T12:00:00Z');
const LEARN_URL = /^https:\/\/learn\.microsoft\.com\//;
const SOURCE: DataSource = {
  kind: 'graph',
  label: 'GET /admin/serviceAnnouncement/healthOverviews',
};
const h = de.service.health;
const f = de.service.failures;

const ok = <T>(data: T): SectionResult<T> => ({
  status: 'ok',
  data,
  source: SOURCE,
  fetchedAt: NOW.toISOString(),
});

function issue(extra: Partial<ServiceHealthIssueInfo> = {}): ServiceHealthIssueInfo {
  return {
    id: 'IT1',
    title: 'Users may be unable to enroll',
    classification: 'incident',
    status: 'serviceDegradation',
    statusRaw: 'serviceDegradation',
    startDateTime: '2026-11-10T09:00:00Z',
    lastModifiedDateTime: '2026-11-10T11:00:00Z',
    feature: 'Enrollment',
    featureGroup: 'Intune',
    impactDescription: 'Users may see errors.',
    ...extra,
  };
}

function service(extra: Partial<ServiceHealthEntry> = {}): ServiceHealthEntry {
  return {
    id: 'Intune',
    service: 'Microsoft Intune',
    kind: 'intune',
    status: 'serviceOperational',
    statusRaw: 'serviceOperational',
    openIssues: [],
    resolvedCount: 0,
    ...extra,
  };
}

const info = (...services: ServiceHealthEntry[]): ServiceHealthInfo => ({
  services,
  truncated: false,
});

describe('Dienststatus – Abbildung serviceHealthStatus → Severity', () => {
  it('deckt jeden dokumentierten Wert ab', () => {
    expect(Object.keys(SERVICE_STATUS_SEVERITY).sort()).toEqual(
      [...SERVICE_HEALTH_STATUSES].sort(),
    );
  });

  it.each([
    ['serviceOperational', 'ok'],
    ['investigating', 'warning'],
    ['restoringService', 'warning'],
    ['verifyingService', 'ok'],
    ['serviceRestored', 'ok'],
    ['postIncidentReviewPublished', 'ok'],
    ['serviceDegradation', 'warning'],
    ['serviceInterruption', 'critical'],
    ['extendedRecovery', 'warning'],
    ['falsePositive', 'ok'],
    ['investigationSuspended', 'unknown'],
    ['resolved', 'unknown'],
    ['mitigatedExternal', 'unknown'],
    ['mitigated', 'unknown'],
    ['resolvedExternal', 'unknown'],
    ['confirmed', 'unknown'],
    ['reported', 'unknown'],
    ['unknownFutureValue', 'unknown'],
  ] as const)('%s → %s', (status, severity) => {
    expect(SERVICE_STATUS_SEVERITY[status]).toBe(severity);
    expect(serviceStatusLabel(status, status)).toBeTruthy();
  });

  it('offene Einträge: Hinweis höchstens warning, „gesunder“ Status → unknown, fehlender Status → unknown', () => {
    expect(issueSeverity(issue({ status: 'serviceInterruption' }))).toBe('critical');
    expect(
      issueSeverity(issue({ status: 'serviceInterruption', classification: 'advisory' })),
    ).toBe('warning');
    expect(issueSeverity(issue({ status: 'verifyingService' }))).toBe('unknown');
    expect(issueSeverity(issue({ status: null, statusRaw: 'neu' }))).toBe('unknown');
    expect(serviceStatusLabel(null, 'neu')).toBe(h.statusUnknown('neu'));
  });
});

describe('Dienststatus – Kachel', () => {
  it('alles in Ordnung → ok, „Keine Störung“, Tabelle aller Dienste', () => {
    const tile = evaluateServiceHealth(
      ok(info(service(), service({ id: 'Entra', service: 'Microsoft Entra', kind: 'entra' }))),
      NOW,
    );
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(h.valueOk);
    expect(tile.findings.map((x) => x.id)).toEqual(['tenantServiceHealth-overview']);
    expect(tile.findings[0]!.table!.rows).toHaveLength(2);
    expect(tile.facts.find((x) => x.label === h.facts.intune)?.value).toBe(
      h.status.serviceOperational,
    );
  });

  it('offener Intune-Vorfall: Befund mit englischem Originaltext (lang en), Einstufung/Status in den Rohdaten', () => {
    const tile = evaluateServiceHealth(
      ok(info(service({ status: 'serviceDegradation', openIssues: [issue()] }))),
      NOW,
    );
    expect(tile.severity).toBe('warning');
    expect(tile.value).toBe(h.valueIssues(1));
    expect(tile.summary).toBe(h.summaryIssues(1, 0));
    const finding = tile.findings.find((x) => x.id === 'tenantServiceHealth-issue-IT1')!;
    expect(finding.title).toBe('Users may be unable to enroll');
    expect(finding.titleLang).toBe('en');
    expect(finding.detail).toBe('Users may see errors.');
    expect(finding.detailLang).toBe('en');
    expect(finding.evidence).toMatchObject({
      classification: h.classification.incident,
      status: h.status.serviceDegradation,
    });
    expect(finding.docsUrl).toMatch(LEARN_URL);
    expect(tile.findings.some((x) => x.id === 'tenantServiceHealth-service-Intune')).toBe(true);
  });

  it('ohne Beschreibung kein lang am Detail; Unterbrechung → critical', () => {
    const tile = evaluateServiceHealth(
      ok(
        info(
          service({
            status: 'serviceInterruption',
            openIssues: [issue({ impactDescription: null, status: 'serviceInterruption' })],
          }),
        ),
      ),
      NOW,
    );
    expect(tile.severity).toBe('critical');
    const finding = tile.findings.find((x) => x.id.startsWith('tenantServiceHealth-issue'))!;
    expect(finding.detail).toBe(h.issueDetailMissing);
    expect(finding.detailLang).toBeUndefined();
  });

  it('Intune nicht in der Liste → unknown mit Hinweis', () => {
    const tile = evaluateServiceHealth(
      ok(info(service({ id: 'Exchange', service: 'Exchange Online', kind: null }))),
      NOW,
    );
    expect(tile.severity).toBe('unknown');
    expect(tile.value).toBe(h.valueNotFound);
    expect(tile.findings.map((x) => x.id)).toContain('tenantServiceHealth-notFound');
  });

  it('fehlende Berechtigung → forbidden mit Rollenhinweis', () => {
    const tile = evaluateServiceHealth(
      {
        status: 'forbidden',
        source: SOURCE,
        error: { code: 'forbidden', message: 'x', requiredScope: 'ServiceHealth.Read.All' },
      },
      NOW,
    );
    expect(tile.availability).toBe('forbidden');
    expect(tile.value).toBe(de.availability.forbidden);
    expect(tile.findings[0]!.remediation.join(' ')).toContain('Service Support Administrator');
  });

  it('openIntuneIncidents: nur Vorfälle (keine Hinweise) von Intune', () => {
    const incidents = openIntuneIncidents(
      info(
        service({ openIssues: [issue(), issue({ id: 'IT2', classification: 'advisory' })] }),
        service({ id: 'Exchange', kind: null, openIssues: [issue({ id: 'EX1' })] }),
      ),
    );
    expect(incidents.map((i) => i.id)).toEqual(['IT1']);
  });
});

function failure(n: number, extra: Partial<EnrollmentFailureEvent> = {}): EnrollmentFailureEvent {
  return {
    id: `e${n}`,
    eventDateTime: new Date(NOW.getTime() - n * 3_600_000).toISOString(),
    correlationId: `c${n}`,
    operatingSystem: 'Windows',
    osVersion: '10.0.26100',
    userId: '00000000-0000-4000-d000-000000000001',
    enrollmentType: 'windowsAzureADJoin',
    enrollmentTypeRaw: 'windowsAzureADJoin',
    failureCategory: 'authentication',
    failureCategoryRaw: 'authentication',
    failureReason: 'AuthenticationRequirementNotMet',
    ...extra,
  };
}

const failures = (
  events: EnrollmentFailureEvent[],
  extra: Partial<EnrollmentFailuresInfo> = {},
): EnrollmentFailuresInfo => ({
  events,
  pagesRead: 1,
  truncated: false,
  filteredUserId: null,
  ...extra,
});

describe('Registrierungsfehler – Wissensbasis', () => {
  it('jede dokumentierte Kategorie hat Bezeichnung, Ursache, Lösung und eine Microsoft-Learn-Quelle', () => {
    for (const category of DEVICE_ENROLLMENT_FAILURE_REASONS) {
      expect(f.category[category]).toBeTruthy();
      expect(f.causes[category]).toBeTruthy();
      expect(f.remediation[category].length).toBeGreaterThan(0);
      expect(ENROLLMENT_FAILURE_KNOWLEDGE[category].docsUrl).toMatch(LEARN_URL);
    }
  });
});

describe('Registrierungsfehler – Kachel „Mandant“', () => {
  it('keine Fehler → ok', () => {
    const tile = evaluateEnrollmentFailures(ok(failures([])), NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(f.valueNone);
    expect(tile.findings).toEqual([]);
  });

  it('fasst nach Kategorie zusammen (Anzahl, meiste zuerst) und listet die jüngsten Fehlschläge', () => {
    const tile = evaluateEnrollmentFailures(
      ok(
        failures([
          failure(1),
          failure(2, { failureCategory: 'userValidation', failureCategoryRaw: 'userValidation' }),
          failure(3),
        ]),
      ),
      NOW,
    );
    expect(tile.severity).toBe('warning');
    expect(tile.value).toBe(f.valueCount(3));
    const ids = tile.findings.map((x) => x.id);
    expect(ids).toEqual([
      'tenantEnrollmentFailures-authentication',
      'tenantEnrollmentFailures-userValidation',
      'tenantEnrollmentFailures-list',
    ]);
    const auth = tile.findings[0]!;
    expect(auth.title).toBe(f.categoryTitle(f.category.authentication, 2));
    expect(auth.cause).toBe(f.causes.authentication);
    expect(auth.docsUrl).toBe(ENROLLMENT_FAILURE_KNOWLEDGE.authentication.docsUrl);
    const table = tile.findings[2]!.table!;
    expect(table.rows[0]!.cells).toEqual([
      expect.any(String),
      'Windows 10.0.26100',
      f.enrollmentType.windowsAzureADJoin,
      f.category.authentication,
      'AuthenticationRequirementNotMet',
      '00000000-0000-4000-d000-000000000001',
    ]);
  });

  it('nicht dokumentierte Kategorie → nur Rohwert, keine Deutung', () => {
    const tile = evaluateEnrollmentFailures(
      ok(failures([failure(1, { failureCategory: null, failureCategoryRaw: 'quantumFailure' })])),
      NOW,
    );
    const finding = tile.findings[0]!;
    expect(finding.id).toBe('tenantEnrollmentFailures-raw:quantumFailure');
    expect(finding.title).toContain('quantumFailure');
    expect(finding.cause).toBe(f.rawCause);
    expect(finding.docsUrl).toMatch(LEARN_URL);
  });

  it('Seitengrenze → ehrlicher Hinweis „nur die ersten N Seiten geprüft“', () => {
    const tile = evaluateEnrollmentFailures(
      ok(failures([], { truncated: true, pagesRead: 3 })),
      NOW,
    );
    expect(tile.summary).toBe(f.summaryNone(3, true));
    expect(tile.findings.map((x) => x.title)).toEqual([f.truncatedTitle(3)]);
    expect(tile.severity).toBe('ok');
  });

  it('Fehler → error-Kachel, bricht nichts ab', () => {
    const tile = evaluateEnrollmentFailures(
      { status: 'error', source: SOURCE, error: { code: 'network', message: 'weg' } },
      NOW,
    );
    expect(tile.availability).toBe('error');
    expect(tile.summary).toBe('weg');
  });
});

describe('Registrierungsfehler – Gerätekachel', () => {
  it('notApplicable → nichts; ok ohne Fehler → Fakt „keine gefunden“', () => {
    expect(
      deviceEnrollmentFailures({ status: 'notApplicable', reason: 'x', source: SOURCE }, NOW),
    ).toEqual({ findings: [], facts: [] });
    const none = deviceEnrollmentFailures(ok(failures([])), NOW);
    expect(none.findings).toEqual([]);
    expect(none.facts).toEqual([{ label: f.deviceFact, value: f.deviceFactNone }]);
  });

  it('Fehler des Benutzers → Befund je Kategorie (warning); Seitengrenze im Fakt', () => {
    const part = deviceEnrollmentFailures(
      ok(failures([failure(1)], { truncated: true, pagesRead: 3 })),
      NOW,
    );
    expect(part.findings.map((x) => [x.id, x.severity])).toEqual([
      ['registration-enrollmentFailure-authentication', 'warning'],
      ['registration-enrollmentFailures-truncated', 'unknown'],
    ]);
    expect(part.facts[0]!.value).toBe(`1 ${f.deviceFactTruncated(3)}`);
  });

  it('forbidden → Hinweisbefund (unknown)', () => {
    const part = deviceEnrollmentFailures(
      {
        status: 'forbidden',
        source: SOURCE,
        error: {
          code: 'forbidden',
          message: 'x',
          requiredScope: 'DeviceManagementManagedDevices.Read.All',
        },
      },
      NOW,
    );
    expect(part.findings.map((x) => [x.id, x.severity])).toEqual([
      ['registration-enrollmentFailures-forbidden', 'unknown'],
    ]);
  });
});
