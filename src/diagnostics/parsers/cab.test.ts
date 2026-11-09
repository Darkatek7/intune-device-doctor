import { describe, expect, it } from 'vitest';
import { buildCab, type CabFileInput } from '../cabFixture';
import { cabBaseName, CabFormatError, CabLimitError, CabUnsupportedError, openCab } from './cab';

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Deterministische Pseudo-Zufallsbytes (fiktiv), kaum komprimierbar. */
function noise(length: number, seed = 1): Uint8Array {
  const out = new Uint8Array(length);
  let x = seed >>> 0 || 1;
  for (let i = 0; i < length; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    out[i] = x >>> 24;
  }
  return out;
}

/** Wiederholt einen Zufallsblock: komprimierbar nur über Verweise auf frühere Blöcke. */
function repeating(length: number, period = 3000): Uint8Array {
  const unit = noise(period, 7);
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = unit[i % period]!;
  return out;
}

/** TextEncoder liefert unter jsdom ein Uint8Array aus fremdem Realm; Kopie vermeidet toEqual-Fehlschläge. */
const text = (s: string): Uint8Array => Uint8Array.from(enc.encode(s));

describe('openCab: Kopf und Dateiliste', () => {
  it('liest Dateiliste, Größen, Ordner und Version', () => {
    const cab = openCab(
      buildCab([
        { name: 'MDMDiagReport.xml', data: text('<a/>') },
        { name: 'readme.txt', data: text('hallo'), folder: 1 },
      ]),
    );
    expect(cab.version).toBe('1.3');
    expect(cab.truncated).toBe(false);
    expect(cab.hasPrev).toBe(false);
    expect(cab.hasNext).toBe(false);
    expect(cab.folders.map((f) => f.compression)).toEqual(['none', 'none']);
    expect(cab.files.map((f) => [f.name, f.size, f.folderIndex, f.offset])).toEqual([
      ['MDMDiagReport.xml', 4, 0, 0],
      ['readme.txt', 5, 1, 0],
    ]);
  });

  it('UTF-8-Namen mit Attribut und Pfadanteil', () => {
    const cab = openCab(
      buildCab([
        { name: 'Bericht-äöü.txt', data: text('x'), utf: true },
        { name: 'sub\\dir\\file.evtx', data: text('y') },
      ]),
    );
    expect(cab.files.map((f) => f.name)).toEqual(['Bericht-äöü.txt', 'sub\\dir\\file.evtx']);
    expect(cabBaseName('sub\\dir\\file.evtx')).toBe('file.evtx');
    expect(cabBaseName('a/b.txt')).toBe('b.txt');
    expect(cabBaseName('c.txt')).toBe('c.txt');
  });

  it('Reserve-Bereiche für Kopf, Ordner und Datenblock werden übersprungen', () => {
    const files: CabFileInput[] = [{ name: 'a.txt', data: text('Contoso Demo') }];
    for (const compression of ['none', 'mszip'] as const) {
      const cab = openCab(
        buildCab(files, { compression, reserve: { header: 6, folder: 3, data: 2 } }),
      );
      expect(dec.decode(cab.extract(cab.files[0]!))).toBe('Contoso Demo');
    }
  });

  it('keine Cabinet-Datei → signature; zu kurz → header', () => {
    expect(() => openCab(text('PK\u0003\u0004 kein Cabinet'))).toThrowError(CabFormatError);
    try {
      openCab(new Uint8Array(10));
    } catch (error) {
      expect((error as CabFormatError).code).toBe('signature');
    }
    try {
      openCab(buildCab([{ name: 'a', data: text('b') }]).subarray(0, 20));
    } catch (error) {
      expect((error as CabFormatError).code).toBe('header');
    }
  });
});

describe('extract: unkomprimiert', () => {
  it('mehrere Dateien in mehreren Ordnern, Blockgrenzen überschreitend', () => {
    const a = noise(2500, 1);
    const b = noise(1800, 2);
    const c = noise(700, 3);
    const cab = openCab(
      buildCab(
        [
          { name: 'a.bin', data: a },
          { name: 'b.bin', data: b },
          { name: 'c.bin', data: c, folder: 1 },
        ],
        { blockSize: 1000 },
      ),
    );
    expect(cab.folders[0]!.blockCount).toBe(5);
    const byName = (n: string) => cab.files.find((f) => f.name === n)!;
    expect(cab.extract(byName('a.bin'))).toEqual(a);
    expect(cab.extract(byName('b.bin'))).toEqual(b);
    expect(cab.extract(byName('c.bin'))).toEqual(c);
  });

  it('leere Datei ergibt leeres Ergebnis', () => {
    const cab = openCab(
      buildCab([
        { name: 'leer.txt', data: new Uint8Array(0) },
        { name: 'x.txt', data: text('x') },
      ]),
    );
    expect(cab.extract(cab.files[0]!)).toHaveLength(0);
    expect(dec.decode(cab.extract(cab.files[1]!))).toBe('x');
  });
});

