import { describe, expect, it, vi } from 'vitest';
import type { EndpointProbeResult, ManagedDeviceInfo } from '../domain/types';
import {
  collection,
  createFakeFetch,
  graphError,
  jsonResponse,
  type FakeCall,
  type FakeHandler,
} from '../providers/graph/fakeGraph';
import { createGraphClient, type SleepFn } from './client';
import {
  entriesOf,
  fieldNamesOf,
  MAX_FIELD_NAMES,
  PROBE_ORDER,
  Probes,
  runConnectionTest,
} from './connectionTest';
import { Endpoints } from './endpoints';

const DEVICE_ID = '11111111-1111-4111-8111-111111111111';
const ENTRA_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const POLICY_ID = '44444444-4444-4444-8444-444444444444';
const CONFIG_ID = '55555555-5555-4555-8555-555555555555';
const APP_ID = '66666666-6666-4666-8666-666666666666';
const ENROLLMENT_ID = '77777777-7777-4777-8777-777777777777_Limit';
const DEVICE_NAME = 'CONTOSO-PC042';
const UPN = 'anna.schmidt@contoso.com';
const SECRET_VPP_TOKEN = 'SECRET-VPP-TOKEN-VALUE';
const SECRET_APPLE_ID = 'apple.admin@contoso.com';

const device = (overrides: Partial<ManagedDeviceInfo> = {}): ManagedDeviceInfo =>
  ({
    id: DEVICE_ID,
    deviceName: DEVICE_NAME,
    osFamily: 'windows',
    azureADDeviceId: ENTRA_ID,
    userId: USER_ID,
    userPrincipalName: UPN,
    ...overrides,
  }) as ManagedDeviceInfo;

/** Antwortet je nach Pfad mit fiktiven Contoso-Daten (inkl. Werten, die nie im Ergebnis landen dürfen). */
function contosoHandler(): FakeHandler {
  return (call) => {
    const path = decodeURIComponent(call.parsed.pathname);
    if (path.endsWith('/deviceCompliancePolicyStates')) {
      return collection([
        { id: POLICY_ID, displayName: 'Contoso Geheime Richtlinie', state: 'compliant' },
      ]);
    }
    if (path.endsWith('/deviceConfigurationStates')) {
      return collection([
        { id: CONFIG_ID, displayName: 'Contoso Geheimes Profil', state: 'error' },
      ]);
    }
    if (path.endsWith('/mobileAppIntentAndStates')) {
      return collection([
        { id: 'x', managedDeviceIdentifier: DEVICE_ID, mobileAppList: [{ applicationId: APP_ID }] },
      ]);
    }
    if (path.endsWith('/deviceEnrollmentConfigurations')) {
      return collection([{ id: ENROLLMENT_ID, displayName: 'Contoso Limit', limit: 5 }]);
    }
    if (path.endsWith('/vppTokens')) {
      return collection([
        {
          id: 'v1',
          organizationName: 'Contoso GmbH',
          token: SECRET_VPP_TOKEN,
          appleId: SECRET_APPLE_ID,
        },
      ]);
    }
    if (path.endsWith(`/managedDevices/${DEVICE_ID}`)) {
      return jsonResponse({
        '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#x',
        id: DEVICE_ID,
        deviceName: DEVICE_NAME,
        userPrincipalName: UPN,
        serialNumber: 'DEMO-000042',
      });
    }
    return collection([
      { id: 'e1', displayName: 'Contoso Eintrag', createdDateTime: '2026-01-01' },
    ]);
  };
}

function setup(handler: FakeHandler = contosoHandler()) {
  const fake = createFakeFetch(handler);
  const sleep = vi.fn<SleepFn>(async () => undefined);
  const client = createGraphClient({
    getToken: async () => 'token',
    fetchImpl: fake.fetchImpl,
    sleep,
  });
  const run = (
    dev: ManagedDeviceInfo = device(),
    options: Parameters<typeof runConnectionTest>[2] = {},
  ) => runConnectionTest(client, dev, { now: () => new Date('2026-10-15T12:00:00Z'), ...options });
  return { ...fake, sleep, run };
}

const byId = (results: EndpointProbeResult[], id: string) =>
  results.find((result) => result.endpointId === id)!;

