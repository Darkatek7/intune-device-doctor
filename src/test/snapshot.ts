import type { DeviceSnapshot } from '../domain/types';
import { SECTION_KEYS, loadSection } from '../hooks/useDeviceSnapshot';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';

/**
 * Lädt ein Gerät vollständig (alle Sections aus SECTION_KEYS) – so wie die App es progressiv lädt.
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
    SECTION_KEYS.map(
      async (key) => [key, await loadSection(provider, key, device, signal)] as const,
    ),
  );
  return { device, ...Object.fromEntries(entries) };
}
