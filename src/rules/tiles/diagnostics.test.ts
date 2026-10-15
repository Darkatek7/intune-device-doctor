import { beforeAll, describe, expect, it } from 'vitest';
import { analyzeDiagnosticsZip } from '../../diagnostics/analyze';
import { buildFixtureZip, FIXTURE_FILE_NAME } from '../../diagnostics/fixture';
import type {
  DiagnosticsReport,
  DsregStatus,
  EnrollmentInfo,
  Win32AppState,
} from '../../diagnostics/types';
import type { Finding, Tile, TileId } from '../../domain/types';
import { Docs } from '../knowledge/docs';
import { evaluateDiagnosticsTiles } from './diagnostics';

const NOW = new Date('2026-10-15T12:00:00Z');
const LEARN_URL = /^https:\/\/learn\.microsoft\.com\//;
const PRT_PAGE =
  'https://learn.microsoft.com/entra/identity/devices/troubleshoot-primary-refresh-token';
const MSI_ERRORS_URL =
  'https://learn.microsoft.com/intune/configmgr/tenant-attach/app-install-error-reference#msi-errors';
const ZIP_PREFIX = 'DiagLogs-ZIP · ';

let fixture: DiagnosticsReport;
let fixtureTiles: Tile[];

beforeAll(async () => {
  // Kopie als Uint8Array<ArrayBuffer>, damit das Typsystem das Blob-Argument akzeptiert.
  const zip = new Uint8Array(buildFixtureZip());
  fixture = await analyzeDiagnosticsZip(new File([zip], FIXTURE_FILE_NAME), {});
  fixtureTiles = evaluateDiagnosticsTiles(fixture, NOW);
});

// ---------- Hilfen ----------

function tileOf(tiles: Tile[], id: TileId): Tile {
  const tile = tiles.find((t) => t.id === id);
  if (!tile) throw new Error(`Kachel ${id} fehlt`);
  return tile;
}

function findingOf(tile: Tile, id: string): Finding {
  const finding = tile.findings.find((f) => f.id === id);
  if (!finding) throw new Error(`Befund ${id} fehlt in Kachel ${tile.id}`);
  return finding;
}

/** Fixture-Report per Spread, nur die übergebenen Felder werden ersetzt. */
function reportWith(patch: Partial<DiagnosticsReport>): DiagnosticsReport {
  return { ...fixture, ...patch };
}

function evaluate(patch: Partial<DiagnosticsReport>): Tile[] {
  return evaluateDiagnosticsTiles(reportWith(patch), NOW);
}

/** Vollständiges, gesundes dsregcmd-Objekt ohne Abschnitte. Tests überschreiben gezielt. */
function dsreg(overrides: Partial<DsregStatus> = {}): DsregStatus {
  return {
    sections: [],
    azureAdJoined: 'YES',
    domainJoined: 'NO',
    deviceAuthStatus: 'SUCCESS',
    tpmProtected: 'YES',
    azureAdPrt: 'YES',
    wamDefaultSet: 'YES',
    ...overrides,
  };
}

function win32App(overrides: Partial<Win32AppState> = {}): Win32AppState {
  return {
    appId: '00000000-0000-0000-0000-0000000000B1',
    status: 'Installed',
    errorCodeHex: null,
    errorCodeDecimal: null,
    ...overrides,
  };
}

function enrollment(overrides: Partial<EnrollmentInfo> = {}): EnrollmentInfo {
  return {
    enrollmentId: '00000000-0000-0000-0000-0000000000C1',
    providerId: 'MS DM Server',
    enrollmentState: 1,
    enrollmentType: 6,
    upnMasked: null,
    ...overrides,
  };
}

// ---------- Fixture-ZIP ----------

