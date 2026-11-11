import { formatDate } from '../domain/format';
import type { ManagedDeviceInfo, Tile } from '../domain/types';
import { de } from '../i18n/de';
import type { Masker } from '../privacy/masker';

/**
 * Metazeile eines Geräts (Modell · Nutzer · OS [· Enrollment]). Die OS-Angabe stammt, sobald
 * verfügbar, aus der Betriebssystem-Kachel ("Windows 11 23H2" statt "Windows 10.0.22631.4317").
 */
export function deviceMeta(
  device: ManagedDeviceInfo,
  tiles: readonly Tile[] = [],
  options: {
    enrolled?: boolean;
    /** Präsentationsmodus: Benutzer als Pseudonym */ masker?: Masker;
  } = {},
): string[] {
  const osTile = tiles.find((tile) => tile.id === 'osVersion' && tile.state === 'ready');
  const os =
    (osTile?.value && osTile.value !== '–' ? osTile.value : null) ??
    ([device.operatingSystem, device.osVersion].filter(Boolean).join(' ') || null);
  const { masker } = options;
  const user = masker
    ? device.userDisplayName
      ? masker.user(device.userDisplayName)
      : device.userPrincipalName
        ? masker.upn(device.userPrincipalName)
        : null
    : (device.userDisplayName ?? device.userPrincipalName);
  return [
    device.model,
    user,
    os,
    options.enrolled !== false && device.enrolledDateTime
      ? de.header.enrolled(formatDate(device.enrolledDateTime))
      : null,
  ].filter((part): part is string => Boolean(part));
}
