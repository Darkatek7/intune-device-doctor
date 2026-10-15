/**
 * Test-Hilfen: gemocktes `fetch` für Microsoft Graph mit fiktiven Contoso-Daten.
 * Es findet nie ein Netzwerkzugriff statt. Nur von Tests importiert.
 */
import type {
  GraphBitlockerRecoveryKey,
  GraphDevicePolicyState,
  GraphEntraDevice,
  GraphManagedDevice,
  GraphWindowsDeviceMalwareState,
  GraphWindowsProtectionState,
} from '../../graph/dto';

export interface FakeCall {
  url: string;
  parsed: URL;
  method: string | undefined;
  headers: Record<string, string>;
}

export type FakeHandler = (call: FakeCall) => Response | Promise<Response>;

export function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
}

export function graphError(
  status: number,
  code: string,
  headers: Record<string, string> = {},
  requestId = 'req-1234',
): Response {
  return jsonResponse(
    { error: { code, message: 'ignored', innerError: { 'request-id': requestId } } },
    { status, headers },
  );
}

export function collection<T>(value: T[], nextLink?: string): Response {
  return jsonResponse({ value, ...(nextLink ? { '@odata.nextLink': nextLink } : {}) });
}

/** fetch-Ersatz, der alle Aufrufe protokolliert. */
export function createFakeFetch(handler: FakeHandler) {
  const calls: FakeCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const call: FakeCall = { url, parsed: new URL(url), method: init?.method, headers };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

// ---------- Contoso-Daten ----------

export const PC001_ID = '00000000-0000-4000-8000-000000000001';
export const PC001_ENTRA_ID = '00000000-0000-4000-9000-000000000001';
export const MAC07_ID = '00000000-0000-4000-8000-000000000007';
export const MAC07_ENTRA_ID = '00000000-0000-4000-9000-000000000007';

const HOUR = 3_600_000;
const iso = (hoursAgo: number) => new Date(Date.now() - hoursAgo * HOUR).toISOString();

export function pc001Device(overrides: Partial<GraphManagedDevice> = {}): GraphManagedDevice {
  return {
    id: PC001_ID,
    deviceName: 'CONTOSO-PC001',
    userPrincipalName: 'anna.schmidt@contoso.com',
    userDisplayName: 'Anna Schmidt',
    operatingSystem: 'Windows',
    osVersion: '10.0.26200.9711',
    model: 'Surface Laptop 6',
    manufacturer: 'Microsoft Corporation',
    serialNumber: 'DEMO-000001',
    complianceState: 'compliant',
    complianceGracePeriodExpirationDateTime: null,
    lastSyncDateTime: iso(2),
    enrolledDateTime: iso(24 * 210),
    managementAgent: 'mdm',
    deviceEnrollmentType: 'windowsAzureADJoin',
    isEncrypted: true,
    jailBroken: 'Unknown',
    azureADDeviceId: PC001_ENTRA_ID,
    partnerReportedThreatState: 'secured',
    freeStorageSpaceInBytes: 195_421_011_968,
    totalStorageSpaceInBytes: 511_101_108_224,
    ...overrides,
  };
}

export function mac07Device(): GraphManagedDevice {
  return pc001Device({
    id: MAC07_ID,
    deviceName: 'CONTOSO-MAC07',
    operatingSystem: 'macOS',
    osVersion: '15.6.1',
    model: 'MacBook Pro (14-inch, M3, 2023)',
    manufacturer: 'Apple',
    serialNumber: 'DEMO-MAC0007',
    deviceEnrollmentType: 'appleBulkWithUser',
    azureADDeviceId: MAC07_ENTRA_ID,
  });
}

export function pc001Protection(): GraphWindowsProtectionState {
  return {
    id: PC001_ID,
    malwareProtectionEnabled: true,
    deviceState: 'clean',
    realTimeProtectionEnabled: true,
    networkInspectionSystemEnabled: true,
    quickScanOverdue: false,
    fullScanOverdue: false,
    signatureUpdateOverdue: false,
    rebootRequired: false,
    fullScanRequired: false,
    engineVersion: '1.1.25090.3',
    signatureVersion: '1.441.112.0',
    antiMalwareVersion: '4.18.25090.2',
    lastQuickScanDateTime: iso(9),
    lastFullScanDateTime: iso(24 * 6),
    lastQuickScanSignatureVersion: '1.441.100.0',
    lastFullScanSignatureVersion: '1.441.20.0',
    lastReportedDateTime: iso(2),
    productStatus: 'noStatus',
    isVirtualMachine: false,
    tamperProtectionEnabled: true,
  };
}

export function policyState(
  id: string,
  displayName: string,
  overrides: Partial<GraphDevicePolicyState> = {},
): GraphDevicePolicyState {
  return {
    id,
    displayName,
    version: 1,
    platformType: 'windows10AndLater',
    state: 'compliant',
    settingCount: 2,
    settingStates: [
      {
        setting: 'DeviceCompliance.RequireEncryption',
        settingName: 'Require encryption',
        instanceDisplayName: null,
        state: 'compliant',
        errorCode: 0,
        errorDescription: null,
        userPrincipalName: 'anna.schmidt@contoso.com',
        sources: [{ id: `${id}-src`, displayName }],
        currentValue: 'True',
      },
    ],
    ...overrides,
  };
}

export function pc001Entra(): GraphEntraDevice {
  return {
    id: '00000000-0000-4000-a000-000000000001',
    deviceId: PC001_ENTRA_ID,
    displayName: 'CONTOSO-PC001',
    accountEnabled: true,
    trustType: 'AzureAd',
    approximateLastSignInDateTime: iso(5),
    isCompliant: true,
    isManaged: true,
    operatingSystem: 'Windows',
    operatingSystemVersion: '10.0.26200.9711',
    registrationDateTime: iso(24 * 210),
  };
}

export function bitlockerKey(
  id: string,
  volumeType: GraphBitlockerRecoveryKey['volumeType'] = 'operatingSystemVolume',
): GraphBitlockerRecoveryKey {
  return { id, createdDateTime: iso(24 * 200), deviceId: PC001_ENTRA_ID, volumeType };
}

export function malware(): GraphWindowsDeviceMalwareState {
  return {
    id: 'm-1',
    displayName: 'Contoso Test Threat',
    additionalInformationUrl: null,
    severity: 'low',
    executionState: 'blocked',
    state: 'cleaned',
    threatState: 'cleaned',
    initialDetectionDateTime: iso(48),
    lastStateChangeDateTime: iso(47),
    detectionCount: 1,
    category: 'trojan',
  };
}

export interface ContosoOptions {
  /** Pro Pfad-Suffix (z. B. "/windowsProtectionState") eine eigene Antwort. */
  overrides?: Record<string, (call: FakeCall) => Response | Promise<Response>>;
}

/**
 * Router für CONTOSO-PC001 (Windows, gesund) und CONTOSO-MAC07 (macOS).
 * `overrides` ersetzen die Antwort für Pfade, die auf den jeweiligen Schlüssel enden.
 */
export function contosoHandler(options: ContosoOptions = {}): FakeHandler {
  const devices = [pc001Device(), mac07Device()];
  const base = '/v1.0/deviceManagement/managedDevices';
  return (call) => {
    const path = decodeURIComponent(call.parsed.pathname);
    for (const [suffix, respond] of Object.entries(options.overrides ?? {})) {
      if (path.endsWith(suffix)) return respond(call);
    }
    const filter = call.parsed.searchParams.get('$filter') ?? '';

    if (path === base) {
      const eq = /^deviceName eq '(.*)'$/.exec(filter);
      const contains = /^contains\(deviceName,'(.*)'\)$/.exec(filter);
      const name = (eq?.[1] ?? contains?.[1] ?? '').replace(/''/g, "'").toLowerCase();
      if (eq) return collection(devices.filter((d) => d.deviceName?.toLowerCase() === name));
      if (contains)
        return collection(devices.filter((d) => d.deviceName?.toLowerCase().includes(name)));
      return collection(devices);
    }

    const match = new RegExp(`^${base}/([^/]+)(/.*)?$`).exec(path);
    if (match) {
      const device = devices.find((d) => d.id === match[1]);
      if (!device) return graphError(404, 'ResourceNotFound');
      switch (match[2]) {
        case undefined:
          return jsonResponse(device);
        case '/windowsProtectionState':
          return device.id === PC001_ID
            ? jsonResponse(pc001Protection())
            : graphError(404, 'NotFound');
        case '/windowsProtectionState/detectedMalwareState':
          return collection([]);
        case '/deviceCompliancePolicyStates':
          return collection([policyState('c-1', 'Contoso – Windows 11 Basis-Compliance')]);
        case '/deviceConfigurationStates':
          return collection([policyState('k-1', 'Contoso – WLAN Firmennetz')]);
      }
    }

    if (path === '/v1.0/devices') {
      const id = /^deviceId eq '(.*)'$/.exec(filter)?.[1];
      if (id === MAC07_ENTRA_ID) {
        return collection([
          {
            ...pc001Entra(),
            id: '00000000-0000-4000-a000-000000000007',
            deviceId: MAC07_ENTRA_ID,
            displayName: 'CONTOSO-MAC07',
            trustType: 'Workplace' as const,
            operatingSystem: 'MacMDM',
          },
        ]);
      }
      return collection(id === PC001_ENTRA_ID ? [pc001Entra()] : []);
    }
    if (path === '/v1.0/informationProtection/bitlocker/recoveryKeys') {
      const id = /^deviceId eq '(.*)'$/.exec(filter)?.[1];
      return collection(id === PC001_ENTRA_ID ? [bitlockerKey('k-1', 1)] : []);
    }
    return graphError(404, 'NotFound');
  };
}
