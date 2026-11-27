/**
 * Demo-Daten der Ansicht „Empfehlungen“ (M21) für den fiktiven Mandanten „Contoso“. Zeitwerte relativ zu `now`.
 *
 * Bewusst gemischtes Bild: jede Kachel zeigt erfüllte und abweichende Prüfungen. Einstellungs-Schlüssel sind
 * exakt die Graph-Eigenschaftsnamen, die das Regelwerk (`src/rules/posture/catalog/`) erwartet.
 * Keine echten Daten: Gerätezahlen, Richtlinien und Kennungen sind erfunden (demoGuid), keine Personen,
 * UPNs oder Mandanten-IDs.
 */
import type {
  AppProtectionPolicyConfig,
  BaselineComparisonInfo,
  CatalogPolicyConfig,
  CompliancePolicyConfig,
  CompliancePolicyConfigList,
  ComplianceTenantSettings,
  ConditionalAccessPolicyConfig,
  PlatformDeviceCounts,
  PolicyTemplateInfo,
  PostureSettings,
  SecureScoreControl,
} from '../../domain/posture';
import type { DataSource, SectionResult } from '../../domain/types';
import { Endpoints, type EndpointId } from '../../graph/endpoints';
import { ago, demoGuid } from './scenarios/helpers';
import type { PostureDataByKey } from './types';

/** Kennungen (frei erfunden) – Richtlinien, Vorlagen und Baselines. */
const POLICY = {
  winCompliance: demoGuid('policy', 1),
  winComplianceTest: demoGuid('policy', 2),
  iosCompliance: demoGuid('policy', 3),
  androidWorkProfile: demoGuid('policy', 4),
  androidFullyManaged: demoGuid('policy', 5),
  iosAppProtection: demoGuid('policy', 6),
  androidAppProtection: demoGuid('policy', 7),
  caCompliant: demoGuid('policy', 8),
  caReportOnly: demoGuid('policy', 9),
  caDisabled: demoGuid('policy', 10),
  baselineOld: demoGuid('policy', 11),
  baselineEdge: demoGuid('policy', 12),
  endpointAv: demoGuid('policy', 13),
  endpointDisk: demoGuid('policy', 14),
  endpointFirewall: demoGuid('policy', 15),
  catalogPrivacy: demoGuid('policy', 16),
  catalogKiosk: demoGuid('policy', 17),
  catalogMacDraft: demoGuid('policy', 18),
} as const;

const TEMPLATE = {
  wsbSuperseded: demoGuid('object', 1),
  wsbActive: demoGuid('object', 2),
  edge: demoGuid('object', 3),
  av: demoGuid('object', 4),
  disk: demoGuid('object', 5),
  firewall: demoGuid('object', 6),
} as const;

const BASE_ID = {
  wsb: demoGuid('object', 11),
  edge: demoGuid('object', 12),
  av: demoGuid('object', 13),
  disk: demoGuid('object', 14),
  firewall: demoGuid('object', 15),
} as const;

/** Datenquelle für Unterergebnisse (z. B. Baseline-Vergleich); Quelle = dokumentierter Endpunkt. */
function mockSource(endpoint: EndpointId): DataSource {
  const def = Endpoints[endpoint];
  return { kind: 'mock', label: def.display, docsUrl: def.docsUrl };
}

// ---------- Mandant und Geräte ----------

/** `deviceManagement.settings`: Geräte ohne Richtlinie gelten nicht als konform; Prüfung nach 30 Tagen. */
export function complianceSettings(): ComplianceTenantSettings {
  return {
    secureByDefault: false,
    deviceComplianceCheckinThresholdDays: 30,
  };
}

/**
 * 274 registrierte Geräte; die Summe der Plattformen ergibt die Gesamtzahl. Android: 11 persönliche Geräte
 * mit Arbeitsprofil, 4 unternehmenseigene (vollständig verwaltet/COPE/dediziert), kein Geräteadministrator.
 */
