/**
 * Kacheln „App-Schutz: iOS/iPadOS | Android“: Data Protection Framework Stufe 1–3, jede Richtlinie
 * einzeln. Zusätzlich: mindestens eine zugewiesene App-Schutz-Richtlinie je Plattform (Zero Trust,
 * „Apply Application Protection Policies (APP) … One Intune APP per mobile device platform“).
 *
 * App-Schutz gilt auch für nicht registrierte Geräte – die Geräteanzahl entscheidet deshalb nur, ob eine
 * Plattform ohne Richtlinie ruhig als „nicht genutzt“ gilt (nachweislich 0 verwaltete Geräte).
 * Severity: fehlende Richtlinie und Abweichungen → warning; nicht zugewiesene Richtlinie → Hinweis.
 */
import type { AppProtectionPolicyConfig, TenantPosture } from '../../domain/posture';
import type { Finding, TileFact, TileId } from '../../domain/types';
import { dePosture } from '../../i18n/de-posture';
import { Docs } from '../knowledge/docs';
import { APP_PROTECTION_ANDROID, APP_PROTECTION_IOS } from './catalog';
import {
  buildTile,
  countChecks,
  evaluateFramework,
  issueTile,
  levelFact,
  platformUnused,
  policyCheckResults,
  policyOutcome,
  summaryOfChecks,
  truncatedFinding,
  uncheckableOutcome,
  valueOfChecks,
} from './kit';
import type { CheckOutcome, PostureCheckResult, PostureOptions, PostureTile } from './types';

const t = dePosture.appProtection;
const c = dePosture.common;

type AppPlatform = AppProtectionPolicyConfig['platform'];

export const APP_PROTECTION_TILE: Record<AppPlatform, TileId> = {
  ios: 'postureAppProtectionIos',
  android: 'postureAppProtectionAndroid',
};

const FRAMEWORK = { ios: APP_PROTECTION_IOS, android: APP_PROTECTION_ANDROID } as const;

function coverageOutcome(policies: AppProtectionPolicyConfig[], truncated: boolean): CheckOutcome {
  const co = dePosture.coverage;
  const assigned = policies.filter((policy) => policy.assigned === true);
  if (assigned.length > 0) return { status: 'met', actual: co.actualAssigned(assigned.length) };
  if (policies.some((policy) => policy.assigned === null)) {
    return {
      status: 'notChecked',
      actual: co.actualUnknown(policies.length),
      reason: co.assignmentUnknownReason,
    };
  }
  if (truncated) {
    return {
      status: 'notChecked',
      actual: policies.length > 0 ? co.actualUnassigned(policies.length) : co.actualNone,
      reason: c.noPolicyInList,
    };
  }
  return {
    status: 'deviating',
    actual: policies.length > 0 ? co.actualUnassigned(policies.length) : co.actualNone,
  };
}

export function evaluateAppProtectionTile(
  posture: TenantPosture,
  platform: AppPlatform,
  options: PostureOptions,
): PostureTile {
  const id = APP_PROTECTION_TILE[platform];
  const section = posture.appProtectionPolicies;
  if (section.status !== 'ok') return issueTile(id, section);
  const source = section.source;
  const sources = [source, posture.platformCounts.source];
  const { truncated } = section.data;
  const own = section.data.policies.filter((policy) => policy.platform === platform);
  const findings: Finding[] = truncated ? [truncatedFinding(id, source)] : [];
  const facts: TileFact[] = truncated
    ? [{ label: c.facts.truncated, value: c.facts.truncatedValue }]
    : [];

  if (own.length === 0 && platformUnused(posture.platformCounts, platform) && !truncated) {
    return buildTile({
      id,
      value: c.valueNotUsed,
      summary: c.summaryNotUsed,
      findings,
      facts,
      sources,
      checks: [],
      fallback: 'unknown',
    });
  }

  const framework = FRAMEWORK[platform];
  const checks: PostureCheckResult[] = [];
  const coverage = coverageOutcome(own, truncated);
  checks.push({
    id: `${id}:coverage`,
    tile: id,
    label: t.coverageLabel,
    status: coverage.status,
    level: 1,
    actual: coverage.actual,
    expected: t.coverageExpected,
    docsUrl: Docs.postureAppProtectionPerPlatform,
    ...(coverage.reason ? { reason: coverage.reason } : {}),
    counted: true,
  });
  if (coverage.status === 'deviating') {
    findings.push({
      id: `${id}-coverage`,
      severity: 'warning',
      title: t.coverageTitle,
      detail: t.coverageDetail,
      cause: t.coverageCause,
      remediation: [...t.coverageRemediation],
      evidence: { policies: own.length, assigned: 0 },
      source,
      docsUrl: Docs.postureAppProtectionPerPlatform,
    });
  }
  if (own.length === 0) {
    return buildTile({
      id,
      value: c.valueNoPolicy,
      summary: t.coverageTitle,
      findings,
      facts,
      sources,
      checks,
    });
  }

  const fact = levelFact(framework, options.level);
  if (fact) facts.push(fact);
  facts.push({ label: c.facts.policies, value: String(own.length) });
  let anyCounted = false;
  let allReached = true;
  for (const policy of own) {
    const ref = { id: policy.id, name: policy.displayName, assigned: policy.assigned };
    const evaluation = evaluateFramework(framework, { settings: policy.settings }, options.level);
    const results = policyCheckResults(id, ref, evaluation);
    checks.push(...results);
    if (policy.assigned !== false) {
      anyCounted = true;
      if (evaluation.reached === null || evaluation.reached < options.level) allReached = false;
    }
    const outcome = policyOutcome({
      tile: id,
      policy: ref,
      framework,
      evaluation,
      results,
      source,
      texts: { cause: t.cause, remediation: t.remediation },
    });
    facts.push(outcome.fact);
    facts.push({
      label: t.appsFact(policy.displayName),
      value: t.appsValue(policy.deployedAppCount),
    });
    if (outcome.finding) findings.push(outcome.finding);
  }
  const uncheckable = uncheckableOutcome(id, framework, options.level, source, anyCounted);
  checks.push(...uncheckable.checks);
  if (uncheckable.finding) findings.push(uncheckable.finding);

  const counts = countChecks(checks);
  return buildTile({
    id,
    value:
      anyCounted && allReached && counts.deviating === 0
        ? c.valueLevel(options.level)
        : valueOfChecks(checks),
    summary: dePosture.compliance.summaryPolicies(own.length, summaryOfChecks(checks)),
    findings,
    facts,
    sources,
    checks,
  });
}
