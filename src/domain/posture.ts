/**
 * Ansicht „Empfehlungen“ (M21): Rohdaten für den Abgleich der Mandanten-Konfiguration mit den auf
 * Microsoft Learn dokumentierten Empfehlungen. **Vertrag** zwischen Provider (Graph/Mock), Regelwerk
 * (`src/rules/posture/`) und UI – Änderungen bewusst und überall nachziehen.
 *
 * Grundsätze:
 * - Jede Quelle ist ein eigenes SectionResult; eine fehlende Berechtigung betrifft nur ihre Kachel.
 * - Einstellungen einer Richtlinie stehen in `settings` unter **genau dem Eigenschaftsnamen der
 *   Graph-Ressource** (z. B. `bitLockerEnabled`, `passwordMinimumLength`). Enthalten sind nur
 *   Eigenschaften, die auf der Learn-Seite des jeweiligen Typs dokumentiert und in `src/graph/dto.ts`
 *   deklariert sind. `null` = von Graph als null geliefert (nicht konfiguriert); fehlt der Schlüssel,
 *   kennt der Typ die Einstellung nicht.
 * - Keine personenbezogenen Daten: keine Benutzer-, Gruppen- oder Mandanten-IDs, keine UPNs. Von
 *   Zuweisungen und Bedingungen zählt nur, *ob* etwas zugewiesen bzw. ausgeschlossen ist.
 */
import type { DataSource, SectionResult } from './types';

/** Wert einer Richtlinien-Einstellung, unverändert aus Graph (Enum-Werte als String, Dauer als ISO-8601-String). */
export type PostureValue = string | number | boolean | null;

/** Einstellungen einer Richtlinie: Graph-Eigenschaftsname → Wert. */
export type PostureSettings = Readonly<Record<string, PostureValue>>;

// ---------- Mandantenweite Compliance-Einstellungen (v1.0) ----------

/** `deviceManagement.settings` (deviceManagementSettings, v1.0). */
export interface ComplianceTenantSettings {
  /** true = Geräte ohne Compliance-Richtlinie gelten als „nicht konform“ */
  secureByDefault: boolean | null;
  /** Gültigkeitszeitraum des Compliance-Status in Tagen */
  deviceComplianceCheckinThresholdDays: number | null;
}

/**
 * Verwaltete Geräte je Betriebssystem (`managedDeviceOverview.deviceOperatingSystemSummary`, v1.0).
 *
 * Android ist für die Zero-Trust-Empfehlungen zweigeteilt (Learn führt „fully managed and corporate-owned“
 * und „personally owned“ als getrennte Empfehlungen). Android-Geräteadministrator
 * (`androidDeviceAdminCount`) gehört zu keiner der beiden Gruppen: Beide Empfehlungen sprechen von
 * Android Enterprise, Geräteadministrator ist kein Android-Enterprise-Modus – diese Geräte stecken nur
 * in `android` (Gesamtzahl).
 */
export interface PlatformDeviceCounts {
  windows: number | null;
  ios: number | null;
  macos: number | null;
  /** Gesamtzahl Android (größerer Wert aus `androidCount` und der Summe der Untertypen) */
  android: number | null;
  /** Persönliche Geräte mit Arbeitsprofil (`androidWorkProfileCount`); null = nicht geliefert */
  androidPersonal: number | null;
  /**
   * Unternehmenseigene Android-Enterprise-Geräte: vollständig verwaltet (`androidFullyManagedCount`) +
   * unternehmenseigen mit Arbeitsprofil (`androidCorporateWorkProfileCount`, COPE) + dediziert
   * (`androidDedicatedCount`). null = mindestens einer der drei Zähler nicht geliefert.
   */
  androidCorporate: number | null;
  /** Gesamtzahl der registrierten Geräte, falls geliefert */
  total: number | null;
}

// ---------- Compliance-Richtlinien mit ihren Einstellungen (v1.0) ----------

/**
 * Abgeleiteter Typ einer Compliance-Richtlinie (`@odata.type`). `other` = Typ, den v1.0 nicht mit
 * Einstellungen dokumentiert (z. B. nur in beta vorhandene Android-Typen) → nicht prüfbar.
 */
/**
 * `androidDeviceOwner` (Android Enterprise vollständig verwaltet, dediziert, unternehmenseigen mit
 * Arbeitsprofil) dokumentiert Microsoft nur in der Beta-API. Der Typ entsteht ausschließlich, wenn die
 * Beta-Liste eine Richtlinie, die v1.0 ohne dokumentierten Typ liefert, als
 * `androidDeviceOwnerCompliancePolicy` ausweist (dritte freigegebene Beta-Ausnahme, 2026-11-27).
 */
export type CompliancePolicyType =
  | 'windows10'
  | 'ios'
  | 'macos'
  | 'androidDeviceAdministrator'
  | 'androidWorkProfile'
  | 'androidDeviceOwner'
  | 'other';

/** Aktion bei Nichtkonformität (`scheduledActionsForRule` → `scheduledActionConfigurations`). */
export interface ComplianceScheduledAction {
  /** `deviceComplianceActionType`, z. B. `block`, `notification`, `retire` */
  actionType: string;
  gracePeriodHours: number | null;
}

