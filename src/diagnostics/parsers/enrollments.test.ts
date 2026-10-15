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
});
