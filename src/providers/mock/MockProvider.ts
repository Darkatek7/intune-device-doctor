/**
 * Demo-Provider: liefert fiktive Contoso-Szenarien mit künstlicher, deterministischer Latenz.
 * Verhält sich nach außen exakt wie der GraphProvider (gleiche SectionResult-Formen, gleiche
 * Quellenangaben auf Basis von src/graph/endpoints.ts).
 */
import type {
  AppError,
  BitLockerKeyInfo,
  DataSource,
  DeviceSearchResult,
  EntraDeviceInfo,
  ManagedDeviceInfo,
  PolicyStateInfo,
  SectionResult,
  WindowsProtectionInfo,
} from '../../domain/types';
import { Endpoints, type EndpointId } from '../../graph/endpoints';
import { de } from '../../i18n/de';
import { ProviderError, type DeviceDataProvider, type RequestOptions } from '../DeviceDataProvider';
import { scenarios as defaultScenarios } from './scenarios';
import type { MockDeviceFixture, MockScenario, MockSection } from './types';

export interface MockProviderOptions {
  scenarios?: MockScenario[];
  now?: () => Date;
  /** Künstliche Latenz je Aufruf in ms; false = keine Latenz (Tests) */
  latency?: { min: number; max: number } | false;
  seed?: number;
}

type SectionKey = Exclude<keyof MockDeviceFixture, 'device'>;

const SECTION_ENDPOINT: Record<SectionKey, EndpointId> = {
  protection: 'windowsProtectionState',
  compliancePolicies: 'deviceCompliancePolicyStates',
  configurationPolicies: 'deviceConfigurationStates',
  entraDevice: 'entraDeviceByDeviceId',
  bitlockerKeys: 'bitlockerRecoveryKeys',
};

export function abortError(): DOMException {
  return new DOMException(de.errors.aborted, 'AbortError');
}

/** FNV-1a – deterministischer Hash für die Latenz. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    if (ms <= 0) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function sourceFor(endpoint: EndpointId): DataSource {
  const def = Endpoints[endpoint];
  return { kind: 'mock', label: def.display, docsUrl: def.docsUrl };
}

export class MockProvider implements DeviceDataProvider {
  readonly mode = 'demo' as const;
  private readonly scenarios: MockScenario[];
  private readonly now: () => Date;
  private readonly latency: { min: number; max: number } | false;
  private readonly seed: number;

  constructor(options: MockProviderOptions = {}) {
    this.scenarios = options.scenarios ?? defaultScenarios;
    this.now = options.now ?? (() => new Date());
    this.latency = options.latency ?? { min: 120, max: 600 };
    this.seed = options.seed ?? 42;
  }

  private delay(key: string, signal?: AbortSignal): Promise<void> {
    if (!this.latency) return sleep(0, signal);
    const { min, max } = this.latency;
    const ms = min + (hash(`${this.seed}:${key}`) % Math.max(1, max - min + 1));
    return sleep(ms, signal);
  }

  private fixtures(): MockDeviceFixture[] {
    const now = this.now();
    return this.scenarios.map((s) => s.build(now));
  }

  private fixtureById(id: string): MockDeviceFixture | undefined {
    return this.fixtures().find((f) => f.device.id === id);
  }

  async searchDevices(query: string, options: RequestOptions = {}): Promise<DeviceSearchResult[]> {
    await this.delay(`search:${query}`, options.signal);
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const all = this.fixtures();
    const exact = all.filter((f) => f.device.deviceName.toLowerCase() === q);
    const hits =
      exact.length > 0 ? exact : all.filter((f) => f.device.deviceName.toLowerCase().includes(q));
    return hits.map(({ device }) => ({
      id: device.id,
      deviceName: device.deviceName,
      userPrincipalName: device.userPrincipalName,
      userDisplayName: device.userDisplayName,
      operatingSystem: device.operatingSystem,
      osVersion: device.osVersion,
      model: device.model,
      complianceState: device.complianceState,
      lastSyncDateTime: device.lastSyncDateTime,
    }));
  }

  async getDevice(
    managedDeviceId: string,
    options: RequestOptions = {},
  ): Promise<ManagedDeviceInfo> {
    await this.delay(`device:${managedDeviceId}`, options.signal);
    const fixture = this.fixtureById(managedDeviceId);
    if (!fixture) {
      throw new ProviderError({
        code: 'notFound',
        httpStatus: 404,
        message: de.errors.deviceNotFound,
      });
    }
    return { ...fixture.device, source: sourceFor('managedDevice') };
  }

  private async section<T>(
    device: ManagedDeviceInfo,
    key: SectionKey,
    options: RequestOptions,
  ): Promise<SectionResult<T>> {
    await this.delay(`${key}:${device.id}`, options.signal);
    const endpoint = SECTION_ENDPOINT[key];
    const source = sourceFor(endpoint);
    const fixture = this.fixtureById(device.id);
    if (!fixture) {
      const error: AppError = {
        code: 'notFound',
        httpStatus: 404,
        message: de.errors.deviceNotFound,
      };
      return { status: 'error', error, source };
    }
    const spec = fixture[key] as MockSection<T>;
    switch (spec.status) {
      case 'ok':
        return { status: 'ok', data: spec.data, source, fetchedAt: this.now().toISOString() };
      case 'forbidden':
        return {
          status: 'forbidden',
          source,
          error: {
            code: 'forbidden',
            httpStatus: 403,
            graphCode: spec.graphCode ?? 'Authorization_RequestDenied',
            message: de.errors.forbidden,
            requiredScope: Endpoints[endpoint].scope,
          },
        };
      case 'notApplicable':
      case 'unavailable':
        return { status: spec.status, reason: spec.reason, source };
      case 'error':
        return { status: 'error', error: spec.error, source };
    }
  }

  getProtectionState(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<WindowsProtectionInfo>(device, 'protection', options);
  }

  getCompliancePolicyStates(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<PolicyStateInfo[]>(device, 'compliancePolicies', options);
  }

  getConfigurationPolicyStates(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<PolicyStateInfo[]>(device, 'configurationPolicies', options);
  }

  getEntraDevice(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<EntraDeviceInfo | null>(device, 'entraDevice', options);
  }

  getBitLockerKeys(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<BitLockerKeyInfo[]>(device, 'bitlockerKeys', options);
  }
}
