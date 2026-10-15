import { AppShell } from './app/AppShell';
import { ProviderContextProvider } from './app/providerContext';
import { useProviderContext } from './app/providerContextValue';
import { AccountButton, AuthGate } from './auth/AuthGate';
import { navigateTo } from './hooks/useUrlState';
import { de } from './i18n/de';

/** Im Live-Modus liegt die App hinter der MSAL-Anmeldung; Demo bleibt ohne Anmeldung nutzbar. */
function Root() {
  const { mode, setMode } = useProviderContext();
  if (mode !== 'live') return <AppShell />;
  const backToDemo = (
    <button
      type="button"
      onClick={() => {
        setMode('demo');
        navigateTo({ device: null, tile: null, mode: 'demo' });
      }}
      className="text-sm font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {de.empty.switchToDemo}
    </button>
  );
  return (
    <AuthGate secondaryAction={backToDemo}>
      <AppShell account={<AccountButton />} />
    </AuthGate>
  );
}

export default function App() {
  return (
    <ProviderContextProvider>
      <Root />
    </ProviderContextProvider>
  );
}
