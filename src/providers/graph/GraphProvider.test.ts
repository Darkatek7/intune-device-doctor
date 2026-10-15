import { describe, expect, it, vi } from 'vitest';
import type { ManagedDeviceInfo, SectionResult } from '../../domain/types';
import type { SleepFn } from '../../graph/client';
import { Endpoints } from '../../graph/endpoints';
import { de } from '../../i18n/de';
import { ProviderError } from '../DeviceDataProvider';
import { createGraphProvider } from './GraphProvider';
import {
  bitlockerKey,
  collection,
  contosoHandler,
  createFakeFetch,
  graphError,
  jsonResponse,
  MAC07_ID,
  malware,
  PC001_ENTRA_ID,
  PC001_ID,
  pc001Device,
  type FakeHandler,
} from './fakeGraph';

function setup(handler: FakeHandler = contosoHandler()) {
  const fake = createFakeFetch(handler);
  const sleep = vi.fn<SleepFn>(async () => undefined);
  const log = vi.fn();
  const provider = createGraphProvider(async () => 'token', {
    fetchImpl: fake.fetchImpl,
    sleep,
    log,
    now: () => new Date('2026-10-15T12:00:00Z'),
  });
  return { ...fake, sleep, log, provider };
}

const windowsDevice = (overrides: Partial<ManagedDeviceInfo> = {}): ManagedDeviceInfo =>
  ({
    id: PC001_ID,
    deviceName: 'CONTOSO-PC001',
    osFamily: 'windows',
    azureADDeviceId: PC001_ENTRA_ID,
    ...overrides,
  }) as ManagedDeviceInfo;

function expectStatus<T, S extends SectionResult<T>['status']>(
  result: SectionResult<T>,
  status: S,
): Extract<SectionResult<T>, { status: S }> {
  expect(result.status).toBe(status);
  return result as Extract<SectionResult<T>, { status: S }>;
}

describe('GraphProvider – read-only', () => {
  it('sendet bei einer kompletten Snapshot-Ladung ausschließlich GET an graph.microsoft.com', async () => {
    const { provider, calls } = setup();
    const [hit] = await provider.searchDevices('CONTOSO-PC001');
    const device = await provider.getDevice(hit!.id);
    await Promise.all([
      provider.getProtectionState(device),
      provider.getCompliancePolicyStates(device),
      provider.getConfigurationPolicyStates(device),
      provider.getEntraDevice(device),
      provider.getBitLockerKeys(device),
    ]);
    await provider.searchDevices('nichts-da');
    expect(calls.length).toBeGreaterThanOrEqual(9);
    for (const call of calls) {
      expect(call.method).toBe('GET');
      expect(call.parsed.protocol).toBe('https:');
      expect(call.parsed.host).toBe('graph.microsoft.com');
      expect(call.url).not.toMatch(/\$select=[^&]*\bkey\b/);
    }
  });

  it('hat mode live', () => {
    expect(setup().provider.mode).toBe('live');
  });
});

