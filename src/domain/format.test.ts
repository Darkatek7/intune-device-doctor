import { describe, it, expect } from 'vitest';
import {
  daysSince,
  formatBytes,
  formatDate,
  formatDateTime,
  formatPercent,
  formatRelativeTime,
  hexToSignedDecimal,
  hresultToHex,
  hoursSince,
  maskId,
  maskUpn,
  normalizeHex,
  osFamilyFrom,
  maskUserPaths,
} from './format';

const NOW = new Date('2026-10-15T12:00:00Z');
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const inFuture = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

describe('formatRelativeTime', () => {
  it('formatiert Stunden in Vergangenheit', () => {
    expect(formatRelativeTime(ago(3 * HOUR), NOW)).toBe('vor 3 Std.');
  });

  it('formatiert Tage in Vergangenheit', () => {
    expect(formatRelativeTime(ago(41 * DAY), NOW)).toBe('vor 41 Tagen');
  });

  it('formatiert genau einen Tag als "gestern"', () => {
    expect(formatRelativeTime(ago(1 * DAY), NOW)).toBe('gestern');
  });

  it('formatiert Zeitpunkte unter einer Minute als "jetzt"', () => {
    expect(formatRelativeTime(ago(30_000), NOW)).toBe('jetzt');
    expect(formatRelativeTime(ago(59_999), NOW)).toBe('jetzt');
  });

  it('wechselt ab einer Minute auf Minuten', () => {
    expect(formatRelativeTime(ago(60_000), NOW)).toBe('vor 1 Min.');
  });

  it('formatiert Zukunftswerte', () => {
    expect(formatRelativeTime(inFuture(3 * HOUR), NOW)).toBe('in 3 Std.');
    expect(formatRelativeTime(inFuture(1 * DAY), NOW)).toBe('morgen');
  });

  it('liefert "–" für null, undefined, leere und ungültige Eingaben', () => {
    expect(formatRelativeTime(null, NOW)).toBe('–');
    expect(formatRelativeTime(undefined, NOW)).toBe('–');
    expect(formatRelativeTime('', NOW)).toBe('–');
    expect(formatRelativeTime('kein-datum', NOW)).toBe('–');
  });
});

describe('formatDateTime / formatDate', () => {
  it('formatiert Datum und Uhrzeit in der angegebenen Zeitzone', () => {
    expect(formatDateTime('2026-10-14T12:53:56Z', 'UTC')).toBe('14.10.2026, 12:53');
  });

  it('wendet die Zeitzone an (Europe/Berlin = UTC+2 im Oktober)', () => {
    expect(formatDateTime('2026-10-14T12:53:56Z', 'Europe/Berlin')).toBe('14.10.2026, 14:53');
  });

  it('verschiebt das Datum bei Zeitzonenwechsel über Mitternacht', () => {
    expect(formatDate('2026-10-15T23:30:00Z', 'UTC')).toBe('15.10.2026');
    expect(formatDate('2026-10-15T23:30:00Z', 'Europe/Berlin')).toBe('16.10.2026');
  });

  it('liefert "–" für null, undefined und ungültige Werte', () => {
    expect(formatDateTime(null)).toBe('–');
    expect(formatDateTime(undefined)).toBe('–');
    expect(formatDateTime('garbage')).toBe('–');
    expect(formatDate(null)).toBe('–');
    expect(formatDate(undefined)).toBe('–');
    expect(formatDate('garbage')).toBe('–');
  });
});

describe('daysSince / hoursSince', () => {
  it('zählt ganze Tage (abgerundet)', () => {
    expect(daysSince(ago(41 * DAY), NOW)).toBe(41);
    expect(daysSince(ago(41 * DAY + 5 * HOUR), NOW)).toBe(41);
    expect(daysSince(ago(23 * HOUR + 59 * 60_000), NOW)).toBe(0);
  });

  it('liefert negative Tage für Zukunftswerte', () => {
    expect(daysSince(inFuture(2 * DAY), NOW)).toBe(-2);
  });

  it('liefert null für ungültige Werte', () => {
    expect(daysSince(null, NOW)).toBeNull();
    expect(daysSince(undefined, NOW)).toBeNull();
    expect(daysSince('garbage', NOW)).toBeNull();
  });

  it('zählt Stunden mit Nachkommastellen', () => {
    expect(hoursSince(ago(3 * HOUR), NOW)).toBe(3);
    expect(hoursSince(ago(90 * 60_000), NOW)).toBe(1.5);
  });

  it('liefert null für ungültige Stunden-Werte', () => {
    expect(hoursSince(null, NOW)).toBeNull();
    expect(hoursSince('garbage', NOW)).toBeNull();
  });
});

