/** M20: Mapper für Übersicht, Änderungsprotokoll, App-Schutz und Remote-Aktionen. */
import { describe, expect, it } from 'vitest';
import { mapComplianceSettingSummaries, mapDeviceStateSummary } from './mappers';

describe('mapDeviceStateSummary (M20/S1)', () => {
  it('übernimmt genau die dokumentierten Felder je Art; fehlende/ungültige Werte → null', () => {
    const compliance = mapDeviceStateSummary(
      { compliantDeviceCount: 3, errorDeviceCount: -1, inGracePeriodCount: 2.7 },
      'compliance',
    );
    expect(Object.keys(compliance.counts)).toHaveLength(9);
    expect(compliance.counts).toMatchObject({
      compliantDeviceCount: 3,
      errorDeviceCount: null,
      inGracePeriodCount: 2,
      configManagerCount: null,
    });
    const config = mapDeviceStateSummary({ value: { conflictDeviceCount: 4 } }, 'configuration');
    expect(Object.keys(config.counts)).toHaveLength(7);
    expect(config.counts.conflictDeviceCount).toBe(4);
    expect(config.counts).not.toHaveProperty('configManagerCount');
    expect(mapDeviceStateSummary(null, 'compliance').counts.compliantDeviceCount).toBeNull();
  });
});

describe('mapComplianceSettingSummaries (M20/S1)', () => {
  it('sortiert nach nicht konformen Geräten, Plattform nur dokumentierte Werte, Name mit Rückfall', () => {
    const info = mapComplianceSettingSummaries(
      [
        { id: 'a', settingName: 'A', platformType: 'iOS', nonCompliantDeviceCount: 1 },
        { id: 'b', setting: 'Cls.b', platformType: 'tvOS', nonCompliantDeviceCount: 5 },
        { id: 'c', platformType: 'androidWorkProfile', errorDeviceCount: 2 },
        { id: '' },
      ] as never,
      { pagesRead: 1, truncated: false },
    );
    expect(info.settings.map((s) => s.id)).toEqual(['b', 'a', 'c']);
    expect(info.settings[0]).toMatchObject({ name: 'Cls.b', platform: null, platformRaw: 'tvOS' });
    expect(info.settings[1]!.platform).toBe('iOS');
    expect(info.settings[2]).toMatchObject({ name: 'c', platform: 'androidWorkProfile' });
  });
});
