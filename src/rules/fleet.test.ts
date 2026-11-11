/** M20/S1: Regeln der Compliance-/Konfigurations-Übersicht. */
import { describe, expect, it } from 'vitest';
import type {
  AuditEventEntry,
  ComplianceSettingSummariesInfo,
  DataSource,
  DeviceStateSummaryInfo,
  SectionResult,
} from '../domain/types';
import { COMPLIANCE_SUMMARY_FIELDS } from '../graph/dto';
import { de } from '../i18n/de';
import {
  AUDIT_COLUMNS,
  SUMMARY_SEGMENTS,
  actorLabel,
  changeBeforeProblems,
  changesForResource,
  evaluateTenantChanges,
  evaluateTenantCompliance,
  evaluateTenantConfiguration,
  summarySegments,
  summaryText,
  summaryTotal,
} from './fleet';
import { THRESHOLDS } from './thresholds';

const SOURCE: DataSource = { kind: 'graph', label: 'GET /deviceManagement/x' };
const LEARN_URL = /^https:\/\/learn\.microsoft\.com\//;
const ok = <T>(data: T): SectionResult<T> => ({
  status: 'ok',
  data,
  source: SOURCE,
  fetchedAt: '2026-11-10T12:00:00Z',
});

const compliance = (counts: DeviceStateSummaryInfo['counts']): DeviceStateSummaryInfo => ({
  kind: 'compliance',
  counts,
});
const noSettings: ComplianceSettingSummariesInfo = { settings: [], pagesRead: 1, truncated: false };
const settingsOk = ok(noSettings);
const forbidden = <T>(): SectionResult<T> => ({
  status: 'forbidden',
  source: SOURCE,
  error: {
    code: 'forbidden',
    message: 'x',
    httpStatus: 403,
    requiredScope: 'DeviceManagementConfiguration.Read.All',
  },
});
const unavailable = <T>(reason: string): SectionResult<T> => ({
  status: 'unavailable',
  source: SOURCE,
  reason,
});

describe('Compliance-Übersicht – Segmente', () => {
  it('jedes dokumentierte Zählerfeld hat ein Segment und eine deutsche Bezeichnung', () => {
    expect(SUMMARY_SEGMENTS.map((s) => s.field).sort()).toEqual(
      [...COMPLIANCE_SUMMARY_FIELDS].sort(),
    );
    for (const field of COMPLIANCE_SUMMARY_FIELDS) {
      expect(de.fleet.summary.count[field]).toBeTruthy();
    }
  });

  it('Anteile beziehen sich auf die Summe, nur Zähler > 0, Textalternative nennt Zahl und Prozent', () => {
    const summary = compliance({
      compliantDeviceCount: 80,
      nonCompliantDeviceCount: 20,
      errorDeviceCount: 0,
    });
    expect(summaryTotal(summary)).toBe(100);
    const segments = summarySegments(summary);
    expect(segments.map((s) => [s.field, s.count, s.share])).toEqual([
      ['compliantDeviceCount', 80, 0.8],
      ['nonCompliantDeviceCount', 20, 0.2],
    ]);
    expect(summaryText(summary)).toContain('Konform: 80');
    expect(summaryText(summary)).toContain('Nicht konform: 20');
  });

  it('Summe 0 → keine Segmente', () => {
    expect(summarySegments(compliance({ compliantDeviceCount: 0 }))).toEqual([]);
  });

  it('Konfigurationsprofile nennen „Erfolgreich“/„Fehlgeschlagen“ statt „Konform“', () => {
    const text = summaryText({
      kind: 'configuration',
      counts: { compliantDeviceCount: 3, nonCompliantDeviceCount: 1 },
    });
    expect(text).toContain('Erfolgreich: 3');
    expect(text).toContain('Fehlgeschlagen: 1');
  });
});

