import { describe, expect, it } from 'vitest';
import type { DeviceSnapshot, SectionResult, SecurityAlertsInfo } from '../../domain/types';
import { de } from '../../i18n/de';
import { MockProvider } from '../../providers/mock/MockProvider';
import { securityAlert } from '../../providers/mock/scenarios/helpers';
import { loadFullSnapshot } from '../../test/snapshot';
import { evaluateTiles } from '../evaluate';
import { Docs } from '../knowledge/docs';
import { evaluateSecurityAlerts, MAX_ALERT_FINDINGS } from './securityAlerts';

const NOW = new Date('2026-10-15T12:00:00Z');
const t = de.rules.securityAlerts;
const SOURCE = { kind: 'graph', label: 'GET /security/alerts_v2' } as const;

async function snapshotOf(name: string): Promise<DeviceSnapshot> {
  return loadFullSnapshot(new MockProvider({ latency: false, now: () => NOW }), name);
}

const ok = (data: SecurityAlertsInfo): SectionResult<SecurityAlertsInfo> => ({
  status: 'ok',
  data,
  source: SOURCE,
  fetchedAt: NOW.toISOString(),
});
const info = (alerts: SecurityAlertsInfo['alerts'], extra: Partial<SecurityAlertsInfo> = {}) =>
  ok({ alerts, resolvedCount: 0, evaluated: 42, moreAvailable: false, ...extra });

