import { describe, expect, it } from 'vitest';
import { buildFixtureEntries } from '../fixture';
import { decodeText } from './encoding';
import { parseDsregcmd } from './dsregcmd';

const DSREG_PATH = '(3) Command windir_system32_Dsregcmd_exe_status output.log';

function fixtureStatus() {
  const bytes = buildFixtureEntries()[DSREG_PATH]!;
  return parseDsregcmd(decodeText(bytes).text);
}

describe('parseDsregcmd', () => {
  const status = fixtureStatus();

  it('liest Abschnitte und leere Werte', () => {
    expect(status.sections.map((s) => s.name)).toEqual([
      'Device State',
      'Device Details',
      'Tenant Details',
      'User State',
      'SSO State',
      'Diagnostic Data',
    ]);
    const sso = status.sections.find((s) => s.name === 'SSO State')!;
    expect(sso.fields.find((f) => f.key === 'AzureAdPrtAuthority')?.value).toBe('');
  });

  it('befüllt die Bequemfelder', () => {
    expect(status).toMatchObject({
      azureAdJoined: 'YES',
      domainJoined: 'NO',
      deviceAuthStatus: 'SUCCESS',
      tpmProtected: 'YES',
      azureAdPrt: 'NO',
      wamDefaultSet: 'ERROR (0x80070520)',
      prtAttemptStatus: '0xc000023c',
      prtHttpError: '0x80072ee7',
    });
  });

  it('parst den PRT-Block verschachtelt und beendet ihn am Abschnittsende', () => {
    const sso = status.sections.find((s) => s.name === 'SSO State')!;
    expect(sso.blocks.map((b) => b.name)).toEqual(['AcquirePrtDiagnostics']);
    const keys = sso.blocks[0]!.fields.map((f) => f.key);
    expect(keys).toContain('Attempt Status');
    expect(keys).toContain('HTTP Error');
    expect(keys).not.toContain('AzureAdPrt');
    const diag = status.sections.find((s) => s.name === 'Diagnostic Data')!;
    expect(diag.fields.map((f) => f.key)).toContain('KeySignTest');
  });

  it('maskiert sensible Werte', () => {
    const json = JSON.stringify(status);
    expect(json).not.toContain('user@contoso.com');
    expect(json).not.toContain('00000000-0000-0000-0000-000000000000');
    expect(json).not.toContain('00000000-0000-0000-0000-000000000042');
    expect(json).not.toContain('0000000000000000000000000000000000000000');
    const sso = status.sections.find((s) => s.name === 'SSO State')!;
    expect(sso.blocks[0]!.fields.find((f) => f.key === 'User Identity')?.value).toBe(
      'us…@contoso.com',
    );
    const endpoint = sso.blocks[0]!.fields.find((f) => f.key === 'Endpoint URI')?.value;
    expect(endpoint).toBe('https://login.microsoftonline.com/0000…0000/oauth2/token/');
  });
});
