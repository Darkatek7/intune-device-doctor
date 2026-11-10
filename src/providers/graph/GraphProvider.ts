/**
 * Live-Provider: liest Gerätedaten read-only über Microsoft Graph (nur GET, nur Endpunkte aus
 * src/graph/endpoints.ts). Section-Methoden werfen nie (außer bei Abort) – Fehler werden zu
 * SectionResult forbidden / notApplicable / unavailable / error.
 */
import type {
  AppError,
  AssignmentLookup,
  AssignmentObjectInfo,
  AssignmentsInfo,
  EnrollmentFailuresInfo,
  EnrollmentLimitsInfo,
  ServiceHealthInfo,
  UserLicenseInfo,
  HealthAttestationInfo,
  DeviceGroupsInfo,
  DuplicateDevicesInfo,
  AutopilotInfo,
  ApplePushCertificateInfo,
  AppInfo,
  AppInstallStateInfo,
  BitLockerKeyInfo,
  DataSource,
  DeviceSearchResult,
  EndpointProbeResult,
  EntraDeviceInfo,
  LocalAdminInfo,
  ManagedDeviceInfo,
  PolicyStateInfo,
  SectionResult,
  SecurityAlertsInfo,
  SignInsInfo,
  TenantStatus,
  TenantPolicies,
  TenantPolicyInfo,
  TenantPolicyKind,
  ComplianceSettingSummariesInfo,
  DeviceStateSummaryInfo,
  TenantPolicyList,
  PolicyDeviceOverview,
  PolicyDeviceStatusesInfo,
  VppTokenInfo,
  WindowsProtectionInfo,
} from '../../domain/types';
import { matchesSerialNumber } from '../../domain/search';
import { runConnectionTest } from '../../graph/connectionTest';
import {
  createGraphClient,
  GraphRequestError,
  type GraphClient,
  type GraphClientOptions,
} from '../../graph/client';
import type {
  GraphApplePushNotificationCertificate,
  GraphBitlockerRecoveryKey,
  GraphAssignment,
  GraphCollection,
  GraphDeviceEnrollmentConfiguration,
  GraphDeviceLocalCredentialInfo,
  GraphDevicePolicyState,
  GraphDirectoryObject,
  GraphEntraDevice,
  GraphLicenseDetails,
  GraphSecurityAlert,
  GraphServiceHealth,
  GraphTroubleshootingEvent,
  GraphVppToken,
  GraphPolicyDeviceOverview,
  GraphPolicyDeviceStatus,
  GraphTenantPolicy,
  GraphManagedDevice,
  GraphManagedDeviceHealthAttestation,
  GraphMobileApp,
  GraphMobileAppIntentAndState,
  GraphSignIn,
  GraphWindowsAutopilotDeviceIdentity,
  GraphWindowsDeviceMalwareState,
  GraphWindowsProtectionState,
  GraphComplianceSettingStateSummary,
  GraphDeviceStateSummary,
} from '../../graph/dto';
import {
  ASSIGNMENTS_DISPLAY,
  ASSIGNMENT_LOOKUP_CONCURRENCY,
  Endpoints,
  MAX_ASSIGNMENT_LOOKUPS,
  MAX_ENROLLMENT_LIMIT_CONFIGS,
  MAX_LIST_PAGES,
  MAX_POLICY_OVERVIEWS,
  MAX_POLICY_STATUS_PAGES,
  POLICY_OVERVIEW_CONCURRENCY,
  MAX_SECURITY_ALERT_PAGES,
  MAX_SERVICE_HEALTH_PAGES,
  MAX_TROUBLESHOOTING_EVENT_PAGES,
  MAX_SETTING_SUMMARY_PAGES,
  SIGN_IN_WINDOW_DAYS,
  type EndpointId,
} from '../../graph/endpoints';
import {
  graphSource,
  isEnrollmentLimitConfig,
  isGuid,
  mapApplePushCertificate,
  mapAssignments,
  mapAppInstallStates,
  mapAutopilot,
  mapDeviceGroups,
  mapDuplicateDevices,
  mapUserDevices,
  mapBitlockerKey,
  mapEnrollmentFailures,
  mapEnrollmentLimits,
  mapServiceHealth,
  mapEntraDevice,
  mapHealthAttestation,
  mapLocalAdmin,
  mapManagedDevice,
  mapMobileApp,
  mapPolicyDeviceStatuses,
  mapPolicyOverview,
  mapPolicyState,
  mapSearchResult,
  mapTenantPolicies,
  mapSignIns,
  mapSecurityAlerts,
  mapUserLicense,
  mapVppTokens,
  mapWindowsProtection,
  mapComplianceSettingSummaries,
  mapDeviceStateSummary,
} from '../../graph/mappers';
import { de } from '../../i18n/de';
import { ProviderError, type DeviceDataProvider, type RequestOptions } from '../DeviceDataProvider';

const MAX_SEARCH_RESULTS = 25;
/** Höchstens so viele App-Namen je Aufruf nachschlagen (nur fehlgeschlagene/auffällige Apps). */
const MAX_APP_LOOKUPS = 25;
const APP_LOOKUP_CONCURRENCY = 4;
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

export interface GraphProviderOptions {
  client: GraphClient;
  now?: () => Date;
  /** Hinweis-Logger (z. B. beim Such-Fallback); Standard: console.info */
  log?: (message: string) => void;
}

export type GraphProviderFactoryOptions = Omit<GraphClientOptions, 'getToken'> &
  Omit<GraphProviderOptions, 'client'>;

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Beliebigen Fehler (außer Abort) in einen AppError übersetzen. */
function toAppError(error: unknown): AppError {
  if (error instanceof GraphRequestError) return error.error;
  return { code: 'unknown', message: de.errors.unknown };
}

function usableAzureAdId(device: ManagedDeviceInfo): string | null {
  const id = device.azureADDeviceId?.trim();
  return id && id !== EMPTY_GUID ? id : null;
}

export class GraphProvider implements DeviceDataProvider {
  readonly mode = 'live' as const;
  private readonly client: GraphClient;
  private readonly now: () => Date;
  private readonly log: (message: string) => void;

  constructor(options: GraphProviderOptions) {
    this.client = options.client;
    this.now = options.now ?? (() => new Date());
    this.log = options.log ?? ((message) => console.info(message));
  }

  // ---------- Suche & Gerät (werfen ProviderError) ----------

