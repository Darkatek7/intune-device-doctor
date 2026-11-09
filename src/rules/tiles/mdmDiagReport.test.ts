import { beforeAll, describe, expect, it } from 'vitest';
import { analyzeDiagnosticsZip } from '../../diagnostics/analyze';
import { buildFixtureZip, FIXTURE_FILE_NAME } from '../../diagnostics/fixture';
import { FIXTURE_MULTIVARIANT_CONDITIONS } from '../../diagnostics/mdmCabFixture';
import type { DiagnosticsReport, MdmDiagPackage } from '../../diagnostics/types';
import type { Finding, Tile } from '../../domain/types';
import { MockProvider } from '../../providers/mock/MockProvider';
import { loadFullSnapshot } from '../../test/snapshot';
import { evaluateTiles } from '../evaluate';
import { Docs } from '../knowledge/docs';
import { mdmDiagReportTile } from './mdmDiagReport';

let fixture: DiagnosticsReport;

beforeAll(async () => {
  const zip = new Uint8Array(buildFixtureZip());
  fixture = await analyzeDiagnosticsZip(new File([zip], FIXTURE_FILE_NAME), {});
});

const withPackage = (patch: Partial<MdmDiagPackage>): DiagnosticsReport => ({
  ...fixture,
  mdmDiag: { ...fixture.mdmDiag!, ...patch },
});

const tileOf = (report: DiagnosticsReport): Tile => mdmDiagReportTile(report)!;
const findingOf = (tile: Tile, id: string): Finding => tile.findings.find((f) => f.id === id)!;

