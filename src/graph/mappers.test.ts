import { describe, expect, it } from 'vitest';
import {
  bitlockerKey,
  malware,
  pc001Device,
  pc001Entra,
  pc001Protection,
  policyState,
} from '../providers/graph/fakeGraph';
import type { GraphManagedDevice, GraphWindowsProtectionState } from './dto';
import {
  graphSource,
  mapBitlockerKey,
  mapDetectedMalware,
  mapEntraDevice,
  mapManagedDevice,
  mapPolicyState,
  mapSearchResult,
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
