import { describe, expect, it } from 'vitest';
import { hexToSignedDecimal, hresultToHex } from '../../domain/format';
import { de } from '../../i18n/de';
import { Docs } from './docs';
import {
  INSTALLER_EXIT_CODES,
  INTUNE_ERROR_CODES,
  describeErrorCode,
  findIntuneErrorCode,
} from './errorCodes';
import { NTSTATUS_URL, WINHTTP_ERRORS_URL, explainCode, systemErrorPageFor } from './win32';
import {
  WINDOWS10_RELEASE_INFO_URL,
  WINDOWS11_RELEASE_INFO_URL,
  WINDOWS_RELEASES,
  findWindowsRelease,
  parseWindowsVersion,
} from './windowsReleases';

const LEARN_URL = /^https:\/\/learn\.microsoft\.com\//;

/** Microsoft Learn: windowsDefenderProductStatus (Flags-Werte, 26 Stück). */
const PRODUCT_STATUS_VALUES = [
  'noStatus',
  'serviceNotRunning',
  'serviceStartedWithoutMalwareProtection',
  'pendingFullScanDueToThreatAction',
  'pendingRebootDueToThreatAction',
  'pendingManualStepsDueToThreatAction',
  'avSignaturesOutOfDate',
  'asSignaturesOutOfDate',
  'noQuickScanHappenedForSpecifiedPeriod',
  'noFullScanHappenedForSpecifiedPeriod',
  'systemInitiatedScanInProgress',
  'systemInitiatedCleanInProgress',
  'samplesPendingSubmission',
  'productRunningInEvaluationMode',
  'productRunningInNonGenuineMode',
  'productExpired',
  'offlineScanRequired',
  'serviceShutdownAsPartOfSystemShutdown',
  'threatRemediationFailedCritically',
  'threatRemediationFailedNonCritically',
  'noStatusFlagsSet',
  'platformOutOfDate',
  'platformUpdateInProgress',
  'platformAboutToBeOutdated',
  'signatureOrPlatformEndOfLifeIsPastOrIsImpending',
  'windowsSModeSignaturesInUseOnNonWin10SInstall',
];

describe('Quellenpflicht: Intune-Fehlercodes', () => {
  it.each(INTUNE_ERROR_CODES.map((e) => [e.hex, e] as const))(
    '%s: Microsoft-Learn-URL, Ursache und Lösung vorhanden',
    (_hex, entry) => {
      expect(entry.docsUrl).toMatch(LEARN_URL);
      expect(entry.title.trim()).not.toBe('');
      expect(entry.cause.trim()).not.toBe('');
      expect(entry.remediation.length).toBeGreaterThanOrEqual(1);
    },
  );

  it.each(INTUNE_ERROR_CODES.map((e) => [e.hex, e] as const))(
    '%s: hex und decimal passen zusammen',
    (_hex, entry) => {
      expect(hresultToHex(entry.decimal)).toBe(entry.hex);
      expect(hexToSignedDecimal(entry.hex)).toBe(entry.decimal);
    },
  );

  it('Hex-Codes sind eindeutig', () => {
    const hexes = INTUNE_ERROR_CODES.map((e) => e.hex);
    expect(new Set(hexes).size).toBe(hexes.length);
  });
});

