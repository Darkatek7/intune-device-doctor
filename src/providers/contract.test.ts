/**
 * Provider-Vertragstest: dieselbe Suite läuft gegen MockProvider und GraphProvider (mit
 * Fake-Fetch, der für CONTOSO-PC001 / CONTOSO-MAC07 passende Graph-DTOs liefert). Beide müssen
 * dieselbe Snapshot-Form liefern: gleiche Sections, gleiche status-Werte, gleiche Schlüssel.
 */
import { describe, expect, it, vi } from 'vitest';
import type { DeviceSnapshot, ManagedDeviceInfo } from '../domain/types';
import { ProviderError, type DeviceDataProvider } from './DeviceDataProvider';
import { createFakeFetch, contosoHandler } from './graph/fakeGraph';
import { createGraphProvider } from './graph/GraphProvider';
import { MockProvider } from './mock/MockProvider';

const NOW = new Date('2026-10-15T12:00:00Z');

const factories: Array<[string, () => DeviceDataProvider]> = [
  ['MockProvider', () => new MockProvider({ latency: false, now: () => NOW })],
  [
    'GraphProvider (Fake-Fetch)',
    () =>
      createGraphProvider(async () => 'token', {
        fetchImpl: createFakeFetch(contosoHandler()).fetchImpl,
        sleep: vi.fn(async () => undefined),
        now: () => NOW,
        log: () => undefined,
      }),
  ],
];

const SECTION_KEYS = [
  'protection',
  'compliancePolicies',
  'configurationPolicies',
  'entraDevice',
  'bitlockerKeys',
] as const;

async function loadSnapshot(provider: DeviceDataProvider, name: string): Promise<DeviceSnapshot> {
  const [hit] = await provider.searchDevices(name);
  if (!hit) throw new Error(`${name} nicht gefunden`);
  const device = await provider.getDevice(hit.id);
  const [protection, compliancePolicies, configurationPolicies, entraDevice, bitlockerKeys] =
    await Promise.all([
      provider.getProtectionState(device),
      provider.getCompliancePolicyStates(device),
      provider.getConfigurationPolicyStates(device),
      provider.getEntraDevice(device),
      provider.getBitLockerKeys(device),
    ]);
  return {
    device,
    protection,
    compliancePolicies,
    configurationPolicies,
    entraDevice,
    bitlockerKeys,
  };
}

const sortedKeys = (value: object) => Object.keys(value).sort();

/** Gleiche Objektschlüssel rekursiv; leere Arrays gelten als Platzhalter. */
function sameShape(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === 0 || b.length === 0 || sameShape(a[0], b[0]);
  }
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
  if (isObj(a) && isObj(b)) {
    const ka = sortedKeys(a);
    const kb = sortedKeys(b);
    return ka.join() === kb.join() && ka.every((k) => sameShape(a[k], b[k]));
  }
  return !isObj(a) && !isObj(b) && Array.isArray(a) === Array.isArray(b);
}

