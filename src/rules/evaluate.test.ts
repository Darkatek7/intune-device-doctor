import { describe, it, expect } from 'vitest';
import type { DeviceSnapshot, Finding, Severity, Tile, TileId } from '../domain/types';
import { de } from '../i18n/de';
import { MockProvider } from '../providers/mock/MockProvider';
import { scenarios } from '../providers/mock/scenarios';
import { TILE_ORDER, evaluateTiles, sortTiles, summarize } from './evaluate';

const NOW = new Date('2026-10-15T12:00:00Z');
const LEARN_URL = /^https:\/\/learn\.microsoft\.com\//;

/** Die sieben Kacheln ohne DiagLogs-ZIP, in Standardreihenfolge. */
const BASE_TILES: TileId[] = TILE_ORDER.slice(0, 7);

/** Erwartete Severity je Mock-Szenario. Nicht genannte Kacheln müssen 'ok' sein. */
const EXPECTED: Record<string, Partial<Record<TileId, Severity>>> = {
  'CONTOSO-PC001': {},
  'CONTOSO-PC014': { compliance: 'critical', bitlocker: 'critical', policies: 'warning' },
  'CONTOSO-PC027': { defender: 'warning' },
  'CONTOSO-PC033': {
    checkIn: 'critical',
    compliance: 'critical',
    defender: 'warning',
    policies: 'warning',
  },
  'CONTOSO-PC042': { policies: 'critical', compliance: 'warning', osVersion: 'warning' },
  'CONTOSO-LT108': { deviceStatus: 'critical', osVersion: 'warning' },
  'CONTOSO-MAC07': { defender: 'unknown', osVersion: 'unknown' },
  'CONTOSO-PC050': { policies: 'unknown' },
};

/** Lädt ein Mock-Gerät vollständig (alle Sections) – wie der Provider es in der App liefert. */
async function loadSnapshot(deviceName: string, now: Date = NOW): Promise<DeviceSnapshot> {
  const provider = new MockProvider({ latency: false, now: () => now });
  const [hit] = await provider.searchDevices(deviceName);
  if (!hit || hit.deviceName !== deviceName) throw new Error(`Szenario ${deviceName} fehlt`);
  const device = await provider.getDevice(hit.id);
  const [protection, compliancePolicies, configurationPolicies, entraDevice, bitlockerKeys] =
    await Promise.all([
      provider.getProtectionState(device),
      provider.getCompliancePolicyStates(device),
      provider.getConfigurationPolicyStates(device),
      provider.getEntraDevice(device),
      provider.getBitLockerKeys(device),
    ]);
  return {
    device,
    protection,
    compliancePolicies,
    configurationPolicies,
    entraDevice,
    bitlockerKeys,
  };
}

function tileOf(tiles: Tile[], id: TileId): Tile {
  const tile = tiles.find((t) => t.id === id);
  if (!tile) throw new Error(`Kachel ${id} fehlt`);
  return tile;
}

function findingOf(tile: Tile, id: string): Finding {
  const finding = tile.findings.find((f) => f.id === id);
  if (!finding) throw new Error(`Befund ${id} fehlt in Kachel ${tile.id}`);
  return finding;
}

function fakeTile(id: TileId, severity: Severity, state: Tile['state'] = 'ready'): Tile {
  return {
    id,
    title: id,
    state,
    severity,
    value: '',
    summary: '',
    findings: [],
    sources: [],
    facts: [],
    sections: [],
  };
}

const SCENARIO_NAMES = scenarios.map((s) => s.deviceName);

