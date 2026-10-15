/**
 * Delegierte Graph-Berechtigungen (nur *.Read*). Alle Intune-Scopes benötigen Admin-Consent.
 * Quelle: https://learn.microsoft.com/en-us/graph/permissions-reference
 */
export const GraphScope = {
  UserRead: 'User.Read',
  ManagedDevicesRead: 'DeviceManagementManagedDevices.Read.All',
  ConfigurationRead: 'DeviceManagementConfiguration.Read.All',
  DeviceRead: 'Device.Read.All',
  BitlockerKeyReadBasic: 'BitlockerKey.ReadBasic.All',
} as const;

export type GraphScope = (typeof GraphScope)[keyof typeof GraphScope];

/** Scopes, die beim Login angefragt werden. */
export const LOGIN_SCOPES: GraphScope[] = Object.values(GraphScope);
