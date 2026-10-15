import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  FIXTURE_FILE_NAME,
  buildFixtureEntries,
  buildFixtureZip,
  utf16leWithBom,
  utf8WithBom,
} from './fixture';

const EXPECTED_NAMES = [
  'results.xml',
  '(1) RegistryKey HKLM_Software_Microsoft_Enrollments export.reg',
  '(2) RegistryKey HKLM_Software_Microsoft_IntuneManagementExtension export.reg',
  '(3) Command windir_system32_Dsregcmd_exe_status output.log',
  '(4) FoldersFiles ProgramData_Microsoft_IntuneManagementExtension_Logs/',
  '(4) FoldersFiles ProgramData_Microsoft_IntuneManagementExtension_Logs/IntuneManagementExtension.log',
  '(5) No Results - Error [0x80070001] RegistryKey HKLM_SYSTEM_Setup_SetupDiag_Results',
  '(6) No Results - Error [0x80070003] FoldersFiles ProgramData_Microsoft_EPMAgent_Logs',
  '(7) Events System Events.evtx',
].sort();

const REG_ENROLLMENTS = '(1) RegistryKey HKLM_Software_Microsoft_Enrollments export.reg';
const REG_IME = '(2) RegistryKey HKLM_Software_Microsoft_IntuneManagementExtension export.reg';
const DSREG = '(3) Command windir_system32_Dsregcmd_exe_status output.log';
const IME_LOG =
  '(4) FoldersFiles ProgramData_Microsoft_IntuneManagementExtension_Logs/IntuneManagementExtension.log';
const NO_RESULTS_SETUPDIAG =
  '(5) No Results - Error [0x80070001] RegistryKey HKLM_SYSTEM_Setup_SetupDiag_Results';
const NO_RESULTS_EPM =
  '(6) No Results - Error [0x80070003] FoldersFiles ProgramData_Microsoft_EPMAgent_Logs';
const EVTX = '(7) Events System Events.evtx';

const CMTRACE_RE =
  /<!\[LOG\[([\s\S]*?)\]LOG\]!><time="([^"]+)" date="([^"]+)" component="([^"]*)" context="([^"]*)" type="(\d)" thread="(\d+)" file="([^"]*)">/g;

function unzipFixture(): Record<string, Uint8Array> {
  return unzipSync(buildFixtureZip());
}

describe('fixture ZIP', () => {
  it('verwendet den konventionellen Dateinamen', () => {
    expect(FIXTURE_FILE_NAME).toBe('DiagLogs-CONTOSO-PC042-20261014T125356Z.zip');
  });

  it('enthält exakt die erwarteten Einträge', () => {
    const names = Object.keys(unzipFixture()).sort();
    expect(names).toEqual(EXPECTED_NAMES);
    expect(Object.keys(buildFixtureEntries()).sort()).toEqual(EXPECTED_NAMES);
  });

  it('Verzeichniseintrag endet auf / und ist leer', () => {
    const dir = '(4) FoldersFiles ProgramData_Microsoft_IntuneManagementExtension_Logs/';
    expect(unzipFixture()[dir]?.length).toBe(0);
  });

  it('.reg-Dateien sind UTF-16LE mit BOM (FF FE) und lesbar', () => {
    const files = unzipFixture();
    for (const name of [REG_ENROLLMENTS, REG_IME]) {
      const bytes = files[name];
      expect(bytes).toBeDefined();
      expect(Array.from(bytes!.slice(0, 2))).toEqual([0xff, 0xfe]);
      const text = new TextDecoder('utf-16le').decode(bytes);
      expect(text.startsWith('Windows Registry Editor Version 5.00\r\n')).toBe(true);
      expect(text).toContain('\r\n\r\n[HKEY_LOCAL_MACHINE');
    }
  });

  it('IME-Log ist UTF-8 mit BOM (EF BB BF) und enthält 6 CMTrace-Einträge', () => {
    const bytes = unzipFixture()[IME_LOG];
    expect(bytes).toBeDefined();
    expect(Array.from(bytes!.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);

    const text = new TextDecoder('utf-8').decode(bytes);
    const matches = [...text.matchAll(CMTRACE_RE)];
    expect(matches).toHaveLength(6);
    expect(matches.map((m) => m[6]).sort()).toEqual(['1', '1', '2', '3', '3', '3']);
    expect(text).toContain('\r\n   at Contoso.Demo.Stack()');
  });

  it('dsregcmd-Ausgabe ist UTF-8 ohne BOM', () => {
    const bytes = unzipFixture()[DSREG];
    expect(bytes).toBeDefined();
    expect(Array.from(bytes!.slice(0, 3))).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes![0]).toBe('+'.charCodeAt(0));

    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
    expect(text).toMatch(/^\s+AzureAdPrt : NO\s*$/m);
    expect(text).toMatch(/^\s+WamDefaultSet : ERROR \(0x80070520\)\s*$/m);
    expect(text).toMatch(/^\s+Attempt Status : 0xc000023c\s*$/m);
  });

  it('die beiden No-Results-Einträge sind 0 Byte', () => {
    const files = unzipFixture();
    expect(files[NO_RESULTS_SETUPDIAG]?.length).toBe(0);
    expect(files[NO_RESULTS_EPM]?.length).toBe(0);
  });

  it('results.xml ist ASCII ohne BOM', () => {
    const bytes = unzipFixture()['results.xml'];
    expect(bytes).toBeDefined();
    expect(bytes!.every((b) => b < 0x80)).toBe(true);
    expect(Array.from(bytes!.slice(0, 5))).toEqual([0x3c, 0x3f, 0x78, 0x6d, 0x6c]);
  });

  it('Events-Dummy beginnt mit ElfFile\\0 und ist 128 Byte groß', () => {
    const bytes = unzipFixture()[EVTX];
    expect(bytes?.length).toBe(128);
    expect(Array.from(bytes!.slice(0, 8))).toEqual([
      ...Array.from('ElfFile', (c) => c.charCodeAt(0)),
      0,
    ]);
  });

  it('der Failed-App-Code 0x80070642 entspricht dem signierten Wert in der .reg-Datei', () => {
    const text = new TextDecoder('utf-16le').decode(unzipFixture()[REG_IME]);
    expect(text).toContain('"ErrorCode"="-2147023294"');
    expect((-2147023294 >>> 0).toString(16)).toBe('80070642');
  });

  it('ist deterministisch: zwei Aufrufe liefern identische Bytes', () => {
    expect(buildFixtureZip()).toEqual(buildFixtureZip());
  });
});

describe('Encoder-Helfer', () => {
  it('utf16leWithBom schreibt FF FE und Little-Endian-Code-Units', () => {
    expect(Array.from(utf16leWithBom('Aä'))).toEqual([0xff, 0xfe, 0x41, 0x00, 0xe4, 0x00]);
  });

  it('utf8WithBom stellt EF BB BF voran', () => {
    expect(Array.from(utf8WithBom('A'))).toEqual([0xef, 0xbb, 0xbf, 0x41]);
  });
});
