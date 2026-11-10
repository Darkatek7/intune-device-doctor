/**
 * Delegierte Graph-Berechtigungen (nur *.Read*). Alle Intune-Scopes benötigen Admin-Consent.
 * Quelle: https://learn.microsoft.com/en-us/graph/permissions-reference
 */
export const GraphScope = {
  UserRead: 'User.Read',
  ManagedDevicesRead: 'DeviceManagementManagedDevices.Read.All',
  ConfigurationRead: 'DeviceManagementConfiguration.Read.All',
  ServiceConfigRead: 'DeviceManagementServiceConfig.Read.All',
  DeviceRead: 'Device.Read.All',
  BitlockerKeyReadBasic: 'BitlockerKey.ReadBasic.All',
  /** Anmeldeprotokoll (Kachel „Anmeldungen“) – Entra ID P1/P2 und passende Entra-Rolle nötig. */
  AuditLogRead: 'AuditLog.Read.All',
  /**
   * Windows LAPS – nur Metadaten (Zeitpunkte), niemals das Kennwort. Bewusst `…ReadBasic.All`
   * (least privileged laut Doku), nicht `DeviceLocalCredential.Read.All`.
   */
  DeviceLocalCredentialReadBasic: 'DeviceLocalCredential.ReadBasic.All',
  /** Lizenzdetails des primären Benutzers (Kachel „Registrierung (Benutzer)“, M14/S3) – optional. */
  LicenseAssignmentRead: 'LicenseAssignment.Read.All',
  /** Sicherheitswarnungen (Defender, Kachel „Sicherheitswarnungen“, M14/S4) – optional. */
  SecurityAlertRead: 'SecurityAlert.Read.All',
  /**
   * Microsoft-365-Dienststatus (Kachel „Dienststatus“, M18) – optional. Laut Doku zusätzlich eine
   * Admin-Rolle nötig (z. B. Service Support Administrator).
   */
  ServiceHealthRead: 'ServiceHealth.Read.All',
} as const;

export type GraphScope = (typeof GraphScope)[keyof typeof GraphScope];

/**
 * Optionale Scopes werden beim Login NICHT angefragt: Fehlt ihr Admin-Consent, würde sonst die
 * gesamte Anmeldung scheitern (AADSTS65001). Ist der Consent erteilt, enthält das Token sie trotzdem
 * (Entra stellt alle zugestimmten Berechtigungen der Ressource aus); ohne Consent liefert nur der
 * betroffene Endpunkt 403 → „Fehlende Berechtigung“.
 */
export const OPTIONAL_SCOPES: readonly GraphScope[] = [
  GraphScope.ServiceConfigRead,
  GraphScope.AuditLogRead,
  GraphScope.DeviceLocalCredentialReadBasic,
  GraphScope.LicenseAssignmentRead,
  GraphScope.SecurityAlertRead,
  GraphScope.ServiceHealthRead,
];

/** Scopes, die beim Login angefragt werden. */
export const LOGIN_SCOPES: GraphScope[] = Object.values(GraphScope).filter(
  (scope) => !OPTIONAL_SCOPES.includes(scope),
);
