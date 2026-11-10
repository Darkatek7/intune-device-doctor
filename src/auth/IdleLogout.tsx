/**
 * Automatische Abmeldung bei Inaktivität (Live-Modus, M16/S2): Timer + Vorwarnung 60 s vorher.
 * Die Warnung ist ein nicht-modaler Hinweis (`role="alert"`) ohne Fokus-Verschiebung, damit
 * eine laufende Eingabe nicht unterbrochen wird.
 */
import type { IPublicClientApplication } from '@azure/msal-browser';
import { Clock } from 'lucide-react';
import { de } from '../i18n/de';
import { signOutInactive } from './token';
import { useIdleTimeout } from './useIdleTimeout';

interface Props {
  instance: IPublicClientApplication;
  minutes: number;
}

export function IdleLogout({ instance, minutes }: Props) {
  const { warning, secondsLeft, stayActive } = useIdleTimeout({
    timeoutMs: minutes * 60_000,
    onExpire: () => {
      void signOutInactive(instance, minutes).catch(() => undefined);
    },
  });

  if (!warning) return null;
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center">
      <div
        role="alert"
        className="pointer-events-auto hc-edge w-full max-w-md space-y-3 rounded-tile material-card p-4 text-label shadow-[0_8px_40px_rgb(0_0_0/0.22)]"
      >
        <div className="flex items-start gap-3">
          <Clock aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-warning" />
          <div className="space-y-1">
            <p className="font-semibold">{de.auth.idleWarningTitle}</p>
            <p className="text-sm text-secondary-label">{de.auth.idleWarning}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span aria-hidden="true" className="text-sm tabular-nums text-secondary-label">
            {de.auth.idleSecondsLeft(secondsLeft)}
          </span>
          <button
            type="button"
            onClick={stayActive}
            className="rounded-full bg-accent-fill px-5 py-2 text-sm font-medium text-white transition-transform duration-100 ease-out focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.97]"
          >
            {de.auth.idleStay}
          </button>
        </div>
      </div>
    </div>
  );
}
