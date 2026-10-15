/**
 * Login-Schranke für den Live-Modus: rendert `children` erst nach erfolgreicher Anmeldung
 * (Authorization Code + PKCE per Redirect). `AccountButton` zeigt Konto + Abmelden und
 * funktioniert auch außerhalb der Schranke (z. B. in der Toolbar).
 */
import { useState, type ReactNode } from 'react';
import type { IPublicClientApplication } from '@azure/msal-browser';
import { LogOut } from 'lucide-react';
import { isLiveConfigured } from '../config';
import { de } from '../i18n/de';
import { getMsalInstance } from './msalConfig';
import { signIn, signOut } from './token';
import { useMsalAccount } from './useMsalAccount';

interface AuthProps {
  /** Nur für Tests – Standard ist die prozessweite MSAL-Instanz. */
  instance?: IPublicClientApplication;
}

export interface AuthGateProps extends AuthProps {
  children: ReactNode;
  /** Zusätzliche Aktion unter dem Anmelde-Button (z. B. "Zum Demo-Modus wechseln") */
  secondaryAction?: ReactNode;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 text-label">
      <div className="w-full max-w-md space-y-4 rounded-tile bg-surface p-6 text-center shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_rgb(0_0_0/0.04)]">
        {children}
      </div>
    </div>
  );
}

function ConfiguredGate({
  children,
  instance,
  secondaryAction,
}: AuthGateProps & { instance: IPublicClientApplication }) {
  const auth = useMsalAccount(instance);
  const [redirecting, setRedirecting] = useState(false);
  const [signInError, setSignInError] = useState(false);

  if (auth.status === 'signedIn') return <>{children}</>;

  if (auth.status === 'loading') {
    return (
      <Centered>
        <p role="status" aria-live="polite" className="text-secondary-label">
          {de.auth.loading}
        </p>
      </Centered>
    );
  }

  const startSignIn = () => {
    setRedirecting(true);
    setSignInError(false);
    signIn(instance).catch(() => {
      setRedirecting(false);
      setSignInError(true);
    });
  };

  return (
    <Centered>
      <h1 className="text-title font-semibold">{de.auth.title}</h1>
      <p className="text-sm text-secondary-label">{de.auth.description}</p>
      {(auth.status === 'error' || signInError) && (
        <p role="alert" className="text-sm text-critical">
          {de.auth.failed}
        </p>
      )}
      <button
        type="button"
        onClick={startSignIn}
        disabled={redirecting}
        className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-transform duration-100 ease-out focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.97] disabled:opacity-60"
      >
        {redirecting ? de.auth.signingIn : de.auth.signIn}
      </button>
      {secondaryAction}
    </Centered>
  );
}

export function AuthGate({ children, instance, secondaryAction }: AuthGateProps) {
  if (!isLiveConfigured && !instance) {
    return (
      <Centered>
        <p role="alert" className="text-sm text-secondary-label">
          {de.auth.notConfigured}
        </p>
        {secondaryAction}
      </Centered>
    );
  }
  return (
    <ConfiguredGate instance={instance ?? getMsalInstance()} secondaryAction={secondaryAction}>
      {children}
    </ConfiguredGate>
  );
}

function ConfiguredAccountButton({ instance }: { instance: IPublicClientApplication }) {
  const auth = useMsalAccount(instance);
  if (auth.status !== 'signedIn') return null;
  const { account } = auth;
  const label = account.name || account.username;
  return (
    <div className="flex items-center gap-2 text-sm" aria-label={de.auth.account}>
      <span className="max-w-[12rem] truncate text-secondary-label" title={account.username}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => void signOut(instance)}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-accent transition-transform duration-100 ease-out focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
      >
        <LogOut aria-hidden="true" size={16} />
        {de.auth.signOut}
      </button>
    </div>
  );
}

/** Konto-Anzeige + Abmelden; rendert nichts, solange niemand angemeldet ist (oder Live nicht konfiguriert). */
export function AccountButton({ instance }: AuthProps) {
  if (!isLiveConfigured && !instance) return null;
  return <ConfiguredAccountButton instance={instance ?? getMsalInstance()} />;
}
