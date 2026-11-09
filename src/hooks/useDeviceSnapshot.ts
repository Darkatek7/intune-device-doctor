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
import { assignmentLookups } from '../domain/assignmentLookups';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { isAbort, toAppError } from './useDeviceSearch';

/** Sections, die unabhängig voneinander (parallel) laden. */
export const INDEPENDENT_SECTION_KEYS: SnapshotSectionKey[] = [
  'protection',
  'compliancePolicies',
  'configurationPolicies',
  'entraDevice',
  'duplicateDevices',
  'bitlockerKeys',
  'appInstallStates',
  'applePushCertificate',
  'signIns',
  'localAdmin',
  'autopilot',
  'deviceGroups',
  'userDevices',
  'healthAttestation',
  'userLicense',
  'enrollmentLimits',
];

/** Sections, die erst nach den unabhängigen laden, weil sie deren Ergebnis brauchen (M14/S2). */
export const DEPENDENT_SECTION_KEYS: SnapshotSectionKey[] = ['assignments'];

/** Sections, deren Ergebnis die Zuweisungen bestimmt – nach einem Neuladen werden diese neu abgeglichen. */
const ASSIGNMENT_INPUTS: ReadonlySet<SnapshotSectionKey> = new Set([
  'compliancePolicies',
  'configurationPolicies',
  'appInstallStates',
]);

export const SECTION_KEYS: SnapshotSectionKey[] = [
  ...INDEPENDENT_SECTION_KEYS,
  ...DEPENDENT_SECTION_KEYS,
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

/**
 * Ruft die Provider-Methode zu einer Section auf (auch von Tests genutzt). `loaded` enthält die bereits
 * geladenen Sections – nur die abhängige Section `assignments` braucht sie.
 */
export function loadSection(
  provider: DeviceDataProvider,
  key: SnapshotSectionKey,
  device: ManagedDeviceInfo,
  signal: AbortSignal,
  loaded: Partial<DeviceSnapshot> = {},
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
    case 'duplicateDevices':
      return provider.getDuplicateDevices(device, { signal });
    case 'bitlockerKeys':
      return provider.getBitLockerKeys(device, { signal });
    case 'appInstallStates':
      return provider.getAppInstallStates(device, { signal });
    case 'applePushCertificate':
      return provider.getApplePushCertificate(device, { signal });
    case 'signIns':
      return provider.getSignIns(device, { signal });
    case 'localAdmin':
      return provider.getLocalAdmin(device, { signal });
    case 'autopilot':
      return provider.getAutopilot(device, { signal });
    case 'deviceGroups':
      return provider.getDeviceGroups(device, { signal });
    case 'userDevices':
      return provider.getUserDevices(device, { signal });
    case 'healthAttestation':
      return provider.getHealthAttestation(device, { signal });
    case 'userLicense':
      return provider.getUserLicense(device, { signal });
    case 'enrollmentLimits':
      return provider.getEnrollmentLimits(device, { signal });
    case 'assignments':
      return provider.getAssignments(device, assignmentLookups(loaded), { signal });
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
    /** Bisher geladene Sections (Eingabe der abhängigen Section) */
    loaded: DeviceSnapshot;
  } | null>(null);

  const fetchSection = useCallback(
    async (sectionKey: SnapshotSectionKey, ctx: NonNullable<typeof run.current>): Promise<void> => {
      const { controller, provider: p, device, key: stateKey } = ctx;
      let result: SectionResult<unknown>;
      try {
        result = await loadSection(p, sectionKey, device, controller.signal, ctx.loaded);
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
      ctx.loaded = { ...ctx.loaded, [sectionKey]: result };
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
      const ctx = {
        controller,
        provider,
        device,
        key: stateKey,
        loaded: { device } as DeviceSnapshot,
      };
      run.current = ctx;
      setState({
        key: stateKey,
        status: 'ready',
        snapshot: { device },
        error: null,
        now: new Date(),
      });
      await Promise.all(INDEPENDENT_SECTION_KEYS.map((k) => fetchSection(k, ctx)));
      // Zuweisungen brauchen Richtlinien, Apps und Gruppen – erst nach diesen
      await Promise.all(DEPENDENT_SECTION_KEYS.map((k) => fetchSection(k, ctx)));
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
      ctx.loaded = { ...ctx.loaded, [sectionKey]: undefined };
      void fetchSection(sectionKey, ctx).then(() => {
        // Neue Richtlinien-/App-Daten → Zuweisungen neu abgleichen (alte Anzeige bleibt bis dahin)
        if (ASSIGNMENT_INPUTS.has(sectionKey)) void fetchSection('assignments', ctx);
      });
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
