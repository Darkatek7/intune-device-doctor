/** M20: Mapper für Übersicht, Änderungsprotokoll, App-Schutz und Remote-Aktionen. */
import { describe, expect, it } from 'vitest';
import {
  mapAppProtection,
  mapAuditEvents,
  mapComplianceSettingSummaries,
  mapDeviceStateSummary,
} from './mappers';

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

describe('mapAuditEvents (M20/S2)', () => {
  const actor = {
    type: 'ItPro',
    auditActorType: 'ItPro',
    userPermissions: ['*'],
    applicationId: 'app-id',
    applicationDisplayName: 'Microsoft Intune portal extension',
    userPrincipalName: 'admin@contoso.com',
    servicePrincipalName: 'spn',
    ipAddress: '203.0.113.7',
    userId: 'user-id',
  };
  const event = (id: string, time: string, extra: Record<string, unknown> = {}) => ({
    id,
    displayName: 'Display',
    componentName: 'DeviceConfiguration',
    actor,
    activity: 'Patch DeviceConfiguration',
    activityDateTime: time,
    activityType: 'Patch DeviceConfiguration',
    activityOperationType: 'Patch',
    activityResult: 'Success',
    correlationId: 'c1',
    category: 'DeviceConfiguration',
    resources: [
      {
        displayName: 'Contoso – VPN',
        type: 'DeviceConfiguration',
        auditResourceType: 'DeviceConfiguration',
        resourceId: 'p1',
        modifiedProperties: [{ displayName: 'x', oldValue: 'geheim', newValue: 'geheim2' }],
      },
    ],
    ...extra,
  });

  it('liest vom actor nur UPN/App-Name/Typ – nie IP-Adresse, Berechtigungen oder IDs', () => {
    const info = mapAuditEvents([event('a', '2026-11-09T10:00:00Z')] as never, {
      pagesRead: 1,
      truncated: false,
    });
    const json = JSON.stringify(info);
    for (const secret of ['203.0.113.7', 'user-id', 'app-id', 'spn', 'geheim', '"*"']) {
      expect(json).not.toContain(secret);
    }
    expect(info.events[0]!.actor).toEqual({
      kind: 'user',
      name: 'admin@contoso.com',
      actorType: 'ItPro',
    });
    expect(info.events[0]!.resources).toEqual([
      { resourceId: 'p1', displayName: 'Contoso – VPN', type: 'DeviceConfiguration' },
    ]);
  });

  it('Anwendung ohne UPN, sortiert neueste zuerst, ungültige Einträge verworfen', () => {
    const info = mapAuditEvents(
      [
        event('old', '2026-11-01T10:00:00Z'),
        event('app', '2026-11-09T10:00:00Z', {
          actor: { applicationDisplayName: 'Contoso Automation' },
          activity: null,
        }),
        { id: '' },
      ] as never,
      { pagesRead: 2, truncated: true },
    );
    expect(info.events.map((e) => e.id)).toEqual(['app', 'old']);
    expect(info.events[0]!.actor.kind).toBe('application');
    expect(info.events[0]!.activity).toBe('Display');
    expect(info).toMatchObject({ pagesRead: 2, truncated: true });
  });
});

describe('mapAppProtection (M20/S3)', () => {
  const USER = 'user-1';
  const reg = (id: string, values: Record<string, unknown>) => ({ id, userId: USER, ...values });
  const options = { userId: 'USER-1', deviceName: 'CONTOSO-AND21', pagesRead: 1, truncated: false };

  it('filtert auf den Benutzer, ordnet über den Gerätenamen zu und liest App-ID je Plattform', () => {
    const info = mapAppProtection(
      [
        reg('a', {
          deviceName: 'contoso-and21',
          lastSyncDateTime: '2026-11-09T10:00:00Z',
          appIdentifier: {
            '@odata.type': '#microsoft.graph.androidMobileAppIdentifier',
            packageId: 'com.microsoft.office.outlook',
          },
          flaggedReasons: ['none', 'rootedDevice'],
          deviceTag: 'geheim',
        }),
        reg('b', { deviceName: 'Pixel', lastSyncDateTime: '2026-11-10T10:00:00Z' }),
        { id: 'c', userId: 'someone-else', deviceName: 'CONTOSO-AND21' },
      ],
      options,
    );
    expect(info.matchedBy).toBe('deviceName');
    expect(info.userRegistrationCount).toBe(2);
    expect(info.registrations.map((r) => r.id)).toEqual(['a']);
    expect(info.registrations[0]).toMatchObject({
      appIdentifier: 'com.microsoft.office.outlook',
      appPlatform: 'android',
      flaggedReasons: ['rootedDevice'],
    });
    expect(JSON.stringify(info)).not.toContain('geheim');
  });

  it('ohne Treffer beim Gerätenamen → alle Registrierungen des Benutzers, zuletzt synchronisierte zuerst', () => {
    const info = mapAppProtection(
      [
        reg('old', {
          deviceName: 'iPhone',
          lastSyncDateTime: '2026-09-01T00:00:00Z',
          appIdentifier: { bundleId: 'com.microsoft.skype.teams' },
        }),
        reg('new', { deviceName: 'iPhone', lastSyncDateTime: '2026-11-10T00:00:00Z' }),
      ],
      { ...options, deviceName: 'CONTOSO-IP015', truncated: true, pagesRead: 3 },
    );
    expect(info.matchedBy).toBe('user');
    expect(info.registrations.map((r) => r.id)).toEqual(['new', 'old']);
    expect(info.registrations[1]).toMatchObject({
      appPlatform: 'ios',
      appIdentifier: 'com.microsoft.skype.teams',
    });
    expect(info).toMatchObject({ pagesRead: 3, truncated: true });
    expect(mapAppProtection(null, options).registrations).toEqual([]);
  });
});
