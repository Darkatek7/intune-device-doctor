import { describe, expect, it } from 'vitest';
import {
  buildEvtx,
  buildEvtxFromRecords,
  V,
  type EvtxEventInput,
  type EvtxRecordSpec,
  type TemplateSpec,
} from '../evtxFixture';
import { EvtxFormatError, parseEvtx, EVTX_CHUNK_SIZE } from './evtx';

const T0 = '2026-10-10T08:00:00.000Z';

function event(overrides: Partial<EvtxEventInput> = {}): EvtxEventInput {
  return {
    time: T0,
    eventId: 76,
    level: 2,
    data: [['Message', 'Auto MDM Enroll: Failed (Unknown Win32 Error code: 0x8018002b)']],
    ...overrides,
  };
}

/** Datei mit n Ereignissen im Minutentakt (viele Datensätze → mehrere Chunks). */
function manyEvents(count: number): EvtxEventInput[] {
  return Array.from({ length: count }, (_, i) =>
    event({
      time: new Date(Date.parse(T0) + i * 60_000),
      eventId: 100 + (i % 7),
      level: 2 + (i % 3),
      data: [
        ['Param1', `Zeile ${i}`],
        [
          'Param2',
          'Contoso Demo-Eintrag mit etwas Text, damit die Datensätze eine realistische Größe haben',
        ],
      ],
    }),
  );
}

describe('parseEvtx – Roundtrip (Template, Substitutionen)', () => {
  it('liest System-Felder und benannte EventData-Werte', () => {
    const bytes = buildEvtx([
      event({ qualifiers: 0 }),
      event({
        time: '2026-10-11T09:30:15.250Z',
        eventId: 404,
        level: 3,
        recordId: 7,
        data: [
          ['ConfigurationSourceID', '00000000-0000-0000-0000-00000000000A'],
          ['Result', '-2147023674'],
        ],
      }),
    ]);
    const { events, stats } = parseEvtx(bytes);

    expect(stats).toMatchObject({
      chunksParsed: 1,
      chunksInvalid: 0,
      recordsDecoded: 2,
      recordsFailed: 0,
      truncated: false,
      capped: false,
    });
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      recordId: 1,
      eventId: 76,
      level: 2,
      timeCreated: '2026-10-10T08:00:00.000Z',
      provider: 'Microsoft-Windows-DeviceManagement-Enterprise-Diagnostics-Provider',
      channel: 'Microsoft-Windows-DeviceManagement-Enterprise-Diagnostics-Provider/Admin',
      computer: 'CONTOSO-PC042.contoso.com',
      data: { Message: 'Auto MDM Enroll: Failed (Unknown Win32 Error code: 0x8018002b)' },
      dataKind: 'EventData',
    });
    expect(events[1]).toMatchObject({
      recordId: 7,
      eventId: 404,
      level: 3,
      timeCreated: '2026-10-11T09:30:15.250Z',
      data: {
        ConfigurationSourceID: '00000000-0000-0000-0000-00000000000A',
        Result: '-2147023674',
      },
    });
  });

  it('nutzt Template-Definitionen wieder (zweiter Datensatz verweist per Offset)', () => {
    const one = buildEvtx([event()]);
    const two = buildEvtx([event(), event({ recordId: 2 })]);
    // Der zweite Datensatz trägt keine Definition mehr → deutlich kleiner als der erste.
    const usedOne = new DataView(one.buffer).getUint32(4096 + 48, true);
    const usedTwo = new DataView(two.buffer).getUint32(4096 + 48, true);
    expect(usedTwo - usedOne).toBeLessThan(usedOne - 512);
    expect(parseEvtx(two).events.map((e) => e.recordId)).toEqual([1, 2]);
  });

  it('unterstützt unbenannte Data-Elemente aus verschachteltem BinXml (klassischer Stil)', () => {
    const bytes = buildEvtx([
      event({
        style: 'binxml',
        eventId: 1,
        level: 2,
        provider: 'Contoso-Demo-Source',
        data: [
          ['', 'Erster Wert'],
          ['', 'Zweiter Wert mit <Sonderzeichen> & Umlauten äöüß'],
        ],
      }),
      event({
        style: 'binxml',
        eventId: 1,
        level: 2,
        provider: 'Contoso-Demo-Source',
        data: [
          ['', 'Dritter'],
          ['', 'Vierter'],
        ],
      }),
    ]);
    const { events, stats } = parseEvtx(bytes);
    expect(stats.recordsFailed).toBe(0);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      provider: 'Contoso-Demo-Source',
      dataKind: 'EventData',
      data: {
        Data1: 'Erster Wert',
        Data2: 'Zweiter Wert mit <Sonderzeichen> & Umlauten äöüß',
      },
    });
    expect(events[1]?.data).toEqual({ Data1: 'Dritter', Data2: 'Vierter' });
  });

  it('liest UserData als Feldname → Wert', () => {
    const { events } = parseEvtx(
      buildEvtx([
        event({
          style: 'userdata',
          data: [
            ['Reason', 'Contoso Test'],
            ['Code', '0x80070005'],
          ],
        }),
      ]),
    );
    expect(events[0]).toMatchObject({
      dataKind: 'UserData',
      data: { Reason: 'Contoso Test', Code: '0x80070005' },
    });
  });

  it('lässt optionale Substitutionen mit NULL-Wert weg (Qualifiers) und liest gesetzte', () => {
    const { events } = parseEvtx(buildEvtx([event(), event({ qualifiers: 16384 })]));
    // Beide Ereignisse sind lesbar; die Event-ID bleibt unabhängig vom Attribut erhalten.
    expect(events.map((e) => e.eventId)).toEqual([76, 76]);
  });

  it('erzeugt mehrere Chunks und liefert alle Ereignisse aufsteigend', () => {
    const input = manyEvents(900);
    const bytes = buildEvtx(input);
    expect(bytes.length).toBeGreaterThan(4096 + EVTX_CHUNK_SIZE);
    const { events, stats } = parseEvtx(bytes);
    expect(stats.chunksParsed).toBeGreaterThan(1);
    expect(events).toHaveLength(900);
    expect(events.map((e) => e.recordId)).toEqual(input.map((_, i) => i + 1));
    expect(events[899]?.data['Param1']).toBe('Zeile 899');
    expect(events[10]?.eventId).toBe(103);
  });
});