describe('formatBytes', () => {
  it('formatiert Bytes ohne Einheit-Sprung', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1)).toBe('1 B');
    expect(formatBytes(999)).toBe('999 B');
    expect(formatBytes(1023)).toBe('1.023 B');
  });

  it('formatiert binäre Einheiten mit deutschem Dezimalkomma', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(237.5 * 1024 ** 3)).toBe('237,5 GB');
  });

  it('formatiert 476 GiB als "476 GB"', () => {
    expect(formatBytes(476 * 1024 ** 3)).toBe('476 GB');
  });

  it('bleibt bei TB stehen, auch wenn der Wert größer als 1024 ist', () => {
    expect(formatBytes(1024 ** 4)).toBe('1 TB');
    expect(formatBytes(1024 ** 5)).toBe('1.024 TB');
  });

  it('liefert "–" für null, undefined, negative und nicht-endliche Werte', () => {
    expect(formatBytes(null)).toBe('–');
    expect(formatBytes(undefined)).toBe('–');
    expect(formatBytes(-1)).toBe('–');
    expect(formatBytes(Number.NaN)).toBe('–');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('–');
  });
});

describe('formatPercent', () => {
  it('formatiert Ratio als Prozent mit einer Nachkommastelle', () => {
    expect(formatPercent(0.074)).toBe('7,4 %');
    expect(formatPercent(0.1234)).toBe('12,3 %');
    expect(formatPercent(0.5)).toBe('50 %');
  });

  it('behandelt 0 und 1 an den Rändern', () => {
    expect(formatPercent(0)).toBe('0 %');
    expect(formatPercent(1)).toBe('100 %');
  });
});

describe('osFamilyFrom', () => {
  it.each([
    ['Windows', 'windows'],
    ['Windows Server', 'windows'],
    ['macOS', 'macos'],
    ['iOS', 'ios'],
    ['iPadOS', 'ios'],
    ['Android', 'android'],
    ['AndroidEnterprise', 'android'],
    ['Linux', 'linux'],
    ['Ubuntu', 'linux'],
    ['  Windows  ', 'windows'],
    ['WINDOWS', 'windows'],
    ['ChromeOS', 'other'],
    ['Unknown', 'other'],
    ['', 'other'],
    ['   ', 'other'],
    [null, 'other'],
    [undefined, 'other'],
  ])('ordnet %j der Familie %j zu', (input, expected) => {
    expect(osFamilyFrom(input)).toBe(expected);
  });
});

describe('maskUpn', () => {
  it('verwirft eine angehängte Tenant-ID (Enrollment-UPN "user@domain@<Tenant-ID>")', () => {
    expect(maskUpn('max.mustermann@contoso.com@00000000-0000-0000-0000-0000000000aa')).toBe(
      'ma…@contoso.com',
    );
  });

  it('zeigt eine GUID als Domain nur maskiert', () => {
    expect(maskUpn('max@12345678-0000-0000-0000-0000000000aa')).not.toContain('0000-0000');
  });

  it('maskiert den Lokalteil auf zwei Zeichen', () => {
    expect(maskUpn('max.mustermann@contoso.com')).toBe('ma…@contoso.com');
  });

  it('zeigt bei kurzem Lokalteil nur, was vorhanden ist', () => {
    expect(maskUpn('a@contoso.com')).toBe('a…@contoso.com');
    expect(maskUpn('ab@contoso.com')).toBe('ab…@contoso.com');
  });

  it('maskiert ohne "@" nur die ersten zwei Zeichen', () => {
    expect(maskUpn('maxmustermann')).toBe('ma…');
    expect(maskUpn('x')).toBe('x…');
  });

  it('liefert bei leerem Lokalteil keinen Klartext', () => {
    expect(maskUpn('@contoso.com')).toBe('…@contoso.com');
  });

  it('liefert null für null, undefined und leere Strings', () => {
    expect(maskUpn(null)).toBeNull();
    expect(maskUpn(undefined)).toBeNull();
    expect(maskUpn('')).toBeNull();
  });
});

