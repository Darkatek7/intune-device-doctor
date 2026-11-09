import { describe, expect, it } from 'vitest';
import type { DeviceSearchResult } from '../domain/types';
import {
  BULK_MAX_NAMES,
  bulkRowsToCsv,
  checkInSeverity,
  parseDeviceNames,
  pendingRows,
  rowFromResults,
  type BulkCsvLabels,
} from './bulkCheck';

const NOW = new Date('2026-11-09T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const device = (over: Partial<DeviceSearchResult> = {}): DeviceSearchResult => ({
  id: 'id-1',
  deviceName: 'CONTOSO-PC001',
  userPrincipalName: 'a@contoso.com',
  userDisplayName: 'Alex Beispiel',
  operatingSystem: 'Windows',
  osVersion: '10.0',
  model: null,
  complianceState: 'compliant',
  lastSyncDateTime: hoursAgo(2),
  ...over,
});

describe('parseDeviceNames', () => {
  it('liest eine Zeile pro Gerät, entfernt Leerzeilen, Leerraum und Doppelte', () => {
    const { names, overLimit } = parseDeviceNames(
      ' CONTOSO-PC001 \r\n\r\ncontoso-pc001\nCONTOSO-PC042\n',
    );
    expect(names).toEqual(['CONTOSO-PC001', 'CONTOSO-PC042']);
    expect(overLimit).toBe(0);
  });

  it('nimmt bei CSV die erste Spalte, entfernt Kopfzeile, Anführungszeichen und BOM', () => {
    const csv = '﻿"Gerätename";Benutzer\n"CONTOSO-PC001";alex\nCONTOSO-LT108,x\nCONTOSO-MAC07\ty';
    expect(parseDeviceNames(csv).names).toEqual([
      'CONTOSO-PC001',
      'CONTOSO-LT108',
      'CONTOSO-MAC07',
    ]);
  });

  it('behält eine erste Zeile, die kein Spaltenname ist', () => {
    expect(parseDeviceNames('CONTOSO-PC001\nCONTOSO-PC042').names).toHaveLength(2);
  });

  it('begrenzt auf 50 Namen und meldet den Rest', () => {
    const text = Array.from({ length: 53 }, (_, i) => `PC-${i}`).join('\n');
    const { names, overLimit } = parseDeviceNames(text);
    expect(names).toHaveLength(BULK_MAX_NAMES);
    expect(names.at(-1)).toBe('PC-49');
    expect(overLimit).toBe(3);
  });

  it('liefert bei leerem Text nichts', () => {
    expect(parseDeviceNames('  \n \n')).toEqual({ names: [], overLimit: 0 });
  });
});

describe('rowFromResults', () => {
  it('0 Treffer', () => {
    expect(rowFromResults('X', [])).toMatchObject({ status: 'done', matchCount: 0, device: null });
  });
  it('1 Treffer liefert das Gerät', () => {
    const d = device();
    expect(rowFromResults('CONTOSO-PC001', [d])).toMatchObject({ matchCount: 1, device: d });
  });
  it('mehrere Treffer ohne exakten Namen', () => {
    const rows = rowFromResults('PC0', [device({ id: 'a' }), device({ id: 'b' })]);
    expect(rows).toMatchObject({ matchCount: 2, device: null });
  });
  it('genau ein exakter Treffer unter mehreren zählt als eindeutig', () => {
    const exact = device({ id: 'a', deviceName: 'CONTOSO-PC001' });
    const other = device({ id: 'b', deviceName: 'CONTOSO-PC0011' });
    expect(rowFromResults('contoso-pc001', [exact, other])).toMatchObject({
      matchCount: 1,
      device: exact,
    });
  });
});

describe('checkInSeverity (Schwellwerte der Kachel „Letzter Check-in“)', () => {
  it.each([
    [hoursAgo(1), 'ok'],
    [hoursAgo(7 * 24), 'ok'],
    [hoursAgo(7 * 24 + 1), 'warning'],
    [hoursAgo(30 * 24), 'warning'],
    [hoursAgo(30 * 24 + 1), 'critical'],
    [null, 'unknown'],
  ] as const)('%s → %s', (iso, expected) => {
    expect(checkInSeverity(iso, NOW)).toBe(expected);
  });
});

describe('bulkRowsToCsv', () => {
  const labels: BulkCsvLabels = {
    header: [
      'Name',
      'Treffer',
      'Gerät',
      'Plattform',
      'Compliance',
      'Check-in',
      'Bewertung',
      'Benutzer',
    ],
    matchNone: 'keiner',
    matchOne: 'eindeutig',
    matchMany: 'mehrere',
    pending: 'offen',
    error: 'Fehler',
    cancelled: 'abgebrochen',
    compliance: (s) => (s === 'compliant' ? 'Konform' : s),
    severity: { ok: 'In Ordnung', warning: 'Prüfen', critical: 'Problem', unknown: 'Unbekannt' },
  };

  it('schreibt BOM, Kopfzeile und je eine Zeile pro Name', () => {
    const rows = [
      rowFromResults('CONTOSO-PC001', [device()]),
      rowFromResults('NIX', []),
      rowFromResults('PC', [device({ id: 'a' }), device({ id: 'b' })]),
      ...pendingRows(['OFFEN']),
    ];
    const lines = bulkRowsToCsv(rows, NOW, labels).split('\r\n');
    expect(lines[0]).toBe('﻿Name;Treffer;Gerät;Plattform;Compliance;Check-in;Bewertung;Benutzer');
    expect(lines[1]).toBe(
      `CONTOSO-PC001;eindeutig;CONTOSO-PC001;Windows;Konform;${device().lastSyncDateTime};In Ordnung;Alex Beispiel`,
    );
    expect(lines[2]).toBe('NIX;keiner;;;;;;');
    expect(lines[3]).toBe('PC;mehrere (2);;;;;;');
    expect(lines[4]).toBe('OFFEN;offen;;;;;;');
  });

  it('maskiert Trenner, Anführungszeichen und Formeln', () => {
    const rows = [rowFromResults('=1+1;"x"', [])];
    expect(bulkRowsToCsv(rows, NOW, labels).split('\r\n')[1]).toBe('"\'=1+1;""x""";keiner;;;;;;');
  });
});
