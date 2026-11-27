import { describe, it, expect } from 'vitest';
import type { TenantPosture } from '../../domain/posture';
import type { Tile } from '../../domain/types';
import { ANDROID_DEVICE_OWNER_COMPLIANCE_SETTING_FIELDS } from '../../graph/dto';
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
    expect(counts).toEqual({
      windows: 212,
      ios: 38,
      android: 15,
      androidPersonal: 11,
      androidCorporate: 4,
      macos: 9,
      total: 274,
    });
    expect((counts.androidPersonal ?? 0) + (counts.androidCorporate ?? 0)).toBe(counts.android);
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

describe('Demo: Android Enterprise vollständig verwaltet (Beta-Liste, dritte Beta-Ausnahme)', () => {
  async function demo() {
    const posture = await standardPosture();
    if (posture.compliancePolicies.status !== 'ok') throw new Error('compliancePolicies nicht ok');
    const list = posture.compliancePolicies.data;
    const policy = list.policies.find((entry) => entry.type === 'androidDeviceOwner');
    if (!policy) throw new Error('Richtlinie „vollständig verwaltet“ fehlt');
    return { posture, list, policy };
  }
  const fullyManagedChecks = (tile: Tile) =>
    (tile as Tile & { checks: { id: string; status: string }[] }).checks.filter((check) =>
      check.id.includes(':afm'),
    );

  it('enthält eine zugewiesene Richtlinie aus der Beta-Liste mit genau den Eigenschaften des Typs', async () => {
    const { list, policy } = await demo();
    expect(policy).toMatchObject({
      displayName: 'Contoso – Android vollständig verwaltet',
      odataType: '#microsoft.graph.androidDeviceOwnerCompliancePolicy',
      beta: true,
      assigned: true,
      scheduledActions: [{ actionType: 'block', gracePeriodHours: 0 }],
    });
    expect(Object.keys(policy.settings).sort()).toEqual(
      [...ANDROID_DEVICE_OWNER_COMPLIANCE_SETTING_FIELDS].sort(),
    );
    expect(list.betaRead).toEqual({
      status: 'ok',
      source: {
        kind: 'mock',
        label: 'GET /beta/deviceManagement/deviceCompliancePolicies',
        docsUrl: Endpoints.deviceCompliancePoliciesBeta.docsUrl,
      },
      truncated: false,
    });
    // die frühere, nicht prüfbare Richtlinie (type: other) ist ersetzt
    expect(list.policies.filter((entry) => entry.type === 'other')).toEqual([]);
  });

  it('erfüllt Stufe 1 und weicht bei Stufe 2 in mindestens zwei Einstellungen ab', async () => {
    const { posture } = await demo();
    const level1 = fullyManagedChecks(
      tileOf(evaluatePosture(posture, { level: 1, now: NOW }), 'postureComplianceAndroid'),
    );
    expect(level1.length).toBeGreaterThan(0);
    expect(level1.every((check) => check.status === 'met')).toBe(true);
    const level2 = fullyManagedChecks(
      tileOf(evaluatePosture(posture, { level: 2, now: NOW }), 'postureComplianceAndroid'),
    );
    expect(level2.filter((check) => check.status === 'deviating').map((check) => check.id)).toEqual(
      [
        expect.stringContaining(':afmPasswordReuse:'),
        expect.stringContaining(':afmStrongIntegrity:'),
      ],
    );
  });

  it('kennzeichnet die Android-Kachel als Beta und deckt unternehmenseigene Geräte ab', async () => {
    const { posture } = await demo();
    const tiles = evaluatePosture(posture, { level: 2, now: NOW });
    const android = tileOf(tiles, 'postureComplianceAndroid');
    expect(android.summary).toContain('Beta-API');
    expect(android.sources.map((source) => source.label)).toContain(
      'GET /beta/deviceManagement/deviceCompliancePolicies',
    );
    expect(android.facts.map((fact) => fact.label)).toContain('Geltung des Richtlinientyps');
    const coverage = checksOf(tileOf(tiles, 'postureCoverage')) as unknown as {
      id: string;
      status: string;
    }[];
    expect(coverage.find((check) => check.id === 'postureCoverage:androidCorporate')?.status).toBe(
      'met',
    );
  });
});