describe('Verbindungstest – Vollständigkeit', () => {
  it('hat zu jedem Endpunkt der Registry genau eine Probe (und umgekehrt)', () => {
    expect([...PROBE_ORDER].sort()).toEqual(Object.keys(Endpoints).sort());
    expect(new Set(PROBE_ORDER).size).toBe(PROBE_ORDER.length);
    expect(Object.keys(Probes)).toEqual(PROBE_ORDER);
  });

  it('ruft für ein Windows-Gerät mit allen Angaben jeden Endpunkt genau einmal auf', async () => {
    const { run, calls } = setup();
    const results = await run();
    expect(results).toHaveLength(Object.keys(Endpoints).length);
    expect(calls).toHaveLength(Object.keys(Endpoints).length);
    expect(results.map((r) => r.endpointId)).toEqual(PROBE_ORDER);
    expect(results.every((r) => r.outcome === 'ok')).toBe(true);
    for (const result of results) {
      const endpoint = Endpoints[result.endpointId as keyof typeof Endpoints];
      expect(result.display).toBe(endpoint.display);
      expect(result.version).toBe(endpoint.version);
      expect(result.scope).toBe(endpoint.scope);
    }
    // keine URL doppelt
    expect(new Set(calls.map((call) => call.url)).size).toBe(calls.length);
  });

  it('sendet ausschließlich GET an graph.microsoft.com; beta nur für den freigegebenen Endpunkt', async () => {
    const { run, calls } = setup();
    await run();
    for (const call of calls) {
      expect(call.method).toBe('GET');
      expect(call.parsed.protocol).toBe('https:');
      expect(call.parsed.host).toBe('graph.microsoft.com');
    }
    const beta = calls.filter((call) => call.parsed.pathname.startsWith('/beta/'));
    expect(beta).toHaveLength(1);
    expect(beta[0]?.parsed.pathname).toBe(`/beta/users/${USER_ID}/mobileAppIntentAndStates`);
    expect(Object.values(Endpoints).filter((e) => e.version === 'beta')).toHaveLength(1);
  });

  it('nimmt Kennungen für abhängige Aufrufe aus den vorherigen Antworten', async () => {
    const { run, calls } = setup();
    await run();
    const paths = calls.map((call) => decodeURIComponent(call.parsed.pathname));
    expect(paths).toContain(`/v1.0/deviceManagement/deviceConfigurations/${CONFIG_ID}/assignments`);
    expect(paths).toContain(
      `/v1.0/deviceManagement/deviceCompliancePolicies/${POLICY_ID}/assignments`,
    );
    expect(paths).toContain(`/v1.0/deviceAppManagement/mobileApps/${APP_ID}/assignments`);
    expect(paths).toContain(`/v1.0/deviceAppManagement/mobileApps/${APP_ID}`);
    expect(paths).toContain(
      `/v1.0/deviceManagement/deviceEnrollmentConfigurations/${ENROLLMENT_ID}/assignments`,
    );
    // Geräteabhängige Parameter
    expect(paths).toContain(`/v1.0/deviceManagement/managedDevices/${DEVICE_ID}`);
    expect(paths).toContain(`/v1.0/directory/deviceLocalCredentials/${ENTRA_ID}`);
    const queries = calls.map((call) => decodeURIComponent(call.parsed.search));
    expect(queries.some((q) => q.includes(`deviceName eq '${DEVICE_NAME}'`))).toBe(true);
    expect(queries.some((q) => q.includes(`userPrincipalName eq '${UPN}'`))).toBe(true);
    expect(
      queries.some((q) =>
        q.includes(`userId eq '${USER_ID}' and createdDateTime ge 2026-10-08T12:00:00.000Z`),
      ),
    ).toBe(true);
  });

  it('läuft strikt nacheinander (nie zwei Aufrufe gleichzeitig)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const base = contosoHandler();
    const { run } = setup(async (call: FakeCall) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return base(call);
    });
    await run();
    expect(maxInFlight).toBe(1);
  });
});

