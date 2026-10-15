import { describe, expect, it } from 'vitest';
import { utf16leWithBom, utf8, utf8WithBom } from '../fixture';
import { decodeText } from './encoding';

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