describe('Sicherheitswarnungen – Kachel', () => {
  it('lädt, solange die Section fehlt', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const tile = evaluateSecurityAlerts({ device: base.device }, NOW);
    expect(tile.state).toBe('loading');
    expect(tile.sections).toEqual(['securityAlerts']);
  });

  it('keine offene Warnung → ok mit Hinweis, wie viele Warnungen geprüft wurden', async () => {
    const tile = evaluateSecurityAlerts(await snapshotOf('CONTOSO-PC001'), NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(t.valueNone);
    expect(tile.summary).toBe(t.summaryNone(42, false));
    expect(tile.findings.map((f) => [f.id, f.severity])).toEqual([
      ['securityAlerts-none', 'unknown'],
    ]);
    expect(tile.findings[0]!.detail).toBe(t.noneDetail(42, false, 0));
    expect(tile.findings[0]!.docsUrl).toBe(Docs.securityAlertsList);
  });

  it('offene Warnung high → critical, medium → warning, low/informational → Hinweis; Kachel zeigt die schlimmste', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const run = (severities: Array<'high' | 'medium' | 'low' | 'informational' | 'unknown'>) =>
      evaluateSecurityAlerts(
        {
          ...base,
          securityAlerts: info(
            severities.map((severity, index) =>
              securityAlert(NOW, index, `A${index}`, { severity }),
            ),
          ),
        },
        NOW,
      );
    expect(run(['low', 'high', 'medium']).severity).toBe('critical');
    expect(run(['low', 'medium']).severity).toBe('warning');
    const hints = run(['low', 'informational', 'unknown']);
    expect(hints.severity).toBe('ok');
    expect(hints.findings.every((f) => f.severity === 'unknown')).toBe(true);
    const mixed = run(['low', 'high', 'medium']);
    expect(mixed.findings.map((f) => f.severity)).toEqual(['critical', 'warning', 'unknown']);
    expect(mixed.value).toBe(t.valueOpen(3));
    expect(mixed.summary).toBe(t.summary(3, 1, 1));
  });

  it('Befund je Warnung: Titel, Schweregrad/Status, Quelle, Learn-Link, Link ins Defender-Portal', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const alert = securityAlert(NOW, 7, 'Suspicious PowerShell command line', {
      severity: 'high',
      status: 'inProgress',
      categories: ['Execution'],
      matchedBy: 'deviceName',
    });
    const tile = evaluateSecurityAlerts({ ...base, securityAlerts: info([alert]) }, NOW);
    const finding = tile.findings[0]!;
    expect(finding.id).toBe(`securityAlerts-alert-${alert.id}`);
    expect(finding.title).toBe('Suspicious PowerShell command line');
    expect(finding.detail).toContain('Schweregrad: Hoch');
    expect(finding.detail).toContain('Status: In Bearbeitung');
    expect(finding.detail).toContain('Kategorien: Execution');
    expect(finding.detail).toContain('Gerätenamen');
    expect(finding.cause).toBe(t.causeBySeverity.high);
    expect(finding.remediation.length).toBeGreaterThanOrEqual(1);
    expect(finding.docsUrl).toBe(Docs.defenderAlertsQueue);
    expect(finding.links).toEqual([{ label: de.links.openInDefender, url: alert.alertWebUrl }]);
    expect(finding.source).toEqual(SOURCE);
    // Rohwerte als Beleg, aber ohne Personenbezug
    expect(finding.evidence).toMatchObject({
      alertId: alert.id,
      severity: 'high',
      matchedBy: 'deviceName',
    });
  });

  it('Warnung ohne Titel und ohne Portal-Link: Platzhaltertitel, keine Links', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const tile = evaluateSecurityAlerts(
      {
        ...base,
        securityAlerts: info([securityAlert(NOW, 1, 'x', { title: null, alertWebUrl: null })]),
      },
      NOW,
    );
    expect(tile.findings[0]!.title).toBe(t.untitled);
    expect(tile.findings[0]!.links).toEqual([]);
  });

  it(`zeigt höchstens ${MAX_ALERT_FINDINGS} Warnungen einzeln, schwerste zuerst, den Rest als Hinweis`, async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const alerts = Array.from({ length: 8 }, (_, i) =>
      securityAlert(NOW, i, `A${i}`, { severity: i === 7 ? 'high' : 'low' }),
    );
    const tile = evaluateSecurityAlerts({ ...base, securityAlerts: info(alerts) }, NOW);
    const single = tile.findings.filter((f) => f.id.startsWith('securityAlerts-alert-'));
    expect(single).toHaveLength(MAX_ALERT_FINDINGS);
    expect(single[0]!.title).toBe('A7');
    const more = tile.findings.find((f) => f.id === 'securityAlerts-more')!;
    expect(more.title).toBe(t.moreTitle(3));
    expect(tile.value).toBe(t.valueOpen(8));
  });

  it('weitere Seiten nicht gelesen → Hinweis „nur die neuesten Warnungen geprüft“ (auch ohne offene Warnung)', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const tile = evaluateSecurityAlerts(
      {
        ...base,
        securityAlerts: info([], { evaluated: 300, moreAvailable: true, resolvedCount: 2 }),
      },
      NOW,
    );
    expect(tile.severity).toBe('ok');
    expect(tile.findings.map((f) => f.id).sort()).toEqual([
      'securityAlerts-none',
      'securityAlerts-partial',
    ]);
    expect(tile.findings.find((f) => f.id === 'securityAlerts-none')!.detail).toBe(
      t.noneDetail(300, true, 2),
    );
    expect(tile.findings.find((f) => f.id === 'securityAlerts-partial')!.detail).toBe(
      t.partialDetail(300),
    );
    expect(tile.facts).toContainEqual({
      label: t.facts.evaluated,
      value: t.facts.evaluatedMore(300),
    });
    expect(tile.facts).toContainEqual({ label: t.facts.resolved, value: '2' });
  });

  it('Geräterisiko aus der Evidenz erscheint als Kennzahl', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const tile = evaluateSecurityAlerts(
      { ...base, securityAlerts: info([securityAlert(NOW, 1, 'A', { deviceRiskScore: 'high' })]) },
      NOW,
    );
    expect(tile.facts).toContainEqual({ label: t.facts.deviceRisk, value: 'hoch' });
    expect(tile.facts).toContainEqual({ label: t.facts.highMedium, value: '0 / 1' });
  });

  it('fehlende Berechtigung → Fehlende-Berechtigung-Befund mit Scope und Rollenhinweis', async () => {
    const base = await snapshotOf('CONTOSO-PC050');
    const tile = evaluateSecurityAlerts(base, NOW);
    expect(tile.availability).toBe('forbidden');
    expect(tile.severity).toBe('unknown');
    const finding = tile.findings[0]!;
    expect(finding.id).toBe('securityAlerts-forbidden');
    expect(finding.evidence?.requiredScope).toBe('SecurityAlert.Read.All');
    expect(finding.remediation.join(' ')).toContain('Security Reader');
  });

  it('Demo CONTOSO-PC027: offene Warnungen (high + low) → critical; behobene ausgeblendet', async () => {
    const tile = evaluateSecurityAlerts(await snapshotOf('CONTOSO-PC027'), NOW);
    expect(tile.severity).toBe('critical');
    expect(tile.findings.map((f) => f.severity)).toEqual(['critical', 'unknown']);
    expect(tile.facts).toContainEqual({ label: t.facts.resolved, value: '1' });
  });

  it('alle Betriebssysteme bekommen die Kachel; sie ist Teil von evaluateTiles', async () => {
    for (const name of ['CONTOSO-PC001', 'CONTOSO-MAC07', 'CONTOSO-IP015', 'CONTOSO-AND21']) {
      const tiles = evaluateTiles(await snapshotOf(name), NOW);
      expect(
        tiles.some((tile) => tile.id === 'securityAlerts'),
        name,
      ).toBe(true);
    }
  });
});
