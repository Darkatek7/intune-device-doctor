import { render } from '@testing-library/react';
import { AppShell } from '../app/AppShell';
import { ProviderContextProvider } from '../app/providerContext';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { MockProvider } from '../providers/mock/MockProvider';

/** Rendert die App mit einem MockProvider ohne künstliche Latenz; Live nicht konfiguriert. */
export function renderApp(
  options: { liveAvailable?: boolean; provider?: DeviceDataProvider } = {},
) {
  const provider = options.provider ?? new MockProvider({ latency: false });
  return render(
    <ProviderContextProvider provider={provider} liveAvailable={options.liveAvailable ?? false}>
      <AppShell />
    </ProviderContextProvider>,
  );
}

/**
 * Mock-Daten im Live-Modus: gleiche Szenarien, aber `mode: 'live'` – für Tests von Live-Zuständen
 * (Offline-Banner, Drosselung, Fehler mit Request-ID) ohne MSAL/Graph. `overrides` ersetzen einzelne Methoden.
 */
export function liveMockProvider(overrides: Partial<DeviceDataProvider> = {}): DeviceDataProvider {
  const inner = new MockProvider({ latency: false });
  return {
    mode: 'live',
    searchDevices: (query, options) => inner.searchDevices(query, options),
    getDevice: (id, options) => inner.getDevice(id, options),
    getProtectionState: (device, options) => inner.getProtectionState(device, options),
    getCompliancePolicyStates: (device, options) =>
      inner.getCompliancePolicyStates(device, options),
    getConfigurationPolicyStates: (device, options) =>
      inner.getConfigurationPolicyStates(device, options),
    getEntraDevice: (device, options) => inner.getEntraDevice(device, options),
    getBitLockerKeys: (device, options) => inner.getBitLockerKeys(device, options),
    ...overrides,
  };
}
