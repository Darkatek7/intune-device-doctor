import { describe, expect, it } from 'vitest';
import {
  PC001_ENTRA_ID,
  bitlockerKey,
  malware,
  pc001Device,
  pc001Entra,
  pc001Protection,
  policyState,
  signInDto,
} from '../providers/graph/fakeGraph';
import type { GraphManagedDevice, GraphWindowsProtectionState } from './dto';
import {
  graphSource,
  mapApplePushCertificate,
  mapBitlockerKey,
  mapDetectedMalware,
  mapEntraDevice,
  mapManagedDevice,
  mapPolicyState,
  mapSearchResult,
  mapSignIns,
  mapVolumeType,
  mapWindowsProtection,
  splitProductStatus,
} from './mappers';
import { Endpoints } from './endpoints';

describe('graphSource', () => {
  it('nutzt display und docsUrl der Endpoint-Definition', () => {
    expect(graphSource('managedDevice')).toEqual({
      kind: 'graph',
      label: Endpoints.managedDevice.display,
      docsUrl: Endpoints.managedDevice.docsUrl,
    });
  });
});

describe('mapManagedDevice', () => {
  it('übernimmt Felder, bestimmt osFamily und setzt die Quelle', () => {
    const info = mapManagedDevice(pc001Device());
    expect(info).toMatchObject({
      id: pc001Device().id,
      deviceName: 'CONTOSO-PC001',
      osFamily: 'windows',
      complianceState: 'compliant',
      source: graphSource('managedDevice'),
    });
    expect(mapManagedDevice(pc001Device({ operatingSystem: 'macOS' })).osFamily).toBe('macos');
    expect(mapManagedDevice(pc001Device({ operatingSystem: 'iOS' })).osFamily).toBe('ios');
    expect(mapManagedDevice(pc001Device({ operatingSystem: 'Android' })).osFamily).toBe('android');
  });

  it('userId: Null-GUID und leere Werte (Geräte ohne Benutzer) werden zu null', () => {
    expect(
      mapManagedDevice(pc001Device({ userId: '00000000-0000-0000-0000-000000000000' })).userId,
    ).toBeNull();
    expect(mapManagedDevice(pc001Device({ userId: '' })).userId).toBeNull();
    expect(mapManagedDevice(pc001Device()).userId).toBe(pc001Device().userId);
  });

  it('ist null-sicher und mappt unbekannte Enum-Werte auf unknown', () => {
    const dto = {
      id: 'x',
      deviceName: null,
      operatingSystem: null,
      complianceState: 'somethingNew',
      managementAgent: undefined,
      deviceEnrollmentType: 42,
      partnerReportedThreatState: null,
      isEncrypted: null,
      freeStorageSpaceInBytes: null,
      azureADDeviceId: null,
    } as unknown as GraphManagedDevice;
    const info = mapManagedDevice(dto);
    expect(info).toMatchObject({
      deviceName: '–',
      osFamily: 'other',
      operatingSystem: null,
      complianceState: 'unknown',
      managementAgent: 'unknown',
      deviceEnrollmentType: 'unknown',
      partnerReportedThreatState: 'unknown',
      isEncrypted: null,
      freeStorageSpaceInBytes: null,
      totalStorageSpaceInBytes: null,
      azureADDeviceId: null,
      userPrincipalName: null,
    });
  });
});

describe('mapSearchResult', () => {
  it('mappt nur die Listenfelder und toleriert fehlende Felder', () => {
    expect(
      mapSearchResult({ id: 'a', deviceName: 'CONTOSO-PC001', complianceState: 'compliant' }),
    ).toEqual({
      id: 'a',
      deviceName: 'CONTOSO-PC001',
      userPrincipalName: null,
      userDisplayName: null,
      operatingSystem: null,
      osVersion: null,
      model: null,
      complianceState: 'compliant',
      lastSyncDateTime: null,
    });
  });
});

