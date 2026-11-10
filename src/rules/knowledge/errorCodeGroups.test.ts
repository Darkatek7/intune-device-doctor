import { describe, expect, it } from 'vitest';
import { hexToSignedDecimal } from '../../domain/format';
import { APP_ERROR_CODES } from './appErrors';
import { AUTOPILOT_ERROR_CODES } from './autopilotErrors';
import { ENROLLMENT_ERROR_CODES } from './enrollmentErrors';
import { ALL_ERROR_CODES, describeErrorCode, findIntuneErrorCode } from './errorCodes';
import { knowledgeEntry } from './knowledgeEntry';

const UNKNOWN = 'Unbekannter Code';

/** Quellseiten je Gruppe (CLAUDE.md Regel 4) – neue Einträge brauchen eine dieser geprüften Seiten. */
const ENROLLMENT_SOURCES = [
  'https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/troubleshoot-windows-enrollment-errors#',
  'https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/windows-user-cannot-enroll',
  'https://learn.microsoft.com/windows/client-management/mobile-device-enrollment#enrollment-error-messages',
  'https://learn.microsoft.com/autopilot/troubleshooting-faq#',
];
const AUTOPILOT_SOURCES = [
  'https://learn.microsoft.com/autopilot/known-issues#',
  'https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/troubleshoot-windows-enrollment-errors#',
];
const APP_SOURCES = [
  'https://learn.microsoft.com/troubleshoot/mem/intune/app-management/app-install-error-codes#other-installation-errors',
];

const fromSources = (url: string, sources: string[]) => sources.some((s) => url.startsWith(s));

describe('Gruppe Registrierung (enrollmentErrors)', () => {
  it('nur geprüfte Quellseiten', () => {
    expect(ENROLLMENT_ERROR_CODES.length).toBeGreaterThanOrEqual(15);
    for (const e of ENROLLMENT_ERROR_CODES)
      expect(fromSources(e.docsUrl, ENROLLMENT_SOURCES), e.hex).toBe(true);
  });

  it.each([
    ['0x8018002B', 'UPN'],
    ['0x80180014', 'Self-Deploying'],
    ['0x80180018', 'Lizenz'],
    ['0x801C0003', 'Gerätetyp-Einschränkung'],
    ['0x80180013', 'zu viele Geräte'],
  ])('%s wird mit Ursache gedeutet', (hex, causeFragment) => {
    const d = describeErrorCode(hex, UNKNOWN);
    expect(d.intune?.hex).toBe(hex);
    expect(d.intune?.cause).toContain(causeFragment);
    expect(d.label).toBe(d.intune?.title);
  });

  it('Dezimalform wie Intune sie meldet: -2145910763 → 0x80180015', () => {
    expect(findIntuneErrorCode(-2145910763)?.hex).toBe('0x80180015');
  });

  it('0x8007064C gilt nur im Registrierungskontext (sonst generisch Win32 1612)', () => {
    expect(describeErrorCode('0x8007064C', UNKNOWN, 'enrollment').intune?.hex).toBe('0x8007064C');
    const generic = describeErrorCode('0x8007064C', UNKNOWN);
    expect(generic.intune).toBeUndefined();
    expect(generic.explanation.baseCode).toBe(1612);
    expect(describeErrorCode('0x8007064C', UNKNOWN, 'app').intune).toBeUndefined();
  });
});

describe('Gruppe Autopilot/ESP (autopilotErrors)', () => {
  it('nur geprüfte Quellseiten', () => {
    expect(AUTOPILOT_ERROR_CODES.length).toBeGreaterThanOrEqual(6);
    for (const e of AUTOPILOT_ERROR_CODES)
      expect(fromSources(e.docsUrl, AUTOPILOT_SOURCES), e.hex).toBe(true);
  });

  it.each(['0x81039001', '0x81039023', '0x81039024', '0x801C03EA', '0x801C03F3', '0xC1036501'])(
    '%s ist ohne Kontext eindeutig gedeutet',
    (hex) => {
      expect(describeErrorCode(hex, UNKNOWN).intune?.hex).toBe(hex);
    },
  );

  it('0x800705B4: im Registrierungskontext TPM-Hinweis, sonst nur ERROR_TIMEOUT-Rückführung', () => {
    expect(describeErrorCode('0x800705B4', UNKNOWN, 'enrollment').intune?.cause).toContain('TPM');
    const generic = describeErrorCode('0x800705B4', UNKNOWN);
    expect(generic.intune).toBeUndefined();
    expect(generic.explanation.baseCode).toBe(1460);
  });

  it('0x80070774 nur im Registrierungskontext (Hybrid-Autopilot)', () => {
    const d = describeErrorCode(-2147022988, UNKNOWN, 'enrollment');
    expect(d.intune?.hex).toBe('0x80070774');
    expect(d.docsUrl).toContain('#something-went-wrong-error-code-80070774');
    expect(describeErrorCode(-2147022988, UNKNOWN, 'app').intune).toBeUndefined();
  });
});

