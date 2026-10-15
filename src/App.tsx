import { AppShell } from './app/AppShell';
import { ProviderContextProvider } from './app/providerContext';

export default function App() {
  return (
    <ProviderContextProvider>
      <AppShell />
    </ProviderContextProvider>
  );
}
