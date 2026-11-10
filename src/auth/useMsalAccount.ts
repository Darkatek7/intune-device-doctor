import { useEffect, useState } from 'react';
import type { AccountInfo, IPublicClientApplication } from '@azure/msal-browser';
import { describeAuthError } from './describeAuthError';
import { subscribeLocalSignOut } from './sessionState';
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
      setState({ status: 'error', message: describeAuthError(error) });
    });
    const callbackId = instance.addEventCallback(() => {
      // Erst nach erfolgreicher Initialisierung Konten lesen.
      initMsal(instance).then(refresh, () => undefined);
    });

    // Lokale Abmeldung (Inaktivität) löst kein MSAL-Ereignis aus. Die Ansicht wechselt auch dann
    // zu „abgemeldet“, wenn das Leeren des Caches scheitern sollte (Daten nie weiter anzeigen).
    const unsubscribe = subscribeLocalSignOut(() => {
      if (!cancelled) setState({ status: 'signedOut' });
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (callbackId) instance.removeEventCallback(callbackId);
    };
  }, [instance]);

  return state;
}