describe('Quellenpflicht: Installer-Exit-Codes', () => {
  it.each(INSTALLER_EXIT_CODES.map((e) => [e.code, e] as const))(
    'Code %s: Learn-URL, Titel, Ursache und Lösung vorhanden',
    (_code, entry) => {
      expect(entry.docsUrl).toMatch(LEARN_URL);
      expect(entry.title.trim()).not.toBe('');
      expect(entry.cause.trim()).not.toBe('');
      expect(entry.remediation.length).toBeGreaterThanOrEqual(1);
    },
  );

  it('Codes sind eindeutig', () => {
    const codes = INSTALLER_EXIT_CODES.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('Quellenpflicht: feste URLs', () => {
  it.each(Object.entries(Docs))('Docs.%s zeigt auf Microsoft Learn', (_key, url) => {
    expect(url).toMatch(LEARN_URL);
  });

  it.each([
    ['WINDOWS11_RELEASE_INFO_URL', WINDOWS11_RELEASE_INFO_URL],
    ['WINDOWS10_RELEASE_INFO_URL', WINDOWS10_RELEASE_INFO_URL],
    ['WINHTTP_ERRORS_URL', WINHTTP_ERRORS_URL],
    ['NTSTATUS_URL', NTSTATUS_URL],
  ])('%s zeigt auf Microsoft Learn', (_name, url) => {
    expect(url).toMatch(LEARN_URL);
  });
});

describe('Windows-Releases', () => {
  it.each(WINDOWS_RELEASES.map((r) => [r.build, r] as const))(
    'Build %s: Learn-URL und ISO-Datumsangaben',
    (_build, release) => {
      expect(release.docsUrl).toMatch(LEARN_URL);
      expect(release.endOfUpdatesHomePro).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(release.endOfUpdatesEnterprise).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(release.endOfUpdatesEnterprise >= release.endOfUpdatesHomePro).toBe(true);
    },
  );

  it('Builds sind eindeutig', () => {
    const builds = WINDOWS_RELEASES.map((r) => r.build);
    expect(new Set(builds).size).toBe(builds.length);
  });
});

describe('explainCode', () => {
  it.each([
    ['-2147023294 (Dezimal)', -2147023294, 'win32', 1602, 'ERROR_INSTALL_USEREXIT'],
    ['0x80070642 (Hex)', '0x80070642', 'win32', 1602, 'ERROR_INSTALL_USEREXIT'],
    ['0x80070520', '0x80070520', 'win32', 1312, 'ERROR_NO_SUCH_LOGON_SESSION'],
    ['0x80072ee7', '0x80072ee7', 'winhttp', 12007, 'ERROR_WINHTTP_NAME_NOT_RESOLVED'],
    ['0xc000023c (kleingeschrieben)', '0xc000023c', 'ntstatus', null, 'STATUS_NETWORK_UNREACHABLE'],
    ['3010 (Exit-Code)', 3010, 'win32', 3010, 'ERROR_SUCCESS_REBOOT_REQUIRED'],
  ] as const)('%s → %s', (_label, input, kind, baseCode, name) => {
    const explanation = explainCode(input);
    expect(explanation.kind).toBe(kind);
    expect(explanation.baseCode).toBe(baseCode);
    expect(explanation.name).toBe(name);
    expect(explanation.text).not.toBeNull();
    expect(explanation.docsUrl).toMatch(LEARN_URL);
  });

  it('0x80070642 liefert Hex und signierte Dezimalform', () => {
    const explanation = explainCode('0x80070642');
    expect(explanation.hex).toBe('0x80070642');
    expect(explanation.decimal).toBe(-2147023294);
  });

  it('unbekannter HRESULT 0x87D30065 wird nicht gedeutet', () => {
    const explanation = explainCode('0x87D30065');
    expect(explanation.kind).toBe('unknown');
    expect(explanation.name).toBeNull();
    expect(explanation.text).toBeNull();
    expect(explanation.baseCode).toBeNull();
    expect(explanation.hex).toBe('0x87D30065');
  });

  it('Müll ("xyz") ergibt kind unknown und NaN', () => {
    const explanation = explainCode('xyz');
    expect(explanation.kind).toBe('unknown');
    expect(Number.isNaN(explanation.decimal)).toBe(true);
  });

  it('Hex ohne 0x-Präfix wird nicht als Code akzeptiert', () => {
    expect(explainCode('80070642').kind).toBe('unknown');
  });

  it('0 und -1 sind keine Win32-Codes', () => {
    expect(explainCode(0).kind).toBe('unknown');
    expect(explainCode(-1).kind).toBe('unknown');
  });

  it('Win32-Code ohne Namenseintrag (1234) bleibt namenlos, verlinkt aber die Fehlerseite', () => {
    const explanation = explainCode(1234);
    expect(explanation.kind).toBe('win32');
    expect(explanation.name).toBeNull();
    expect(explanation.docsUrl).toMatch(LEARN_URL);
  });
});

describe('systemErrorPageFor (Seitenbereiche von System Error Codes)', () => {
  it.each([
    [0, '--0-499-'],
    [499, '--0-499-'],
    [500, '--500-999-'],
    [999, '--500-999-'],
    [1000, '--1000-1299-'],
    [1299, '--1000-1299-'],
    [1300, '--1300-1699-'],
    [1699, '--1300-1699-'],
    [1700, '--1700-3999-'],
    [3999, '--1700-3999-'],
    [4000, 'system-error-codes'],
  ])('Code %s → Seite mit „%s“', (code, fragment) => {
    const url = systemErrorPageFor(code);
    expect(url).toContain(fragment);
    expect(url).toMatch(LEARN_URL);
  });
});

describe('describeErrorCode / findIntuneErrorCode', () => {
  it('-2016281112 → Intune-Eintrag 0x87D1FDE8 mit Learn-Link', () => {
    const description = describeErrorCode(-2016281112, 'Unbekannter Code');
    expect(description.intune?.hex).toBe('0x87D1FDE8');
    expect(description.label).toBe(description.intune?.title);
    expect(description.docsUrl).toBe(description.intune?.docsUrl);
  });

  it('findIntuneErrorCode akzeptiert Hex und Dezimal gleichermaßen', () => {
    expect(findIntuneErrorCode('0x87D1FDE8')?.decimal).toBe(-2016281112);
    expect(findIntuneErrorCode(-2016281112)?.hex).toBe('0x87D1FDE8');
  });

  it('unbekannter Code → Label „Unbekannter Code“, keine Deutung, kein Link', () => {
    const description = describeErrorCode('0x87D30065', 'Unbekannter Code');
    expect(description.label).toBe('Unbekannter Code');
    expect(description.intune).toBeUndefined();
    expect(description.installer).toBeUndefined();
    expect(description.docsUrl).toBeNull();
    expect(description.explanation.hex).toBe('0x87D30065');
  });

  it('0x80070642 → Installer-Code 1602 mit Titel', () => {
    const description = describeErrorCode('0x80070642', 'Unbekannter Code');
    expect(description.installer?.code).toBe(1602);
    expect(description.label).toBe('Installation durch Benutzer abgebrochen (1602)');
  });

  it('3010 → generische Win32-Deutung mit Namen und Originaltext', () => {
    const description = describeErrorCode(3010, 'Unbekannter Code');
    expect(description.label).toContain('ERROR_SUCCESS_REBOOT_REQUIRED');
    expect(description.docsUrl).toMatch(LEARN_URL);
  });

  it('Müll-Eingabe → Unbekannter Code', () => {
    expect(describeErrorCode('xyz', 'Unbekannter Code').label).toBe('Unbekannter Code');
  });
});

describe('parseWindowsVersion', () => {
  it('"10.0.26100.1" → Build 26100, Revision 1', () => {
    expect(parseWindowsVersion('10.0.26100.1')).toEqual({
      major: 10,
      minor: 0,
      build: 26100,
      revision: 1,
    });
  });

  it('ohne Revision → revision null', () => {
    expect(parseWindowsVersion('10.0.26100')?.revision).toBeNull();
  });

  it('Leerzeichen am Rand werden ignoriert', () => {
    expect(parseWindowsVersion('  10.0.26100.9711 ')?.build).toBe(26100);
  });

  it.each([
    ['zu viele Teile', '10.0.26100.1.2'],
    ['zu wenige Teile', '10.0'],
    ['Text', 'abc'],
    ['Buchstaben im Build', '10.0.2610a.1'],
    ['leer', ''],
    ['nur Leerzeichen', '   '],
    ['null', null],
    ['undefined', undefined],
  ])('%s → null', (_label, value) => {
    expect(parseWindowsVersion(value)).toBeNull();
  });
});

describe('findWindowsRelease', () => {
  it('ordnet Builds den Releases zu', () => {
    expect(findWindowsRelease(26100)?.version).toBe('24H2');
    expect(findWindowsRelease(19045)?.product).toBe('Windows 10');
  });

  it('unbekannter Build → undefined (nicht raten)', () => {
    expect(findWindowsRelease(99999)).toBeUndefined();
  });
});

describe('Defender-productStatus (Texte)', () => {
  const keys = Object.keys(de.rules.defender.productStatus);

  it('enthält genau die 26 offiziellen Werte – keine fehlenden, keine zusätzlichen', () => {
    expect(keys).toHaveLength(26);
    expect([...keys].sort()).toEqual([...PRODUCT_STATUS_VALUES].sort());
  });

  it('jeder Eintrag hat einen nicht leeren deutschen Text', () => {
    for (const key of keys) {
      expect(de.rules.defender.productStatus[key], key).not.toBe('');
    }
  });
});
