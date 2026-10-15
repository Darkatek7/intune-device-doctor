/**
 * Sucht über den aktuellen Provider (Demo oder Live) ein Gerät, dessen Name exakt (ohne Beachtung
 * der Groß-/Kleinschreibung) dem Gerätenamen aus der DiagLogs-ZIP entspricht. Fehler und
 * Mehrdeutigkeit (mehrere Geräte gleichen Namens) ergeben kein Angebot.
 */
import { useEffect, useState } from 'react';
import type { DeviceSearchResult } from '../domain/types';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';

interface Lookup {
  provider: DeviceDataProvider;
  name: string;
  match: DeviceSearchResult | null;
}

export function useZipDeviceMatch(
  provider: DeviceDataProvider | null,
  deviceName: string | null,
): DeviceSearchResult | null {
  const [lookup, setLookup] = useState<Lookup | null>(null);

  useEffect(() => {
    if (!provider || !deviceName) return;
    const controller = new AbortController();
    const wanted = deviceName.toLowerCase();
    provider
      .searchDevices(deviceName, { signal: controller.signal })
      .then((results) => {
        if (controller.signal.aborted) return;
        const exact = results.filter((r) => r.deviceName.toLowerCase() === wanted);
        setLookup({ provider, name: deviceName, match: exact.length === 1 ? exact[0]! : null });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLookup({ provider, name: deviceName, match: null });
      });
    return () => controller.abort();
  }, [provider, deviceName]);

  return lookup && lookup.provider === provider && lookup.name === deviceName ? lookup.match : null;
}