describe('Gruppe App-Installation (appErrors)', () => {
  it('nur geprüfte Quellseiten', () => {
    expect(APP_ERROR_CODES.length).toBeGreaterThanOrEqual(5);
    for (const e of APP_ERROR_CODES) expect(fromSources(e.docsUrl, APP_SOURCES), e.hex).toBe(true);
  });

  it('0x87D1041C (-2016345060) wird überall gedeutet', () => {
    const d = describeErrorCode(-2016345060, UNKNOWN);
    expect(d.intune?.hex).toBe('0x87D1041C');
    expect(d.intune?.remediation.join(' ')).toContain('Unternehmensportal');
  });

  it('0x80073CF3: Dezimalform wird aus Hex berechnet (Quellseite nennt den Wert von 0x80073CF0)', () => {
    const entry = APP_ERROR_CODES.find((e) => e.hex === '0x80073CF3');
    expect(entry?.decimal).toBe(hexToSignedDecimal('0x80073CF3'));
    expect(entry?.decimal).toBe(-2147009293);
  });

  it('0x8000FFFF nur im App-Kontext', () => {
    expect(describeErrorCode('0x8000FFFF', UNKNOWN, 'app').intune?.hex).toBe('0x8000FFFF');
    expect(describeErrorCode('0x8000FFFF', UNKNOWN).label).toBe(UNKNOWN);
  });

  it('MSI-Exitcode 1638 (auch als HRESULT 0x80070666) mit Learn-Abschnitt', () => {
    const d = describeErrorCode('0x80070666', UNKNOWN, 'app');
    expect(d.installer?.code).toBe(1638);
    expect(d.docsUrl).toMatch(/app-install-error-reference#1638$/);
  });

  it('Installer-Exitcodes werden im Registrierungskontext nicht gedeutet', () => {
    expect(describeErrorCode(1603, UNKNOWN, 'enrollment').installer).toBeUndefined();
  });
});

describe('Unbekannte Codes bleiben ungedeutet', () => {
  it.each(['0x87D30065', '0x80180099', '0x81039099'])('%s → Unbekannter Code', (hex) => {
    const d = describeErrorCode(hex, UNKNOWN, 'enrollment');
    expect(d.intune).toBeUndefined();
    expect(d.label).toBe(UNKNOWN);
    expect(d.explanation.hex).toBe(hex);
    expect(Number.isNaN(d.explanation.decimal)).toBe(false);
  });
});

describe('knowledgeEntry', () => {
  it('normalisiert Hex und berechnet die signierte Dezimalform', () => {
    const e = knowledgeEntry('0x801c03ea', {
      title: 't',
      cause: 'c',
      remediation: ['r'],
      docsUrl: 'https://learn.microsoft.com/x',
    });
    expect(e.hex).toBe('0x801C03EA');
    expect(e.decimal).toBe(-2145647638);
  });

  it('wirft bei ungültigem Hex', () => {
    expect(() =>
      knowledgeEntry('801C03EA', { title: 't', cause: 'c', remediation: [], docsUrl: '' }),
    ).toThrow();
  });

  it('alle Gruppen sind in ALL_ERROR_CODES enthalten', () => {
    for (const e of [...ENROLLMENT_ERROR_CODES, ...AUTOPILOT_ERROR_CODES, ...APP_ERROR_CODES])
      expect(ALL_ERROR_CODES).toContain(e);
  });
});