describe('Fixture-ZIP: Kacheln', () => {
  it('liefert genau die vier ZIP-Kacheln in fester Reihenfolge', () => {
    expect(fixtureTiles.map((t) => t.id)).toEqual([
      'entraJoin',
      'win32Apps',
      'enrollment',
      'diagCollection',
    ]);
  });

  it('jede Kachel und jeder Befund: Titel, Ursache, Lösung, ZIP-Quelle und Learn-Link', () => {
    for (const tile of fixtureTiles) {
      expect(tile.title.trim(), tile.id).not.toBe('');
      for (const finding of tile.findings) {
        const where = `${tile.id} / ${finding.id}`;
        expect(finding.title.trim(), where).not.toBe('');
        expect(finding.detail.trim(), where).not.toBe('');
        expect(finding.cause.trim(), where).not.toBe('');
        expect(finding.remediation.length, where).toBeGreaterThanOrEqual(1);
        expect(finding.source.kind, where).toBe('zip');
        expect(finding.source.label.startsWith(ZIP_PREFIX), where).toBe(true);
        if (finding.docsUrl !== undefined) {
          expect(finding.docsUrl, where).toMatch(LEARN_URL);
        }
      }
      for (const source of tile.sources) {
        expect(source.kind, tile.id).toBe('zip');
      }
    }
  });

  it('Privatsphäre: weder ChannelURI-Wert noch Klartext-UPN in den Kacheln', () => {
    const serialized = JSON.stringify(fixtureTiles);
    expect(serialized).not.toContain('DEMO-CHANNEL-URI');
    expect(serialized).not.toContain('user@contoso.com');
  });
});

describe('Fixture-ZIP: Entra-Join & PRT', () => {
  it('kritisch „Kein PRT“ mit Status-, Netzwerk- und WinHTTP-Deutung', () => {
    const tile = tileOf(fixtureTiles, 'entraJoin');
    expect(tile.severity).toBe('critical');
    expect(tile.value).toBe('Kein PRT');
    expect(tile.findings.map((f) => f.id)).toEqual(['entraJoin-prt', 'entraJoin-wam']);

    const prt = findingOf(tile, 'entraJoin-prt');
    expect(prt.severity).toBe('critical');
    expect(prt.detail).toContain('0xc000023c');
    expect(prt.detail).toContain('STATUS_NETWORK_UNREACHABLE');
    expect(prt.detail).toContain('ERROR_WINHTTP_NAME_NOT_RESOLVED');
    expect(prt.docsUrl?.startsWith(PRT_PAGE)).toBe(true);
    expect(prt.docsUrl).toContain('#status-codes');
    expect(prt.source.label).toBe(
      `${ZIP_PREFIX}(3) Command windir_system32_Dsregcmd_exe_status output.log`,
    );
  });

  it('WamDefaultSet-Fehler als Warnung mit Win32-Code 1312', () => {
    const wam = findingOf(tileOf(fixtureTiles, 'entraJoin'), 'entraJoin-wam');
    expect(wam.severity).toBe('warning');
    expect(wam.detail).toContain('1312');
    expect(wam.detail).toContain('ERROR_NO_SUCH_LOGON_SESSION');
  });

  it('Zusammenfassung nennt Join-Typ und PRT-Zustand, ohne UPN-Klartext', () => {
    const tile = tileOf(fixtureTiles, 'entraJoin');
    expect(tile.summary).toContain('Microsoft Entra joined');
    expect(tile.summary).toContain('Kein PRT');
  });
});

describe('Fixture-ZIP: Win32-Apps', () => {
  it('Warnung „1 von 3 fehlgeschlagen“', () => {
    const tile = tileOf(fixtureTiles, 'win32Apps');
    expect(tile.severity).toBe('warning');
    expect(tile.value).toBe('1 von 3 fehlgeschlagen');
  });

  it('fehlgeschlagene App mit 0x80070642 und Installer-Deutung, Learn-Link der MSI-Fehlerseite', () => {
    const failed = fixtureTiles
      .find((t) => t.id === 'win32Apps')
      ?.findings.find((f) => f.id.startsWith('win32-failed-'));
    expect(failed).toBeDefined();
    expect(failed?.severity).toBe('warning');
    expect(failed?.detail).toContain('0x80070642');
    expect(failed?.detail).toContain('ERROR_INSTALL_USEREXIT');
    expect(failed?.docsUrl).toBe(MSI_ERRORS_URL);
    expect(failed?.source.label).toBe(
      `${ZIP_PREFIX}(2) RegistryKey HKLM_Software_Microsoft_IntuneManagementExtension export.reg`,
    );
  });

  it('IME-Log-Hinweis (unknown) mit Zählung 3 Fehler und 1 Warnung', () => {
    const ime = findingOf(tileOf(fixtureTiles, 'win32Apps'), 'win32-imeLog');
    expect(ime.severity).toBe('unknown');
    expect(ime.title).toContain('3 Fehler');
    expect(ime.title).toContain('1 Warn');
    expect(ime.source.label.startsWith(ZIP_PREFIX)).toBe(true);
  });
});

