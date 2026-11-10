/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE?: 'demo' | 'live';
  readonly VITE_MSAL_CLIENT_ID?: string;
  readonly VITE_MSAL_TENANT_ID?: string;
  readonly VITE_MSAL_REDIRECT_URI?: string;
  readonly VITE_IDLE_TIMEOUT_MINUTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
