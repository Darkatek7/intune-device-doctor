import { describe, expect, it } from 'vitest';
import { normalizeHex } from '../../domain/format';
import { PRT_ERRORS, findPrtError } from './prtErrors';
import { explainCode } from './win32';

const LEARN_URL = /^https:\/\/learn\.microsoft\.com\//;
const PRT_PAGE =
  'https://learn.microsoft.com/entra/identity/devices/troubleshoot-primary-refresh-token';
const STATUS_ANCHOR = '#status-codes';
const CLOUDAP_ANCHOR = '#common-cloudap-plug-in-error-codes';

describe('findPrtError', () => {
  it.each(['0xc000023c', '0xC000023C', ' 0xc000023c '])(
    '%j → STATUS_NETWORK_UNREACHABLE mit Status-Codes-Anker',
    (code) => {
      const entry = findPrtError(code);
      expect(entry?.hex).toBe('0xC000023C');
      expect(entry?.name).toBe('STATUS_NETWORK_UNREACHABLE');
      expect(entry?.docsUrl.startsWith(PRT_PAGE)).toBe(true);
      expect(entry?.docsUrl).toContain(STATUS_ANCHOR);
    },
  );

  it.each<string | null | undefined>([
    '0x12345678',
    null,
    undefined,
    'abc',
    '',
    'C000023C',
    '0xC000023',
    '0x0000C000023C',
    '0xZZZZZZZZ',
  ])('%j → undefined', (code) => {
    expect(findPrtError(code)).toBeUndefined();
  });
});

describe('PRT_ERRORS – Quellenpflicht und Form', () => {
  it.each(PRT_ERRORS.map((e) => [e.hex, e] as const))(
    '%s: normalisierter Hex-Wert, Learn-Link, Titel, Ursache und Lösung',
    (hex, entry) => {
      expect(hex).toMatch(/^0x[0-9A-F]{8}$/);
      expect(normalizeHex(hex)).toBe(hex);
      expect(entry.docsUrl).toMatch(LEARN_URL);
      expect(entry.docsUrl.startsWith(PRT_PAGE)).toBe(true);
      expect(entry.title.trim()).not.toBe('');
      expect(entry.cause.trim()).not.toBe('');
      expect(entry.remediation.length).toBeGreaterThanOrEqual(1);
      for (const step of entry.remediation) {
        expect(step.trim()).not.toBe('');
      }
    },
  );

  it('Hex-Codes sind eindeutig', () => {
    const hexes = PRT_ERRORS.map((e) => e.hex);
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it.each(PRT_ERRORS.map((e) => [e.hex] as const))(
    '%s wird über Hex in Groß- und Kleinschreibung gefunden',
    (hex) => {
      expect(findPrtError(hex)?.hex).toBe(hex);
      expect(findPrtError(hex.toLowerCase())?.hex).toBe(hex);
    },
  );
});

describe('PRT_ERRORS – Zuordnung von Name und Anker', () => {
  it.each([
    ['0xC000023C', 'STATUS_NETWORK_UNREACHABLE', STATUS_ANCHOR],
    ['0xC00000BE', 'STATUS_BAD_NETWORK_PATH', STATUS_ANCHOR],
    ['0xC00000C4', 'STATUS_UNEXPECTED_NETWORK_ERROR', STATUS_ANCHOR],
    ['0xC000006D', 'STATUS_LOGON_FAILURE', STATUS_ANCHOR],
    ['0xC000006A', 'STATUS_WRONG_PASSWORD', STATUS_ANCHOR],
    ['0xC00000D0', 'STATUS_REQUEST_NOT_ACCEPTED', STATUS_ANCHOR],
    ['0xC000005F', 'STATUS_NO_SUCH_LOGON_SESSION', STATUS_ANCHOR],
    ['0xC004844C', 'AAD_CLOUDAP_E_OAUTH_USERNAME_IS_MALFORMED', CLOUDAP_ANCHOR],
    ['0xC0048442', 'AAD_CLOUDAP_E_OAUTH_USER_SID_IS_EMPTY', CLOUDAP_ANCHOR],
  ])('%s → %s, Anker %s', (hex, name, anchor) => {
    const entry = findPrtError(hex);
    expect(entry?.name).toBe(name);
    expect(entry?.docsUrl).toContain(anchor);
  });

  it('Name stimmt mit der NTSTATUS-Deutung überein, wenn die Wissensbasis den Code kennt', () => {
    const known = explainCode('0xC000023C');
    expect(known.kind).toBe('ntstatus');
    expect(findPrtError('0xC000023C')?.name).toBe(known.name);
  });

  it('Namen sind eindeutig', () => {
    const names = PRT_ERRORS.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
