import { describe, expect, it } from 'vitest';
import type { DeviceSnapshot, LocalAdminInfo, SectionResult } from '../../domain/types';
import { de } from '../../i18n/de';
import { MockProvider } from '../../providers/mock/MockProvider';
import { loadFullSnapshot } from '../../test/snapshot';
import { evaluateTiles } from '../evaluate';
import { Docs } from '../knowledge/docs';
import { THRESHOLDS } from '../thresholds';
import { evaluateLaps } from './laps';

const NOW = new Date('2026-10-15T12:00:00Z');
const t = de.rules.laps;
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString();
const inDays = (n: number) => new Date(NOW.getTime() + n * DAY).toISOString();

async function snapshotOf(name: string): Promise<DeviceSnapshot> {
  return loadFullSnapshot(new MockProvider({ latency: false, now: () => NOW }), name);
}

const SOURCE = {
  kind: 'graph',
  label: 'GET /directory/deviceLocalCredentials/{deviceId}',
} as const;
const withLaps = async (data: LocalAdminInfo): Promise<DeviceSnapshot> => ({
  ...(await snapshotOf('CONTOSO-PC001')),
  localAdmin: { status: 'ok', data, source: SOURCE, fetchedAt: NOW.toISOString() },
});
const info = (backupDaysAgo: number | null, refresh: string | null): LocalAdminInfo => ({
  deviceName: 'CONTOSO-PC001',
  lastBackupDateTime: backupDaysAgo === null ? null : daysAgo(backupDaysAgo),
  refreshDateTime: refresh,
});

describe('Lokaler Administrator (LAPS)', () => {
  it('lädt, solange die Section fehlt', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const tile = evaluateLaps({ device: base.device }, NOW);
    expect(tile.state).toBe('loading');
    expect(tile.sections).toEqual(['localAdmin']);
  });

  it('aktuelle Sicherung → ok; Fakten ohne Kennwort', async () => {
    const tile = evaluateLaps(await snapshotOf('CONTOSO-PC001'), NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(t.valueOk);
    expect(tile.findings).toEqual([]);
    expect(tile.facts.map((f) => f.label)).toEqual(
      expect.arrayContaining([t.facts.lastBackup, t.facts.nextRefresh]),
    );
    expect(tile.facts.find((f) => f.label === t.facts.passwordNote)?.value).toBe(
      t.facts.passwordNever,
    );
  });

  it('Sicherung genau am Richtwert ist noch ok, einen Tag darüber warning (mit Quelle und Schritten)', async () => {
    const limit = THRESHOLDS.lapsBackupWarningDays;
    expect(evaluateLaps(await withLaps(info(limit, inDays(5))), NOW).severity).toBe('ok');
    const tile = evaluateLaps(await withLaps(info(limit + 1, inDays(5))), NOW);
    expect(tile.severity).toBe('warning');
    expect(tile.value).toBe(t.valueStale);
    const finding = tile.findings[0]!;
    expect(finding.id).toBe('laps-backupStale');
    expect(finding.docsUrl).toBe(Docs.lapsIntuneOverview);
    expect(finding.remediation.length).toBeGreaterThanOrEqual(3);
    expect(finding.evidence).toMatchObject({ ageDays: limit + 1, thresholdDays: limit });
  });

  it('Rotation überfällig → nur Hinweis (unknown), Kachel bleibt ok', async () => {
    const limit = THRESHOLDS.lapsRefreshOverdueDays;
    expect(evaluateLaps(await withLaps(info(3, daysAgo(limit))), NOW).findings).toEqual([]);
    const tile = evaluateLaps(await withLaps(info(3, daysAgo(limit + 2))), NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(t.valueHint);
    expect(tile.findings.map((f) => [f.id, f.severity])).toEqual([
      ['laps-refreshOverdue', 'unknown'],
    ]);
  });

  it('kein Sicherungszeitpunkt → Hinweis statt Annahme', async () => {
    const tile = evaluateLaps(await withLaps(info(null, null)), NOW);
    expect(tile.value).toBe(t.valueNoBackup);
    expect(tile.findings.map((f) => f.id)).toEqual(['laps-noBackup']);
    expect(tile.severity).toBe('ok');
  });

  it('CONTOSO-PC033: Sicherung 45 Tage alt und Rotation überfällig → warning + Hinweis', async () => {
    const tile = evaluateLaps(await snapshotOf('CONTOSO-PC033'), NOW);
    expect(tile.severity).toBe('warning');
    expect(tile.findings.map((f) => f.id)).toEqual(['laps-backupStale', 'laps-refreshOverdue']);
  });

  it('403 → „Fehlende Berechtigung“ mit Scope DeviceLocalCredential.ReadBasic.All (CONTOSO-PC050)', async () => {
    const tile = evaluateLaps(await snapshotOf('CONTOSO-PC050'), NOW);
    expect(tile.availability).toBe('forbidden');
    expect(tile.value).toBe(de.availability.forbidden);
    expect(tile.summary).toContain('DeviceLocalCredential.ReadBasic.All');
  });

  it('notApplicable / unavailable / error werden als Kachelzustand ausgewiesen', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const cases: Array<[SectionResult<LocalAdminInfo>, string]> = [
      [{ status: 'notApplicable', reason: 'x', source: SOURCE }, 'notApplicable'],
      [{ status: 'unavailable', reason: 'y', source: SOURCE }, 'unavailable'],
      [{ status: 'error', error: { code: 'unknown', message: 'z' }, source: SOURCE }, 'error'],
    ];
    for (const [localAdmin, availability] of cases) {
      expect(evaluateLaps({ ...base, localAdmin }, NOW).availability).toBe(availability);
    }
  });

  it('erscheint nur für Windows-Geräte', async () => {
    const win = evaluateTiles(await snapshotOf('CONTOSO-PC001'), NOW);
    expect(win.map((x) => x.id)).toContain('laps');
    const mac = evaluateTiles(await snapshotOf('CONTOSO-MAC07'), NOW);
    expect(mac.map((x) => x.id)).not.toContain('laps');
  });
});