describe('Fixture-ZIP: Enrollment', () => {
  it('Wert „Co-Management“, Hinweis unknown, Befund ohne Warnstufe → Kachel ok', () => {
    const tile = tileOf(fixtureTiles, 'enrollment');
    expect(tile.value).toBe('Co-Management');
    expect(tile.severity).toBe('ok');
    expect(findingOf(tile, 'enrollment-comanaged').severity).toBe('unknown');
  });

  it('Fakten nennen beide ProviderIDs', () => {
    const facts = JSON.stringify(tileOf(fixtureTiles, 'enrollment').facts);
    expect(facts).toContain('MS DM Server');
    expect(facts).toContain('WMI_Bridge_SCCM_Server');
  });

  it('UPN nur maskiert: „us…@contoso.com“ statt „user@contoso.com“', () => {
    const tile = tileOf(fixtureTiles, 'enrollment');
    expect(tile.facts.map((f) => f.value)).toContain('us…@contoso.com');
    expect(JSON.stringify(tile)).not.toContain('user@contoso.com');
  });
});

describe('Fixture-ZIP: Diagnose-Sammlung', () => {
  it('Wert „2 erwartbar fehlend“, Kachel ok, keine echten Fehlschläge', () => {
    const tile = tileOf(fixtureTiles, 'diagCollection');
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe('2 erwartbar fehlend');
  });

  it('zwei unknown-Befunde für SetupDiag und EPMAgent', () => {
    const tile = tileOf(fixtureTiles, 'diagCollection');
    const collected = tile.findings.filter(
      (f) => f.id.startsWith('collection-') && f.id !== 'collection-notes',
    );
    expect(collected).toHaveLength(2);
    expect(collected.some((f) => f.title.includes('SetupDiag'))).toBe(true);
    expect(collected.some((f) => f.title.includes('EPMAgent'))).toBe(true);
    for (const finding of collected) {
      expect(finding.severity).toBe('unknown');
    }
  });

  it('Analyse-Hinweis nennt die übersprungene Binärdatei (.evtx)', () => {
    const notes = findingOf(tileOf(fixtureTiles, 'diagCollection'), 'collection-notes');
    expect(notes.severity).toBe('unknown');
    expect(notes.detail).toContain('.evtx');
  });
});

// ---------- Synthetische Reports ----------

