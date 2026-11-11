/**
 * Demo-Provider: liefert fiktive Contoso-Szenarien mit künstlicher, deterministischer Latenz.
 * Verhält sich nach außen exakt wie der GraphProvider (gleiche SectionResult-Formen, gleiche
 * Quellenangaben auf Basis von src/graph/endpoints.ts).
 */
import type {
  EnrollmentFailuresInfo,
  EnrollmentLimitsInfo,
  ServiceHealthInfo,
  SecurityAlertsInfo,
  TenantStatus,
  TenantPolicies,
  TenantPolicyInfo,
  TenantPolicyKind,
  TenantPolicyList,
  PolicyDeviceStatusesInfo,
  VppTokenInfo,
  UserLicenseInfo,
  AssignmentLookup,
  AssignmentsInfo,
  DeviceGroupsInfo,
  DuplicateDevicesInfo,
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
import {
  ASSIGNMENTS_DISPLAY,
  Endpoints,
  MAX_ASSIGNMENT_LOOKUPS,
  MAX_POLICY_OVERVIEWS,
  type EndpointId,
} from '../../graph/endpoints';
import { matchesSerialNumber } from '../../domain/search';
import { de } from '../../i18n/de';
import { ProviderError, type DeviceDataProvider, type RequestOptions } from '../DeviceDataProvider';
import { findMockApp } from './apps';
import { buildMockPolicies, policyKey } from './policies';
import { defaultEnrollmentFailures, defaultServiceHealth } from './service';
import { scenarios as defaultScenarios } from './scenarios';
import {
  defaultAppStates,
  defaultAssignments,
  defaultEnrollmentLimits,
  defaultSecurityAlerts,
  defaultTenantApplePush,
  defaultVppTokens,
  userLicenseInfo,
  defaultAutopilot,
  defaultDeviceGroups,
  defaultDuplicateDevices,
  defaultHealthAttestation,
  defaultLocalAdmin,
  defaultSignIns,
} from './scenarios/helpers';
import type { MockDeviceFixture, MockScenario, MockSection, MockTenantFixture } from './types';

export interface MockProviderOptions {
  scenarios?: MockScenario[];
  now?: () => Date;
  /** Künstliche Latenz je Aufruf in ms; false = keine Latenz (Tests) */
  latency?: { min: number; max: number } | false;
  seed?: number;
  /** Demo-Daten der Ansicht „Mandant“ (M14/S5); ohne Angabe: Standardwerte */
  tenant?: MockTenantFixture;
}

type SectionKey = Exclude<keyof MockDeviceFixture, 'device' | 'assignments' | 'assignmentTargets'>;

const SECTION_ENDPOINT: Record<SectionKey, EndpointId> = {
  protection: 'windowsProtectionState',
  compliancePolicies: 'deviceCompliancePolicyStates',
  configurationPolicies: 'deviceConfigurationStates',
  entraDevice: 'entraDeviceByDeviceId',
  duplicateDevices: 'entraDevicesByName',
  bitlockerKeys: 'bitlockerRecoveryKeys',
  appInstallStates: 'mobileAppIntentAndStates',
  applePushCertificate: 'applePushNotificationCertificate',
  signIns: 'signIns',
  localAdmin: 'deviceLocalCredentialInfo',
  autopilot: 'windowsAutopilotDeviceIdentities',
  deviceGroups: 'deviceTransitiveMemberOf',
  userDevices: 'managedDevicesOfUser',
  healthAttestation: 'managedDeviceHealthAttestation',
  userLicense: 'userLicenseDetails',
  enrollmentLimits: 'deviceEnrollmentConfigurations',
  securityAlerts: 'securityAlerts',
  enrollmentFailures: 'troubleshootingEvents',
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
    serialNumber: device.serialNumber,
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
  private readonly tenant: MockTenantFixture;

  constructor(options: MockProviderOptions = {}) {
    this.scenarios = options.scenarios ?? defaultScenarios;
    this.now = options.now ?? (() => new Date());
    this.latency = options.latency ?? { min: 120, max: 600 };
    this.seed = options.seed ?? 42;
    this.tenant = options.tenant ?? {};
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
    const bySerial = all.filter((f) => matchesSerialNumber(f.device.serialNumber, query));
    const byUser = all.filter((f) =>
      [f.device.userPrincipalName, f.device.userDisplayName].some((v) =>
        (v ?? '').toLowerCase().includes(q),
      ),
    );
    const hits =
      exact.length > 0
        ? exact
        : byName.length > 0
          ? byName
          : bySerial.length > 0
            ? bySerial
            : byUser;
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
    if (key === 'userLicense') {
      if (!fixture.device.userId) {
        return { status: 'notApplicable', reason: de.reasons.licenseNoPrimaryUser };
      }
      return { status: 'ok', data: userLicenseInfo() };
    }
    if (key === 'enrollmentLimits') {
      if (!fixture.device.userId) {
        return { status: 'notApplicable', reason: de.reasons.enrollmentLimitsNoPrimaryUser };
      }
      return { status: 'ok', data: defaultEnrollmentLimits() };
    }
    if (key === 'securityAlerts') {
      return { status: 'ok', data: defaultSecurityAlerts() };
    }
    if (key === 'enrollmentFailures') {
      const userId = fixture.device.userId;
      if (!userId) {
        return { status: 'notApplicable', reason: de.service.reasons.enrollmentFailuresNoUser };
      }
      const tenant = this.tenantEnrollmentFailures();
      if (tenant.status !== 'ok') return tenant;
      return {
        status: 'ok',
        data: {
          ...tenant.data,
          events: tenant.data.events.filter(
            (event) => event.userId?.toLowerCase() === userId.toLowerCase(),
          ),
          filteredUserId: userId,
        },
      };
    }
    if (key === 'duplicateDevices') {
      const entra = fixture.entraDevice;
      if (entra.status !== 'ok') {
        return { status: 'unavailable', reason: de.reasons.duplicatesNotReported };
      }
      return { status: 'ok', data: defaultDuplicateDevices(entra.data, fixture.device) };
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
    return this.fromSpec(spec, endpoint, source);
  }

  /** Übersetzt die Fixture-Angabe einer Section in ein SectionResult. */
  private fromSpec<T>(
    spec: MockSection<T>,
    endpoint: EndpointId,
    source: DataSource,
  ): SectionResult<T> {
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

  getDuplicateDevices(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<DuplicateDevicesInfo>(device, 'duplicateDevices', options);
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

  getUserLicense(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<UserLicenseInfo>(device, 'userLicense', options);
  }

  private tenantEnrollmentFailures(): MockSection<EnrollmentFailuresInfo> {
    return (
      this.tenant.enrollmentFailures ?? {
        status: 'ok',
        data: defaultEnrollmentFailures(this.now()),
      }
    );
  }

  private serviceHealthResult(): SectionResult<ServiceHealthInfo> {
    return this.fromSpec<ServiceHealthInfo>(
      this.tenant.serviceHealth ?? { status: 'ok', data: defaultServiceHealth(this.now()) },
      'serviceHealthOverviews',
      sourceFor('serviceHealthOverviews'),
    );
  }

  /** Dienststatus (M18): Standard mit offenem Intune-Vorfall oder `options.tenant.serviceHealth`. */
  async getServiceHealth(options: RequestOptions = {}): Promise<SectionResult<ServiceHealthInfo>> {
    await this.delay('serviceHealth', options.signal);
    return this.serviceHealthResult();
  }

  getEnrollmentFailures(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<EnrollmentFailuresInfo>(device, 'enrollmentFailures', options);
  }

  /** Mandanten-Status: Standard oder `options.tenant` (siehe MockTenantFixture). */
  async getTenantStatus(options: RequestOptions = {}): Promise<TenantStatus> {
    await this.delay('tenant', options.signal);
    const now = this.now();
    return {
      serviceHealth: this.serviceHealthResult(),
      enrollmentFailures: this.fromSpec<EnrollmentFailuresInfo>(
        this.tenantEnrollmentFailures(),
        'troubleshootingEvents',
        sourceFor('troubleshootingEvents'),
      ),
      applePushCertificate: this.fromSpec<ApplePushCertificateInfo>(
        this.tenant.applePushCertificate ?? { status: 'ok', data: defaultTenantApplePush(now) },
        'applePushNotificationCertificate',
        sourceFor('applePushNotificationCertificate'),
      ),
      vppTokens: this.fromSpec<VppTokenInfo[]>(
        this.tenant.vppTokens ?? { status: 'ok', data: defaultVppTokens(now) },
        'vppTokens',
        sourceFor('vppTokens'),
      ),
    };
  }

  /**
   * Richtlinien (M15): aus den Demo-Geräten abgeleitet (siehe policies.ts) oder `options.tenant`. Wie
   * live: Zähler nur für die `policyOverviewLimit` zuletzt geänderten Richtlinien, der Rest null.
   */
  async getTenantPolicies(options: RequestOptions = {}): Promise<TenantPolicies> {
    await this.delay('policies', options.signal);
    const now = this.now();
    const derived = buildMockPolicies(this.fixtures(), now);
    const limit = this.tenant.policyOverviewLimit ?? MAX_POLICY_OVERVIEWS;
    const listOf = (kind: TenantPolicyKind): TenantPolicyList => ({
      policies: [...derived.values()]
        .filter((entry) => entry.policy.kind === kind)
        .map((entry) => ({ ...entry.policy, overview: null })),
      truncated: false,
    });
    const configurations = this.fromSpec<TenantPolicyList>(
      this.tenant.configurations ?? { status: 'ok', data: listOf('configuration') },
      'deviceConfigurations',
      sourceFor('deviceConfigurations'),
    );
    const compliancePolicies = this.fromSpec<TenantPolicyList>(
      this.tenant.compliancePolicies ?? { status: 'ok', data: listOf('compliance') },
      'deviceCompliancePolicies',
      sourceFor('deviceCompliancePolicies'),
    );
    const all = [configurations, compliancePolicies].flatMap((list) =>
      list.status === 'ok' ? list.data.policies : [],
    );
    const time = (policy: TenantPolicyInfo) =>
      policy.lastModifiedDateTime ? Date.parse(policy.lastModifiedDateTime) : 0;
    const chosen = new Set([...all].sort((a, b) => time(b) - time(a)).slice(0, limit));
    const fetchedAt = now.toISOString();
    const withOverviews = (
      list: SectionResult<TenantPolicyList>,
    ): SectionResult<TenantPolicyList> => {
      if (list.status !== 'ok') return list;
      const policies = list.data.policies.map((policy): TenantPolicyInfo => {
        if (!chosen.has(policy)) return { ...policy, overview: null };
        if (policy.overview) return policy;
        const data = derived.get(policyKey(policy.kind, policy.id))?.overview;
        const endpoint: EndpointId =
          policy.kind === 'configuration'
            ? 'deviceConfigurationDeviceStatusOverview'
            : 'deviceCompliancePolicyDeviceStatusOverview';
        return {
          ...policy,
          overview: data
            ? { status: 'ok', data, source: sourceFor(endpoint), fetchedAt }
            : {
                status: 'unavailable',
                reason: de.policies.reasons.overviewNotFound,
                source: sourceFor(endpoint),
              },
        };
      });
      return { ...list, data: { ...list.data, policies } };
    };
    return {
      configurations: withOverviews(configurations),
      compliancePolicies: withOverviews(compliancePolicies),
      overviewLimit: limit,
    };
  }

  /** Gerätestatus einer Demo-Richtlinie; unbekannte Richtlinie → unavailable (wie 404 live). */
  async getPolicyDeviceStatuses(
    policy: { kind: TenantPolicyKind; id: string },
    options: RequestOptions = {},
  ): Promise<SectionResult<PolicyDeviceStatusesInfo>> {
    await this.delay(`policyStatuses:${policy.kind}:${policy.id}`, options.signal);
    const endpoint: EndpointId =
      policy.kind === 'configuration'
        ? 'deviceConfigurationDeviceStatuses'
        : 'deviceCompliancePolicyDeviceStatuses';
    const key = policyKey(policy.kind, policy.id);
    const override = this.tenant.policyStatuses?.[key];
    if (override) return this.fromSpec(override, endpoint, sourceFor(endpoint));
    const entry = buildMockPolicies(this.fixtures(), this.now()).get(key);
    if (!entry) {
      return {
        status: 'unavailable',
        reason: de.policies.reasons.statusesNotFound,
        source: sourceFor(endpoint),
      };
    }
    return this.fromSpec<PolicyDeviceStatusesInfo>(
      { status: 'ok', data: { entries: entry.statuses, truncated: false, pagesRead: 1 } },
      endpoint,
      sourceFor(endpoint),
    );
  }

  getSecurityAlerts(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<SecurityAlertsInfo>(device, 'securityAlerts', options);
  }

  getEnrollmentLimits(device: ManagedDeviceInfo, options: RequestOptions = {}) {
    return this.section<EnrollmentLimitsInfo>(device, 'enrollmentLimits', options);
  }

  /** Zuweisungen: Standard oder Szenario-Vorgabe (siehe MockDeviceFixture.assignments/assignmentTargets). */
  async getAssignments(
    device: ManagedDeviceInfo,
    lookups: AssignmentLookup[],
    options: RequestOptions = {},
  ): Promise<SectionResult<AssignmentsInfo>> {
    await this.delay(`assignments:${device.id}`, options.signal);
    const source: DataSource = {
      ...sourceFor('deviceConfigurationAssignments'),
      label: ASSIGNMENTS_DISPLAY,
    };
    const fixture = this.fixtureById(device.id);
    if (!fixture) {
      return {
        status: 'error',
        error: { code: 'notFound', httpStatus: 404, message: de.errors.deviceNotFound },
        source,
      };
    }
    if (lookups.length === 0) {
      return { status: 'notApplicable', reason: de.reasons.assignmentsNothingToCheck, source };
    }
    const spec: MockSection<AssignmentsInfo> = fixture.assignments ?? {
      status: 'ok',
      data: defaultAssignments(lookups.slice(0, MAX_ASSIGNMENT_LOOKUPS), fixture.assignmentTargets),
    };
    return this.fromSpec(spec, 'deviceConfigurationAssignments', source);
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
