/** M20/S4: letzte Remote-Aktionen im Gerätestatus und in der Zeitachse. */
import { describe, expect, it } from 'vitest';
import type { DeviceActionResultInfo, DeviceSnapshot } from '../../domain/types';
import { mapDeviceActionResults, mapManagedDevice } from '../../graph/mappers';
import { pc001Device } from '../../providers/graph/fakeGraph';
import { de } from '../../i18n/de';
import { MockProvider } from '../../providers/mock/MockProvider';
import { loadFullSnapshot } from '../../test/snapshot';
import { Docs } from '../knowledge/docs';
import { THRESHOLDS } from '../thresholds';
import { buildTimeline } from '../timeline';
import { evaluateDeviceStatus } from './deviceStatus';
import { isWipeOrRetire, recentActions, remoteActionsContribution } from './remoteActions';

const NOW = new Date('2026-11-10T12:00:00Z');
const t = de.fleet.remoteActions;
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

async function snapshotOf(name: string): Promise<DeviceSnapshot> {
  return loadFullSnapshot(new MockProvider({ latency: false, now: () => NOW }), name);
}

const action = (values: Partial<DeviceActionResultInfo>): DeviceActionResultInfo => ({
  actionName: 'syncDevice',
  actionState: 'done',
  actionStateRaw: 'done',
  startDateTime: daysAgo(1),
  lastUpdatedDateTime: daysAgo(1),
  ...values,
});

async function withActions(actionResults: DeviceActionResultInfo[] | undefined) {
  const base = await snapshotOf('CONTOSO-PC001');
  return { ...base, device: { ...base.device, actionResults } };
}

describe('mapDeviceActionResults (M20/S4)', () => {
  it('übernimmt dokumentierte Felder, actionName als Rohwert, unbekannter Zustand → unknown + Rohwert', () => {
    const mapped = mapDeviceActionResults([
      {
        actionName: 'rebootNow',
        actionState: 'failed',
        lastUpdatedDateTime: '2026-11-08T00:00:00Z',
      },
      {
        actionName: ' retire ',
        actionState: 'somethingNew',
        startDateTime: '2026-11-09T00:00:00Z',
      },
      { actionState: 'done', startDateTime: 'kein Datum' },
    ]);
    expect(mapped[0]).toMatchObject({
      actionName: 'retire',
      actionState: 'unknown',
      actionStateRaw: 'somethingNew',
    });
    expect(mapped[1]).toMatchObject({ actionName: 'rebootNow', actionState: 'failed' });
    expect(mapped[2]).toMatchObject({ actionName: null, startDateTime: null });
  });

  it('managedDevice ohne deviceActionResults → kein Feld; mit Liste → actionResults', () => {
    expect(mapManagedDevice(pc001Device()).actionResults).toBeUndefined();
    const device = mapManagedDevice(
      pc001Device({ deviceActionResults: [{ actionName: 'syncDevice', actionState: 'done' }] }),
    );
    expect(device.actionResults).toHaveLength(1);
  });
});

