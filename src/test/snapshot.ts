import type { DeviceSnapshot } from '../domain/types';
import {
  DEPENDENT_SECTION_KEYS,
  INDEPENDENT_SECTION_KEYS,
  loadSection,
} from '../hooks/useDeviceSnapshot';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';

/**
 * Lädt ein Gerät vollständig (alle Sections; abhängige Sections erst danach) – so wie die App es progressiv lädt.
 * Neue Sections sind damit automatisch in den Tests enthalten.
 */
export async function loadFullSnapshot(
  provider: DeviceDataProvider,
  deviceName: string,
): Promise<DeviceSnapshot> {
  const [hit] = await provider.searchDevices(deviceName);
  if (!hit || hit.deviceName !== deviceName) throw new Error(`Szenario ${deviceName} fehlt`);
  const device = await provider.getDevice(hit.id);
  const signal = new AbortController().signal;
  const entries = await Promise.all(
    INDEPENDENT_SECTION_KEYS.map(
      async (key) => [key, await loadSection(provider, key, device, signal)] as const,
    ),
  );
  const independent: DeviceSnapshot = { device, ...Object.fromEntries(entries) };
  const dependent = await Promise.all(
    DEPENDENT_SECTION_KEYS.map(
      async (key) => [key, await loadSection(provider, key, device, signal, independent)] as const,
    ),
  );
  return { ...independent, ...Object.fromEntries(dependent) };
}
