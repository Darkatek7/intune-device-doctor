/**
 * Kachel „Mandanten-Einstellungen“ (Intune › Compliance › Übersicht, „Compliance policy
 * settings“).
 *
 * - „Mark devices with no compliance policy assigned as“ (`secureByDefault`): Learn empfiehlt „Not
 *   compliant“, **wenn** Bedingter Zugriff mit Compliance genutzt wird.
 *   · true → erfüllt.
 *   · false und eine **aktivierte** Richtlinie verlangt ein konformes Gerät (auch als ODER-Alternative)
 *     → `critical`. Begründung: Learn nennt die Änderung nötig, „to ensure that only devices that are
 *     confirmed as compliant can access your resources“ – sonst erhalten Geräte ohne Richtlinie Zugriff
 *     (Docs.postureComplianceSettings).
 *   · false und nur Berichtsmodus → `warning` (noch nicht durchgesetzt).
 *   · false ohne solche Richtlinie → Empfehlung greift nicht, Hinweis ohne Prüfung.
 *   · Bedingter Zugriff nicht lesbar → nicht prüfbar (die Empfehlung hängt davon ab).
 * - „Compliance status validity period“: Learn nennt Standard 30 Tage (1–120), aber keinen Sollwert →
 *   nur Fakt und Hinweis, keine Prüfung.
 */
import type { TenantPosture } from '../../domain/posture';
import type { Finding, TileFact } from '../../domain/types';
import { dePosture } from '../../i18n/de-posture';
import { Docs } from '../knowledge/docs';
import { COMPLIANT_CONTROLS, controlUsage } from './access';
import { buildTile, issueTile } from './kit';
import type { CheckOutcome, PostureCheckResult, PostureTile } from './types';

const t = dePosture.tenantSettings;
const ID = 'postureTenantSettings' as const;

export function evaluateTenantSettings(posture: TenantPosture): PostureTile {
  const section = posture.complianceSettings;
  if (section.status !== 'ok') return issueTile(ID, section);
  const { secureByDefault, deviceComplianceCheckinThresholdDays: validity } = section.data;
  const source = section.source;
  const ca = posture.conditionalAccess;
  const findings: Finding[] = [];
  const checks: PostureCheckResult[] = [];
  const facts: TileFact[] = [
    {
      label: t.secureByDefault,
      value:
        secureByDefault === null
          ? dePosture.common.notDelivered
          : secureByDefault
            ? t.notCompliant
            : t.compliant,
    },
    {
      label: t.validity,
      value: validity === null ? dePosture.common.notDelivered : t.validityValue(validity),
    },
  ];

  let outcome: CheckOutcome | null;
  let summary: string;
  if (secureByDefault === true) {
    outcome = { status: 'met', actual: t.notCompliant };
    summary = t.summaryOk;
  } else if (secureByDefault === null) {
    outcome = {
      status: 'notChecked',
      actual: dePosture.common.notDelivered,
      reason: dePosture.common.notDeliveredReason,
    };
    summary = dePosture.common.notDelivered;
  } else if (ca.status !== 'ok') {
    outcome = { status: 'notChecked', actual: t.compliant, reason: t.caUnknownReason };
    summary = t.caUnknownReason;
  } else {
    const usage = controlUsage(ca.data, COMPLIANT_CONTROLS);
    const enforced = [...usage.enabled, ...usage.alternative];
    if (enforced.length > 0 || usage.reportOnly.length > 0) {
      outcome = { status: 'deviating', actual: t.compliant };
      summary = t.summaryDeviating;
      const isEnforced = enforced.length > 0;
      findings.push({
        id: `${ID}-secureByDefault`,
        severity: isEnforced ? 'critical' : 'warning',
        title: isEnforced ? t.criticalTitle : t.reportOnlyTitle,
        detail: isEnforced ? t.criticalDetail : t.reportOnlyDetail,
        cause: t.cause,
        remediation: [...t.remediation],
        evidence: {
          secureByDefault,
          enforcingPolicies: enforced.length,
          reportOnlyPolicies: usage.reportOnly.length,
        },
        source,
        docsUrl: Docs.postureComplianceSettings,
      });
    } else {
      outcome = null;
      summary = t.summaryNotEvaluated;
      findings.push({
        id: `${ID}-secureByDefault-notUsed`,
        severity: 'unknown',
        title: t.notUsedTitle,
        detail: t.notUsedDetail,
        cause: t.notUsedCause,
        remediation: [...t.notUsedRemediation],
        evidence: { secureByDefault },
        source,
        docsUrl: Docs.postureComplianceSettings,
      });
    }
  }

  if (outcome) {
    checks.push({
      id: `${ID}:secureByDefault`,
      tile: ID,
      label: t.secureByDefault,
      status: outcome.status,
      level: null,
      actual: outcome.actual,
      expected: t.secureByDefaultExpected,
      docsUrl: Docs.postureComplianceSettings,
      ...(outcome.reason ? { reason: outcome.reason } : {}),
      counted: true,
    });
  }

  findings.push({
    id: `${ID}-validity`,
    severity: 'unknown',
    title: t.validityTitle,
    detail: t.validityDetail(validity),
    cause: t.validityCause,
    remediation: [...t.validityRemediation],
    evidence: { deviceComplianceCheckinThresholdDays: validity },
    source,
    docsUrl: Docs.postureComplianceSettings,
  });

  return buildTile({
    id: ID,
    value:
      outcome === null ? t.valueNotEvaluated : outcome.status === 'met' ? t.valueOk : undefined,
    summary,
    findings,
    facts,
    sources: [source, ca.source],
    checks,
  });
}
