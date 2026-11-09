import { describe, expect, it } from 'vitest';
import type {
  DeviceSnapshot,
  DuplicateDevicesInfo,
  SameNameEntraDevice,
  SectionResult,
} from '../../domain/types';
import { de } from '../../i18n/de';
import { MockProvider } from '../../providers/mock/MockProvider';
import { loadFullSnapshot } from '../../test/snapshot';
import { Docs } from '../knowledge/docs';
import { evaluateDeviceStatus } from './deviceStatus';

const NOW = new Date('2026-10-15T12:00:00Z');
const t = de.rules.duplicates;

async function snapshotOf(name: string): Promise<DeviceSnapshot> {
  return loadFullSnapshot(new MockProvider({ latency: false, now: () => NOW }), name);
}

function entry(overrides: Partial<SameNameEntraDevice>): SameNameEntraDevice {
  return {
    objectId: 'obj',
    deviceId: 'dev',
    trustType: 'AzureAd',
    accountEnabled: true,
    approximateLastSignInDateTime: '2026-10-14T12:00:00Z',
    isCompliant: true,
    isManaged: true,
    registrationDateTime: '2026-01-01T00:00:00Z',
    operatingSystem: 'Windows',
    isCurrent: false,
    differentOs: false,
    ...overrides,
  };
}

function withDuplicates(snapshot: DeviceSnapshot, data: DuplicateDevicesInfo): DeviceSnapshot {
  const base = snapshot.duplicateDevices;
  if (!base || base.status !== 'ok') throw new Error('Basis-Section fehlt');
  return { ...snapshot, duplicateDevices: { ...base, data } };
}

function withSection(
  snapshot: DeviceSnapshot,
  section: SectionResult<DuplicateDevicesInfo>,
): DeviceSnapshot {
  return { ...snapshot, duplicateDevices: section };
}

