import { useEffect, useState } from 'react';
import type { AccountInfo, IPublicClientApplication } from '@azure/msal-browser';
import { currentAccount, initMsal } from './token';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; account: AccountInfo }
  | { status: 'error'; message: string };

/** Initialisiert MSAL (inkl. Redirect-Rückkehr) und hält das angemeldete Konto aktuell. */
export function useMsalAccount(instance: IPublicClientApplication): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (cancelled) return;
      const account = currentAccount(instance);
      setState(account ? { status: 'signedIn', account } : { status: 'signedOut' });
    };

    initMsal(instance).then(refresh, (error: unknown) => {
      if (cancelled) return;
      setState({ status: 'error', message: error instanceof Error ? error.message : '' });
    });
    const callbackId = instance.addEventCallback(() => {
      // Erst nach erfolgreicher Initialisierung Konten lesen.
      initMsal(instance).then(refresh, () => undefined);
    });

    return () => {
      cancelled = true;
      if (callbackId) instance.removeEventCallback(callbackId);
    };
  }, [instance]);

  return state;
}
