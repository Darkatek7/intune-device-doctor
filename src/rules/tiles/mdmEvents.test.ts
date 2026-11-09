import { beforeAll, describe, expect, it } from 'vitest';
import { analyzeDiagnosticsZip } from '../../diagnostics/analyze';
import { buildFixtureZip, FIXTURE_FILE_NAME } from '../../diagnostics/fixture';
import type { DiagEvent, DiagEventLog, DiagnosticsReport } from '../../diagnostics/types';
import type { Tile } from '../../domain/types';
import { de } from '../../i18n/de';
import { EVENT_KNOWLEDGE, findEventKnowledge } from '../knowledge/events';
import { THRESHOLDS } from '../thresholds';
import { mdmEventsTile } from './mdmEvents';

const LEARN_URL = /^https:\/\/learn\.microsoft\.com\//;

let fixture: DiagnosticsReport;
let tile: Tile;

beforeAll(async () => {
  const zip = new Uint8Array(buildFixtureZip());
  fixture = await analyzeDiagnosticsZip(new File([zip], FIXTURE_FILE_NAME), {});
  tile = mdmEventsTile(fixture);
});

function event(overrides: Partial<DiagEvent> = {}): DiagEvent {
  return {
    recordId: 1,
    eventId: 9999,
    level: 2,
    timeUtc: '2026-10-10T08:00:00.000Z',
    provider: null,
    data: {},
    ...overrides,
  };
}

function logWith(overrides: Partial<DiagEventLog> = {}): DiagEventLog {
  return {
    id: 'mdmAdmin',
    entryName: 'Microsoft-Windows-DeviceManagement-Enterprise-Diagnostics-Provider_Admin',
    entryPath:
      '(8) Events Microsoft-Windows-DeviceManagement-Enterprise-Diagnostics-Provider_Admin Events.evtx',
    sizeBytes: 1000,
    status: 'ok',
    windowStartUtc: '2026-09-30T12:53:56.000Z',
    windowEndUtc: '2026-10-14T12:53:56.000Z',
    scanned: 0,
    counts: { critical: 0, error: 0, warning: 0 },
    events: [],
    incomplete: false,
    skippedRecords: 0,
    capped: false,
    ...overrides,
  };
}

function tileFor(...logs: DiagEventLog[]): Tile {
  return mdmEventsTile({ ...fixture, eventLogs: logs });
}