describe('Verbindungstest – Überspringen', () => {
  it('überspringt Windows-Endpunkte für macOS-Geräte ohne Aufruf', async () => {
    const { run, calls } = setup();
    const results = await run(device({ osFamily: 'macos' }));
    for (const id of [
      'windowsProtectionState',
      'detectedMalwareState',
      'managedDeviceHealthAttestation',
      'deviceLocalCredentialInfo',
      'windowsAutopilotDeviceIdentities',
    ]) {
      const result = byId(results, id);
      expect(result.outcome).toBe('skipped');
      expect(result.skipReason).toBeTruthy();
      expect(result.durationMs).toBeNull();
      expect(result.entryCount).toBeNull();
    }
    expect(calls).toHaveLength(results.filter((r) => r.outcome !== 'skipped').length);
    expect(results).toHaveLength(Object.keys(Endpoints).length);
  });

  it('überspringt Aufrufe ohne primären Benutzer bzw. Entra-Geräte-ID', async () => {
    const { run, calls } = setup();
    const results = await run(
      device({ userId: null, userPrincipalName: null, azureADDeviceId: null }),
    );
    for (const id of [
      'managedDevicesByUser',
      'managedDevicesOfUser',
      'mobileAppIntentAndStates',
      'signIns',
      'userLicenseDetails',
      'entraDeviceByDeviceId',
      'deviceTransitiveMemberOf',
      'bitlockerRecoveryKeys',
      'deviceLocalCredentialInfo',
    ]) {
      expect(byId(results, id).outcome, id).toBe('skipped');
    }
    // abhängig von der übersprungenen App-Liste
    expect(byId(results, 'mobileApp').outcome).toBe('skipped');
    expect(byId(results, 'mobileAppAssignments').outcome).toBe('skipped');
    expect(calls).toHaveLength(results.filter((r) => r.outcome !== 'skipped').length);
  });

  it('behandelt die Null-GUID wie „nicht vorhanden“', async () => {
    const empty = '00000000-0000-0000-0000-000000000000';
    const { run } = setup();
    const results = await run(device({ userId: empty, azureADDeviceId: empty }));
    expect(byId(results, 'signIns').outcome).toBe('skipped');
    expect(byId(results, 'bitlockerRecoveryKeys').outcome).toBe('skipped');
  });

  it('überspringt abhängige Aufrufe, wenn die vorherige Liste leer ist', async () => {
    const { run } = setup(() => collection([]));
    const results = await run();
    for (const id of [
      'mobileApp',
      'mobileAppAssignments',
      'deviceConfigurationAssignments',
      'deviceCompliancePolicyAssignments',
      'deviceEnrollmentConfigurationAssignments',
    ]) {
      expect(byId(results, id).outcome, id).toBe('skipped');
    }
    expect(byId(results, 'managedDevicesByName').entryCount).toBe(0);
    expect(byId(results, 'managedDevicesByName').fieldNames).toEqual([]);
  });
});

