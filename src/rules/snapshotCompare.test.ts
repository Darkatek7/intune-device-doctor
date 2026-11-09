import { describe, expect, it } from 'vitest';
import type { Tile } from '../domain/types';
import {
  buildSnapshotFile,
  compareSnapshots,
  parseSnapshotFile,
  snapshotFileName,
  SNAPSHOT_SCHEMA,
  type SnapshotFile,
} from './snapshotCompare';

const NOW = new Date('2026-11-09T10:15:00Z');

function tile(
  id: string,
  severity: Tile['severity'],
  value: string,
  findingIds: string[] = [],
): Tile {
  return {
    id: id as Tile['id'],
    title: `Kachel ${id}`,
    state: 'ready',
    severity,
    value,
    summary: 'geheim@contoso.com',
    findings: findingIds.map((fid) => ({
      id: fid,
      severity: severity === 'ok' ? 'ok' : severity,
      title: `Befund ${fid}`,
      detail: 'Detail mit SN 12345',
      cause: '',
      remediation: [],
      source: { kind: 'mock', label: 'x' },
    })),
    sources: [],
    facts: [],
    sections: [],
  };
}

const make = (tiles: Tile[], deviceName: string | null = 'CONTOSO-PC042') =>
  buildSnapshotFile({ tiles, mode: 'demo', deviceName, now: NOW });

describe('buildSnapshotFile', () => {
  it('enthält nur Severity, Wert und Befund-IDs/-Titel – keine Rohdaten', () => {
    const file = make([tile('compliance', 'critical', 'Nicht konform', ['c1'])]);
    const json = JSON.stringify(file);
    expect(file.schema).toBe(SNAPSHOT_SCHEMA);
    expect(file.tiles[0]).toEqual({
      id: 'compliance',
      title: 'Kachel compliance',
      severity: 'critical',
      value: 'Nicht konform',
      findings: [{ id: 'c1', severity: 'critical', title: 'Befund c1' }],
    });
    expect(json).not.toContain('contoso.com');
    expect(json).not.toContain('12345');
  });

  it('überspringt ladende Kacheln', () => {
    const loading = { ...tile('apps', 'unknown', '…'), state: 'loading' as const };
    expect(make([loading, tile('checkIn', 'ok', 'vor 1 Std.')]).tiles.map((t) => t.id)).toEqual([
      'checkIn',
    ]);
  });
});

describe('parseSnapshotFile', () => {
  const valid = make([tile('compliance', 'ok', 'Konform')]);

  it('liest eine gültige Datei (Rundlauf)', () => {
    const result = parseSnapshotFile(JSON.stringify(valid));
    expect(result).toEqual({ ok: true, snapshot: valid });
  });

  it('toleriert BOM und verwirft unbekannte Felder', () => {
    const extra = { ...valid, secret: 'x', tiles: [{ ...valid.tiles[0], upn: 'a@b.c' }] };
    const result = parseSnapshotFile(`\uFEFF${JSON.stringify(extra)}`);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('a@b.c');
  });

  it.each([
    ['kein JSON', 'das ist kein json', 'notJson'],
    ['Array', '[]', 'wrongSchema'],
    ['fremdes Schema', JSON.stringify({ ...valid, schema: 'anderes' }), 'wrongSchema'],
    ['neue Version', JSON.stringify({ ...valid, version: 2 }), 'wrongVersion'],
    ['ungültiger Zeitpunkt', JSON.stringify({ ...valid, exportedAt: 'gestern' }), 'invalid'],
    ['ungültiger Modus', JSON.stringify({ ...valid, mode: 'x' }), 'invalid'],
    [
      'ungültige Severity',
      JSON.stringify({ ...valid, tiles: [{ ...valid.tiles[0], severity: 'schlimm' }] }),
      'invalid',
    ],
    [
      'doppelte Kachel-ID',
      JSON.stringify({ ...valid, tiles: [valid.tiles[0], valid.tiles[0]] }),
      'invalid',
    ],
    [
      'zu langer Text',
      JSON.stringify({ ...valid, tiles: [{ ...valid.tiles[0], value: 'x'.repeat(301) }] }),
      'invalid',
    ],
    ['Kacheln kein Array', JSON.stringify({ ...valid, tiles: {} }), 'invalid'],
    ['zu groß', ' '.repeat(1_000_001), 'tooLarge'],
  ])('lehnt ab: %s', (_label, text, reason) => {
    expect(parseSnapshotFile(text)).toEqual({ ok: false, reason });
  });
});

