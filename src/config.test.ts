import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  mergeConfigValues,
  parseIdleTimeoutMinutes,
  resolveAppConfig,
} from './config';

describe('parseIdleTimeoutMinutes', () => {
  it('nutzt ohne Angabe den Standard (30 Minuten)', () => {
    expect(DEFAULT_IDLE_TIMEOUT_MINUTES).toBe(30);
    expect(parseIdleTimeoutMinutes(undefined)).toBe(30);
    expect(parseIdleTimeoutMinutes('')).toBe(30);
    expect(parseIdleTimeoutMinutes('   ')).toBe(30);
  });

  it('übernimmt ganze Minuten; 0 schaltet ab', () => {
    expect(parseIdleTimeoutMinutes('15')).toBe(15);
    expect(parseIdleTimeoutMinutes(' 5 ')).toBe(5);
    expect(parseIdleTimeoutMinutes('1440')).toBe(1440);
    expect(parseIdleTimeoutMinutes('0')).toBe(0);
  });

  it('fällt bei ungültigen Werten auf den Standard zurück', () => {
    for (const bad of ['abc', '-5', '1.5', '10min', '1e3', '1441', '99999', 'NaN', 'Infinity']) {
      expect(parseIdleTimeoutMinutes(bad), bad).toBe(30);
    }
  });
});

describe('Laufzeit-Konfiguration (config.js)', () => {
  const CLIENT = '11111111-2222-3333-4444-555555555555';
  const TENANT = 'contoso.onmicrosoft.com';

  it('übernimmt nicht-leere Laufzeitwerte vor den Build-Werten', () => {
    const merged = mergeConfigValues(
      { VITE_APP_MODE: 'demo', VITE_MSAL_CLIENT_ID: '' },
      { VITE_APP_MODE: 'live', VITE_MSAL_CLIENT_ID: CLIENT, VITE_MSAL_TENANT_ID: TENANT },
    );
    expect(merged).toMatchObject({
      VITE_APP_MODE: 'live',
      VITE_MSAL_CLIENT_ID: CLIENT,
      VITE_MSAL_TENANT_ID: TENANT,
    });
  });

  it('behält Build-Werte bei fehlender, leerer oder fremder Laufzeit-Konfiguration', () => {
    const build = { VITE_APP_MODE: 'live', VITE_MSAL_CLIENT_ID: CLIENT };
    expect(mergeConfigValues(build, undefined)).toEqual(build);
    expect(mergeConfigValues(build, null)).toEqual(build);
    expect(mergeConfigValues(build, 'live')).toEqual(build);
    expect(
      mergeConfigValues(build, { VITE_APP_MODE: '  ', VITE_MSAL_CLIENT_ID: 42, OTHER: 'x' }),
    ).toEqual(build);
  });

  it('baut daraus die App-Konfiguration; Redirect-URI fällt auf den Origin zurück', () => {
    const config = resolveAppConfig(
      { VITE_APP_MODE: 'live', VITE_MSAL_CLIENT_ID: ` ${CLIENT} `, VITE_MSAL_TENANT_ID: TENANT },
      'https://mdm.contoso.com',
    );
    expect(config.defaultMode).toBe('live');
    expect(config.msal).toEqual({
      clientId: CLIENT,
      tenantId: TENANT,
      redirectUri: 'https://mdm.contoso.com',
    });
    expect(config.idleTimeoutMinutes).toBe(DEFAULT_IDLE_TIMEOUT_MINUTES);
    expect(resolveAppConfig({ VITE_APP_MODE: 'other' }, 'x').defaultMode).toBe('demo');
  });
});