  async searchDevices(query: string, options: RequestOptions = {}): Promise<DeviceSearchResult[]> {
    const name = query.trim();
    if (!name) return [];
    const { signal } = options;
    const scope = Endpoints.managedDevicesByName.scope;
    const search = async (path: string): Promise<GraphManagedDevice[] | 'badRequest'> => {
      try {
        const page = await this.client.get<GraphCollection<GraphManagedDevice>>(path, {
          signal,
          scope,
        });
        return page?.value ?? [];
      } catch (error) {
        if (error instanceof GraphRequestError && error.error.httpStatus === 400) {
          return 'badRequest';
        }
        throw error;
      }
    };

    const listAll = () =>
      this.client.getAllPages<GraphManagedDevice>(Endpoints.managedDevicesList.path(), {
        signal,
        scope,
        maxPages: MAX_LIST_PAGES,
      });
    const needle = name.toLowerCase();
    const byUser = (d: GraphManagedDevice) =>
      [d.userPrincipalName, d.userDisplayName].some((v) =>
        (v ?? '').toLowerCase().includes(needle),
      );
    const results = (devices: GraphManagedDevice[]) =>
      devices.slice(0, MAX_SEARCH_RESULTS).map(mapSearchResult);

    try {
      // UPN (Gerätenamen enthalten kein "@"): dokumentierter eq-Filter auf userPrincipalName
      if (name.includes('@')) {
        const byUpn = await search(Endpoints.managedDevicesByUser.path(name));
        if (Array.isArray(byUpn) && byUpn.length > 0) return results(byUpn);
        // Kein Treffer oder Filter abgelehnt → Teil-UPN clientseitig über die Geräteliste
        return results((await listAll()).filter(byUser));
      }

      // 1) exakter Name
      const exact = await search(Endpoints.managedDevicesByName.path(name));
      if (Array.isArray(exact) && exact.length > 0) return results(exact);

      // 2) Teilstring
      const contains = await search(Endpoints.managedDevicesByNameContains.path(name));
      if (Array.isArray(contains) && contains.length > 0) return results(contains);

      // 3) Clientseitig über die paginierte Liste: Gerätename (falls $filter abgelehnt wurde),
      //    dann Seriennummer, sonst Benutzer – für serialNumber und userDisplayName ist kein
      //    $filter dokumentiert.
      if (contains === 'badRequest') {
        this.log(
          'Graph lehnt $filter auf deviceName ab (HTTP 400) – Suche läuft clientseitig über die Geräteliste.',
        );
      }
      const all = await listAll();
      if (contains === 'badRequest') {
        const hits = all.filter((d) => (d.deviceName ?? '').toLowerCase().includes(needle));
        const exactHits = hits.filter((d) => (d.deviceName ?? '').toLowerCase() === needle);
        if (hits.length > 0) return results(exactHits.length > 0 ? exactHits : hits);
      }
      const bySerial = all.filter((d) => matchesSerialNumber(d.serialNumber, name));
      if (bySerial.length > 0) return results(bySerial);
      return results(all.filter(byUser));
    } catch (error) {
      if (isAbort(error)) throw error;
      throw new ProviderError(toAppError(error));
    }
  }

  async getDevice(
    managedDeviceId: string,
    options: RequestOptions = {},
  ): Promise<ManagedDeviceInfo> {
    try {
      const dto = await this.client.get<GraphManagedDevice>(
        Endpoints.managedDevice.path(managedDeviceId),
        { signal: options.signal, scope: Endpoints.managedDevice.scope },
      );
      return mapManagedDevice(dto);
    } catch (error) {
      if (isAbort(error)) throw error;
      const appError = toAppError(error);
      throw new ProviderError(
        appError.code === 'notFound'
          ? { ...appError, message: de.errors.deviceNotFound }
          : appError,
      );
    }
  }

  // ---------- Sections (werfen nie, außer Abort) ----------

  private ok<T>(data: T, source: DataSource): SectionResult<T> {
    return { status: 'ok', data, source, fetchedAt: this.now().toISOString() };
  }

  /** Führt eine Section aus und übersetzt Fehler in ein SectionResult. */
  private async run<T>(
    endpoint: EndpointId,
    load: (source: DataSource) => Promise<SectionResult<T>>,
    onNotFound?: (source: DataSource) => SectionResult<T>,
  ): Promise<SectionResult<T>> {
    const source = graphSource(endpoint);
    try {
      return await load(source);
    } catch (error) {
      if (isAbort(error)) throw error;
      const appError = toAppError(error);
      if (appError.code === 'notFound' && onNotFound) return onNotFound(source);
      if (appError.code === 'forbidden') {
        return {
          status: 'forbidden',
          source,
          error: {
            ...appError,
            requiredScope: appError.requiredScope ?? Endpoints[endpoint].scope,
          },
        };
      }
      return { status: 'error', source, error: appError };
    }
  }

