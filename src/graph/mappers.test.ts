import { describe, expect, it } from 'vitest';
import {
  PC001_ENTRA_ID,
  PC001_ID,
  bitlockerKey,
  malware,
  pc001Device,
  pc001Entra,
  pc001Protection,
  policyState,
  signInDto,
} from '../providers/graph/fakeGraph';
import type {
  GraphManagedDevice,
  GraphSecurityAlert,
  GraphVppToken,
  GraphWindowsProtectionState,
} from './dto';
import {
  graphSource,
  isGuid,
  mapApplePushCertificate,
  mapAssignmentTarget,
  mapAssignments,
  mapBitlockerKey,
  mapDetectedMalware,
  mapAutopilot,
  mapDeviceGroups,
  mapDuplicateDevices,
  mapEnrollmentLimits,
  mapUserLicense,
  mapEntraDevice,
  mapHealthAttestation,
  mapLocalAdmin,
  mapManagedDevice,
  mapPolicyState,
  mapSearchResult,
  mapSecurityAlerts,
  mapSignIns,
  mapUserDevices,
  mapVolumeType,
  mapVppTokens,
  mapWindowsProtection,
  safeAlertWebUrl,
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
      serialNumber: null,
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

describe('mapLocalAdmin (Windows LAPS)', () => {
  const info = {
    id: PC001_ENTRA_ID,
    deviceName: 'CONTOSO-PC001',
    lastBackupDateTime: '2026-10-12T08:00:00Z',
    refreshDateTime: '2026-11-11T08:00:00Z',
  };

  it('übernimmt nur Gerätename und Zeitpunkte', () => {
    expect(mapLocalAdmin(info)).toEqual({
      deviceName: 'CONTOSO-PC001',
      lastBackupDateTime: '2026-10-12T08:00:00Z',
      refreshDateTime: '2026-11-11T08:00:00Z',
    });
  });

  it('akzeptiert die Form unter "value" (Doku-Beispiel) wie die direkte Form', () => {
    expect(mapLocalAdmin({ value: info })).toEqual(mapLocalAdmin(info));
  });

  it('gibt ein Kennwort aus credentials nie weiter', () => {
    const leaked = {
      ...info,
      credentials: [{ accountName: 'Administrator', passwordBase64: 'U2VjcmV0' }],
    };
    expect(JSON.stringify(mapLocalAdmin(leaked as never))).not.toMatch(
      /credentials|U2VjcmV0|Secret/i,
    );
    expect(Object.keys(mapLocalAdmin(leaked as never)).sort()).toEqual([
      'deviceName',
      'lastBackupDateTime',
      'refreshDateTime',
    ]);
  });

  it('macht aus leeren Antworten, ungültigen Daten und 0001-01-01 null', () => {
    const empty = { deviceName: null, lastBackupDateTime: null, refreshDateTime: null };
    expect(mapLocalAdmin(null)).toEqual(empty);
    expect(mapLocalAdmin(undefined)).toEqual(empty);
    expect(
      mapLocalAdmin({ lastBackupDateTime: 'kaputt', refreshDateTime: '0001-01-01T00:00:00Z' }),
    ).toEqual(empty);
  });
});

describe('mapAutopilot', () => {
  const device = { id: 'dev-1', serialNumber: 'SN-123' };
  const entry = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'ap',
      groupTag: ' Contoso-Standard ',
      serialNumber: 'sn-123',
      managedDeviceId: 'DEV-1',
      enrollmentState: 'enrolled',
      lastContactedDateTime: '2026-10-13T08:00:00Z',
      manufacturer: 'Microsoft Corporation',
      model: 'Surface Laptop 6',
      productKey: 'AAAAA-BBBBB-CCCCC-DDDDD-EEEEE',
      userPrincipalName: 'anna.schmidt@contoso.com',
      ...overrides,
    }) as never;

  it('ordnet zuerst über managedDeviceId zu (Groß-/Kleinschreibung egal)', () => {
    const info = mapAutopilot([entry()], device);
    expect(info).toMatchObject({
      groupTag: 'Contoso-Standard',
      enrollmentState: 'enrolled',
      matchedBy: 'managedDeviceId',
    });
  });

  it('fällt auf die Seriennummer zurück, wenn managedDeviceId fehlt oder die Null-GUID ist', () => {
    const zero = '00000000-0000-0000-0000-000000000000';
    expect(mapAutopilot([entry({ managedDeviceId: zero })], device)?.matchedBy).toBe(
      'serialNumber',
    );
    expect(mapAutopilot([entry({ managedDeviceId: null })], device)?.matchedBy).toBe(
      'serialNumber',
    );
  });

  it('kein Treffer → null; ohne Seriennummer wird nicht über sie zugeordnet', () => {
    expect(mapAutopilot([entry({ managedDeviceId: 'x', serialNumber: 'x' })], device)).toBeNull();
    expect(
      mapAutopilot([entry({ managedDeviceId: 'x', serialNumber: '' })], {
        id: 'dev-1',
        serialNumber: '',
      }),
    ).toBeNull();
  });

  it('übernimmt weder Seriennummer noch Produktschlüssel noch Benutzer; unbekannte Status → null', () => {
    const info = mapAutopilot([entry({ enrollmentState: 'blocked' })], device)!;
    expect(info.enrollmentState).toBeNull();
    expect(JSON.stringify(info)).not.toMatch(/AAAAA|anna\.schmidt|SN-123|productKey|serialNumber/i);
  });
});

