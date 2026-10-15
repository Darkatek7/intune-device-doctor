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
  windows10EndOfSupport: 'https://learn.microsoft.com/windows/release-health/release-information',
  windows11Releases:
    'https://learn.microsoft.com/windows/release-health/windows11-release-information',
  graphPermissions: 'https://learn.microsoft.com/graph/permissions-reference',
  graphThrottling: 'https://learn.microsoft.com/graph/throttling',
  graphErrors: 'https://learn.microsoft.com/graph/errors',
} as const;