export function platformCounts(): PlatformDeviceCounts {
  return {
    windows: 212,
    ios: 38,
    android: 15,
    androidPersonal: 11,
    androidCorporate: 4,
    macos: 9,
    total: 274,
  };
}

// ---------- Compliance-Richtlinien ----------

const WINDOWS_COMPLIANCE_SETTINGS: PostureSettings = {
  bitLockerEnabled: true,
  secureBootEnabled: true,
  // Abweichung: Codeintegrität aus
  codeIntegrityEnabled: false,
  passwordRequired: true,
  passwordBlockSimple: true,
  passwordRequiredToUnlockFromIdle: true,
  // Abweichung: Mindestlänge 4 statt 6
  passwordMinimumLength: 4,
  passwordMinutesOfInactivityBeforeLock: 15,
  passwordExpirationDays: 41,
  passwordPreviousPasswordBlockCount: 5,
  storageRequireEncryption: true,
};

const IOS_COMPLIANCE_SETTINGS: PostureSettings = {
  securityBlockJailbrokenDevices: true,
  osMinimumVersion: '17.0',
  passcodeRequired: true,
  passcodeBlockSimple: true,
  passcodeMinimumLength: 6,
  passcodeRequiredType: 'alphanumeric',
  passcodeMinutesOfInactivityBeforeLock: 5,
  // Nur Stufe 3 (in Stufe 2 nicht geprüft): Bedrohungsstufe nicht „secured“
  deviceThreatProtectionEnabled: false,
  deviceThreatProtectionRequiredSecurityLevel: 'low',
};

const ANDROID_WORK_PROFILE_SETTINGS: PostureSettings = {
  securityBlockJailbrokenDevices: true,
  securityRequireGooglePlayServices: true,
  securityRequireUpToDateSecurityProviders: true,
  securityRequireSafetyNetAttestationBasicIntegrity: true,
  // Abweichung 1: Gerätezertifizierung nicht verlangt
  securityRequireSafetyNetAttestationCertifiedDevice: false,
  osMinimumVersion: '13.0',
  storageRequireEncryption: true,
  securityPreventInstallAppsFromUnknownSources: true,
  // Abweichung 2: Company-Portal-Integrität nicht verlangt
  securityRequireCompanyPortalAppIntegrity: false,
  // Abweichung 3: USB-Debugging erlaubt
  securityDisableUsbDebugging: false,
  passwordRequired: true,
  passwordRequiredType: 'numericComplex',
  passwordMinimumLength: 6,
  passwordMinutesOfInactivityBeforeLock: 5,
};

/**
 * Android Enterprise vollständig verwaltet (`androidDeviceOwnerCompliancePolicy`, nur Beta-API): alle 25
 * Einstellungs-Eigenschaften des Typs, wie sie der Graph-Provider aus der Beta-Liste übernimmt. Stufe 1
 * erfüllt; Stufe 2 mit zwei Abweichungen; Stufe 3 nicht prüfbar (Bedrohungsstufe nicht aktiviert).
 */
