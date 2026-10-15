import type { DataMode } from './domain/types';

/** Zentrale Laufzeitkonfiguration aus Vite-Env-Variablen (siehe .env.example). */
export const appConfig = {
  defaultMode: (import.meta.env.VITE_APP_MODE === 'live' ? 'live' : 'demo') as DataMode,
  msal: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID?.trim() ?? '',
    tenantId: import.meta.env.VITE_MSAL_TENANT_ID?.trim() ?? '',
    redirectUri: import.meta.env.VITE_MSAL_REDIRECT_URI?.trim() || window.location.origin,
  },
} as const;

/** Live-Modus ist nur wählbar, wenn eine Entra-App konfiguriert ist. */
export const isLiveConfigured = Boolean(appConfig.msal.clientId && appConfig.msal.tenantId);
