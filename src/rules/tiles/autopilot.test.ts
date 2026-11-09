import { describe, expect, it } from 'vitest';
import type { AutopilotInfo, DeviceSnapshot, SectionResult } from '../../domain/types';
import { de } from '../../i18n/de';
import { MockProvider } from '../../providers/mock/MockProvider';
import { autopilotInfo } from '../../providers/mock/scenarios/helpers';
import { loadFullSnapshot } from '../../test/snapshot';
import { evaluateTiles } from '../evaluate';
import { evaluateAutopilot } from './autopilot';

const NOW = new Date('2026-10-15T12:00:00Z');
const t = de.rules.autopilot;
const SOURCE = {
  kind: 'graph',
  label: 'GET /deviceManagement/windowsAutopilotDeviceIdentities',
} as const;

async function snapshotOf(name: string): Promise<DeviceSnapshot> {
  return loadFullSnapshot(new MockProvider({ latency: false, now: () => NOW }), name);
}
const withAutopilot = async (data: AutopilotInfo | null): Promise<DeviceSnapshot> => ({
  ...(await snapshotOf('CONTOSO-PC001')),
  autopilot: { status: 'ok', data, source: SOURCE, fetchedAt: NOW.toISOString() },
});

describe('Autopilot', () => {
  it('lädt, solange die Section fehlt', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const tile = evaluateAutopilot({ device: base.device }, NOW);
    expect(tile.state).toBe('loading');
    expect(tile.sections).toEqual(['autopilot']);
  });

  it('registriert und eingeschrieben → ok mit Group Tag, Status und Hinweis auf das nicht lesbare Profil', async () => {
    const tile = evaluateAutopilot(await snapshotOf('CONTOSO-PC001'), NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(t.valueRegistered);
    expect(tile.findings).toEqual([]);
    const fact = (label: string) => tile.facts.find((f) => f.label === label)?.value;
    expect(fact(t.facts.groupTag)).toBe('Contoso-Standard');
    expect(fact(t.facts.enrollmentState)).toBe(t.states.enrolled);
    expect(fact(t.facts.profile)).toBe(t.facts.profileUnavailable);
  });

  it('enrollmentState failed → warning (CONTOSO-LT108)', async () => {
    const tile = evaluateAutopilot(await snapshotOf('CONTOSO-LT108'), NOW);
    expect(tile.severity).toBe('warning');
    expect(tile.value).toBe(t.valueFailed);
    expect(tile.findings.map((f) => f.id)).toEqual(['autopilot-failed']);
    expect(tile.findings[0]!.docsUrl).toMatch(/^https:\/\/learn\.microsoft\.com\//);
  });

  it('andere Status (pendingReset, notContacted) sind nur Fakten, kein Befund', async () => {
    for (const enrollmentState of ['pendingReset', 'notContacted', 'unknown'] as const) {
      const tile = evaluateAutopilot(
        await withAutopilot(autopilotInfo(NOW, { enrollmentState })),
        NOW,
      );
      expect(tile.severity).toBe('ok');
      expect(tile.findings).toEqual([]);
    }
  });

  it('nicht registriert → neutraler Hinweis (unknown), Kachel bleibt ok (CONTOSO-PC033)', async () => {
    const tile = evaluateAutopilot(await snapshotOf('CONTOSO-PC033'), NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(t.valueNotRegistered);
    expect(tile.findings.map((f) => [f.id, f.severity])).toEqual([
      ['autopilot-notRegistered', 'unknown'],
    ]);
  });

  it('403 → „Fehlende Berechtigung“ mit Scope DeviceManagementServiceConfig.Read.All (CONTOSO-PC050)', async () => {
    const tile = evaluateAutopilot(await snapshotOf('CONTOSO-PC050'), NOW);
    expect(tile.availability).toBe('forbidden');
    expect(tile.summary).toContain('DeviceManagementServiceConfig.Read.All');
  });

  it('Seitengrenze erreicht (unavailable) wird ehrlich ausgewiesen; Kachel nur für Windows', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const unavailable: SectionResult<AutopilotInfo | null> = {
      status: 'unavailable',
      reason: de.reasons.autopilotNotFoundInLimit(5),
      source: SOURCE,
    };
    const tile = evaluateAutopilot({ ...base, autopilot: unavailable }, NOW);
    expect(tile.availability).toBe('unavailable');
    expect(tile.summary).toContain('nicht gefunden');
    expect(evaluateTiles(await snapshotOf('CONTOSO-MAC07'), NOW).map((x) => x.id)).not.toContain(
      'autopilot',
    );
  });
});