describe('maskId', () => {
  it('maskiert eine GUID auf die ersten und letzten vier Zeichen', () => {
    expect(maskId('00000000-0000-4000-8000-000000000042')).toBe('0000…0042');
  });

  it('maskiert kurze IDs (<= 8 Zeichen) vollständig', () => {
    expect(maskId('abcdefgh')).toBe('…');
    expect(maskId('a')).toBe('…');
  });

  it('zeigt bei 9 Zeichen noch Anfang und Ende', () => {
    expect(maskId('abcdefghi')).toBe('abcd…fghi');
  });

  it('liefert null für null, undefined und leere Strings', () => {
    expect(maskId(null)).toBeNull();
    expect(maskId(undefined)).toBeNull();
    expect(maskId('')).toBeNull();
  });
});

describe('hresultToHex', () => {
  it.each([
    [-2147024893, '0x80070003'],
    [-2147023294, '0x80070642'],
    [-2147024891, '0x80070005'],
    [-2016281112, '0x87D1FDE8'],
    [0, '0x00000000'],
    [3010, '0x00000BC2'],
    [-1, '0xFFFFFFFF'],
    [-2147483648, '0x80000000'],
    [2147483647, '0x7FFFFFFF'],
  ])('wandelt %i in %s', (value, expected) => {
    expect(hresultToHex(value)).toBe(expected);
  });
});

describe('normalizeHex', () => {
  it('übernimmt bereits normalisierte Werte', () => {
    expect(normalizeHex('0x80070642')).toBe('0x80070642');
  });

  it('normalisiert Kleinbuchstaben zu Großbuchstaben', () => {
    expect(normalizeHex('0x80070bc2')).toBe('0x80070BC2');
  });

  it('akzeptiert großes "X" und Leerraum außen', () => {
    expect(normalizeHex('0X80070BC2')).toBe('0x80070BC2');
    expect(normalizeHex('  0x80070642  ')).toBe('0x80070642');
  });

  it('füllt kurze Werte auf 8 Stellen auf', () => {
    expect(normalizeHex('0x1')).toBe('0x00000001');
  });

  it('liefert null für ungültige Eingaben', () => {
    expect(normalizeHex('abc')).toBeNull();
    expect(normalizeHex('80070642')).toBeNull();
    expect(normalizeHex('0x')).toBeNull();
    expect(normalizeHex('0x123456789')).toBeNull();
    expect(normalizeHex('0x80070g42')).toBeNull();
    expect(normalizeHex('')).toBeNull();
    expect(normalizeHex(null)).toBeNull();
    expect(normalizeHex(undefined)).toBeNull();
  });
});

describe('hexToSignedDecimal', () => {
  it.each([
    ['0x80070642', -2147023294],
    ['0x87D1FDE8', -2016281112],
    ['0x00000BC2', 3010],
    ['0xFFFFFFFF', -1],
    ['0x80070bc2', 0x80070bc2 | 0],
  ])('wandelt %s in die signierte Dezimalzahl %i', (hex, expected) => {
    expect(hexToSignedDecimal(hex)).toBe(expected);
  });

  it('liefert null für ungültige Hex-Werte', () => {
    expect(hexToSignedDecimal('nope')).toBeNull();
    expect(hexToSignedDecimal('0x123456789')).toBeNull();
    expect(hexToSignedDecimal('')).toBeNull();
  });

  it.each([-2147024893, -2147023294, -2016281112, 0, 3010, -1, -2147483648, 2147483647])(
    'Roundtrip mit hresultToHex für %i',
    (value) => {
      expect(hexToSignedDecimal(hresultToHex(value))).toBe(value);
    },
  );

  it('Roundtrip in der Gegenrichtung liefert die normalisierte Hex-Form', () => {
    expect(hresultToHex(hexToSignedDecimal('0x80070642') ?? Number.NaN)).toBe('0x80070642');
    expect(hresultToHex(hexToSignedDecimal('0x87d1fde8') ?? Number.NaN)).toBe('0x87D1FDE8');
  });
});

describe('maskUserPaths', () => {
  it('maskiert Benutzernamen in Windows-Pfaden und flachen ZIP-Namen', () => {
    expect(maskUserPaths('C:\\Users\\max.mustermann\\AppData\\Local')).toBe(
      'C:\\Users\\…\\AppData\\Local',
    );
    expect(maskUserPaths('FoldersFiles Users_jdoe_AppData_Local_Temp')).toBe(
      'FoldersFiles Users_…_AppData_Local_Temp',
    );
  });
  it('lässt öffentliche Profile und andere Texte unverändert', () => {
    expect(maskUserPaths('C:\\Users\\Public\\Desktop')).toBe('C:\\Users\\Public\\Desktop');
    expect(maskUserPaths('ProgramData_Microsoft_IntuneManagementExtension_Logs')).toBe(
      'ProgramData_Microsoft_IntuneManagementExtension_Logs',
    );
  });
});
