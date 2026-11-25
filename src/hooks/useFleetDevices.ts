/**
 * Lädt die Geräteliste der Ansicht „Flotte“ (M22) über die Provider-Schnittstelle. Die Quelle kommt als
 * SectionResult (fehlende Berechtigung usw. bleibt eine Zustandsmeldung der Ansicht); nur ein Abbruch
 * oder ein unerwarteter Fehler des Aufrufs selbst führt zu `error`.
 */
import { useCallback, useEffect, useState } from 'react';
import type { FleetDevicesInfo } from '../domain/fleetDevices';
import type { AppError, SectionResult } from '../domain/types';
import { de } from '../i18n/de';
import { ProviderError, type DeviceDataProvider } from '../providers/DeviceDataProvider';

export type FleetDevicesState =
  | { status: 'loading'; section: null; error: null; now: null }
  | { status: 'done'; section: SectionResult<FleetDevicesInfo>; error: null; now: Date }
  | { status: 'error'; section: null; error: AppError; now: null };

const LOADING: FleetDevicesState = { status: 'loading', section: null, error: null, now: null };

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Ergebnis eines Ladevorgangs, zugeordnet zum Provider und zur Ladenummer (erneut laden = neue Nummer). */
type Settled = { provider: DeviceDataProvider; run: number; state: FleetDevicesState };

export function useFleetDevices(provider: DeviceDataProvider): {
  state: FleetDevicesState;
  reload: () => void;
} {
  const [run, setRun] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    const finish = (state: FleetDevicesState) => {
      if (!abort.signal.aborted) setSettled({ provider, run, state });
    };
    provider
      .getFleetDevices({ signal: abort.signal })
      .then((section) => finish({ status: 'done', section, error: null, now: new Date() }))
      .catch((error: unknown) => {
        if (abort.signal.aborted || isAbort(error)) return;
        const appError: AppError =
          error instanceof ProviderError
            ? error.error
            : { code: 'unknown', message: de.errors.unknown };
        finish({ status: 'error', section: null, error: appError, now: null });
      });
    return () => abort.abort();
  }, [provider, run]);

  const state =
    settled && settled.provider === provider && settled.run === run ? settled.state : LOADING;
  const reload = useCallback(() => setRun((n) => n + 1), []);
  return { state, reload };
}
