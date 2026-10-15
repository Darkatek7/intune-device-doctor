/**
 * Fabrik für den Datenprovider je Modus: Demo → MockProvider, Live → GraphProvider (nur wenn
 * eine Entra-App in .env.local konfiguriert ist; sonst null und die UI zeigt einen Hinweis).
 */
import { getGraphToken } from '../auth/token';
import { isLiveConfigured } from '../config';
import type { DataMode } from '../domain/types';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { createGraphProvider } from '../providers/graph/GraphProvider';
import { MockProvider } from '../providers/mock/MockProvider';

export function createProvider(mode: DataMode): DeviceDataProvider | null {
  if (mode === 'demo') return new MockProvider();
  if (!isLiveConfigured) return null;
  return createGraphProvider(() => getGraphToken());
}