describe('Remote-Aktionen im Gerätestatus (M20/S4)', () => {
  it('ohne Aktionen bzw. nur ältere als der Richtwert → kein Beitrag', async () => {
    expect(remoteActionsContribution(await withActions(undefined), NOW).findings).toEqual([]);
    const old = action({ lastUpdatedDateTime: daysAgo(THRESHOLDS.remoteActionRecentDays + 1) });
    expect(remoteActionsContribution(await withActions([old]), NOW).findings).toEqual([]);
    expect(recentActions([old], NOW)).toEqual([]);
  });

  it('erfolgreiche Aktion → Tabelle (In Ordnung), Aktionsname lang=en, Hinweis „löst keine Aktion aus“', async () => {
    const snapshot = await withActions([action({})]);
    const tile = evaluateDeviceStatus(snapshot, NOW);
    expect(tile.severity).toBe('ok');
    const list = tile.findings.find((f) => f.id === 'deviceStatus-actions')!;
    expect(list.severity).toBe('ok');
    expect(list.detail).toContain(t.readOnlyNote);
    expect(list.table!.rows[0]!.cells[0]).toBe('syncDevice');
    expect(list.table!.rows[0]!.cellLangs![0]).toBe('en');
    expect(list.table!.rows[0]!.cells[1]).toBe(t.state.done);
    expect(list.docsUrl).toBe(Docs.deviceActions);
  });

  it('fehlgeschlagene Aktion → Prüfen mit Quelle', async () => {
    const tile = evaluateDeviceStatus(
      await withActions([
        action({ actionName: 'rebootNow', actionState: 'failed', actionStateRaw: 'failed' }),
      ]),
      NOW,
    );
    expect(tile.severity).toBe('warning');
    const failed = tile.findings.find((f) => f.id === 'deviceStatus-action-failed-0')!;
    expect(failed.title).toBe(t.failedTitle('rebootNow'));
    expect(failed.detail).toContain(t.readOnlyNote);
    expect(failed.docsUrl).toBe(Docs.deviceActionsTroubleshooting);
    expect(tile.value).toBe(t.valueFailed);
  });

  it('laufendes Zurücksetzen/Abkoppeln → deutlicher Hinweis; abgeschlossenes nicht', async () => {
    expect(isWipeOrRetire(action({ actionName: 'Wipe' }))).toBe(true);
    expect(isWipeOrRetire(action({ actionName: 'rebootNow' }))).toBe(false);
    const pending = evaluateDeviceStatus(
      await withActions([
        action({ actionName: 'retire', actionState: 'pending', actionStateRaw: 'pending' }),
      ]),
      NOW,
    );
    const wipe = pending.findings.find((f) => f.id === 'deviceStatus-action-wipe-0')!;
    expect(wipe.severity).toBe('warning');
    expect(wipe.detail).toContain(t.wipeNameNote);
    // Kurzwert nennt Rohwert und Status, keine Deutung
    expect(pending.value).toBe(t.valuePending('retire', t.state.pending!));
    const done = evaluateDeviceStatus(await withActions([action({ actionName: 'retire' })]), NOW);
    expect(done.findings.some((f) => f.id.startsWith('deviceStatus-action-wipe'))).toBe(false);
  });

  it('Zeitachse: je Aktion ein Ereignis, Fehlschlag als Problem', async () => {
    const events = buildTimeline({
      snapshot: await withActions([
        action({}),
        action({ actionName: 'rebootNow', actionState: 'failed', lastUpdatedDateTime: daysAgo(2) }),
      ]),
      now: NOW,
    }).filter((event) => event.kind === 'remoteAction');
    expect(events.map((event) => [event.title, event.severity])).toEqual([
      [t.timelineTitle('syncDevice'), 'ok'],
      [t.timelineTitle('rebootNow'), 'warning'],
    ]);
    expect(events[0]!.tileId).toBe('deviceStatus');
    expect(events[0]!.detail).toBe(t.timelineDetail(t.state.done!));
  });

  it('Zeitachse: offenes Zurücksetzen/Abkoppeln legt die Erkennung am Rohwert offen', async () => {
    const [event] = buildTimeline({
      snapshot: await withActions([
        action({ actionName: 'wipe', actionState: 'pending', actionStateRaw: 'pending' }),
      ]),
      now: NOW,
    }).filter((entry) => entry.kind === 'remoteAction');
    expect(event!.severity).toBe('warning');
    expect(event!.detail).toBe(t.timelineDetailPending(t.state.pending!));
  });

  it('Demo: PC027 mit fehlgeschlagener Aktion, LT108 mit ausstehendem retire', async () => {
    const pc027 = evaluateDeviceStatus(await snapshotOf('CONTOSO-PC027'), NOW);
    expect(pc027.findings.map((f) => f.id)).toContain('deviceStatus-action-failed-1');
    const lt108 = evaluateDeviceStatus(await snapshotOf('CONTOSO-LT108'), NOW);
    expect(lt108.findings.map((f) => f.id)).toContain('deviceStatus-action-wipe-0');
  });
});
