import { describe, expect, it } from 'vitest';
import { cp850, utf16leWithBom, utf8, utf8WithBom } from '../fixture';
import { decodeCp850, decodeText, isOemCommandName } from './encoding';

describe('decodeText', () => {
  it('erkennt UTF-16LE per BOM', () => {
    expect(decodeText(utf16leWithBom('Grüße'))).toEqual({ text: 'Grüße', encoding: 'utf-16le' });
  });

  it('entfernt das UTF-8-BOM', () => {
    expect(decodeText(utf8WithBom('Grüße'))).toEqual({ text: 'Grüße', encoding: 'utf-8' });
  });

  it('dekodiert UTF-8 ohne BOM', () => {
    expect(decodeText(utf8('abc'))).toEqual({ text: 'abc', encoding: 'utf-8' });
  });

  it('verträgt leere Eingaben', () => {
    expect(decodeText(new Uint8Array(0)).text).toBe('');
  });
});

describe('CP850 (OEM-Codepage)', () => {
  // Bytes laut CP850: ä=84 ö=94 ü=81 ß=E1 Ä=8E Ö=99 Ü=9A
  const umlauts = Uint8Array.from([0x84, 0x94, 0x81, 0xe1, 0x8e, 0x99, 0x9a]);

  it('dekodiert Umlaute und Eszett', () => {
    expect(decodeCp850(umlauts)).toBe('äöüßÄÖÜ');
  });

  it('dekodiert ASCII unverändert und die Tabelle 0x80–0xFF vollständig', () => {
    expect(decodeCp850(utf8('ipconfig /all'))).toBe('ipconfig /all');
    const all = Uint8Array.from({ length: 128 }, (_, i) => 0x80 + i);
    const text = decodeCp850(all);
    expect(text).toHaveLength(128);
    expect(text).not.toContain('�');
    expect(text.startsWith('Çüéâ')).toBe(true);
    expect(text[0x9b - 0x80]).toBe('ø');
    expect(text[0xc4 - 0x80]).toBe('─');
  });

  it('nutzt CP850 nur für OEM-Einträge ohne BOM', () => {
    const bytes = Uint8Array.from([...utf8('Primäres'.slice(0, 4)), 0x84, ...utf8('res')]);
    expect(decodeText(bytes, { oem: true })).toEqual({ text: 'Primäres', encoding: 'cp850' });
    // ohne oem-Hinweis: Verhalten unverändert (ungültiges UTF-8 → Ersatzzeichen)
    expect(decodeText(bytes).text).toContain('�');
  });

  it('lässt echtes UTF-8 und BOM-Dateien auch bei OEM-Einträgen unangetastet', () => {
    expect(decodeText(utf8('Grüße'), { oem: true })).toEqual({ text: 'Grüße', encoding: 'utf-8' });
    expect(decodeText(utf8WithBom('Grüße'), { oem: true }).encoding).toBe('utf-8');
    expect(decodeText(utf16leWithBom('Grüße'), { oem: true }).encoding).toBe('utf-16le');
  });

  it('erkennt OEM-Befehle am Eintragsnamen', () => {
    expect(isOemCommandName('windir_system32_ipconfig_exe_-all')).toBe(true);
    expect(isOemCommandName('windir_system32_certutil_exe_-store_My')).toBe(true);
    expect(isOemCommandName('windir_system32_pnputil_exe_-enum-devices')).toBe(true);
    expect(isOemCommandName('windir_system32_Dsregcmd_exe_status')).toBe(false);
  });

  it('cp850() des Fixtures ist die Umkehrung von decodeCp850()', () => {
    expect(decodeCp850(cp850('Größe über Äpfel ß'))).toBe('Größe über Äpfel ß');
  });
});