export interface CompliancePolicyConfig {
  id: string;
  displayName: string;
  type: CompliancePolicyType;
  /** Rohwert von `@odata.type`, z. B. `#microsoft.graph.windows10CompliancePolicy` */
  odataType: string | null;
  lastModifiedDateTime: string | null;
  settings: PostureSettings;
  /** Hat die Richtlinie mindestens eine Zuweisung? null = nicht abgefragt/nicht lesbar */
  assigned: boolean | null;
  /** null = nicht abgefragt/nicht lesbar */
  scheduledActions: ComplianceScheduledAction[] | null;
  /**
   * true = `odataType` (und bei `androidDeviceOwner` auch `settings`) stammen aus der Beta-Liste, weil
   * v1.0 für diese Richtlinie keinen dokumentierten Typ liefert. Fehlt/false = alles aus v1.0.
   */
  beta?: boolean;
}

export interface CompliancePolicyConfigList {
  policies: CompliancePolicyConfig[];
  /** Mehr Richtlinien vorhanden als gelesen bzw. als im Detail abgefragt */
  truncated: boolean;
  /**
   * Beta-Liste `GET /beta/deviceManagement/deviceCompliancePolicies`: wird nur gelesen, wenn v1.0
   * mindestens eine Richtlinie mit `type: 'other'` liefert. Fehlt = nicht gelesen (nicht nötig).
   * `failed` = Abruf gescheitert (Berechtigung, Fehler) – die Richtlinien bleiben dann wie von v1.0
   * geliefert. `truncated` = Seitenlimit der Beta-Liste erreicht.
   */
  betaRead?: { status: 'ok' | 'failed'; source: DataSource; truncated: boolean };
}

// ---------- App-Schutz-Richtlinien (v1.0) ----------

export interface AppProtectionPolicyConfig {
  id: string;
  displayName: string;
  platform: 'ios' | 'android';
  lastModifiedDateTime: string | null;
  settings: PostureSettings;
  /** `isAssigned` der Richtlinie; null = nicht geliefert */
  assigned: boolean | null;
  /** Anzahl der Apps, für die die Richtlinie gilt (`deployedAppCount`) */
  deployedAppCount: number | null;
}

export interface AppProtectionPolicyConfigList {
  policies: AppProtectionPolicyConfig[];
  truncated: boolean;
}

// ---------- Bedingter Zugriff (v1.0, optionaler Scope Policy.Read.All) ----------

export type ConditionalAccessState =
  'enabled' | 'disabled' | 'enabledForReportingButNotEnforced' | 'unknown';

/** Nur die für den Abgleich nötigen Merkmale einer Richtlinie – nie Benutzer-, Gruppen- oder App-IDs. */
export interface ConditionalAccessPolicyConfig {
  id: string;
  displayName: string;
  state: ConditionalAccessState;
  /** `grantControls.builtInControls`, z. B. `compliantDevice`, `mfa`, `compliantApplication` */
  builtInControls: string[];
  /** `grantControls.operator` (`AND` | `OR`) */
  grantOperator: string | null;
  /** `conditions.users.includeUsers` enthält `All` */
  includesAllUsers: boolean;
  /** `conditions.applications.includeApplications` enthält `All` */
  includesAllApplications: boolean;
  /** Es gibt ausgeschlossene Benutzer, Gruppen oder Rollen (nur die Tatsache, keine IDs) */
  hasUserExclusions: boolean;
  /** `conditions.platforms.includePlatforms`; leer = keine Plattformbedingung */
  includePlatforms: string[];
}

export interface ConditionalAccessInfo {
  policies: ConditionalAccessPolicyConfig[];
  truncated: boolean;
}

// ---------- Microsoft Secure Score (v1.0, optionaler Scope SecurityEvents.Read.All) ----------

/** Eine Empfehlung („control“) aus dem jüngsten Secure Score samt Profil. Texte unverändert von Microsoft (Englisch). */
export interface SecureScoreControl {
  /** `controlName` (Schlüssel des Profils) */
  id: string;
  title: string | null;
  /** `controlCategory`, z. B. `Device`, `Identity`, `Apps`, `Data` */
  category: string | null;
  /** `service` des Profils, z. B. `Intune` */
  service: string | null;
  score: number | null;
  maxScore: number | null;
  /** `description` aus dem controlScore (kann HTML enthalten → Provider liefert reinen Text) */
  description: string | null;
  /** `remediation` des Profils als reiner Text */
  remediation: string | null;
  actionUrl: string | null;
  implementationCost: string | null;
  userImpact: string | null;
  deprecated: boolean;
}

export interface SecureScoreInfo {
  currentScore: number | null;
  maxScore: number | null;
  createdDateTime: string | null;
  /** Alle Empfehlungen des jüngsten Scores; das Regelwerk filtert auf die Kategorie `Device` */
  controls: SecureScoreControl[];
}

// ---------- Einstellungskatalog, Endpunktsicherheit und Sicherheitsbaselines (nur beta) ----------