describe('mapDeviceGroups', () => {
  const group = (id: string, displayName?: string | null) => ({
    '@odata.type': '#microsoft.graph.group',
    id,
    displayName,
  });

  it('zeigt nur Gruppen mit Namen (sortiert), zählt Gruppen ohne Namen als ausgeblendet', () => {
    const info = mapDeviceGroups(
      [group('2', 'Zebra'), group('1', 'Alpha'), group('3'), group('4', null)],
      false,
    );
    expect(info.groups).toEqual([
      { id: '1', displayName: 'Alpha' },
      { id: '2', displayName: 'Zebra' },
    ]);
    expect(info.hiddenCount).toBe(2);
    expect(info.truncated).toBe(false);
  });

  it('ignoriert andere Objekttypen (z. B. Verwaltungseinheiten) und Einträge ohne Typ', () => {
    const info = mapDeviceGroups(
      [
        { '@odata.type': '#microsoft.graph.administrativeUnit', id: 'au', displayName: 'Berlin' },
        { id: 'x', displayName: 'ohne Typ' },
        group('1', 'Alpha'),
      ],
      true,
    );
    expect(info.groups.map((g) => g.displayName)).toEqual(['Alpha']);
    expect(info.hiddenCount).toBe(0);
    expect(info.truncated).toBe(true);
  });
});

describe('mapUserDevices', () => {
  const entry = (id: string, deviceName: string) =>
    ({ id, deviceName, operatingSystem: 'iOS', complianceState: 'compliant' }) as never;

  it('blendet das aktuelle Gerät aus (Groß-/Kleinschreibung egal) und sortiert nach Name', () => {
    const result = mapUserDevices(
      [entry('B', 'CONTOSO-PC014'), entry('a', 'CONTOSO-PC001'), entry('C', 'CONTOSO-IP015')],
      'A',
    );
    expect(result.map((d) => d.deviceName)).toEqual(['CONTOSO-IP015', 'CONTOSO-PC014']);
    expect(result[0]).toMatchObject({ operatingSystem: 'iOS', complianceState: 'compliant' });
  });
});