  getProtectionState(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<WindowsProtectionInfo>> {
    const endpoint = Endpoints.windowsProtectionState;
    return this.run<WindowsProtectionInfo>(
      'windowsProtectionState',
      async (source) => {
        if (device.osFamily !== 'windows') {
          return { status: 'notApplicable', reason: de.reasons.defenderNotWindows, source };
        }
        const state = await this.client.get<GraphWindowsProtectionState>(endpoint.path(device.id), {
          signal: options.signal,
          scope: endpoint.scope,
        });
        // Fehler bei der Malware-Liste kippen nicht die ganze Section.
        let malware: GraphWindowsDeviceMalwareState[] = [];
        let malwareError: AppError | undefined;
        try {
          malware = await this.client.getAllPages<GraphWindowsDeviceMalwareState>(
            Endpoints.detectedMalwareState.path(device.id),
            { signal: options.signal, scope: Endpoints.detectedMalwareState.scope },
          );
        } catch (error) {
          if (isAbort(error)) throw error;
          // Keine falsche Entwarnung: der Fehler wird im Befund ausgewiesen.
          malwareError = toAppError(error);
        }
        const info = mapWindowsProtection(state, malware);
        return this.ok(
          malwareError ? { ...info, detectedMalwareError: malwareError } : info,
          source,
        );
      },
      (source) => ({ status: 'unavailable', reason: de.reasons.defenderNotReported, source }),
    );
  }

  getCompliancePolicyStates(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<PolicyStateInfo[]>> {
    const endpoint = Endpoints.deviceCompliancePolicyStates;
    return this.run<PolicyStateInfo[]>(
      'deviceCompliancePolicyStates',
      async (source) => {
        const states = await this.client.getAllPages<GraphDevicePolicyState>(
          endpoint.path(device.id),
          { signal: options.signal, scope: endpoint.scope },
        );
        return this.ok(
          states.map((state) => mapPolicyState(state, 'compliance')),
          source,
        );
      },
      (source) => ({
        status: 'unavailable',
        reason: de.reasons.compliancePoliciesNotReported,
        source,
      }),
    );
  }

  getConfigurationPolicyStates(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<PolicyStateInfo[]>> {
    const endpoint = Endpoints.deviceConfigurationStates;
    return this.run<PolicyStateInfo[]>(
      'deviceConfigurationStates',
      async (source) => {
        const states = await this.client.getAllPages<GraphDevicePolicyState>(
          endpoint.path(device.id),
          { signal: options.signal, scope: endpoint.scope },
        );
        return this.ok(
          states.map((state) => mapPolicyState(state, 'configuration')),
          source,
        );
      },
      (source) => ({
        status: 'unavailable',
        reason: de.reasons.configurationPoliciesNotReported,
        source,
      }),
    );
  }

  getEntraDevice(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<EntraDeviceInfo | null>> {
    const endpoint = Endpoints.entraDeviceByDeviceId;
    return this.run<EntraDeviceInfo | null>(
      'entraDeviceByDeviceId',
      async (source) => {
        const azureAdId = usableAzureAdId(device);
        if (!azureAdId) {
          return { status: 'unavailable', reason: de.reasons.noAzureAdDeviceId, source };
        }
        const page = await this.client.get<GraphCollection<GraphEntraDevice>>(
          endpoint.path(azureAdId),
          { signal: options.signal, scope: endpoint.scope },
        );
        const first = page?.value?.[0];
        return this.ok(first ? mapEntraDevice(first) : null, source);
      },
      (source) => ({ status: 'unavailable', reason: de.reasons.entraNotReported, source }),
    );
  }

  /**
   * Entra-Objekte mit demselben Namen (nur die erste Seite). `eq` auf displayName ist Standard-Query;
   * weitere Seiten werden nicht gelesen, aber ausgewiesen.
   */
  getDuplicateDevices(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<DuplicateDevicesInfo>> {
    const endpoint = Endpoints.entraDevicesByName;
    return this.run<DuplicateDevicesInfo>(
      'entraDevicesByName',
      async (source) => {
        const name = device.deviceName.trim();
        if (!name || name === '–') {
          return { status: 'unavailable', reason: de.reasons.duplicatesNoName, source };
        }
        const page = await this.client.get<GraphCollection<GraphEntraDevice>>(endpoint.path(name), {
          signal: options.signal,
          scope: endpoint.scope,
        });
        return this.ok(
          mapDuplicateDevices(page?.value ?? [], device, Boolean(page?.['@odata.nextLink'])),
          source,
        );
      },
      (source) => ({ status: 'unavailable', reason: de.reasons.duplicatesNotReported, source }),
    );
  }

  getBitLockerKeys(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<BitLockerKeyInfo[]>> {
    const endpoint = Endpoints.bitlockerRecoveryKeys;
    return this.run<BitLockerKeyInfo[]>(
      'bitlockerRecoveryKeys',
      async (source) => {
        if (device.osFamily !== 'windows') {
          return { status: 'notApplicable', reason: de.reasons.bitlockerNotWindows, source };
        }
        const azureAdId = usableAzureAdId(device);
        if (!azureAdId) {
          return { status: 'unavailable', reason: de.reasons.noAzureAdDeviceId, source };
        }
        // Nur Metadaten: der Endpoint enthält kein $select=key.
        const keys = await this.client.getAllPages<GraphBitlockerRecoveryKey>(
          endpoint.path(azureAdId),
          { signal: options.signal, scope: endpoint.scope },
        );
        return this.ok(keys.map(mapBitlockerKey), source);
      },
      (source) => ({ status: 'unavailable', reason: de.reasons.bitlockerNotReported, source }),
    );
  }

  /** Beta: App-Status kommt pro Benutzer; gefiltert wird auf dieses Gerät (managedDeviceIdentifier). */
  getAppInstallStates(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<AppInstallStateInfo[]>> {
    const endpoint = Endpoints.mobileAppIntentAndStates;
    return this.run<AppInstallStateInfo[]>(
      'mobileAppIntentAndStates',
      async (source) => {
        if (!device.userId) {
          return { status: 'notApplicable', reason: de.reasons.appsNoPrimaryUser, source };
        }
        const entries = await this.client.getAllPages<GraphMobileAppIntentAndState>(
          endpoint.path(device.userId),
          { signal: options.signal, scope: endpoint.scope },
        );
        const { apps, matched } = mapAppInstallStates(entries, [device.id, device.azureADDeviceId]);
        if (!matched) {
          this.log(
            `mobileAppIntentAndStates: ${entries.length} Einträge für den Benutzer, keiner passt zu diesem Gerät.`,
          );
          return {
            status: 'unavailable',
            reason:
              entries.length === 0
                ? de.reasons.appsNoEntries
                : de.reasons.appsDeviceNotListed(entries.length),
            source,
          };
        }
        return this.ok(apps, source);
      },
      (source) => ({ status: 'unavailable', reason: de.reasons.appsNotReported, source }),
    );
  }

  /** Tenant-weit; wird nur für Apple-Geräte abgefragt (sonst notApplicable ohne Request). */
  getApplePushCertificate(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<ApplePushCertificateInfo>> {
    if (device.osFamily !== 'macos' && device.osFamily !== 'ios') {
      return Promise.resolve({
        status: 'notApplicable',
        reason: de.reasons.applePushNotApple,
        source: graphSource('applePushNotificationCertificate'),
      });
    }
    return this.readApplePushCertificate(options);
  }

  /** Das Zertifikat gilt für den ganzen Mandanten (Gerät und Ansicht „Mandant“ teilen sich die Abfrage). */
  private readApplePushCertificate(
    options: RequestOptions,
  ): Promise<SectionResult<ApplePushCertificateInfo>> {
    const endpoint = Endpoints.applePushNotificationCertificate;
    return this.run<ApplePushCertificateInfo>(
      'applePushNotificationCertificate',
      async (source) => {
        const dto = await this.client.get<
          GraphApplePushNotificationCertificate | { value?: GraphApplePushNotificationCertificate }
        >(endpoint.path(), { signal: options.signal, scope: endpoint.scope });
        return this.ok(mapApplePushCertificate(dto), source);
      },
      (source) => ({ status: 'unavailable', reason: de.reasons.applePushNotReported, source }),
    );
  }

  /**
   * Mandanten-Status (M14/S5): Apple-MDM-Push-Zertifikat und VPP-Tokens, unabhängig voneinander. Die
   * VPP-Antwort enthält `token` und `appleId`; der Mapper übernimmt nur die Whitelist, das Rohobjekt
   * verlässt diese Methode nicht.
   */
  async getTenantStatus(options: RequestOptions = {}): Promise<TenantStatus> {
    const [
      applePushCertificate,
      vppTokens,
      serviceHealth,
      enrollmentFailures,
      complianceSummary,
      complianceSettings,
      configurationSummary,
    ] = await Promise.all([
      this.readApplePushCertificate(options),
      this.readVppTokens(options),
      this.getServiceHealth(options),
      this.readEnrollmentFailures(null, options),
      this.readDeviceStateSummary('compliance', options),
      this.readComplianceSettings(options),
      this.readDeviceStateSummary('configuration', options),
    ]);
    return {
      applePushCertificate,
      vppTokens,
      serviceHealth,
      enrollmentFailures,
      complianceSummary,
      complianceSettings,
      configurationSummary,
    };
  }

  /**
   * Liest höchstens `maxPages` Seiten über `@odata.nextLink` (nur GET). Für die Listen dieser Datei sind
   * keine Query-Optionen dokumentiert – deshalb immer ohne $filter/$top.
   */
  private async readPages<T>(
    firstPath: string,
    scope: string,
    maxPages: number,
    options: RequestOptions,
  ): Promise<{ entries: T[]; pagesRead: number; truncated: boolean }> {
    const entries: T[] = [];
    let next: string | undefined = firstPath;
    let pagesRead = 0;
    while (next && pagesRead < maxPages) {
      const page: GraphCollection<T> | undefined = await this.client.get<GraphCollection<T>>(next, {
        signal: options.signal,
        scope,
      });
      pagesRead += 1;
      entries.push(...(page?.value ?? []));
      next = page?.['@odata.nextLink'] ?? undefined;
    }
    return { entries, pagesRead, truncated: Boolean(next) };
  }

  // ---------- Compliance-/Konfigurations-Übersicht (M20/S1) ----------

  private readDeviceStateSummary(
    kind: TenantPolicyKind,
    options: RequestOptions,
  ): Promise<SectionResult<DeviceStateSummaryInfo>> {
    const id =
      kind === 'compliance'
        ? ('deviceCompliancePolicyDeviceStateSummary' as const)
        : ('deviceConfigurationDeviceStateSummaries' as const);
    const endpoint = Endpoints[id];
    return this.run<DeviceStateSummaryInfo>(
      id,
      async (source) => {
        const dto = await this.client.get<
          GraphDeviceStateSummary | { value?: GraphDeviceStateSummary }
        >(endpoint.path(), { signal: options.signal, scope: endpoint.scope });
        return this.ok(mapDeviceStateSummary(dto, kind), source);
      },
      (source) => ({ status: 'unavailable', reason: de.fleet.reasons.summaryNotReported, source }),
    );
  }

  private readComplianceSettings(
    options: RequestOptions,
  ): Promise<SectionResult<ComplianceSettingSummariesInfo>> {
    const endpoint = Endpoints.deviceCompliancePolicySettingStateSummaries;
    return this.run<ComplianceSettingSummariesInfo>(
      'deviceCompliancePolicySettingStateSummaries',
      async (source) => {
        const { entries, pagesRead, truncated } =
          await this.readPages<GraphComplianceSettingStateSummary>(
            endpoint.path(),
            endpoint.scope,
            MAX_SETTING_SUMMARY_PAGES,
            options,
          );
        return this.ok(mapComplianceSettingSummaries(entries, { pagesRead, truncated }), source);
      },
      (source) => ({ status: 'unavailable', reason: de.fleet.reasons.summaryNotReported, source }),
    );
  }

  // ---------- Dienststatus und Registrierungsfehler (M18) ----------

  /** healthOverviews mit `$expand=issues`, höchstens MAX_SERVICE_HEALTH_PAGES Seiten. */
  getServiceHealth(options: RequestOptions = {}): Promise<SectionResult<ServiceHealthInfo>> {
    const endpoint = Endpoints.serviceHealthOverviews;
    return this.run<ServiceHealthInfo>(
      'serviceHealthOverviews',
      async (source) => {
        const entries: GraphServiceHealth[] = [];
        let next: string | undefined = endpoint.path();
        let pages = 0;
        while (next && pages < MAX_SERVICE_HEALTH_PAGES) {
          const page: GraphCollection<GraphServiceHealth> | undefined = await this.client.get<
            GraphCollection<GraphServiceHealth>
          >(next, { signal: options.signal, scope: endpoint.scope });
          pages += 1;
          entries.push(...(page?.value ?? []));
          next = page?.['@odata.nextLink'] ?? undefined;
        }
        return this.ok(mapServiceHealth(entries, Boolean(next)), source);
      },
      (source) => ({
        status: 'unavailable',
        reason: de.service.reasons.serviceHealthNotReported,
        source,
      }),
    );
  }

  /** Registrierungsfehler des Benutzers (Gerätekachel „Registrierung (Benutzer)“). */
  getEnrollmentFailures(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<EnrollmentFailuresInfo>> {
    if (!device.userId) {
      return Promise.resolve({
        status: 'notApplicable',
        reason: de.service.reasons.enrollmentFailuresNoUser,
        source: graphSource('troubleshootingEvents'),
      });
    }
    return this.readEnrollmentFailures(device.userId, options);
  }

  /**
   * troubleshootingEvents: höchstens MAX_TROUBLESHOOTING_EVENT_PAGES Seiten (kein Filter/keine Sortierung
   * dokumentiert); `userId` filtert clientseitig.
   */
  private readEnrollmentFailures(
    userId: string | null,
    options: RequestOptions,
  ): Promise<SectionResult<EnrollmentFailuresInfo>> {
    const endpoint = Endpoints.troubleshootingEvents;
    return this.run<EnrollmentFailuresInfo>(
      'troubleshootingEvents',
      async (source) => {
        const entries: GraphTroubleshootingEvent[] = [];
        let next: string | undefined = endpoint.path();
        let pages = 0;
        while (next && pages < MAX_TROUBLESHOOTING_EVENT_PAGES) {
          const page: GraphCollection<GraphTroubleshootingEvent> | undefined =
            await this.client.get<GraphCollection<GraphTroubleshootingEvent>>(next, {
              signal: options.signal,
              scope: endpoint.scope,
            });
          pages += 1;
          entries.push(...(page?.value ?? []));
          next = page?.['@odata.nextLink'] ?? undefined;
        }
        return this.ok(
          mapEnrollmentFailures(entries, {
            pagesRead: pages,
            truncated: Boolean(next),
            filterUserId: userId,
          }),
          source,
        );
      },
      (source) => ({
        status: 'unavailable',
        reason: de.service.reasons.troubleshootingNotReported,
        source,
      }),
    );
  }

  // ---------- Richtlinien → Geräte (M15) ----------

  /**
   * Richtlinien des Mandanten mit Zählern. Beide Listen unabhängig (403/Fehler betreffen nur ihre
   * Liste). Zähler nur für die MAX_POLICY_OVERVIEWS zuletzt geänderten Richtlinien, je
   * POLICY_OVERVIEW_CONCURRENCY parallel; jeder Zähler ist ein eigenes SectionResult.
   */
  async getTenantPolicies(options: RequestOptions = {}): Promise<TenantPolicies> {
    const [configurations, compliancePolicies] = await Promise.all([
      this.readPolicyList('configuration', options),
      this.readPolicyList('compliance', options),
    ]);
    const all = [configurations, compliancePolicies].flatMap((list) =>
      list.status === 'ok' ? list.data.policies : [],
    );
    const time = (policy: TenantPolicyInfo) =>
      policy.lastModifiedDateTime ? Date.parse(policy.lastModifiedDateTime) : 0;
    const chosen = [...all].sort((a, b) => time(b) - time(a)).slice(0, MAX_POLICY_OVERVIEWS);
    const overviews = new Map<TenantPolicyInfo, SectionResult<PolicyDeviceOverview>>();
    for (let i = 0; i < chosen.length; i += POLICY_OVERVIEW_CONCURRENCY) {
      const batch = chosen.slice(i, i + POLICY_OVERVIEW_CONCURRENCY);
      const results = await Promise.all(batch.map((policy) => this.readOverview(policy, options)));
      batch.forEach((policy, index) => overviews.set(policy, results[index]!));
    }
    const withOverviews = (
      list: SectionResult<TenantPolicyList>,
    ): SectionResult<TenantPolicyList> =>
      list.status === 'ok'
        ? {
            ...list,
            data: {
              ...list.data,
              policies: list.data.policies.map((policy) => ({
                ...policy,
                overview: overviews.get(policy) ?? null,
              })),
            },
          }
        : list;
    return {
      configurations: withOverviews(configurations),
      compliancePolicies: withOverviews(compliancePolicies),
      overviewLimit: MAX_POLICY_OVERVIEWS,
    };
  }

  private readPolicyList(
    kind: TenantPolicyKind,
    options: RequestOptions,
  ): Promise<SectionResult<TenantPolicyList>> {
    const id: EndpointId =
      kind === 'configuration' ? 'deviceConfigurations' : 'deviceCompliancePolicies';
    const endpoint = Endpoints[id];
    return this.run<TenantPolicyList>(
      id,
      async (source) => {
        const entries: GraphTenantPolicy[] = [];
        let next: string | undefined = endpoint.path();
        let pages = 0;
        while (next && pages < MAX_LIST_PAGES) {
          const page: GraphCollection<GraphTenantPolicy> | undefined = await this.client.get<
            GraphCollection<GraphTenantPolicy>
          >(next, { signal: options.signal, scope: endpoint.scope });
          pages += 1;
          entries.push(...(page?.value ?? []));
          next = page?.['@odata.nextLink'] ?? undefined;
        }
        return this.ok(
          { policies: mapTenantPolicies(entries, kind), truncated: Boolean(next) },
          source,
        );
      },
      (source) => ({ status: 'unavailable', reason: de.policies.reasons.listNotFound, source }),
    );
  }

  private readOverview(
    policy: TenantPolicyInfo,
    options: RequestOptions,
  ): Promise<SectionResult<PolicyDeviceOverview>> {
    const id: EndpointId =
      policy.kind === 'configuration'
        ? 'deviceConfigurationDeviceStatusOverview'
        : 'deviceCompliancePolicyDeviceStatusOverview';
    const endpoint = Endpoints[id];
    return this.run<PolicyDeviceOverview>(
      id,
      async (source) => {
        const dto = await this.client.get<
          GraphPolicyDeviceOverview | { value?: GraphPolicyDeviceOverview }
        >(endpoint.path(policy.id), { signal: options.signal, scope: endpoint.scope });
        return this.ok(mapPolicyOverview(dto), source);
      },
      (source) => ({ status: 'unavailable', reason: de.policies.reasons.overviewNotFound, source }),
    );
  }

  /** Gerätestatus einer Richtlinie: höchstens MAX_POLICY_STATUS_PAGES Seiten, danach `truncated`. */
  getPolicyDeviceStatuses(
    policy: { kind: TenantPolicyKind; id: string },
    options: RequestOptions = {},
  ): Promise<SectionResult<PolicyDeviceStatusesInfo>> {
    const id: EndpointId =
      policy.kind === 'configuration'
        ? 'deviceConfigurationDeviceStatuses'
        : 'deviceCompliancePolicyDeviceStatuses';
    const endpoint = Endpoints[id];
    return this.run<PolicyDeviceStatusesInfo>(
      id,
      async (source) => {
        const entries: GraphPolicyDeviceStatus[] = [];
        let next: string | undefined = endpoint.path(policy.id);
        let pages = 0;
        while (next && pages < MAX_POLICY_STATUS_PAGES) {
          const page: GraphCollection<GraphPolicyDeviceStatus> | undefined = await this.client.get<
            GraphCollection<GraphPolicyDeviceStatus>
          >(next, { signal: options.signal, scope: endpoint.scope });
          pages += 1;
          entries.push(...(page?.value ?? []));
          next = page?.['@odata.nextLink'] ?? undefined;
        }
        return this.ok(
          { entries: mapPolicyDeviceStatuses(entries), truncated: Boolean(next), pagesRead: pages },
          source,
        );
      },
      (source) => ({ status: 'unavailable', reason: de.policies.reasons.statusesNotFound, source }),
    );
  }

  private readVppTokens(options: RequestOptions): Promise<SectionResult<VppTokenInfo[]>> {
    const endpoint = Endpoints.vppTokens;
    return this.run<VppTokenInfo[]>(
      'vppTokens',
      async (source) => {
        const entries = await this.client.getAllPages<GraphVppToken>(endpoint.path(), {
          signal: options.signal,
          scope: endpoint.scope,
          maxPages: MAX_LIST_PAGES,
        });
        return this.ok(mapVppTokens(entries), source);
      },
      (source) => ({ status: 'unavailable', reason: de.reasons.vppTokensNotReported, source }),
    );
  }

  /**
   * Entra-Anmeldeprotokoll des primären Benutzers (nur die erste Seite, neueste zuerst). Der
   * dokumentierte $filter deckt Benutzer und Zeitraum ab; auf das Gerät wird clientseitig eingegrenzt.
   */
  getSignIns(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<SignInsInfo>> {
    const endpoint = Endpoints.signIns;
    return this.run<SignInsInfo>(
      'signIns',
      async (source) => {
        if (!device.userId) {
          return { status: 'notApplicable', reason: de.reasons.signInsNoPrimaryUser, source };
        }
        const azureAdId = usableAzureAdId(device);
        if (!azureAdId) {
          return { status: 'unavailable', reason: de.reasons.noAzureAdDeviceId, source };
        }
        const since = new Date(this.now().getTime() - SIGN_IN_WINDOW_DAYS * 86_400_000);
        const page = await this.client.get<GraphCollection<GraphSignIn>>(
          endpoint.path(device.userId, since.toISOString().replace(/\.\d{3}Z$/, 'Z')),
          { signal: options.signal, scope: endpoint.scope },
        );
        const info = mapSignIns(page?.value ?? [], azureAdId, {
          windowDays: SIGN_IN_WINDOW_DAYS,
          moreAvailable: Boolean(page?.['@odata.nextLink']),
        });
        return this.ok(info, source);
      },
      (source) => ({ status: 'unavailable', reason: de.reasons.signInsNotReported, source }),
    );
  }

  /**
   * Windows LAPS (nur Windows): Metadaten aus Entra. Nur `$select=id,deviceName,lastBackupDateTime,
   * refreshDateTime` – nie `credentials`. 404 → unavailable (Bedeutung ist nicht dokumentiert).
   */
  getLocalAdmin(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<LocalAdminInfo>> {
    const endpoint = Endpoints.deviceLocalCredentialInfo;
    return this.run<LocalAdminInfo>(
      'deviceLocalCredentialInfo',
      async (source) => {
        if (device.osFamily !== 'windows') {
          return { status: 'notApplicable', reason: de.reasons.lapsNotWindows, source };
        }
        const azureAdId = usableAzureAdId(device);
        if (!azureAdId) {
          return { status: 'unavailable', reason: de.reasons.noAzureAdDeviceId, source };
        }
        const dto = await this.client.get<
          GraphDeviceLocalCredentialInfo | { value?: GraphDeviceLocalCredentialInfo }
        >(endpoint.path(azureAdId), { signal: options.signal, scope: endpoint.scope });
        return this.ok(mapLocalAdmin(dto), source);
      },
      (source) => ({ status: 'unavailable', reason: de.reasons.lapsNotReported, source }),
    );
  }

  /**
   * Windows Autopilot (nur Windows): Für die Liste ist kein Filter dokumentiert → seitenweise lesen
   * (höchstens MAX_LIST_PAGES Seiten, Abbruch beim ersten Treffer). Nicht gefunden und weitere Seiten
   * vorhanden → unavailable (ehrlich); nicht gefunden und Liste zu Ende → ok mit null.
   */
  getAutopilot(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<AutopilotInfo | null>> {
    const endpoint = Endpoints.windowsAutopilotDeviceIdentities;
    return this.run<AutopilotInfo | null>(
      'windowsAutopilotDeviceIdentities',
      async (source) => {
        if (device.osFamily !== 'windows') {
          return { status: 'notApplicable', reason: de.reasons.autopilotNotWindows, source };
        }
        let next: string | undefined = endpoint.path();
        let pages = 0;
        while (next && pages < MAX_LIST_PAGES) {
          const page: GraphCollection<GraphWindowsAutopilotDeviceIdentity> | undefined =
            await this.client.get<GraphCollection<GraphWindowsAutopilotDeviceIdentity>>(next, {
              signal: options.signal,
              scope: endpoint.scope,
            });
          pages += 1;
          const hit = mapAutopilot(page?.value ?? [], device);
          if (hit) return this.ok(hit, source);
          next = page?.['@odata.nextLink'] ?? undefined;
        }
        if (next) {
          return {
            status: 'unavailable',
            reason: de.reasons.autopilotNotFoundInLimit(pages),
            source,
          };
        }
        return this.ok(null, source);
      },
      (source) => ({ status: 'unavailable', reason: de.reasons.autopilotNotReported, source }),
    );
  }

  /**
   * Gruppen des Entra-Geräts (transitiveMemberOf). Ohne Query-Optionen; Paging über @odata.nextLink,
   * höchstens MAX_LIST_PAGES Seiten (danach `truncated`).
   */
  getDeviceGroups(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<DeviceGroupsInfo>> {
    const endpoint = Endpoints.deviceTransitiveMemberOf;
    return this.run<DeviceGroupsInfo>(
      'deviceTransitiveMemberOf',
      async (source) => {
        const azureAdId = usableAzureAdId(device);
        if (!azureAdId) {
          return { status: 'unavailable', reason: de.reasons.noAzureAdDeviceId, source };
        }
        const objects: GraphDirectoryObject[] = [];
        let next: string | undefined = endpoint.path(azureAdId);
        let pages = 0;
        while (next && pages < MAX_LIST_PAGES) {
          const page: GraphCollection<GraphDirectoryObject> | undefined = await this.client.get<
            GraphCollection<GraphDirectoryObject>
          >(next, { signal: options.signal, scope: endpoint.scope });
          pages += 1;
          objects.push(...(page?.value ?? []));
          next = page?.['@odata.nextLink'] ?? undefined;
        }
        return this.ok(mapDeviceGroups(objects, Boolean(next)), source);
      },
      (source) => ({ status: 'unavailable', reason: de.reasons.groupsNotReported, source }),
    );
  }

  /** Weitere Geräte des Benutzers (nur die erste Seite), ohne das aktuelle Gerät. */
  getUserDevices(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<DeviceSearchResult[]>> {
    const endpoint = Endpoints.managedDevicesOfUser;
    return this.run<DeviceSearchResult[]>(
      'managedDevicesOfUser',
      async (source) => {
        const upn = device.userPrincipalName?.trim();
        if (!upn) {
          return { status: 'notApplicable', reason: de.reasons.userDevicesNoUser, source };
        }
        const page = await this.client.get<GraphCollection<GraphManagedDevice>>(
          endpoint.path(upn),
          { signal: options.signal, scope: endpoint.scope },
        );
        return this.ok(mapUserDevices(page?.value ?? [], device.id), source);
      },
      (source) => ({ status: 'unavailable', reason: de.reasons.userDevicesNotReported, source }),
    );
  }

  /** Integritätsnachweis (nur Windows): eigener Aufruf mit $select=deviceHealthAttestationState. */
  getHealthAttestation(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<HealthAttestationInfo>> {
    const endpoint = Endpoints.managedDeviceHealthAttestation;
    return this.run<HealthAttestationInfo>(
      'managedDeviceHealthAttestation',
      async (source) => {
        if (device.osFamily !== 'windows') {
          return { status: 'notApplicable', reason: de.reasons.attestationNotWindows, source };
        }
        const dto = await this.client.get<GraphManagedDeviceHealthAttestation>(
          endpoint.path(device.id),
          { signal: options.signal, scope: endpoint.scope },
        );
        return this.ok(mapHealthAttestation(dto), source);
      },
      (source) => ({ status: 'unavailable', reason: de.reasons.attestationNotReported, source }),
    );
  }

  /**
   * Lizenz des primären Benutzers (M14/S3): `GET /users/{id}/licenseDetails`, reduziert auf die
   * Intune-Serviceplans. Optionaler Scope LicenseAssignment.Read.All.
   */
  getUserLicense(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<UserLicenseInfo>> {
    const endpoint = Endpoints.userLicenseDetails;
    return this.run<UserLicenseInfo>(
      'userLicenseDetails',
      async (source) => {
        if (!device.userId) {
          return { status: 'notApplicable', reason: de.reasons.licenseNoPrimaryUser, source };
        }
        const entries = await this.client.getAllPages<GraphLicenseDetails>(
          endpoint.path(device.userId),
          { signal: options.signal, scope: endpoint.scope, maxPages: MAX_LIST_PAGES },
        );
        return this.ok(mapUserLicense(entries), source);
      },
      (source) => ({ status: 'unavailable', reason: de.reasons.licenseNotReported, source }),
    );
  }

  /**
   * Sicherheitswarnungen (M14/S4): `GET /security/alerts_v2` gefiltert auf Defender for Endpoint, höchstens
   * MAX_SECURITY_ALERT_PAGES Seiten (neueste zuerst). Ein Filter auf das Gerät ist nicht dokumentiert →
   * die Zuordnung (Entra-Geräte-ID, sonst Gerätename) geschieht clientseitig; behobene Warnungen werden
   * ausgeblendet. Optionaler Scope SecurityAlert.Read.All.
   */
  getSecurityAlerts(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<SecurityAlertsInfo>> {
    const endpoint = Endpoints.securityAlerts;
    return this.run<SecurityAlertsInfo>(
      'securityAlerts',
      async (source) => {
        const entries: GraphSecurityAlert[] = [];
        let next: string | undefined = endpoint.path();
        let pages = 0;
        while (next && pages < MAX_SECURITY_ALERT_PAGES) {
          const page: GraphCollection<GraphSecurityAlert> | undefined = await this.client.get<
            GraphCollection<GraphSecurityAlert>
          >(next, { signal: options.signal, scope: endpoint.scope });
          pages += 1;
          if (Array.isArray(page?.value)) entries.push(...page.value);
          next = page?.['@odata.nextLink'] ?? undefined;
        }
        return this.ok(
          mapSecurityAlerts(
            entries,
            { azureAdDeviceId: usableAzureAdId(device), deviceName: device.deviceName },
            { moreAvailable: Boolean(next) },
          ),
          source,
        );
      },
      (source) => ({ status: 'unavailable', reason: de.reasons.securityAlertsNotReported, source }),
    );
  }

  /**
   * Gerätelimit-Konfigurationen (M14/S3): Liste der Registrierungskonfigurationen (Limits am
   * `@odata.type` erkannt) und je Limit-Konfiguration ein GET auf die Zuweisungen (höchstens
   * MAX_ENROLLMENT_LIMIT_CONFIGS, 4 parallel). Nicht lesbare Zuweisungen → Ziele null.
   */
  getEnrollmentLimits(
    device: ManagedDeviceInfo,
    options: RequestOptions = {},
  ): Promise<SectionResult<EnrollmentLimitsInfo>> {
    const endpoint = Endpoints.deviceEnrollmentConfigurations;
    const assignmentsEndpoint = Endpoints.deviceEnrollmentConfigurationAssignments;
    return this.run<EnrollmentLimitsInfo>(
      'deviceEnrollmentConfigurations',
      async (source) => {
        if (!device.userId) {
          return {
            status: 'notApplicable',
            reason: de.reasons.enrollmentLimitsNoPrimaryUser,
            source,
          };
        }
        const configs = await this.client.getAllPages<GraphDeviceEnrollmentConfiguration>(
          endpoint.path(),
          { signal: options.signal, scope: endpoint.scope, maxPages: MAX_LIST_PAGES },
        );
        const limitConfigs = configs.filter(isEnrollmentLimitConfig);
        const read = limitConfigs.slice(0, MAX_ENROLLMENT_LIMIT_CONFIGS);
        const assignments = new Map<string, GraphAssignment[]>();
        for (let i = 0; i < read.length; i += ASSIGNMENT_LOOKUP_CONCURRENCY) {
          const batch = read.slice(i, i + ASSIGNMENT_LOOKUP_CONCURRENCY);
          const results = await Promise.allSettled(
            batch.map((config) =>
              this.client.get<GraphCollection<GraphAssignment>>(
                assignmentsEndpoint.path(config.id),
                { signal: options.signal, scope: assignmentsEndpoint.scope },
              ),
            ),
          );
          results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              assignments.set(batch[index]!.id, result.value?.value ?? []);
            } else if (isAbort(result.reason)) {
              throw result.reason;
            }
            // andere Fehler: Ziele dieser Konfiguration bleiben unbekannt (null)
          });
        }
        return this.ok(
          {
            limits: mapEnrollmentLimits(read, assignments),
            omitted: limitConfigs.length - read.length,
          },
          source,
        );
      },
      (source) => ({
        status: 'unavailable',
        reason: de.reasons.enrollmentLimitsNotReported,
        source,
      }),
    );
  }

  /**
   * Zuweisungen der übergebenen Richtlinien/Apps (M14/S2): je Objekt ein GET, höchstens
   * MAX_ASSIGNMENT_LOOKUPS Objekte, ASSIGNMENT_LOOKUP_CONCURRENCY parallel. IDs, die keine GUID sind,
   * werden nicht abgefragt (notEvaluable). 404 → notFound (die ID ist kein Objekt dieses Typs).
   * Fehlende Berechtigung betrifft alle Aufrufe → ganze Section forbidden; schlägt jeder Aufruf mit einem
   * anderen Fehler fehl, ist die Section ein Fehler.
   */
  getAssignments(
    device: ManagedDeviceInfo,
    lookups: AssignmentLookup[],
    options: RequestOptions = {},
  ): Promise<SectionResult<AssignmentsInfo>> {
    void device;
    return this.run<AssignmentsInfo>(
      'deviceConfigurationAssignments',
      async (source) => {
        const combined = { ...source, label: ASSIGNMENTS_DISPLAY };
        if (lookups.length === 0) {
          return { status: 'notApplicable', reason: de.reasons.assignmentsNothingToCheck, source };
        }
        const limited = lookups.slice(0, MAX_ASSIGNMENT_LOOKUPS);
        const objects: AssignmentObjectInfo[] = [];
        let firstError: unknown = null;
        let failed = 0;
        let requested = 0;
        for (let i = 0; i < limited.length; i += ASSIGNMENT_LOOKUP_CONCURRENCY) {
          const batch = limited.slice(i, i + ASSIGNMENT_LOOKUP_CONCURRENCY);
          const results = await Promise.allSettled(
            batch.map((lookup) => this.readAssignments(lookup, options)),
          );
          results.forEach((result, index) => {
            const lookup = batch[index]!;
            if (result.status === 'fulfilled') {
              if (result.value.requested) requested += 1;
              objects.push(result.value.object);
              return;
            }
            if (isAbort(result.reason)) throw result.reason;
            const appError = toAppError(result.reason);
            // Fehlende Berechtigung betrifft alle Aufrufe → ganze Section „forbidden“.
            if (appError.code === 'forbidden') throw result.reason;
            requested += 1;
            failed += 1;
            firstError ??= result.reason;
            objects.push({ ...lookup, status: 'error', assignments: [] });
          });
        }
        if (requested > 0 && failed === requested) throw firstError;
        return this.ok({ objects, skipped: lookups.length - limited.length }, combined);
      },
      (source) => ({ status: 'unavailable', reason: de.reasons.assignmentsNotReported, source }),
    );
  }

  private async readAssignments(
    lookup: AssignmentLookup,
    options: RequestOptions,
  ): Promise<{ object: AssignmentObjectInfo; requested: boolean }> {
    if (!isGuid(lookup.id)) {
      return { object: { ...lookup, status: 'notEvaluable', assignments: [] }, requested: false };
    }
    const endpoint =
      lookup.kind === 'app'
        ? Endpoints.mobileAppAssignments
        : lookup.kind === 'compliance'
          ? Endpoints.deviceCompliancePolicyAssignments
          : Endpoints.deviceConfigurationAssignments;
    try {
      const page = await this.client.get<GraphCollection<GraphAssignment>>(
        endpoint.path(lookup.id),
        { signal: options.signal, scope: endpoint.scope },
      );
      return {
        object: { ...lookup, status: 'ok', assignments: mapAssignments(page?.value) },
        requested: true,
      };
    } catch (error) {
      if (!isAbort(error) && toAppError(error).code === 'notFound') {
        return { object: { ...lookup, status: 'notFound', assignments: [] }, requested: true };
      }
      throw error;
    }
  }

  /** App-Namen per GET /deviceAppManagement/mobileApps/{id} – je ID ein GET, gedrosselt parallel. */
  getMobileApps(appIds: string[], options: RequestOptions = {}): Promise<SectionResult<AppInfo[]>> {
    const endpoint = Endpoints.mobileApp;
    return this.run<AppInfo[]>('mobileApp', async (source) => {
      const ids = [...new Map(appIds.map((id) => [id.toLowerCase(), id])).values()].slice(
        0,
        MAX_APP_LOOKUPS,
      );
      const apps: AppInfo[] = [];
      let firstError: unknown = null;
      for (let i = 0; i < ids.length; i += APP_LOOKUP_CONCURRENCY) {
        const batch = ids.slice(i, i + APP_LOOKUP_CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((id) =>
            this.client.get<GraphMobileApp>(endpoint.path(id), {
              signal: options.signal,
              scope: endpoint.scope,
            }),
          ),
        );
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const app = result.value ? mapMobileApp(result.value) : null;
            if (app) apps.push(app);
            continue;
          }
          if (isAbort(result.reason)) throw result.reason;
          const appError = toAppError(result.reason);
          // Fehlende Berechtigung betrifft alle IDs → ganze Section "forbidden".
          if (appError.code === 'forbidden') throw result.reason;
          // Gelöschte/unbekannte App: einfach ohne Namen weiter.
          if (appError.code === 'notFound') continue;
          firstError ??= result.reason;
        }
      }
      if (apps.length === 0 && firstError) throw firstError;
      return this.ok(apps, source);
    });
  }

  /** Verbindungstest (M14/S6): jeder Endpunkt genau einmal per GET, nur Struktur der Antwort (siehe connectionTest.ts). */
  testConnection(
    device: ManagedDeviceInfo,
    options: RequestOptions & {
      onResult?: (result: EndpointProbeResult, index: number, total: number) => void;
    } = {},
  ): Promise<EndpointProbeResult[]> {
    return runConnectionTest(this.client, device, {
      signal: options.signal,
      onResult: options.onResult,
      now: this.now,
    });
  }
}

/** Fabrik für die App-Verdrahtung: `createGraphProvider(getGraphToken)`. */
export function createGraphProvider(
  getToken: () => Promise<string>,
  options: GraphProviderFactoryOptions = {},
): GraphProvider {
  const { fetchImpl, sleep, now, log } = options;
  return new GraphProvider({
    client: createGraphClient({ getToken, fetchImpl, sleep }),
    now,
    log,
  });
}