const ANDROID_FULLY_MANAGED_SETTINGS: PostureSettings = {
  // Stufe 1 erfüllt
  securityRequireSafetyNetAttestationBasicIntegrity: true,
  osMinimumVersion: '13.0',
  passwordRequired: true,
  passwordRequiredType: 'numericComplex',
  passwordMinimumLength: 6,
  passwordMinutesOfInactivityBeforeLock: 5,
  storageRequireEncryption: true,
  securityRequireIntuneAppIntegrity: true,
  // Stufe 2: Kennwortablauf und Geräteintegrität erfüllt …
  passwordExpirationDays: 365,
  securityRequireSafetyNetAttestationCertifiedDevice: true,
  // … Abweichung 1: Wiederverwendung früherer Kennwörter nicht eingeschränkt
  passwordPreviousPasswordCountToBlock: null,
  // … Abweichung 2: starke Integrität (hardwaregestützt) nicht verlangt
  securityRequiredAndroidSafetyNetEvaluationType: 'basic',
  // Stufe 3: weder Mobile Threat Defense noch Defender-Risikobewertung verlangt
  deviceThreatProtectionEnabled: false,
  deviceThreatProtectionRequiredSecurityLevel: 'unavailable',
  advancedThreatProtectionRequiredSecurityLevel: 'unavailable',
  // Übrige Eigenschaften des Typs (ohne Learn-Sollwert)
  securityBlockJailbrokenDevices: false,
  osMaximumVersion: null,
  minAndroidSecurityPatchLevel: null,
  passwordMinimumLetterCharacters: null,
  passwordMinimumLowerCaseCharacters: null,
  passwordMinimumNonLetterCharacters: null,
  passwordMinimumNumericCharacters: null,
  passwordMinimumSymbolCharacters: null,
  passwordMinimumUpperCaseCharacters: null,
  requireNoPendingSystemUpdates: false,
};

const SCHEDULED_BLOCK_NOW = [{ actionType: 'block', gracePeriodHours: 0 }];

export function compliancePolicies(now: Date): CompliancePolicyConfigList {
  const modified = (days: number) => ago(now, { days });
  const policies: CompliancePolicyConfig[] = [
    {
      id: POLICY.winCompliance,
      displayName: 'Contoso – Windows Compliance',
      type: 'windows10',
      odataType: '#microsoft.graph.windows10CompliancePolicy',
      lastModifiedDateTime: modified(12),
      settings: WINDOWS_COMPLIANCE_SETTINGS,
      assigned: true,
      scheduledActions: [{ actionType: 'block', gracePeriodHours: 72 }],
    },
    {
      id: POLICY.winComplianceTest,
      displayName: 'Contoso – Windows Compliance (Test)',
      type: 'windows10',
      odataType: '#microsoft.graph.windows10CompliancePolicy',
      lastModifiedDateTime: modified(3),
      settings: {
        bitLockerEnabled: false,
        secureBootEnabled: true,
        codeIntegrityEnabled: false,
        passwordRequired: false,
        passwordBlockSimple: false,
        passwordMinimumLength: 8,
        passwordMinutesOfInactivityBeforeLock: 30,
        passwordExpirationDays: null,
        storageRequireEncryption: false,
      },
      assigned: false,
      scheduledActions: null,
    },
    {
      id: POLICY.iosCompliance,
      displayName: 'Contoso – iOS Compliance',
      type: 'ios',
      odataType: '#microsoft.graph.iosCompliancePolicy',
      lastModifiedDateTime: modified(20),
      settings: IOS_COMPLIANCE_SETTINGS,
      assigned: true,
      scheduledActions: SCHEDULED_BLOCK_NOW,
    },
    {
      id: POLICY.androidWorkProfile,
      displayName: 'Contoso – Android Arbeitsprofil Compliance',
      type: 'androidWorkProfile',
      odataType: '#microsoft.graph.androidWorkProfileCompliancePolicy',
      lastModifiedDateTime: modified(45),
      settings: ANDROID_WORK_PROFILE_SETTINGS,
      assigned: true,
      scheduledActions: SCHEDULED_BLOCK_NOW,
    },
    {
      // Typ und Einstellungen stammen aus der Beta-Liste (v1.0 dokumentiert den Typ nicht)
      id: POLICY.androidFullyManaged,
      displayName: 'Contoso – Android vollständig verwaltet',
      type: 'androidDeviceOwner',
      odataType: '#microsoft.graph.androidDeviceOwnerCompliancePolicy',
      lastModifiedDateTime: modified(90),
      settings: ANDROID_FULLY_MANAGED_SETTINGS,
      assigned: true,
      scheduledActions: SCHEDULED_BLOCK_NOW,
      beta: true,
    },
  ];
  return {
    policies,
    truncated: false,
    betaRead: {
      status: 'ok',
      source: mockSource('deviceCompliancePoliciesBeta'),
      truncated: false,
    },
  };
}

