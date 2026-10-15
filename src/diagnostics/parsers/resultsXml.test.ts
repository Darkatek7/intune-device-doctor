import { describe, expect, it } from 'vitest';
import { interpretHresult, parseResultsXml } from './resultsXml';

const XML = `<?xml version="1.0"?>\r\n<Collection HRESULT="0">\r\n<ID>x</ID>\r\n<RegistryKey HRESULT="-2147024893">HKLM\\Software\\A &amp; B</RegistryKey>\r\n<RegistryKey HRESULT="-2147024895">HKLM\\Missing</RegistryKey>\r\n<Command HRESULT="-2147418113">cmd /c x</Command>\r\n<FoldersFiles HRESULT="-2147024893">%ProgramData%\\X\\*.*</FoldersFiles>\r\n<Events HRESULT="0">System</Events>\r\n</Collection>`;

describe('parseResultsXml', () => {
  it('liest Typ, Ziel und HRESULT (dezimal und hex)', () => {
    const items = parseResultsXml(XML);
    expect(items).toHaveLength(5);
    expect(items[0]).toEqual({
      kind: 'RegistryKey',
      target: 'HKLM\\Software\\A & B',
      hresultDecimal: -2147024893,
      hresultHex: '0x80070003',
    });
    expect(items[2]?.hresultHex).toBe('0x8000FFFF');
  });
});

describe('interpretHresult', () => {
  it('wertet RegistryKey 0x80070003 als erfolgreichen Export', () => {
    expect(interpretHresult('RegistryKey', -2147024893).ok).toBe(true);
  });

  it('erkennt fehlende Schlüssel', () => {
    expect(interpretHresult('RegistryKey', -2147024895)).toMatchObject({ ok: false });
    expect(interpretHresult('RegistryKey', -2147024895).meaning).toBeUndefined();
  });

  it('deutet FoldersFiles und Command typabhängig', () => {
    expect(interpretHresult('FoldersFiles', -2147024893)).toMatchObject({
      ok: false,
      meaning: 'Pfad nicht gefunden',
    });
    expect(interpretHresult('FoldersFiles', -2147024894)).toMatchObject({
      ok: false,
      meaning: 'Datei nicht gefunden',
    });
    expect(interpretHresult('Command', -2147418113).ok).toBe(false);
    expect(interpretHresult('Command', 0).ok).toBe(true);
  });

  it('erfindet keine Deutung für unbekannte Codes', () => {
    expect(interpretHresult('Events', 5)).toEqual({ ok: false });
  });
});
