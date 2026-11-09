import { beforeAll, describe, expect, it } from 'vitest';
import { analyzeDiagnosticsZip } from '../../diagnostics/analyze';
import { buildFixtureZip, FIXTURE_FILE_NAME } from '../../diagnostics/fixture';
import type { DiagnosticsReport } from '../../diagnostics/types';
import { Docs } from '../knowledge/docs';
import { certsNetworkTile } from './certsNetwork';

const NOW = new Date('2026-10-15T12:00:00Z');
let fixture: DiagnosticsReport;

beforeAll(async () => {
  const zip = new Uint8Array(buildFixtureZip());
  fixture = await analyzeDiagnosticsZip(new File([zip], FIXTURE_FILE_NAME), {});
});

describe('certsNetworkTile', () => {
  it('zeigt Zertifikate und Adapter als reine Rohdaten (Severity „Hinweis“, keine Bewertung)', () => {
    const tile = certsNetworkTile(fixture, NOW)!;
    expect(tile.id).toBe('certsNetwork');
    expect(tile.state).toBe('ready');
    expect(tile.severity).toBe('unknown');
    expect(tile.value).toBe('3 Zertifikate · 2 Adapter');
    expect(tile.findings.every((f) => f.severity === 'unknown')).toBe(true);
    expect(tile.sources.every((s) => s.kind === 'zip')).toBe(true);
  });

  it('vergleicht NotAfter mit dem Sammelzeitpunkt aus dem Dateinamen (14.10.2026)', () => {
    const tile = certsNetworkTile(fixture, NOW)!;
    const facts = Object.fromEntries(tile.facts.map((f) => [f.label, f.value]));
    expect(facts['Zertifikate']).toBe('3');
    expect(facts['Läuft innerhalb von 30 Tagen ab']).toBe('1');
    const expiredLabel = Object.keys(facts).find((k) => k.startsWith('Laut NotAfter abgelaufen'));
    expect(facts[expiredLabel!]).toBe('1');
    const list = tile.findings.find((f) => f.id === 'certs-list')!;
    expect(
      Object.values(list.evidence ?? {}).filter((v) => String(v).includes('(abgelaufen)')),
    ).toHaveLength(1);
  });

  it('belegt den Hinweis zu „MS-Organization-Access“ mit Microsoft Learn und deutet nichts darüber hinaus', () => {
    const tile = certsNetworkTile(fixture, NOW)!;
    const entra = tile.findings.find((f) => f.id === 'certs-entra-registration')!;
    expect(entra.docsUrl).toBe(Docs.entraDeviceRegistrationCert);
    expect(entra.docsUrl).toMatch(/^https:\/\/learn\.microsoft\.com\//);
    expect(Object.keys(entra.evidence ?? {})).toHaveLength(1);
    // keine Behauptung zu Folgen eines Ablaufs
    expect(entra.cause).toContain('nicht beschrieben');
    for (const f of tile.findings) expect(f.docsUrl).toMatch(/^https:\/\/learn\.microsoft\.com\//);
  });

  it('zeigt weder Gerätenamen, Seriennummern noch volle MAC-Adressen', () => {
    const tile = certsNetworkTile(fixture, NOW)!;
    const text = JSON.stringify(tile);
    expect(text).not.toContain('Büro-Gerät-042');
    expect(text).not.toContain('99aabbccddeeff00');
    expect(text).not.toContain('00-00-5E-00-53-42');
    expect(text).not.toContain('CONTOSO-PC042');
    expect(text).toContain('00-00-5E-••-••-••');
  });

  it('liefert keine Kachel, wenn weder certutil noch ipconfig im Archiv sind', () => {
    const report: DiagnosticsReport = {
      ...fixture,
      entries: fixture.entries.filter((e) => !/certutil|ipconfig/i.test(e.name)),
      certificates: [],
      network: null,
    };
    expect(certsNetworkTile(report, NOW)).toBeNull();
  });

  it('weist unlesbare Ausgaben aus statt zu raten', () => {
    const tile = certsNetworkTile({ ...fixture, certificates: [], network: null }, NOW)!;
    expect(tile.findings.map((f) => f.id)).toEqual(['certs-none', 'network-none']);
    expect(tile.value).toBe('0 Adapter');
  });
});
