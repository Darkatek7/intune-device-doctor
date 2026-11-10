import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AccountInfo, IPublicClientApplication } from '@azure/msal-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOGIN_SCOPES } from '../graph/scopes';
import { recentStorageKey } from '../hooks/useRecentDevices';
import { de } from '../i18n/de';
import { AccountButton, AuthGate } from './AuthGate';
import { markIdleSignOut, readIdleSignOutMinutes, shouldForceLogin } from './sessionState';
import { initMsal, signIn, signOut } from './token';
import { IDLE_WARNING_MS, useIdleTimeout } from './useIdleTimeout';

const ACCOUNT = {
  homeAccountId: 'h',
  environment: 'login.microsoftonline.com',
  tenantId: 'contoso-tenant',
  username: 'admin@contoso.com',
  localAccountId: 'l',
  name: 'Ada Admin',
} as AccountInfo;

function fakeMsal(options: { accounts?: AccountInfo[] } = {}) {
  let accounts = options.accounts ?? [];
  let active: AccountInfo | null = null;
  const instance = {
    initialize: vi.fn(async () => undefined),
    handleRedirectPromise: vi.fn(async () => null),
    getAllAccounts: vi.fn(() => accounts),
    getActiveAccount: vi.fn(() => active),
    setActiveAccount: vi.fn((a: AccountInfo | null) => {
      active = a;
    }),
    addEventCallback: vi.fn(() => 'cb'),
    removeEventCallback: vi.fn(),
    loginRedirect: vi.fn(async () => undefined),
    logoutRedirect: vi.fn(async () => undefined),
    // Lokale Abmeldung: leert den Cache, navigiert nicht und sendet kein Ereignis.
    clearCache: vi.fn(async () => {
      accounts = [];
    }),
    acquireTokenSilent: vi.fn(async () => ({ accessToken: 'tok' })),
    acquireTokenRedirect: vi.fn(async () => undefined),
  };
  return instance as typeof instance & IPublicClientApplication;
}

const MIN = 60_000;
const LIVE_KEY = recentStorageKey('live');
const DEMO_KEY = recentStorageKey('demo');
const RECENT = JSON.stringify([
  { id: 'd1', deviceName: 'CONTOSO-PC042', osFamily: 'windows', openedAt: '2026-11-10T08:00:00Z' },
]);

/**
 * Fake-Timer ohne requestAnimationFrame: Wird rAF gefälscht, hängt die motion-Frameloop und
 * spätere Tests laufen nie zu Ende.
 */