describe('GraphProvider – Suche', () => {
  it('escaped einfache Hochkommas im OData-Filter und encodiert die URL', async () => {
    const { provider, calls } = setup();
    await provider.searchDevices("O'Brien-PC");
    const first = calls[0]!;
    expect(first.parsed.searchParams.get('$filter')).toBe("deviceName eq 'O''Brien-PC'");
    expect(first.url).toBe(
      `https://graph.microsoft.com/v1.0${Endpoints.managedDevicesByName.path("O'Brien-PC")}`,
    );
    expect(first.url).not.toContain(' ');
    expect(first.url).toContain('deviceName%20eq%20');
  });

  it('findet zuerst exakt, sonst per contains', async () => {
    const { provider, calls } = setup();
    const exact = await provider.searchDevices('contoso-pc001');
    expect(exact.map((d) => d.deviceName)).toEqual(['CONTOSO-PC001']);
    expect(calls).toHaveLength(1);

    const partial = await provider.searchDevices('PC001');
    expect(partial.map((d) => d.deviceName)).toEqual(['CONTOSO-PC001']);
    expect(calls.slice(1).map((c) => c.parsed.searchParams.get('$filter'))).toEqual([
      "deviceName eq 'PC001'",
      "contains(deviceName,'PC001')",
    ]);
  });

  it('liefert für leere Eingabe eine leere Liste ohne Request', async () => {
    const { provider, calls } = setup();
    await expect(provider.searchDevices('   ')).resolves.toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('fällt bei HTTP 400 auf contains auf die paginierte Geräteliste zurück und loggt einen Hinweis', async () => {
    const page2 = 'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$skiptoken=2';
    const { provider, calls, log } = setup((call) => {
      if (call.parsed.searchParams.get('$filter')?.startsWith('contains')) {
        return graphError(400, 'BadRequest');
      }
      if (call.parsed.searchParams.get('$filter')) return collection([]);
      if (!call.parsed.searchParams.get('$skiptoken')) {
        return collection([pc001Device({ deviceName: 'CONTOSO-AAA' })], page2);
      }
      return collection([
        pc001Device({ id: 'zzz', deviceName: 'Contoso-LT108' }),
        pc001Device({ id: 'q', deviceName: null }),
      ]);
    });
    const hits = await provider.searchDevices('lt108');
    expect(hits.map((d) => d.deviceName)).toEqual(['Contoso-LT108']);
    expect(log).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.method)).toEqual(['GET', 'GET', 'GET', 'GET']);
    expect(calls[2]!.parsed.searchParams.get('$select')).toBe(
      new URL(`https://x${Endpoints.managedDevicesList.path()}`).searchParams.get('$select'),
    );
  });

  it('beschränkt den Fallback auf 5 Seiten', async () => {
    const { provider, calls } = setup((call) => {
      const filter = call.parsed.searchParams.get('$filter');
      if (filter?.startsWith('contains')) return graphError(400, 'BadRequest');
      if (filter) return collection([]);
      return collection(
        [],
        'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$skiptoken=n',
      );
    });
    await expect(provider.searchDevices('x')).resolves.toEqual([]);
    expect(calls.filter((c) => !c.parsed.searchParams.get('$filter'))).toHaveLength(5);
  });

  it('wirft ProviderError bei 403 und reicht Abort durch', async () => {
    const { provider } = setup(() => graphError(403, 'Authorization_RequestDenied'));
    const error = await provider.searchDevices('x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).error).toMatchObject({
      code: 'forbidden',
      requiredScope: Endpoints.managedDevicesByName.scope,
    });

    const controller = new AbortController();
    controller.abort();
    await expect(
      setup().provider.searchDevices('x', { signal: controller.signal }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

describe('GraphProvider – getDevice', () => {
  it('mappt das Gerät mit Quelle', async () => {
    const device = await setup().provider.getDevice(PC001_ID);
    expect(device).toMatchObject({ deviceName: 'CONTOSO-PC001', osFamily: 'windows' });
    expect(device.source).toMatchObject({ kind: 'graph', label: Endpoints.managedDevice.display });
  });

  it('wirft ProviderError notFound bei 404', async () => {
    const error = await setup()
      .provider.getDevice('unbekannt')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).error).toMatchObject({
      code: 'notFound',
      message: de.errors.deviceNotFound,
    });
  });
});

describe('GraphProvider – Sections', () => {
  it('liefert ok-Sections mit source und fetchedAt', async () => {
    const { provider } = setup();
    const device = windowsDevice();
    const protection = expectStatus(await provider.getProtectionState(device), 'ok');
    expect(protection.source).toMatchObject({
      kind: 'graph',
      label: Endpoints.windowsProtectionState.display,
      docsUrl: Endpoints.windowsProtectionState.docsUrl,
    });
    expect(protection.fetchedAt).toBe('2026-10-15T12:00:00.000Z');
    const compliance = expectStatus(await provider.getCompliancePolicyStates(device), 'ok');
    expect(compliance.data[0]?.kind).toBe('compliance');
    const config = expectStatus(await provider.getConfigurationPolicyStates(device), 'ok');
    expect(config.data[0]?.kind).toBe('configuration');
  });

  it('403 → forbidden mit requiredScope aus der Endpoint-Definition', async () => {
    const forbidden = () => graphError(403, 'Authorization_RequestDenied');
    const { provider } = setup(
      contosoHandler({
        overrides: {
          '/deviceConfigurationStates': forbidden,
          '/recoveryKeys': forbidden,
          '/v1.0/devices': forbidden,
        },
      }),
    );
    const device = windowsDevice();
    const config = expectStatus(await provider.getConfigurationPolicyStates(device), 'forbidden');
    expect(config.error.requiredScope).toBe('DeviceManagementConfiguration.Read.All');
    const bitlocker = expectStatus(await provider.getBitLockerKeys(device), 'forbidden');
    expect(bitlocker.error.requiredScope).toBe('BitlockerKey.ReadBasic.All');
    expect(bitlocker.source.label).toBe(Endpoints.bitlockerRecoveryKeys.display);
    const entra = expectStatus(await provider.getEntraDevice(device), 'forbidden');
    expect(entra.error).toMatchObject({ requiredScope: 'Device.Read.All', httpStatus: 403 });
  });

  it('429 mit Retry-After: 2 wartet 2 s und wiederholt', async () => {
    let n = 0;
    const { provider, sleep, calls } = setup(
      contosoHandler({
        overrides: {
          '/deviceCompliancePolicyStates': () =>
            ++n === 1 ? graphError(429, 'TooManyRequests', { 'Retry-After': '2' }) : collection([]),
        },
      }),
    );
    const result = expectStatus(await provider.getCompliancePolicyStates(windowsDevice()), 'ok');
    expect(result.data).toEqual([]);
    expect(sleep).toHaveBeenCalledWith(2000, undefined);
    expect(calls).toHaveLength(2);
  });

  it('503 ohne Header nutzt Backoff; nach ausgeschöpften Versuchen → error mit code throttled', async () => {
    const { provider, sleep, calls } = setup(
      contosoHandler({
        overrides: { '/deviceConfigurationStates': () => graphError(503, 'Unavailable') },
      }),
    );
    const result = expectStatus(
      await provider.getConfigurationPolicyStates(windowsDevice()),
      'error',
    );
    expect(result.error.code).toBe('throttled');
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
    expect(calls).toHaveLength(3);
  });

  it('Defender: 404 → unavailable (defenderNotReported)', async () => {
    const { provider } = setup(
      contosoHandler({
        overrides: { '/windowsProtectionState': () => graphError(404, 'NotFound') },
      }),
    );
    const result = expectStatus(await provider.getProtectionState(windowsDevice()), 'unavailable');
    expect(result.reason).toBe(de.reasons.defenderNotReported);
    expect(result.source.label).toBe(Endpoints.windowsProtectionState.display);
  });

  it('Defender: Fehler bei detectedMalwareState → leere Liste, Section bleibt ok', async () => {
    const { provider } = setup(
      contosoHandler({
        overrides: {
          '/detectedMalwareState': () => graphError(403, 'Authorization_RequestDenied'),
        },
      }),
    );
    const result = expectStatus(await provider.getProtectionState(windowsDevice()), 'ok');
    expect(result.data.detectedMalware).toEqual([]);
  });

  it('Defender: lädt erkannte Malware mit', async () => {
    const { provider } = setup(
      contosoHandler({ overrides: { '/detectedMalwareState': () => collection([malware()]) } }),
    );
    const result = expectStatus(await provider.getProtectionState(windowsDevice()), 'ok');
    expect(result.data.detectedMalware).toHaveLength(1);
  });

  it('Nicht-Windows: Defender und BitLocker notApplicable ohne Request', async () => {
    const { provider, calls } = setup();
    const mac = await provider.getDevice(MAC07_ID);
    expect(mac.osFamily).toBe('macos');
    const before = calls.length;
    const defender = expectStatus(await provider.getProtectionState(mac), 'notApplicable');
    expect(defender.reason).toBe(de.reasons.defenderNotWindows);
    const bitlocker = expectStatus(await provider.getBitLockerKeys(mac), 'notApplicable');
    expect(bitlocker.reason).toBe(de.reasons.bitlockerNotWindows);
    expect(calls).toHaveLength(before);
  });

  it('Ohne azureADDeviceId: Entra und BitLocker unavailable ohne Request', async () => {
    const { provider, calls } = setup();
    const device = windowsDevice({ azureADDeviceId: null });
    const entra = expectStatus(await provider.getEntraDevice(device), 'unavailable');
    expect(entra.reason).toBe(de.reasons.noAzureAdDeviceId);
    expectStatus(await provider.getBitLockerKeys(device), 'unavailable');
    expect(calls).toHaveLength(0);
  });

  it('Entra: leere value-Liste → ok mit data null', async () => {
    const { provider } = setup(
      contosoHandler({ overrides: { '/v1.0/devices': () => collection([]) } }),
    );
    const result = expectStatus(await provider.getEntraDevice(windowsDevice()), 'ok');
    expect(result.data).toBeNull();
  });

  it('BitLocker: pagt über nextLink, mappt volumeType und fragt nie key ab', async () => {
    const page2 =
      'https://graph.microsoft.com/v1.0/informationProtection/bitlocker/recoveryKeys?$skiptoken=2';
    const { provider, calls } = setup(
      contosoHandler({
        overrides: {
          '/recoveryKeys': (call) =>
            call.parsed.searchParams.get('$skiptoken')
              ? collection([bitlockerKey('k-2', 'fixedDataVolume')])
              : collection([bitlockerKey('k-1', 1)], page2),
        },
      }),
    );
    const result = expectStatus(await provider.getBitLockerKeys(windowsDevice()), 'ok');
    expect(result.data.map((k) => [k.id, k.volumeType])).toEqual([
      ['k-1', 'operatingSystemVolume'],
      ['k-2', 'fixedDataVolume'],
    ]);
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => !c.parsed.searchParams.has('$select'))).toBe(true);
  });

  it('Netzwerkfehler und unerwartete Antworten werden zu error, nie geworfen', async () => {
    const { provider } = setup(
      contosoHandler({
        overrides: { '/deviceConfigurationStates': () => jsonResponse({}, { status: 500 }) },
      }),
    );
    const result = expectStatus(
      await provider.getConfigurationPolicyStates(windowsDevice()),
      'error',
    );
    expect(result.error).toMatchObject({ code: 'graph', httpStatus: 500 });
  });

  it('reicht Abort bei Sections durch', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      setup().provider.getProtectionState(windowsDevice(), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