describe('Synthetisch: Entra-Join & PRT', () => {
  it('dsregcmd fehlt → unknown mit Befund „dsregcmd-Ausgabe fehlt“', () => {
    const tile = tileOf(evaluate({ dsregcmd: null }), 'entraJoin');
    expect(tile.severity).toBe('unknown');
    expect(tile.findings.map((f) => f.id)).toEqual(['entraJoin-missing']);
    expect(tile.findings[0]?.title).toBe('dsregcmd-Ausgabe fehlt');
    expect(tile.findings[0]?.docsUrl).toBe(Docs.dsregcmdDeviceState);
  });

  it('PRT vorhanden, WamDefaultSet YES, Entra-joined → ok ohne Befunde', () => {
    const tile = tileOf(evaluate({ dsregcmd: dsreg() }), 'entraJoin');
    expect(tile.severity).toBe('ok');
    expect(tile.findings).toEqual([]);
    expect(tile.value).toBe('Microsoft Entra joined');
  });

  it('AzureAdPrt NO ohne Attempt Status → Warnung statt kritisch', () => {
    const tile = tileOf(evaluate({ dsregcmd: dsreg({ azureAdPrt: 'NO' }) }), 'entraJoin');
    const prt = findingOf(tile, 'entraJoin-prt');
    expect(prt.severity).toBe('warning');
    expect(tile.severity).toBe('warning');
    expect(tile.value).toBe('Kein PRT');
    expect(prt.detail).toContain('AzureAdPrt : NO');
    expect(prt.docsUrl).toBe(Docs.prtTroubleshoot);
  });

  it('DeviceAuthStatus mit „FAILED. Device is either disabled or deleted“ → kritisch', () => {
    const tile = tileOf(
      evaluate({
        dsregcmd: dsreg({ deviceAuthStatus: 'FAILED. Device is either disabled or deleted' }),
      }),
      'entraJoin',
    );
    const auth = findingOf(tile, 'entraJoin-deviceAuth');
    expect(auth.severity).toBe('critical');
    expect(auth.detail).toContain('FAILED. Device is either disabled or deleted');
    expect(tile.severity).toBe('critical');
  });

  it('weder Entra- noch Domain-Join → Befund entraJoin-notJoined und Wert „Nicht verbunden“', () => {
    const tile = tileOf(
      evaluate({ dsregcmd: dsreg({ azureAdJoined: 'NO', domainJoined: 'NO' }) }),
      'entraJoin',
    );
    expect(tile.value).toBe('Nicht verbunden');
    expect(findingOf(tile, 'entraJoin-notJoined').severity).toBe('warning');
  });

  it.each([
    ['hybrid', 'YES', 'YES', 'Microsoft Entra hybrid joined'],
    ['nur Entra', 'YES', 'NO', 'Microsoft Entra joined'],
    ['nur Domäne', 'NO', 'YES', 'Domain Joined'],
    ['Kleinschreibung der Werte', 'yes', 'no', 'Microsoft Entra joined'],
  ])('Join-Typ %s (AzureAdJoined %s, DomainJoined %s)', (_label, aad, domain, expected) => {
    const tile = tileOf(
      evaluate({ dsregcmd: dsreg({ azureAdJoined: aad, domainJoined: domain }) }),
      'entraJoin',
    );
    expect(tile.value).toBe(expected);
  });

  it('Hybrid-Join erscheint in Wert und Zusammenfassung', () => {
    const tile = tileOf(
      evaluate({ dsregcmd: dsreg({ azureAdJoined: 'YES', domainJoined: 'YES' }) }),
      'entraJoin',
    );
    expect(tile.value).toContain('hybrid');
    expect(tile.summary).toContain('hybrid');
  });

  it('unbekannter Attempt Status 0x12345678 → „Unbekannter Code“ mit Hex-Wert', () => {
    const tile = tileOf(
      evaluate({ dsregcmd: dsreg({ azureAdPrt: 'NO', prtAttemptStatus: '0x12345678' }) }),
      'entraJoin',
    );
    const prt = findingOf(tile, 'entraJoin-prt');
    expect(prt.severity).toBe('critical');
    expect(prt.detail).toContain('Unbekannter Code');
    expect(prt.detail).toContain('0x12345678');
    expect(prt.docsUrl).toBe(Docs.prtTroubleshoot);
  });

  it('bekannter PRT-Code 0xC00000D0 → Ursache und Lösung aus der PRT-Tabelle', () => {
    const tile = tileOf(
      evaluate({ dsregcmd: dsreg({ azureAdPrt: 'NO', prtAttemptStatus: '0xC00000D0' }) }),
      'entraJoin',
    );
    const prt = findingOf(tile, 'entraJoin-prt');
    expect(prt.cause).toContain('PRT-Anfrage abgelehnt');
    expect(prt.remediation.some((step) => step.includes('AADSTS'))).toBe(true);
    expect(prt.docsUrl?.startsWith(PRT_PAGE)).toBe(true);
    expect(prt.docsUrl).toContain('#status-codes');
  });

  it('HTTP-Status 0x00000000 wird nicht als WinHTTP-Fehler gedeutet', () => {
    const tile = tileOf(
      evaluate({
        dsregcmd: dsreg({
          azureAdPrt: 'NO',
          prtAttemptStatus: '0xC000023C',
          prtHttpError: '0x00000000',
        }),
      }),
      'entraJoin',
    );
    const prt = findingOf(tile, 'entraJoin-prt');
    expect(prt.detail).toContain('STATUS_NETWORK_UNREACHABLE');
    expect(prt.detail).not.toContain('entspricht WinHTTP');
  });

  it('WamDefaultSet „ERROR“ ohne Codeangabe → Befund ohne Code', () => {
    const tile = tileOf(evaluate({ dsregcmd: dsreg({ wamDefaultSet: 'ERROR' }) }), 'entraJoin');
    expect(findingOf(tile, 'entraJoin-wam').detail).toBe('WamDefaultSet : ERROR.');
  });

  // Ehemals bekannte Fehler (behoben): bekannte Codes werden gedeutet, fehlende Join-Felder ≠ „nicht verbunden“.
  it('bekannter WinHTTP-Code 0x80072EE7 als Attempt Status wird gedeutet', () => {
    const tile = tileOf(
      evaluate({ dsregcmd: dsreg({ azureAdPrt: 'NO', prtAttemptStatus: '0x80072EE7' }) }),
      'entraJoin',
    );
    expect(findingOf(tile, 'entraJoin-prt').detail).not.toContain('Unbekannter Code');
  });

  it('bekannter Win32-Code 0x80070005 als Attempt Status wird gedeutet', () => {
    const tile = tileOf(
      evaluate({ dsregcmd: dsreg({ azureAdPrt: 'NO', prtAttemptStatus: '0x80070005' }) }),
      'entraJoin',
    );
    expect(findingOf(tile, 'entraJoin-prt').detail).not.toContain('Unbekannter Code');
  });

  it('fehlende Join-Felder werden nicht als „nicht verbunden“ gewertet', () => {
    const tile = tileOf(
      evaluate({
        dsregcmd: dsreg({ azureAdJoined: undefined, domainJoined: undefined }),
      }),
      'entraJoin',
    );
    expect(tile.findings.map((f) => f.id)).not.toContain('entraJoin-notJoined');
  });
});