describe('compareSnapshots', () => {
  const before = make([
    tile('compliance', 'critical', 'Nicht konform', ['c1', 'c2']),
    tile('checkIn', 'ok', 'vor 1 Std.'),
    tile('bitlocker', 'warning', 'Nicht verschlüsselt', ['b1']),
    tile('defender', 'ok', 'Aktiv'),
    tile('apps', 'ok', '3 Apps'),
  ]);
  const after = make([
    tile('compliance', 'ok', 'Konform', []),
    tile('checkIn', 'warning', 'vor 9 Tagen', ['k1']),
    tile('bitlocker', 'warning', 'Wird verschlüsselt', ['b1']),
    tile('defender', 'ok', 'Aktiv'),
    tile('laps', 'ok', 'Gesichert'),
  ]);
  const result = compareSnapshots(before, after);

  it('bestimmt den Trend pro Kachel', () => {
    const trend = Object.fromEntries(result.tiles.map((t) => [t.id, t.trend]));
    expect(trend).toEqual({
      compliance: 'better',
      checkIn: 'worse',
      bitlocker: 'same',
      defender: 'same',
      laps: 'added',
      apps: 'removed',
    });
    expect(result.counts).toEqual({ worse: 1, better: 1, added: 1, removed: 1, same: 2 });
  });

  it('sortiert Änderungen vor unveränderte Kacheln', () => {
    expect(result.tiles.map((t) => t.trend)).toEqual([
      'worse',
      'better',
      'added',
      'removed',
      'same',
      'same',
    ]);
  });

  it('erkennt geänderten Wert bei gleicher Severity', () => {
    const bitlocker = result.tiles.find((t) => t.id === 'bitlocker');
    expect(bitlocker?.valueChanged).toBe(true);
    expect(result.tiles.find((t) => t.id === 'defender')?.valueChanged).toBe(false);
  });

  it('listet neue und behobene Befunde', () => {
    expect(result.newFindings.map((f) => f.finding.id)).toEqual(['k1']);
    expect(result.resolvedFindings.map((f) => f.finding.id).sort()).toEqual(['c1', 'c2']);
  });

  it('wertet „unbekannt“ schlechter als „in Ordnung“, aber besser als „Prüfen“', () => {
    const a = make([tile('x', 'ok', '1'), tile('y', 'warning', '1')]);
    const b = make([tile('x', 'unknown', '1'), tile('y', 'unknown', '1')]);
    const trends = Object.fromEntries(compareSnapshots(a, b).tiles.map((t) => [t.id, t.trend]));
    expect(trends).toEqual({ x: 'worse', y: 'better' });
  });

  it('ignoriert Befunde mit Severity „ok“', () => {
    const a = make([tile('x', 'ok', '1', ['info'])]);
    const b = make([tile('x', 'ok', '1')]);
    expect(compareSnapshots(a, b).resolvedFindings).toEqual([]);
  });

  it('warnt bei abweichenden Gerätenamen, nicht bei fehlenden', () => {
    const base: SnapshotFile = make([]);
    expect(
      compareSnapshots(base, { ...base, deviceName: 'contoso-pc042 ' }).deviceNameMismatch,
    ).toBe(false);
    expect(
      compareSnapshots(base, { ...base, deviceName: 'CONTOSO-PC001' }).deviceNameMismatch,
    ).toBe(true);
    expect(compareSnapshots(base, { ...base, deviceName: null }).deviceNameMismatch).toBe(false);
  });
});

describe('snapshotFileName', () => {
  it('nutzt nur sichere Zeichen und den Zeitstempel', () => {
    expect(snapshotFileName(make([], 'CONTOSO-PC042'))).toBe(
      'mdm-doctor-stand-CONTOSO-PC042-20261109-1015.json',
    );
    expect(snapshotFileName(make([], '../Ärger/PC 1'))).toMatch(
      /^mdm-doctor-stand-[A-Za-z0-9._-]+-20261109-1015\.json$/,
    );
    expect(snapshotFileName(make([], null))).toContain('-ger');
  });
});
