import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  InteractionRequiredAuthError,
  type AccountInfo,
  type IPublicClientApplication,
} from '@azure/msal-browser';
import { describe, expect, it, vi } from 'vitest';
import { LOGIN_SCOPES } from '../graph/scopes';
import { de } from '../i18n/de';
import { GraphRequestError } from '../graph/client';
import { AccountButton, AuthGate } from './AuthGate';
import { createMsalConfiguration } from './msalConfig';
import { getGraphToken, initMsal } from './token';

const ACCOUNT = {
  homeAccountId: 'h',
  environment: 'login.microsoftonline.com',
  tenantId: 'contoso-tenant',
  username: 'admin@contoso.com',
  localAccountId: 'l',
  name: 'Ada Admin',
} as AccountInfo;

function fakeMsal(
  options: { accounts?: AccountInfo[]; silent?: () => Promise<{ accessToken: string }> } = {},
) {
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
    logoutRedirect: vi.fn(async () => {
      accounts = [];
    }),
    acquireTokenSilent: vi.fn(options.silent ?? (async () => ({ accessToken: 'tok' }))),
    acquireTokenRedirect: vi.fn(async () => undefined),
  };
  return instance as typeof instance & IPublicClientApplication;
}

describe('createMsalConfiguration', () => {
  it('nutzt Tenant-Authority, Redirect-URI und sessionStorage', () => {
    const config = createMsalConfiguration({
      clientId: 'client-1',
      tenantId: 'tenant-1',
      redirectUri: 'http://localhost:5173',
    });
    expect(config.auth).toMatchObject({
      clientId: 'client-1',
      authority: 'https://login.microsoftonline.com/tenant-1',
      redirectUri: 'http://localhost:5173',
    });
    expect(config.cache?.cacheLocation).toBe('sessionStorage');
  });
});

describe('getGraphToken', () => {
  it('initialisiert MSAL genau einmal und holt das Token still mit LOGIN_SCOPES', async () => {
    const msal = fakeMsal({ accounts: [ACCOUNT] });
    await expect(getGraphToken(msal)).resolves.toBe('tok');
    await expect(getGraphToken(msal)).resolves.toBe('tok');
    expect(msal.initialize).toHaveBeenCalledTimes(1);
    expect(msal.handleRedirectPromise).toHaveBeenCalledTimes(1);
    expect(msal.acquireTokenSilent).toHaveBeenCalledWith({
      scopes: LOGIN_SCOPES,
      account: ACCOUNT,
    });
  });

  it('wirft unauthenticated ohne Konto', async () => {
    const error = await getGraphToken(fakeMsal()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GraphRequestError);
    expect((error as GraphRequestError).error.code).toBe('unauthenticated');
  });

  it('leitet bei InteractionRequiredAuthError per Redirect um', async () => {
    const msal = fakeMsal({
      accounts: [ACCOUNT],
      silent: async () => {
        throw new InteractionRequiredAuthError('interaction_required', 'Interaktion nötig');
      },
    });
    const pending = vi.fn();
    void getGraphToken(msal).then(pending);
    await waitFor(() => expect(msal.acquireTokenRedirect).toHaveBeenCalledTimes(1));
    expect(msal.acquireTokenRedirect).toHaveBeenCalledWith({
      scopes: LOGIN_SCOPES,
      account: ACCOUNT,
    });
    expect(pending).not.toHaveBeenCalled();
  });

  it('reicht andere Fehler durch', async () => {
    const msal = fakeMsal({
      accounts: [ACCOUNT],
      silent: async () => {
        throw new Error('network down');
      },
    });
    await expect(getGraphToken(msal)).rejects.toThrow('network down');
    expect(msal.acquireTokenRedirect).not.toHaveBeenCalled();
  });
});

describe('initMsal', () => {
  it('setzt das Konto aus dem Redirect-Ergebnis aktiv', async () => {
    const msal = fakeMsal();
    msal.handleRedirectPromise.mockResolvedValueOnce({ account: ACCOUNT } as never);
    await initMsal(msal);
    expect(msal.setActiveAccount).toHaveBeenCalledWith(ACCOUNT);
  });
});

describe('AuthGate', () => {
  it('zeigt ohne Konto den Login und startet Login per Redirect mit LOGIN_SCOPES', async () => {
    const msal = fakeMsal();
    render(
      <AuthGate instance={msal}>
        <p>Geheimer Inhalt</p>
      </AuthGate>,
    );
    const button = await screen.findByRole('button', { name: de.auth.signIn });
    expect(screen.queryByText('Geheimer Inhalt')).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(msal.loginRedirect).toHaveBeenCalledWith({ scopes: LOGIN_SCOPES });
  });

  it('rendert children erst nach Anmeldung', async () => {
    render(
      <AuthGate instance={fakeMsal({ accounts: [ACCOUNT] })}>
        <p>Geheimer Inhalt</p>
      </AuthGate>,
    );
    expect(await screen.findByText('Geheimer Inhalt')).toBeInTheDocument();
  });
});

describe('AccountButton', () => {
  it('zeigt das Konto und meldet per Redirect ab', async () => {
    const msal = fakeMsal({ accounts: [ACCOUNT] });
    render(<AccountButton instance={msal} />);
    expect(await screen.findByText('Ada Admin')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: de.auth.signOut }));
    expect(msal.logoutRedirect).toHaveBeenCalledWith({ account: ACCOUNT });
  });

  it('rendert nichts ohne Konto', async () => {
    const msal = fakeMsal();
    const { container } = render(<AccountButton instance={msal} />);
    await waitFor(() => expect(msal.handleRedirectPromise).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
