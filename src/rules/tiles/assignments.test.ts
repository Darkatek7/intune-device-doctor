import { describe, expect, it } from 'vitest';
import type { AssignmentsInfo, DeviceSnapshot, SectionResult } from '../../domain/types';
import { de } from '../../i18n/de';
import { MockProvider } from '../../providers/mock/MockProvider';
import { demoGuid } from '../../providers/mock/scenarios/helpers';
import { loadFullSnapshot } from '../../test/snapshot';
import { Docs } from '../knowledge/docs';
import { evaluateApps } from './apps';
import { evaluatePolicies } from './policies';

const NOW = new Date('2026-10-15T12:00:00Z');
const t = de.rules.assignments;
const SOURCE = { kind: 'graph', label: 'GET …/{id}/assignments' } as const;

async function snapshotOf(name: string): Promise<DeviceSnapshot> {
  return loadFullSnapshot(new MockProvider({ latency: false, now: () => NOW }), name);
}

const ok = (data: AssignmentsInfo): SectionResult<AssignmentsInfo> => ({
  status: 'ok',
  data,
  source: SOURCE,
  fetchedAt: NOW.toISOString(),
});

describe('Zuweisungen – Richtlinien-Kachel', () => {
  it('Demo CONTOSO-PC042: Tabelle mit Gerätegruppe, „Alle Geräte“ und Benutzergruppe (Hinweis, kein Problem)', async () => {
    const tile = evaluatePolicies(await snapshotOf('CONTOSO-PC042'), NOW);
    const finding = tile.findings.find((f) => f.id === 'policies-assignments')!;
    expect(finding.severity).toBe('unknown');
    expect(finding.title).toBe(t.policiesTitle);
    expect(finding.docsUrl).toBe(Docs.configurationAssignmentsList);
    expect(finding.table?.columns).toEqual([t.columns.name, t.columns.kind, t.columns.assignment]);
    const byName = Object.fromEntries(finding.table!.rows.map((r) => [r.cells[0], r.cells]));
    expect(byName['Contoso – Windows 11 Basis-Compliance']).toEqual([
      'Contoso – Windows 11 Basis-Compliance',
      t.kinds.compliance,
      t.viaDeviceGroup('Contoso – Windows-Geräte'),
    ]);
    expect(byName['Contoso – Defender & BitLocker']![2]).toBe(t.allDevices);
    // Benutzergruppe: Gerät ist nicht Mitglied; 2 Gruppennamen sind unlesbar → eigener Wortlaut
    expect(byName['Contoso – VPN Always On']![2]).toBe(t.groupNoMembershipHidden);
    expect(finding.detail).toContain(t.unavailableNote);
    expect(tile.facts.some((f) => f.label === t.factChecked)).toBe(true);
    expect(tile.sections).toContain('assignments');
  });

  it('Ausschluss über Gerätegruppe, Gerät ist Mitglied, Zustand ≠ „Nicht zutreffend“ → Hinweis', async () => {
    const tile = evaluatePolicies(await snapshotOf('CONTOSO-PC042'), NOW);
    const hint = tile.findings.find((f) => f.id === `policies-excluded-${demoGuid('policy', 21)}`)!;
    expect(hint.severity).toBe('unknown');
    expect(hint.detail).toBe(t.excludedDetail('Contoso – Pilot', t.stateLabels.policy.conflict!));
    expect(hint.docsUrl).toBe(Docs.assignPolicyExcludeGroups);
    expect(hint.evidence).toMatchObject({
      excludedGroup: 'Contoso – Pilot',
      reportedState: 'conflict',
    });
    const row = tile.findings
      .find((f) => f.id === 'policies-assignments')!
      .table!.rows.find((r) => r.cells[0] === 'Contoso – Edge Sicherheitsbaseline')!;
    expect(row.highlight).toBe(true);
    expect(row.cells[2]).toContain(t.excludedViaDeviceGroup('Contoso – Pilot'));
  });

  it('Ausschluss und Zustand „Nicht zutreffend“ → kein Hinweis', async () => {
    const base = await snapshotOf('CONTOSO-PC042');
    const excluded = base.configurationPolicies!;
    if (excluded.status !== 'ok') throw new Error('Szenario');
    const snapshot: DeviceSnapshot = {
      ...base,
      configurationPolicies: {
        ...excluded,
        data: excluded.data.map((p) =>
          p.id === demoGuid('policy', 21) ? { ...p, state: 'notApplicable' } : p,
        ),
      },
    };
    const tile = evaluatePolicies(snapshot, NOW);
    expect(tile.findings.some((f) => f.id.startsWith('policies-excluded-'))).toBe(false);
  });

  it('Gerätegruppen nicht lesbar → Gruppen werden als „nicht prüfbar“ ausgewiesen, nichts erfunden', async () => {
    const base = await snapshotOf('CONTOSO-PC042');
    const snapshot: DeviceSnapshot = {
      ...base,
      deviceGroups: {
        status: 'forbidden',
        error: { code: 'forbidden', message: 'x', requiredScope: 'Device.Read.All' },
        source: SOURCE,
      },
    };
    const tile = evaluatePolicies(snapshot, NOW);
    const rows = tile.findings.find((f) => f.id === 'policies-assignments')!.table!.rows;
    expect(rows.some((r) => r.cells[2]?.includes(t.groupUnchecked))).toBe(true);
    expect(rows.some((r) => r.cells[2]?.includes(t.exclusionUnchecked))).toBe(true);
    expect(tile.findings.some((f) => f.id.startsWith('policies-excluded-'))).toBe(false);
  });

  it('nicht auswertbare Objekte (404, keine Objekt-ID, Fehler) und Obergrenze werden ehrlich benannt', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const policy = (
      kind: 'compliance' | 'configuration',
      n: number,
      status: 'notFound' | 'notEvaluable' | 'error',
    ) => ({
      kind,
      id: demoGuid('policy', n),
      displayName: `Richtlinie ${n}`,
      status,
      assignments: [],
    });
    const snapshot: DeviceSnapshot = {
      ...base,
      assignments: ok({
        skipped: 3,
        objects: [
          policy('compliance', 1, 'notFound'),
          policy('configuration', 2, 'notEvaluable'),
          policy('configuration', 3, 'error'),
          {
            kind: 'configuration',
            id: demoGuid('policy', 4),
            displayName: 'Ohne Ziel',
            status: 'ok',
            assignments: [],
          },
        ],
      }),
    };
    const tile = evaluatePolicies(snapshot, NOW);
    const finding = tile.findings.find((f) => f.id === 'policies-assignments')!;
    expect(finding.table!.rows.map((r) => r.cells[2])).toEqual([
      t.notFound,
      t.notEvaluable,
      t.error,
      t.noAssignments,
    ]);
    expect(finding.detail).toContain(t.skippedNote(3));
    expect(tile.facts).toContainEqual({ label: t.factChecked, value: t.factCheckedValue(1, 4) });
  });

  it('Section forbidden/unavailable/noch nicht geladen → kein Befund, Kachel blockiert nicht', async () => {
    const base = await snapshotOf('CONTOSO-PC042');
    for (const assignments of [
      undefined,
      { status: 'forbidden', error: { code: 'forbidden', message: 'x' }, source: SOURCE },
      { status: 'unavailable', reason: 'x', source: SOURCE },
      { status: 'notApplicable', reason: 'x', source: SOURCE },
    ] as const) {
      const tile = evaluatePolicies({ ...base, assignments }, NOW);
      expect(tile.state).toBe('ready');
      expect(tile.findings.some((f) => f.id.includes('assignments'))).toBe(false);
      expect(tile.severity).toBe('critical'); // PC042 bleibt „Probleme“ – Zuweisungen ändern die Bewertung nie
    }
  });

  it('Zuweisungen ändern die Severity nie: gesundes Gerät bleibt ok', async () => {
    const tile = evaluatePolicies(await snapshotOf('CONTOSO-PC001'), NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.findings.find((f) => f.id === 'policies-assignments')?.severity).toBe('unknown');
  });
});

