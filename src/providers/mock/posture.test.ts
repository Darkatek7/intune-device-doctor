import { describe, it, expect } from 'vitest';
import type { TenantPosture } from '../../domain/posture';
import type { Tile } from '../../domain/types';
import { Endpoints } from '../../graph/endpoints';
import { evaluatePosture, postureScore } from '../../rules/posture';
import { MockProvider } from './MockProvider';
import type { MockTenantFixture } from './types';

const NOW = new Date('2026-10-15T12:00:00Z');

const SOURCE_KEYS = [
  'complianceSettings',
  'platformCounts',
  'compliancePolicies',
  'appProtectionPolicies',
  'conditionalAccess',
  'secureScore',
  'catalogPolicies',
  'policyTemplates',
] as const;

const instantProvider = (tenant: MockTenantFixture = {}) =>
  new MockProvider({ latency: false, now: () => NOW, tenant });

async function standardPosture(): Promise<TenantPosture> {
  return instantProvider().getTenantPosture();
}

function tileOf(tiles: Tile[], id: string): Tile {
  const tile = tiles.find((entry) => entry.id === id);
  if (!tile) throw new Error(`Kachel fehlt: ${id}`);
  return tile;
}

function checksOf(tile: Tile) {
  return (tile as Tile & { checks: { status: string; counted: boolean }[] }).checks;
}

describe('MockProvider.getTenantPosture – Standard-Demodaten', () => {
  it('liefert alle acht Quellen mit Status ok', async () => {
    const posture = await standardPosture();
    for (const key of SOURCE_KEYS) {
      expect(posture[key].status, key).toBe('ok');
    }
  });

  it('kennt die Geräte je Plattform und die Summe', async () => {
    const posture = await standardPosture();
    if (posture.platformCounts.status !== 'ok') throw new Error('platformCounts nicht ok');
    const counts = posture.platformCounts.data;
    expect(counts).toEqual({ windows: 212, ios: 38, android: 15, macos: 9, total: 274 });
    expect(
      (counts.windows ?? 0) + (counts.ios ?? 0) + (counts.android ?? 0) + (counts.macos ?? 0),
    ).toBe(counts.total);
  });

  it('enthält keine E-Mail-Adressen außer Contoso-Domains', async () => {
    const posture = await standardPosture();
    const text = JSON.stringify(posture);
    const addresses = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g) ?? [];
    for (const address of addresses) {
      expect(address.endsWith('@contoso.com')).toBe(true);
    }
  });
});

describe('MockProvider.getTenantPosture – Überschreibung je Quelle', () => {
  it.each(SOURCE_KEYS)('%s als forbidden liefert requiredScope des Endpunkts', async (key) => {
    const provider = instantProvider({ posture: { [key]: { status: 'forbidden' } } });
    const posture = await provider.getTenantPosture();
    const section = posture[key];
    expect(section.status).toBe('forbidden');
    if (section.status !== 'forbidden') return;
    expect(section.error.code).toBe('forbidden');
    expect(section.error.requiredScope).toBeTruthy();
    // die übrigen Quellen bleiben unberührt
    for (const other of SOURCE_KEYS.filter((k) => k !== key)) {
      expect(posture[other].status, other).toBe('ok');
    }
  });

  it('secureScore als forbidden nennt den Scope SecurityEvents.Read.All', async () => {
    const provider = instantProvider({ posture: { secureScore: { status: 'forbidden' } } });
    const posture = await provider.getTenantPosture();
    expect(posture.secureScore.status).toBe('forbidden');
    if (posture.secureScore.status !== 'forbidden') return;
    expect(posture.secureScore.error.requiredScope).toBe(Endpoints.secureScores.scope);
  });

  it('catalogPolicies als error reicht den Fehler durch', async () => {
    const provider = instantProvider({
      posture: {
        catalogPolicies: {
          status: 'error',
          error: { code: 'network', message: 'Demo-Netzwerkfehler' },
        },
      },
    });
    const posture = await provider.getTenantPosture();
    expect(posture.catalogPolicies.status).toBe('error');
    if (posture.catalogPolicies.status !== 'error') return;
    expect(posture.catalogPolicies.error.message).toBe('Demo-Netzwerkfehler');
  });

  it('conditionalAccess als unavailable liefert den Grund', async () => {
    const provider = instantProvider({
      posture: { conditionalAccess: { status: 'unavailable', reason: 'Demo-Grund' } },
    });
    const posture = await provider.getTenantPosture();
    expect(posture.conditionalAccess).toMatchObject({
      status: 'unavailable',
      reason: 'Demo-Grund',
    });
  });

  it('eine Überschreibung ersetzt nur den Standard der Quelle (Daten als ok)', async () => {
    const provider = instantProvider({
      posture: {
        complianceSettings: {
          status: 'ok',
          data: { secureByDefault: true, deviceComplianceCheckinThresholdDays: 7 },
        },
      },
    });
    const posture = await provider.getTenantPosture();
    expect(posture.complianceSettings).toMatchObject({
      status: 'ok',
      data: { secureByDefault: true, deviceComplianceCheckinThresholdDays: 7 },
    });
  });
});

describe('Zusammenspiel mit dem Regelwerk (Stufe 2)', () => {
  it('ergibt zwölf Kacheln ohne Verfügbarkeitsproblem außer macOS', async () => {
    const posture = await standardPosture();
    const tiles = evaluatePosture(posture, { level: 2, now: NOW });
    expect(tiles).toHaveLength(12);
    for (const tile of tiles) {
      if (tile.id === 'postureComplianceMacos') continue;
      expect(tile.availability, tile.id).toBeUndefined();
    }
  });

  it('zeigt in den genannten Kacheln mindestens einen Befund', async () => {
    const posture = await standardPosture();
    const tiles = evaluatePosture(posture, { level: 2, now: NOW });
    for (const id of [
      'postureComplianceWindows',
      'postureAppProtectionAndroid',
      'postureCoverage',
      'postureTenantSettings',
      'postureBaselines',
      'postureEndpointSecurity',
    ]) {
      expect(tileOf(tiles, id).findings.length, id).toBeGreaterThan(0);
    }
  });

  it('hat bei Stufe 2 keine abweichende Prüfung in der iOS-Compliance-Kachel', async () => {
    const posture = await standardPosture();
    const tiles = evaluatePosture(posture, { level: 2, now: NOW });
    const deviating = checksOf(tileOf(tiles, 'postureComplianceIos')).filter(
      (check) => check.status === 'deviating',
    );
    expect(deviating).toHaveLength(0);
  });

  it('liefert ein Gesamtbild mit erfüllten und abweichenden Prüfungen', async () => {
    const posture = await standardPosture();
    const tiles = evaluatePosture(posture, { level: 2, now: NOW });
    const score = postureScore(tiles);
    expect(score.met).toBeGreaterThan(0);
    expect(score.deviating).toBeGreaterThan(0);
  });
});