describe('Synthetisch: Win32-Apps', () => {
  it('keine Win32-App-Zustände → unknown „Keine Daten“ ohne Befunde', () => {
    const tile = tileOf(evaluate({ win32Apps: [], imeIssues: [] }), 'win32Apps');
    expect(tile.severity).toBe('unknown');
    expect(tile.value).toBe('Keine Daten');
    expect(tile.findings).toEqual([]);
  });

  it('Failed mit 0x87D30065 (signiert -2016214939) → „Unbekannter Code“ mit Hex und Dezimalwert', () => {
    const tile = tileOf(
      evaluate({
        win32Apps: [
          win32App({
            status: 'Failed',
            errorCodeHex: '0x87D30065',
            errorCodeDecimal: -2016214939,
          }),
        ],
        imeIssues: [],
      }),
      'win32Apps',
    );
    const failed = tile.findings.find((f) => f.id.startsWith('win32-failed-'));
    expect(failed?.severity).toBe('warning');
    expect(failed?.detail).toContain('Unbekannter Code 0x87D30065 (-2016214939)');
    expect(failed?.docsUrl).toBe(Docs.win32AppTroubleshoot);
    expect(tile.value).toBe('1 von 1 fehlgeschlagen');
    expect(tile.severity).toBe('warning');
  });

  it('Failed ohne Fehlercode → Hinweis „ohne Fehlercode“', () => {
    const tile = tileOf(
      evaluate({ win32Apps: [win32App({ status: 'Failed' })], imeIssues: [] }),
      'win32Apps',
    );
    const failed = tile.findings.find((f) => f.id.startsWith('win32-failed-'));
    expect(failed?.detail).toContain('ohne Fehlercode');
  });

  it('Failed mit Installer-Code 1603 → Deutung und MSI-Lösungsschritt', () => {
    const tile = tileOf(
      evaluate({
        win32Apps: [
          win32App({ status: 'Failed', errorCodeDecimal: 1603, errorCodeHex: '0x00000643' }),
        ],
        imeIssues: [],
      }),
      'win32Apps',
    );
    const failed = tile.findings.find((f) => f.id.startsWith('win32-failed-'));
    expect(failed?.detail).toContain('ERROR_INSTALL_FAILURE');
    expect(failed?.remediation[0]).toContain('MSI-Log');
    expect(failed?.docsUrl).toBe(MSI_ERRORS_URL);
  });

  it('Status „FAILED“ in Großbuchstaben zählt als fehlgeschlagen', () => {
    const tile = tileOf(
      evaluate({ win32Apps: [win32App({ status: 'FAILED' })], imeIssues: [] }),
      'win32Apps',
    );
    expect(tile.value).toBe('1 von 1 fehlgeschlagen');
  });

  it('InstalledPendingReboot → Warnung „Neustart ausstehend“', () => {
    const tile = tileOf(
      evaluate({
        win32Apps: [
          win32App({
            appId: '00000000-0000-0000-0000-0000000000B2',
            status: 'InstalledPendingReboot',
          }),
        ],
        imeIssues: [],
      }),
      'win32Apps',
    );
    const reboot = findingOf(tile, 'win32-reboot-00000000-0000-0000-0000-0000000000B2');
    expect(reboot.severity).toBe('warning');
    expect(reboot.title).toContain('Neustart ausstehend');
    expect(tile.severity).toBe('warning');
  });

  it('nur NotApplicable und Installed → ok ohne Befunde', () => {
    const tile = tileOf(
      evaluate({
        win32Apps: [
          win32App({ status: 'NotApplicable' }),
          win32App({ appId: '00000000-0000-0000-0000-0000000000B3', status: 'Installed' }),
        ],
        imeIssues: [],
      }),
      'win32Apps',
    );
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe('2 Apps ohne Fehler');
    expect(tile.findings).toEqual([]);
  });
});

