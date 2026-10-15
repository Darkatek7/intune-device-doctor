/**
 * Stellt je Modus den passenden DeviceDataProvider bereit. Komponenten greifen nur über
 * useProviderContext() darauf zu – nie direkt auf Graph.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { appConfig, isLiveConfigured } from '../config';
import type { DataMode } from '../domain/types';
import { parseUrl } from '../hooks/useUrlState';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { createProvider } from './createProvider';
import { ProviderContext, type ProviderContextValue } from './providerContextValue';

interface Props {
  children: ReactNode;
  /** Für Tests: fester Provider (z. B. MockProvider ohne Latenz) für seinen Modus */
  provider?: DeviceDataProvider;
  /** Für Tests/Overrides; Standard: isLiveConfigured */
  liveAvailable?: boolean;
  initialMode?: DataMode;
}

function resolveInitialMode(liveAvailable: boolean, override?: DataMode): DataMode {
  const wanted = override ?? parseUrl(window.location.search).mode ?? appConfig.defaultMode;
  return wanted === 'live' && !liveAvailable ? 'demo' : wanted;
}

export function ProviderContextProvider({
  children,
  provider: injected,
  liveAvailable = isLiveConfigured,
  initialMode,
}: Props) {
  const [mode, setModeState] = useState<DataMode>(() =>
    resolveInitialMode(liveAvailable, initialMode ?? injected?.mode),
  );

  const setMode = useCallback(
    (next: DataMode) => {
      if (next === 'live' && !liveAvailable) return;
      setModeState(next);
    },
    [liveAvailable],
  );

  const provider = useMemo(
    () => (injected && injected.mode === mode ? injected : createProvider(mode)),
    [injected, mode],
  );

  const value = useMemo<ProviderContextValue>(
    () => ({ mode, setMode, provider, liveAvailable }),
    [mode, setMode, provider, liveAvailable],
  );

  return <ProviderContext.Provider value={value}>{children}</ProviderContext.Provider>;
}
