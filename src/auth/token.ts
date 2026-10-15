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
import { de } from '../i18n/de';
import { getMsalInstance } from './msalConfig';

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
      if (result?.account) instance.setActiveAccount(result.account);
      currentAccount(instance);
      return result;
    })();
    promise.catch(() => startup.delete(instance));
    startup.set(instance, promise);
  }
  return promise;
}

/** Login per Redirect (die Seite navigiert weg). */
export async function signIn(
  instance: IPublicClientApplication = getMsalInstance(),
): Promise<void> {
  await initMsal(instance);
  await instance.loginRedirect({ scopes: LOGIN_SCOPES });
}

export async function signOut(
  instance: IPublicClientApplication = getMsalInstance(),
): Promise<void> {
  await initMsal(instance);
  const account = currentAccount(instance);
  await instance.logoutRedirect(account ? { account } : undefined);
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
