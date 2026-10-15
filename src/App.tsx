import { lazy, Suspense } from 'react';
import { AppShell } from './app/AppShell';
import { ProviderContextProvider } from './app/providerContext';
import { useProviderContext } from './app/providerContextValue';
import { navigateTo } from './hooks/useUrlState';
import { de } from './i18n/de';

// MSAL (~300 kB) wird nur im Live-Modus gebraucht – der Demo-Modus lädt es nie.
const AuthGate = lazy(() => import('./auth/AuthGate').then((m) => ({ default: m.AuthGate })));
const AccountButton = lazy(() =>
  import('./auth/AuthGate').then((m) => ({ default: m.AccountButton })),
);

function LiveLoading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 text-secondary-label">
      <p role="status" aria-live="polite">
        {de.states.loadingLive}
      </p>
    </div>
  );
}

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
    <Suspense fallback={<LiveLoading />}>
      <AuthGate secondaryAction={backToDemo}>
        <AppShell
          account={
            <Suspense fallback={null}>
              <AccountButton />
            </Suspense>
          }
        />
      </AuthGate>
    </Suspense>
  );
}

export default function App() {
  return (
    <ProviderContextProvider>
      <Root />
    </ProviderContextProvider>
  );
}