describe('parseEvtx – Werttypen', () => {
  const DATA = (i: number) => ({ el: 'Data', children: [{ sub: i }] });
  const template: TemplateSpec = {
    key: 'types',
    root: {
      el: 'Event',
      children: [
        {
          el: 'System',
          children: [
            { el: 'EventID', children: [{ sub: 0 }] },
            { el: 'Level', children: [{ sub: 1 }] },
          ],
        },
        { el: 'EventData', children: Array.from({ length: 24 }, (_, i) => DATA(i + 2)) },
      ],
    },
  };
  const when = new Date('2026-10-12T10:11:12.345Z');

  const cases: Array<[string, ReturnType<(typeof V)['string']>, string]> = [
    ['String', V.string('Zeichenkette äöü'), 'Zeichenkette äöü'],
    ['AnsiString', V.ansi('Ansi'), 'Ansi'],
    ['Int8', V.int8(-5), '-5'],
    ['UInt8', V.uint8(250), '250'],
    ['Int16', V.int16(-1234), '-1234'],
    ['UInt16', V.uint16(65000), '65000'],
    ['Int32', V.int32(-2147023674), '-2147023674'],
    ['UInt32', V.uint32(4000000000), '4000000000'],
    ['Int64', V.int64(-9007199254740993n), '-9007199254740993'],
    ['UInt64', V.uint64(18446744073709551615n), '18446744073709551615'],
    ['Float32', V.float32(1.5), '1.5'],
    ['Float64', V.float64(-2.25), '-2.25'],
    ['Bool', V.bool(true), 'true'],
    ['Binary', V.binary([0x00, 0xab, 0xff]), '00ABFF'],
    [
      'GUID',
      V.guid('{00000000-0000-0000-0000-00000000000A}'),
      '{00000000-0000-0000-0000-00000000000A}',
    ],
    [
      'GUID gemischt',
      V.guid('{3DA494E4-0FE2-415C-B895-FB5265C5C83B}'),
      '{3DA494E4-0FE2-415C-B895-FB5265C5C83B}',
    ],
    ['SizeT32', V.sizeT32(0x1f), '0x0000001f'],
    ['SizeT64', V.sizeT64(0x1f), '0x000000000000001f'],
    ['FILETIME', V.filetime(when), '2026-10-12T10:11:12.345Z'],
    ['SYSTEMTIME', V.systemtime(when), '2026-10-12T10:11:12.345Z'],
    ['SID', V.sid('S-1-5-21-1-2-3-1001'), 'S-1-5-21-1-2-3-1001'],
    ['HexInt32', V.hex32(0x80070642), '0x80070642'],
    ['HexInt64', V.hex64(0x1234n), '0x0000000000001234'],
    ['String-Array', V.stringArray(['a', 'b', 'c']), 'a, b, c'],
  ];

  it('dekodiert alle unterstützten Typen', () => {
    const values = [V.uint16(1), V.uint8(2), ...cases.map(([, v]) => v)];
    const spec: EvtxRecordSpec = { time: when, template, values };
    const { events, stats } = parseEvtx(buildEvtxFromRecords([spec]));
    expect(stats.recordsFailed).toBe(0);
    const data = events[0]?.data ?? {};
    cases.forEach(([label, , expected], index) => {
      expect([label, data[`Data${index + 1}`]]).toEqual([label, expected]);
    });
  });

  it('dekodiert UInt16-Arrays und leere/NULL-Werte', () => {
    const values = [
      V.uint16(1),
      V.uint8(2),
      V.uint16Array([1, 2, 3]),
      V.nil(),
      V.string(''),
      ...Array.from({ length: 19 }, () => V.nil()),
    ];
    const { events } = parseEvtx(buildEvtxFromRecords([{ time: when, template, values }]));
    expect(events[0]?.data['Data1']).toBe('1, 2, 3');
    expect(events[0]?.data['Data2']).toBe('');
    expect(events[0]?.data['Data3']).toBe('');
  });

  it('behandelt unbekannte Werttypen als leeren Wert, ohne den Datensatz zu verwerfen', () => {
    const values = [
      V.uint16(9),
      V.uint8(2),
      V.rawType(0x7e, [1, 2, 3]),
      V.string('danach'),
      ...Array.from({ length: 20 }, () => V.nil()),
    ];
    const { events, stats } = parseEvtx(buildEvtxFromRecords([{ time: when, template, values }]));
    expect(stats.recordsFailed).toBe(0);
    expect(events[0]?.data['Data1']).toBe('');
    expect(events[0]?.data['Data2']).toBe('danach');
  });
});