describe('mapHealthAttestation', () => {
  it('übernimmt die dokumentierten String-Felder unverändert (getrimmt, leer → null)', () => {
    const info = mapHealthAttestation({
      id: PC001_ID,
      deviceHealthAttestationState: {
        lastUpdateDateTime: ' 2026-10-14T06:00:00Z ',
        secureBoot: 'enabled',
        bitLockerStatus: '',
        tpmVersion: '2.0',
        healthStatusMismatchInfo: '   ',
      },
    });
    expect(info.lastUpdateDateTime).toBe('2026-10-14T06:00:00Z');
    expect(info.secureBoot).toBe('enabled');
    expect(info.bitLockerStatus).toBeNull();
    expect(info.tpmVersion).toBe('2.0');
    expect(info.healthStatusMismatchInfo).toBeNull();
    expect(info.codeIntegrity).toBeNull();
  });

  it('fehlender Block oder null → alle Felder null, nie ein Fehler', () => {
    for (const dto of [undefined, null, { id: 'x' }, { deviceHealthAttestationState: null }]) {
      expect(Object.values(mapHealthAttestation(dto)).every((v) => v === null)).toBe(true);
    }
  });

  it('übernimmt weder virtualSecureMode noch andere nicht modellierte Felder', () => {
    const info = mapHealthAttestation({
      deviceHealthAttestationState: {
        virtualSecureMode: 'enabled',
        pcr0: 'abc',
      } as never,
    });
    expect(info).not.toHaveProperty('virtualSecureMode');
    expect(info).not.toHaveProperty('pcr0');
  });
});

describe('mapDuplicateDevices (M14/S1)', () => {
  const device = { azureADDeviceId: PC001_ENTRA_ID, osFamily: 'windows' as const };
  const hybrid = {
    ...pc001Entra(),
    id: 'obj-hybrid',
    deviceId: PC001_ENTRA_ID.toUpperCase(),
    trustType: 'ServerAd' as const,
    registrationDateTime: '2026-03-01T08:00:00Z',
  };
  const registered = {
    ...pc001Entra(),
    id: 'obj-registered',
    deviceId: '00000000-0000-4000-9000-0000000000aa',
    trustType: 'Workplace' as const,
    registrationDateTime: '2026-09-01T08:00:00Z',
    profileType: 'RegisteredDevice',
  };

  it('markiert das aktuelle Objekt (Groß-/Kleinschreibung egal) und stellt es voran', () => {
    const info = mapDuplicateDevices([registered, hybrid], device, false);
    expect(info.devices.map((d) => [d.objectId, d.isCurrent])).toEqual([
      ['obj-hybrid', true],
      ['obj-registered', false],
    ]);
    expect(info.moreAvailable).toBe(false);
  });

  it('sortiert übrige Objekte nach Registrierung, neueste zuerst', () => {
    const older = { ...registered, id: 'obj-old', registrationDateTime: '2025-01-01T00:00:00Z' };
    const info = mapDuplicateDevices([older, registered, hybrid], device, true);
    expect(info.devices.map((d) => d.objectId)).toEqual([
      'obj-hybrid',
      'obj-registered',
      'obj-old',
    ]);
    expect(info.moreAvailable).toBe(true);
  });

  it('wertet anderes Betriebssystem als differentOs, unbekanntes Betriebssystem nicht', () => {
    const mac = { ...registered, id: 'obj-mac', operatingSystem: 'MacMDM' };
    const unknownOs = { ...registered, id: 'obj-unknown', operatingSystem: null };
    const info = mapDuplicateDevices([hybrid, mac, unknownOs], device, false);
    const byId = Object.fromEntries(info.devices.map((d) => [d.objectId, d.differentOs]));
    expect(byId).toEqual({ 'obj-hybrid': false, 'obj-mac': true, 'obj-unknown': false });
  });

  it('übernimmt nur Whitelist-Felder – nie physicalIds oder deviceMetadata', () => {
    const raw = {
      ...hybrid,
      physicalIds: ['[HWID]:h:123'],
      deviceMetadata: 'geheim',
    } as typeof hybrid;
    const json = JSON.stringify(mapDuplicateDevices([raw], device, false));
    expect(json).not.toContain('physicalIds');
    expect(json).not.toContain('deviceMetadata');
    expect(json).not.toContain('HWID');
    expect(json).not.toContain('geheim');
  });

  it('unbekannte trustType-Werte werden null; ohne azureADDeviceId ist kein Objekt aktuell', () => {
    const odd = { ...hybrid, trustType: 'Other' as never };
    const info = mapDuplicateDevices([odd], { ...device, azureADDeviceId: null }, false);
    expect(info.devices[0]).toMatchObject({ trustType: null, isCurrent: false });
  });
});

