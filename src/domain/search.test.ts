import { describe, expect, it } from 'vitest';
import { matchesSerialNumber, normalizeSerialNumber } from './search';

describe('Suche per Seriennummer', () => {
  it('normalisiert Leerzeichen und Groß-/Kleinschreibung', () => {
    expect(normalizeSerialNumber(' demo-000042 ')).toBe('DEMO-000042');
    expect(normalizeSerialNumber('DEMO 0000 42')).toBe('DEMO000042');
    expect(normalizeSerialNumber(null)).toBe('');
  });

  it('vergleicht exakt, ohne Teiltreffer', () => {
    expect(matchesSerialNumber('DEMO-000042', 'demo-000042')).toBe(true);
    expect(matchesSerialNumber('DEMO-000042', ' DEMO-000042 ')).toBe(true);
    expect(matchesSerialNumber('DEMO-000042', '000042')).toBe(false);
    expect(matchesSerialNumber(null, 'DEMO-000042')).toBe(false);
    expect(matchesSerialNumber('DEMO-000042', '   ')).toBe(false);
  });
});