function useFakeClock() {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useIdleTimeout', () => {
  function setup(timeoutMs = 10 * MIN) {
    const onExpire = vi.fn();
    const hook = renderHook(() => useIdleTimeout({ timeoutMs, onExpire }));
    return { onExpire, hook };
  }

  it('warnt 60 s vor Ablauf und meldet beim Ablauf genau einmal', async () => {
    useFakeClock();
    const { onExpire, hook } = setup();

    await advance(10 * MIN - IDLE_WARNING_MS - 2000);
    expect(hook.result.current.warning).toBe(false);

    await advance(2000);
    expect(hook.result.current.warning).toBe(true);
    expect(hook.result.current.secondsLeft).toBeLessThanOrEqual(60);
    expect(onExpire).not.toHaveBeenCalled();

    await advance(IDLE_WARNING_MS);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(hook.result.current.warning).toBe(false);

    await advance(5 * MIN);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('Aktivität (Zeiger, Taste, Scroll) setzt den Timer zurück', async () => {
    useFakeClock();
    const { onExpire } = setup();

    for (const type of ['pointermove', 'keydown', 'scroll'] as const) {
      await advance(8 * MIN);
      act(() => {
        window.dispatchEvent(new Event(type));
      });
    }
    expect(onExpire).not.toHaveBeenCalled();

    await advance(8 * MIN);
    expect(onExpire).not.toHaveBeenCalled();
    await advance(2 * MIN + 1000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('Rückkehr in den Tab zählt als Aktivität', async () => {
    useFakeClock();
    const { onExpire } = setup();
    await advance(8 * MIN);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await advance(8 * MIN);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('während der Vorwarnung dismissen nur bewusste Eingaben, nicht Mausrauschen oder Scrollen', async () => {
    useFakeClock();
    const { onExpire, hook } = setup();
    await advance(10 * MIN - 30_000);
    expect(hook.result.current.warning).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('pointermove'));
      window.dispatchEvent(new Event('scroll'));
    });
    await advance(1000);
    expect(hook.result.current.warning).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('keydown'));
    });
    expect(hook.result.current.warning).toBe(false);
    await advance(MIN);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('stayActive („Angemeldet bleiben“) verlängert die Sitzung', async () => {
    useFakeClock();
    const { onExpire, hook } = setup();
    await advance(10 * MIN - 20_000);
    expect(hook.result.current.warning).toBe(true);

    act(() => hook.result.current.stayActive());
    expect(hook.result.current.warning).toBe(false);
    await advance(9 * MIN);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('überfällige Sitzung (Rechner schlief) läuft sofort ab; Aktivität belebt sie nicht wieder', async () => {
    useFakeClock();
    const { onExpire } = setup();
    // Uhr springt 2 h vor, ohne dass Timer-Ticks stattfanden (Schlafmodus).
    vi.setSystemTime(Date.now() + 120 * MIN);
    act(() => {
      window.dispatchEvent(new Event('keydown'));
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('ohne Timeout (≤ 0) bleibt alles ruhig', async () => {
    useFakeClock();
    const { onExpire, hook } = setup(0);
    await advance(10 * 60 * MIN);
    expect(onExpire).not.toHaveBeenCalled();
    expect(hook.result.current.warning).toBe(false);
  });

  it('räumt Listener und Intervall beim Unmount auf', async () => {
    useFakeClock();
    const { onExpire, hook } = setup();
    hook.unmount();
    await advance(60 * MIN);
    expect(onExpire).not.toHaveBeenCalled();
  });
});

describe('AuthGate: Abmeldung bei Inaktivität', () => {
  async function renderSignedIn(minutes = 30) {
    const msal = fakeMsal({ accounts: [ACCOUNT] });
    render(
      <AuthGate instance={msal} idleTimeoutMinutes={minutes}>
        <p>Geräteliste CONTOSO-PC042</p>
      </AuthGate>,
    );
    await advance(0);
    expect(screen.getByText('Geräteliste CONTOSO-PC042')).toBeInTheDocument();
    return msal;
  }

  it('zeigt 60 s vorher einen zugänglichen Hinweis ohne Fokus-Klau', async () => {
    useFakeClock();
    await renderSignedIn(30);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await advance(30 * MIN - 50_000);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(de.auth.idleWarningTitle);
    expect(alert).not.toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByRole('button', { name: de.auth.idleStay })).toBeInTheDocument();
  });

  it('„Angemeldet bleiben“ schließt den Hinweis und meldet nicht ab', async () => {
    useFakeClock();
    const msal = await renderSignedIn(30);
    await advance(30 * MIN - 50_000);
    fireEvent.click(screen.getByRole('button', { name: de.auth.idleStay }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await advance(20 * MIN);
    expect(msal.clearCache).not.toHaveBeenCalled();
    expect(screen.getByText('Geräteliste CONTOSO-PC042')).toBeInTheDocument();
  });

  it('meldet beim Ablauf lokal ab: kein logoutRedirect, Daten weg, Hinweis, Live-Liste gelöscht, Demo-Liste unberührt', async () => {
    useFakeClock();
    window.localStorage.setItem(LIVE_KEY, RECENT);
    window.localStorage.setItem(DEMO_KEY, RECENT);
    const msal = await renderSignedIn(30);

    await advance(30 * MIN + 1000);

    expect(msal.clearCache).toHaveBeenCalledTimes(1);
    expect(msal.logoutRedirect).not.toHaveBeenCalled();
    expect(msal.setActiveAccount).toHaveBeenLastCalledWith(null);
    expect(screen.queryByText('Geräteliste CONTOSO-PC042')).not.toBeInTheDocument();
    expect(screen.queryByText(/CONTOSO-PC042/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: de.auth.signIn })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Aus Sicherheitsgründen nach 30 Minuten Inaktivität abgemeldet.',
    );
    expect(window.localStorage.getItem(LIVE_KEY)).toBeNull();
    expect(window.localStorage.getItem(DEMO_KEY)).toBe(RECENT);
    expect(shouldForceLogin()).toBe(true);
  });

  it('die nächste Anmeldung erzwingt eine erneute Authentifizierung (prompt: login)', async () => {
    useFakeClock();
    const msal = await renderSignedIn(30);
    await advance(30 * MIN + 1000);

    fireEvent.click(screen.getByRole('button', { name: de.auth.signIn }));
    await advance(0);
    expect(msal.loginRedirect).toHaveBeenCalledWith({ scopes: LOGIN_SCOPES, prompt: 'login' });
  });

  it('ohne Abmeldung wegen Inaktivität wird kein prompt gesetzt', async () => {
    const msal = fakeMsal();
    await signIn(msal);
    expect(msal.loginRedirect).toHaveBeenCalledWith({ scopes: LOGIN_SCOPES });
    const [request] = msal.loginRedirect.mock.calls[0] as unknown as [object];
    expect(request).not.toHaveProperty('prompt');
  });

  it('nach erfolgreicher Rückkehr vom Login sind Hinweis und Erzwingung zurückgesetzt', async () => {
    markIdleSignOut(30);
    const msal = fakeMsal();
    msal.handleRedirectPromise.mockResolvedValueOnce({ account: ACCOUNT } as never);
    await initMsal(msal);
    expect(readIdleSignOutMinutes()).toBeNull();
    expect(shouldForceLogin()).toBe(false);
  });

  it('Timeout 0 schaltet die Abmeldung bei Inaktivität ab', async () => {
    useFakeClock();
    const msal = await renderSignedIn(0);
    await advance(5 * 60 * MIN);
    expect(msal.clearCache).not.toHaveBeenCalled();
    expect(screen.getByText('Geräteliste CONTOSO-PC042')).toBeInTheDocument();
  });

  it('einzelne Minute wird im Singular formuliert', () => {
    expect(de.auth.idleSignedOut(1)).toBe(
      'Aus Sicherheitsgründen nach 1 Minute Inaktivität abgemeldet.',
    );
  });
});

describe('manuelle Abmeldung', () => {
  it('löscht die Live-Liste „Zuletzt geöffnet“, die Demo-Liste bleibt', async () => {
    window.localStorage.setItem(LIVE_KEY, RECENT);
    window.localStorage.setItem(DEMO_KEY, RECENT);
    const msal = fakeMsal({ accounts: [ACCOUNT] });
    render(<AccountButton instance={msal} />);
    await userEvent.click(await screen.findByRole('button', { name: de.auth.signOut }));

    expect(msal.logoutRedirect).toHaveBeenCalledWith({ account: ACCOUNT });
    expect(window.localStorage.getItem(LIVE_KEY)).toBeNull();
    expect(window.localStorage.getItem(DEMO_KEY)).toBe(RECENT);
  });

  it('signOut() räumt auch ohne Komponente auf', async () => {
    window.localStorage.setItem(LIVE_KEY, RECENT);
    await signOut(fakeMsal({ accounts: [ACCOUNT] }));
    expect(window.localStorage.getItem(LIVE_KEY)).toBeNull();
  });
});