describe('parseEvtx – Fenster, Filter, Begrenzung', () => {
  const input = manyEvents(300);
  const bytes = buildEvtx(input);

  it('überspringt Datensätze vor `since`, ohne Binary XML zu lesen', () => {
    const since = new Date(Date.parse(T0) + 250 * 60_000);
    const { events, stats } = parseEvtx(bytes, { since });
    expect(events).toHaveLength(50);
    expect(stats.recordsOutsideWindow).toBe(250);
    expect(stats.recordsScanned).toBe(300);
    expect(events[0]?.data['Param1']).toBe('Zeile 250');
  });

  it('wendet `filter` an und behält nur passende Ereignisse', () => {
    const seen: number[] = [];
    const { events, stats } = parseEvtx(bytes, {
      filter: (e) => {
        seen.push(e.recordId);
        return e.level === 2;
      },
    });
    expect(seen).toHaveLength(300);
    expect(stats.recordsDecoded).toBe(300);
    expect(events).toHaveLength(100);
    expect(events.every((e) => e.level === 2)).toBe(true);
  });

  it('begrenzt auf die jüngsten Ereignisse (maxRecords/maxEvents)', () => {
    const limited = parseEvtx(bytes, { maxEvents: 40 });
    expect(limited.stats.capped).toBe(true);
    expect(limited.events).toHaveLength(40);
    // Jüngste zuerst: die letzten 40 Datensätze (oder mehr, wenn sie im selben Chunk lagen) – nie die ältesten.
    expect(limited.events.at(-1)?.recordId).toBe(300);
    expect(limited.events[0]?.recordId).toBeGreaterThan(200);

    const capped = parseEvtx(bytes, { maxRecords: 10 });
    expect(capped.stats.capped).toBe(true);
    expect(capped.events.length).toBeLessThanOrEqual(10);
  });

  it('beendet bei überschrittenem Zeitbudget mit dem bisherigen Ergebnis', () => {
    const result = parseEvtx(bytes, { timeBudgetMs: -1 });
    expect(result.stats.timedOut).toBe(true);
    expect(result.events).toHaveLength(0);
  });
});

