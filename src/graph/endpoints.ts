/**
 * Einzige Quelle für Graph-URLs. Jede Definition trägt Scope + Doku-Link, damit UI-Befunde
 * ("Quelle") und Fehlermeldungen ("fehlende Berechtigung X") daraus abgeleitet werden können.
 *
 * READ-ONLY: Es gibt ausschließlich GET. Neue Endpunkte nur, wenn sie in
 * docs/graph-api-reference.md mit offiziellem Doku-Link stehen.
 */
import {
  APPLE_PUSH_CERTIFICATE_SELECT,
  ENTRA_DEVICE_SELECT,
  MANAGED_DEVICE_LIST_SELECT,
  MOBILE_APP_SELECT,
} from './dto';
import { GraphScope } from './scopes';

export const GRAPH_ORIGIN = 'https://graph.microsoft.com';
export const GRAPH_BASE_URL = `${GRAPH_ORIGIN}/v1.0`;
/** Nur für ausdrücklich freigegebene, dokumentierte Beta-Endpunkte (CLAUDE.md, Regel 2). */
export const GRAPH_BETA_URL = `${GRAPH_ORIGIN}/beta`;

export interface GraphEndpointDef<TArgs extends unknown[]> {
  id: string;
  method: 'GET';
  version: 'v1.0' | 'beta';
  scope: GraphScope;
  docsUrl: string;
  /** Relativer v1.0-Pfad bzw. absolute Beta-URL inkl. Query, bereits korrekt encodiert. */
  path: (...args: TArgs) => string;
  /** Lesbare Form für die UI ("GET /deviceManagement/managedDevices/{id}"). */
  display: string;
}

/** OData-Stringliteral escapen (einfaches Hochkomma verdoppeln). */
export function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function withQuery(path: string, params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return query ? `${path}?${query}` : path;
}

const enc = encodeURIComponent;

