/**
 * Fabrik für den Datenprovider je Modus. Der Live-Provider (GraphProvider) kommt in M4;
 * bis dahin liefert 'live' null und die UI zeigt einen Hinweis-Zustand.
 */
import type { DataMode } from '../domain/types';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { MockProvider } from '../providers/mock/MockProvider';

export function createProvider(mode: DataMode): DeviceDataProvider | null {
  if (mode === 'demo') return new MockProvider();
  return null;
}