// ---------- App-Schutz ----------

export function appProtectionPolicies(now: Date): {
  policies: AppProtectionPolicyConfig[];
  truncated: boolean;
} {
  const modified = (days: number) => ago(now, { days });
  const policies: AppProtectionPolicyConfig[] = [
    {
      id: POLICY.iosAppProtection,
      displayName: 'Contoso – iOS App-Schutz',
      platform: 'ios',
      lastModifiedDateTime: modified(30),
      assigned: true,
      deployedAppCount: 6,
      settings: {
        // Stufe 1 erfüllt
        pinRequired: true,
        minimumPinLength: 4,
        disableAppPinIfDevicePinIsSet: false,
        periodOnlineBeforeAccessCheck: 'PT30M',
        maximumPinRetries: 5,
        periodOfflineBeforeAccessCheck: 'P14D',
        periodOfflineBeforeWipeIsEnforced: 'P30D',
        // Stufe 2 erfüllt
        dataBackupBlocked: true,
        allowedOutboundDataTransferDestinations: 'managedApps',
        saveAsBlocked: true,
        allowedOutboundClipboardSharingLevel: 'managedApps',
        managedBrowserToOpenLinksRequired: true,
        managedBrowser: 'microsoftEdge',
        minimumRequiredOsVersion: '17.0',
        // Stufe 3 nicht erreicht: Daten dürfen aus allen Apps empfangen werden, Drucken erlaubt, PIN nur 4
        allowedInboundDataTransferSources: 'allApps',
        printBlocked: false,
        simplePinBlocked: true,
        periodBeforePinReset: 'P365D',
      },
    },
    {
      id: POLICY.androidAppProtection,
      displayName: 'Contoso – Android App-Schutz',
      platform: 'android',
      lastModifiedDateTime: modified(60),
      assigned: true,
      deployedAppCount: 6,
      settings: {
        // Stufe 1 erfüllt
        pinRequired: true,
        minimumPinLength: 4,
        disableAppPinIfDevicePinIsSet: false,
        periodOnlineBeforeAccessCheck: 'PT30M',
        maximumPinRetries: 5,
        periodOfflineBeforeAccessCheck: 'P14D',
        periodOfflineBeforeWipeIsEnforced: 'P30D',
        encryptAppData: true,
        disableAppEncryptionIfDeviceEncryptionIsEnabled: false,
        // Stufe 2 nur teilweise: Datensicherung erlaubt, Daten gehen an alle Apps
        dataBackupBlocked: false,
        allowedOutboundDataTransferDestinations: 'allApps',
        saveAsBlocked: true,
        allowedOutboundClipboardSharingLevel: 'managedApps',
        managedBrowserToOpenLinksRequired: true,
        managedBrowser: 'microsoftEdge',
        screenCaptureBlocked: false,
        minimumRequiredOsVersion: '13.0',
        minimumRequiredPatchVersion: null,
      },
    },
  ];
  return { policies, truncated: false };
}

// ---------- Bedingter Zugriff ----------

const CA_BASE = {
  builtInControls: ['compliantDevice'],
  grantOperator: 'OR',
  includePlatforms: [] as string[],
};

