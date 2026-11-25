import { describe, expect, it } from 'vitest';
import type { Tile } from '../../domain/types';
import { de } from '../../i18n/de';
import { csvField, postureChecksCsv, postureExportFileName } from './export';
import type { PostureCheckResult, PostureTile } from './types';

function check(id: string, extra: Partial<PostureCheckResult> = {}): PostureCheckResult {
  return {
    id,
    tile: 'postureComplianceWindows',
    label: `Einstellung ${id}`,
    status: 'met',
    level: null,
    actual: 'Ist',
    expected: 'Soll',
    docsUrl: 'https://learn.microsoft.com/de-de/mem/intune/protect/x',
    counted: true,
    ...extra,
  };
}

function tile(
  id: PostureTile['id'],
  checks: PostureCheckResult[],
  title = de.tiles[id] as string,
): PostureTile {
  return {
    id,
    title,
    severity: 'ok',
    state: 'ready',
    value: '',
    summary: '',
    facts: [],
    findings: [],
    sources: [],
    checks,
  } as unknown as PostureTile;
}

const BOM = '\uFEFF';

describe('postureChecksCsv', () => {
  it('beginnt mit BOM, nutzt ; und CRLF und hat alle zwölf Spalten', () => {
    const csv = postureChecksCsv([tile('postureComplianceWindows', [check('a')])]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    const lines = csv.slice(1).split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      [
        'Abschnitt',
        'Kachel',
        'Richtlinie',
        'Einstellung',
        'Graph-Eigenschaft',
        'Ist',
        'Empfehlung',
        'Stufe',
        'Status',
        'Hinweis',
        'Zählt zum Gesamtbild',
        'Quelle',
      ]
        .map((c) => `"${c}"`)
        .join(';'),
    );
    expect(lines[1]!.split('";"')).toHaveLength(12);
  });

  it('enthält alle Prüfungen mit Abschnitt, Kachel, Stufe, Status und Hinweis', () => {
    const csv = postureChecksCsv([
      tile('postureComplianceWindows', [
        check('a', { subject: 'Contoso Basis', properties: ['p1', 'p2'], level: 2 }),
        check('b', { status: 'deviating' }),
        check('c', { status: 'notChecked', reason: 'Grund', counted: false }),
      ]),
      tile('postureSecureScore', [check('d')]),
    ]);
    const lines = csv.slice(1).split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(5);
    expect(lines[1]).toContain(
      '"Compliance"'.replace('Compliance', de.posture.sections.compliance),
    );
    expect(lines[1]).toContain(`"${de.tiles.postureComplianceWindows}"`);
    expect(lines[1]).toContain('"Contoso Basis"');
    expect(lines[1]).toContain('"p1, p2"');
    expect(lines[1]).toContain('"Stufe 2"');
    expect(lines[1]).toContain('"Erfüllt"');
    expect(lines[1]).toContain('"Ja"');
    expect(lines[2]).toContain('"Weicht ab"');
    expect(lines[3]).toContain('"Nicht prüfbar";"Grund";"Nein"');
    expect(lines[4]).toContain(de.posture.sections.secureScore);
    for (const line of lines.slice(1)) {
      expect(line).toContain('"https://learn.microsoft.com/de-de/mem/intune/protect/x"');
    }
  });

  it('ignoriert Kacheln ohne Prüfungen', () => {
    const plain = { ...tile('postureCoverage', []), checks: undefined } as unknown as Tile;
    const csv = postureChecksCsv([plain]);
    expect(csv.slice(1).split('\r\n').filter(Boolean)).toHaveLength(1);
  });
});

describe('csvField', () => {
  it('verdoppelt Anführungszeichen und umschließt das Feld', () => {
    expect(csvField('a "b" ; c\nd')).toBe('"a ""b"" ; c\nd"');
  });

  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx'])('schützt vor Formel: %j', (value) => {
    expect(csvField(value)).toBe(`"'${value}"`);
  });

  it('lässt harmlose Felder unverändert', () => {
    expect(csvField('Contoso – VPN')).toBe('"Contoso – VPN"');
    expect(csvField('a=b')).toBe('"a=b"');
    expect(csvField('')).toBe('""');
  });

  it('wendet den Schutz auf Richtliniennamen im Export an', () => {
    const csv = postureChecksCsv([
      tile('postureComplianceWindows', [check('a', { subject: '=HYPERLINK("x")' })]),
    ]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('postureExportFileName', () => {
  it('enthält Stufe und Datum, sonst nichts', () => {
    expect(postureExportFileName(3, new Date(2026, 10, 5, 12))).toBe(
      'mdm-doctor-empfehlungen-stufe-3-2026-11-05.csv',
    );
  });
});
