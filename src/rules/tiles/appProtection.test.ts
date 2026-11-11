/** M20/S3: Kachel „App-Schutz“ (MAM) am Gerät. */
import { describe, expect, it } from 'vitest';
import type {
  AppProtectionInfo,
  AppProtectionRegistration,
  DeviceSnapshot,
  SectionResult,
} from '../../domain/types';
import { de } from '../../i18n/de';
import { MockProvider } from '../../providers/mock/MockProvider';
import { loadFullSnapshot } from '../../test/snapshot';
import { evaluateTiles } from '../evaluate';
import { Docs } from '../knowledge/docs';
import { THRESHOLDS } from '../thresholds';
import { daysSinceSync, evaluateAppProtection } from './appProtection';

const NOW = new Date('2026-11-10T12:00:00Z');
const t = de.fleet.appProtection;
const SOURCE = {
  kind: 'graph',
  label: 'GET /deviceAppManagement/managedAppRegistrations',
} as const;
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

async function snapshotOf(name: string): Promise<DeviceSnapshot> {
  return loadFullSnapshot(new MockProvider({ latency: false, now: () => NOW }), name);
}

const reg = (
  id: string,
  values: Partial<AppProtectionRegistration> = {},
): AppProtectionRegistration => ({
  id,
  appIdentifier: `com.contoso.${id}`,
  appPlatform: 'android',
  applicationVersion: '1.0',
  managementSdkVersion: '11.0',
  platformVersion: '15',
  deviceType: 'Pixel 8',
  deviceName: 'CONTOSO-AND21',
  createdDateTime: daysAgo(90),
  lastSyncDateTime: daysAgo(1),
  flaggedReasons: [],
  ...values,
});

const ok = (data: Partial<AppProtectionInfo>): SectionResult<AppProtectionInfo> => ({
  status: 'ok',
  data: {
    registrations: [],
    matchedBy: 'deviceName',
    userRegistrationCount: data.registrations?.length ?? 0,
    pagesRead: 1,
    truncated: false,
    ...data,
  },
  source: SOURCE,
  fetchedAt: NOW.toISOString(),
});

async function run(appProtection: SectionResult<AppProtectionInfo>) {
  const base = await snapshotOf('CONTOSO-AND21');
  return evaluateAppProtection({ ...base, appProtection }, NOW);
}