export function conditionalAccess(): {
  policies: ConditionalAccessPolicyConfig[];
  truncated: boolean;
} {
  const policies: ConditionalAccessPolicyConfig[] = [
    {
      id: POLICY.caCompliant,
      displayName: 'Contoso – Konformes Gerät erforderlich',
      state: 'enabled',
      ...CA_BASE,
      includesAllUsers: true,
      includesAllApplications: true,
      hasUserExclusions: false,
    },
    {
      id: POLICY.caReportOnly,
      displayName: 'Contoso – Konformes Gerät für Bürogeräte (Bericht)',
      state: 'enabledForReportingButNotEnforced',
      ...CA_BASE,
      grantOperator: 'AND',
      includesAllUsers: false,
      includesAllApplications: true,
      hasUserExclusions: true,
    },
    {
      id: POLICY.caDisabled,
      displayName: 'Contoso – Anmeldung mit MFA (deaktiviert)',
      state: 'disabled',
      builtInControls: ['mfa'],
      grantOperator: 'OR',
      includePlatforms: [],
      includesAllUsers: true,
      includesAllApplications: true,
      hasUserExclusions: false,
    },
  ];
  return { policies, truncated: false };
}

// ---------- Microsoft Secure Score ----------

function control(
  id: string,
  title: string,
  category: string,
  service: string,
  score: number,
  maxScore: number,
  remediation: string,
): SecureScoreControl {
  return {
    id,
    title,
    category,
    service,
    score,
    maxScore,
    description: `Demo: ${title}.`,
    remediation,
    actionUrl: null,
    implementationCost: 'Low',
    userImpact: 'Low',
    deprecated: false,
  };
}

export function secureScore(now: Date): {
  currentScore: number;
  maxScore: number;
  createdDateTime: string;
  controls: SecureScoreControl[];
} {
  return {
    currentScore: 412,
    maxScore: 640,
    createdDateTime: ago(now, { hours: 6 }),
    controls: [
      // Device / Intune – teils volle, teils keine Punkte
      control(
        'Intune_RequireBitLockerWindows',
        'Require BitLocker on Windows devices',
        'Device',
        'Intune',
        0,
        9,
        'Assign a BitLocker encryption policy to Windows devices in Microsoft Intune.',
      ),
      control(
        'Intune_EnableSecureBoot',
        'Require Secure Boot on Windows devices',
        'Device',
        'Intune',
        10,
        10,
        'Enable Secure Boot in the compliance policy for Windows devices.',
      ),
      control(
        'Intune_RequireFirewall',
        'Require a firewall on Windows devices',
        'Device',
        'Intune',
        0,
        10,
        'Assign a firewall policy to Windows devices in Microsoft Intune.',
      ),
      control(
        'Intune_AppProtectionMobile',
        'Enable app protection policies for mobile devices',
        'Device',
        'Intune',
        8,
        10,
        'Assign app protection policies to iOS and Android apps.',
      ),
      control(
        'Defender_AttackSurfaceRules',
        'Turn on attack surface reduction rules',
        'Device',
        'Microsoft Defender for Endpoint',
        3,
        8,
        'Configure attack surface reduction rules for Windows devices.',
      ),
      // Identity – andere Kategorie
      control(
        'AdminMFA',
        'Require multifactor authentication for administrative roles',
        'Identity',
        'AzureAD',
        10,
        10,
        'Require MFA for all administrative roles.',
      ),
      control(
        'LegacyAuthBlock',
        'Block legacy authentication',
        'Identity',
        'AzureAD',
        0,
        10,
        'Create a conditional access policy that blocks legacy authentication clients.',
      ),
      control(
        'SsprEnabled',
        'Enable self-service password reset',
        'Identity',
        'AzureAD',
        1,
        1,
        'Enable self-service password reset for all users.',
      ),
      control(
        'DataSensitivityLabels',
        'Enable sensitivity labels for documents',
        'Data',
        'Microsoft Purview',
        0,
        6,
        'Publish sensitivity labels to users.',
      ),
    ],
  };
}

// ---------- Einstellungskatalog, Endpunktsicherheit, Baselines (beta) ----------

function comparisonOk(
  now: Date,
  info: BaselineComparisonInfo,
): SectionResult<BaselineComparisonInfo> {
  return {
    status: 'ok',
    data: info,
    source: mockSource('catalogPolicySettings'),
    fetchedAt: now.toISOString(),
  };
}