describe('splitProductStatus', () => {
  it('splittet kommasepariert, trimmt und entfernt leere Einträge', () => {
    expect(splitProductStatus('avSignaturesOutOfDate, rebootPending ,,')).toEqual([
      'avSignaturesOutOfDate',
      'rebootPending',
    ]);
    expect(splitProductStatus('noStatus')).toEqual(['noStatus']);
    expect(splitProductStatus('')).toEqual([]);
    expect(splitProductStatus(null)).toEqual([]);
    expect(splitProductStatus(undefined)).toEqual([]);
  });
});

describe('mapWindowsProtection', () => {
  it('mappt Defender-Status inkl. Malware-Liste', () => {
    const info = mapWindowsProtection(
      { ...pc001Protection(), productStatus: 'serviceNotRunning,avSignaturesOutOfDate' },
      [malware()],
    );
    expect(info.productStatus).toEqual(['serviceNotRunning', 'avSignaturesOutOfDate']);
    expect(info.deviceState).toBe('clean');
    expect(info.detectedMalware).toHaveLength(1);
    expect(info.detectedMalware[0]).toMatchObject({ severity: 'low', threatState: 'cleaned' });
  });

  it('toleriert null-Felder und unbekannte deviceState-Werte', () => {
    const dto = {
      id: 'x',
      deviceState: 'brandNew',
      productStatus: null,
      realTimeProtectionEnabled: null,
      lastQuickScanDateTime: null,
    } as unknown as GraphWindowsProtectionState;
    const info = mapWindowsProtection(dto);
    expect(info).toMatchObject({
      deviceState: null,
      productStatus: [],
      realTimeProtectionEnabled: null,
      tamperProtectionEnabled: null,
      lastQuickScanDateTime: null,
      detectedMalware: [],
    });
  });
});

describe('mapDetectedMalware', () => {
  it('mappt unbekannte Werte auf unknown', () => {
    const info = mapDetectedMalware({
      ...malware(),
      severity: 'weird' as never,
      state: 'weird' as never,
      threatState: 'weird' as never,
      detectionCount: null,
    });
    expect(info).toMatchObject({ severity: 'unknown', state: 'unknown', threatState: 'unknown' });
    expect(info.detectionCount).toBeNull();
  });
});

describe('mapPolicyState', () => {
  it('mappt Parent und settingStates mit kind', () => {
    const info = mapPolicyState(
      policyState('p-1', 'Contoso – Test', { state: 'nonCompliant' }),
      'compliance',
    );
    expect(info).toMatchObject({
      id: 'p-1',
      kind: 'compliance',
      displayName: 'Contoso – Test',
      state: 'nonCompliant',
      platformType: 'windows10AndLater',
    });
    expect(info.settings).toHaveLength(1);
    expect(info.settings[0]).toMatchObject({
      setting: 'DeviceCompliance.RequireEncryption',
      state: 'compliant',
      errorCode: 0,
    });
    expect(info.settings[0]?.sources[0]).toEqual({ id: 'p-1-src', displayName: 'Contoso – Test' });
  });

  it('toleriert fehlende settingStates, null-Namen und unbekannte Werte', () => {
    const info = mapPolicyState(
      {
        id: 'p-2',
        displayName: null,
        version: null,
        platformType: 'plan9' as never,
        state: 'newState' as never,
        settingCount: null,
        settingStates: null,
      },
      'configuration',
    );
    expect(info).toMatchObject({
      kind: 'configuration',
      displayName: 'p-2',
      state: 'unknown',
      platformType: null,
      version: null,
      settingCount: null,
      settings: [],
    });
  });

  it('akzeptiert settingStates ohne sources', () => {
    const info = mapPolicyState(
      policyState('p-3', 'X', {
        settingStates: [
          {
            setting: null,
            settingName: null,
            instanceDisplayName: null,
            state: 'error',
            errorCode: -2016281112,
            errorDescription: null,
            userPrincipalName: null,
            sources: null,
            currentValue: null,
          },
        ],
      }),
      'configuration',
    );
    expect(info.settings[0]).toMatchObject({ state: 'error', errorCode: -2016281112, sources: [] });
  });
});

