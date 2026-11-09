import { describe, expect, it } from 'vitest';
import { buildEvtx, type EvtxEventInput } from './evtxFixture';
import {
  analyzeEventLog,
  eventLogIdFor,
  loadEventLog,
  maskEventValue,
  selectEventLogEntries,
  type SelectedEventLog,
} from './eventLogs';
import type { DiagEntry } from './types';

const REFERENCE = '2026-10-14T12:53:56Z';

function entry(name: string, overrides: Partial<DiagEntry> = {}): DiagEntry {
  return {
    path: `(8) Events ${name} Events.evtx`,
    name,
    kind: 'Events',
    index: 8,
    isDirectory: false,
    uncompressedSize: 1000,
    failedHresult: null,
    ...overrides,
  };
}

const ADMIN = 'Microsoft-Windows-DeviceManagement-Enterprise-Diagnostics-Provider_Admin';

function selected(overrides: Partial<DiagEntry> = {}): SelectedEventLog {
  return { id: 'mdmAdmin', entry: entry(ADMIN, overrides) };
}

function ev(overrides: Partial<EvtxEventInput>): EvtxEventInput {
  return { time: '2026-10-10T08:00:00Z', eventId: 76, level: 2, data: [], ...overrides };
}

describe('eventLogIdFor / selectEventLogEntries', () => {
  it('erkennt das MDM-Admin-Protokoll (auch „Diagnostic-Provider“ und flache Namen)', () => {
    expect(eventLogIdFor(entry(ADMIN))).toBe('mdmAdmin');
    expect(
      eventLogIdFor(
        entry('Microsoft-Windows-DeviceManagement-Enterprise-Diagnostic-Provider_Admin'),
      ),
    ).toBe('mdmAdmin');
    expect(eventLogIdFor(entry('DeviceManagement-Enterprise-Diagnostics-Provider Admin'))).toBe(
      'mdmAdmin',
    );
  });

  it('erkennt das AAD-Operational-Protokoll', () => {
    expect(eventLogIdFor(entry('Microsoft-Windows-AAD_Operational'))).toBe('aadOperational');
  });

  it('ignoriert andere Protokolle, Debug/Operational des MDM-Providers und Nicht-Events', () => {
    expect(eventLogIdFor(entry('System'))).toBeNull();
    expect(
      eventLogIdFor(
        entry('Microsoft-Windows-DeviceManagement-Enterprise-Diagnostics-Provider_Debug'),
      ),
    ).toBeNull();
    expect(eventLogIdFor(entry(ADMIN, { kind: 'Command' }))).toBeNull();
    expect(eventLogIdFor(entry(ADMIN, { isDirectory: true }))).toBeNull();
    expect(eventLogIdFor(entry(ADMIN, { path: '(8) Events x.log' }))).toBeNull();
    expect(eventLogIdFor(entry(ADMIN, { failedHresult: '0x80070002' }))).toBeNull();
  });

  it('wählt je Protokoll genau einen Eintrag (den größten) in fester Reihenfolge', () => {
    const picked = selectEventLogEntries([
      entry('Microsoft-Windows-AAD_Operational', { path: 'a.evtx' }),
      entry(ADMIN, { path: 'small.evtx', uncompressedSize: 10 }),
      entry(ADMIN, { path: 'big.evtx', uncompressedSize: 99 }),
      entry('System'),
    ]);
    expect(picked.map((p) => [p.id, p.entry.path])).toEqual([
      ['mdmAdmin', 'big.evtx'],
      ['aadOperational', 'a.evtx'],
    ]);
  });
});

describe('maskEventValue', () => {
  it('maskiert UPN, GUID, SID, ChannelURI und Seriennummer', () => {
    const text = maskEventValue(
      'Message',
      'User user@contoso.com Tenant 11111111-2222-3333-4444-555555555555 SID S-1-5-21-111-222-333-1001 Serial Number: CONTOSO-SN-0001 ChannelURI: https://example.invalid/x',
    );
    expect(text).not.toContain('user@contoso.com');
    expect(text).not.toContain('11111111-2222-3333-4444-555555555555');
    expect(text).not.toContain('S-1-5-21-111');
    expect(text).not.toContain('CONTOSO-SN-0001');
    expect(text).not.toContain('example.invalid');
    expect(text).toContain('us…@contoso.com');
  });

  it('verwirft Felder namens ChannelURI/Serial vollständig bzw. kürzt sie', () => {
    expect(maskEventValue('ChannelURI', 'https://x.invalid/abc')).toBe('…');
    expect(maskEventValue('SerialNumber', 'CONTOSO-SN-0001')).toBe('CONT…0001');
    expect(maskEventValue('SerialNumber', '')).toBe('');
  });

  it('entfernt Steuerzeichen, kürzt URLs ohne Query und lange Werte', () => {
    expect(maskEventValue('X', 'a\u0000b\u0001c')).toBe('abc');
    expect(maskEventValue('X', 'https://login.contoso.com/path?token=geheim&x=1')).toBe(
      'https://login.contoso.com/path?…',
    );
    expect(maskEventValue('X', 'a'.repeat(1000)).length).toBeLessThanOrEqual(301);
  });

  it('maskiert Benutzernamen in Profilpfaden', () => {
    expect(maskEventValue('Path', 'C:\\Users\\max\\AppData')).toContain('Users\\…');
  });
});

