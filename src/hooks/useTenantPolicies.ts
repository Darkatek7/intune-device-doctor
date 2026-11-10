/**
 * Lädt die Ansicht „Richtlinien“ (M15) über die Provider-Schnittstelle: die Richtlinienliste mit Zählern
 * und – für eine gewählte Richtlinie – den Gerätestatus. Jede Quelle liefert SectionResults; nur ein
 * unerwarteter Fehler des Aufrufs selbst führt zu `error`, ein Abbruch wird verworfen.
 */
import { useCallback, useEffect, useState } from 'react';
import type {
  AppError,
  PolicyDeviceStatusesInfo,
  SectionResult,
  TenantPolicies,
  TenantPolicyKind,
} from '../domain/types';
import { de } from '../i18n/de';
import { ProviderError, type DeviceDataProvider } from '../providers/DeviceDataProvider';

export type LoadState<T> =
  | { status: 'loading'; data: null; error: null; now: null }
  | { status: 'done'; data: T; error: null; now: Date }
  | { status: 'error'; data: null; error: AppError; now: null };

const LOADING = { status: 'loading', data: null, error: null, now: null } as const;

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function toAppError(error: unknown): AppError {
  return error instanceof ProviderError
    ? error.error
    : { code: 'unknown', message: de.errors.unknown };
}

type Settled<T> = { provider: DeviceDataProvider; key: string; run: number; state: LoadState<T> };

/**
 * Gemeinsamer Lade-Ablauf: neu laden bei Wechsel von Provider/Schlüssel oder `reload`, Abbruch beim
 * Verlassen. `key` null = nichts laden. `load` darf nur von provider und key abhängen.
 */
function useLoad<T>(
  provider: DeviceDataProvider,
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
): { state: LoadState<T>; reload: () => void } {
  const [run, setRun] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (key === null) return;
    const abort = new AbortController();
    const finish = (state: LoadState<T>) => {
      if (!abort.signal.aborted) setSettled({ provider, key, run, state });
    };
    load(abort.signal)
      .then((data) => finish({ status: 'done', data, error: null, now: new Date() }))
      .catch((error: unknown) => {
        if (abort.signal.aborted || isAbort(error)) return;
        finish({ status: 'error', data: null, error: toAppError(error), now: null });
      });
    return () => abort.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load hängt nur von provider/key ab
  }, [provider, key, run]);

  const state =
    settled && settled.provider === provider && settled.key === key && settled.run === run
      ? settled.state
      : LOADING;
  const reload = useCallback(() => setRun((n) => n + 1), []);
  return { state, reload };
}

export function useTenantPolicies(provider: DeviceDataProvider): {
  state: LoadState<TenantPolicies>;
  reload: () => void;
} {
  return useLoad<TenantPolicies>(provider, 'policies', (signal) =>
    provider.getTenantPolicies({ signal }),
  );
}

/** Gerätestatus einer Richtlinie; ohne Richtlinie (null) wird nichts geladen. */
export function usePolicyDeviceStatuses(
  provider: DeviceDataProvider,
  policy: { kind: TenantPolicyKind; id: string } | null,
): { state: LoadState<SectionResult<PolicyDeviceStatusesInfo>>; reload: () => void } {
  const kind = policy?.kind;
  const id = policy?.id;
  return useLoad<SectionResult<PolicyDeviceStatusesInfo>>(
    provider,
    kind && id ? `${kind}:${id}` : null,
    (signal) => provider.getPolicyDeviceStatuses({ kind: kind!, id: id! }, { signal }),
  );
}
