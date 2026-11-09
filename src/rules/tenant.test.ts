import { describe, expect, it } from 'vitest';
import type { SectionResult, TenantStatus, VppTokenInfo } from '../domain/types';
import { de } from '../i18n/de';
import { MockProvider } from '../providers/mock/MockProvider';
import { Docs } from './knowledge/docs';
import { evaluateTenant } from './tenant';

const NOW = new Date('2026-10-15T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const t = de.rules.tenant;
const LEARN_URL = /^https:\/\/learn\.microsoft\.com\//;
const SOURCE = { kind: 'graph', label: 'GET /deviceAppManagement/vppTokens' } as const;
const inDays = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString();

const ok = <T>(data: T): SectionResult<T> => ({
  status: 'ok',
  data,
  source: SOURCE,
  fetchedAt: NOW.toISOString(),
});

function token(id: string, extra: Partial<VppTokenInfo> = {}): VppTokenInfo {
  return {
    id,
    organizationName: `Contoso ${id}`,
    accountType: 'business',
    expirationDateTime: inDays(200),
    lastSyncDateTime: new Date(NOW.getTime() - 3_600_000).toISOString(),
    state: 'valid',
    lastSyncStatus: 'completed',
    countryOrRegion: 'DE',
    lastAppCount: 10,
    ...extra,
  };
}

function status(overrides: Partial<TenantStatus> = {}): TenantStatus {
  return {
    applePushCertificate: ok({ expirationDateTime: inDays(200), lastModifiedDateTime: null }),
    vppTokens: ok([token('a')]),
    ...overrides,
  };
}

const tileOf = (tiles: ReturnType<typeof evaluateTenant>, id: string) =>
  tiles.find((tile) => tile.id === id)!;

describe('Mandanten-Status – Struktur', () => {
  it('liefert drei fertige Kacheln in fester Reihenfolge ohne Sections', () => {
    const tiles = evaluateTenant(status(), NOW);
    expect(tiles.map((tile) => tile.id)).toEqual([
      'tenantApplePush',
      'tenantVpp',
      'tenantUnavailable',
    ]);
    for (const tile of tiles) {
      expect(tile.state).toBe('ready');
      expect(tile.sections).toEqual([]);
      expect(tile.sources.length).toBeGreaterThan(0);
      expect(tile.title).toBe(de.tiles[tile.id as keyof typeof de.tiles]);
    }
  });

  it('alle Befunde sind vollständig und haben Quelle sowie Learn-Links', () => {
    const tiles = evaluateTenant(
      status({
        applePushCertificate: ok({ expirationDateTime: inDays(10), lastModifiedDateTime: null }),
        vppTokens: ok([
          token('exp', { state: 'expired', expirationDateTime: inDays(-3) }),
          token('inv', { state: 'invalid' }),
          token('soon', { expirationDateTime: inDays(20) }),
          token('fail', { lastSyncStatus: 'failed' }),
          token('ext', { state: 'assignedToExternalMDM' }),
          token('unk', { state: 'unknown' }),
        ]),
      }),
      NOW,
    );
    for (const tile of tiles) {
      for (const finding of tile.findings) {
        const at = `${tile.id}/${finding.id}`;
        expect(finding.title.trim(), at).not.toBe('');
        expect(finding.detail.trim(), at).not.toBe('');
        expect(finding.cause.trim(), at).not.toBe('');
        expect(finding.remediation.length, at).toBeGreaterThanOrEqual(1);
        expect(finding.source.label.trim(), at).not.toBe('');
        if (finding.docsUrl) expect(finding.docsUrl, at).toMatch(LEARN_URL);
        if (finding.source.docsUrl) expect(finding.source.docsUrl, at).toMatch(LEARN_URL);
      }
    }
  });
});

describe('Mandanten-Status – Apple-MDM-Push-Zertifikat', () => {
  const push = (data: { expirationDateTime: string | null; lastModifiedDateTime: string | null }) =>
    tileOf(evaluateTenant(status({ applePushCertificate: ok(data) }), NOW), 'tenantApplePush');

  it('gültig → ok mit Ablaufdatum als Kennzahl', () => {
    const tile = push({ expirationDateTime: inDays(200), lastModifiedDateTime: null });
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(t.push.valueValid);
    expect(tile.findings).toEqual([]);
    expect(tile.facts[0]!.label).toBe(t.push.facts.expires);
  });

  it('läuft in ≤ 30 Tagen ab → warning, abgelaufen → critical (Quelle: Apple-MDM-Push-Zertifikat erneuern)', () => {
    const soon = push({ expirationDateTime: inDays(30), lastModifiedDateTime: null });
    expect(soon.severity).toBe('warning');
    expect(soon.value).toBe(t.push.valueExpiring);
    expect(soon.findings[0]!.id).toBe('tenantApplePush-expiring');
    expect(soon.findings[0]!.docsUrl).toBe(Docs.appleMdmPushCertificate);
    const later = push({ expirationDateTime: inDays(31), lastModifiedDateTime: null });
    expect(later.severity).toBe('ok');
    const expired = push({ expirationDateTime: inDays(-1), lastModifiedDateTime: null });
    expect(expired.severity).toBe('critical');
    expect(expired.value).toBe(t.push.valueExpired);
    expect(expired.findings[0]!.id).toBe('tenantApplePush-expired');
  });

  it('ohne gemeldetes Ablaufdatum → Hinweis (unknown), keine Bewertung', () => {
    const tile = push({ expirationDateTime: null, lastModifiedDateTime: null });
    expect(tile.severity).toBe('unknown');
    expect(tile.findings.map((f) => f.id)).toEqual(['tenantApplePush-noExpiry']);
  });

  it('403 / 404 / Fehler betreffen nur diese Kachel', () => {
    const forbidden: SectionResult<never> = {
      status: 'forbidden',
      source: SOURCE,
      error: {
        code: 'forbidden',
        message: 'x',
        requiredScope: 'DeviceManagementServiceConfig.Read.All',
      },
    };
    const tiles = evaluateTenant(status({ applePushCertificate: forbidden }), NOW);
    const tile = tileOf(tiles, 'tenantApplePush');
    expect(tile.availability).toBe('forbidden');
    expect(tile.findings[0]!.id).toBe('tenantApplePush-forbidden');
    expect(tile.findings[0]!.evidence?.requiredScope).toBe(
      'DeviceManagementServiceConfig.Read.All',
    );
    expect(tileOf(tiles, 'tenantVpp').severity).toBe('ok');
  });
});

describe('Mandanten-Status – Apple-VPP-Token', () => {
  const vpp = (tokens: VppTokenInfo[]) =>
    tileOf(evaluateTenant(status({ vppTokens: ok(tokens) }), NOW), 'tenantVpp');
  const ids = (tile: ReturnType<typeof vpp>) => tile.findings.map((f) => [f.id, f.severity]);

  it('gültiges Token → ok; Übersichtstabelle als Hinweis', () => {
    const tile = vpp([token('a')]);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(t.vpp.valueOk);
    expect(ids(tile)).toEqual([['tenantVpp-overview', 'unknown']]);
    const table = tile.findings[0]!.table!;
    expect(table.columns).toHaveLength(6);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]!.cells[0]).toBe('Contoso a');
  });

  it('kein Token → ok mit Hinweis', () => {
    const tile = vpp([]);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(t.vpp.valueNone);
    expect(ids(tile)).toEqual([['tenantVpp-none', 'unknown']]);
  });

  it('abgelaufen (state expired oder Ablaufdatum in der Vergangenheit) → critical mit Erneuerungsschritten', () => {
    for (const tokens of [
      [token('e', { state: 'expired' })],
      [token('e', { expirationDateTime: inDays(-1) })],
    ]) {
      const tile = vpp(tokens);
      expect(tile.severity).toBe('critical');
      const finding = tile.findings.find((f) => f.id === 'tenantVpp-expired-e')!;
      expect(finding.severity).toBe('critical');
      expect(finding.docsUrl).toBe(Docs.vppTokenRenew);
      expect(finding.remediation.join(' ')).toContain('Apple Business Manager');
    }
  });

  it('state invalid → critical mit der belegten Ursache (Kontoänderung oder Ablauf)', () => {
    const tile = vpp([token('i', { state: 'invalid' })]);
    expect(tile.severity).toBe('critical');
    const finding = tile.findings.find((f) => f.id === 'tenantVpp-invalid-i')!;
    expect(finding.cause).toBe(t.vpp.invalidCause);
    expect(finding.docsUrl).toBe(Docs.vppTokenRenew);
  });

  it('läuft in ≤ 30 Tagen ab → warning (eigener Richtwert, im Detail benannt); 31 Tage → ok', () => {
    const soon = vpp([token('s', { expirationDateTime: inDays(20) })]);
    expect(soon.severity).toBe('warning');
    expect(soon.value).toBe(t.vpp.valueProblems(1));
    const finding = soon.findings.find((f) => f.id === 'tenantVpp-expiring-s')!;
    expect(finding.detail).toContain('keine Microsoft-Vorgabe');
    expect(vpp([token('s', { expirationDateTime: inDays(31) })]).severity).toBe('ok');
    expect(vpp([token('s', { expirationDateTime: inDays(30) })]).severity).toBe('warning');
  });

  it('lastSyncStatus failed → warning mit Synchronisieren-Schritt; inProgress/none/completed → kein Befund', () => {
    const failed = vpp([token('f', { lastSyncStatus: 'failed' })]);
    expect(failed.severity).toBe('warning');
    const finding = failed.findings.find((f) => f.id === 'tenantVpp-syncFailed-f')!;
    expect(finding.docsUrl).toBe(Docs.vppTokenSync);
    for (const lastSyncStatus of ['inProgress', 'none', 'completed'] as const) {
      expect(vpp([token('f', { lastSyncStatus })]).severity, lastSyncStatus).toBe('ok');
    }
  });

  it('assignedToExternalMDM und unknown → nur Hinweis ohne Deutung; Kachel bleibt ok', () => {
    const ext = vpp([token('x', { state: 'assignedToExternalMDM' })]);
    expect(ext.severity).toBe('ok');
    expect(ext.findings.find((f) => f.id === 'tenantVpp-external-x')!.cause).toBe(
      t.vpp.externalCause,
    );
    const unknown = vpp([token('u', { state: 'unknown' })]);
    expect(unknown.severity).toBe('ok');
    expect(unknown.findings.some((f) => f.id === 'tenantVpp-unknownState-u')).toBe(true);
  });

  it('zählt Token mit Problem (nicht Befunde) und nennt den frühesten Ablauf', () => {
    const tile = vpp([
      token('a', { expirationDateTime: inDays(10), lastSyncStatus: 'failed' }),
      token('b', { state: 'invalid' }),
      token('c'),
    ]);
    expect(tile.severity).toBe('critical');
    expect(tile.value).toBe(t.vpp.valueProblems(2));
    expect(tile.facts[0]).toEqual({ label: t.vpp.facts.count, value: '3' });
  });

  it('403 / 404 / Fehler → Kachel mit Hinweis, die anderen Kacheln bleiben bewertet', () => {
    const error: SectionResult<never> = {
      status: 'error',
      source: SOURCE,
      error: { code: 'graph', message: 'kaputt' },
    };
    const tiles = evaluateTenant(status({ vppTokens: error }), NOW);
    expect(tileOf(tiles, 'tenantVpp').availability).toBe('error');
    expect(tileOf(tiles, 'tenantVpp').findings[0]!.id).toBe('tenantVpp-error');
    expect(tileOf(tiles, 'tenantApplePush').severity).toBe('ok');
  });

  it('Name ohne Organisation → „VPP-Token n“', () => {
    const tile = vpp([token('a', { organizationName: null, state: 'invalid' })]);
    expect(tile.findings.find((f) => f.id === 'tenantVpp-invalid-a')!.title).toBe(
      t.vpp.invalidTitle('VPP-Token 1'),
    );
  });

  it('kein Befund enthält ein Token oder eine Apple-ID (das Modell kennt sie nicht)', () => {
    const tile = vpp([
      token('a', { state: 'invalid', lastSyncStatus: 'failed', expirationDateTime: inDays(5) }),
    ]);
    const json = JSON.stringify(tile);
    expect(json).not.toMatch(/appleId|"token"|@contoso\.com/);
  });
});