describe('Zuweisungen (M14/S2)', () => {
  it.each([
    ['#microsoft.graph.allDevicesAssignmentTarget', { kind: 'allDevices' }],
    ['microsoft.graph.allDevicesAssignmentTarget', { kind: 'allDevices' }],
    ['#microsoft.graph.allLicensedUsersAssignmentTarget', { kind: 'allUsers' }],
    ['microsoft.graph.allLicensedUsersAssignmentTarget', { kind: 'allUsers' }],
  ])('Ziel %s → %j (mit und ohne führendes #)', (odataType, expected) => {
    expect(mapAssignmentTarget({ '@odata.type': odataType })).toEqual(expected);
  });

  it('Gruppenziele tragen die groupId; Ausschlussgruppe ist eigener Typ', () => {
    expect(
      mapAssignmentTarget({
        '@odata.type': '#microsoft.graph.groupAssignmentTarget',
        groupId: 'g-1',
      }),
    ).toEqual({ kind: 'group', groupId: 'g-1' });
    expect(
      mapAssignmentTarget({
        '@odata.type': '#microsoft.graph.exclusionGroupAssignmentTarget',
        groupId: 'g-2',
      }),
    ).toEqual({ kind: 'exclusionGroup', groupId: 'g-2' });
  });

  it('unbekannte Zieltypen und Gruppenziele ohne groupId bleiben „unknown“ (keine Deutung)', () => {
    expect(
      mapAssignmentTarget({
        '@odata.type': 'microsoft.graph.scopeTagGroupAssignmentTarget',
        groupId: null,
      }),
    ).toEqual({ kind: 'unknown', odataType: 'microsoft.graph.scopeTagGroupAssignmentTarget' });
    expect(
      mapAssignmentTarget({ '@odata.type': '#microsoft.graph.groupAssignmentTarget' }),
    ).toEqual({ kind: 'unknown', odataType: 'microsoft.graph.groupAssignmentTarget' });
    expect(mapAssignmentTarget(undefined)).toEqual({ kind: 'unknown', odataType: null });
  });

  it('mapAssignments übernimmt nur dokumentierte intent-Werte und überlebt Müll', () => {
    const result = mapAssignments([
      {
        intent: 'required',
        target: { '@odata.type': '#microsoft.graph.allDevicesAssignmentTarget' },
      },
      { intent: 'bogus' as never, target: null },
      null as never,
    ]);
    expect(result).toEqual([
      { target: { kind: 'allDevices' }, intent: 'required' },
      { target: { kind: 'unknown', odataType: null }, intent: null },
    ]);
    expect(mapAssignments(null)).toEqual([]);
    expect(mapAssignments(undefined)).toEqual([]);
  });

  it('isGuid akzeptiert GUIDs, aber keine zusammengesetzten oder Kurz-IDs', () => {
    expect(isGuid('00000000-0000-4000-b000-000000000015')).toBe(true);
    expect(isGuid(' 00000000-0000-4000-B000-000000000015 ')).toBe(true);
    expect(
      isGuid('00000000-0000-4000-b000-000000000015_00000000-0000-4000-8000-000000000001'),
    ).toBe(false);
    expect(isGuid('c-1')).toBe(false);
    expect(isGuid('')).toBe(false);
  });
});

