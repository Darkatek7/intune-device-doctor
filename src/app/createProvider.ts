/**
 * Fabrik für den Datenprovider je Modus: Demo → MockProvider, Live → LazyGraphProvider (lädt
 * GraphProvider + MSAL erst bei Bedarf), nur wenn eine Entra-App in .env.local konfiguriert ist;
 * sonst null und die UI zeigt einen Hinweis.
 */
import { isLiveConfigured } from '../config';
import type { DataMode } from '../domain/types';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { MockProvider } from '../providers/mock/MockProvider';
import { LazyGraphProvider } from './lazyGraphProvider';

export function createProvider(mode: DataMode): DeviceDataProvider | null {
  if (mode === 'demo') return new MockProvider();
  if (!isLiveConfigured) return null;
  return new LazyGraphProvider();
}