/** Eine vom Vorlagen-Standard abweichende Einstellung einer Baseline-Richtlinie. */
export interface BaselineDeviation {
  settingDefinitionId: string;
  /** Anzeigename der Einstellung laut Definition; null = nicht geliefert */
  settingName: string | null;
  /** Wert in der Richtlinie (Anzeigetext der Option bzw. Wert); null = Einstellung fehlt in der Richtlinie */
  configuredValue: string | null;
  /** Standardwert der Vorlage (Microsoft-Empfehlung der Baseline) */
  defaultValue: string | null;
}

export interface BaselineComparisonInfo {
  /** Anzahl verglichener Einstellungen der Vorlage */
  comparedCount: number;
  deviations: BaselineDeviation[];
  /** Nicht alle Einstellungen gelesen (Seitengrenze) oder nicht alle Typen vergleichbar */
  truncated: boolean;
  /** Einstellungen, deren Typ nicht verglichen werden konnte (z. B. Gruppensammlungen) */
  skippedCount: number;
}

/** Richtlinie aus `deviceManagement/configurationPolicies` (beta): Einstellungskatalog, Endpunktsicherheit, Baseline. */
export interface CatalogPolicyConfig {
  id: string;
  name: string;
  /** `platforms`, z. B. `windows10`, `macOS`, `iOS` */
  platforms: string | null;
  /** `technologies`, z. B. `mdm`, `microsoftSense` */
  technologies: string | null;
  /**
   * `templateReference.templateFamily`: `none` (reiner Einstellungskatalog), `baseline`,
   * `endpointSecurityAntivirus`, `endpointSecurityDiskEncryption`, `endpointSecurityFirewall`,
   * `endpointSecurityEndpointDetectionAndResponse`, `endpointSecurityAttackSurfaceReduction`,
   * `endpointSecurityAccountProtection`, … (unverändert aus Graph)
   */
  templateFamily: string;
  templateId: string | null;
  templateDisplayName: string | null;
  templateDisplayVersion: string | null;
  settingCount: number | null;
  isAssigned: boolean | null;
  lastModifiedDateTime: string | null;
  /**
   * Nur für Baselines: Vergleich mit den Standardwerten der Vorlage. null = nicht abgefragt (keine
   * Baseline oder Grenze MAX_BASELINE_COMPARISONS erreicht).
   */
  comparison: SectionResult<BaselineComparisonInfo> | null;
}

export interface CatalogPolicyList {
  policies: CatalogPolicyConfig[];
  truncated: boolean;
}

/** Vorlage aus `deviceManagement/configurationPolicyTemplates` (beta) – für „Baseline-Version aktuell?“. */
export interface PolicyTemplateInfo {
  id: string;
  /** Gemeinsame ID aller Versionen einer Vorlage (`baseId`) */
  baseId: string | null;
  displayName: string | null;
  displayVersion: string | null;
  /** `lifecycleState`: `active`, `superseded`, `deprecated`, `retired`, `draft`, `invalid` */
  lifecycleState: string | null;
  templateFamily: string | null;
  platforms: string | null;
}

export interface PolicyTemplateList {
  templates: PolicyTemplateInfo[];
  truncated: boolean;
}

// ---------- Gesamtpaket ----------

/**
 * Alles, was die Ansicht „Empfehlungen“ lädt. Quellen aus der Beta-API (`catalogPolicies`,
 * `policyTemplates`) sind in der UI als Beta gekennzeichnet.
 */
export interface TenantPosture {
  complianceSettings: SectionResult<ComplianceTenantSettings>;
  platformCounts: SectionResult<PlatformDeviceCounts>;
  compliancePolicies: SectionResult<CompliancePolicyConfigList>;
  appProtectionPolicies: SectionResult<AppProtectionPolicyConfigList>;
  conditionalAccess: SectionResult<ConditionalAccessInfo>;
  secureScore: SectionResult<SecureScoreInfo>;
  catalogPolicies: SectionResult<CatalogPolicyList>;
  policyTemplates: SectionResult<PolicyTemplateList>;
}

export type PostureSectionKey = keyof TenantPosture;

/** Schutzstufe der Microsoft-Frameworks (1 = Basis, 2 = erweitert, 3 = hoch). */
export type PostureLevel = 1 | 2 | 3;

export const DEFAULT_POSTURE_LEVEL: PostureLevel = 2;

const POSTURE_SECTION_KEYS: readonly PostureSectionKey[] = [
  'complianceSettings',
  'platformCounts',
  'compliancePolicies',
  'appProtectionPolicies',
  'conditionalAccess',
  'secureScore',
  'catalogPolicies',
  'policyTemplates',
];

/** Dasselbe Ergebnis für alle Quellen (z. B. wenn der Provider selbst nicht geladen werden konnte). */
export function uniformPosture(
  result:
    | Extract<SectionResult<never>, { status: 'error' }>
    | Extract<SectionResult<never>, { status: 'unavailable' }>,
): TenantPosture {
  return Object.fromEntries(
    POSTURE_SECTION_KEYS.map((key) => [key, result]),
  ) as unknown as TenantPosture;
}