describe('Verbindungstest – Ergebnisse', () => {
  it('ordnet HTTP-Fehler den Ergebnissen zu, ohne den Rest zu stoppen', async () => {
    const base = contosoHandler();
    const { run } = setup((call) => {
      const path = call.parsed.pathname;
      if (path.endsWith('/vppTokens')) return graphError(403, 'Forbidden');
      if (path.endsWith('/securityAlerts') || path.endsWith('/alerts_v2')) {
        return graphError(404, 'NotFound');
      }
      if (path.endsWith('/applePushNotificationCertificate')) {
        return graphError(400, 'BadRequest');
      }
      if (path.endsWith('/windowsProtectionState')) return graphError(500, 'InternalServerError');
      return base(call);
    });
    const results = await run();
    expect(byId(results, 'vppTokens')).toMatchObject({ outcome: 'forbidden', httpStatus: 403 });
    expect(byId(results, 'securityAlerts')).toMatchObject({ outcome: 'notFound', httpStatus: 404 });
    expect(byId(results, 'applePushNotificationCertificate')).toMatchObject({
      outcome: 'badRequest',
      httpStatus: 400,
    });
    expect(byId(results, 'windowsProtectionState')).toMatchObject({
      outcome: 'error',
      httpStatus: 500,
    });
    for (const id of ['vppTokens', 'securityAlerts', 'windowsProtectionState']) {
      const result = byId(results, id);
      expect(result.entryCount).toBeNull();
      expect(result.fieldNames).toEqual([]);
      expect(result.durationMs).not.toBeNull();
    }
    expect(byId(results, 'managedDevice').outcome).toBe('ok');
    expect(results).toHaveLength(Object.keys(Endpoints).length);
  });

  it('meldet einen Netzwerkfehler als Fehler ohne HTTP-Status', async () => {
    const base = contosoHandler();
    const { run } = setup((call) => {
      if (call.parsed.pathname.endsWith('/vppTokens')) throw new TypeError('Failed to fetch');
      return base(call);
    });
    const results = await run();
    expect(byId(results, 'vppTokens')).toMatchObject({ outcome: 'error', httpStatus: null });
  });

  it('misst die Dauer mit der übergebenen Uhr', async () => {
    let tick = 0;
    const { run } = setup();
    const results = await run(device(), {
      clock: () => {
        tick += 40;
        return tick;
      },
    });
    expect(results.filter((r) => r.outcome === 'ok').every((r) => r.durationMs === 40)).toBe(true);
  });

  it('zählt Einträge (Sammlung = Länge von value, einzelnes Objekt = 1)', async () => {
    const { run } = setup();
    const results = await run();
    expect(byId(results, 'managedDevice').entryCount).toBe(1);
    expect(byId(results, 'deviceCompliancePolicyStates').entryCount).toBe(1);
  });

  it('liefert nur Namen der Felder auf oberster Ebene – keine Werte, keine IDs, keine Namen', async () => {
    const { run } = setup();
    const results = await run();
    expect(byId(results, 'managedDevice').fieldNames).toEqual([
      'id',
      'deviceName',
      'userPrincipalName',
      'serialNumber',
    ]);
    expect(byId(results, 'vppTokens').fieldNames).toEqual([
      'id',
      'organizationName',
      'token',
      'appleId',
    ]);
    const json = JSON.stringify(results);
    for (const secret of [
      SECRET_VPP_TOKEN,
      SECRET_APPLE_ID,
      DEVICE_ID,
      DEVICE_NAME,
      ENTRA_ID,
      USER_ID,
      POLICY_ID,
      CONFIG_ID,
      APP_ID,
      ENROLLMENT_ID,
      UPN,
      'DEMO-000042',
      'Contoso Geheime',
      'Contoso GmbH',
    ]) {
      expect(json, secret).not.toContain(secret);
    }
    // die Ergebnisobjekte haben genau die erlaubten Felder
    for (const result of results) {
      expect(Object.keys(result).sort()).toEqual(
        [
          'endpointId',
          'display',
          'version',
          'scope',
          'outcome',
          'httpStatus',
          'durationMs',
          'entryCount',
          'fieldNames',
          'skipReason',
        ].sort(),
      );
    }
  });

  it('übergibt jedes Ergebnis sofort an onResult (Fortschritt)', async () => {
    const onResult = vi.fn();
    const { run } = setup();
    const results = await run(device(), { onResult });
    expect(onResult).toHaveBeenCalledTimes(results.length);
    expect(onResult.mock.calls[0]?.[1]).toBe(0);
    expect(onResult.mock.calls[0]?.[2]).toBe(results.length);
    expect(onResult.mock.calls.at(-1)?.[1]).toBe(results.length - 1);
  });
});

describe('Verbindungstest – Abbruch', () => {
  it('bricht nach dem Abbruchsignal ab, ohne weitere Aufrufe zu senden', async () => {
    const controller = new AbortController();
    const seen: string[] = [];
    const { run, calls } = setup();
    await expect(
      run(device(), {
        signal: controller.signal,
        onResult: (result) => {
          seen.push(result.endpointId);
          if (seen.length === 3) controller.abort();
        },
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(seen).toHaveLength(3);
    expect(calls).toHaveLength(3);
  });

  it('startet bei bereits abgebrochenem Signal gar nicht erst', async () => {
    const controller = new AbortController();
    controller.abort();
    const { run, calls } = setup();
    await expect(run(device(), { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(calls).toHaveLength(0);
  });
});

describe('fieldNamesOf / entriesOf', () => {
  it('lässt OData-Metadaten und ungewöhnliche Schlüssel weg und begrenzt die Anzahl', () => {
    const many = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`field${i}`, i]));
    expect(
      fieldNamesOf({ '@odata.context': 'x', '@odata.type': 'y', id: 1, 'a b': 2, 'x@y z': 3 }),
    ).toEqual(['@odata.type', 'id']);
    expect(fieldNamesOf(many)).toHaveLength(MAX_FIELD_NAMES);
    expect(fieldNamesOf(null)).toEqual([]);
    expect(fieldNamesOf([1, 2])).toEqual([]);
    expect(fieldNamesOf('text')).toEqual([]);
  });

  it('liest Einträge aus Sammlungen und einzelnen Objekten', () => {
    expect(entriesOf({ value: [{ a: 1 }, { a: 2 }] })).toHaveLength(2);
    expect(entriesOf({ a: 1 })).toEqual([{ a: 1 }]);
    expect(entriesOf(null)).toEqual([]);
    expect(entriesOf('x')).toEqual([]);
  });
});
