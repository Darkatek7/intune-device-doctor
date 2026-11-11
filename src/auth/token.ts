/**
 * Initialisierung und Token-Beschaffung (MSAL v5).
 * v5 verlangt `initialize()` vor jedem anderen Aufruf; `handleRedirectPromise()` verarbeitet die
 * Rückkehr vom Login-Redirect. Beides läuft hier genau einmal pro Instanz.
 */
import {
  InteractionRequiredAuthError,
  type AccountInfo,
  type AuthenticationResult,
  type IPublicClientApplication,
} from '@azure/msal-browser';
import { GraphRequestError } from '../graph/client';
import { LOGIN_SCOPES } from '../graph/scopes';
import { clearStoredRecentDevices } from '../hooks/useRecentDevices';
import { de } from '../i18n/de';
import { getMsalInstance } from './msalConfig';
import {
  clearIdleSignOutMarkers,
  markIdleSignOut,
  notifyLocalSignOut,
  shouldForceLogin,
} from './sessionState';

const startup = new WeakMap<IPublicClientApplication, Promise<AuthenticationResult | null>>();

/** Aktives Konto setzen (erstes Konto als Fallback). */
export function currentAccount(instance: IPublicClientApplication): AccountInfo | null {
  const active = instance.getActiveAccount();
  if (active) return active;
  const [first] = instance.getAllAccounts();
  if (first) {
    instance.setActiveAccount(first);
    return first;
  }
  return null;
}

/** Idempotent: initialize() + handleRedirectPromise(). Liefert das Redirect-Ergebnis (oder null). */
export function initMsal(
  instance: IPublicClientApplication = getMsalInstance(),
): Promise<AuthenticationResult | null> {
  let promise = startup.get(instance);
  if (!promise) {
    promise = (async () => {
      await instance.initialize();
      const result = await instance.handleRedirectPromise();
      if (result?.account) {
        instance.setActiveAccount(result.account);
        // Erfolgreich (neu) angemeldet: Inaktivitäts-Hinweis und erzwungene Anmeldung erledigt.
        clearIdleSignOutMarkers();
      }
      currentAccount(instance);
      return result;
    })();
    promise.catch(() => startup.delete(instance));
    startup.set(instance, promise);
  }
  return promise;
}

/**
 * Login per Redirect (die Seite navigiert weg). Nach einer Abmeldung wegen Inaktivität wird
 * die erneute Authentifizierung erzwungen (`prompt: 'login'`), statt still die bestehende
 * Entra-Sitzung des Browsers zu übernehmen.
 */
export async function signIn(
  instance: IPublicClientApplication = getMsalInstance(),
): Promise<void> {
  await initMsal(instance);
  await instance.loginRedirect({
    scopes: LOGIN_SCOPES,
    ...(shouldForceLogin() ? { prompt: 'login' } : {}),
  });
}

/**
 * Manuelle Abmeldung (Weiterleitung zur Microsoft-Abmeldeseite). Die Liste „Zuletzt geöffnet“
 * des Live-Modus enthält echte Gerätenamen und wird vorher gelöscht.
 */
export async function signOut(
  instance: IPublicClientApplication = getMsalInstance(),
): Promise<void> {
  clearStoredRecentDevices('live');
  await initMsal(instance);
  const account = currentAccount(instance);
  await instance.logoutRedirect(account ? { account } : undefined);
}

/**
 * Abmeldung wegen Inaktivität: **lokal**, ohne Weiterleitung zur Microsoft-Abmeldeseite – die
 * Entra-Sitzung anderer Tabs (z. B. Intune Admin Center) bleibt bestehen. `clearCache()` (MSAL v5)
 * löscht ohne Konto-Argument alle Konten und Token dieses Tabs aus dem Cache und liefert kein Ereignis;
 * die Anmelde-Ansicht wird deshalb über `notifyLocalSignOut` aktualisiert.
 */
export async function signOutInactive(
  instance: IPublicClientApplication,
  minutes: number,
): Promise<void> {
  markIdleSignOut(minutes);
  clearStoredRecentDevices('live');
  try {
    instance.setActiveAccount(null);
    await instance.clearCache();
  } finally {
    notifyLocalSignOut();
  }
}

/**
 * Access-Token für Microsoft Graph: erst still (`acquireTokenSilent`), bei
 * `InteractionRequiredAuthError` per Redirect (die Seite navigiert dann weg; das Promise
 * bleibt absichtlich offen, damit keine Fehlermeldung aufblitzt).
 */
export async function getGraphToken(
  instance: IPublicClientApplication = getMsalInstance(),
): Promise<string> {
  await initMsal(instance);
  const account = currentAccount(instance);
  if (!account) {
    throw new GraphRequestError({ code: 'unauthenticated', message: de.errors.unauthenticated });
  }
  try {
    const result = await instance.acquireTokenSilent({ scopes: LOGIN_SCOPES, account });
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await instance.acquireTokenRedirect({ scopes: LOGIN_SCOPES, account });
      return new Promise<string>(() => {});
    }
    throw error;
  }
}
