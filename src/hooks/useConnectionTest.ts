/**
 * Verbindungstest (M14/S6, nur Live): lädt das Gerät und führt den Test über die Provider-Schnittstelle
 * aus. Der Test startet nie von selbst, läuft sequenziell im Provider und ist jederzeit abbrechbar; bereits
 * gemeldete Ergebnisse bleiben nach einem Abbruch erhalten. Im Zustand stehen ausschließlich
 * EndpointProbeResults (Ergebnis, Dauer, Anzahl, Feldnamen) – keine Antwortwerte.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppError, EndpointProbeResult, ManagedDeviceInfo } from '../domain/types';
import { de } from '../i18n/de';
import { ProviderError, type DeviceDataProvider } from '../providers/DeviceDataProvider';

export type ConnectionTestState =
  | { phase: 'idle' }
  | { phase: 'running'; results: EndpointProbeResult[]; total: number | null }
  | { phase: 'done' | 'cancelled'; results: EndpointProbeResult[]; finishedAt: Date }
  | { phase: 'failed'; results: EndpointProbeResult[]; error: AppError };

export type ConnectionTestDevice =
  | { status: 'loading'; device: null; error: null }
  | { status: 'ready'; device: ManagedDeviceInfo; error: null }
  | { status: 'error'; device: null; error: AppError };

const LOADING: ConnectionTestDevice = { status: 'loading', device: null, error: null };
const IDLE: ConnectionTestState = { phase: 'idle' };

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function toAppError(error: unknown): AppError {
  return error instanceof ProviderError
    ? error.error
    : { code: 'unknown', message: de.errors.unknown };
}

type Loaded = {
  provider: DeviceDataProvider;
  deviceId: string;
  run: number;
  state: ConnectionTestDevice;
};

export function useConnectionTest(
  provider: DeviceDataProvider,
  deviceId: string,
): {
  device: ConnectionTestDevice;
  test: ConnectionTestState;
  /** false im Demo-Modus (der Provider bietet keinen Verbindungstest) */
  supported: boolean;
  start: () => void;
  cancel: () => void;
  /** Gerät erneut laden (nach einem Ladefehler) */
  reloadDevice: () => void;
} {
  const [run, setRun] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [test, setTest] = useState<ConnectionTestState>(IDLE);
  const running = useRef<AbortController | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    provider
      .getDevice(deviceId, { signal: abort.signal })
      .then((device) => {
        if (!abort.signal.aborted) {
          setLoaded({ provider, deviceId, run, state: { status: 'ready', device, error: null } });
        }
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted || isAbort(error)) return;
        setLoaded({
          provider,
          deviceId,
          run,
          state: { status: 'error', device: null, error: toAppError(error) },
        });
      });
    return () => abort.abort();
  }, [provider, deviceId, run]);

  // Beim Verlassen der Ansicht läuft kein Test weiter.
  useEffect(
    () => () => {
      running.current?.abort();
      running.current = null;
    },
    [],
  );

  const device =
    loaded && loaded.provider === provider && loaded.deviceId === deviceId && loaded.run === run
      ? loaded.state
      : LOADING;
  const supported = typeof provider.testConnection === 'function';

  const start = useCallback(() => {
    if (device.status !== 'ready' || !provider.testConnection) return;
    running.current?.abort();
    const abort = new AbortController();
    running.current = abort;
    setTest({ phase: 'running', results: [], total: null });
    provider
      .testConnection(device.device, {
        signal: abort.signal,
        onResult: (result, _index, total) => {
          if (running.current !== abort) return;
          setTest((current) =>
            current.phase === 'running'
              ? { phase: 'running', results: [...current.results, result], total }
              : current,
          );
        },
      })
      .then((results) => {
        if (running.current !== abort) return;
        running.current = null;
        setTest({ phase: 'done', results, finishedAt: new Date() });
      })
      .catch((error: unknown) => {
        if (running.current !== abort) return;
        running.current = null;
        setTest((current) => {
          const results = current.phase === 'running' ? current.results : [];
          return isAbort(error)
            ? { phase: 'cancelled', results, finishedAt: new Date() }
            : { phase: 'failed', results, error: toAppError(error) };
        });
      });
  }, [device, provider]);

  const cancel = useCallback(() => running.current?.abort(), []);

  const reloadDevice = useCallback(() => setRun((n) => n + 1), []);

  return { device, test, supported, start, cancel, reloadDevice };
}
