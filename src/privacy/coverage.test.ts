import { beforeAll, describe, expect, it } from 'vitest';
import { collectKnown } from './collect';
import { collectSensitiveValues, loadAllMockData, unclassifiedKeys } from '../test/privacyScan';

let data: unknown[] = [];
beforeAll(async () => {
  data = await loadAllMockData();
});

describe('Abdeckung der Demo-Daten', () => {
  it('jedes verdächtig benannte Feld ist als sensibel oder sichtbar eingeordnet (src/privacy/keys.ts)', () => {
    expect(unclassifiedKeys(data)).toEqual([]);
  });

  it('der Scanner findet Werte aller Arten in den Demo-Daten (sonst prüft er nichts)', () => {
    const values = collectSensitiveValues(data);
    expect(values).toContain('contoso-pc042');
    expect(values).toContain('sophie.hartmann@contoso.com');
    expect(values).toContain('sophie.hartmann');
    expect(values).toContain('sophie hartmann');
    expect(values.some((v) => v.startsWith('demo-0000'))).toBe(true);
    expect(values.some((v) => /^[0-9a-f]{8}-/.test(v))).toBe(true);
    expect(values.length).toBeGreaterThan(50);
  });

  it('der Sammler der App kennt jeden Wert, den der Scanner unter sensiblen Feldnamen findet', () => {
    const known = new Set(collectKnown(data).map((entry) => entry.value.trim().toLowerCase()));
    const missing = collectSensitiveValues(data).filter(
      (value) =>
        !known.has(value) && !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(value) && !value.includes('@'),
    );
    expect(missing).toEqual([]);
  });
});
