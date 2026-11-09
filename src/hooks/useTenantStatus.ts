/**
 * Lädt den Mandanten-Status (M14/S5) über die Provider-Schnittstelle. Beide Quellen (Push-Zertifikat,
 * VPP-Token) kommen als eigene SectionResults – ein Fehler einer Quelle betrifft nur ihre Kachel.
 * Nur ein Abbruch oder ein unerwarteter Fehler des Aufrufs selbst führt zu `error`.
 */
import { useCallback, useEffect, useState } from 'react';
import type { AppError, TenantStatus } from '../domain/types';
import { de } from '../i18n/de';
import { ProviderError, type DeviceDataProvider } from '../providers/DeviceDataProvider';

export type TenantStatusState =
  | { status: 'loading'; data: null; error: null; now: null }
  | { status: 'done'; data: TenantStatus; error: null; now: Date }
  | { status: 'error'; data: null; error: AppError; now: null };

const LOADING: TenantStatusState = { status: 'loading', data: null, error: null, now: null };

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Ergebnis eines Ladevorgangs, zugeordnet zum Provider und zur Ladenummer (erneut laden = neue Nummer). */
type Settled = { provider: DeviceDataProvider; run: number; state: TenantStatusState };

export function useTenantStatus(provider: DeviceDataProvider): {
  state: TenantStatusState;
  reload: () => void;
} {
  const [run, setRun] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    const finish = (state: TenantStatusState) => {
      if (!abort.signal.aborted) setSettled({ provider, run, state });
    };
    provider
      .getTenantStatus({ signal: abort.signal })
      .then((data) => finish({ status: 'done', data, error: null, now: new Date() }))
      .catch((error: unknown) => {
        if (abort.signal.aborted || isAbort(error)) return;
        const appError: AppError =
          error instanceof ProviderError
            ? error.error
            : { code: 'unknown', message: de.errors.unknown };
        finish({ status: 'error', data: null, error: appError, now: null });
      });
    return () => abort.abort();
  }, [provider, run]);

  // „lädt“ ist abgeleitet: Solange kein Ergebnis zu diesem Provider und dieser Ladenummer vorliegt.
  const state =
    settled && settled.provider === provider && settled.run === run ? settled.state : LOADING;
  const reload = useCallback(() => setRun((n) => n + 1), []);
  return { state, reload };
}