describe('App-Schutz – Kachel (M20/S3)', () => {
  it('lädt, solange die Section fehlt', async () => {
    const base = await snapshotOf('CONTOSO-AND21');
    const tile = evaluateAppProtection({ device: base.device }, NOW);
    expect(tile.state).toBe('loading');
    expect(tile.sections).toEqual(['appProtection']);
  });

  it('unauffällige Registrierungen → ok mit Tabelle (Markierung als englischer Rohwert)', async () => {
    const tile = await run(ok({ registrations: [reg('a'), reg('b')] }));
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(t.value(2));
    expect(tile.summary).toBe(t.summary(2, true));
    const list = tile.findings.find((f) => f.id === 'appProtection-list')!;
    expect(list.table!.rows).toHaveLength(2);
    expect(list.table!.columnLangs![6]).toBe('en');
    expect(list.table!.rows[0]!.cellLangs![6]).toBeNull();
    expect(list.docsUrl).toBe(Docs.appProtectionMonitor);
    // Zuordnung über den Gerätenamen ist keine Geräte-ID – der Befund sagt das
    expect(list.detail).toContain(t.deviceMatchNote);
  });

  it('rootedDevice über den Gerätenamen zugeordnet → Problem; nur über den Benutzer → Prüfen', async () => {
    const rooted = reg('a', { flaggedReasons: ['rootedDevice'] });
    const sure = await run(ok({ registrations: [rooted] }));
    expect(sure.severity).toBe('critical');
    expect(sure.value).toBe(t.valueFlagged(1));
    const finding = sure.findings.find((f) => f.id === 'appProtection-rooted-a')!;
    expect(finding.docsUrl).toBe(Docs.appProtectionConditionalLaunchAndroid);
    expect(finding.detail).toBe(t.rootedDetail('CONTOSO-AND21', true));
    expect(finding.detail).toContain('Gerätenamen');
    expect(sure.findings.find((f) => f.id === 'appProtection-list')!.table!.rows[0]).toMatchObject({
      highlight: true,
      cellLangs: [null, null, null, null, null, null, 'en'],
    });

    const unsure = await run(ok({ registrations: [rooted], matchedBy: 'user' }));
    expect(unsure.severity).toBe('warning');
    expect(unsure.findings.map((f) => f.id)).toContain('appProtection-userMatch');
    expect(unsure.findings.find((f) => f.id === 'appProtection-rooted-a')!.detail).toBe(
      t.rootedDetail('CONTOSO-AND21', false),
    );
    expect(unsure.findings.find((f) => f.id === 'appProtection-list')!.detail).not.toContain(
      t.deviceMatchNote,
    );
  });

  it('Synchronisierung älter als der eigene Richtwert → Prüfen, Richtwert im Text gekennzeichnet', async () => {
    const days = THRESHOLDS.appProtectionSyncWarningDays;
    const fresh = await run(ok({ registrations: [reg('a', { lastSyncDateTime: daysAgo(days) })] }));
    expect(fresh.severity).toBe('ok');
    const stale = await run(
      ok({ registrations: [reg('a', { lastSyncDateTime: daysAgo(days + 1) })] }),
    );
    expect(stale.severity).toBe('warning');
    const finding = stale.findings.find((f) => f.id === 'appProtection-stale-a')!;
    expect(finding.title).toBe(t.staleTitle('com.contoso.a', days + 1));
    expect(finding.detail).toContain('eigener Richtwert');
    expect(daysSinceSync(reg('x', { lastSyncDateTime: null }), NOW)).toBeNull();
  });

  it('keine Registrierung → Hinweis; Seitengrenze wird ausgewiesen', async () => {
    const none = await run(
      ok({ registrations: [], matchedBy: 'user', truncated: true, pagesRead: 3 }),
    );
    expect(none.severity).toBe('unknown');
    expect(none.value).toBe(t.valueNone);
    expect(none.findings.map((f) => f.id)).toEqual([
      'appProtection-none',
      'appProtection-truncated',
    ]);
    expect(none.findings[0]!.detail).toBe(t.noneDetail(3, true));
  });

  it('fehlende Berechtigung → Kachel „Fehlende Berechtigung“, Rest unberührt', async () => {
    const tile = await run({
      status: 'forbidden',
      source: SOURCE,
      error: { code: 'forbidden', message: 'x', requiredScope: 'DeviceManagementApps.Read.All' },
    });
    expect(tile.availability).toBe('forbidden');
  });

  it('Kachel nur für iOS/Android; Demo-Szenarien liefern die erwarteten Befunde', async () => {
    const ids = (tiles: { id: string }[]) => tiles.map((tile) => tile.id);
    expect(ids(evaluateTiles(await snapshotOf('CONTOSO-PC001'), NOW))).not.toContain(
      'appProtection',
    );
    const ios = evaluateTiles(await snapshotOf('CONTOSO-IP015'), NOW).find(
      (tile) => tile.id === 'appProtection',
    )!;
    expect(ios.severity).toBe('warning');
    expect(ios.findings.map((f) => f.id)).toEqual(
      expect.arrayContaining([
        'appProtection-userMatch',
        'appProtection-stale-00000000-0000-4000-a100-000000000002',
      ]),
    );
    const android = evaluateTiles(await snapshotOf('CONTOSO-AND21'), NOW).find(
      (tile) => tile.id === 'appProtection',
    )!;
    expect(android.severity).toBe('critical');
  });
});
