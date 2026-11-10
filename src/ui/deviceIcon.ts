import { Laptop, Smartphone, Tablet, type LucideIcon } from 'lucide-react';
import type { DeviceSearchResult, ManagedDeviceInfo, OsFamily } from '../domain/types';
import { osFamilyFrom } from '../domain/format';

export type DeviceIconKind = 'laptop' | 'smartphone' | 'tablet';

export const DEVICE_ICON: Record<DeviceIconKind, LucideIcon> = {
  laptop: Laptop,
  smartphone: Smartphone,
  tablet: Tablet,
};

/** Geräte-Symbol nach Plattform: iPad → Tablet, iOS/Android → Smartphone, sonst Laptop. */
export function deviceIconKind(
  device: Pick<ManagedDeviceInfo, 'osFamily' | 'model'> | null,
): DeviceIconKind {
  if (!device) return 'laptop';
  if (device.osFamily === 'ios' && /^ipad/i.test(device.model ?? '')) return 'tablet';
  if (device.osFamily === 'ios' || device.osFamily === 'android') return 'smartphone';
  return 'laptop';
}

/** Symbol nur nach Betriebssystem-Familie (ohne Modell, z. B. für „Zuletzt geöffnet“). */
export function osIconKind(osFamily: OsFamily): DeviceIconKind {
  return osFamily === 'ios' || osFamily === 'android' ? 'smartphone' : 'laptop';
}

/** Geräte-Symbol für einen Suchtreffer (nur Betriebssystem und Modell bekannt). */
export function searchResultIconKind(
  result: Pick<DeviceSearchResult, 'operatingSystem' | 'model'>,
): DeviceIconKind {
  const family = osFamilyFrom(result.operatingSystem);
  if (family === 'ios' && /^ipad/i.test(result.model ?? '')) return 'tablet';
  if (family === 'ios' || family === 'android') return 'smartphone';
  return 'laptop';
}