describe('mapEntraDevice', () => {
  it('mappt objectId aus id und validiert trustType', () => {
    expect(mapEntraDevice(pc001Entra())).toMatchObject({
      objectId: pc001Entra().id,
      deviceId: pc001Entra().deviceId,
      trustType: 'AzureAd',
      isManaged: true,
    });
    expect(mapEntraDevice({ ...pc001Entra(), trustType: 'Other' as never }).trustType).toBeNull();
    expect(
      mapEntraDevice({
        ...pc001Entra(),
        accountEnabled: null,
        approximateLastSignInDateTime: null,
      }),
    ).toMatchObject({ accountEnabled: null, approximateLastSignInDateTime: null });
  });
});

describe('BitLocker volumeType', () => {
  it('akzeptiert Namen und Zahlen 1/2/3', () => {
    expect(mapVolumeType('operatingSystemVolume')).toBe('operatingSystemVolume');
    expect(mapVolumeType('fixedDataVolume')).toBe('fixedDataVolume');
    expect(mapVolumeType('removableDataVolume')).toBe('removableDataVolume');
    expect(mapVolumeType(1)).toBe('operatingSystemVolume');
    expect(mapVolumeType(2)).toBe('fixedDataVolume');
    expect(mapVolumeType(3)).toBe('removableDataVolume');
    expect(mapVolumeType('1')).toBe('operatingSystemVolume');
  });

  it('mappt alles andere auf unknown', () => {
    expect(mapVolumeType(99)).toBe('unknown');
    expect(mapVolumeType(4)).toBe('unknown');
    expect(mapVolumeType('unknownFutureValue')).toBe('unknown');
    expect(mapVolumeType('banana')).toBe('unknown');
    expect(mapVolumeType(null)).toBe('unknown');
    expect(mapVolumeType(undefined)).toBe('unknown');
  });

  it('mapBitlockerKey übernimmt nur Metadaten', () => {
    const dto = { ...bitlockerKey('k-1', 1), key: 'SECRET' } as never;
    const info = mapBitlockerKey(dto);
    expect(Object.keys(info).sort()).toEqual(['createdDateTime', 'id', 'volumeType']);
    expect(info.volumeType).toBe('operatingSystemVolume');
    expect(JSON.stringify(info)).not.toContain('SECRET');
  });
});