describe('Kachel „MDM-Diagnosebericht“', () => {
  it('ohne Paket im ZIP keine Kachel', () => {
    const without: DiagnosticsReport = { ...fixture };
    delete without.mdmDiag;
    expect(mdmDiagReportTile(without)).toBeNull();
  });

  it('Fixture: Rohdaten-Kachel mit Wert, Aufbau, Bedingungen und Dateiliste (Severity Hinweis)', () => {
    const tile = tileOf(fixture);
    expect(tile.id).toBe('mdmDiagReport');
    expect(tile.state).toBe('ready');
    expect(tile.severity).toBe('unknown');
    expect(tile.value).toBe('4 Abschnitte · 3 Multivariant-Bedingungen');
    expect(tile.findings.map((f) => f.id)).toEqual([
      'mdmDiag-package',
      'mdmDiag-structure',
      'mdmDiag-multivariant',
      'mdmDiag-metadata',
    ]);
    // Alle Befunde sind reine Hinweise – keine Bewertung ohne Learn-Beleg
    expect(tile.findings.every((f) => f.severity === 'unknown')).toBe(true);

    const conditions = findingOf(tile, 'mdmDiag-multivariant');
    expect(Object.values(conditions.evidence ?? {})).toEqual(FIXTURE_MULTIVARIANT_CONDITIONS);
    expect(conditions.docsUrl).toBe(Docs.diagnoseProvisioningPackages);

    const structure = findingOf(tile, 'mdmDiag-structure');
    expect(structure.evidence).toMatchObject({
      Enrollment: '2× · enthält: EnrollmentId, UPN, ManagementUrl',
      ProvisioningPackages: '1× · enthält: Package',
    });

    const files = findingOf(tile, 'mdmDiag-package').evidence ?? {};
    expect(Object.keys(files)).toContain('3. MDMDiagReport.xml');
    expect(tile.facts.find((f) => f.label === 'MDM-Admin-Ereignisprotokoll')?.value).toBe(
      'direkt aus dem Archiv',
    );
  });

  it('jeder Befund: Ursache, Lösung, ZIP-Quelle und Microsoft-Learn-Link', () => {
    const variants = [
      fixture,
      withPackage({ status: 'invalid' }),
      withPackage({ reportStatus: 'unsupported', unsupportedReason: 'lzx', report: null }),
      withPackage({ truncated: true, reportStatus: 'missing', report: null }),
    ];
    for (const report of variants) {
      for (const finding of tileOf(report).findings) {
        expect(finding.cause.trim(), finding.id).not.toBe('');
        expect(finding.remediation.length, finding.id).toBeGreaterThanOrEqual(1);
        expect(finding.source.kind, finding.id).toBe('zip');
        expect(finding.docsUrl, finding.id).toMatch(/^https:\/\/learn\.microsoft\.com\//);
      }
    }
  });

  it('Privatsphäre: keine Klartextwerte aus Bericht oder Metadaten', () => {
    const json = JSON.stringify(tileOf(fixture));
    for (const secret of [
      'user@contoso.com',
      'geheim',
      'CONTOSO-SN-000042',
      '00000000-0000-0000-0000-000000000001',
    ]) {
      expect(json, secret).not.toContain(secret);
    }
  });

  it('LZX-Paket: Dateiliste bleibt, Bericht „nicht unterstützt“ mit Grund und expand-Hinweis', () => {
    const tile = tileOf(
      withPackage({
        reportStatus: 'unsupported',
        unsupportedReason: 'lzx',
        report: null,
        metadata: [],
      }),
    );
    expect(tile.severity).toBe('unknown');
    expect(tile.value).toBe('6 Dateien im Paket');
    expect(tile.summary).toContain('LZX-Kompression');
    const unavailable = findingOf(tile, 'mdmDiag-report-unavailable');
    expect(unavailable.detail).toContain('LZX-Kompression');
    expect(unavailable.docsUrl).toBe(Docs.cabinetFormat);
    expect(findingOf(tile, 'mdmDiag-package')).toBeDefined();
  });

  it('fehlender oder ungültiger Bericht', () => {
    const missing = tileOf(withPackage({ reportStatus: 'missing', report: null }));
    expect(findingOf(missing, 'mdmDiag-report-unavailable').detail).toContain('nicht enthalten');
    expect(missing.facts.find((f) => f.label === 'MDMDiagReport.xml')?.value).toBe(
      'nicht im Paket',
    );
    const invalid = tileOf(withPackage({ reportStatus: 'invalid', report: null }));
    expect(findingOf(invalid, 'mdmDiag-report-unavailable').detail).toContain('kein lesbares XML');
  });

  it('Paket nicht lesbar: Kachel „Nicht verfügbar“ mit Grund', () => {
    for (const [status, text] of [
      ['tooLarge', 'Größenlimit'],
      ['invalid', 'keine gültige Cabinet-Datei'],
      ['unreadable', 'nicht aus dem Archiv gelesen'],
    ] as const) {
      const tile = tileOf(withPackage({ status, report: null, files: [], fileCount: 0 }));
      expect(tile.severity, status).toBe('unknown');
      expect(tile.value, status).toBe('Nicht verfügbar');
      expect(tile.summary, status).toContain(text);
      expect(tile.findings.map((f) => f.id)).toEqual(['mdmDiag-package-unavailable']);
    }
  });

  it('gekapptes Cabinet und Admin-Log aus dem Paket werden ausgewiesen', () => {
    const tile = tileOf(withPackage({ truncated: true, adminLogFromPackage: true }));
    expect(tile.findings.map((f) => f.id)).toContain('mdmDiag-truncated');
    expect(findingOf(tile, 'mdmDiag-package').detail).toContain('stammt aus diesem Paket');
    expect(tile.facts.find((f) => f.label === 'MDM-Admin-Ereignisprotokoll')?.value).toBe(
      'aus dem Paket',
    );
  });
});

describe('Zusammenführen: Hinweis in der Richtlinien-Kachel', () => {
  const NOW = new Date('2026-10-15T12:00:00Z');

  it('verweist auf den MDM-Diagnosebericht, solange ein lesbares Paket vorliegt', async () => {
    const snapshot = await loadFullSnapshot(new MockProvider(), 'CONTOSO-PC042');
    const policies = (diag: DiagnosticsReport | undefined): Finding => {
      const tiles = evaluateTiles(diag ? { ...snapshot, diagnostics: diag } : snapshot, NOW);
      return findingOf(
        tiles.find((t) => t.id === 'policies')!,
        'policies-settingsCatalog',
      );
    };

    expect(policies(undefined).remediation.join(' ')).not.toContain('MDM-Diagnosebericht');
    const merged = policies(fixture);
    expect(merged.remediation.join(' ')).toContain('Kachel „MDM-Diagnosebericht“');
    expect(merged.severity).toBe('unknown');
    // Paket nicht lesbar → kein Verweis auf eine Kachel ohne Inhalt
    expect(policies(withPackage({ status: 'invalid' })).remediation.join(' ')).not.toContain(
      'MDM-Diagnosebericht',
    );
  });
});