describe('extract: MSZIP', () => {
  it('mehrere Blöcke mit Wörterbuch über Blockgrenzen (Verweise auf frühere Blöcke)', () => {
    const data = repeating(60_000);
    const raw = buildCab([{ name: 'log.evtx', data }], {
      compression: 'mszip',
      blockSize: 1024,
    });
    const cab = openCab(raw);
    expect(cab.folders[0]!.compression).toBe('mszip');
    expect(cab.folders[0]!.blockCount).toBeGreaterThan(50);
    // Ohne Wörterbuch wäre der Zufallsanteil unkomprimierbar: das Ergebnis muss deutlich kleiner sein.
    expect(raw.length).toBeLessThan(data.length * 0.3);
    expect(cab.extract(cab.files[0]!)).toEqual(data);
  });

  it('Datei in der Mitte eines Ordners (Offset und Länge ungleich Blockgrenze)', () => {
    const first = repeating(7000, 2000);
    const second = repeating(9100, 2000);
    const third = text('Ende-Marker\r\n');
    const cab = openCab(
      buildCab(
        [
          { name: 'eins.bin', data: first },
          { name: 'zwei.bin', data: second },
          { name: 'drei.txt', data: third },
        ],
        { compression: 'mszip', blockSize: 3000 },
      ),
    );
    const get = (n: string) => cab.extract(cab.files.find((f) => f.name === n)!);
    expect(get('zwei.bin')).toEqual(second);
    expect(get('drei.txt')).toEqual(third);
    expect(get('eins.bin')).toEqual(first);
  });

  it('Standard-Blockgröße 32 KiB mit zwei Ordnern', () => {
    const a = repeating(100_000, 5000);
    const b = text('<Report>Contoso</Report>');
    const cab = openCab(
      buildCab(
        [
          { name: 'a.bin', data: a },
          { name: 'b.xml', data: b, folder: 1 },
        ],
        { compression: 'mszip' },
      ),
    );
    expect(cab.folders[0]!.blockCount).toBe(4);
    expect(cab.extract(cab.files[0]!)).toEqual(a);
    expect(cab.extract(cab.files[1]!)).toEqual(b);
  });
});

