import { createContext, useContext } from 'react';
import type { DataMode } from '../domain/types';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';

export interface ProviderContextValue {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  /** null, solange für den Modus (noch) kein Provider existiert (Live vor M4) */
  provider: DeviceDataProvider | null;
  /** Live-Modus wählbar (Entra-App konfiguriert) */
  liveAvailable: boolean;
}

export const ProviderContext = createContext<ProviderContextValue | null>(null);

export function useProviderContext(): ProviderContextValue {
  const value = useContext(ProviderContext);
  if (!value) throw new Error('useProviderContext außerhalb von ProviderContextProvider');
  return value;
}