describe('Lizenz des Benutzers (M14/S3)', () => {
  const plan = (servicePlanId: string, provisioningStatus: string, servicePlanName = 'X') => ({
    servicePlanId,
    servicePlanName,
    provisioningStatus: provisioningStatus as 'Success',
    appliesTo: 'User',
  });

  it('übernimmt nur die Intune-Serviceplans (INTUNE_A, INTUNE_A_VL, INTUNE_EDU, INTUNE_O365) – Match über die Plan-ID', () => {
    const info = mapUserLicense([
      {
        skuId: 'sku-1',
        skuPartNumber: 'SPE_E3',
        servicePlans: [
          plan('C1EC4A95-1F05-45B3-A911-AA3FA01094F5', 'Success', 'INTUNE_A'),
          plan('8e0c0a52-6a6c-4d40-8370-dd62790dcd70', 'Success', 'THREAT_INTELLIGENCE'),
          plan('882e1d05-acd1-4ccb-8708-6ee03664b117', 'PendingActivation'),
        ],
      },
      {
        skuId: 'sku-2',
        skuPartNumber: 'EDU',
        servicePlans: [
          plan('3e170737-c728-4eae-bbb9-3f3360f7184c', 'Disabled'),
          plan('da24caf9-af8e-485c-b7c8-e73336da2693', 'Error'),
        ],
      },
    ]);
    expect(info.licenseCount).toBe(2);
    expect(info.plans).toEqual([
      { plan: 'INTUNE_A', skuPartNumber: 'SPE_E3', provisioningStatus: 'Success' },
      { plan: 'INTUNE_O365', skuPartNumber: 'SPE_E3', provisioningStatus: 'PendingActivation' },
      { plan: 'INTUNE_A_VL', skuPartNumber: 'EDU', provisioningStatus: 'Disabled' },
      { plan: 'INTUNE_EDU', skuPartNumber: 'EDU', provisioningStatus: 'Error' },
    ]);
  });

  it('ein Plan mit passendem Namen, aber fremder ID zählt nicht; Müll und leere Listen sind sicher', () => {
    expect(
      mapUserLicense([
        {
          skuId: 's',
          skuPartNumber: 'X',
          servicePlans: [plan('not-a-known-id', 'Success', 'INTUNE_A')],
        },
      ]).plans,
    ).toEqual([]);
    expect(mapUserLicense(null)).toEqual({ plans: [], licenseCount: 0 });
    expect(mapUserLicense([{ skuId: null, skuPartNumber: null, servicePlans: null }])).toEqual({
      plans: [],
      licenseCount: 1,
    });
    expect(
      mapUserLicense([
        {
          skuId: 's',
          skuPartNumber: 'X',
          servicePlans: [plan('c1ec4a95-1f05-45b3-a911-aa3fa01094f5', 'Bogus')],
        },
      ]).plans[0]!.provisioningStatus,
    ).toBeNull();
  });

  it('das Ergebnis enthält keine Benutzer- oder Lizenz-IDs (Datensparsamkeit)', () => {
    const json = JSON.stringify(
      mapUserLicense([
        {
          id: 'detail-id-123',
          skuId: 'sku-id-456',
          skuPartNumber: 'SPE_E3',
          servicePlans: [plan('c1ec4a95-1f05-45b3-a911-aa3fa01094f5', 'Success')],
        },
      ]),
    );
    expect(json).not.toContain('detail-id-123');
    expect(json).not.toContain('sku-id-456');
  });
});

describe('Gerätelimit (M14/S3)', () => {
  const group = (groupId: string) => ({
    target: { '@odata.type': '#microsoft.graph.groupAssignmentTarget', groupId },
  });

  it('erkennt Limit-Konfigurationen am @odata.type (mit/ohne #), sortiert nach Priorität und mappt die Ziele', () => {
    const result = mapEnrollmentLimits(
      [
        {
          '@odata.type': '#microsoft.graph.deviceEnrollmentLimitConfiguration',
          id: 'b',
          displayName: 'Standard',
          priority: 2,
          limit: 5,
        },
        {
          '@odata.type': '#microsoft.graph.deviceEnrollmentPlatformRestrictionsConfiguration',
          id: 'x',
          displayName: 'Plattformen',
          priority: 1,
        },
        {
          '@odata.type': 'microsoft.graph.deviceEnrollmentLimitConfiguration',
          id: 'a',
          displayName: 'Pilot',
          priority: 1,
          limit: 15,
        },
      ],
      new Map([['a', [group('g-1')]]]),
    );
    expect(result.map((c) => [c.id, c.priority, c.limit])).toEqual([
      ['a', 1, 15],
      ['b', 2, 5],
    ]);
    expect(result[0]!.targets).toEqual([{ kind: 'group', groupId: 'g-1' }]);
    // keine Zuweisungsantwort → Ziele unbekannt (null), nicht „keine“
    expect(result[1]!.targets).toBeNull();
  });

  it('fehlendes limit/priority → null; leere Namen fallen auf die ID zurück; Müll ist sicher', () => {
    const [config] = mapEnrollmentLimits(
      [
        {
          '@odata.type': '#microsoft.graph.deviceEnrollmentLimitConfiguration',
          id: 'c',
          displayName: ' ',
          priority: null,
        },
      ],
      new Map(),
    );
    expect(config).toMatchObject({ id: 'c', displayName: 'c', priority: null, limit: null });
    expect(mapEnrollmentLimits(null, new Map())).toEqual([]);
  });
});