describe('Kachel „Compliance im Mandanten“ – Severity', () => {
  const tile = (counts: DeviceStateSummaryInfo['counts'], settings = settingsOk) =>
    evaluateTenantCompliance(ok(compliance(counts)), settings);

  it('alles konform → ok', () => {
    const t = tile({ compliantDeviceCount: 50 });
    expect(t.severity).toBe('ok');
    expect(t.value).toContain('100');
  });

  it('nicht konform unter dem eigenen Richtwert → Hinweis, kein „Prüfen“', () => {
    const t = tile({ compliantDeviceCount: 95, nonCompliantDeviceCount: 5 });
    expect(t.severity).toBe('ok');
    expect(t.findings.find((f) => f.id === 'tenantCompliance-nonCompliant')?.severity).toBe(
      'unknown',
    );
  });

  it('nicht konform ab dem Richtwert → warning, Richtwert als eigener gekennzeichnet', () => {
    const threshold = THRESHOLDS.tenantNonCompliantShareWarning;
    const t = tile({
      compliantDeviceCount: 90,
      nonCompliantDeviceCount: Math.round(100 * threshold),
    });
    expect(t.severity).toBe('warning');
    const finding = t.findings.find((f) => f.id === 'tenantCompliance-nonCompliant')!;
    expect(finding.detail).toContain('Eigener Richtwert');
    expect(finding.docsUrl).toMatch(LEARN_URL);
  });

  it('Fehler > 0 → warning mit Learn-Quelle; Konflikt > 0 → warning', () => {
    const error = tile({ compliantDeviceCount: 99, errorDeviceCount: 1 });
    expect(error.severity).toBe('warning');
    expect(error.findings.find((f) => f.id === 'tenantCompliance-error')?.docsUrl).toMatch(
      LEARN_URL,
    );
    const conflict = tile({ compliantDeviceCount: 99, conflictDeviceCount: 1 });
    expect(conflict.severity).toBe('warning');
    expect(conflict.findings.find((f) => f.id === 'tenantCompliance-conflict')?.docsUrl).toMatch(
      LEARN_URL,
    );
  });

  it('wird nie critical (Mandanten-Summe belegt kein einzelnes defektes Gerät)', () => {
    const t = tile({ compliantDeviceCount: 1, nonCompliantDeviceCount: 99, errorDeviceCount: 50 });
    expect(t.severity).toBe('warning');
  });

  it('keine Geräte gemeldet → unknown', () => {
    const t = tile({ compliantDeviceCount: 0 });
    expect(t.severity).toBe('unknown');
    expect(t.value).toBe(de.fleet.summary.valueNone);
  });

  it('„Häufigste Verstöße“: nur Einstellungen mit Verstößen, begrenzt, Rest ehrlich benannt', () => {
    const settings: ComplianceSettingSummariesInfo = {
      pagesRead: 3,
      truncated: true,
      settings: Array.from({ length: THRESHOLDS.tenantTopViolations + 2 }, (_, i) => ({
        id: `s${i}`,
        name: `setting${i}`,
        setting: null,
        platform: 'windows10AndLater' as const,
        platformRaw: 'windows10AndLater',
        nonCompliantDeviceCount: 100 - i,
        errorDeviceCount: 0,
        conflictDeviceCount: 0,
        compliantDeviceCount: 1,
      })).concat([
        {
          id: 'none',
          name: 'keine',
          setting: null,
          platform: 'iOS' as never,
          platformRaw: 'iOS',
          nonCompliantDeviceCount: 0,
          errorDeviceCount: 0,
          conflictDeviceCount: 0,
          compliantDeviceCount: 9,
        },
      ]),
    };
    const t = tile({ compliantDeviceCount: 10 }, ok(settings));
    const top = t.findings.find((f) => f.id === 'tenantCompliance-top')!;
    expect(top.table!.rows).toHaveLength(THRESHOLDS.tenantTopViolations);
    expect(top.table!.rows.flatMap((r) => r.cells)).not.toContain('keine');
    expect(top.detail).toContain(String(THRESHOLDS.tenantTopViolations + 2));
    expect(t.findings.some((f) => f.id === 'tenantCompliance-truncated')).toBe(true);
  });

  it('Einstellungen nicht abrufbar → Befund mit Grund, Kachel bleibt benutzbar', () => {
    const t = tile({ compliantDeviceCount: 10 }, forbidden<ComplianceSettingSummariesInfo>());
    expect(t.severity).toBe('ok');
    expect(t.findings.some((f) => f.id.startsWith('tenantCompliance-top'))).toBe(true);
  });

  it('Zusammenfassung forbidden/unavailable → Kachel zeigt den Zustand statt Daten', () => {
    const f = evaluateTenantCompliance(forbidden<DeviceStateSummaryInfo>(), settingsOk);
    expect(f.availability).toBe('forbidden');
    const u = evaluateTenantCompliance(
      unavailable<DeviceStateSummaryInfo>(de.fleet.reasons.summaryNotReported),
      settingsOk,
    );
    expect(u.availability).toBe('unavailable');
  });
});

