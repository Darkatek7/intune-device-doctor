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
  // M14/S3: Registrierung – Lizenz und Gerätelimit (abgerufen 2026-11-09)
  licenseDetailsList:
    'https://learn.microsoft.com/graph/api/user-list-licensedetails?view=graph-rest-1.0',
  servicePlanInfo:
    'https://learn.microsoft.com/graph/api/resources/serviceplaninfo?view=graph-rest-1.0',
  licensingServicePlanReference:
    'https://learn.microsoft.com/entra/identity/users/licensing-service-plan-reference',
  /** Ursache/Lösung „IT admin needs to assign license for access“ */
  enrollmentLicenseMissing:
    'https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/troubleshoot-device-enrollment-in-intune#it-admin-needs-to-assign-license-for-access',
  /** Ursache/Lösung „Device cap reached“ (DeviceCapReached) */
  enrollmentDeviceCapReached:
    'https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/troubleshoot-device-enrollment-in-intune#device-cap-reached',
  intuneLicensesAssign: 'https://learn.microsoft.com/mem/intune/fundamentals/licenses-assign',
  /** Intune- und Entra-Gerätelimit: für welche Registrierungsarten das Intune-Limit nicht gilt */
  deviceLimitsIntuneEntra:
    'https://learn.microsoft.com/intune/device-enrollment/limits-intune-entra',
  enrollmentLimitResource:
    'https://learn.microsoft.com/graph/api/resources/intune-onboarding-deviceenrollmentlimitconfiguration?view=graph-rest-1.0',
  enrollmentConfigurationsList:
    'https://learn.microsoft.com/graph/api/intune-onboarding-deviceenrollmentconfiguration-list?view=graph-rest-1.0',
  // M14/S5: Mandanten-Status (abgerufen 2026-11-09)
  vppTokenList:
    'https://learn.microsoft.com/graph/api/intune-onboarding-vpptoken-list?view=graph-rest-1.0',
  vppTokenResource:
    'https://learn.microsoft.com/graph/api/resources/intune-onboarding-vpptoken?view=graph-rest-1.0',
  /** VPP-Token erneuern/synchronisieren; Status „invalid“ bei Kontoänderung oder Ablauf */
  vppTokenRenew:
    'https://learn.microsoft.com/intune/app-management/deployment/manage-vpp-apple#renewing-vpp-tokens-or-apple-business-manager-location-token',
  vppTokenSync:
    'https://learn.microsoft.com/intune/app-management/deployment/manage-vpp-apple#synchronize-a-vpp-token',
  /** Beta-Ressourcen, über die dokumentierte v1.0-API nicht erreichbar */
  depOnboardingSettingBeta:
    'https://learn.microsoft.com/graph/api/resources/intune-enrollment-deponboardingsetting?view=graph-rest-beta',
  androidManagedStoreSettingsBeta:
    'https://learn.microsoft.com/graph/api/resources/intune-androidforwork-androidmanagedstoreaccountenterprisesettings?view=graph-rest-beta',
  windowsAutopilotSettingsBeta:
    'https://learn.microsoft.com/graph/api/resources/intune-enrollment-windowsautopilotsettings?view=graph-rest-beta',
  ndesConnectorBeta:
    'https://learn.microsoft.com/graph/api/resources/intune-deviceconfig-ndesconnector?view=graph-rest-beta',
  /** Apple-ADE-Token erneuern (Registrierungsprogramm-Token) */
  appleAdeTokens:
    'https://learn.microsoft.com/intune/device-enrollment/apple/manage-devices-tokens-apple#renew-your-token',
  // M14/S4: Sicherheitswarnungen (abgerufen 2026-11-09)
  securityAlertsList:
    'https://learn.microsoft.com/graph/api/security-list-alerts_v2?view=graph-rest-1.0',
  securityAlertResource:
    'https://learn.microsoft.com/graph/api/resources/security-alert?view=graph-rest-1.0',
  securityDeviceEvidence:
    'https://learn.microsoft.com/graph/api/resources/security-deviceevidence?view=graph-rest-1.0',
  /** Defender-Warteschlange: Schweregrade, Status, Dienstquellen */
  defenderAlertsQueue: 'https://learn.microsoft.com/defender-endpoint/alerts-queue',
  defenderInvestigateAlerts: 'https://learn.microsoft.com/defender-endpoint/investigate-alerts',
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
  // M13: MDM-Diagnosepaket (mdmlogs-*.cab), abgerufen 2026-11-09
  diagnoseProvisioningPackages:
    'https://learn.microsoft.com/windows/configuration/provisioning-packages/diagnose-provisioning-packages',
  /** Cabinet-Spezifikation (CFHEADER/CFFOLDER/CFFILE/CFDATA, Prüfsumme) und MSZIP-Format */
  cabinetFormat: 'https://learn.microsoft.com/previous-versions/bb417343(v=msdn.10)',
  expandCommand:
    'https://learn.microsoft.com/windows-server/administration/windows-commands/expand',
  // M18: Dienststatus (abgerufen 2026-11-10)
  serviceHealthOverviewsList:
    'https://learn.microsoft.com/graph/api/serviceannouncement-list-healthoverviews?view=graph-rest-1.0',
  serviceHealthIssueResource:
    'https://learn.microsoft.com/graph/api/resources/servicehealthissue?view=graph-rest-1.0',
  /** „check its health status … before calling for support or spending time troubleshooting“ */
  serviceCommunicationsOverview:
    'https://learn.microsoft.com/graph/service-communications-concept-overview',
  /** Dienstintegrität im Microsoft 365 Admin Center; Rollen Service Support admin, Helpdesk admin */
  m365ServiceHealth:
    'https://learn.microsoft.com/microsoft-365/enterprise/view-service-health?view=o365-worldwide',
  /** Intune-Mandantenstatus › Dienstintegrität; Rolle Service support administrator, E-Mail-Benachrichtigungen */
  intuneTenantStatusServiceHealth:
    'https://learn.microsoft.com/intune/governance/tenant-status#service-health-and-message-center-tab',
  // M18: Registrierungsfehler (abgerufen 2026-11-10)
  troubleshootingEventsList:
    'https://learn.microsoft.com/graph/api/intune-troubleshooting-enrollmenttroubleshootingevent-list?view=graph-rest-1.0',
  enrollmentFailureReasonEnum:
    'https://learn.microsoft.com/graph/api/resources/intune-troubleshooting-deviceenrollmentfailurereason?view=graph-rest-1.0',
  /** Bericht „Registrierungsfehler“: Zeile öffnen → Details und empfohlene Schritte */
  enrollmentFailuresReport: 'https://learn.microsoft.com/intune/device-enrollment/monitor-reports',
  enrollmentSelfHelpDiagnostics:
    'https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/troubleshoot-device-enrollment-in-intune#run-self-help-diagnostics',
  enrollmentDeviceDateTime:
    'https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/troubleshoot-device-enrollment-in-intune#check-device-date-and-time',
  enrollmentMdmAuthorityNotSet:
    'https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/troubleshoot-device-enrollment-in-intune#it-admin-needs-to-set-mdm-authority',
  /** Fehlercode-Tabelle: „Account is in maintenance mode“ */
  enrollmentErrorCodes:
    'https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/troubleshoot-device-enrollment-in-intune#enrollment-error-codes',
  enrollmentRestrictions: 'https://learn.microsoft.com/intune/device-enrollment/restrictions',
  // M20/S1: Compliance-Übersicht (abgerufen 2026-11-10)
  complianceSummaryGet:
    'https://learn.microsoft.com/graph/api/intune-deviceconfig-devicecompliancepolicydevicestatesummary-get?view=graph-rest-1.0',
  complianceSettingSummariesList:
    'https://learn.microsoft.com/graph/api/intune-deviceconfig-devicecompliancepolicysettingstatesummary-list?view=graph-rest-1.0',
  configurationSummaryGet:
    'https://learn.microsoft.com/graph/api/intune-deviceconfig-deviceconfigurationdevicestatesummary-get?view=graph-rest-1.0',
  /** Profilstatus „Error: The policy failed to apply“ / „Conflict“ (abgerufen 2026-11-10) */
  configurationProfileMonitor:
    'https://learn.microsoft.com/intune/device-configuration/monitor-device-profile#view-details-on-a-policy',
  /** Compliance-Dashboard (Geräte › Compliance › Überwachen), Einstellungs-Compliance */
  complianceDashboard:
    'https://learn.microsoft.com/intune/device-security/compliance/monitor-policy#device-compliance-dashboard',
  /** „When a setting … returns a value of Error, the compliance state … remains unchanged for up to seven days“ */
  complianceSettingError:
    'https://learn.microsoft.com/intune/device-security/compliance/monitor-policy#device-behavior-with-a-compliance-setting-in-error-state',
  // M20/S2: Änderungsprotokoll (abgerufen 2026-11-10)
  auditEventsList:
    'https://learn.microsoft.com/graph/api/intune-auditing-auditevent-list?view=graph-rest-1.0',
  auditEventResource:
    'https://learn.microsoft.com/graph/api/resources/intune-auditing-auditevent?view=graph-rest-1.0',
  /** Intune-Überwachungsprotokolle: Mandantenverwaltung › Überwachungsprotokolle; Rollen */
  intuneAuditLogs: 'https://learn.microsoft.com/intune/governance/monitor-audit-logs',
  // M20/S3: App-Schutz (abgerufen 2026-11-10)
  managedAppRegistrationsList:
    'https://learn.microsoft.com/graph/api/intune-mam-managedappregistration-list?view=graph-rest-1.0',
  managedAppRegistrationResource:
    'https://learn.microsoft.com/graph/api/resources/intune-mam-managedappregistration?view=graph-rest-1.0',
  managedAppFlaggedReason:
    'https://learn.microsoft.com/graph/api/resources/intune-mam-managedappflaggedreason?view=graph-rest-1.0',
  /** Bericht „App-Schutzstatus“, letzte Synchronisierung; iOS 16+: generischer Gerätename */
  appProtectionMonitor:
    'https://learn.microsoft.com/intune/app-management/protection/monitor-policies',
  /** „Policy changes are not applying“: App hat nicht eingecheckt, Company Portal entfernt */
  appProtectionTroubleshooting:
    'https://learn.microsoft.com/troubleshoot/mem/intune/app-protection-policies/troubleshoot-app-protection-policy-deployment#additional-troubleshooting-scenarios',
  /** Bedingter Start „Jailbroken/rooted devices“ (Zugriff blockieren / Daten löschen) */
  appProtectionConditionalLaunch:
    'https://learn.microsoft.com/intune/app-management/protection/configure-conditional-launch',
  appProtectionConditionalLaunchAndroid:
    'https://learn.microsoft.com/intune/app-management/protection/ref-settings-android#conditional-launch',
  // M20/S4: Remote-Aktionen (abgerufen 2026-11-10)
  deviceActionResultResource:
    'https://learn.microsoft.com/graph/api/resources/intune-devices-deviceactionresult?view=graph-rest-1.0',
  /** Geräteaktionen; Status unter Geräte › Geräteaktionen; Retire/Wipe/Delete haben Vorrang */
  deviceActions: 'https://learn.microsoft.com/intune/device-management/actions/',
  /** „Why does Wipe or Retire sometimes show as Pending indefinitely?“ */
  deviceActionsTroubleshooting:
    'https://learn.microsoft.com/troubleshoot/mem/intune/device-management/troubleshoot-device-actions#wipe-and-retire-actions',
} as const;