describe('defekte und gekappte Cabinets', () => {
  const files: CabFileInput[] = [
    { name: 'a.bin', data: noise(6000, 4) },
    { name: 'b.bin', data: noise(6000, 5) },
  ];

  it('gekappt: Dateiliste bleibt lesbar, später Dateien scheitern mit truncated', () => {
    const full = buildCab(files, { compression: 'mszip', blockSize: 2000 });
    const cab = openCab(full.subarray(0, Math.floor(full.length * 0.7)));
    expect(cab.truncated).toBe(true);
    expect(cab.files).toHaveLength(2);
    expect(() => cab.extract(cab.files[1]!)).toThrowError(
      expect.objectContaining({ code: 'truncated' }),
    );
  });

  it('gekappt mitten in der Dateiliste: vollständige Einträge bleiben erhalten', () => {
    const full = buildCab(files);
    const cab = openCab(full.subarray(0, 36 + 8 + 16 + 6 + 1 + 16));
    expect(cab.truncated).toBe(true);
    expect(cab.files.length).toBeLessThan(2);
  });

  it('defekte Prüfsumme wird erkannt', () => {
    const raw = buildCab(files, { compression: 'mszip', blockSize: 2000 });
    const cab = openCab(raw);
    const at = cab.folders[0]!.dataOffset + 20;
    raw[at] = raw[at]! ^ 0xff;
    expect(() => cab.extract(cab.files[0]!)).toThrowError(
      expect.objectContaining({ code: 'checksum' }),
    );
  });

  it('defekte MSZIP-Daten ohne Prüfsumme → inflate/size, nie ein stiller Erfolg', () => {
    const raw = buildCab([{ name: 'x', data: repeating(5000) }], {
      compression: 'mszip',
      blockSize: 2000,
      checksums: false,
    });
    const cab = openCab(raw);
    for (let i = 0; i < 40; i++) raw[cab.folders[0]!.dataOffset + 10 + i] = 0xff;
    expect(() => cab.extract(cab.files[0]!)).toThrowError(CabFormatError);
  });

  it('fehlende MSZIP-Signatur CK', () => {
    const raw = buildCab(files, { compression: 'mszip', checksums: false });
    const cab = openCab(raw);
    raw[cab.folders[0]!.dataOffset + 8] = 0x00;
    expect(() => cab.extract(cab.files[0]!)).toThrowError(
      expect.objectContaining({ code: 'mszip' }),
    );
  });

  it('Offset der Dateiliste außerhalb der Datei', () => {
    const raw = buildCab(files);
    new DataView(raw.buffer).setUint32(16, 0x7fffffff, true);
    expect(() => openCab(raw)).toThrowError(expect.objectContaining({ code: 'file' }));
  });

  it('Ordner-Datenoffset außerhalb der Datei', () => {
    const raw = buildCab(files);
    new DataView(raw.buffer).setUint32(36, 0x7fffffff, true);
    const cab = openCab(raw);
    expect(() => cab.extract(cab.files[0]!)).toThrowError(
      expect.objectContaining({ code: 'truncated' }),
    );
  });

  it('Datei verweist auf nicht vorhandenen Ordner', () => {
    const raw = buildCab(files);
    new DataView(raw.buffer).setUint16(36 + 8 + 8, 5, true);
    expect(() => openCab(raw)).toThrowError(expect.objectContaining({ code: 'folder' }));
  });

  it('Datei größer als der Ordner → truncated statt Endlosschleife', () => {
    const raw = buildCab(files);
    new DataView(raw.buffer).setUint32(36 + 8, 100_000, true);
    const cab = openCab(raw);
    expect(() => cab.extract(cab.files[0]!)).toThrowError(CabFormatError);
  });
});

describe('nicht unterstützt und Limits', () => {
  it('LZX → CabUnsupportedError(lzx), Dateiliste bleibt lesbar', () => {
    const cab = openCab(
      buildCab([{ name: 'a.bin', data: noise(100) }], { rawTypeCompress: 0x1503 }),
    );
    expect(cab.folders[0]!.compression).toBe('lzx');
    expect(cab.files).toHaveLength(1);
    try {
      cab.extract(cab.files[0]!);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CabUnsupportedError);
      expect((error as CabUnsupportedError).reason).toBe('lzx');
    }
  });

  it('Quantum und unbekannte Verfahren', () => {
    for (const [raw, reason] of [
      [0x0002, 'quantum'],
      [0x000f, 'unknown'],
    ] as const) {
      const cab = openCab(buildCab([{ name: 'a', data: noise(10) }], { rawTypeCompress: raw }));
      expect(() => cab.extract(cab.files[0]!)).toThrowError(expect.objectContaining({ reason }));
    }
  });

  it('Datei über mehrere Cabinets → multiVolume', () => {
    const raw = buildCab([{ name: 'a', data: noise(10) }]);
    new DataView(raw.buffer).setUint16(36 + 8 + 8, 0xfffe, true);
    const cab = openCab(raw);
    expect(cab.files[0]!.continuedToNext).toBe(true);
    expect(() => cab.extract(cab.files[0]!)).toThrowError(
      expect.objectContaining({ reason: 'multiVolume' }),
    );
  });

  it('Größenlimit für die entpackte Datei und für die Datenmenge', () => {
    const cab = openCab(buildCab([{ name: 'a.bin', data: noise(5000) }], { compression: 'mszip' }));
    const file = cab.files[0]!;
    expect(() => cab.extract(file, { maxBytes: 4999 })).toThrowError(CabLimitError);
    expect(() => cab.extract(file, { maxScanBytes: 100 })).toThrowError(
      expect.objectContaining({ limit: 'scan' }),
    );
    expect(cab.extract(file, { maxBytes: 5000 })).toHaveLength(5000);
  });

  it('maxFiles begrenzt die Dateiliste', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `f${i}.txt`, data: text('x') }));
    expect(openCab(buildCab(many), { maxFiles: 5 }).files).toHaveLength(5);
  });
});
