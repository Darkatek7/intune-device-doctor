/**
 * Demo-Provider: liefert fiktive Contoso-Szenarien mit künstlicher, deterministischer Latenz.
 * Verhält sich nach außen exakt wie der GraphProvider (gleiche SectionResult-Formen, gleiche
 * Quellenangaben auf Basis von src/graph/endpoints.ts).
 */
import type {
  DeviceGroupsInfo,
  AutopilotInfo,
  AppError,
  ApplePushCertificateInfo,
  AppInfo,
  AppInstallStateInfo,
  BitLockerKeyInfo,
  DataSource,
  DeviceSearchResult,
  EntraDeviceInfo,
  HealthAttestationInfo,
  LocalAdminInfo,
  ManagedDeviceInfo,
  PolicyStateInfo,
  SectionResult,
  SignInsInfo,
  WindowsProtectionInfo,
} from '../../domain/types';
import { Endpoints, type EndpointId } from '../../graph/endpoints';
import { de } from '../../i18n/de';
import { ProviderError, type DeviceDataProvider, type RequestOptions } from '../DeviceDataProvider';
import { findMockApp } from './apps';
import { scenarios as defaultScenarios } from './scenarios';
import {
  defaultAppStates,
  defaultAutopilot,
  defaultDeviceGroups,
  defaultHealthAttestation,
  defaultLocalAdmin,
  defaultSignIns,
} from './scenarios/helpers';
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
  appInstallStates: 'mobileAppIntentAndStates',
  applePushCertificate: 'applePushNotificationCertificate',
  signIns: 'signIns',
  localAdmin: 'deviceLocalCredentialInfo',
  autopilot: 'windowsAutopilotDeviceIdentities',
  deviceGroups: 'deviceTransitiveMemberOf',
  userDevices: 'managedDevicesOfUser',
  healthAttestation: 'managedDeviceHealthAttestation',
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

function toSearchResult(device: MockDeviceFixture['device']): DeviceSearchResult {
  return {
    id: device.id,
    deviceName: device.deviceName,
    userPrincipalName: device.userPrincipalName,
    userDisplayName: device.userDisplayName,
    operatingSystem: device.operatingSystem,
    osVersion: device.osVersion,
    model: device.model,
    complianceState: device.complianceState,
    lastSyncDateTime: device.lastSyncDateTime,
  };
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
    const byName = all.filter((f) => f.device.deviceName.toLowerCase().includes(q));
    const byUser = all.filter((f) =>
      [f.device.userPrincipalName, f.device.userDisplayName].some((v) =>
        (v ?? '').toLowerCase().includes(q),
      ),
    );
    const hits = exact.length > 0 ? exact : byName.length > 0 ? byName : byUser;
    return hits.map(({ device }) => toSearchResult(device));
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

  /** Standardantwort für optionale Fixture-Sections. */
  private defaultSection(key: SectionKey, fixture: MockDeviceFixture): MockSection<unknown> {
    if (key === 'appInstallStates') {
      return { status: 'ok', data: defaultAppStates(fixture.device) };
    }
    if (key === 'applePushCertificate') {
      const { osFamily } = fixture.device;
      if (osFamily !== 'macos' && osFamily !== 'ios') {
        return { status: 'notApplicable', reason: de.reasons.applePushNotApple };
      }
      const now = this.now();
      const DAY = 24 * 60 * 60 * 1000;
      const data: ApplePushCertificateInfo = {
        expirationDateTime: new Date(now.getTime() + 200 * DAY).toISOString(),
        lastModifiedDateTime: new Date(now.getTime() - 165 * DAY).toISOString(),
      };
      return { status: 'ok', data };
    }
    if (key === 'signIns') {
      if (!fixture.device.userId) {
        return { status: 'notApplicable', reason: de.reasons.signInsNoPrimaryUser };
      }
      return { status: 'ok', data: defaultSignIns(this.now(), fixture.device) };
    }
    if (key === 'localAdmin') {
      if (fixture.device.osFamily !== 'windows') {
        return { status: 'notApplicable', reason: de.reasons.lapsNotWindows };
      }
      return { status: 'ok', data: defaultLocalAdmin(this.now(), fixture.device) };
    }
    if (key === 'autopilot') {
      if (fixture.device.osFamily !== 'windows') {
        return { status: 'notApplicable', reason: de.reasons.autopilotNotWindows };
      }
      return { status: 'ok', data: defaultAutopilot(this.now(), fixture.device) };
    }
    if (key === 'userDevices') {
      const upn = fixture.device.userPrincipalName;
      if (!upn) return { status: 'notApplicable', reason: de.reasons.userDevicesNoUser };
      const others = this.fixtures()
        .filter(
          (f) =>
            f.device.id !== fixture.device.id &&
            f.device.userPrincipalName?.toLowerCase() === upn.toLowerCase(),
        )
        .map(({ device }) => toSearchResult(device))
        .sort((a, b) => a.deviceName.localeCompare(b.deviceName, 'de'));
      return { status: 'ok', data: others };
    }
    if (key === 'healthAttestation') {
      if (fixture.device.osFamily !== 'windows') {
        return { status: 'notApplicable', reason: de.reasons.attestationNotWindows };
      }
      return { status: 'ok', data: defaultHealthAttestation(this.now()) };
    }
    if (key === 'deviceGroups') {
      return { status: 'ok', data: defaultDeviceGroups(fixture.device) };
    }
    throw new Error(`Keine Standardantwort für Section ${key}`);
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
    const spec = (fixture[key] ?? this.defaultSection(key, fixture)) as MockSection<T>;
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

  getAppInstallStates(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<AppInstallStateInfo[]>(device, 'appInstallStates', options);
  }

  getApplePushCertificate(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<ApplePushCertificateInfo>(device, 'applePushCertificate', options);
  }

  getSignIns(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<SignInsInfo>(device, 'signIns', options);
  }

  getUserDevices(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<DeviceSearchResult[]>(device, 'userDevices', options);
  }

  getDeviceGroups(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<DeviceGroupsInfo>(device, 'deviceGroups', options);
  }

  getAutopilot(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<AutopilotInfo | null>(device, 'autopilot', options);
  }

  getHealthAttestation(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<HealthAttestationInfo>(device, 'healthAttestation', options);
  }

  getLocalAdmin(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<LocalAdminInfo>(device, 'localAdmin', options);
  }

  async getMobileApps(
    appIds: string[],
    options: RequestOptions = {},
  ): Promise<SectionResult<AppInfo[]>> {
    await this.delay(`apps:${appIds.join(',')}`, options.signal);
    const apps = [...new Set(appIds.map((id) => id.toLowerCase()))]
      .map((id) => findMockApp(id))
      .filter((app): app is AppInfo => app !== undefined);
    return {
      status: 'ok',
      data: apps,
      source: sourceFor('mobileApp'),
      fetchedAt: this.now().toISOString(),
    };
  }
}