describe('Kachel „Konfigurationsprofile im Mandanten“', () => {
  const tile = (counts: DeviceStateSummaryInfo['counts']) =>
    evaluateTenantConfiguration(ok({ kind: 'configuration', counts }));

  it('alles erfolgreich → ok; Fehler/Konflikte → warning; nicht erfolgreich allein → ok', () => {
    expect(tile({ compliantDeviceCount: 10 }).severity).toBe('ok');
    expect(tile({ compliantDeviceCount: 10, errorDeviceCount: 1 }).severity).toBe('warning');
    expect(tile({ compliantDeviceCount: 10, conflictDeviceCount: 1 }).severity).toBe('warning');
    expect(tile({ compliantDeviceCount: 10, nonCompliantDeviceCount: 4 }).severity).toBe('ok');
  });

  it('keine Zähler → unknown; Zähler-Tabelle nennt das Graph-Feld', () => {
    expect(tile({ compliantDeviceCount: 0 }).severity).toBe('unknown');
    const t = tile({ compliantDeviceCount: 2 });
    const counts = t.findings.find((f) => f.id === 'tenantConfiguration-counts')!;
    expect(counts.table!.rows.some((r) => r.cells.includes('compliantDeviceCount'))).toBe(true);
    expect(counts.docsUrl).toMatch(LEARN_URL);
  });
});

describe('Änderungsprotokoll (M20/S2)', () => {
  const NOW = new Date('2026-11-10T12:00:00Z');
  const entry = (
    id: string,
    daysAgo: number,
    extra: Partial<AuditEventEntry> = {},
  ): AuditEventEntry => ({
    id,
    activityDateTime: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    activity: 'Patch DeviceConfiguration',
    activityType: null,
    activityOperationType: 'Patch',
    activityResult: 'Success',
    category: 'DeviceConfiguration',
    componentName: 'DeviceConfiguration',
    correlationId: null,
    actor: { kind: 'user', name: 'admin@contoso.com', actorType: 'ItPro' },
    resources: [{ resourceId: 'P1', displayName: 'VPN', type: 'DeviceConfiguration' }],
    ...extra,
  });

  it(`zeigt nur Änderungen der letzten ${THRESHOLDS.auditWindowDays} Tage, mit allen Spalten`, () => {
    const tile = evaluateTenantChanges(
      ok({ events: [entry('a', 1), entry('b', 20)], pagesRead: 1, truncated: false }),
      NOW,
    );
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(de.fleet.audit.value(1));
    const list = tile.findings.find((f) => f.id === 'tenantChanges-list')!;
    expect(list.table!.columns).toEqual(AUDIT_COLUMNS);
    expect(list.table!.rows).toHaveLength(1);
    const cells = list.table!.rows[0]!.cells;
    expect(cells.slice(1)).toEqual([
      'Patch DeviceConfiguration',
      'DeviceConfiguration',
      'Success',
      'VPN (DeviceConfiguration)',
      'admin@contoso.com',
    ]);
    expect(list.table!.rows[0]!.cellLangs).toEqual([null, 'en', 'en', 'en', 'en', null]);
  });

  it('Anwendung wird als solche benannt, fehlender Auslöser ehrlich', () => {
    expect(
      actorLabel(entry('a', 1, { actor: { kind: 'application', name: 'Bot', actorType: null } })),
    ).toBe('Bot (Anwendung)');
    expect(
      actorLabel(entry('a', 1, { actor: { kind: 'unknown', name: null, actorType: null } })),
    ).toBe(de.fleet.audit.actor.unknown);
  });

  it('keine Änderung im Fenster, Seitengrenze → Hinweise; Fehler der Section → Kachel nicht verfügbar', () => {
    const tile = evaluateTenantChanges(ok({ events: [], pagesRead: 5, truncated: true }), NOW);
    expect(tile.severity).toBe('unknown');
    expect(tile.findings.map((f) => f.id)).toEqual([
      'tenantChanges-none',
      'tenantChanges-truncated',
    ]);
    const forbidden = evaluateTenantChanges(
      {
        status: 'forbidden',
        source: SOURCE,
        error: { code: 'forbidden', message: 'x', requiredScope: 'DeviceManagementApps.Read.All' },
      },
      NOW,
    );
    expect(forbidden.availability).toBe('forbidden');
  });

  it('Änderungen je Ressource (ID ohne Groß-/Kleinschreibung) und ruhiger Hinweis nur bei zeitlicher Nähe', () => {
    const info = {
      events: [entry('a', 2), entry('x', 1, { resources: [] })],
      pagesRead: 1,
      truncated: false,
    };
    const changes = changesForResource(info, 'p1');
    expect(changes.map((c) => c.id)).toEqual(['a']);
    const reported = (daysAgo: number) => ({
      lastReportedDateTime: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    });
    expect(changeBeforeProblems(changes, [reported(0.5), reported(3)])).toMatchObject({
      devices: 1,
    });
    // Meldung vor der Änderung oder ohne Zeitpunkt → kein Hinweis
    expect(changeBeforeProblems(changes, [reported(3), { lastReportedDateTime: null }])).toBeNull();
    // Meldung später als der Richtwert nach der Änderung → kein Hinweis
    const old = [entry('o', THRESHOLDS.auditChangeBeforeErrorDays + 3)];
    expect(changeBeforeProblems(old, [reported(0)])).toBeNull();
  });
});