describe('evaluateTiles – Mock-Szenarien', () => {
  it('liefert ohne DiagLogs-ZIP genau die sieben Basis-Kacheln in Standardreihenfolge', async () => {
    const tiles = evaluateTiles(await loadSnapshot('CONTOSO-PC001'), NOW);
    expect(tiles.map((t) => t.id)).toEqual(BASE_TILES);
  });

  it('ist deterministisch: gleiche Eingabe und gleiches now ergeben gleiche Kacheln', async () => {
    const snapshot = await loadSnapshot('CONTOSO-PC042');
    expect(evaluateTiles(snapshot, NOW)).toEqual(evaluateTiles(snapshot, NOW));
  });

  it('hat für jedes Mock-Szenario eine Erwartung (neue Szenarien erzwingen eine Ergänzung)', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...SCENARIO_NAMES].sort());
  });

  it.each(Object.keys(EXPECTED))('%s: erwartete Severity je Kachel', async (name) => {
    const tiles = evaluateTiles(await loadSnapshot(name), NOW);
    for (const id of BASE_TILES) {
      const tile = tileOf(tiles, id);
      expect(tile.state, `${name}/${id}`).toBe('ready');
      expect(tile.severity, `${name}/${id}`).toBe(EXPECTED[name]?.[id] ?? 'ok');
    }
  });

  it.each(SCENARIO_NAMES)(
    '%s: Befunde sind vollständig, Quellen belegt, Links auf Microsoft Learn',
    async (name) => {
      const tiles = evaluateTiles(await loadSnapshot(name), NOW);
      for (const tile of tiles) {
        const where = `${name}/${tile.id}`;
        if (tile.state === 'ready') {
          expect(Array.isArray(tile.sections), where).toBe(true);
          expect(Array.isArray(tile.facts), where).toBe(true);
          expect(tile.sources.length, where).toBeGreaterThan(0);
        }
        for (const finding of tile.findings) {
          const at = `${where}/${finding.id}`;
          expect(finding.title.trim(), at).not.toBe('');
          expect(finding.detail.trim(), at).not.toBe('');
          expect(finding.cause.trim(), at).not.toBe('');
          expect(finding.remediation.length, at).toBeGreaterThanOrEqual(1);
          for (const step of finding.remediation) expect(step.trim(), at).not.toBe('');
          expect(finding.source.label.trim(), at).not.toBe('');
          if (finding.docsUrl) expect(finding.docsUrl, at).toMatch(LEARN_URL);
          if (finding.source.docsUrl) expect(finding.source.docsUrl, at).toMatch(LEARN_URL);
        }
      }
    },
  );

  it.each(SCENARIO_NAMES)(
    '%s: Richtlinien-Kachel enthält immer den Settings-Catalog-Hinweis (unknown)',
    async (name) => {
      const policies = tileOf(evaluateTiles(await loadSnapshot(name), NOW), 'policies');
      const hint = findingOf(policies, 'policies-settingsCatalog');
      expect(hint.severity).toBe('unknown');
      expect(hint.docsUrl).toMatch(LEARN_URL);
    },
  );
});

