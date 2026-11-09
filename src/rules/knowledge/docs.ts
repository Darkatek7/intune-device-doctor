/**
 * Microsoft-Learn-Quellen für Befunde (gegengeprüft 2026-10-15). Nur hier gelistete URLs
 * werden als "Microsoft-Dokumentation" an Befunde gehängt.
 */
export const Docs = {
  deviceSync: 'https://learn.microsoft.com/intune/intune-service/remote-actions/device-sync',
  policyRefreshIntervals:
    'https://learn.microsoft.com/intune/intune-service/configuration/device-profile-troubleshoot#policy-refresh-intervals',
  complianceValidity:
    'https://learn.microsoft.com/intune/intune-service/protect/device-compliance-get-started#compliance-policy-settings',
  complianceMonitor:
    'https://learn.microsoft.com/intune/intune-service/protect/compliance-policy-monitor#device-compliance-status',
  complianceErrorState:
    'https://learn.microsoft.com/intune/intune-service/protect/compliance-policy-monitor#device-behavior-with-a-compliance-setting-in-error-state',
  complianceDefaultPolicy:
    'https://learn.microsoft.com/intune/intune-service/protect/compliance-policy-monitor#how-intune-evaluates-the-default-compliance-policy',
  complianceStateEnum:
    'https://learn.microsoft.com/graph/api/resources/intune-devices-compliancestate',
  actionsForNoncompliance:
    'https://learn.microsoft.com/intune/intune-service/protect/actions-for-noncompliance',
  policyConflicts:
    'https://learn.microsoft.com/intune/intune-service/configuration/device-profile-troubleshoot#compliance-and-device-configuration-policies-that-conflict',
  settingsCatalog:
    'https://learn.microsoft.com/intune/intune-service/configuration/settings-catalog',
  intuneCommonErrors:
    'https://learn.microsoft.com/troubleshoot/mem/intune/general/troubleshoot-company-resource-access-problems#company-resource-access-common-errors',
  encryptionMonitor:
    'https://learn.microsoft.com/intune/intune-service/protect/encryption-monitor#device-encryption-status',
  viewRecoveryKeys:
    'https://learn.microsoft.com/intune/intune-service/protect/encrypt-devices#view-recovery-keys-for-intune-managed-devices',
  bitlockerTroubleshoot:
    'https://learn.microsoft.com/troubleshoot/mem/intune/device-protection/troubleshoot-bitlocker-policies',
  fileVault: 'https://learn.microsoft.com/intune/intune-service/protect/encrypt-devices-filevault',
  defenderUpdates:
    'https://learn.microsoft.com/defender-endpoint/microsoft-defender-antivirus-updates',
  defenderNotUpdated:
    'https://learn.microsoft.com/defender-endpoint/troubleshoot-security-intelligence-not-updated',
  tamperProtection:
    'https://learn.microsoft.com/defender-endpoint/prevent-changes-to-security-settings-with-tamper-protection',
  realTimeProtection:
    'https://learn.microsoft.com/defender-endpoint/configure-real-time-protection-microsoft-defender-antivirus',
  defenderProductStatus:
    'https://learn.microsoft.com/graph/api/resources/intune-devices-windowsdefenderproductstatus?view=graph-rest-1.0',
  windowsProtectionState:
    'https://learn.microsoft.com/graph/api/resources/intune-devices-windowsprotectionstate?view=graph-rest-1.0',
  malwareState:
    'https://learn.microsoft.com/graph/api/resources/intune-devices-windowsdevicemalwarestate?view=graph-rest-1.0',
  managedDevice:
    'https://learn.microsoft.com/graph/api/resources/intune-devices-manageddevice?view=graph-rest-1.0',
  entraDisableDevice:
    'https://learn.microsoft.com/entra/identity/devices/manage-device-identities#enable-or-disable-a-microsoft-entra-device',
  entraStaleDevices:
    'https://learn.microsoft.com/entra/identity/devices/manage-stale-devices#detect-stale-devices',
  entraDeviceResource: 'https://learn.microsoft.com/graph/api/resources/device?view=graph-rest-1.0',
  coManagement: 'https://learn.microsoft.com/intune/configmgr/comanage/overview',
  windowsEnrollmentErrors:
    'https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/troubleshoot-windows-enrollment-errors',
  mdmCertificateLifetime:
    'https://learn.microsoft.com/troubleshoot/mem/intune/device-management/troubleshoot-device-actions#wipe-and-retire-actions',
  appleSupervisedMode:
    'https://learn.microsoft.com/intune/device-enrollment/apple/enable-supervised-mode',
  androidPatchLevel:
    'https://learn.microsoft.com/intune/device-security/security-configurations/android-fully-managed#fully-managed-basic-security-level-1',
  appleMdmPushCertificate:
    'https://learn.microsoft.com/intune/device-enrollment/apple/create-mdm-push-certificate#renew-apple-mdm-push-certificate',
  appInstallTroubleshoot:
    'https://learn.microsoft.com/troubleshoot/mem/intune/app-management/troubleshoot-app-install#get-app-troubleshooting-details',
  appIntentAndStatesBeta:
    'https://learn.microsoft.com/graph/api/intune-troubleshooting-mobileappintentandstate-list?view=graph-rest-beta',
  win32AppTroubleshoot:
    'https://learn.microsoft.com/intune/app-management/deployment/troubleshoot-win32',
  dsregcmdDeviceState:
    'https://learn.microsoft.com/entra/identity/devices/troubleshoot-device-dsregcmd#device-state',
  dsregcmdDeviceDetails:
    'https://learn.microsoft.com/entra/identity/devices/troubleshoot-device-dsregcmd#device-details',
  dsregcmdUserState:
    'https://learn.microsoft.com/entra/identity/devices/troubleshoot-device-dsregcmd#user-state',
  dsregcmdSsoState:
    'https://learn.microsoft.com/entra/identity/devices/troubleshoot-device-dsregcmd#sso-state',
  prtTroubleshoot:
    'https://learn.microsoft.com/entra/identity/devices/troubleshoot-primary-refresh-token',
  // Ereignisprotokolle (DiagLogs-ZIP): Event-IDs mit Microsoft-Learn-Beleg, abgerufen 2026-11-09
  mdmCollectLogs: 'https://learn.microsoft.com/windows/client-management/mdm-collect-logs',
  /** Abschnitt „Review the MDM logs“: Ereignis 75 (Succeeded) und 76 (Failed) im Admin-Protokoll */
  autoEnrollmentMdmLogs:
    'https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/troubleshoot-windows-auto-enrollment#review-the-mdm-logs',
  defenderOnboardingMdmEvents:
    'https://learn.microsoft.com/defender-endpoint/troubleshoot-onboarding#mobile-device-management-mdm-event-logs',
  hybridJoinPostJoinAuth:
    'https://learn.microsoft.com/entra/identity/devices/troubleshoot-hybrid-join-windows-current#troubleshoot-post-join-authentication-issues',
  windows10EndOfSupport: 'https://learn.microsoft.com/windows/release-health/release-information',
  windows11Releases:
    'https://learn.microsoft.com/windows/release-health/windows11-release-information',
  // M10: Anmeldungen / Conditional Access
  signInResource: 'https://learn.microsoft.com/graph/api/resources/signin?view=graph-rest-1.0',
  signInDeviceDetail:
    'https://learn.microsoft.com/graph/api/resources/devicedetail?view=graph-rest-1.0',
  signInList: 'https://learn.microsoft.com/graph/api/signin-list?view=graph-rest-1.0',
  conditionalAccessTroubleshoot:
    'https://learn.microsoft.com/entra/identity/conditional-access/troubleshoot-conditional-access#microsoft-entra-sign-in-events',
  entraErrorCodes:
    'https://learn.microsoft.com/en-us/entra/identity-platform/reference-error-codes',
  // M10: Windows LAPS
  lapsGet:
    'https://learn.microsoft.com/graph/api/devicelocalcredentialinfo-get?view=graph-rest-1.0',
  lapsResource:
    'https://learn.microsoft.com/graph/api/resources/devicelocalcredentialinfo?view=graph-rest-1.0',
  lapsIntuneOverview: 'https://learn.microsoft.com/intune/device-security/laps/overview',
  lapsIntuneDeploy: 'https://learn.microsoft.com/intune/device-security/laps/deploy-policy',
  lapsEntraEnable:
    'https://learn.microsoft.com/entra/identity/devices/howto-manage-local-admin-passwords',
  lapsPolicySettings:
    'https://learn.microsoft.com/windows-server/identity/laps/laps-management-policy-settings',
  lapsEventLog:
    'https://learn.microsoft.com/windows-server/identity/laps/laps-management-event-log',
  // M10: Windows Autopilot
  autopilotList:
    'https://learn.microsoft.com/graph/api/intune-enrollment-windowsautopilotdeviceidentity-list?view=graph-rest-1.0',
  /** Autopilot-Registrierung: Hardware-Hash, Geräteliste im Intune Admin Center (Geräte › Registrierung › Windows › Windows Autopilot › Geräte) */
  autopilotRegistration: 'https://learn.microsoft.com/autopilot/registration-overview',
  autopilotResource:
    'https://learn.microsoft.com/graph/api/resources/intune-enrollment-windowsautopilotdeviceidentity?view=graph-rest-1.0',
  // M10: Gruppen des Geräts
  deviceTransitiveMemberOf:
    'https://learn.microsoft.com/graph/api/device-list-transitivememberof?view=graph-rest-1.0',
  // M10: Integritätsnachweis
  healthAttestationResource:
    'https://learn.microsoft.com/graph/api/resources/intune-devices-devicehealthattestationstate?view=graph-rest-1.0',
  // M14/S1: doppelte Entra-Geräteobjekte (abgerufen 2026-11-09)
  entraDeviceListResource: 'https://learn.microsoft.com/graph/api/device-list?view=graph-rest-1.0',
  /** Dual State (hybrid joined + registriert): nichtdeterministische Auswertung, ab Windows 10 1803 automatische Bereinigung */
  entraDualStateFaq:
    'https://learn.microsoft.com/entra/identity/devices/faq#why-do-i-see-a-duplicate-microsoft-entra-registered-record-for-my-windows-10-11-microsoft-entra-hybrid-joined-device-in-the-microsoft-entra-devices-list',
  /** Ursachen doppelter Geräteeinträge (Unjoin/Rejoin, „Geschäfts- oder Schulkonto hinzufügen“, Neuinstallation) */
  entraDuplicateEntriesFaq:
    'https://learn.microsoft.com/entra/identity/devices/faq#why-do-i-see-duplicate-device-entries',
  /** Dual State vermeiden/bereinigen; Hinweis: Entfernen des registrierten Zustands kann Intune-Registrierung beenden */
  hybridJoinReviewThingsToKnow:
    'https://learn.microsoft.com/entra/identity/devices/hybrid-join-plan#review-things-you-should-know',
  // M14/S2: Zuweisungen (abgerufen 2026-11-09)
  configurationAssignmentsList:
    'https://learn.microsoft.com/graph/api/intune-deviceconfig-deviceconfigurationassignment-list?view=graph-rest-1.0',
  complianceAssignmentsList:
    'https://learn.microsoft.com/graph/api/intune-deviceconfig-devicecompliancepolicyassignment-list?view=graph-rest-1.0',
  mobileAppAssignmentsList:
    'https://learn.microsoft.com/graph/api/intune-apps-mobileappassignment-list?view=graph-rest-1.0',
  /** Ein-/Ausschluss von Gruppen: Vorrang, dynamische Gerätegruppen (Latenz), Benutzer-/Gerätegruppen werden nicht verknüpft */
  assignPolicyExcludeGroups:
    'https://learn.microsoft.com/intune/device-configuration/assign-device-profile#exclude-groups-from-a-policy-assignment',
  /** Ein-/Ausschluss bei Apps: Ausschluss hat Vorrang bei gleicher Gruppenart; gemischte Gruppen werden nicht ausgewertet */
  appAssignmentScope:
    'https://learn.microsoft.com/intune/app-management/deployment/configure-assignment-scope',
  graphPermissions: 'https://learn.microsoft.com/graph/permissions-reference',
  graphThrottling: 'https://learn.microsoft.com/graph/throttling',
  graphErrors: 'https://learn.microsoft.com/graph/errors',
  certutilStore:
    'https://learn.microsoft.com/windows-server/administration/windows-commands/certutil#-store',
  ipconfig: 'https://learn.microsoft.com/windows-server/administration/windows-commands/ipconfig',
  entraDeviceRegistrationCert:
    'https://learn.microsoft.com/troubleshoot/mem/intune/comanage-configmgr/troubleshoot-co-management-auto-enrolling#common-issues',
} as const;
