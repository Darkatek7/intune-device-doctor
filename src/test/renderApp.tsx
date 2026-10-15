import { render } from '@testing-library/react';
import { AppShell } from '../app/AppShell';
import { ProviderContextProvider } from '../app/providerContext';
import { MockProvider } from '../providers/mock/MockProvider';

/** Rendert die App mit einem MockProvider ohne künstliche Latenz; Live nicht konfiguriert. */
export function renderApp(options: { liveAvailable?: boolean } = {}) {
  const provider = new MockProvider({ latency: false });
  return render(
    <ProviderContextProvider provider={provider} liveAvailable={options.liveAvailable ?? false}>
      <AppShell />
    </ProviderContextProvider>,
  );
}