describe('Kachel „MDM-Ereignisse“ (Fixture)', () => {
  it('ist eine deutsche Kachel mit Warnung wegen Fehlerereignissen', () => {
    expect(tile.id).toBe('mdmEvents');
    expect(tile.title).toBe('MDM-Ereignisse');
    expect(tile.state).toBe('ready');
    expect(tile.severity).toBe('warning');
    expect(tile.value).toBe('4 Fehlerereignisse');
  });

  it('gruppiert nach Ereignis-ID: Anzahl, letzter Zeitpunkt und Beispieldaten', () => {
    const f76 = tile.findings.find((f) => f.id === 'mdmEvents-mdmAdmin-76');
    expect(f76).toBeDefined();
    expect(f76!.title).toContain('Ereignis 76');
    expect(f76!.title).toContain('(2×)');
    expect(f76!.detail).toContain('2× Fehler');
    expect(f76!.detail).toContain('11.10.2026, 11:20 UTC');
    expect(f76!.detail).toContain('0x8018002B');
    expect(f76!.evidence).toMatchObject({ eventId: 76, count: 2 });
  });

  it('bezieht nur Ereignisse im Zeitfenster ein (kein Ereignis vom 2026-09-01)', () => {
    const f76 = tile.findings.find((f) => f.id === 'mdmEvents-mdmAdmin-76')!;
    expect(f76.evidence?.['count']).toBe(2);
    const facts = JSON.stringify(tile.facts);
    expect(facts).toContain('14 Tage');
  });

  it('deutet Event-IDs nur mit Microsoft-Learn-Beleg; sonst „keine Deutung“ + Rohdaten', () => {
    const known = tile.findings.find((f) => f.id === 'mdmEvents-mdmAdmin-1819')!;
    expect(known.docsUrl).toMatch(LEARN_URL);
    const unknown = tile.findings.find((f) => f.id === 'mdmEvents-mdmAdmin-1234')!;
    expect(unknown.cause).toBe(de.rules.zip.mdmEvents.unknownEventCause);
    expect(unknown.title).not.toMatch(/:/);
    expect(unknown.detail).toContain('Operation = „Contoso Demo-Vorgang“');
  });

  it('deutet HRESULTs in den Ereignisdaten über die Wissensbasis', () => {
    const unknown = tile.findings.find((f) => f.id === 'mdmEvents-mdmAdmin-1234')!;
    expect(unknown.detail).toContain('0x80070005');
    // Result = 0x80070005 → Win32-Code 5 (Zugriff verweigert)
    expect(unknown.detail.toLowerCase()).toMatch(/zugriff|access|win32/);
  });

  it('Warnungen erscheinen, setzen die Kachel aber nicht auf „Warnung“', () => {
    const warn = tile.findings.find((f) => f.id === 'mdmEvents-mdmAdmin-208')!;
    expect(warn.severity).toBe('unknown');
    expect(warn.detail).toContain('Warnung');
  });

  it('enthält keine sensiblen Werte (UPN, Tenant-GUID, Seriennummer)', () => {
    const json = JSON.stringify(tile);
    expect(json).not.toContain('user@contoso.com');
    expect(json).not.toContain('00000000-0000-0000-0000-000000000000');
    expect(json).not.toContain('CONTOSO-SN-0001');
  });

  it('jeder Befund hat Titel, Ursache, Lösung, ZIP-Quelle und Learn-Link', () => {
    expect(tile.findings.length).toBeGreaterThan(0);
    for (const f of tile.findings) {
      expect(f.title.trim(), f.id).not.toBe('');
      expect(f.cause.trim(), f.id).not.toBe('');
      expect(f.remediation.length, f.id).toBeGreaterThanOrEqual(1);
      expect(f.source.kind, f.id).toBe('zip');
      expect(f.docsUrl, f.id).toMatch(LEARN_URL);
    }
  });
});

