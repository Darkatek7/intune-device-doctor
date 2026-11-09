/**
 * "Zuletzt geöffnet": die letzten Geräte pro Modus (demo/live getrennt) in localStorage.
 * Gespeichert werden ausschließlich id, Name, Plattform und Zeitpunkt – keine UPNs,
 * Seriennummern oder sonstigen Felder. Jeder Speicherzugriff ist abgesichert (Privatmodus,
 * gesperrter oder beschädigter Speicher → leere Liste, keine Fehler).
 */
import { useCallback, useRef, useState } from 'react';
import type { DataMode, OsFamily } from '../domain/types';

export interface RecentDevice {
  id: string;
  deviceName: string;
  osFamily: OsFamily;
  /** ISO-Zeitstempel des letzten Öffnens */
  openedAt: string;
}

export const MAX_RECENT_DEVICES = 8;

export const recentStorageKey = (mode: DataMode) => `mdm-doctor.recent.${mode}`;

const OS_FAMILIES: readonly OsFamily[] = ['windows', 'macos', 'ios', 'android', 'linux', 'other'];

function isRecent(value: unknown): value is RecentDevice {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' &&
    v['id'] !== '' &&
    typeof v['deviceName'] === 'string' &&
    typeof v['openedAt'] === 'string' &&
    OS_FAMILIES.includes(v['osFamily'] as OsFamily)
  );
}

export function readRecentDevices(mode: DataMode): RecentDevice[] {
  try {
    const raw = window.localStorage.getItem(recentStorageKey(mode));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Nur die bekannten Felder übernehmen, falls der Speicher manipuliert wurde.
    return parsed
      .filter(isRecent)
      .slice(0, MAX_RECENT_DEVICES)
      .map(({ id, deviceName, osFamily, openedAt }) => ({ id, deviceName, osFamily, openedAt }));
  } catch {
    return [];
  }
}

function writeRecentDevices(mode: DataMode, list: RecentDevice[]): void {
  try {
    if (list.length === 0) window.localStorage.removeItem(recentStorageKey(mode));
    else window.localStorage.setItem(recentStorageKey(mode), JSON.stringify(list));
  } catch {
    // Speichern nicht möglich: Die Liste lebt dann nur im Arbeitsspeicher dieser Sitzung.
  }
}

export interface RecentDevices {
  recent: RecentDevice[];
  /** Merkt das Gerät als zuletzt geöffnet (nach oben; Duplikate nach id entfernt; max. 8). */
  remember: (device: Pick<RecentDevice, 'id' | 'deviceName' | 'osFamily'>, now?: Date) => void;
  clear: () => void;
}

export function useRecentDevices(mode: DataMode): RecentDevices {
  const [recent, setRecent] = useState<RecentDevice[]>(() => readRecentDevices(mode));
  // Aktueller Stand auch dann, wenn der Speicher nicht beschreibbar ist (nur Arbeitsspeicher).
  const latest = useRef(recent);

  const remember = useCallback<RecentDevices['remember']>(
    (device, now = new Date()) => {
      const entry: RecentDevice = {
        id: device.id,
        deviceName: device.deviceName,
        osFamily: device.osFamily,
        openedAt: now.toISOString(),
      };
      const next = [entry, ...latest.current.filter((d) => d.id !== entry.id)].slice(
        0,
        MAX_RECENT_DEVICES,
      );
      latest.current = next;
      writeRecentDevices(mode, next);
      setRecent(next);
    },
    [mode],
  );

  const clear = useCallback(() => {
    latest.current = [];
    writeRecentDevices(mode, []);
    setRecent([]);
  }, [mode]);

  return { recent, remember, clear };
}