describe('evaluateTiles – Szenario-Details', () => {
  it('CONTOSO-PC001: alle sieben Kacheln ok, Zusammenfassung 7× ok', async () => {
    const tiles = evaluateTiles(await loadSnapshot('CONTOSO-PC001'), NOW);
    expect(tiles).toHaveLength(7);
    expect(summarize(tiles)).toEqual({
      critical: 0,
      warning: 0,
      unknown: 0,
      ok: 7,
      loading: 0,
      worst: 'ok',
    });
  });

  it('CONTOSO-PC014: Compliance-Wert und BitLocker-Befund sind belegt', async () => {
    const tiles = evaluateTiles(await loadSnapshot('CONTOSO-PC014'), NOW);
    expect(tileOf(tiles, 'compliance').value).toBe(de.rules.compliance.value.noncompliant);
    expect(findingOf(tileOf(tiles, 'bitlocker'), 'bitlocker-notEncrypted').severity).toBe(
      'critical',
    );
    const policyFinding = tileOf(tiles, 'policies').findings.find(
      (f) => f.id.startsWith('policies-compliance-') && f.severity === 'warning',
    );
    expect(policyFinding).toBeDefined();
  });

  it('CONTOSO-PC027: Defender-Wert und Befunde (EICAR, Signaturen, Neustart)', async () => {
    const defender = tileOf(evaluateTiles(await loadSnapshot('CONTOSO-PC027'), NOW), 'defender');
    expect([de.rules.defender.valueSignatures, de.rules.defender.valueReboot]).toContain(
      defender.value,
    );
    const titles = defender.findings.map((f) => f.title);
    expect(titles.some((t) => t.includes('EICAR'))).toBe(true);
    expect(titles.some((t) => t.includes('Signaturen'))).toBe(true);
    expect(titles.some((t) => t.includes('Neustart'))).toBe(true);
  });

  it('CONTOSO-PC033: Check-in seit 41 Tagen ist kritisch und als relative Zeit ausgewiesen', async () => {
    const tiles = evaluateTiles(await loadSnapshot('CONTOSO-PC033'), NOW);
    const checkIn = tileOf(tiles, 'checkIn');
    expect(checkIn.value).toBe('vor 41 Tagen');
    expect(checkIn.findings.map((f) => f.id)).toEqual(['checkIn-stale']);
  });

  it('CONTOSO-PC042: zwei kritische Richtlinien-Befunde (Konflikt + Fehler mit 0x87D1FDE8)', async () => {
    const tiles = evaluateTiles(await loadSnapshot('CONTOSO-PC042'), NOW);
    const critical = tileOf(tiles, 'policies').findings.filter((f) => f.severity === 'critical');
    expect(critical).toHaveLength(2);

    const conflict = critical.find((f) => f.title.includes('Konflikt'));
    expect(conflict).toBeDefined();

    const error = critical.find((f) => f.title.includes('Fehler'));
    expect(error).toBeDefined();
    expect(error?.detail).toContain('0x87D1FDE8');
    expect(error?.docsUrl).toContain('2016281112');
  });

  it('CONTOSO-PC042: Compliance in Schonfrist und Windows 11 23H2 mit 27 Tagen Restlaufzeit', async () => {
    const tiles = evaluateTiles(await loadSnapshot('CONTOSO-PC042'), NOW);
    expect(tileOf(tiles, 'compliance').value).toBe(de.rules.compliance.value.inGracePeriod);
    const osVersion = tileOf(tiles, 'osVersion');
    expect(osVersion.value).toBe('Windows 11 23H2');
    expect(findingOf(osVersion, 'osVersion-ending').title).toContain('27 Tagen');
  });

  it('CONTOSO-LT108: Gerät in Entra deaktiviert (critical) und Windows 10 (warning)', async () => {
    const tiles = evaluateTiles(await loadSnapshot('CONTOSO-LT108'), NOW);
    const deviceStatus = tileOf(tiles, 'deviceStatus');
    expect(deviceStatus.value).toBe(de.rules.deviceStatus.valueDisabled);
    expect(findingOf(deviceStatus, 'deviceStatus-disabled').severity).toBe('critical');
    expect(findingOf(tileOf(tiles, 'osVersion'), 'osVersion-win10').severity).toBe('warning');
  });

  it('CONTOSO-MAC07: BitLocker heißt auf macOS FileVault, Defender nicht anwendbar, keine Warnungen', async () => {
    const tiles = evaluateTiles(await loadSnapshot('CONTOSO-MAC07'), NOW);
    expect(tileOf(tiles, 'bitlocker').title).toBe('FileVault');
    expect(tileOf(tiles, 'bitlocker').severity).toBe('ok');
    const defender = tileOf(tiles, 'defender');
    expect(defender.availability).toBe('notApplicable');
    expect(defender.severity).toBe('unknown');
    expect(tiles.some((t) => t.severity === 'critical' || t.severity === 'warning')).toBe(false);
  });

  it('CONTOSO-PC050: fehlende Berechtigungen zeigen Scope, ohne das Dashboard zu brechen', async () => {
    const tiles = evaluateTiles(await loadSnapshot('CONTOSO-PC050'), NOW);

    const policies = tileOf(tiles, 'policies');
    expect(policies.availability).toBe('forbidden');
    expect(policies.severity).toBe('unknown');
    const forbidden = findingOf(policies, 'policies-configuration-forbidden');
    expect(forbidden.cause).toContain('DeviceManagementConfiguration.Read.All');
    expect(forbidden.evidence?.requiredScope).toBe('DeviceManagementConfiguration.Read.All');

    const bitlocker = tileOf(tiles, 'bitlocker');
    expect(bitlocker.availability).toBe('forbidden');
    expect(bitlocker.severity).toBe('ok');
    const keysFinding = findingOf(bitlocker, 'bitlocker-keys-forbidden');
    expect(keysFinding.cause).toContain('BitlockerKey.ReadBasic.All');
  });
});

