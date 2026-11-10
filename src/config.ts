import type { DataMode } from './domain/types';

/** Standard der automatischen Abmeldung bei Inaktivität (Live-Modus), in Minuten. */
export const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;
/** Obergrenze (24 h); größere Werte gelten als ungültig. */
const MAX_IDLE_TIMEOUT_MINUTES = 24 * 60;

/**
 * `VITE_IDLE_TIMEOUT_MINUTES`: ganze Minuten (1–1440), `0` = aus. Leer oder ungültig → Standard.
 */
export function parseIdleTimeoutMinutes(raw: string | undefined): number {
  const text = raw?.trim() ?? '';
  if (!/^\d{1,4}$/.test(text)) return DEFAULT_IDLE_TIMEOUT_MINUTES;
  const minutes = Number(text);
  return minutes <= MAX_IDLE_TIMEOUT_MINUTES ? minutes : DEFAULT_IDLE_TIMEOUT_MINUTES;
}

/** Zentrale Laufzeitkonfiguration aus Vite-Env-Variablen (siehe .env.example). */
export const appConfig = {
  defaultMode: (import.meta.env.VITE_APP_MODE === 'live' ? 'live' : 'demo') as DataMode,
  msal: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID?.trim() ?? '',
    tenantId: import.meta.env.VITE_MSAL_TENANT_ID?.trim() ?? '',
    redirectUri: import.meta.env.VITE_MSAL_REDIRECT_URI?.trim() || window.location.origin,
  },
  /** Minuten ohne Aktivität bis zur automatischen Abmeldung im Live-Modus; 0 = aus. */
  idleTimeoutMinutes: parseIdleTimeoutMinutes(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES),
} as const;

/** Live-Modus ist nur wählbar, wenn eine Entra-App konfiguriert ist. */
export const isLiveConfigured = Boolean(appConfig.msal.clientId && appConfig.msal.tenantId);