describe('Synthetisch: Enrollment', () => {
  it('ohne MS DM Server → kritisch „enrollment-missing“', () => {
    const tile = tileOf(
      evaluate({
        enrollments: [enrollment({ providerId: 'WMI_Bridge_SCCM_Server' })],
      }),
      'enrollment',
    );
    expect(tile.severity).toBe('critical');
    expect(tile.value).toBe('Keine MDM-Registrierung');
    expect(findingOf(tile, 'enrollment-missing').severity).toBe('critical');
    expect(findingOf(tile, 'enrollment-missing').docsUrl).toBe(Docs.windowsEnrollmentErrors);
  });

  it('nur MS DM Server → ok mit Wert „Intune-MDM registriert“', () => {
    const tile = tileOf(evaluate({ enrollments: [enrollment()] }), 'enrollment');
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe('Intune-MDM registriert');
    expect(tile.findings).toEqual([]);
  });

  it('keine Registrierungen → unknown „Keine Daten“', () => {
    const tile = tileOf(evaluate({ enrollments: [] }), 'enrollment');
    expect(tile.severity).toBe('unknown');
    expect(tile.value).toBe('Keine Daten');
    expect(tile.findings).toEqual([]);
  });
});

describe('Synthetisch: Diagnose-Sammlung', () => {
  it('echter Fehlschlag ohne harmlose Komponente → Warnung, nicht harmlos', () => {
    const tile = tileOf(
      evaluate({
        collectionFailures: [
          {
            kind: 'RegistryKey',
            target: 'HKLM_SOFTWARE_Contoso_Agent',
            hresult: '0x80070001',
            meaning: 'Schlüssel fehlt',
          },
        ],
        analysisNotes: [],
      }),
      'diagCollection',
    );
    expect(tile.severity).toBe('warning');
    expect(tile.value).toBe('1 Sammlung fehlgeschlagen');
    const finding = findingOf(tile, 'collection-RegistryKey-HKLM_SOFTWARE_Contoso_Agent');
    expect(finding.severity).toBe('warning');
    expect(finding.title).toBe('Registry-Schlüssel nicht gesammelt: HKLM_SOFTWARE_Contoso_Agent');
    expect(finding.detail).toContain('0x80070001');
    expect(finding.detail).toContain('Schlüssel fehlt');
    expect(finding.remediation.length).toBeGreaterThanOrEqual(1);
  });

  it('Befund ohne passenden ZIP-Eintrag → Quelle results.xml', () => {
    const tile = tileOf(
      evaluate({
        collectionFailures: [
          { kind: 'Command', target: '%windir%\\system32\\Foo.exe', hresult: '0x8000FFFF' },
        ],
        analysisNotes: [],
      }),
      'diagCollection',
    );
    expect(tile.findings[0]?.source.label).toBe(`${ZIP_PREFIX}results.xml`);
  });

  it('harmlose Komponenten (SetupDiag, ccmsetup, CloudManagedUpdate) → Kachel ok, Wert „erwartbar fehlend“', () => {
    const tile = tileOf(
      evaluate({
        collectionFailures: [
          {
            kind: 'RegistryKey',
            target: 'HKLM_SYSTEM_Setup_SetupDiag_Results',
            hresult: '0x80070001',
          },
          {
            kind: 'FoldersFiles',
            target: 'ProgramData_Microsoft_ccmsetup_Logs',
            hresult: '0x80070003',
          },
          {
            kind: 'FoldersFiles',
            target: 'ProgramData_Microsoft_CloudManagedUpdate_Logs',
            hresult: '0x80070003',
          },
        ],
        analysisNotes: [],
      }),
      'diagCollection',
    );
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe('3 erwartbar fehlend');
    for (const finding of tile.findings) {
      expect(finding.severity).toBe('unknown');
    }
  });

  it('echte Fehlschläge gewinnen über die harmlose Anzahl im Wert', () => {
    const tile = tileOf(
      evaluate({
        collectionFailures: [
          {
            kind: 'RegistryKey',
            target: 'HKLM_SYSTEM_Setup_SetupDiag_Results',
            hresult: '0x80070001',
          },
          { kind: 'RegistryKey', target: 'HKLM_SOFTWARE_Contoso_Agent', hresult: '0x80070001' },
        ],
        analysisNotes: [],
      }),
      'diagCollection',
    );
    expect(tile.value).toBe('1 Sammlung fehlgeschlagen');
    expect(tile.severity).toBe('warning');
  });

  it('zwei echte Fehlschläge → Plural „2 Sammlungen fehlgeschlagen“', () => {
    const tile = tileOf(
      evaluate({
        collectionFailures: [
          { kind: 'RegistryKey', target: 'HKLM_SOFTWARE_Contoso_Agent', hresult: '0x80070001' },
          { kind: 'FoldersFiles', target: 'ProgramData_Contoso_Logs', hresult: '0x80070003' },
        ],
        analysisNotes: [],
      }),
      'diagCollection',
    );
    expect(tile.value).toBe('2 Sammlungen fehlgeschlagen');
  });

  it('ohne Fehlschläge und ohne Hinweise → ok „Vollständig“ ohne Befunde', () => {
    const tile = tileOf(evaluate({ collectionFailures: [], analysisNotes: [] }), 'diagCollection');
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe('Vollständig');
    expect(tile.findings).toEqual([]);
  });

  it('Analyse-Hinweise erzeugen einen unknown-Befund mit dem Hinweistext', () => {
    const tile = tileOf(
      evaluate({ collectionFailures: [], analysisNotes: ['Test-Hinweis A.', 'Test-Hinweis B.'] }),
      'diagCollection',
    );
    const notes = findingOf(tile, 'collection-notes');
    expect(notes.severity).toBe('unknown');
    expect(notes.detail).toBe('Test-Hinweis A. Test-Hinweis B.');
    expect(tile.severity).toBe('ok');
  });
});

