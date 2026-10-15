/**
 * Links ins Microsoft Intune Admin Center – zentral an einer Stelle, damit sie sich bei Portal-
 * Änderungen an genau einem Ort anpassen lassen.
 *
 * - Übersichtsseiten (`allDevices`, `configurationPolicies`) verwendet Microsoft Learn selbst.
 * - Direktlinks auf ein einzelnes Objekt (`app`, `device`) sind NICHT offiziell dokumentiert; es sind
 *   die Adressen, die das Portal selbst verwendet. Bei Live-Einsatz prüfen (docs/graph-api-reference.md).
 */
const PORTAL = 'https://intune.microsoft.com';
const enc = encodeURIComponent;

export const IntunePortal = {
  allDevices: `${PORTAL}/#view/Microsoft_Intune_Devices/DevicesMenu/~/allDevices`,
  configurationPolicies: `${PORTAL}/#view/Microsoft_Intune_DeviceSettings/DevicesMenu/~/configuration`,
  /** Eigenschaften einer Intune-App (Direktlink, undokumentiert) */
  app: (appId: string): string =>
    `${PORTAL}/#view/Microsoft_Intune_Apps/SettingsMenu/~/0/appId/${enc(appId)}`,
  /** Übersicht eines verwalteten Geräts inkl. Compliance und Konfiguration (Direktlink, undokumentiert) */
  device: (managedDeviceId: string): string =>
    `${PORTAL}/#view/Microsoft_Intune_Devices/DeviceSettingsMenuBlade/~/overview/mdmDeviceId/${enc(managedDeviceId)}`,
} as const;