describe('mapSecurityAlerts (M14/S4)', () => {
  const DEVICE = {
    azureAdDeviceId: '11111111-2222-3333-4444-555555555555',
    deviceName: 'CONTOSO-PC042',
  };
  const evidence = (extra: object = {}) => ({
    '@odata.type': '#microsoft.graph.security.deviceEvidence',
    azureAdDeviceId: DEVICE.azureAdDeviceId,
    riskScore: 'high',
    defenderAvStatus: 'updated',
    ...extra,
  });
  const alert = (id: string, extra: Partial<GraphSecurityAlert> = {}): GraphSecurityAlert => ({
    id,
    title: `Titel ${id}`,
    severity: 'medium',
    status: 'new',
    createdDateTime: '2026-11-09T08:00:00Z',
    lastUpdateDateTime: '2026-11-09T09:00:00Z',
    categories: ['Execution'],
    alertWebUrl: `https://security.microsoft.com/alerts/${id}`,
    evidence: [evidence()],
    ...extra,
  });

  it('ordnet über die Entra-Geräte-ID zu (ohne Beachtung der Groß-/Kleinschreibung) und mappt die Whitelist', () => {
    const info = mapSecurityAlerts(
      [
        alert('a1', {
          evidence: [evidence({ azureAdDeviceId: DEVICE.azureAdDeviceId.toUpperCase() })],
        }),
      ],
      DEVICE,
      { moreAvailable: false },
    );
    expect(info.evaluated).toBe(1);
    expect(info.resolvedCount).toBe(0);
    expect(info.alerts).toEqual([
      {
        id: 'a1',
        title: 'Titel a1',
        severity: 'medium',
        status: 'new',
        createdDateTime: '2026-11-09T08:00:00Z',
        lastUpdateDateTime: '2026-11-09T09:00:00Z',
        categories: ['Execution'],
        alertWebUrl: 'https://security.microsoft.com/alerts/a1',
        matchedBy: 'azureAdDeviceId',
        deviceRiskScore: 'high',
        defenderAvStatus: 'updated',
      },
    ]);
  });

  it('ein anderes Gerät mit gleichem Namen passt nicht, wenn beide Seiten eine Geräte-ID haben', () => {
    const other = alert('a2', {
      evidence: [
        evidence({
          azureAdDeviceId: '99999999-2222-3333-4444-555555555555',
          hostName: 'CONTOSO-PC042',
        }),
      ],
    });
    expect(mapSecurityAlerts([other], DEVICE, { moreAvailable: false }).alerts).toEqual([]);
  });

  it('ohne Geräte-ID in der Evidenz zählt der Name (hostName oder deviceDnsName vor dem ersten Punkt, ohne Groß-/Kleinschreibung)', () => {
    const byHost = alert('h', {
      evidence: [evidence({ azureAdDeviceId: null, hostName: 'contoso-pc042' })],
    });
    const byDns = alert('d', {
      evidence: [
        evidence({ azureAdDeviceId: null, deviceDnsName: 'Contoso-PC042.corp.contoso.com' }),
      ],
    });
    const wrong = alert('w', {
      evidence: [evidence({ azureAdDeviceId: null, hostName: 'CONTOSO-PC043' })],
    });
    const info = mapSecurityAlerts([byHost, byDns, wrong], DEVICE, { moreAvailable: false });
    expect(info.alerts.map((a) => [a.id, a.matchedBy]).sort()).toEqual([
      ['d', 'deviceName'],
      ['h', 'deviceName'],
    ]);
  });

  it('ohne Geräte-ID am Gerät entscheidet der Name; nicht-Geräte-Evidenz wird ignoriert', () => {
    const noId = { azureAdDeviceId: null, deviceName: 'CONTOSO-PC042' };
    const fileOnly = alert('f', {
      evidence: [
        { '@odata.type': '#microsoft.graph.security.fileEvidence', hostName: 'CONTOSO-PC042' },
      ],
    });
    const named = alert('n', {
      evidence: [evidence({ azureAdDeviceId: 'x', hostName: 'CONTOSO-PC042' })],
    });
    expect(
      mapSecurityAlerts([fileOnly, named], noId, { moreAvailable: false }).alerts.map((a) => a.id),
    ).toEqual(['n']);
  });

  it('blendet behobene Warnungen aus (zählt sie), dedupliziert IDs und sortiert neueste zuerst', () => {
    const info = mapSecurityAlerts(
      [
        alert('old', { createdDateTime: '2026-11-01T00:00:00Z' }),
        alert('done', { status: 'resolved' }),
        alert('new', { createdDateTime: '2026-11-09T10:00:00Z' }),
        alert('new', { createdDateTime: '2026-11-09T10:00:00Z' }),
      ],
      DEVICE,
      { moreAvailable: true },
    );
    expect(info.alerts.map((a) => a.id)).toEqual(['new', 'old']);
    expect(info.resolvedCount).toBe(1);
    expect(info.evaluated).toBe(4);
    expect(info.moreAvailable).toBe(true);
  });

  it('unbekannte Enum-Werte werden zu unknown bzw. null; fehlende Felder sind unkritisch', () => {
    const info = mapSecurityAlerts(
      [
        {
          id: 'u',
          severity: 'unknownFutureValue',
          status: 'unknownFutureValue',
          evidence: [evidence({ riskScore: 'bogus', defenderAvStatus: 'bogus' })],
        } as never,
        null as never,
        { title: 'ohne ID', evidence: [evidence()] } as never,
      ],
      DEVICE,
      { moreAvailable: false },
    );
    expect(info.alerts).toHaveLength(1);
    expect(info.alerts[0]).toMatchObject({
      id: 'u',
      title: null,
      severity: 'unknown',
      status: 'unknown',
      categories: [],
      alertWebUrl: null,
      deviceRiskScore: null,
      defenderAvStatus: null,
    });
    expect(mapSecurityAlerts(null, DEVICE, { moreAvailable: false }).alerts).toEqual([]);
  });

  it('übernimmt keine Personen- oder Netzwerkdaten (loggedOnUsers, ipInterfaces, assignedTo, Kommentare, Benutzer-Evidenz)', () => {
    const personal = {
      ...alert('p'),
      assignedTo: 'max.mustermann@contoso.com',
      comments: [{ comment: 'Rückruf bei Max Mustermann', createdByDisplayName: 'Erika Beispiel' }],
      description: 'Beschreibung mit Max Mustermann',
      evidence: [
        evidence({
          loggedOnUsers: [{ accountName: 'mmustermann', domainName: 'CONTOSO' }],
          ipInterfaces: ['10.20.30.40'],
          deviceDnsName: 'contoso-pc042.corp.contoso.com',
          tags: ['VIP'],
        }),
        {
          '@odata.type': '#microsoft.graph.security.userEvidence',
          userAccount: {
            userPrincipalName: 'max.mustermann@contoso.com',
            displayName: 'Max Mustermann',
          },
        },
      ],
    };
    const json = JSON.stringify(mapSecurityAlerts([personal], DEVICE, { moreAvailable: false }));
    for (const forbidden of [
      'max.mustermann',
      'Mustermann',
      'mmustermann',
      'Erika',
      '10.20.30.40',
      'loggedOnUsers',
      'ipInterfaces',
      'assignedTo',
      'comment',
      'userAccount',
      'VIP',
      'corp.contoso.com',
      'description',
    ]) {
      expect(json, forbidden).not.toContain(forbidden);
    }
  });
});