describe('Win32-Apps – App-Namen und Intune-Link', () => {
  const failedFinding = (report: DiagnosticsReport): Finding =>
    evaluateDiagnosticsTiles(report, NOW)
      .find((t) => t.id === 'win32Apps')!
      .findings.find((f) => f.id.startsWith('win32-failed-'))!;

  it('zeigt ohne aufgelöste Namen die App-ID und verlinkt trotzdem auf die App', () => {
    const finding = failedFinding(fixture);
    expect(finding.title).toContain('00000000-0000-0000-0000-0000000000A2');
    expect(finding.links?.[0]?.url).toBe(
      'https://intune.microsoft.com/#view/Microsoft_Intune_Apps/SettingsMenu/~/0/appId/00000000-0000-0000-0000-0000000000A2',
    );
  });

  it('nutzt den aufgelösten Namen im Titel und in den Rohdaten', () => {
    const finding = failedFinding({
      ...fixture,
      resolvedApps: {
        '00000000-0000-0000-0000-0000000000a2': {
          id: '00000000-0000-0000-0000-0000000000A2',
          displayName: 'Contoso VPN Client 5.1',
          publisher: 'Contoso Ltd.',
        },
      },
    });
    expect(finding.title).toBe('Installation fehlgeschlagen: Contoso VPN Client 5.1');
    expect(Object.values(finding.evidence ?? {})).toContain('Contoso Ltd.');
  });
});
