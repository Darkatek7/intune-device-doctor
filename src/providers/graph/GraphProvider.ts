/**
 * Live-Provider: liest Gerätedaten read-only über Microsoft Graph (nur GET, nur Endpunkte aus
 * src/graph/endpoints.ts). Section-Methoden werfen nie (außer bei Abort) – Fehler werden zu
 * SectionResult forbidden / notApplicable / unavailable / error.
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
import {
  createGraphClient,
  GraphRequestError,
  type GraphClient,
  type GraphClientOptions,
} from '../../graph/client';
import type {
  GraphBitlockerRecoveryKey,
  GraphCollection,
  GraphDevicePolicyState,
  GraphEntraDevice,
  GraphManagedDevice,
  GraphWindowsDeviceMalwareState,
  GraphWindowsProtectionState,
} from '../../graph/dto';
import { Endpoints, type EndpointId } from '../../graph/endpoints';
import {
  graphSource,
  mapBitlockerKey,
  mapEntraDevice,
  mapManagedDevice,
  mapPolicyState,
  mapSearchResult,
  mapWindowsProtection,
} from '../../graph/mappers';
import { de } from '../../i18n/de';
import { ProviderError, type DeviceDataProvider, type RequestOptions } from '../DeviceDataProvider';

const MAX_SEARCH_RESULTS = 25;
const MAX_LIST_PAGES = 5;
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

    try {
      // 1) exakter Name
      const exact = await search(Endpoints.managedDevicesByName.path(name));
      if (Array.isArray(exact) && exact.length > 0) return exact.map(mapSearchResult);

      // 2) Teilstring
      const contains = await search(Endpoints.managedDevicesByNameContains.path(name));
      if (contains !== 'badRequest') return contains.map(mapSearchResult);

      // 3) $filter auf deviceName wurde mit 400 abgelehnt → clientseitig über paginierte Liste
      this.log(
        'Graph lehnt $filter auf deviceName ab (HTTP 400) – Suche läuft clientseitig über die Geräteliste.',
      );
      const all = await this.client.getAllPages<GraphManagedDevice>(
        Endpoints.managedDevicesList.path(),
        { signal, scope, maxPages: MAX_LIST_PAGES },
      );
      const needle = name.toLowerCase();
      const hits = all.filter((d) => (d.deviceName ?? '').toLowerCase().includes(needle));
      const exactHits = hits.filter((d) => (d.deviceName ?? '').toLowerCase() === needle);
      return (exactHits.length > 0 ? exactHits : hits)
        .slice(0, MAX_SEARCH_RESULTS)
        .map(mapSearchResult);
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