describe('Zuweisungen – Apps-Kachel', () => {
  it('Demo CONTOSO-PC042: App-Tabelle mit Absicht und Ziel (Benutzergruppe, „Alle Benutzer“)', async () => {
    const tile = evaluateApps(await snapshotOf('CONTOSO-PC042'), NOW);
    const finding = tile.findings.find((f) => f.id === 'apps-assignments')!;
    expect(finding.severity).toBe('unknown');
    expect(finding.title).toBe(t.appsTitle);
    expect(finding.docsUrl).toBe(Docs.mobileAppAssignmentsList);
    const byName = Object.fromEntries(finding.table!.rows.map((r) => [r.cells[0], r.cells]));
    expect(byName['Contoso VPN Client 5.1']).toEqual([
      'Contoso VPN Client 5.1',
      t.kinds.app,
      `${t.intents.required}: ${t.groupNoMembershipHidden}`,
    ]);
    expect(byName['Fabrikam PDF Studio 12']![2]).toBe(`${t.intents.available}: ${t.allUsers}`);
    expect(tile.facts.some((f) => f.label === t.factChecked)).toBe(true);
    expect(tile.findings.some((f) => f.id === 'apps-beta')).toBe(true);
    expect(tile.findings.some((f) => f.id.startsWith('policies-'))).toBe(false);
  });

  it('Richtlinien-Objekte erscheinen nicht in der Apps-Kachel (und umgekehrt)', async () => {
    const snapshot = await snapshotOf('CONTOSO-PC042');
    const apps = evaluateApps(snapshot, NOW).findings.find((f) => f.id === 'apps-assignments')!;
    const policies = evaluatePolicies(snapshot, NOW).findings.find(
      (f) => f.id === 'policies-assignments',
    )!;
    expect(apps.table!.rows.every((r) => r.cells[1] === t.kinds.app)).toBe(true);
    expect(policies.table!.rows.every((r) => r.cells[1] !== t.kinds.app)).toBe(true);
  });

  it('Demo CONTOSO-PC050: Zuweisungen forbidden → Scope im Sheet-Hinweis, Kachel bleibt auswertbar', async () => {
    const snapshot = await snapshotOf('CONTOSO-PC050');
    expect(snapshot.assignments?.status).toBe('forbidden');
    const tile = evaluateApps(snapshot, NOW);
    expect(tile.findings.some((f) => f.id === 'apps-assignments')).toBe(false);
  });
});