describe('Gerätestatus – gleichnamige Entra-Objekte (M14/S1)', () => {
  it('Demo CONTOSO-PC014: Dual State (ServerAd + Workplace) → Warnung mit Tabelle, aktuelles Objekt markiert', async () => {
    const tile = evaluateDeviceStatus(await snapshotOf('CONTOSO-PC014'), NOW);
    expect(tile.severity).toBe('warning');
    expect(tile.value).toBe(t.valueDualState);
    const finding = tile.findings.find((f) => f.id === 'deviceStatus-dualState')!;
    expect(finding.severity).toBe('warning');
    expect(finding.docsUrl).toBe(Docs.entraDualStateFaq);
    expect(finding.docsUrl).toMatch(/^https:\/\/learn\.microsoft\.com\//);
    expect(finding.links?.[0]?.url).toBe(Docs.hybridJoinReviewThingsToKnow);
    expect(finding.table?.columns).toEqual([
      t.columns.trustType,
      t.columns.enabled,
      t.columns.lastSignIn,
      t.columns.compliant,
      t.columns.registered,
      t.columns.note,
    ]);
    expect(finding.table?.rows).toHaveLength(2);
    const [current, other] = finding.table!.rows;
    expect(current!.highlight).toBe(true);
    expect(current!.cells[0]).toBe(de.rules.trustType.ServerAd);
    expect(current!.cells[5]).toBe(t.noteCurrent);
    expect(other!.highlight).toBeFalsy();
    expect(other!.cells[0]).toBe(de.rules.trustType.Workplace);
    expect(tile.facts).toContainEqual({ label: t.factCount, value: '2' });
    expect(tile.sources.map((s) => s.label)).toContain(
      "GET /devices?$filter=displayName eq '{deviceName}'",
    );
  });

  it('Standard: genau ein Objekt → kein Befund, Fakt „1“', async () => {
    const tile = evaluateDeviceStatus(await snapshotOf('CONTOSO-PC001'), NOW);
    expect(tile.findings.some((f) => f.id.startsWith('deviceStatus-dual'))).toBe(false);
    expect(tile.findings.some((f) => f.id.startsWith('deviceStatus-dup'))).toBe(false);
    expect(tile.facts).toContainEqual({ label: t.factCount, value: '1' });
    expect(tile.severity).toBe('ok');
  });

  it('andere Duplikate (zwei AzureAd-Objekte) → Hinweis (kein Problem) mit Ursachen laut Entra-FAQ', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const snapshot = withDuplicates(base, {
      moreAvailable: false,
      devices: [
        entry({ objectId: 'a', deviceId: base.device.azureADDeviceId, isCurrent: true }),
        entry({ objectId: 'b', deviceId: 'other', registrationDateTime: '2025-01-01T00:00:00Z' }),
      ],
    });
    const tile = evaluateDeviceStatus(snapshot, NOW);
    const finding = tile.findings.find((f) => f.id === 'deviceStatus-duplicates')!;
    expect(finding.severity).toBe('unknown');
    expect(finding.cause).toContain('erneut');
    expect(finding.docsUrl).toBe(Docs.entraDuplicateEntriesFaq);
    expect(finding.table?.rows).toHaveLength(2);
    expect(tile.severity).toBe('ok');
    expect(tile.value).not.toBe(t.valueDualState);
  });

  it('gleicher Name, anderes Betriebssystem → nur „gleichnamig“, kein Duplikat und kein Dual State', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const snapshot = withDuplicates(base, {
      moreAvailable: false,
      devices: [
        entry({
          objectId: 'a',
          deviceId: base.device.azureADDeviceId,
          isCurrent: true,
          trustType: 'ServerAd',
        }),
        entry({
          objectId: 'm',
          trustType: 'Workplace',
          operatingSystem: 'MacMDM',
          differentOs: true,
        }),
      ],
    });
    const tile = evaluateDeviceStatus(snapshot, NOW);
    expect(tile.findings.map((f) => f.id)).toContain('deviceStatus-sameName');
    expect(tile.findings.some((f) => f.id === 'deviceStatus-dualState')).toBe(false);
    expect(tile.findings.some((f) => f.id === 'deviceStatus-duplicates')).toBe(false);
    expect(tile.facts).toContainEqual({ label: t.factCount, value: '1' });
    expect(tile.facts).toContainEqual({ label: t.factSameNameOtherOs, value: '1' });
    expect(tile.severity).toBe('ok');
    const row = tile.findings.find((f) => f.id === 'deviceStatus-sameName')!.table!.rows[1]!;
    expect(row.cells[5]).toBe(t.noteOtherOs);
  });

  it('weitere Seiten vorhanden → ehrlicher Hinweis im Befund und als Fakt', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const snapshot = withDuplicates(base, {
      moreAvailable: true,
      devices: [
        entry({ objectId: 'a', deviceId: base.device.azureADDeviceId, isCurrent: true }),
        entry({ objectId: 'b', deviceId: 'x' }),
      ],
    });
    const tile = evaluateDeviceStatus(snapshot, NOW);
    expect(tile.findings.find((f) => f.id === 'deviceStatus-duplicates')!.detail).toContain(
      t.moreNote,
    );
    expect(tile.facts).toContainEqual({ label: t.factMore, value: t.factMoreValue });
  });

  it.each(['forbidden', 'unavailable', 'error'] as const)(
    'Section %s bricht die Kachel nicht: Hinweis statt Befund, Gerätestatus bleibt auswertbar',
    async (status) => {
      const base = await snapshotOf('CONTOSO-PC001');
      const source = { kind: 'graph' as const, label: 'GET /devices' };
      const section: SectionResult<DuplicateDevicesInfo> =
        status === 'forbidden'
          ? {
              status,
              source,
              error: { code: 'forbidden', message: 'x', requiredScope: 'Device.Read.All' },
            }
          : status === 'unavailable'
            ? { status, source, reason: 'nicht verfügbar' }
            : { status, source, error: { code: 'graph', message: 'Fehler' } };
      const tile = evaluateDeviceStatus(withSection(base, section), NOW);
      expect(tile.state).toBe('ready');
      expect(tile.severity).toBe('ok');
      expect(tile.findings.map((f) => f.id)).toContain(`deviceStatus-duplicates-${status}`);
      expect(tile.sections).toContain('duplicateDevices');
    },
  );

  it('lädt, solange die Section fehlt', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const { duplicateDevices: _omit, ...rest } = base;
    void _omit;
    expect(evaluateDeviceStatus(rest, NOW).state).toBe('loading');
  });
});