export const Endpoints = {
  /** Exakte Suche. $filter deviceName eq ist in der Beta-Ressource dokumentiert; live verifizieren. */
  managedDevicesByName: {
    id: 'managedDevicesByName',
    method: 'GET',
    version: 'v1.0',
    scope: GraphScope.ManagedDevicesRead,
    docsUrl:
      'https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-list?view=graph-rest-1.0',
    display: "GET /deviceManagement/managedDevices?$filter=deviceName eq '…'",
    path: (deviceName: string) =>
      withQuery('/deviceManagement/managedDevices', {
        $filter: `deviceName eq ${odataString(deviceName)}`,
        $select: MANAGED_DEVICE_LIST_SELECT.join(','),
      }),
  },
  /** Teilstring-Suche (contains laut Beta-Ressource). Fallback, falls eq nichts findet. */
  managedDevicesByNameContains: {
    id: 'managedDevicesByNameContains',
    method: 'GET',
    version: 'v1.0',
    scope: GraphScope.ManagedDevicesRead,
    docsUrl:
      'https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-manageddevice?view=graph-rest-beta',
    display: "GET /deviceManagement/managedDevices?$filter=contains(deviceName,'…')",
    path: (fragment: string) =>
      withQuery('/deviceManagement/managedDevices', {
        $filter: `contains(deviceName,${odataString(fragment)})`,
        $select: MANAGED_DEVICE_LIST_SELECT.join(','),
        $top: '25',
      }),
  },
  /** Geräte eines Benutzers: userPrincipalName unterstützt laut v1.0-Ressource $filter 'eq'/'ne'. */
  managedDevicesByUser: {
    id: 'managedDevicesByUser',
    method: 'GET',
    version: 'v1.0',
    scope: GraphScope.ManagedDevicesRead,
    docsUrl:
      'https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-manageddevice?view=graph-rest-1.0#properties',
    display: "GET /deviceManagement/managedDevices?$filter=userPrincipalName eq '…'",
    path: (userPrincipalName: string) =>
      withQuery('/deviceManagement/managedDevices', {
        $filter: `userPrincipalName eq ${odataString(userPrincipalName)}`,
        $select: MANAGED_DEVICE_LIST_SELECT.join(','),
      }),
  },
  /**
   * Dokumentierter list-Endpunkt ohne $filter. Nur Fallback für die clientseitige Suche, falls der
   * (laut v1.0-Doku nicht belegte) $filter auf deviceName mit HTTP 400 abgelehnt wird.
   */
  managedDevicesList: {
    id: 'managedDevicesList',
    method: 'GET',
    version: 'v1.0',
    scope: GraphScope.ManagedDevicesRead,
    docsUrl:
      'https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-list?view=graph-rest-1.0',
    display: 'GET /deviceManagement/managedDevices?$select=…',
    path: () =>
      withQuery('/deviceManagement/managedDevices', {
        $select: MANAGED_DEVICE_LIST_SELECT.join(','),
      }),
  },
  managedDevice: {
    id: 'managedDevice',
    method: 'GET',
    version: 'v1.0',
    scope: GraphScope.ManagedDevicesRead,
    docsUrl:
      'https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-get?view=graph-rest-1.0',
    display: 'GET /deviceManagement/managedDevices/{id}',
    path: (id: string) => `/deviceManagement/managedDevices/${enc(id)}`,
  },
  windowsProtectionState: {
    id: 'windowsProtectionState',
    method: 'GET',
    version: 'v1.0',
    scope: GraphScope.ManagedDevicesRead,
    docsUrl:
      'https://learn.microsoft.com/en-us/graph/api/intune-devices-windowsprotectionstate-get?view=graph-rest-1.0',
    display: 'GET /deviceManagement/managedDevices/{id}/windowsProtectionState',
    path: (id: string) => `/deviceManagement/managedDevices/${enc(id)}/windowsProtectionState`,
  },
  detectedMalwareState: {
    id: 'detectedMalwareState',
    method: 'GET',
    version: 'v1.0',
    scope: GraphScope.ManagedDevicesRead,
    docsUrl:
      'https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-windowsdevicemalwarestate?view=graph-rest-1.0',
    display:
      'GET /deviceManagement/managedDevices/{id}/windowsProtectionState/detectedMalwareState',
    path: (id: string) =>
      `/deviceManagement/managedDevices/${enc(id)}/windowsProtectionState/detectedMalwareState`,
  },
  deviceCompliancePolicyStates: {
    id: 'deviceCompliancePolicyStates',
    method: 'GET',
    version: 'v1.0',
    scope: GraphScope.ManagedDevicesRead,
    docsUrl:
      'https://learn.microsoft.com/en-us/powershell/module/microsoft.graph.devicemanagement/get-mgdevicemanagementmanageddevicecompliancepolicystate?view=graph-powershell-1.0',
    display: 'GET /deviceManagement/managedDevices/{id}/deviceCompliancePolicyStates',
    path: (id: string) =>
      `/deviceManagement/managedDevices/${enc(id)}/deviceCompliancePolicyStates`,
  },
  deviceConfigurationStates: {
    id: 'deviceConfigurationStates',
    method: 'GET',
    version: 'v1.0',
    scope: GraphScope.ConfigurationRead,
    docsUrl:
      'https://learn.microsoft.com/en-us/powershell/module/microsoft.graph.devicemanagement/get-mgdevicemanagementmanageddeviceconfigurationstate?view=graph-powershell-1.0',
    display: 'GET /deviceManagement/managedDevices/{id}/deviceConfigurationStates',
    path: (id: string) => `/deviceManagement/managedDevices/${enc(id)}/deviceConfigurationStates`,
  },
  entraDeviceByDeviceId: {
    id: 'entraDeviceByDeviceId',
    method: 'GET',
    version: 'v1.0',
    scope: GraphScope.DeviceRead,
    docsUrl: 'https://learn.microsoft.com/en-us/graph/api/device-list?view=graph-rest-1.0',
    display: "GET /devices?$filter=deviceId eq '{azureADDeviceId}'",
    path: (azureADDeviceId: string) =>
      withQuery('/devices', {
        $filter: `deviceId eq ${odataString(azureADDeviceId)}`,
        $select: ENTRA_DEVICE_SELECT.join(','),
      }),
  },
  /** App-Name zu einer Win32-App-ID (z. B. aus einem DiagLogs-ZIP). */
  mobileApp: {
    id: 'mobileApp',
    method: 'GET',
    version: 'v1.0',
    // Least privileged laut Doku: DeviceManagementConfiguration.Read.All (wird ohnehin angefragt).
    scope: GraphScope.ConfigurationRead,
    docsUrl:
      'https://learn.microsoft.com/en-us/graph/api/intune-apps-mobileapp-get?view=graph-rest-1.0',
    display: 'GET /deviceAppManagement/mobileApps/{id}',
    path: (appId: string) =>
      withQuery(`/deviceAppManagement/mobileApps/${enc(appId)}`, {
        $select: MOBILE_APP_SELECT.join(','),
      }),
  },
  bitlockerRecoveryKeys: {
    id: 'bitlockerRecoveryKeys',
    method: 'GET',
    version: 'v1.0',
    scope: GraphScope.BitlockerKeyReadBasic,
    docsUrl:
      'https://learn.microsoft.com/en-us/graph/api/bitlocker-list-recoverykeys?view=graph-rest-1.0',
    display: "GET /informationProtection/bitlocker/recoveryKeys?$filter=deviceId eq '…'",
    // Kein $select=key – Schlüsselwerte werden nie gelesen.
    path: (azureADDeviceId: string) =>
      withQuery('/informationProtection/bitlocker/recoveryKeys', {
        $filter: `deviceId eq ${odataString(azureADDeviceId)}`,
      }),
  },
  /**
   * Tenant-weites Apple-MDM-Push-Zertifikat (nur Ablauf/Änderung). Bewusst KEIN appleIdentifier
   * (Apple-ID ist personenbezogen) und kein certificate. Erfordert Admin-Consent für
   * DeviceManagementServiceConfig.Read.All.
   */
  applePushNotificationCertificate: {
    id: 'applePushNotificationCertificate',
    method: 'GET',
    version: 'v1.0',
    scope: GraphScope.ServiceConfigRead,
    docsUrl:
      'https://learn.microsoft.com/en-us/graph/api/intune-devices-applepushnotificationcertificate-get?view=graph-rest-1.0',
    display: 'GET /deviceManagement/applePushNotificationCertificate',
    path: () =>
      withQuery('/deviceManagement/applePushNotificationCertificate', {
        $select: APPLE_PUSH_CERTIFICATE_SELECT.join(','),
      }),
  },
  /**
   * BETA (freigegebene Ausnahme, CLAUDE.md Regel 2): App-Absicht und Installationsstatus aller
   * Geräte eines Benutzers. Es gibt keinen v1.0-GET für den App-Status pro Gerät.
   */
  mobileAppIntentAndStates: {
    id: 'mobileAppIntentAndStates',
    method: 'GET',
    version: 'beta',
    scope: GraphScope.ManagedDevicesRead,
    docsUrl:
      'https://learn.microsoft.com/en-us/graph/api/intune-troubleshooting-mobileappintentandstate-list?view=graph-rest-beta',
    display: 'GET /beta/users/{userId}/mobileAppIntentAndStates',
    path: (userId: string) => `${GRAPH_BETA_URL}/users/${enc(userId)}/mobileAppIntentAndStates`,
  },
} satisfies Record<string, GraphEndpointDef<[string]>>;

export type EndpointId = keyof typeof Endpoints;