describe('mapManagedDevice – Zertifikat, Beaufsichtigung, Android-Patch, Enrollment-Profil', () => {
  /** Graph-DTO ohne das angegebene Feld (Graph lässt Felder je nach $select weg). */
  const withoutField = (key: keyof GraphManagedDevice): GraphManagedDevice => {
    const dto: Partial<GraphManagedDevice> = pc001Device();
    delete dto[key];
    return dto as GraphManagedDevice;
  };

  describe('managementCertificateExpirationDate (validDate)', () => {
    it('gültiges Datum bleibt unverändert erhalten', () => {
      const value = '2027-01-15T08:00:00Z';
      expect(
        mapManagedDevice(pc001Device({ managementCertificateExpirationDate: value }))
          .managementCertificateExpirationDate,
      ).toBe(value);
    });

    it('Jahr 2000 ist die untere Grenze und bleibt erhalten', () => {
      const value = '2000-01-01T00:00:00Z';
      expect(
        mapManagedDevice(pc001Device({ managementCertificateExpirationDate: value }))
          .managementCertificateExpirationDate,
      ).toBe(value);
    });

    it.each([
      ['Graph-Platzhalter „nicht gesetzt“ 0001-01-01', '0001-01-01T00:00:00Z'],
      ['Jahr 1999 (kurz vor der Grenze)', '1999-12-31T23:59:59Z'],
      ['ungültiger Text', 'kein-datum'],
      ['leerer String', ''],
      ['null', null],
    ])('%s → null', (_label, value) => {
      expect(
        mapManagedDevice(pc001Device({ managementCertificateExpirationDate: value }))
          .managementCertificateExpirationDate,
      ).toBeNull();
    });

    it('fehlendes Feld (undefined) → null', () => {
      expect(
        mapManagedDevice(withoutField('managementCertificateExpirationDate'))
          .managementCertificateExpirationDate,
      ).toBeNull();
    });
  });

  describe('isSupervised (bool)', () => {
    it.each([
      ['true', true],
      ['false', false],
      ['null', null],
    ] as const)('%s wird übernommen', (_label, value) => {
      expect(mapManagedDevice(pc001Device({ isSupervised: value })).isSupervised).toBe(value);
    });

    it('nur echte Booleans gelten: Text "true" und Zahl 1 werden zu null', () => {
      expect(
        mapManagedDevice(pc001Device({ isSupervised: 'true' as never })).isSupervised,
      ).toBeNull();
      expect(mapManagedDevice(pc001Device({ isSupervised: 1 as never })).isSupervised).toBeNull();
    });

    it('fehlendes Feld (undefined) → null', () => {
      expect(mapManagedDevice(withoutField('isSupervised')).isSupervised).toBeNull();
    });
  });

  describe('androidSecurityPatchLevel', () => {
    it('Datum wird übernommen und getrimmt', () => {
      expect(
        mapManagedDevice(pc001Device({ androidSecurityPatchLevel: '2026-09-01' }))
          .androidSecurityPatchLevel,
      ).toBe('2026-09-01');
      expect(
        mapManagedDevice(pc001Device({ androidSecurityPatchLevel: '  2026-09-01 ' }))
          .androidSecurityPatchLevel,
      ).toBe('2026-09-01');
    });

    it.each([
      ['leerer String', ''],
      ['nur Leerzeichen', '   '],
      ['null', null],
    ])('%s → null', (_label, value) => {
      expect(
        mapManagedDevice(pc001Device({ androidSecurityPatchLevel: value }))
          .androidSecurityPatchLevel,
      ).toBeNull();
    });

    it('fehlendes Feld (undefined) → null', () => {
      expect(
        mapManagedDevice(withoutField('androidSecurityPatchLevel')).androidSecurityPatchLevel,
      ).toBeNull();
    });
  });

  describe('enrollmentProfileName', () => {
    it('Name wird übernommen und getrimmt', () => {
      expect(
        mapManagedDevice(pc001Device({ enrollmentProfileName: 'Contoso Autopilot' }))
          .enrollmentProfileName,
      ).toBe('Contoso Autopilot');
      expect(
        mapManagedDevice(pc001Device({ enrollmentProfileName: '  Contoso Autopilot  ' }))
          .enrollmentProfileName,
      ).toBe('Contoso Autopilot');
    });

    it.each([
      ['leerer String', ''],
      ['nur Leerzeichen', '   '],
      ['null', null],
    ])('%s → null', (_label, value) => {
      expect(
        mapManagedDevice(pc001Device({ enrollmentProfileName: value })).enrollmentProfileName,
      ).toBeNull();
    });

    it('fehlendes Feld (undefined) → null', () => {
      expect(
        mapManagedDevice(withoutField('enrollmentProfileName')).enrollmentProfileName,
      ).toBeNull();
    });
  });
});

describe('mapApplePushCertificate', () => {
  const dto = {
    id: 'c1',
    expirationDateTime: '2027-05-03T12:00:00Z',
    lastModifiedDateTime: '2026-05-03T12:00:00Z',
  };
  const expected = {
    expirationDateTime: '2027-05-03T12:00:00Z',
    lastModifiedDateTime: '2026-05-03T12:00:00Z',
  };

  it('akzeptiert das Objekt direkt und unter `value`', () => {
    expect(mapApplePushCertificate(dto)).toEqual(expected);
    expect(mapApplePushCertificate({ value: dto })).toEqual(expected);
  });

  it('gibt nur die Zeitstempel zurück (keine Apple-ID, kein Zertifikat)', () => {
    const mapped = mapApplePushCertificate({
      ...dto,
      appleIdentifier: 'admin@contoso.com',
      certificate: 'AAAA',
    } as never);
    expect(Object.keys(mapped).sort()).toEqual(['expirationDateTime', 'lastModifiedDateTime']);
  });

  it('ungültige Daten und Jahr < 2000 → null', () => {
    expect(
      mapApplePushCertificate({
        id: 'c',
        expirationDateTime: '0001-01-01T00:00:00Z',
        lastModifiedDateTime: 'kein-datum',
      }),
    ).toEqual({ expirationDateTime: null, lastModifiedDateTime: null });
    expect(mapApplePushCertificate({ value: { expirationDateTime: 42 as never } })).toEqual({
      expirationDateTime: null,
      lastModifiedDateTime: null,
    });
    expect(mapApplePushCertificate(null)).toEqual({
      expirationDateTime: null,
      lastModifiedDateTime: null,
    });
  });
});

