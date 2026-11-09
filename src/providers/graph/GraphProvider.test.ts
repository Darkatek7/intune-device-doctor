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
  PC001_USER_ID,
  pc001Device,
  pc001Entra,
  signInDto,
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

  it('sucht bei "@" per dokumentiertem eq-Filter auf userPrincipalName', async () => {
    const { provider, calls } = setup((call) => {
      const filter = call.parsed.searchParams.get('$filter');
      if (filter === "userPrincipalName eq 'ada@contoso.com'") {
        return collection([
          pc001Device({ userPrincipalName: 'ada@contoso.com' }),
          pc001Device({
            id: 'lt',
            deviceName: 'CONTOSO-LT042',
            userPrincipalName: 'ada@contoso.com',
          }),
        ]);
      }
      return collection([]);
    });
    const hits = await provider.searchDevices('ada@contoso.com');
    expect(hits.map((d) => d.deviceName)).toEqual(['CONTOSO-PC001', 'CONTOSO-LT042']);
    expect(calls).toHaveLength(1);
  });

  it('findet Geräte über den Anzeigenamen clientseitig, wenn kein Gerätename passt', async () => {
    const { provider, calls } = setup((call) => {
      if (call.parsed.searchParams.get('$filter')) return collection([]);
      return collection([
        pc001Device({ userDisplayName: 'Ada Admin' }),
        pc001Device({ id: 'b', deviceName: 'CONTOSO-PC002', userDisplayName: 'Bob Builder' }),
      ]);
    });
    const hits = await provider.searchDevices('ada');
    expect(hits.map((d) => d.deviceName)).toEqual(['CONTOSO-PC001']);
    expect(calls.map((c) => c.parsed.searchParams.get('$filter'))).toEqual([
      "deviceName eq 'ada'",
      "contains(deviceName,'ada')",
      null,
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

  it('Defender: Fehler bei detectedMalwareState → Section ok, Fehler wird ausgewiesen', async () => {
    const { provider } = setup(
      contosoHandler({
        overrides: {
          '/detectedMalwareState': () => graphError(403, 'Authorization_RequestDenied'),
        },
      }),
    );
    const result = expectStatus(await provider.getProtectionState(windowsDevice()), 'ok');
    expect(result.data.detectedMalware).toEqual([]);
    expect(result.data.detectedMalwareError?.code).toBe('forbidden');
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

describe('GraphProvider – App-Installationsstatus (beta)', () => {
  const USER_ID = '00000000-0000-4000-d000-000000000001';
  const detail = (
    applicationId: string,
    installState: string,
    mobileAppIntent = 'requiredInstall',
  ) => ({
    applicationId,
    displayName: `App ${applicationId}`,
    mobileAppIntent,
    displayVersion: '1.0',
    installState,
  });

  it('liest per GET aus /beta/users/{userId}/mobileAppIntentAndStates und filtert auf das Gerät', async () => {
    const { provider, calls } = setup(() =>
      collection([
        {
          id: 'a',
          managedDeviceIdentifier: PC001_ID.toUpperCase(),
          userId: USER_ID,
          mobileAppList: [
            detail('A1', 'installed'),
            detail('A2', 'failed'),
            detail('A2', 'failed'),
          ],
        },
        {
          id: 'b',
          managedDeviceIdentifier: 'anderes-geraet',
          userId: USER_ID,
          mobileAppList: [detail('X9', 'failed')],
        },
      ]),
    );
    const result = expectStatus(
      await provider.getAppInstallStates(windowsDevice({ userId: USER_ID })),
      'ok',
    );
    expect(result.data.map((a) => [a.appId, a.installState])).toEqual([
      ['A1', 'installed'],
      ['A2', 'failed'],
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method ?? 'GET').toBe('GET');
    expect(calls[0]!.url).toBe(
      `https://graph.microsoft.com/beta/users/${USER_ID}/mobileAppIntentAndStates`,
    );
    expect(result.source.label).toBe(Endpoints.mobileAppIntentAndStates.display);
  });

  it('ordnet Einträge auch über die Entra-Geräte-ID zu', async () => {
    const { provider } = setup(() =>
      collection([
        {
          id: 'a',
          managedDeviceIdentifier: PC001_ENTRA_ID,
          userId: USER_ID,
          mobileAppList: [detail('A1', 'installed')],
        },
      ]),
    );
    const result = expectStatus(
      await provider.getAppInstallStates(windowsDevice({ userId: USER_ID })),
      'ok',
    );
    expect(result.data.map((a) => a.appId)).toEqual(['A1']);
  });

  it('keine Einträge → unavailable (appsNoEntries) statt „keine Apps“', async () => {
    const { provider } = setup(() => collection([]));
    const result = expectStatus(
      await provider.getAppInstallStates(windowsDevice({ userId: USER_ID })),
      'unavailable',
    );
    expect(result.reason).toBe(de.reasons.appsNoEntries);
  });

  it('nur Einträge anderer Geräte → unavailable mit Anzahl und Log', async () => {
    const { provider, log } = setup(() =>
      collection([
        { id: 'b', managedDeviceIdentifier: 'x', userId: USER_ID, mobileAppList: [] },
        { id: 'c', managedDeviceIdentifier: 'y', userId: USER_ID, mobileAppList: [] },
      ]),
    );
    const result = expectStatus(
      await provider.getAppInstallStates(windowsDevice({ userId: USER_ID })),
      'unavailable',
    );
    expect(result.reason).toBe(de.reasons.appsDeviceNotListed(2));
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('ohne primären Benutzer → notApplicable ohne Request', async () => {
    const { provider, calls } = setup();
    const result = expectStatus(
      await provider.getAppInstallStates(windowsDevice({ userId: null })),
      'notApplicable',
    );
    expect(result.reason).toBe(de.reasons.appsNoPrimaryUser);
    expect(calls).toHaveLength(0);
  });

  it('unbekannte Enum-Werte werden zu unknown bzw. null', async () => {
    const { provider } = setup(() =>
      collection([
        {
          id: 'a',
          managedDeviceIdentifier: PC001_ID,
          userId: USER_ID,
          mobileAppList: [detail('A1', 'brandNew', 'somethingElse')],
        },
      ]),
    );
    const result = expectStatus(
      await provider.getAppInstallStates(windowsDevice({ userId: USER_ID })),
      'ok',
    );
    expect(result.data[0]).toMatchObject({ installState: 'unknown', intent: null });
  });

  it('403 → forbidden mit Scope aus der Endpoint-Definition', async () => {
    const { provider } = setup(() => graphError(403, 'Forbidden'));
    const result = expectStatus(
      await provider.getAppInstallStates(windowsDevice({ userId: USER_ID })),
      'forbidden',
    );
    expect(result.error.requiredScope).toBe(Endpoints.mobileAppIntentAndStates.scope);
  });
});

describe('GraphProvider – App-Namen', () => {
  const A = '11111111-1111-1111-1111-111111111111';
  const B = '22222222-2222-2222-2222-222222222222';

  it('liest Namen per GET mobileApps/{id} mit $select, überspringt 404 und doppelte IDs', async () => {
    const { provider, calls } = setup((call) => {
      if (call.parsed.pathname.endsWith(`/mobileApps/${A}`)) {
        return jsonResponse({ id: A, displayName: 'Contoso VPN', publisher: 'Contoso' });
      }
      return graphError(404, 'ResourceNotFound');
    });
    const result = expectStatus(await provider.getMobileApps([A, A.toUpperCase(), B]), 'ok');
    expect(result.data).toEqual([{ id: A, displayName: 'Contoso VPN', publisher: 'Contoso' }]);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.method).toBe('GET');
      expect(call.parsed.pathname).toMatch(/^\/v1\.0\/deviceAppManagement\/mobileApps\//);
      expect(call.parsed.searchParams.get('$select')).toBe('id,displayName,publisher');
    }
    expect(result.source.label).toBe(Endpoints.mobileApp.display);
  });

  it('meldet fehlende Berechtigung als forbidden mit Scope', async () => {
    const { provider } = setup(() => graphError(403, 'Forbidden'));
    const result = expectStatus(await provider.getMobileApps([A]), 'forbidden');
    expect(result.error.requiredScope).toBe(Endpoints.mobileApp.scope);
  });

  it('fragt ohne IDs nichts ab', async () => {
    const { provider, calls } = setup();
    expectStatus(await provider.getMobileApps([]), 'ok');
    expect(calls).toHaveLength(0);
  });
});

describe('GraphProvider – Apple-MDM-Push-Zertifikat', () => {
  const CERT_URL =
    'https://graph.microsoft.com/v1.0/deviceManagement/applePushNotificationCertificate';

  it('ruft für macOS per GET mit $select ohne appleIdentifier/certificate ab', async () => {
    const { provider, calls } = setup();
    const mac = await provider.getDevice(MAC07_ID);
    const before = calls.length;
    const result = expectStatus(await provider.getApplePushCertificate(mac), 'ok');
    expect(result.data).toEqual({
      expirationDateTime: '2027-05-03T12:00:00Z',
      lastModifiedDateTime: '2026-05-03T12:00:00Z',
    });
    expect(calls).toHaveLength(before + 1);
    const call = calls[calls.length - 1]!;
    expect(call.method ?? 'GET').toBe('GET');
    expect(call.parsed.origin + call.parsed.pathname).toBe(CERT_URL);
    expect(call.parsed.searchParams.get('$select')).toBe('expirationDateTime,lastModifiedDateTime');
    expect(call.url).not.toMatch(/appleIdentifier|certificate(?!.*DateTime)/);
    expect(result.source.label).toBe(Endpoints.applePushNotificationCertificate.display);
  });

  it('akzeptiert auch die in `value` verpackte Antwort (Doku-Beispiel)', async () => {
    const { provider } = setup(() =>
      jsonResponse({
        value: {
          id: 'x',
          expirationDateTime: '2027-01-02T00:00:00Z',
          lastModifiedDateTime: '2026-01-02T00:00:00Z',
        },
      }),
    );
    const result = expectStatus(
      await provider.getApplePushCertificate(windowsDevice({ osFamily: 'ios' })),
      'ok',
    );
    expect(result.data.expirationDateTime).toBe('2027-01-02T00:00:00Z');
  });

  it('Windows/Android: notApplicable ohne Request', async () => {
    const { provider, calls } = setup();
    for (const osFamily of ['windows', 'android', 'linux', 'other'] as const) {
      const result = expectStatus(
        await provider.getApplePushCertificate(windowsDevice({ osFamily })),
        'notApplicable',
      );
      expect(result.reason).toBe(de.reasons.applePushNotApple);
    }
    expect(calls).toHaveLength(0);
  });

  it('403 → forbidden mit requiredScope DeviceManagementServiceConfig.Read.All', async () => {
    const { provider } = setup(() => graphError(403, 'Authorization_RequestDenied'));
    const result = expectStatus(
      await provider.getApplePushCertificate(windowsDevice({ osFamily: 'macos' })),
      'forbidden',
    );
    expect(result.error.requiredScope).toBe('DeviceManagementServiceConfig.Read.All');
    expect(result.source.label).toBe(Endpoints.applePushNotificationCertificate.display);
  });

  it('404 → unavailable (kein Zertifikat hinterlegt)', async () => {
    const { provider } = setup(() => graphError(404, 'ResourceNotFound'));
    const result = expectStatus(
      await provider.getApplePushCertificate(windowsDevice({ osFamily: 'ios' })),
      'unavailable',
    );
    expect(result.reason).toBe(de.reasons.applePushNotReported);
  });

  it('Ablaufdatum fehlt/ungültig → ok mit null', async () => {
    const { provider } = setup(() =>
      jsonResponse({ id: 'x', expirationDateTime: '0001-01-01T00:00:00Z' }),
    );
    const result = expectStatus(
      await provider.getApplePushCertificate(windowsDevice({ osFamily: 'macos' })),
      'ok',
    );
    expect(result.data).toEqual({ expirationDateTime: null, lastModifiedDateTime: null });
  });
});

describe('GraphProvider – Anmeldungen (Entra-Anmeldeprotokoll)', () => {
  const SIGN_INS_PATH = '/v1.0/auditLogs/signIns';

  it('fragt per GET mit userId- und Zeitfilter ab (ohne $select), nur die erste Seite', async () => {
    const { provider, calls } = setup();
    const result = expectStatus(
      await provider.getSignIns(windowsDevice({ userId: PC001_USER_ID })),
      'ok',
    );
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.method ?? 'GET').toBe('GET');
    expect(call.parsed.pathname).toBe(SIGN_INS_PATH);
    expect(call.parsed.searchParams.get('$filter')).toBe(
      `userId eq '${PC001_USER_ID}' and createdDateTime ge 2026-10-08T12:00:00Z`,
    );
    expect(call.parsed.searchParams.get('$top')).toBe('200');
    expect(call.parsed.searchParams.has('$select')).toBe(false);
    expect(result.source.label).toBe(Endpoints.signIns.display);
    expect(result.data.windowDays).toBe(7);
  });

  it('grenzt clientseitig auf das Gerät ein (2 von 3 Einträgen gehören zu PC001)', async () => {
    const { provider } = setup();
    const result = expectStatus(
      await provider.getSignIns(windowsDevice({ userId: PC001_USER_ID })),
      'ok',
    );
    expect(result.data.totalForUser).toBe(3);
    expect(result.data.entries.map((e) => e.id)).toEqual(['s-1', 's-3']);
    expect(result.data.entries[1]).toMatchObject({
      conditionalAccessStatus: 'failure',
      errorCode: 53000,
    });
    expect(JSON.stringify(result.data)).not.toMatch(/203\.0\.113\.7|ipAddress|location/);
  });

  it('folgt @odata.nextLink nicht, merkt sich aber, dass es weitere Seiten gibt', async () => {
    const { provider, calls } = setup(() =>
      jsonResponse({
        value: [signInDto('s-1', 1)],
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/auditLogs/signIns?$skiptoken=abc',
      }),
    );
    const result = expectStatus(
      await provider.getSignIns(windowsDevice({ userId: PC001_USER_ID })),
      'ok',
    );
    expect(result.data.moreAvailable).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('ohne primären Benutzer: notApplicable ohne Request; ohne Entra-Geräte-ID: unavailable ohne Request', async () => {
    const { provider, calls } = setup();
    const none = expectStatus(
      await provider.getSignIns(windowsDevice({ userId: null })),
      'notApplicable',
    );
    expect(none.reason).toBe(de.reasons.signInsNoPrimaryUser);
    const noId = expectStatus(
      await provider.getSignIns(windowsDevice({ userId: PC001_USER_ID, azureADDeviceId: null })),
      'unavailable',
    );
    expect(noId.reason).toBe(de.reasons.noAzureAdDeviceId);
    expect(calls).toHaveLength(0);
  });

  it('403 → forbidden mit requiredScope AuditLog.Read.All, ohne andere Sections zu beeinflussen', async () => {
    const { provider } = setup((call) =>
      call.parsed.pathname === SIGN_INS_PATH
        ? graphError(403, 'Authorization_RequestDenied')
        : contosoHandler()(call),
    );
    const result = expectStatus(
      await provider.getSignIns(windowsDevice({ userId: PC001_USER_ID })),
      'forbidden',
    );
    expect(result.error.requiredScope).toBe('AuditLog.Read.All');
    expectStatus(await provider.getEntraDevice(windowsDevice()), 'ok');
  });

  it('404 → unavailable, 500 → error', async () => {
    const notFound = setup(() => graphError(404, 'ResourceNotFound'));
    const unavailable = expectStatus(
      await notFound.provider.getSignIns(windowsDevice({ userId: PC001_USER_ID })),
      'unavailable',
    );
    expect(unavailable.reason).toBe(de.reasons.signInsNotReported);
    const broken = setup(() => graphError(500, 'InternalServerError'));
    expectStatus(
      await broken.provider.getSignIns(windowsDevice({ userId: PC001_USER_ID })),
      'error',
    );
  });

  it('Fehlt appliedConditionalAccessPolicies in der Antwort, liefert der Provider appliedPolicies null (kein Fehler)', async () => {
    const entry = signInDto('s-1', 1);
    delete entry.appliedConditionalAccessPolicies;
    const { provider } = setup(() => collection([entry]));
    const result = expectStatus(
      await provider.getSignIns(windowsDevice({ userId: PC001_USER_ID })),
      'ok',
    );
    expect(result.data.entries[0]!.appliedPolicies).toBeNull();
  });
});

describe('GraphProvider – Windows LAPS', () => {
  const LAPS_PATH = `/v1.0/directory/deviceLocalCredentials/${PC001_ENTRA_ID}`;

  it('liest per GET nur Metadaten – ohne credentials', async () => {
    const { provider, calls } = setup();
    const result = expectStatus(await provider.getLocalAdmin(windowsDevice()), 'ok');
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.method).toBe('GET');
    expect(call.parsed.pathname).toBe(LAPS_PATH);
    expect(call.parsed.searchParams.get('$select')).toBe(
      'id,deviceName,lastBackupDateTime,refreshDateTime',
    );
    // der Pfad heißt …/deviceLocalCredentials – geprüft wird die Abfrage (nie $select=credentials)
    expect(call.parsed.search.toLowerCase()).not.toContain('credentials');
    expect(result.source.label).toBe(Endpoints.deviceLocalCredentialInfo.display);
    expect(result.data).toEqual({
      deviceName: 'CONTOSO-PC001',
      lastBackupDateTime: '2026-10-12T08:00:00Z',
      refreshDateTime: '2026-11-11T08:00:00Z',
    });
  });

  it('nicht Windows: notApplicable ohne Request; ohne Entra-Geräte-ID: unavailable ohne Request', async () => {
    const { provider, calls } = setup();
    const mac = expectStatus(
      await provider.getLocalAdmin(windowsDevice({ osFamily: 'macos' })),
      'notApplicable',
    );
    expect(mac.reason).toBe(de.reasons.lapsNotWindows);
    const noId = expectStatus(
      await provider.getLocalAdmin(windowsDevice({ azureADDeviceId: null })),
      'unavailable',
    );
    expect(noId.reason).toBe(de.reasons.noAzureAdDeviceId);
    expect(calls).toHaveLength(0);
  });

  it('403 → forbidden mit Scope …ReadBasic.All, ohne andere Sections zu beeinflussen', async () => {
    const { provider } = setup((call) =>
      call.parsed.pathname === LAPS_PATH
        ? graphError(403, 'Authorization_RequestDenied')
        : contosoHandler()(call),
    );
    const result = expectStatus(await provider.getLocalAdmin(windowsDevice()), 'forbidden');
    expect(result.error.requiredScope).toBe('DeviceLocalCredential.ReadBasic.All');
    expectStatus(await provider.getEntraDevice(windowsDevice()), 'ok');
  });

  it('404 → unavailable mit ehrlichem Text, 500 → error', async () => {
    const { provider } = setup((call) =>
      call.parsed.pathname === LAPS_PATH
        ? graphError(404, 'ResourceNotFound')
        : contosoHandler()(call),
    );
    const unavailable = expectStatus(await provider.getLocalAdmin(windowsDevice()), 'unavailable');
    expect(unavailable.reason).toBe(de.reasons.lapsNotReported);
    const broken = setup(() => graphError(500, 'InternalServerError'));
    expectStatus(await broken.provider.getLocalAdmin(windowsDevice()), 'error');
  });
});

describe('GraphProvider – Integritätsnachweis', () => {
  const PATH = `/v1.0/deviceManagement/managedDevices/${PC001_ID}`;

  it('liest per GET mit $select=deviceHealthAttestationState und übernimmt Rohwerte', async () => {
    const { provider, calls } = setup();
    const result = expectStatus(await provider.getHealthAttestation(windowsDevice()), 'ok');
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.method).toBe('GET');
    expect(call.parsed.pathname).toBe(PATH);
    expect(call.parsed.searchParams.get('$select')).toBe('deviceHealthAttestationState');
    expect(result.source.label).toBe(Endpoints.managedDeviceHealthAttestation.display);
    expect(result.data.secureBoot).toBe('enabled');
    expect(result.data.tpmVersion).toBe('2.0');
    // leere Strings → null; virtualSecureMode (abgekündigt) wird nicht übernommen
    expect(result.data.healthStatusMismatchInfo).toBeNull();
    expect(result.data).not.toHaveProperty('virtualSecureMode');
  });

  it('nicht Windows: notApplicable ohne Request', async () => {
    const { provider, calls } = setup();
    const result = expectStatus(
      await provider.getHealthAttestation(windowsDevice({ osFamily: 'macos' })),
      'notApplicable',
    );
    expect(result.reason).toBe(de.reasons.attestationNotWindows);
    expect(calls).toHaveLength(0);
  });

  it('403 → forbidden mit Scope DeviceManagementManagedDevices.Read.All; 404 → unavailable; 500 → error', async () => {
    const forbidden = setup((call) =>
      call.parsed.searchParams.get('$select') === 'deviceHealthAttestationState'
        ? graphError(403, 'Forbidden')
        : contosoHandler()(call),
    );
    const denied = expectStatus(
      await forbidden.provider.getHealthAttestation(windowsDevice()),
      'forbidden',
    );
    expect(denied.error.requiredScope).toBe('DeviceManagementManagedDevices.Read.All');
    const missing = setup(() => graphError(404, 'ResourceNotFound'));
    const unavailable = expectStatus(
      await missing.provider.getHealthAttestation(windowsDevice()),
      'unavailable',
    );
    expect(unavailable.reason).toBe(de.reasons.attestationNotReported);
    const broken = setup(() => graphError(500, 'InternalServerError'));
    expectStatus(await broken.provider.getHealthAttestation(windowsDevice()), 'error');
  });
});

describe('GraphProvider – Windows Autopilot', () => {
  const AP_PATH = '/v1.0/deviceManagement/windowsAutopilotDeviceIdentities';
  const pageOf = (n: number, withNext: boolean) =>
    jsonResponse({
      value: [{ id: `ap-${n}`, serialNumber: `X-${n}`, managedDeviceId: null }],
      ...(withNext
        ? { '@odata.nextLink': `https://graph.microsoft.com${AP_PATH}?$skiptoken=${n + 1}` }
        : {}),
    });

  it('liest die Liste ohne Query per GET und findet das Gerät über managedDeviceId', async () => {
    const { provider, calls } = setup();
    const result = expectStatus(await provider.getAutopilot(windowsDevice()), 'ok');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('GET');
    expect(calls[0]!.parsed.pathname).toBe(AP_PATH);
    expect(calls[0]!.parsed.search).toBe('');
    expect(result.data).toMatchObject({
      groupTag: 'Contoso-Standard',
      enrollmentState: 'enrolled',
      matchedBy: 'managedDeviceId',
    });
    expect(JSON.stringify(result.data)).not.toMatch(/AAAAA|anna\.schmidt|productKey/);
    expect(result.source.label).toBe(Endpoints.windowsAutopilotDeviceIdentities.display);
  });

  it('nicht gefunden, Liste zu Ende → ok mit null (nicht registriert)', async () => {
    const { provider } = setup(() => pageOf(1, false));
    const result = expectStatus(await provider.getAutopilot(windowsDevice()), 'ok');
    expect(result.data).toBeNull();
  });

  it('nicht gefunden, weitere Seiten → nach 5 Seiten unavailable mit ehrlichem Grund', async () => {
    let n = 0;
    const { provider, calls } = setup(() => pageOf(++n, true));
    const result = expectStatus(await provider.getAutopilot(windowsDevice()), 'unavailable');
    expect(calls).toHaveLength(5);
    expect(result.reason).toBe(de.reasons.autopilotNotFoundInLimit(5));
  });

  it('bricht beim ersten Treffer ab (Seite 2 von 3)', async () => {
    let n = 0;
    const { provider, calls } = setup(() => {
      n += 1;
      return n < 2
        ? pageOf(n, true)
        : jsonResponse({
            value: [{ id: 'ap-hit', serialNumber: 'x', managedDeviceId: PC001_ID }],
            '@odata.nextLink': `https://graph.microsoft.com${AP_PATH}?$skiptoken=9`,
          });
    });
    expectStatus(await provider.getAutopilot(windowsDevice()), 'ok');
    expect(calls).toHaveLength(2);
  });

  it('nicht Windows → notApplicable ohne Request; 403 → forbidden mit Scope; 404 → unavailable', async () => {
    const a = setup();
    expectStatus(
      await a.provider.getAutopilot(windowsDevice({ osFamily: 'macos' })),
      'notApplicable',
    );
    expect(a.calls).toHaveLength(0);
    const b = setup(() => graphError(403, 'Authorization_RequestDenied'));
    const forbidden = expectStatus(await b.provider.getAutopilot(windowsDevice()), 'forbidden');
    expect(forbidden.error.requiredScope).toBe('DeviceManagementServiceConfig.Read.All');
    const c = setup(() => graphError(404, 'ResourceNotFound'));
    expect(expectStatus(await c.provider.getAutopilot(windowsDevice()), 'unavailable').reason).toBe(
      de.reasons.autopilotNotReported,
    );
  });
});

describe('GraphProvider – Gruppen des Geräts', () => {
  const PATH = `/v1.0/devices(deviceId='${PC001_ENTRA_ID}')/transitiveMemberOf`;

  it('liest transitiveMemberOf per GET ohne Query-Optionen und mappt Gruppen', async () => {
    const { provider, calls } = setup();
    const result = expectStatus(await provider.getDeviceGroups(windowsDevice()), 'ok');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('GET');
    expect(decodeURIComponent(calls[0]!.parsed.pathname)).toBe(PATH);
    expect(calls[0]!.parsed.search).toBe('');
    expect(result.data.groups.map((g) => g.displayName)).toEqual([
      'Contoso – Alle Geräte',
      'Contoso – Pilot',
    ]);
    expect(result.data.hiddenCount).toBe(1);
    expect(result.data.truncated).toBe(false);
  });

  it('folgt @odata.nextLink höchstens 5 Seiten und meldet truncated', async () => {
    let n = 0;
    const { provider, calls } = setup(() =>
      jsonResponse({
        value: [{ '@odata.type': '#microsoft.graph.group', id: `g${++n}`, displayName: `G${n}` }],
        '@odata.nextLink': `https://graph.microsoft.com${PATH}?$skiptoken=${n}`,
      }),
    );
    const result = expectStatus(await provider.getDeviceGroups(windowsDevice()), 'ok');
    expect(calls).toHaveLength(5);
    expect(result.data.truncated).toBe(true);
    expect(result.data.groups).toHaveLength(5);
  });

  it('ohne Entra-Geräte-ID: unavailable ohne Request; 403 → forbidden (Device.Read.All); 404 → unavailable', async () => {
    const a = setup();
    expectStatus(
      await a.provider.getDeviceGroups(windowsDevice({ azureADDeviceId: null })),
      'unavailable',
    );
    expect(a.calls).toHaveLength(0);
    const b = setup(() => graphError(403, 'Authorization_RequestDenied'));
    expect(
      expectStatus(await b.provider.getDeviceGroups(windowsDevice()), 'forbidden').error
        .requiredScope,
    ).toBe('Device.Read.All');
    const c = setup(() => graphError(404, 'ResourceNotFound'));
    expect(
      expectStatus(await c.provider.getDeviceGroups(windowsDevice()), 'unavailable').reason,
    ).toBe(de.reasons.groupsNotReported);
  });
});

describe('GraphProvider – weitere Geräte des Benutzers', () => {
  it('filtert per dokumentiertem eq-Filter auf userPrincipalName, minimales $select, ohne das aktuelle Gerät', async () => {
    const { provider, calls } = setup((call) =>
      jsonResponse({
        value: [
          { id: PC001_ID, deviceName: 'CONTOSO-PC001', operatingSystem: 'Windows' },
          {
            id: 'other-1',
            deviceName: 'CONTOSO-IP015',
            operatingSystem: 'iOS',
            complianceState: 'noncompliant',
          },
        ],
        _call: call.url,
      }),
    );
    const result = expectStatus(
      await provider.getUserDevices(windowsDevice({ userPrincipalName: "o'brien@contoso.com" })),
      'ok',
    );
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.method).toBe('GET');
    expect(call.parsed.pathname).toBe('/v1.0/deviceManagement/managedDevices');
    expect(call.parsed.searchParams.get('$filter')).toBe(
      "userPrincipalName eq 'o''brien@contoso.com'",
    );
    expect(call.parsed.searchParams.get('$select')).toBe(
      'id,deviceName,operatingSystem,complianceState,lastSyncDateTime',
    );
    expect(result.data.map((d) => d.deviceName)).toEqual(['CONTOSO-IP015']);
    expect(result.data[0]!.complianceState).toBe('noncompliant');
  });

  it('ohne Benutzer: notApplicable ohne Request; 403/404/500 werden zu Section-Zuständen', async () => {
    const a = setup();
    expectStatus(
      await a.provider.getUserDevices(windowsDevice({ userPrincipalName: null })),
      'notApplicable',
    );
    expect(a.calls).toHaveLength(0);
    const device = windowsDevice({ userPrincipalName: 'anna.schmidt@contoso.com' });
    const forbidden = setup(() => graphError(403, 'Authorization_RequestDenied'));
    expect(
      expectStatus(await forbidden.provider.getUserDevices(device), 'forbidden').error
        .requiredScope,
    ).toBe('DeviceManagementManagedDevices.Read.All');
    const missing = setup(() => graphError(404, 'ResourceNotFound'));
    expectStatus(await missing.provider.getUserDevices(device), 'unavailable');
    const broken = setup(() => graphError(500, 'InternalServerError'));
    expectStatus(await broken.provider.getUserDevices(device), 'error');
  });
});

describe('GraphProvider – gleichnamige Entra-Objekte (M14/S1)', () => {
  it('liest per GET /devices mit eq-Filter auf displayName, nur die erste Seite, und markiert das aktuelle Objekt', async () => {
    const duplicate = {
      ...pc001Entra(),
      id: 'obj-registered',
      deviceId: '00000000-0000-4000-9000-0000000000aa',
      trustType: 'Workplace' as const,
    };
    const { provider, calls } = setup((call) =>
      call.parsed.pathname === '/v1.0/devices'
        ? jsonResponse({
            value: [pc001Entra(), duplicate],
            '@odata.nextLink': 'https://graph.microsoft.com/v1.0/devices?$skiptoken=x',
          })
        : graphError(404, 'NotFound'),
    );
    const result = expectStatus(await provider.getDuplicateDevices(windowsDevice()), 'ok');
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.method).toBe('GET');
    expect(call.parsed.pathname).toBe('/v1.0/devices');
    expect(call.parsed.searchParams.get('$filter')).toBe("displayName eq 'CONTOSO-PC001'");
    expect(result.data.moreAvailable).toBe(true);
    expect(result.data.devices.map((d) => [d.trustType, d.isCurrent])).toEqual([
      ['AzureAd', true],
      ['Workplace', false],
    ]);
    expect(result.source.label).toBe(Endpoints.entraDevicesByName.display);
  });

  it('403 → forbidden mit Scope Device.Read.All; 404 → unavailable; 500 → error – jeweils ohne andere Sections', async () => {
    const forbidden = setup(() => graphError(403, 'Authorization_RequestDenied'));
    expect(
      expectStatus(await forbidden.provider.getDuplicateDevices(windowsDevice()), 'forbidden').error
        .requiredScope,
    ).toBe('Device.Read.All');
    const missing = setup(() => graphError(404, 'ResourceNotFound'));
    expectStatus(await missing.provider.getDuplicateDevices(windowsDevice()), 'unavailable');
    const broken = setup(() => graphError(500, 'InternalServerError'));
    expectStatus(await broken.provider.getDuplicateDevices(windowsDevice()), 'error');
  });

  it('ohne Gerätenamen: unavailable ohne Request', async () => {
    const { provider, calls } = setup();
    expectStatus(
      await provider.getDuplicateDevices(windowsDevice({ deviceName: '–' })),
      'unavailable',
    );
    expect(calls).toHaveLength(0);
  });
});

describe('GraphProvider – Zuweisungen (M14/S2)', () => {
  const guid = (n: number) => `00000000-0000-4000-b000-${n.toString(16).padStart(12, '0')}`;
  const lookup = (kind: 'compliance' | 'configuration' | 'app', n: number) => ({
    kind,
    id: guid(n),
    displayName: `Objekt ${n}`,
  });
  const groupAssignment = (groupId: string, extra: object = {}) => ({
    '@odata.type': '#microsoft.graph.deviceConfigurationAssignment',
    id: 'a-1',
    target: { '@odata.type': '#microsoft.graph.groupAssignmentTarget', groupId },
    ...extra,
  });

  it('ruft je Objekt genau den passenden v1.0-GET ohne Query auf und mappt die Ziele', async () => {
    const { provider, calls } = setup((call) => {
      if (call.parsed.pathname.endsWith('/assignments')) {
        return collection([
          groupAssignment('g-1', { intent: 'required' }),
          {
            target: {
              '@odata.type': '#microsoft.graph.exclusionGroupAssignmentTarget',
              groupId: 'g-2',
            },
          },
        ]);
      }
      return graphError(404, 'NotFound');
    });
    const result = expectStatus(
      await provider.getAssignments(windowsDevice(), [
        lookup('configuration', 1),
        lookup('compliance', 2),
        lookup('app', 3),
      ]),
      'ok',
    );
    expect(calls.map((c) => [c.method, c.parsed.pathname, c.parsed.search])).toEqual([
      ['GET', `/v1.0/deviceManagement/deviceConfigurations/${guid(1)}/assignments`, ''],
      ['GET', `/v1.0/deviceManagement/deviceCompliancePolicies/${guid(2)}/assignments`, ''],
      ['GET', `/v1.0/deviceAppManagement/mobileApps/${guid(3)}/assignments`, ''],
    ]);
    expect(result.data.skipped).toBe(0);
    expect(result.data.objects.map((o) => o.status)).toEqual(['ok', 'ok', 'ok']);
    expect(result.data.objects[0]!.assignments).toEqual([
      { target: { kind: 'group', groupId: 'g-1' }, intent: 'required' },
      { target: { kind: 'exclusionGroup', groupId: 'g-2' }, intent: null },
    ]);
    expect(result.source.kind).toBe('graph');
  });

  it('begrenzt auf 30 Abrufe (4 parallel) und weist die übrigen Objekte als „skipped“ aus', async () => {
    let running = 0;
    let peak = 0;
    const { provider, calls } = setup(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running -= 1;
      return collection([]);
    });
    const lookups = Array.from({ length: 35 }, (_, i) => lookup('configuration', i + 1));
    const result = expectStatus(await provider.getAssignments(windowsDevice(), lookups), 'ok');
    expect(calls).toHaveLength(30);
    expect(peak).toBeLessThanOrEqual(4);
    expect(result.data.objects).toHaveLength(30);
    expect(result.data.skipped).toBe(5);
  });

  it('IDs, die keine GUID sind, werden nicht abgefragt (notEvaluable); 404 → notFound', async () => {
    const { provider, calls } = setup((call) =>
      call.parsed.pathname.includes(guid(2)) ? graphError(404, 'ResourceNotFound') : collection([]),
    );
    const result = expectStatus(
      await provider.getAssignments(windowsDevice(), [
        { kind: 'configuration', id: 'c-1_dev_user', displayName: 'Zusammengesetzt' },
        lookup('compliance', 2),
        lookup('compliance', 3),
      ]),
      'ok',
    );
    expect(calls).toHaveLength(2);
    expect(result.data.objects.map((o) => o.status)).toEqual(['notEvaluable', 'notFound', 'ok']);
  });

  it('ohne Objekte: notApplicable ohne Request', async () => {
    const { provider, calls } = setup();
    expectStatus(await provider.getAssignments(windowsDevice(), []), 'notApplicable');
    expect(calls).toHaveLength(0);
  });

  it('nur nicht abfragbare IDs: ok ohne Request, alle notEvaluable', async () => {
    const { provider, calls } = setup();
    const result = expectStatus(
      await provider.getAssignments(windowsDevice(), [
        { kind: 'configuration', id: 'k-1', displayName: 'Profil' },
      ]),
      'ok',
    );
    expect(calls).toHaveLength(0);
    expect(result.data.objects[0]!.status).toBe('notEvaluable');
  });

  it('403 → ganze Section forbidden mit Scope DeviceManagementConfiguration.Read.All', async () => {
    const { provider } = setup(() => graphError(403, 'Authorization_RequestDenied'));
    const result = expectStatus(
      await provider.getAssignments(windowsDevice(), [lookup('configuration', 1)]),
      'forbidden',
    );
    expect(result.error.requiredScope).toBe('DeviceManagementConfiguration.Read.All');
  });

  it('schlägt jeder Abruf fehl → error; einzelne Fehler bleiben Objektstatus „error“', async () => {
    const allFail = setup(() => graphError(500, 'InternalServerError'));
    expectStatus(
      await allFail.provider.getAssignments(windowsDevice(), [
        lookup('configuration', 1),
        lookup('app', 2),
      ]),
      'error',
    );
    const partial = setup((call) =>
      call.parsed.pathname.includes(guid(1))
        ? graphError(500, 'InternalServerError')
        : collection([]),
    );
    const result = expectStatus(
      await partial.provider.getAssignments(windowsDevice(), [
        lookup('configuration', 1),
        lookup('app', 2),
      ]),
      'ok',
    );
    expect(result.data.objects.map((o) => o.status)).toEqual(['error', 'ok']);
  });

  it('Abbruch wird weitergereicht', async () => {
    const { provider } = setup(() => collection([]));
    const controller = new AbortController();
    controller.abort();
    await expect(
      provider.getAssignments(windowsDevice(), [lookup('app', 1)], { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('GraphProvider – Registrierung: Lizenz und Gerätelimit (M14/S3)', () => {
  const planId = 'c1ec4a95-1f05-45b3-a911-aa3fa01094f5';
  const withUser = () => windowsDevice({ userId: PC001_USER_ID });
  const limitConfig = (id: string, extra: object = {}) => ({
    '@odata.type': '#microsoft.graph.deviceEnrollmentLimitConfiguration',
    id,
    displayName: `Limit ${id}`,
    priority: 1,
    limit: 5,
    ...extra,
  });

  it('getUserLicense: GET /users/{id}/licenseDetails mit $select, reduziert auf Intune-Pläne', async () => {
    const { provider, calls } = setup((call) =>
      call.parsed.pathname.endsWith('/licenseDetails')
        ? collection([
            {
              id: 'ld-1',
              skuId: 'sku-1',
              skuPartNumber: 'SPE_E3',
              servicePlans: [
                {
                  servicePlanId: planId,
                  servicePlanName: 'INTUNE_A',
                  provisioningStatus: 'Success',
                  appliesTo: 'User',
                },
                {
                  servicePlanId: 'other',
                  servicePlanName: 'X',
                  provisioningStatus: 'Success',
                  appliesTo: 'User',
                },
              ],
            },
          ])
        : graphError(404, 'NotFound'),
    );
    const result = expectStatus(await provider.getUserLicense(withUser()), 'ok');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('GET');
    expect(calls[0]!.parsed.pathname).toBe(`/v1.0/users/${PC001_USER_ID}/licenseDetails`);
    expect(calls[0]!.parsed.searchParams.get('$select')).toBe(
      'id,skuId,skuPartNumber,servicePlans',
    );
    expect(result.data).toEqual({
      licenseCount: 1,
      plans: [{ plan: 'INTUNE_A', skuPartNumber: 'SPE_E3', provisioningStatus: 'Success' }],
    });
    expect(result.source.label).toBe(Endpoints.userLicenseDetails.display);
  });

  it('getUserLicense: ohne Benutzer notApplicable ohne Request; 403 → forbidden mit Scope; 404 → unavailable; 500 → error', async () => {
    const none = setup();
    expectStatus(
      await none.provider.getUserLicense(windowsDevice({ userId: null })),
      'notApplicable',
    );
    expect(none.calls).toHaveLength(0);
    const forbidden = setup(() => graphError(403, 'Authorization_RequestDenied'));
    expect(
      expectStatus(await forbidden.provider.getUserLicense(withUser()), 'forbidden').error
        .requiredScope,
    ).toBe('LicenseAssignment.Read.All');
    expectStatus(
      await setup(() => graphError(404, 'NotFound')).provider.getUserLicense(withUser()),
      'unavailable',
    );
    expectStatus(
      await setup(() => graphError(500, 'InternalServerError')).provider.getUserLicense(withUser()),
      'error',
    );
  });

  it('getEnrollmentLimits: liest die Liste, Zuweisungen nur für Limit-Konfigurationen; nicht lesbare Zuweisungen → Ziele null', async () => {
    const { provider, calls } = setup((call) => {
      const path = call.parsed.pathname;
      if (path === '/v1.0/deviceManagement/deviceEnrollmentConfigurations') {
        return collection([
          limitConfig('cfg-a'),
          limitConfig('cfg-b', { priority: 2, limit: 3 }),
          {
            '@odata.type': '#microsoft.graph.deviceEnrollmentPlatformRestrictionsConfiguration',
            id: 'cfg-x',
            priority: 3,
          },
        ]);
      }
      if (path.endsWith('/cfg-a/assignments')) {
        return collection([
          { target: { '@odata.type': '#microsoft.graph.allLicensedUsersAssignmentTarget' } },
        ]);
      }
      return graphError(500, 'InternalServerError');
    });
    const result = expectStatus(await provider.getEnrollmentLimits(withUser()), 'ok');
    expect(calls.map((c) => c.method)).toEqual(['GET', 'GET', 'GET']);
    expect(calls.map((c) => c.parsed.pathname).sort()).toEqual([
      '/v1.0/deviceManagement/deviceEnrollmentConfigurations',
      '/v1.0/deviceManagement/deviceEnrollmentConfigurations/cfg-a/assignments',
      '/v1.0/deviceManagement/deviceEnrollmentConfigurations/cfg-b/assignments',
    ]);
    expect(result.data.omitted).toBe(0);
    expect(result.data.limits.map((c) => [c.id, c.limit, c.targets])).toEqual([
      ['cfg-a', 5, [{ kind: 'allUsers' }]],
      ['cfg-b', 3, null],
    ]);
  });

  it('getEnrollmentLimits: höchstens 10 Limit-Konfigurationen, der Rest wird als „omitted“ ausgewiesen', async () => {
    const { provider, calls } = setup((call) =>
      call.parsed.pathname.endsWith('/assignments')
        ? collection([])
        : collection(
            Array.from({ length: 12 }, (_, i) => limitConfig(`cfg-${i}`, { priority: i })),
          ),
    );
    const result = expectStatus(await provider.getEnrollmentLimits(withUser()), 'ok');
    expect(calls).toHaveLength(1 + 10);
    expect(result.data.limits).toHaveLength(10);
    expect(result.data.omitted).toBe(2);
  });

  it('getEnrollmentLimits: ohne Benutzer notApplicable ohne Request; 403 → forbidden mit Scope; 404 → unavailable', async () => {
    const none = setup();
    expectStatus(
      await none.provider.getEnrollmentLimits(windowsDevice({ userId: null })),
      'notApplicable',
    );
    expect(none.calls).toHaveLength(0);
    const forbidden = setup(() => graphError(403, 'Authorization_RequestDenied'));
    expect(
      expectStatus(await forbidden.provider.getEnrollmentLimits(withUser()), 'forbidden').error
        .requiredScope,
    ).toBe('DeviceManagementServiceConfig.Read.All');
    expectStatus(
      await setup(() => graphError(404, 'NotFound')).provider.getEnrollmentLimits(withUser()),
      'unavailable',
    );
  });
});

describe('GraphProvider – Sicherheitswarnungen (M14/S4)', () => {
  const ALERTS_PATH = '/v1.0/security/alerts_v2';
  const evidence = (extra: object = {}) => ({
    '@odata.type': '#microsoft.graph.security.deviceEvidence',
    azureAdDeviceId: PC001_ENTRA_ID,
    riskScore: 'medium',
    defenderAvStatus: 'updated',
    ...extra,
  });
  const alertDto = (id: string, extra: object = {}) => ({
    id,
    title: `Titel ${id}`,
    severity: 'high',
    status: 'new',
    createdDateTime: '2026-11-09T08:00:00Z',
    lastUpdateDateTime: '2026-11-09T09:00:00Z',
    categories: ['Execution'],
    alertWebUrl: `https://security.microsoft.com/alerts/${id}`,
    evidence: [evidence()],
    ...extra,
  });

  it('liest GET /security/alerts_v2 mit Filter und $top, ordnet clientseitig zu und blendet behobene aus', async () => {
    const { provider, calls } = setup((call) =>
      call.parsed.pathname === ALERTS_PATH
        ? collection([
            alertDto('mine'),
            alertDto('done', { status: 'resolved' }),
            alertDto('other', {
              evidence: [evidence({ azureAdDeviceId: 'ffffffff-0000-0000-0000-000000000001' })],
            }),
          ])
        : graphError(404, 'NotFound'),
    );
    const result = expectStatus(await provider.getSecurityAlerts(windowsDevice()), 'ok');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('GET');
    expect(calls[0]!.parsed.pathname).toBe(ALERTS_PATH);
    expect(calls[0]!.parsed.searchParams.get('$filter')).toBe(
      "serviceSource eq 'microsoftDefenderForEndpoint'",
    );
    expect(calls[0]!.parsed.searchParams.get('$top')).toBe('100');
    expect(result.data.alerts.map((a) => a.id)).toEqual(['mine']);
    expect(result.data.resolvedCount).toBe(1);
    expect(result.data.evaluated).toBe(3);
    expect(result.data.moreAvailable).toBe(false);
    expect(result.source.label).toBe(Endpoints.securityAlerts.display);
  });

  it('liest höchstens 3 Seiten und meldet moreAvailable', async () => {
    let n = 0;
    const { provider, calls } = setup(() =>
      jsonResponse({
        value: [alertDto(`a${++n}`)],
        '@odata.nextLink': `https://graph.microsoft.com${ALERTS_PATH}?$skiptoken=${n}`,
      }),
    );
    const result = expectStatus(await provider.getSecurityAlerts(windowsDevice()), 'ok');
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
    expect(result.data.alerts).toHaveLength(3);
    expect(result.data.evaluated).toBe(3);
    expect(result.data.moreAvailable).toBe(true);
  });

  it('endet ohne moreAvailable, wenn kein nextLink mehr kommt', async () => {
    let n = 0;
    const { provider, calls } = setup(() =>
      jsonResponse({
        value: [alertDto(`b${++n}`)],
        ...(n < 2
          ? { '@odata.nextLink': `https://graph.microsoft.com${ALERTS_PATH}?$skiptoken=${n}` }
          : {}),
      }),
    );
    const result = expectStatus(await provider.getSecurityAlerts(windowsDevice()), 'ok');
    expect(calls).toHaveLength(2);
    expect(result.data.moreAvailable).toBe(false);
  });

  it('ordnet ohne Entra-Geräte-ID über den Gerätenamen zu', async () => {
    const { provider } = setup(() =>
      collection([
        alertDto('byName', {
          evidence: [evidence({ azureAdDeviceId: null, hostName: 'contoso-pc001' })],
        }),
      ]),
    );
    const result = expectStatus(
      await provider.getSecurityAlerts(
        windowsDevice({ azureADDeviceId: null, deviceName: 'CONTOSO-PC001' }),
      ),
      'ok',
    );
    expect(result.data.alerts.map((a) => [a.id, a.matchedBy])).toEqual([['byName', 'deviceName']]);
  });

  it('403 → forbidden mit Scope SecurityAlert.Read.All; 404 → unavailable; 500 → error', async () => {
    const forbidden = setup(() => graphError(403, 'Authorization_RequestDenied'));
    expect(
      expectStatus(await forbidden.provider.getSecurityAlerts(windowsDevice()), 'forbidden').error
        .requiredScope,
    ).toBe('SecurityAlert.Read.All');
    expectStatus(
      await setup(() => graphError(404, 'NotFound')).provider.getSecurityAlerts(windowsDevice()),
      'unavailable',
    );
    expectStatus(
      await setup(() => graphError(500, 'InternalServerError')).provider.getSecurityAlerts(
        windowsDevice(),
      ),
      'error',
    );
  });

  it('personenbezogene Felder der Antwort gelangen nicht in das Ergebnis', async () => {
    const { provider } = setup(() =>
      collection([
        alertDto('p', {
          assignedTo: 'max.mustermann@contoso.com',
          evidence: [
            evidence({
              loggedOnUsers: [{ accountName: 'mmustermann' }],
              ipInterfaces: ['10.0.0.9'],
            }),
          ],
        }),
      ]),
    );
    const result = expectStatus(await provider.getSecurityAlerts(windowsDevice()), 'ok');
    const json = JSON.stringify(result);
    for (const forbidden of [
      'mustermann',
      '10.0.0.9',
      'loggedOnUsers',
      'ipInterfaces',
      'assignedTo',
    ]) {
      expect(json, forbidden).not.toContain(forbidden);
    }
  });
});

describe('GraphProvider – Mandanten-Status (M14/S5)', () => {
  const PUSH_PATH = '/v1.0/deviceManagement/applePushNotificationCertificate';
  const VPP_PATH = '/v1.0/deviceAppManagement/vppTokens';
  const SECRET_TOKEN = 'sTOKEN-GEHEIM-0123456789abcdef';
  const APPLE_ID = 'vpp-admin@contoso.com';
  const vppDto = (id: string) => ({
    id,
    organizationName: 'Contoso GmbH',
    vppTokenAccountType: 'business',
    appleId: APPLE_ID,
    expirationDateTime: '2026-12-01T00:00:00Z',
    lastSyncDateTime: '2026-11-09T08:00:00Z',
    token: SECRET_TOKEN,
    state: 'valid',
    lastSyncStatus: 'completed',
    countryOrRegion: 'DE',
    lastAppCount: 12,
  });
  const tenantHandler =
    (overrides: Record<string, () => Response> = {}): FakeHandler =>
    (call) => {
      const path = call.parsed.pathname;
      if (overrides[path]) return overrides[path]!();
      if (path === PUSH_PATH) {
        return jsonResponse({
          expirationDateTime: '2027-05-01T00:00:00Z',
          lastModifiedDateTime: '2026-05-01T00:00:00Z',
        });
      }
      if (path === VPP_PATH) return collection([vppDto('v1')]);
      return graphError(404, 'NotFound');
    };

  it('liest Push-Zertifikat und VPP-Token je mit einem GET (ohne Gerät), die Section-Ergebnisse sind unabhängig', async () => {
    const { provider, calls } = setup(tenantHandler());
    const status = await provider.getTenantStatus();
    expect(calls.map((c) => c.method)).toEqual(['GET', 'GET']);
    expect(calls.map((c) => c.parsed.pathname).sort()).toEqual([PUSH_PATH, VPP_PATH].sort());
    const push = expectStatus(status.applePushCertificate, 'ok');
    expect(push.data.expirationDateTime).toBe('2027-05-01T00:00:00Z');
    const vpp = expectStatus(status.vppTokens, 'ok');
    expect(vpp.data).toHaveLength(1);
    expect(vpp.source.label).toBe(Endpoints.vppTokens.display);
  });

  it('das Ergebnis enthält weder token noch appleId – auch nicht in Logs', async () => {
    const { provider, log } = setup(tenantHandler());
    const status = await provider.getTenantStatus();
    const everything = JSON.stringify(status) + JSON.stringify(log.mock.calls);
    for (const forbidden of [SECRET_TOKEN, APPLE_ID, 'appleId']) {
      expect(everything, forbidden).not.toContain(forbidden);
    }
    expect(JSON.stringify(status)).not.toContain('"token"');
  });

  it('403 auf den VPP-Token betrifft nur diese Section (Scope im Fehler), das Zertifikat bleibt ok', async () => {
    const { provider } = setup(
      tenantHandler({ [VPP_PATH]: () => graphError(403, 'Authorization_RequestDenied') }),
    );
    const status = await provider.getTenantStatus();
    expect(expectStatus(status.vppTokens, 'forbidden').error.requiredScope).toBe(
      'DeviceManagementServiceConfig.Read.All',
    );
    expectStatus(status.applePushCertificate, 'ok');
  });

  it('404 → unavailable, 500 → error; die jeweils andere Section bleibt unberührt', async () => {
    const a = await setup(
      tenantHandler({ [PUSH_PATH]: () => graphError(404, 'NotFound') }),
    ).provider.getTenantStatus();
    expectStatus(a.applePushCertificate, 'unavailable');
    expectStatus(a.vppTokens, 'ok');
    const b = await setup(
      tenantHandler({ [VPP_PATH]: () => graphError(500, 'InternalServerError') }),
    ).provider.getTenantStatus();
    expectStatus(b.vppTokens, 'error');
    expectStatus(b.applePushCertificate, 'ok');
  });

  it('Abbruch wird weitergereicht', async () => {
    const { provider } = setup(tenantHandler());
    const controller = new AbortController();
    controller.abort();
    await expect(provider.getTenantStatus({ signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

describe('GraphProvider – testConnection (M14/S6)', () => {
  const secretToken = 'SECRET-VPP-TOKEN-VALUE';
  const handler: FakeHandler = (call) =>
    call.parsed.pathname.endsWith('/vppTokens')
      ? collection([{ id: 'v1', organizationName: 'Contoso GmbH', token: secretToken }])
      : collection([{ id: 'x1', displayName: 'Contoso Eintrag' }]);

  it('ruft jeden Endpunkt genau einmal per GET auf und meldet Ergebnisse fortlaufend', async () => {
    const { provider, calls } = setup(handler);
    const seen: string[] = [];
    const results = await provider.testConnection(windowsDevice(), {
      onResult: (result) => seen.push(result.endpointId),
    });
    expect(results).toHaveLength(Object.keys(Endpoints).length);
    expect(seen).toEqual(results.map((result) => result.endpointId));
    expect(calls.length).toBe(results.filter((result) => result.outcome !== 'skipped').length);
    for (const call of calls) {
      expect(call.method).toBe('GET');
      expect(call.parsed.host).toBe('graph.microsoft.com');
    }
  });

  it('gibt weder Antwortwerte noch Namen in Ergebnis oder Log preis', async () => {
    const { provider, log } = setup(handler);
    const results = await provider.testConnection(windowsDevice());
    const everything = JSON.stringify([results, log.mock.calls]);
    expect(everything).not.toContain(secretToken);
    expect(everything).not.toContain('Contoso Eintrag');
    expect(everything).not.toContain('Contoso GmbH');
    expect(everything).not.toContain('CONTOSO-PC001');
    expect(everything).not.toContain(PC001_ID);
    expect(everything).not.toContain(PC001_ENTRA_ID);
  });

  it('Abbruch wird weitergereicht', async () => {
    const { provider, calls } = setup(handler);
    const controller = new AbortController();
    controller.abort();
    await expect(
      provider.testConnection(windowsDevice(), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toHaveLength(0);
  });
});