describe('Mandanten-Status – nicht über die dokumentierte v1.0-API verfügbar', () => {
  it('listet ADE/DEP, Android Enterprise, Autopilot-Sync und NDES ehrlich auf (Beta-Doku, keine Aufrufe, keine Portal-Links)', () => {
    const tile = tileOf(evaluateTenant(status(), NOW), 'tenantUnavailable');
    expect(tile.severity).toBe('unknown');
    expect(tile.availability).toBe('unavailable');
    expect(tile.findings.map((f) => f.id)).toEqual([
      'tenantUnavailable-ade',
      'tenantUnavailable-android',
      'tenantUnavailable-autopilot',
      'tenantUnavailable-ndes',
    ]);
    for (const finding of tile.findings) {
      expect(finding.severity).toBe('unknown');
      expect(finding.detail).toContain('Beta');
      expect(finding.docsUrl).toMatch(/view=graph-rest-beta$/);
      expect(finding.source.label).toContain('nicht abgerufen');
      expect(finding.links).toBeUndefined();
    }
  });
});

describe('Mandanten-Status – Demo (MockProvider)', () => {
  it('zeigt Befunde (VPP-Token, nicht abrufbare Bereiche); ein VPP-Token läuft in 20 Tagen ab (warning)', async () => {
    const provider = new MockProvider({ latency: false, now: () => NOW });
    const tiles = evaluateTenant(await provider.getTenantStatus(), NOW);
    // das gültige Push-Zertifikat hat – wie jede unauffällige Kachel – nur Kennzahlen
    expect(tileOf(tiles, 'tenantApplePush').facts.length).toBeGreaterThan(0);
    for (const id of ['tenantVpp', 'tenantUnavailable']) {
      expect(tileOf(tiles, id).findings.length, id).toBeGreaterThan(0);
    }
    const vpp = tileOf(tiles, 'tenantVpp');
    expect(vpp.severity).toBe('warning');
    expect(vpp.findings.some((f) => f.id.startsWith('tenantVpp-expiring-'))).toBe(true);
    expect(tileOf(tiles, 'tenantApplePush').severity).toBe('ok');
  });

  it('kann pro Quelle verweigert werden (forbidden mit Scope)', async () => {
    const provider = new MockProvider({
      latency: false,
      now: () => NOW,
      tenant: { vppTokens: { status: 'forbidden' } },
    });
    const status = await provider.getTenantStatus();
    expect(status.vppTokens.status).toBe('forbidden');
    expect(status.applePushCertificate.status).toBe('ok');
    if (status.vppTokens.status === 'forbidden') {
      expect(status.vppTokens.error.requiredScope).toBe('DeviceManagementServiceConfig.Read.All');
    }
  });
});