describe('safeAlertWebUrl (M14/S4)', () => {
  it('erlaubt nur https auf Microsoft-Domains', () => {
    expect(safeAlertWebUrl('https://security.microsoft.com/alerts/x?tid=abc')).toBe(
      'https://security.microsoft.com/alerts/x?tid=abc',
    );
    expect(safeAlertWebUrl('https://security.microsoft.us/alerts/x')).not.toBeNull();
    for (const bad of [
      'http://security.microsoft.com/alerts/x',
      'javascript:alert(1)',
      'https://evil.example.com/alerts/x',
      'https://security.microsoft.com.evil.example/alerts/x',
      'https://notmicrosoft.com/x',
      '',
      '   ',
      null,
      undefined,
      42,
    ]) {
      expect(safeAlertWebUrl(bad), String(bad)).toBeNull();
    }
  });
});

describe('mapVppTokens (M14/S5)', () => {
  const SECRET_TOKEN = 'sTOKEN-GEHEIM-0123456789abcdef';
  const APPLE_ID = 'vpp-admin@contoso.com';
  const dto = (id: string, extra: Record<string, unknown> = {}): GraphVppToken =>
    ({
      id,
      organizationName: `Contoso ${id}`,
      vppTokenAccountType: 'business',
      expirationDateTime: '2026-12-01T00:00:00Z',
      lastSyncDateTime: '2026-11-09T08:00:00Z',
      state: 'valid',
      lastSyncStatus: 'completed',
      countryOrRegion: 'DE',
      lastAppCount: 12,
      // Felder, die die Graph-Antwort mitliefert, die aber nie gelesen werden dürfen
      token: SECRET_TOKEN,
      appleId: APPLE_ID,
      lastModifiedDateTime: '2026-11-01T00:00:00Z',
      automaticallyUpdateApps: true,
      ...extra,
    }) as GraphVppToken;

  it('mappt die Whitelist; frühester Ablauf zuerst, ohne Ablaufdatum zuletzt', () => {
    const result = mapVppTokens([
      dto('late', { expirationDateTime: '2027-03-01T00:00:00Z' }),
      dto('none', { expirationDateTime: null }),
      dto('soon', { expirationDateTime: '2026-11-20T00:00:00Z' }),
    ]);
    expect(result.map((t) => t.id)).toEqual(['soon', 'late', 'none']);
    expect(result[0]).toEqual({
      id: 'soon',
      organizationName: 'Contoso soon',
      accountType: 'business',
      expirationDateTime: '2026-11-20T00:00:00Z',
      lastSyncDateTime: '2026-11-09T08:00:00Z',
      state: 'valid',
      lastSyncStatus: 'completed',
      countryOrRegion: 'DE',
      lastAppCount: 12,
    });
  });

  it('das gemappte Ergebnis enthält weder token noch appleId (Schlüssel und Werte)', () => {
    const json = JSON.stringify(mapVppTokens([dto('a'), dto('b')]));
    for (const forbidden of [SECRET_TOKEN, APPLE_ID, 'token', 'appleId', 'vpp-admin']) {
      expect(json, forbidden).not.toContain(forbidden);
    }
  });

  it('unbekannte Enum-Werte werden zu null, Einträge ohne ID entfallen, Nicht-Listen sind leer', () => {
    const result = mapVppTokens([
      dto('x', { state: 'bogus', lastSyncStatus: 'bogus', vppTokenAccountType: 'bogus' }),
      { organizationName: 'ohne ID' } as never,
      null as never,
      dto('y', { expirationDateTime: '0001-01-01T00:00:00Z', organizationName: '   ' }),
    ]);
    expect(result.map((t) => t.id).sort()).toEqual(['x', 'y']);
    expect(result.find((t) => t.id === 'x')).toMatchObject({
      state: null,
      lastSyncStatus: null,
      accountType: null,
    });
    expect(result.find((t) => t.id === 'y')).toMatchObject({
      expirationDateTime: null,
      organizationName: null,
    });
    expect(mapVppTokens(null)).toEqual([]);
    expect(mapVppTokens(undefined)).toEqual([]);
  });
});
