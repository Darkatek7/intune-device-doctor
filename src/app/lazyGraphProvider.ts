/**
 * Schlanker Live-Provider: implementiert DeviceDataProvider, lädt MSAL und den GraphProvider aber
 * erst beim ersten Aufruf per dynamischem Import. Der Demo-Modus zieht diese Module nie in den
 * Haupt-Chunk. Verhalten gegenüber der UI unverändert (gleiche Fehler-/Section-Verträge).
 */
import type {
  BitLockerKeyInfo,
  DataSource,
  DeviceSearchResult,
  EntraDeviceInfo,
  ManagedDeviceInfo,
  PolicyStateInfo,
  SectionResult,
  WindowsProtectionInfo,
} from '../domain/types';
import { de } from '../i18n/de';
import {
  ProviderError,
  type DeviceDataProvider,
  type RequestOptions,
} from '../providers/DeviceDataProvider';

const SOURCE: DataSource = { kind: 'graph', label: 'Microsoft Graph' };

export class LazyGraphProvider implements DeviceDataProvider {
  readonly mode = 'live' as const;
  private inner: Promise<DeviceDataProvider> | null = null;

  /** Lädt die echten Module einmalig; ein fehlgeschlagener Chunk-Download darf erneut versucht werden. */
  private load(): Promise<DeviceDataProvider> {
    if (!this.inner) {
      const promise = (async () => {
        const [{ createGraphProvider }, { getGraphToken }] = await Promise.all([
          import('../providers/graph/GraphProvider'),
          import('../auth/token'),
        ]);
        return createGraphProvider(() => getGraphToken());
      })();
      promise.catch(() => {
        if (this.inner === promise) this.inner = null;
      });
      this.inner = promise;
    }
    return this.inner;
  }

  /** searchDevices/getDevice dürfen werfen – dann als ProviderError (Netzwerk). */
  private async loadOrThrow(): Promise<DeviceDataProvider> {
    try {
      return await this.load();
    } catch {
      throw new ProviderError({ code: 'network', message: de.errors.network });
    }
  }

  /** Section-Methoden werfen nie: ein Ladefehler wird zu SectionResult "error". */
  private async section<T>(
    run: (provider: DeviceDataProvider) => Promise<SectionResult<T>>,
  ): Promise<SectionResult<T>> {
    let provider: DeviceDataProvider;
    try {
      provider = await this.load();
    } catch {
      return {
        status: 'error',
        error: { code: 'network', message: de.errors.network },
        source: SOURCE,
      };
    }
    return run(provider);
  }

  async searchDevices(query: string, options?: RequestOptions): Promise<DeviceSearchResult[]> {
    return (await this.loadOrThrow()).searchDevices(query, options);
  }

  async getDevice(managedDeviceId: string, options?: RequestOptions): Promise<ManagedDeviceInfo> {
    return (await this.loadOrThrow()).getDevice(managedDeviceId, options);
  }

  getProtectionState(device: ManagedDeviceInfo, options?: RequestOptions) {
    return this.section<WindowsProtectionInfo>((p) => p.getProtectionState(device, options));
  }

  getCompliancePolicyStates(device: ManagedDeviceInfo, options?: RequestOptions) {
    return this.section<PolicyStateInfo[]>((p) => p.getCompliancePolicyStates(device, options));
  }

  getConfigurationPolicyStates(device: ManagedDeviceInfo, options?: RequestOptions) {
    return this.section<PolicyStateInfo[]>((p) => p.getConfigurationPolicyStates(device, options));
  }

  getEntraDevice(device: ManagedDeviceInfo, options?: RequestOptions) {
    return this.section<EntraDeviceInfo | null>((p) => p.getEntraDevice(device, options));
  }

  getBitLockerKeys(device: ManagedDeviceInfo, options?: RequestOptions) {
    return this.section<BitLockerKeyInfo[]>((p) => p.getBitLockerKeys(device, options));
  }
}