export function catalogPolicies(now: Date): {
  policies: CatalogPolicyConfig[];
  truncated: boolean;
} {
  const modified = (days: number) => ago(now, { days });
  const policies: CatalogPolicyConfig[] = [
    {
      // Baseline auf veralteter Vorlage mit vier Abweichungen
      id: POLICY.baselineOld,
      name: 'Contoso – Windows-Sicherheitsbaseline',
      platforms: 'windows10',
      technologies: 'mdm',
      templateFamily: 'baseline',
      templateId: TEMPLATE.wsbSuperseded,
      templateDisplayName: 'Windows Security Baseline',
      templateDisplayVersion: '2025 Oct',
      settingCount: 176,
      isAssigned: true,
      lastModifiedDateTime: modified(40),
      comparison: comparisonOk(now, {
        comparedCount: 176,
        skippedCount: 3,
        truncated: false,
        deviations: [
          {
            settingDefinitionId: 'demo_asr_block_office_executable_content',
            settingName: 'Block Office applications from creating executable content',
            configuredValue: 'Disabled',
            defaultValue: 'Enabled',
          },
          {
            settingDefinitionId: 'demo_lsa_block_credential_stealing',
            settingName:
              'Block credential stealing from the Windows local security authority subsystem',
            configuredValue: 'Disabled',
            defaultValue: 'Enabled',
          },
          {
            settingDefinitionId: 'demo_user_prevent_settings_changes',
            settingName: 'Prevent users from modifying settings',
            configuredValue: 'Disabled',
            defaultValue: 'Enabled',
          },
          {
            settingDefinitionId: 'demo_pin_minimum_length',
            settingName: 'Minimum PIN length',
            configuredValue: '4',
            defaultValue: '6',
          },
        ],
      }),
    },
    {
      // Baseline auf aktueller Vorlage ohne Abweichungen
      id: POLICY.baselineEdge,
      name: 'Contoso – Microsoft Edge-Baseline',
      platforms: 'windows10',
      technologies: 'mdm',
      templateFamily: 'baseline',
      templateId: TEMPLATE.edge,
      templateDisplayName: 'Microsoft Edge Baseline',
      templateDisplayVersion: '2026 Jun',
      settingCount: 62,
      isAssigned: true,
      lastModifiedDateTime: modified(15),
      comparison: comparisonOk(now, {
        comparedCount: 62,
        skippedCount: 0,
        truncated: false,
        deviations: [],
      }),
    },
    {
      id: POLICY.endpointAv,
      name: 'Contoso – Windows Antivirus',
      platforms: 'windows10',
      technologies: 'microsoftSense',
      templateFamily: 'endpointSecurityAntivirus',
      templateId: TEMPLATE.av,
      templateDisplayName: 'Microsoft Defender Antivirus',
      templateDisplayVersion: '1.0',
      settingCount: 22,
      isAssigned: true,
      lastModifiedDateTime: modified(25),
      comparison: null,
    },
    {
      id: POLICY.endpointDisk,
      name: 'Contoso – Windows BitLocker',
      platforms: 'windows10',
      technologies: 'mdm',
      templateFamily: 'endpointSecurityDiskEncryption',
      templateId: TEMPLATE.disk,
      templateDisplayName: 'BitLocker',
      templateDisplayVersion: '1.0',
      settingCount: 11,
      isAssigned: true,
      lastModifiedDateTime: modified(25),
      comparison: null,
    },
    {
      id: POLICY.endpointFirewall,
      name: 'Contoso – Windows Firewall',
      platforms: 'windows10',
      technologies: 'mdm',
      templateFamily: 'endpointSecurityFirewall',
      templateId: TEMPLATE.firewall,
      templateDisplayName: 'Microsoft Defender Firewall',
      templateDisplayVersion: '1.0',
      settingCount: 18,
      isAssigned: true,
      lastModifiedDateTime: modified(50),
      comparison: null,
    },
    // Reine Einstellungskatalog-Richtlinien (ohne Vorlage)
    {
      id: POLICY.catalogPrivacy,
      name: 'Contoso – Windows Datenschutz',
      platforms: 'windows10',
      technologies: 'mdm',
      templateFamily: 'none',
      templateId: null,
      templateDisplayName: null,
      templateDisplayVersion: null,
      settingCount: 14,
      isAssigned: true,
      lastModifiedDateTime: modified(70),
      comparison: null,
    },
    {
      id: POLICY.catalogKiosk,
      name: 'Contoso – iOS Einstellungen Empfang',
      platforms: 'iOS',
      technologies: 'mdm',
      templateFamily: 'none',
      templateId: null,
      templateDisplayName: null,
      templateDisplayVersion: null,
      settingCount: 5,
      isAssigned: true,
      lastModifiedDateTime: modified(100),
      comparison: null,
    },
    {
      id: POLICY.catalogMacDraft,
      name: 'Contoso – macOS Einstellungen (Entwurf)',
      platforms: 'macOS',
      technologies: 'mdm',
      templateFamily: 'none',
      templateId: null,
      templateDisplayName: null,
      templateDisplayVersion: null,
      settingCount: 3,
      isAssigned: false,
      lastModifiedDateTime: modified(8),
      comparison: null,
    },
  ];
  return { policies, truncated: false };
}

