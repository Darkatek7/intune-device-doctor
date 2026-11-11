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

/** Konfigurationswerte mit den Namen aus .env.example. */
export type ConfigValues = Partial<
  Record<
    | 'VITE_APP_MODE'
    | 'VITE_MSAL_CLIENT_ID'
    | 'VITE_MSAL_TENANT_ID'
    | 'VITE_MSAL_REDIRECT_URI'
    | 'VITE_IDLE_TIMEOUT_MINUTES',
    string
  >
>;

const CONFIG_KEYS = [
  'VITE_APP_MODE',
  'VITE_MSAL_CLIENT_ID',
  'VITE_MSAL_TENANT_ID',
  'VITE_MSAL_REDIRECT_URI',
  'VITE_IDLE_TIMEOUT_MINUTES',
] as const satisfies readonly (keyof ConfigValues)[];

declare global {
  interface Window {
    /** Laufzeit-Konfiguration aus public/config.js (Container: docker/40-mdm-doctor-config.sh). */
    __MDM_DOCTOR_CONFIG__?: unknown;
  }
}

/**
 * Laufzeitwerte (config.js) haben Vorrang vor den Build-Werten (import.meta.env). Nur nicht-leere
 * Strings zählen; alles andere in config.js wird ignoriert.
 */
export function mergeConfigValues(build: ConfigValues, runtime: unknown): ConfigValues {
  const merged: ConfigValues = { ...build };
  if (typeof runtime !== 'object' || runtime === null) return merged;
  for (const key of CONFIG_KEYS) {
    const value: unknown = (runtime as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim() !== '') merged[key] = value;
  }
  return merged;
}

/** Baut die App-Konfiguration aus den zusammengeführten Werten. */
export function resolveAppConfig(values: ConfigValues, origin: string) {
  return {
    defaultMode: (values.VITE_APP_MODE?.trim() === 'live' ? 'live' : 'demo') as DataMode,
    msal: {
      clientId: values.VITE_MSAL_CLIENT_ID?.trim() ?? '',
      tenantId: values.VITE_MSAL_TENANT_ID?.trim() ?? '',
      redirectUri: values.VITE_MSAL_REDIRECT_URI?.trim() || origin,
    },
    /** Minuten ohne Aktivität bis zur automatischen Abmeldung im Live-Modus; 0 = aus. */
    idleTimeoutMinutes: parseIdleTimeoutMinutes(values.VITE_IDLE_TIMEOUT_MINUTES),
  } as const;
}

/** Zentrale Laufzeitkonfiguration: Vite-Env-Variablen (siehe .env.example), überschrieben von config.js. */
export const appConfig = resolveAppConfig(
  mergeConfigValues(
    {
      VITE_APP_MODE: import.meta.env.VITE_APP_MODE,
      VITE_MSAL_CLIENT_ID: import.meta.env.VITE_MSAL_CLIENT_ID,
      VITE_MSAL_TENANT_ID: import.meta.env.VITE_MSAL_TENANT_ID,
      VITE_MSAL_REDIRECT_URI: import.meta.env.VITE_MSAL_REDIRECT_URI,
      VITE_IDLE_TIMEOUT_MINUTES: import.meta.env.VITE_IDLE_TIMEOUT_MINUTES,
    },
    window.__MDM_DOCTOR_CONFIG__,
  ),
  window.location.origin,
);

/** Live-Modus ist nur wählbar, wenn eine Entra-App konfiguriert ist. */
export const isLiveConfigured = Boolean(appConfig.msal.clientId && appConfig.msal.tenantId);