describe('mapSignIns', () => {
  const OTHER_DEVICE = '00000000-0000-4000-9000-0000000000ff';
  const meta = { windowDays: 7, moreAvailable: false };

  it('grenzt clientseitig auf die Geräte-ID ein (Groß-/Kleinschreibung egal), neueste zuerst', () => {
    const info = mapSignIns(
      [
        signInDto('alt', 30),
        signInDto('fremd', 1, {}, OTHER_DEVICE),
        signInDto('neu', 2, {}, PC001_ENTRA_ID.toUpperCase()),
        signInDto('ohne', 3, { deviceDetail: null }),
      ],
      PC001_ENTRA_ID,
      meta,
    );
    expect(info.entries.map((e) => e.id)).toEqual(['neu', 'alt']);
    expect(info.totalForUser).toBe(4);
    expect(info.windowDays).toBe(7);
    expect(info.moreAvailable).toBe(false);
    expect(mapSignIns([], PC001_ENTRA_ID, { windowDays: 7, moreAvailable: true })).toMatchObject({
      entries: [],
      totalForUser: 0,
      moreAvailable: true,
    });
  });

  it('übernimmt weder IP-Adresse noch Standort, Risikoangaben oder UPN', () => {
    const info = mapSignIns([signInDto('a', 1)], PC001_ENTRA_ID, meta);
    const json = JSON.stringify(info);
    for (const forbidden of [
      '203.0.113.7',
      'ipAddress',
      'location',
      'Contoso City',
      'riskLevel',
      'userPrincipalName',
      'anna.schmidt',
    ]) {
      expect(json, forbidden).not.toContain(forbidden);
    }
    expect(Object.keys(info.entries[0]!).sort()).toEqual(
      [
        'additionalDetails',
        'appDisplayName',
        'appliedPolicies',
        'clientAppUsed',
        'conditionalAccessStatus',
        'correlationId',
        'createdDateTime',
        'deviceIsCompliant',
        'deviceIsManaged',
        'errorCode',
        'failureReason',
        'id',
        'isInteractive',
        'resourceDisplayName',
      ].sort(),
    );
  });

  it('Fehlt appliedConditionalAccessPolicies (kein Leserecht), ist appliedPolicies null – sonst gemappt', () => {
    const hidden = signInDto('h', 1);
    delete hidden.appliedConditionalAccessPolicies;
    const [entryHidden] = mapSignIns([hidden], PC001_ENTRA_ID, meta).entries;
    expect(entryHidden!.appliedPolicies).toBeNull();

    const [visible] = mapSignIns([signInDto('v', 1)], PC001_ENTRA_ID, meta).entries;
    expect(visible!.appliedPolicies).toEqual([
      {
        id: 'pol-1',
        displayName: 'Contoso – Kompatibles Gerät erforderlich',
        result: 'success',
        enforcedGrantControls: ['Require device to be marked as compliant'],
        enforcedSessionControls: [],
      },
    ]);
  });

  it('ist null-sicher und verwirft unbekannte Enum-Werte', () => {
    const odd = signInDto('o', 1, {
      conditionalAccessStatus: 'reportOnlyFailure' as never,
      status: null,
      createdDateTime: 'kein-datum',
      appliedConditionalAccessPolicies: [
        {
          id: null,
          displayName: null,
          enforcedGrantControls: null,
          enforcedSessionControls: null,
          result: 'reportOnlySuccess' as never,
        },
      ],
    });
    const [entry] = mapSignIns([odd], PC001_ENTRA_ID, meta).entries;
    expect(entry).toMatchObject({
      conditionalAccessStatus: null,
      errorCode: null,
      failureReason: null,
      createdDateTime: null,
    });
    expect(entry!.appliedPolicies![0]).toEqual({
      id: null,
      displayName: null,
      result: null,
      enforcedGrantControls: [],
      enforcedSessionControls: [],
    });
  });
});