describe('evaluateTiles – Ladezustand (nur device geladen)', () => {
  it('Kacheln mit fehlenden Sections sind loading, checkIn und osVersion sind ready', async () => {
    const { device } = await loadSnapshot('CONTOSO-PC001');
    const tiles = evaluateTiles({ device }, NOW);
    const loading = tiles
      .filter((t) => t.state === 'loading')
      .map((t) => t.id)
      .sort();
    expect(loading).toEqual(
      ['bitlocker', 'compliance', 'defender', 'deviceStatus', 'policies'].sort(),
    );
    expect(tileOf(tiles, 'checkIn').state).toBe('ready');
    expect(tileOf(tiles, 'osVersion').state).toBe('ready');
  });

  it('Ladekacheln zeigen den Ladetext, Severity unknown und keine Befunde', async () => {
    const { device } = await loadSnapshot('CONTOSO-PC001');
    const tiles = evaluateTiles({ device }, NOW);
    for (const tile of tiles.filter((t) => t.state === 'loading')) {
      expect(tile.value, tile.id).toBe(de.states.loading);
      expect(tile.severity, tile.id).toBe('unknown');
      expect(tile.findings, tile.id).toEqual([]);
    }
  });

  it('policies bleibt loading, solange configurationPolicies fehlt – auch wenn compliancePolicies geladen ist', async () => {
    const full = await loadSnapshot('CONTOSO-PC001');
    const tiles = evaluateTiles(
      { device: full.device, compliancePolicies: full.compliancePolicies },
      NOW,
    );
    expect(tileOf(tiles, 'compliance').state).toBe('ready');
    expect(tileOf(tiles, 'policies').state).toBe('loading');
  });

  it('sortTiles stellt Ladekacheln ans Ende', async () => {
    const { device } = await loadSnapshot('CONTOSO-PC001');
    const sorted = sortTiles(evaluateTiles({ device }, NOW));
    const firstLoading = sorted.findIndex((t) => t.state === 'loading');
    expect(firstLoading).toBeGreaterThan(0);
    expect(sorted.slice(firstLoading).every((t) => t.state === 'loading')).toBe(true);
    expect(sorted.slice(0, firstLoading).every((t) => t.state === 'ready')).toBe(true);
  });

  it('summarize zählt Ladekacheln separat und bewertet nur fertige Kacheln', async () => {
    const { device } = await loadSnapshot('CONTOSO-PC001');
    const summary = summarize(evaluateTiles({ device }, NOW));
    expect(summary.loading).toBe(5);
    expect(summary.critical + summary.warning + summary.unknown + summary.ok).toBe(2);
    expect(summary.ok).toBe(2);
    expect(summary.worst).toBe('ok');
  });
});

describe('sortTiles', () => {
  it('ordnet critical → warning → unknown → ok, Ladekacheln ans Ende', () => {
    const input = [
      fakeTile('checkIn', 'ok'), // 0
      fakeTile('policies', 'critical', 'loading'), // 1
      fakeTile('defender', 'unknown'), // 2
      fakeTile('deviceStatus', 'critical'), // 3
      fakeTile('bitlocker', 'critical'), // 4
      fakeTile('entraJoin', 'warning'), // 5
      fakeTile('osVersion', 'ok'), // 6
      fakeTile('compliance', 'unknown', 'loading'), // 7
    ];
    expect(sortTiles(input).map((t) => t.id)).toEqual([
      'deviceStatus', // critical, Eingabe-Index 3 vor 4
      'bitlocker',
      'entraJoin', // warning
      'defender', // unknown
      'checkIn', // ok, vor osVersion
      'osVersion',
      'policies', // loading in Eingabereihenfolge
      'compliance',
    ]);
  });

  it('ist stabil innerhalb einer Stufe und verändert die Eingabe nicht', () => {
    const input = [fakeTile('osVersion', 'ok'), fakeTile('checkIn', 'ok')];
    const before = [...input];
    expect(sortTiles(input).map((t) => t.id)).toEqual(['osVersion', 'checkIn']);
    expect(input).toEqual(before);
  });
});

describe('summarize', () => {
  it('zählt Severities und bestimmt die schlechteste fertige Severity', () => {
    const tiles = [
      fakeTile('deviceStatus', 'critical'),
      fakeTile('compliance', 'warning'),
      fakeTile('checkIn', 'unknown'),
      fakeTile('osVersion', 'ok'),
      fakeTile('bitlocker', 'ok'),
      fakeTile('defender', 'ok', 'loading'),
      fakeTile('policies', 'critical', 'loading'),
    ];
    expect(summarize(tiles)).toEqual({
      critical: 1,
      warning: 1,
      unknown: 1,
      ok: 2,
      loading: 2,
      worst: 'critical',
    });
  });

  it('Ladekacheln beeinflussen worst nicht', () => {
    const tiles = [fakeTile('compliance', 'warning'), fakeTile('policies', 'critical', 'loading')];
    const summary = summarize(tiles);
    expect(summary.worst).toBe('warning');
    expect(summary.critical).toBe(0);
    expect(summary.loading).toBe(1);
  });

  it('worst ist unknown, wenn nur unknown und ok vorkommen', () => {
    expect(summarize([fakeTile('checkIn', 'unknown'), fakeTile('osVersion', 'ok')]).worst).toBe(
      'unknown',
    );
  });

  it('leere Liste: alle Zähler 0, worst unknown (nichts bewertet)', () => {
    expect(summarize([])).toEqual({
      critical: 0,
      warning: 0,
      unknown: 0,
      ok: 0,
      loading: 0,
      worst: 'unknown',
    });
  });
});
