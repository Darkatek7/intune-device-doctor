/**
 * Start-Skript des Container-Images (docker/40-mdm-doctor-config.sh): schreibt config.js aus
 * Umgebungsvariablen und lehnt alles ab, was kein erwarteter Wert ist (kein Einschleusen von Code).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = join(import.meta.dirname, '..', 'docker', '40-mdm-doctor-config.sh');
const CLIENT = '11111111-2222-3333-4444-555555555555';

let dir: string;
let target: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mdm-doctor-config-'));
  target = join(dir, 'config.js');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function run(env: Record<string, string>) {
  return spawnSync('sh', [SCRIPT], {
    env: { PATH: process.env.PATH ?? '', MDM_DOCTOR_CONFIG_PATH: target, ...env },
    encoding: 'utf8',
  });
}

function evaluate(): unknown {
  const window: { __MDM_DOCTOR_CONFIG__?: unknown } = {};
  runInNewContext(readFileSync(target, 'utf8'), { window });
  return window.__MDM_DOCTOR_CONFIG__;
}

describe('docker/40-mdm-doctor-config.sh', () => {
  it('schreibt gültige Werte nach config.js', () => {
    const result = run({
      VITE_APP_MODE: 'live',
      VITE_MSAL_CLIENT_ID: CLIENT,
      VITE_MSAL_TENANT_ID: 'contoso.onmicrosoft.com',
      VITE_MSAL_REDIRECT_URI: 'https://mdm.contoso.com:8443/app/',
      VITE_IDLE_TIMEOUT_MINUTES: '15',
    });
    expect(result.status).toBe(0);
    expect(evaluate()).toEqual({
      VITE_APP_MODE: 'live',
      VITE_MSAL_CLIENT_ID: CLIENT,
      VITE_MSAL_TENANT_ID: 'contoso.onmicrosoft.com',
      VITE_MSAL_REDIRECT_URI: 'https://mdm.contoso.com:8443/app/',
      VITE_IDLE_TIMEOUT_MINUTES: '15',
    });
  });

  it('schreibt ohne Variablen ein leeres Objekt (Build-Werte gelten)', () => {
    expect(run({}).status).toBe(0);
    expect(evaluate()).toEqual({});
  });

  it('akzeptiert eine GUID als Tenant-ID', () => {
    expect(run({ VITE_MSAL_TENANT_ID: CLIENT }).status).toBe(0);
    expect(evaluate()).toEqual({ VITE_MSAL_TENANT_ID: CLIENT });
  });

  it.each([
    ['VITE_APP_MODE', 'production'],
    ['VITE_MSAL_CLIENT_ID', 'nicht-eine-guid'],
    ['VITE_MSAL_CLIENT_ID', `${CLIENT}"};alert(1);//`],
    ['VITE_MSAL_TENANT_ID', 'contoso'],
    ['VITE_MSAL_TENANT_ID', 'contoso.com"+alert(1)+"'],
    ['VITE_MSAL_REDIRECT_URI', 'javascript:alert(1)'],
    ['VITE_MSAL_REDIRECT_URI', 'https://contoso.com/"</script>'],
    ['VITE_MSAL_REDIRECT_URI', 'https://contoso.com/\nx'],
    ['VITE_IDLE_TIMEOUT_MINUTES', '30min'],
  ])('bricht bei ungültigem %s ab (%s)', (name, value) => {
    const result = run({ [name]: value });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${name} ist ungültig`);
  });
});