describe('analyzeEventLog', () => {
  const opts = { referenceUtc: REFERENCE, windowDays: 14 };

  it('wertet Kritisch/Fehler/Warnung im 14-Tage-Fenster aus und zählt Information nur als geprüft', () => {
    const bytes = buildEvtx([
      ev({ time: '2026-09-01T00:00:00Z' }), // vor dem Fenster
      ev({ time: '2026-10-02T08:00:00Z', eventId: 76, level: 2 }),
      ev({ time: '2026-10-03T08:00:00Z', eventId: 75, level: 4 }),
      ev({ time: '2026-10-04T08:00:00Z', eventId: 5, level: 1 }),
      ev({ time: '2026-10-05T08:00:00Z', eventId: 6, level: 3 }),
    ]);
    const log = analyzeEventLog(bytes, selected(), opts);
    expect(log.status).toBe('ok');
    expect(log.windowStartUtc).toBe('2026-09-30T12:53:56.000Z');
    expect(log.windowEndUtc).toBe('2026-10-14T12:53:56.000Z');
    expect(log.scanned).toBe(4);
    expect(log.counts).toEqual({ critical: 1, error: 1, warning: 1 });
    expect(log.events.map((e) => [e.eventId, e.level])).toEqual([
      [76, 2],
      [5, 1],
      [6, 3],
    ]);
    expect(log.incomplete).toBe(false);
    expect(log.capped).toBe(false);
  });

  it('maskiert Ereignisdaten schon in der Auswertung', () => {
    const bytes = buildEvtx([
      ev({
        data: [
          ['Upn', 'user@contoso.com'],
          ['Tenant', '00000000-0000-0000-0000-000000000000'],
          ['SerialNumber', 'CONTOSO-SN-0001'],
        ],
      }),
    ]);
    const log = analyzeEventLog(bytes, selected(), opts);
    expect(JSON.stringify(log)).not.toContain('user@contoso.com');
    expect(JSON.stringify(log)).not.toContain('00000000-0000-0000-0000-000000000000');
    expect(JSON.stringify(log)).not.toContain('CONTOSO-SN-0001');
    expect(log.events[0]?.data['Upn']).toBe('us…@contoso.com');
  });

  it('ohne Referenzzeit gilt das jüngste Ereignis als Fensterende', () => {
    const bytes = buildEvtx([
      ev({ time: '2026-08-01T00:00:00Z' }),
      ev({ time: '2026-10-01T00:00:00Z', eventId: 77 }),
    ]);
    const log = analyzeEventLog(bytes, selected(), { referenceUtc: null, windowDays: 14 });
    expect(log.windowEndUtc).toBe('2026-10-01T00:00:00.000Z');
    expect(log.events.map((e) => e.eventId)).toEqual([77]);
  });

  it('meldet ungültige Dateien als „invalid“ und liefert nie eine Ausnahme', () => {
    const log = analyzeEventLog(new Uint8Array([1, 2, 3, 4]), selected(), opts);
    expect(log.status).toBe('invalid');
    expect(log.events).toEqual([]);
  });

  it('kennzeichnet gekappte Dateien als unvollständig, liefert aber die lesbaren Ereignisse', () => {
    const many = Array.from({ length: 1200 }, (_, i) =>
      ev({
        time: new Date(Date.parse('2026-10-05T00:00:00Z') + i * 60_000),
        eventId: 100 + (i % 3),
        data: [['Text', 'Contoso Demo-Eintrag mit etwas Text für eine realistische Größe']],
      }),
    );
    const full = buildEvtx(many);
    // mitten im zweiten Chunk kappen (Chunk 1 vollständig, Chunk 2 teilweise, Rest fehlt)
    const cut = full.subarray(0, 4096 + 65_536 + 20_000);
    const log = analyzeEventLog(cut, selected(), opts);
    expect(log.status).toBe('ok');
    expect(log.incomplete).toBe(true);
    expect(log.events.length).toBeGreaterThan(0);
    expect(log.events.length).toBeLessThan(1200);
  });
});

describe('loadEventLog', () => {
  const opts = { referenceUtc: REFERENCE, windowDays: 14 };

  it('prüft das Größenlimit vor dem Entpacken', async () => {
    let read = false;
    const zip = {
      readBytes: async () => {
        read = true;
        return { ok: false as const, reason: 'tooLarge' as const };
      },
    };
    const log = await loadEventLog(zip, selected({ uncompressedSize: 60 * 1024 * 1024 }), opts);
    expect(read).toBe(true);
    expect(log.status).toBe('tooLarge');
    expect(log.sizeBytes).toBe(60 * 1024 * 1024);
  });

  it('gibt das Limit an den Reader weiter (Standard 48 MiB, überschreibbar)', async () => {
    const seen: number[] = [];
    const zip = {
      readBytes: async (_e: DiagEntry, max: number) => {
        seen.push(max);
        return { ok: false as const, reason: 'error' as const };
      },
    };
    await loadEventLog(zip, selected(), opts);
    await loadEventLog(zip, selected(), { ...opts, maxBytes: 1234 });
    expect(seen).toEqual([48 * 1024 * 1024, 1234]);
  });

  it('wertet gelesene Bytes aus; Lesefehler ergeben „unreadable“', async () => {
    const ok = await loadEventLog(
      { readBytes: async () => ({ ok: true as const, bytes: buildEvtx([ev({})]) }) },
      selected(),
      opts,
    );
    expect(ok.status).toBe('ok');
    const bad = await loadEventLog(
      { readBytes: async () => ({ ok: false as const, reason: 'error' as const }) },
      selected(),
      opts,
    );
    expect(bad.status).toBe('unreadable');
  });
});