describe.each(factories)('DeviceDataProvider-Vertrag: %s', (_name, create) => {
  it('sucht exakt und per Teilstring, leer bei keinem Treffer', async () => {
    const provider = create();
    const exact = await provider.searchDevices('CONTOSO-PC001');
    expect(exact).toHaveLength(1);
    expect(sortedKeys(exact[0]!)).toEqual(
      [
        'complianceState',
        'deviceName',
        'id',
        'lastSyncDateTime',
        'model',
        'operatingSystem',
        'osVersion',
        'userDisplayName',
        'userPrincipalName',
      ].sort(),
    );
    expect((await provider.searchDevices('pc001')).map((d) => d.deviceName)).toContain(
      'CONTOSO-PC001',
    );
    await expect(provider.searchDevices('DOES-NOT-EXIST-999')).resolves.toEqual([]);
    await expect(provider.searchDevices('')).resolves.toEqual([]);
  });

  it('liefert ein vollständiges ManagedDeviceInfo und wirft ProviderError notFound für unbekannte IDs', async () => {
    const provider = create();
    const snapshot = await loadSnapshot(provider, 'CONTOSO-PC001');
    const device: ManagedDeviceInfo = snapshot.device;
    expect(device.deviceName).toBe('CONTOSO-PC001');
    expect(device.osFamily).toBe('windows');
    expect(device.source.kind).toBe(provider.mode === 'demo' ? 'mock' : 'graph');
    expect(sortedKeys(device)).toEqual(
      [
        'azureADDeviceId',
        'complianceGracePeriodExpirationDateTime',
        'complianceState',
        'deviceEnrollmentType',
        'deviceName',
        'enrolledDateTime',
        'freeStorageSpaceInBytes',
        'id',
        'isEncrypted',
        'jailBroken',
        'lastSyncDateTime',
        'managementAgent',
        'manufacturer',
        'model',
        'operatingSystem',
        'osFamily',
        'osVersion',
        'partnerReportedThreatState',
        'serialNumber',
        'source',
        'totalStorageSpaceInBytes',
        'userDisplayName',
        'userPrincipalName',
      ].sort(),
    );

    const error = await provider
      .getDevice('00000000-0000-4000-8000-00000000ffff')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).error.code).toBe('notFound');
  });

  it('liefert für CONTOSO-PC001 alle fünf Sections als ok mit Quelle und Zeitstempel', async () => {
    const provider = create();
    const snapshot = await loadSnapshot(provider, 'CONTOSO-PC001');
    for (const key of SECTION_KEYS) {
      const section = snapshot[key];
      expect(section, key).toBeDefined();
      expect(section!.status, key).toBe('ok');
      expect(section!.source.label, key).toMatch(/^GET \//);
      expect(section!.source.docsUrl, key).toMatch(/^https:\/\/learn\.microsoft\.com\//);
      if (section!.status === 'ok')
        expect(Number.isNaN(Date.parse(section!.fetchedAt))).toBe(false);
    }

    const data = {
      protection: (snapshot.protection as { data: object }).data,
      compliance: (snapshot.compliancePolicies as { data: object[] }).data,
      configuration: (snapshot.configurationPolicies as { data: object[] }).data,
      entra: (snapshot.entraDevice as { data: object | null }).data,
      bitlocker: (snapshot.bitlockerKeys as { data: object[] }).data,
    };
    expect(sortedKeys(data.protection)).toEqual(
      [
        'antiMalwareVersion',
        'detectedMalware',
        'deviceState',
        'engineVersion',
        'fullScanOverdue',
        'fullScanRequired',
        'isVirtualMachine',
        'lastFullScanDateTime',
        'lastQuickScanDateTime',
        'lastReportedDateTime',
        'malwareProtectionEnabled',
        'networkInspectionSystemEnabled',
        'productStatus',
        'quickScanOverdue',
        'realTimeProtectionEnabled',
        'rebootRequired',
        'signatureUpdateOverdue',
        'signatureVersion',
        'tamperProtectionEnabled',
      ].sort(),
    );
    for (const list of [data.compliance, data.configuration]) {
      expect(list.length).toBeGreaterThan(0);
      expect(sortedKeys(list[0]!)).toEqual(
        [
          'displayName',
          'id',
          'kind',
          'platformType',
          'settingCount',
          'settings',
          'state',
          'version',
        ].sort(),
      );
    }
    expect((data.compliance[0] as { kind: string }).kind).toBe('compliance');
    expect((data.configuration[0] as { kind: string }).kind).toBe('configuration');
    expect(sortedKeys(data.entra!)).toEqual(
      [
        'accountEnabled',
        'approximateLastSignInDateTime',
        'deviceId',
        'displayName',
        'isCompliant',
        'isManaged',
        'objectId',
        'operatingSystemVersion',
        'registrationDateTime',
        'trustType',
      ].sort(),
    );
    expect(data.bitlocker.length).toBeGreaterThan(0);
    expect(sortedKeys(data.bitlocker[0]!)).toEqual(['createdDateTime', 'id', 'volumeType']);
  });

  it('markiert Defender und BitLocker für macOS (CONTOSO-MAC07) als notApplicable', async () => {
    const snapshot = await loadSnapshot(create(), 'CONTOSO-MAC07');
    expect(snapshot.device.osFamily).toBe('macos');
    expect(snapshot.protection?.status).toBe('notApplicable');
    expect(snapshot.bitlockerKeys?.status).toBe('notApplicable');
    expect(snapshot.compliancePolicies?.status).toBe('ok');
    expect(snapshot.configurationPolicies?.status).toBe('ok');
    expect(snapshot.entraDevice?.status).toBe('ok');
  });
});

describe('Mock und Graph liefern dieselbe Snapshot-Form', () => {
  it.each(['CONTOSO-PC001', 'CONTOSO-MAC07'])('%s', async (name) => {
    const [mock, graph] = await Promise.all(
      factories.map(([, create]) => loadSnapshot(create(), name)),
    );
    expect(sortedKeys(graph!)).toEqual(sortedKeys(mock!));
    expect(graph!.device.osFamily).toBe(mock!.device.osFamily);
    for (const key of SECTION_KEYS) {
      expect(graph![key]!.status, key).toBe(mock![key]!.status);
      const g = graph![key]!;
      const m = mock![key]!;
      if (g.status === 'ok' && m.status === 'ok') {
        expect(sameShape(g.data, m.data), `Form von ${key}`).toBe(true);
      }
      expect(sortedKeys(g.source)).toEqual(sortedKeys(m.source));
    }
    expect(sameShape(graph!.device, mock!.device)).toBe(true);
  });
});