describe('Kachel „MDM-Ereignisse“ (Zustände)', () => {
  it('keine Fehlerereignisse → ok', () => {
    const t = tileFor(logWith({ scanned: 12 }));
    expect(t.severity).toBe('ok');
    expect(t.value).toBe(de.rules.zip.mdmEvents.valueOk);
    expect(t.findings).toEqual([]);
  });

  it('nur Warnungen → ok, Warnung wird als Hinweis angezeigt', () => {
    const t = tileFor(
      logWith({
        scanned: 3,
        counts: { critical: 0, error: 0, warning: 1 },
        events: [event({ level: 3, eventId: 4 })],
      }),
    );
    expect(t.severity).toBe('ok');
    expect(t.value).toContain('1 Warnung');
    expect(t.findings).toHaveLength(1);
  });

  it('Schwellwert: ab eventLogErrorWarningCount Fehlerereignissen → Warnung', () => {
    expect(THRESHOLDS.eventLogErrorWarningCount).toBe(1);
    const t = tileFor(logWith({ scanned: 1, events: [event()] }));
    expect(t.severity).toBe('warning');
  });

  it('Protokoll fehlt → „nicht verfügbar“ mit Grund', () => {
    const t = tileFor();
    expect(t.value).toBe(de.availability.unavailable);
    expect(t.summary).toBe(de.rules.zip.mdmEvents.reasons.missing);
    expect(t.severity).toBe('unknown');
    expect(t.findings.map((f) => f.id)).toEqual(['mdmEvents-unavailable-mdmAdmin']);
  });

  it.each([
    ['tooLarge', 'Größenlimit'],
    ['unreadable', 'konnte nicht'],
    ['invalid', 'keine gültige'],
  ] as const)('Status %s → nicht verfügbar mit Grund', (status, snippet) => {
    const t = tileFor(logWith({ status, sizeBytes: 60 * 1024 * 1024 }));
    expect(t.value).toBe(de.availability.unavailable);
    expect(t.summary).toContain(snippet);
    expect(t.severity).toBe('unknown');
  });

  it('gekappte/begrenzte Protokolle erhalten einen Hinweis-Befund', () => {
    const t = tileFor(logWith({ scanned: 1, events: [event()], incomplete: true, capped: true }));
    expect(t.findings.some((f) => f.id === 'mdmEvents-incomplete-mdmAdmin')).toBe(true);
    expect(t.severity).toBe('warning');
  });

  it('begrenzt die Zahl einzelner Gruppen und fasst den Rest zusammen', () => {
    const many = Array.from({ length: THRESHOLDS.eventLogMaxFindings + 3 }, (_, i) =>
      event({ eventId: 5000 + i, recordId: i + 1 }),
    );
    const t = tileFor(logWith({ scanned: many.length, events: many }));
    expect(t.findings.filter((f) => f.id.startsWith('mdmEvents-mdmAdmin-'))).toHaveLength(
      THRESHOLDS.eventLogMaxFindings,
    );
    expect(t.findings.some((f) => f.id === 'mdmEvents-more-mdmAdmin')).toBe(true);
  });

  it('unbekannte HRESULTs: „Unbekannter Code“ mit Hex und Dezimal', () => {
    const t = tileFor(
      logWith({
        scanned: 1,
        events: [event({ data: { Result: '0xC1234567' } })],
      }),
    );
    expect(t.findings[0]?.detail).toContain('0xC1234567');
    expect(t.findings[0]?.detail).toMatch(/Unbekannter Code/);
  });

  it('AAD-Operational: Ereignis 1081 wird gedeutet (Learn-Beleg), andere nur als Rohdaten', () => {
    const t = tileFor(
      logWith({ scanned: 1 }),
      logWith({
        id: 'aadOperational',
        entryName: 'Microsoft-Windows-AAD_Operational',
        entryPath: '(9) Events Microsoft-Windows-AAD_Operational Events.evtx',
        scanned: 2,
        events: [
          event({ eventId: 1081, recordId: 1, data: { ServerErrorCode: 'AADSTS-DEMO' } }),
          event({ eventId: 4242, recordId: 2 }),
        ],
      }),
    );
    const f1081 = t.findings.find((f) => f.id === 'mdmEvents-aadOperational-1081')!;
    expect(f1081.docsUrl).toMatch(LEARN_URL);
    expect(f1081.cause).toContain('1081');
    const other = t.findings.find((f) => f.id === 'mdmEvents-aadOperational-4242')!;
    expect(other.cause).toBe(de.rules.zip.mdmEvents.unknownEventCause);
  });
});

describe('Wissensbasis Ereignisse', () => {
  it('jeder Eintrag hat eine Microsoft-Learn-URL, Titel, Ursache und Lösung', () => {
    for (const e of EVENT_KNOWLEDGE) {
      expect(e.docsUrl, `${e.log}/${e.eventId}`).toMatch(LEARN_URL);
      expect(e.title.trim()).not.toBe('');
      expect(e.cause.trim()).not.toBe('');
      expect(e.remediation.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('findet Einträge nur für das passende Protokoll', () => {
    expect(findEventKnowledge('mdmAdmin', 76)?.docsUrl).toMatch(LEARN_URL);
    expect(findEventKnowledge('aadOperational', 76)).toBeUndefined();
    expect(findEventKnowledge('mdmAdmin', 123456)).toBeUndefined();
  });
});
