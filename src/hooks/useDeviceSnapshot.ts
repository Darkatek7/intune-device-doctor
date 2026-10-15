/**
 * Lädt ein Gerät progressiv: erst getDevice, dann alle Sections parallel. Jede Section aktualisiert
 * den Snapshot einzeln (Kacheln erscheinen nacheinander). Abort bei Gerätewechsel/Unmount.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppError,
  DataSource,
  DeviceSnapshot,
  ManagedDeviceInfo,
  SectionResult,
  SnapshotSectionKey,
} from '../domain/types';
import type { DiagnosticsReport } from '../diagnostics/types';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { isAbort, toAppError } from './useDeviceSearch';

export const SECTION_KEYS: SnapshotSectionKey[] = [
  'protection',
  'compliancePolicies',
  'configurationPolicies',
  'entraDevice',
  'bitlockerKeys',
];

export type SnapshotStatus = 'loading' | 'ready' | 'error';

interface InternalState {
  /** provider-Modus + Geräte-ID, zu der der Zustand gehört */
  key: string;
  status: SnapshotStatus;
  snapshot: DeviceSnapshot | null;
  error: AppError | null;
  /** Zeitpunkt der letzten Aktualisierung – Grundlage für relative Zeiten in den Regeln */
  now: Date;
}

function loadSection(
  provider: DeviceDataProvider,
  key: SnapshotSectionKey,
  device: ManagedDeviceInfo,
  signal: AbortSignal,
): Promise<SectionResult<unknown>> {
  switch (key) {
    case 'protection':
      return provider.getProtectionState(device, { signal });
    case 'compliancePolicies':
      return provider.getCompliancePolicyStates(device, { signal });
    case 'configurationPolicies':
      return provider.getConfigurationPolicyStates(device, { signal });
    case 'entraDevice':
      return provider.getEntraDevice(device, { signal });
    case 'bitlockerKeys':
      return provider.getBitLockerKeys(device, { signal });
  }
}

export function useDeviceSnapshot(
  provider: DeviceDataProvider | null,
  deviceId: string | null,
  /** Optional: Befunde aus einer DiagLogs-ZIP – werden in den Snapshot übernommen (ohne Neuladen). */
  diagnostics?: DiagnosticsReport,
) {
  const key = provider && deviceId ? `${provider.mode}:${deviceId}` : '';
  const [state, setState] = useState<InternalState | null>(null);
  const run = useRef<{
    controller: AbortController;
    provider: DeviceDataProvider;
    device: ManagedDeviceInfo;
    key: string;
  } | null>(null);

  const fetchSection = useCallback(
    async (sectionKey: SnapshotSectionKey, ctx: NonNullable<typeof run.current>): Promise<void> => {
      const { controller, provider: p, device, key: stateKey } = ctx;
      let result: SectionResult<unknown>;
      try {
        result = await loadSection(p, sectionKey, device, controller.signal);
      } catch (error) {
        if (controller.signal.aborted || isAbort(error)) return;
        // Vertrag: Section-Methoden werfen nicht. Defensiv trotzdem als Fehler-Section abbilden.
        const source: DataSource = {
          kind: p.mode === 'demo' ? 'mock' : 'graph',
          label: sectionKey,
        };
        result = { status: 'error', error: toAppError(error), source };
      }
      if (controller.signal.aborted) return;
      setState((prev) =>
        prev && prev.key === stateKey && prev.snapshot
          ? {
              ...prev,
              snapshot: { ...prev.snapshot, [sectionKey]: result },
              now: new Date(),
            }
          : prev,
      );
    },
    [],
  );

  useEffect(() => {
    if (!provider || !deviceId) {
      run.current = null;
      return;
    }
    const controller = new AbortController();
    const stateKey = `${provider.mode}:${deviceId}`;
    run.current = null;

    void (async () => {
      let device: ManagedDeviceInfo;
      try {
        device = await provider.getDevice(deviceId, { signal: controller.signal });
      } catch (error) {
        if (controller.signal.aborted || isAbort(error)) return;
        setState({
          key: stateKey,
          status: 'error',
          snapshot: null,
          error: toAppError(error),
          now: new Date(),
        });
        return;
      }
      if (controller.signal.aborted) return;
      const ctx = { controller, provider, device, key: stateKey };
      run.current = ctx;
      setState({
        key: stateKey,
        status: 'ready',
        snapshot: { device },
        error: null,
        now: new Date(),
      });
      await Promise.all(SECTION_KEYS.map((k) => fetchSection(k, ctx)));
    })();

    return () => {
      controller.abort();
      run.current = null;
    };
  }, [provider, deviceId, fetchSection]);

  /** Setzt die Section zurück (→ Kachel lädt wieder) und fragt sie erneut ab. */
  const retrySection = useCallback(
    (sectionKey: SnapshotSectionKey) => {
      const ctx = run.current;
      if (!ctx) return;
      setState((prev) =>
        prev && prev.key === ctx.key && prev.snapshot
          ? { ...prev, snapshot: { ...prev.snapshot, [sectionKey]: undefined }, now: new Date() }
          : prev,
      );
      void fetchSection(sectionKey, ctx);
    },
    [fetchSection],
  );

  const current = state && state.key === key ? state : null;
  const loaded = current?.snapshot ?? null;
  const snapshot = useMemo<DeviceSnapshot | null>(
    () => (loaded && diagnostics ? { ...loaded, diagnostics } : loaded),
    [loaded, diagnostics],
  );
  return {
    status: (key ? (current?.status ?? 'loading') : 'loading') as SnapshotStatus,
    snapshot,
    error: current?.error ?? null,
    now: current?.now ?? null,
    retrySection,
  };
}