describe('parseEvtx – defekte und gekappte Dateien', () => {
  it('lehnt Dateien ohne ElfFile-Signatur ab', () => {
    expect(() => parseEvtx(new Uint8Array(0))).toThrow(EvtxFormatError);
    expect(() => parseEvtx(new TextEncoder().encode('MZ\x90\x00 keine evtx'))).toThrow(
      EvtxFormatError,
    );
  });

  it('akzeptiert eine Datei, die nur aus dem Dateikopf besteht', () => {
    const header = buildEvtx(manyEvents(1)).slice(0, 4096);
    const { events, stats } = parseEvtx(header);
    expect(events).toEqual([]);
    expect(stats.chunksTotal).toBe(0);
    expect(stats.truncated).toBe(true); // Kopf meldet 1 Chunk, die Datei enthält keinen
  });

  it('liest bei gekappter Datei alle vollständigen Datensätze und meldet die Kappung', () => {
    const input = manyEvents(900);
    const full = buildEvtx(input);
    const cut = full.subarray(0, 4096 + EVTX_CHUNK_SIZE + 20_000); // zweiter Chunk nur teilweise
    const { events, stats } = parseEvtx(cut);
    expect(stats.truncated).toBe(true);
    expect(events.length).toBeGreaterThan(100);
    expect(events.length).toBeLessThan(900);
    // Die gelesenen Ereignisse sind lückenlos ab Datensatz 1 und stimmen inhaltlich.
    expect(events.map((e) => e.recordId)).toEqual(events.map((_, i) => i + 1));
    expect(events.at(-1)?.data['Param1']).toBe(`Zeile ${events.length - 1}`);
  });

  it('überspringt einen defekten Chunk (falsche Signatur) und liest die übrigen', () => {
    const full = buildEvtx(manyEvents(900));
    const damaged = new Uint8Array(full);
    damaged[4096] = 0x00; // Signatur des ersten Chunks zerstören
    damaged[4097] = 0x7a;
    const { events, stats } = parseEvtx(damaged);
    expect(stats.chunksInvalid).toBe(1);
    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBeLessThan(900);
    expect(events.at(-1)?.recordId).toBe(900);
  });

  it('überspringt einen beschädigten Datensatz und liest die folgenden (Resynchronisation)', () => {
    const bytes = buildEvtx([
      event({ recordId: 1 }),
      event({ recordId: 2 }),
      event({ recordId: 3 }),
    ]);
    const damaged = new Uint8Array(bytes);
    const dv = new DataView(damaged.buffer);
    // Offset des zweiten Datensatzes = 4096 + 512 + Größe des ersten
    const firstSize = dv.getUint32(4096 + 512 + 4, true);
    const second = 4096 + 512 + firstSize;
    dv.setUint32(second + 4, 0xffffffff, true); // Größe unplausibel
    const { events, stats } = parseEvtx(damaged);
    expect(events.map((e) => e.recordId)).toEqual([1, 3]);
    expect(stats.recordsFailed).toBeGreaterThanOrEqual(1);
  });

  it('verwirft einen Datensatz mit unbekanntem Token, liest aber die übrigen', () => {
    const bytes = buildEvtx([event({ recordId: 1 }), event({ recordId: 2 })]);
    const damaged = new Uint8Array(bytes);
    const dv = new DataView(damaged.buffer);
    const second = 4096 + 512 + dv.getUint32(4096 + 512 + 4, true);
    // Erstes Token nach dem Fragment-Header (0x0c, TemplateInstance) → unbekanntes Token 0x7f
    expect(damaged[second + 24 + 4]).toBe(0x0c);
    damaged[second + 24 + 4] = 0x7f;
    const { events, stats } = parseEvtx(damaged);
    expect(events.map((e) => e.recordId)).toEqual([1]);
    expect(stats.recordsFailed).toBe(1);
  });

  it('ignoriert ungültige Namens- und Template-Offsets', () => {
    const bytes = buildEvtx([event({ recordId: 1 }), event({ recordId: 2 })]);
    const damaged = new Uint8Array(bytes);
    const dv = new DataView(damaged.buffer);
    const second = 4096 + 512 + dv.getUint32(4096 + 512 + 4, true);
    // Template-Offset des zweiten Datensatzes (Token + Flag + ID = 6 Byte nach Fragment-Header)
    dv.setUint32(second + 24 + 4 + 6, 0x00ffff00, true);
    const { events } = parseEvtx(damaged);
    expect(events.map((e) => e.recordId)).toEqual([1]);
  });

  it('übersteht zufällig beschädigte Bytes ohne Ausnahme', () => {
    const base = buildEvtx(manyEvents(120));
    let seed = 12345;
    const random = () => {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
      return seed;
    };
    for (let round = 0; round < 30; round++) {
      const copy = new Uint8Array(base);
      for (let i = 0; i < 40; i++) copy[4096 + (random() % (copy.length - 4096))] = random() & 0xff;
      const { events, stats } = parseEvtx(copy);
      expect(stats.recordsDecoded).toBe(events.length);
    }
  });

  it('begrenzt Verschachtelung und Knotenzahl (kein Stapelüberlauf)', () => {
    // 2000 Verweise auf ein BinXml-Fragment mit je 12 Elementen → Expansion weit über dem Budget
    const small: TemplateSpec = {
      key: 'small',
      root: { el: 'EventData', children: Array.from({ length: 12 }, () => ({ el: 'B' })) },
    };
    const huge: TemplateSpec = {
      key: 'huge',
      root: {
        el: 'Event',
        children: Array.from({ length: 2000 }, () => ({ el: 'Data', children: [{ sub: 0 }] })),
      },
    };
    const { events, stats } = parseEvtx(
      buildEvtxFromRecords([{ time: T0, template: huge, values: [V.binxml(small, [])] }]),
    );
    expect(events).toEqual([]);
    expect(stats.recordsFailed).toBe(1);

    let deep: TemplateSpec['root'] = { el: 'Leaf' };
    for (let i = 0; i < 60; i++) deep = { el: 'N', children: [deep] };
    const nested: TemplateSpec = { key: 'deep', root: { el: 'Event', children: [deep] } };
    const result = parseEvtx(buildEvtxFromRecords([{ time: T0, template: nested, values: [] }]));
    expect(result.stats.recordsFailed).toBe(1);
  });
});
