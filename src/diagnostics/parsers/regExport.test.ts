import { describe, expect, it } from 'vitest';
import { getRegDword, getRegString, getRegValue, parseRegExport } from './regExport';

const REG = [
  'Windows Registry Editor Version 5.00',
  '',
  '[HKEY_LOCAL_MACHINE\\Software\\Test]',
  '@="default"',
  '"Str"="a \\"quoted\\" C:\\\\dir"',
  '"Dw"=dword:0000002a',
  '"Bin"=hex:01,02,',
  '"Multi"=hex(7):41,00,\\',
  '  42,00,00,00',
  '"Qw"=hex(b):01,00,00,00,00,00,00,00',
  '',
  '[HKEY_LOCAL_MACHINE\\Software\\Other]',
  '"X"="y"',
].join('\r\n');

describe('parseRegExport', () => {
  const keys = parseRegExport(REG);

  it('liest Keys und Werte', () => {
    expect(keys.map((k) => k.path)).toEqual([
      'HKEY_LOCAL_MACHINE\\Software\\Test',
      'HKEY_LOCAL_MACHINE\\Software\\Other',
    ]);
    expect(keys[0]?.values).toHaveLength(6);
  });

  it('löst Escapes und Default-Wert auf', () => {
    const key = keys[0]!;
    expect(getRegString(key, '@')).toBe('default');
    expect(getRegString(key, 'str')).toBe('a "quoted" C:\\dir');
  });

  it('liest dword und hex-Varianten', () => {
    const key = keys[0]!;
    expect(getRegDword(key, 'DW')).toBe(42);
    expect(getRegValue(key, 'Bin')).toMatchObject({ kind: 'hex', hexType: null, hex: '01,02,' });
    expect(getRegValue(key, 'Multi')).toMatchObject({
      kind: 'hex',
      hexType: '7',
      hex: '41,00,42,00,00,00',
    });
    expect(getRegValue(key, 'Qw')).toMatchObject({ hexType: 'b' });
  });

  it('wendet den Key-Filter an', () => {
    const filtered = parseRegExport(REG, { keyFilter: (p) => p.endsWith('Other') });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.values).toHaveLength(1);
  });
});
