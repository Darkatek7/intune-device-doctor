import { describe, expect, it } from 'vitest';
import { buildFixtureEntries } from '../fixture';
import { decodeText } from './encoding';
import { extractEnrollments, isEnrollmentRootKey } from './enrollments';
import { parseRegExport } from './regExport';

const PATH = '(1) RegistryKey HKLM_Software_Microsoft_Enrollments export.reg';

describe('extractEnrollments', () => {
  const text = decodeText(buildFixtureEntries()[PATH]!).text;

  it('liefert beide Enrollments des Fixtures', () => {
    const result = extractEnrollments(parseRegExport(text));
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      enrollmentId: '00000000-0000-0000-0000-00000000000A',
      providerId: 'MS DM Server',
      enrollmentState: 1,
      enrollmentType: 6,
      upnMasked: 'us…@contoso.com',
    });
    expect(result[1]).toMatchObject({
      providerId: 'WMI_Bridge_SCCM_Server',
      enrollmentType: 0,
      upnMasked: null,
    });
  });

  it('übernimmt weder Tenant-ID noch ChannelURI', () => {
    const json = JSON.stringify(extractEnrollments(parseRegExport(text)));
    expect(json).not.toContain('DEMO-CHANNEL-URI');
    expect(json).not.toContain('00000000-0000-0000-0000-000000000000');
    expect(json).not.toContain('user@contoso.com');
  });

  it('der Keyfilter verwirft Unterkeys wie Push', () => {
    const keys = parseRegExport(text, { keyFilter: isEnrollmentRootKey });
    expect(keys).toHaveLength(2);
    expect(keys.some((k) => /Push/i.test(k.path))).toBe(false);
  });

  it('ignoriert Keys ohne ProviderID und EnrollmentState', () => {
    const reg =
      '[HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Enrollments\\00000000-0000-0000-0000-0000000000FF]\r\n"Foo"="bar"\r\n';
    expect(extractEnrollments(parseRegExport(reg))).toEqual([]);
  });

  it('ignoriert Enrollment-Keys ohne ProviderID und kürzt die UPN um die Tenant-ID', () => {
    const key = (id: string): string =>
      `[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Enrollments\\${id}]`;
    const reg = [
      key('11111111-1111-1111-1111-111111111111'),
      '"EnrollmentState"=dword:00000001',
      '"EnrollmentType"=dword:00000001',
      key('22222222-2222-2222-2222-222222222222'),
      '"EnrollmentState"=dword:00000001',
      '"EnrollmentType"=dword:00000006',
      '"ProviderID"="MS DM Server"',
      '"UPN"="max@contoso.com@00000000-0000-0000-0000-0000000000aa"',
    ].join('\r\n');
    const result = extractEnrollments(parseRegExport(reg, { keyFilter: isEnrollmentRootKey }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ providerId: 'MS DM Server', upnMasked: 'ma…@contoso.com' });
    expect(JSON.stringify(result)).not.toContain('0000000000aa');
  });
});