// ---------- Vorlagen (für „Baseline-Version aktuell?“) ----------

export function policyTemplates(): { templates: PolicyTemplateInfo[]; truncated: boolean } {
  const templates: PolicyTemplateInfo[] = [
    {
      id: TEMPLATE.wsbSuperseded,
      baseId: BASE_ID.wsb,
      displayName: 'Windows Security Baseline',
      displayVersion: '2025 Oct',
      lifecycleState: 'superseded',
      templateFamily: 'baseline',
      platforms: 'windows10',
    },
    {
      id: TEMPLATE.wsbActive,
      baseId: BASE_ID.wsb,
      displayName: 'Windows Security Baseline',
      displayVersion: '2026 Sep',
      lifecycleState: 'active',
      templateFamily: 'baseline',
      platforms: 'windows10',
    },
    {
      id: TEMPLATE.edge,
      baseId: BASE_ID.edge,
      displayName: 'Microsoft Edge Baseline',
      displayVersion: '2026 Jun',
      lifecycleState: 'active',
      templateFamily: 'baseline',
      platforms: 'windows10',
    },
    {
      id: TEMPLATE.av,
      baseId: BASE_ID.av,
      displayName: 'Microsoft Defender Antivirus',
      displayVersion: '1.0',
      lifecycleState: 'active',
      templateFamily: 'endpointSecurityAntivirus',
      platforms: 'windows10',
    },
    {
      id: TEMPLATE.disk,
      baseId: BASE_ID.disk,
      displayName: 'BitLocker',
      displayVersion: '1.0',
      lifecycleState: 'active',
      templateFamily: 'endpointSecurityDiskEncryption',
      platforms: 'windows10',
    },
    {
      id: TEMPLATE.firewall,
      baseId: BASE_ID.firewall,
      displayName: 'Microsoft Defender Firewall',
      displayVersion: '1.0',
      lifecycleState: 'active',
      templateFamily: 'endpointSecurityFirewall',
      platforms: 'windows10',
    },
  ];
  return { templates, truncated: false };
}

/** Standard-Nutzdaten je Quelle (Mock-Provider ergänzt Quelle und Zeitstempel). */
export const POSTURE_DEFAULTS = {
  complianceSettings,
  platformCounts,
  compliancePolicies,
  appProtectionPolicies,
  conditionalAccess,
  secureScore,
  catalogPolicies,
  policyTemplates,
} as const satisfies { [K in keyof PostureDataByKey]: (now: Date) => PostureDataByKey[K] };
