/**
 * Kachel „Bedingter Zugriff“ (Zero Trust, gemeinsame Richtlinien) und die Auswertung, ob Bedingter
 * Zugriff Konformität verlangt (auch für die Mandanten-Einstellungen gebraucht).
 *
 * Prüfungen (ohne Stufen):
 * 1. Eine **aktivierte** Richtlinie verlangt `compliantDevice` („Require compliant PCs and mobile devices“).
 *    Nur Berichtsmodus oder nur als ODER-Alternative zu anderen Steuerungen → weicht ab. Der Alternativ-Fall
 *    hat einen eigenen Text: Konformität wirkt dann auf den Zugriff (ein konformes Gerät genügt), ist aber
 *    nicht zwingend (Microsoft bietet „compliant device, hybrid joined device OR MFA“ selbst als Vorlage).
 *    Konsistent mit tenantSettings.ts, das eine aktive ODER-Richtlinie als durchgesetzt zählt.
 * 2. Geltungsbereich dieser Richtlinie: alle Benutzer und alle Ressourcen (Entra-Vorlage
 *    „Require device compliance“: Include All users, All resources) – nur, wenn 1 erfüllt ist.
 * 3. Eine aktivierte Richtlinie verlangt `approvedApplication` oder `compliantApplication` („Require approved
 *    apps or app protection policies“).
 * Severity: Abweichung → warning (Microsoft beschreibt Einführungsschritte, keine akute Lücke).
 * Benutzer-, Gruppen- und App-IDs sind nie im Modell – nur, *ob* ausgeschlossen bzw. „All“ enthalten ist.
 */
import type {
  ConditionalAccessInfo,
  ConditionalAccessPolicyConfig,
  TenantPosture,
} from '../../domain/posture';
import type { Finding, TileFact } from '../../domain/types';
import { dePosture } from '../../i18n/de-posture';
import { Docs } from '../knowledge/docs';
import { buildTile, issueTile, truncatedFinding } from './kit';
import type { CheckOutcome, PostureCheckResult, PostureTile } from './types';

const t = dePosture.access;
const ID = 'postureAccess' as const;

export const COMPLIANT_CONTROLS = ['compliantDevice'] as const;
export const APP_CONTROLS = ['approvedApplication', 'compliantApplication'] as const;

type Requirement = 'required' | 'alternative' | 'none';

/** Verlangt die Richtlinie eine der Steuerungen – zwingend oder nur als ODER-Alternative zu anderen? */
export function requirementOf(
  policy: ConditionalAccessPolicyConfig,
  controls: readonly string[],
): Requirement {
  if (!policy.builtInControls.some((control) => controls.includes(control))) return 'none';
  const others = policy.builtInControls.filter((control) => !controls.includes(control));
  return policy.grantOperator?.toUpperCase() === 'OR' && others.length > 0
    ? 'alternative'
    : 'required';
}

export interface ControlUsage {
  enabled: ConditionalAccessPolicyConfig[];
  reportOnly: ConditionalAccessPolicyConfig[];
  /** Aktiviert, aber nur als ODER-Alternative */
  alternative: ConditionalAccessPolicyConfig[];
}

export function controlUsage(
  info: ConditionalAccessInfo,
  controls: readonly string[],
): ControlUsage {
  const usage: ControlUsage = { enabled: [], reportOnly: [], alternative: [] };
  for (const policy of info.policies) {
    const requirement = requirementOf(policy, controls);
    if (requirement === 'none') continue;
    if (policy.state === 'enabledForReportingButNotEnforced') usage.reportOnly.push(policy);
    else if (policy.state === 'enabled') {
      (requirement === 'required' ? usage.enabled : usage.alternative).push(policy);
    }
  }
  return usage;
}

const names = (policies: ConditionalAccessPolicyConfig[]) =>
  policies.map((policy) => `„${policy.displayName}“`);

function usageOutcome(usage: ControlUsage, truncated: boolean): CheckOutcome {
  if (usage.enabled.length > 0)
    return { status: 'met', actual: t.actualEnabled(names(usage.enabled)) };
  if (usage.reportOnly.length > 0 || usage.alternative.length > 0) {
    const parts = [
      usage.alternative.length > 0 ? t.actualAlternative(names(usage.alternative)) : null,
      usage.reportOnly.length > 0 ? t.actualReportOnly(names(usage.reportOnly)) : null,
    ].filter((part): part is string => part !== null);
    return { status: 'deviating', actual: parts.join(' · ') };
  }
  if (truncated) return { status: 'notChecked', actual: t.actualNone, reason: t.truncatedReason };
  return { status: 'deviating', actual: t.actualNone };
}

