/**
 * MSAL-Konfiguration (@azure/msal-browser v5): Authorization Code + PKCE für eine
 * Single-page-application-Registrierung. Token-Cache in sessionStorage (endet mit dem Tab).
 */
import {
  BrowserCacheLocation,
  PublicClientApplication,
  type Configuration,
} from '@azure/msal-browser';
import { appConfig } from '../config';

export interface MsalSettings {
  clientId: string;
  tenantId: string;
  redirectUri: string;
}

export function createMsalConfiguration(settings: MsalSettings = appConfig.msal): Configuration {
  return {
    auth: {
      clientId: settings.clientId,
      authority: `https://login.microsoftonline.com/${settings.tenantId}`,
      redirectUri: settings.redirectUri,
      postLogoutRedirectUri: settings.redirectUri,
    },
    cache: { cacheLocation: BrowserCacheLocation.SessionStorage },
  };
}

/** Neue (noch nicht initialisierte) Instanz. Initialisierung: `initMsal()` aus ./token. */
export function createMsalInstance(
  settings: MsalSettings = appConfig.msal,
): PublicClientApplication {
  return new PublicClientApplication(createMsalConfiguration(settings));
}

let singleton: PublicClientApplication | undefined;

/**
 * Prozessweite Instanz, erst beim ersten Zugriff erzeugt – im Demo-Modus (ohne Client-ID)
 * wird MSAL daher nie instanziiert.
 */
export function getMsalInstance(): PublicClientApplication {
  singleton ??= createMsalInstance();
  return singleton;
}
