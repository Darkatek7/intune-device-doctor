import { describe, expect, it } from 'vitest';
import { buildFixtureEntries } from '../fixture';
import { decodeText } from './encoding';
import { parseRegExport } from './regExport';
import { extractWin32Apps, isWin32AppsKey } from './win32Apps';

const PATH = '(2) RegistryKey HKLM_Software_Microsoft_IntuneManagementExtension export.reg';
const APP = (guid: string, rev: number, sub: string): string =>
  `[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\IntuneManagementExtension\\Win32Apps\\U\\${guid}_${rev}\\${sub}]`;

describe('extractWin32Apps', () => {
  it('liest die drei Fixture-Apps', () => {
    const text = decodeText(buildFixtureEntries()[PATH]!).text;
    const apps = extractWin32Apps(parseRegExport(text, { keyFilter: isWin32AppsKey }));
    expect(apps.map((a) => a.status)).toEqual(['Installed', 'Failed', 'NotApplicable']);
    const failed = apps.find((a) => a.status === 'Failed')!;
    expect(failed).toMatchObject({
      appId: '00000000-0000-0000-0000-0000000000A2',
      errorCodeHex: '0x80070642',
      errorCodeDecimal: -2147023294,
    });
    expect(apps[0]).toMatchObject({ errorCodeHex: null, errorCodeDecimal: null });
  });

  it('wählt pro App den aussagekräftigsten Status und dedupliziert Revisionen', () => {
    const g = '11111111-1111-1111-1111-111111111111';
    const reg = [
      APP(g, 1, 'OperationalState'),
      '"Status"="Installed"',
      APP(g, 2, 'OperationalState'),
      '"Status"="Failed"',
      '"ErrorCode"=dword:80070bc2',
    ].join('\r\n');
    const apps = extractWin32Apps(parseRegExport(reg));
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({ status: 'Failed', errorCodeHex: '0x80070BC2' });
  });

  it('ignoriert Keys ohne App-GUID', () => {
    const reg = [
      '[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\IntuneManagementExtension\\Win32Apps\\U\\GRS\\x]',
      '"Status"="Failed"',
    ].join('\r\n');
    expect(extractWin32Apps(parseRegExport(reg))).toEqual([]);
  });

  it('liest StatusServiceReports wie in echten Archiven und führt Nutzer/Schreibweisen zusammen', () => {
    const report = (user: string, app: string): string =>
      `[HKEY_LOCAL_MACHINE\\software\\microsoft\\intunemanagementextension\\SideCarPolicies\\StatusServiceReports\\${user}\\${app}]`;
    const g = '22222222-2222-2222-2222-2222222222AB';
    const reg = [
      report('U1', g.toLowerCase()),
      `"AppId"="${g.toLowerCase()}"`,
      '"Status"="Installed"',
      '"ErrorCode"="0"',
      report('U2', g),
      `"AppId"="${g}"`,
      '"Status"="Failed"',
      '"ErrorCode"="-2147024826"',
    ].join('\r\n');
    const apps = extractWin32Apps(parseRegExport(reg, { keyFilter: isWin32AppsKey }));
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({ status: 'Failed', errorCodeHex: '0x80070046' });
    expect(apps[0]!.appId.toLowerCase()).toBe(g.toLowerCase());
  });
});