function result(
  key: string,
  label: string,
  expected: string,
  docsUrl: string,
  outcome: CheckOutcome,
): PostureCheckResult {
  return {
    id: `${ID}:${key}`,
    tile: ID,
    label,
    status: outcome.status,
    level: null,
    actual: outcome.actual,
    expected,
    docsUrl,
    ...(outcome.reason ? { reason: outcome.reason } : {}),
    counted: true,
  };
}

export function evaluateAccess(posture: TenantPosture): PostureTile {
  const section = posture.conditionalAccess;
  if (section.status !== 'ok') return issueTile(ID, section);
  const info = section.data;
  const source = section.source;
  const findings: Finding[] = info.truncated ? [truncatedFinding(ID, source)] : [];
  const checks: PostureCheckResult[] = [];

  // 1. Konformes Gerät verlangt
  const compliant = controlUsage(info, COMPLIANT_CONTROLS);
  const compliantOutcome = usageOutcome(compliant, info.truncated);
  checks.push(
    result(
      'compliantDevice',
      t.compliantLabel,
      t.compliantExpected,
      Docs.postureRequireCompliantDevices,
      compliantOutcome,
    ),
  );
  if (compliantOutcome.status === 'deviating') {
    // Aktive ODER-Richtlinie: Konformität wirkt auf den Zugriff, ist aber nicht zwingend – eigener Text
    const alternative = compliant.alternative.length > 0;
    findings.push({
      id: `${ID}-compliantDevice`,
      severity: 'warning',
      title: alternative ? t.compliantTitleAlternative : t.compliantTitle,
      detail: alternative ? t.compliantDetailAlternative : t.compliantDetail,
      cause: alternative ? t.compliantCauseAlternative : t.compliantCause,
      remediation: [...t.compliantRemediation],
      evidence: {
        enabled: compliant.enabled.length,
        reportOnly: compliant.reportOnly.length,
        alternative: compliant.alternative.length,
      },
      source,
      docsUrl: Docs.postureRequireCompliantDevices,
    });
  }

  // 2. Geltungsbereich (nur sinnvoll, wenn eine aktive Richtlinie existiert)
  if (compliantOutcome.status === 'met') {
    const full = compliant.enabled.some(
      (policy) => policy.includesAllUsers && policy.includesAllApplications,
    );
    checks.push(
      result('scope', t.scopeLabel, t.scopeExpected, Docs.postureCaDeviceCompliance, {
        status: full ? 'met' : 'deviating',
        actual: full ? t.actualScopeAll : t.actualScopePartial,
      }),
    );
    if (!full) {
      findings.push({
        id: `${ID}-scope`,
        severity: 'warning',
        title: t.scopeTitle,
        detail: t.scopeDetail,
        cause: t.scopeCause,
        remediation: [...t.scopeRemediation],
        source,
        docsUrl: Docs.postureCaDeviceCompliance,
      });
    }
  }

  // 3. Genehmigte App oder App-Schutz-Richtlinie verlangt
  const app = controlUsage(info, APP_CONTROLS);
  const appOutcome = usageOutcome(app, info.truncated);
  checks.push(
    result('appProtection', t.appLabel, t.appExpected, Docs.postureRequireApprovedApps, appOutcome),
  );
  if (appOutcome.status === 'deviating') {
    findings.push({
      id: `${ID}-appProtection`,
      severity: 'warning',
      title: t.appTitle,
      detail: t.appDetail,
      cause: t.appCause,
      remediation: [...t.appRemediation],
      source,
      docsUrl: Docs.postureRequireApprovedApps,
    });
  }

  const f = t.facts;
  const facts: TileFact[] = [
    { label: f.total, value: String(info.policies.length) },
    { label: f.enabled, value: String(info.policies.filter((p) => p.state === 'enabled').length) },
    {
      label: f.reportOnly,
      value: String(
        info.policies.filter((p) => p.state === 'enabledForReportingButNotEnforced').length,
      ),
    },
    {
      label: f.disabled,
      value: String(info.policies.filter((p) => p.state === 'disabled').length),
    },
    {
      label: f.exclusions,
      value: f.exclusionsValue(info.policies.filter((p) => p.hasUserExclusions).length),
    },
  ];
  return buildTile({ id: ID, findings, facts, sources: [source], checks });
}
