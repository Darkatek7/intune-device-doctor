import { describe, expect, it } from 'vitest';
import { parseEntryName, splitFoldersFilesName } from './entryName';

describe('parseEntryName', () => {
  it('erkennt RegistryKey-Exporte', () => {
    const e = parseEntryName(
      '(9) RegistryKey HKLM_Software_Microsoft_IntuneManagementExtension export.reg',
      10,
      false,
    );
    expect(e).toMatchObject({
      index: 9,
      kind: 'RegistryKey',
      name: 'HKLM_Software_Microsoft_IntuneManagementExtension',
      failedHresult: null,
    });
  });

  it('erkennt Command, Events und FoldersFiles', () => {
    expect(
      parseEntryName('(31) Command windir_system32_Dsregcmd_exe_status output.log', 1, false),
    ).toMatchObject({ kind: 'Command', name: 'windir_system32_Dsregcmd_exe_status' });
    expect(parseEntryName('(62) Events System Events.evtx', 1, false)).toMatchObject({
      kind: 'Events',
      name: 'System',
    });
    expect(parseEntryName('(64) FoldersFiles A_B/x.log', 1, false)).toMatchObject({
      kind: 'FoldersFiles',
      name: 'A_B/x.log',
    });
  });

  it('normalisiert den Fehlercode bei No-Results-Einträgen', () => {
    const e = parseEntryName(
      '(25) No Results - Error [0x8007000a] RegistryKey HKLM_SYSTEM_Setup_SetupDiag_Results',
      0,
      false,
    );
    expect(e).toMatchObject({
      kind: 'RegistryKey',
      failedHresult: '0x8007000A',
      name: 'HKLM_SYSTEM_Setup_SetupDiag_Results',
    });
  });

  it('erkennt results.xml und Verzeichnisse', () => {
    expect(parseEntryName('results.xml', 5, false)).toMatchObject({
      kind: 'results',
      index: null,
    });
    const dir = parseEntryName('(4) FoldersFiles Logs_Dir/', 0, true);
    expect(dir).toMatchObject({ isDirectory: true, name: 'Logs_Dir' });
  });

  it('liefert null für unbekannte Namen', () => {
    expect(parseEntryName('readme.txt', 1, false)).toBeNull();
    expect(parseEntryName('(1) Other something', 1, false)).toBeNull();
  });

  it('zerlegt FoldersFiles-Namen', () => {
    expect(splitFoldersFilesName('Dir/file.log')).toEqual({ directory: 'Dir', file: 'file.log' });
    expect(splitFoldersFilesName('Dir')).toEqual({ directory: 'Dir', file: null });
  });
});
