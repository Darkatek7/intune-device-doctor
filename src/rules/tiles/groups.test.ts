import { describe, expect, it } from 'vitest';
import type { DeviceGroupsInfo, DeviceSnapshot } from '../../domain/types';
import { de } from '../../i18n/de';
import { MockProvider } from '../../providers/mock/MockProvider';
import { deviceGroupsInfo } from '../../providers/mock/scenarios/helpers';
import { loadFullSnapshot } from '../../test/snapshot';
import { evaluateTiles } from '../evaluate';
import { evaluateGroups } from './groups';

const NOW = new Date('2026-10-15T12:00:00Z');
const t = de.rules.groups;
const SOURCE = {
  kind: 'graph',
  label: "GET /devices(deviceId='{deviceId}')/transitiveMemberOf",
} as const;

async function snapshotOf(name: string): Promise<DeviceSnapshot> {
  return loadFullSnapshot(new MockProvider({ latency: false, now: () => NOW }), name);
}
const withGroups = async (data: DeviceGroupsInfo): Promise<DeviceSnapshot> => ({
  ...(await snapshotOf('CONTOSO-PC001')),
  deviceGroups: { status: 'ok', data, source: SOURCE, fetchedAt: NOW.toISOString() },
});

describe('Gruppen', () => {
  it('lädt, solange die Section fehlt', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const tile = evaluateGroups({ device: base.device }, NOW);
    expect(tile.state).toBe('loading');
    expect(tile.sections).toEqual(['deviceGroups']);
  });

  it('informativ: Anzahl als Wert, Severity ok, Gruppen als Fakten, Grenze zu Benutzergruppen benannt', async () => {
    const tile = evaluateGroups(await snapshotOf('CONTOSO-PC001'), NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(t.value(3));
    expect(tile.findings).toEqual([]);
    expect(tile.facts.map((f) => f.label)).toEqual(
      expect.arrayContaining(['Contoso – Alle Geräte', t.facts.count, t.facts.scope]),
    );
  });

  it('ausgeblendete Gruppen (nur Typ + ID) → Hinweis, Anzahl zählt sie mit (CONTOSO-PC042)', async () => {
    const tile = evaluateGroups(await snapshotOf('CONTOSO-PC042'), NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(t.value(5));
    expect(tile.findings.map((f) => [f.id, f.severity])).toEqual([['groups-hidden', 'unknown']]);
    expect(tile.facts.find((f) => f.label === t.facts.hidden)?.value).toBe('2');
  });

  it('keine Gruppen → „Keine Gruppen“; abgeschnitten → Hinweis in den Fakten; lange Listen werden gekürzt', async () => {
    expect(evaluateGroups(await withGroups(deviceGroupsInfo([])), NOW).value).toBe(t.valueNone);
    const truncated = evaluateGroups(
      await withGroups(deviceGroupsInfo(['A'], { truncated: true })),
      NOW,
    );
    expect(truncated.facts.some((f) => f.label === t.facts.more)).toBe(true);
    const many = Array.from({ length: t.maxListed + 5 }, (_, i) => `G${i}`);
    const tile = evaluateGroups(await withGroups(deviceGroupsInfo(many)), NOW);
    expect(tile.facts.some((f) => f.label === t.moreListed(5))).toBe(true);
  });

  it('gilt für alle Plattformen und fällt unabhängig aus (403 bricht nur diese Kachel)', async () => {
    const mac = evaluateTiles(await snapshotOf('CONTOSO-MAC07'), NOW);
    expect(mac.map((x) => x.id)).toContain('groups');
    const base = await snapshotOf('CONTOSO-PC001');
    const forbidden = evaluateGroups(
      {
        ...base,
        deviceGroups: {
          status: 'forbidden',
          source: SOURCE,
          error: { code: 'forbidden', message: 'x', requiredScope: 'Device.Read.All' },
        },
      },
      NOW,
    );
    expect(forbidden.availability).toBe('forbidden');
    expect(forbidden.summary).toContain('Device.Read.All');
  });
});
