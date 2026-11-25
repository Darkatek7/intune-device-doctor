/**
 * Kachel „Abdeckung der Plattformen“: Jede Plattform mit verwalteten Geräten hat mindestens eine
 * **zugewiesene** Compliance-Richtlinie (Zero-Trust-Empfehlungen für Intune-Mandanten, „Compliance
 * policies protect … devices“).
 *
 * Severity: Plattform mit Geräten ohne zugewiesene Richtlinie → `critical`. Begründung: Die Learn-Seite
 * nennt genau diese Lücke ausdrücklich als Risiko („If compliance policies … aren't configured and
 * assigned, threat actors can exploit unmanaged or noncompliant endpoints …“, Docs.postureCoverage*).
 * Windows zählt nur Richtlinien „Windows 10 und neuer“ (ältere Windows-Typen gelten nicht für diese Geräte).
 * Plattform ohne Geräte → „nicht genutzt“, keine Prüfung. Geräteanzahl unbekannt → nicht prüfbar.
 */
import type { CompliancePolicyConfig, TenantPosture } from '../../domain/posture';
import type { Finding, TileFact } from '../../domain/types';
import { dePosture } from '../../i18n/de-posture';
import { sectionIssueFinding } from '../helpers';
import { Docs } from '../knowledge/docs';
import {
  buildTile,
  compliancePolicyPlatform,
  deviceCount,
  issueTile,
  PLATFORMS,
  truncatedFinding,
  type PosturePlatform,
} from './kit';
import type { CheckOutcome, PostureCheckResult, PostureTile } from './types';

const t = dePosture.coverage;
const ID = 'postureCoverage' as const;

export const COVERAGE_DOCS: Record<PosturePlatform, string> = {
  windows: Docs.postureCoverageWindows,
  ios: Docs.postureCoverageIos,
  android: Docs.postureCoverageAndroid,
  macos: Docs.postureCoverageMacos,
};

/** Richtlinien, die Geräte der Plattform abdecken können. */
export function coveringPolicies(
  policies: readonly CompliancePolicyConfig[],
  platform: PosturePlatform,
): CompliancePolicyConfig[] {
  return policies.filter(
    (policy) =>
      compliancePolicyPlatform(policy) === platform &&
      (platform !== 'windows' || policy.type === 'windows10'),
  );
}

function coverageOutcome(
  devices: number | null,
  covering: CompliancePolicyConfig[],
  truncated: boolean,
): CheckOutcome {
  const assigned = covering.filter((policy) => policy.assigned === true);
  if (devices === null) {
    return {
      status: 'notChecked',
      actual: t.countUnknownReason,
      reason: t.countUnknownReason,
    };
  }
  if (assigned.length > 0) return { status: 'met', actual: t.actualAssigned(assigned.length) };
  if (covering.some((policy) => policy.assigned === null)) {
    return {
      status: 'notChecked',
      actual: t.actualUnknown(covering.length),
      reason: t.assignmentUnknownReason,
    };
  }
  if (truncated) {
    return {
      status: 'notChecked',
      actual: covering.length > 0 ? t.actualUnassigned(covering.length) : t.actualNone,
      reason: dePosture.common.noPolicyInList,
    };
  }
  return {
    status: 'deviating',
    actual: covering.length > 0 ? t.actualUnassigned(covering.length) : t.actualNone,
  };
}

export function evaluateCoverage(posture: TenantPosture): PostureTile {
  const policiesSection = posture.compliancePolicies;
  const countsSection = posture.platformCounts;
  if (policiesSection.status !== 'ok') {
    return issueTile(ID, policiesSection, {
      findings: countsSection.status !== 'ok' ? [sectionIssueFinding(ID, countsSection)] : [],
      sources: [countsSection.source],
    });
  }
  if (countsSection.status !== 'ok') {
    return issueTile(ID, countsSection, { sources: [policiesSection.source] });
  }
  const { policies, truncated } = policiesSection.data;
  const source = policiesSection.source;
  const checks: PostureCheckResult[] = [];
  const findings: Finding[] = truncated ? [truncatedFinding(ID, source)] : [];
  const facts: TileFact[] = [];
  let used = 0;

  for (const platform of PLATFORMS) {
    const name = t.platforms[platform];
    const devices = deviceCount(countsSection, platform) ?? null;
    const covering = coveringPolicies(policies, platform);
    facts.push({
      label: t.deviceFact(name),
      value:
        devices === 0 && covering.length === 0
          ? t.notUsedFact
          : t.deviceFactValue(devices, covering.length),
    });
    if (devices === 0) continue;
    used += 1;
    const outcome = coverageOutcome(devices, covering, truncated);
    checks.push({
      id: `${ID}:${platform}`,
      tile: ID,
      label: t.checkLabel(name),
      status: outcome.status,
      level: null,
      actual: outcome.actual,
      expected: t.expected,
      docsUrl: COVERAGE_DOCS[platform],
      ...(outcome.reason ? { reason: outcome.reason } : {}),
      counted: true,
    });
    if (outcome.status === 'deviating' && devices !== null) {
      findings.push({
        id: `${ID}-missing-${platform}`,
        severity: 'critical',
        title: t.missingTitle(name, devices),
        detail: platform === 'windows' ? `${t.missingDetail} ${t.windowsNote}` : t.missingDetail,
        cause: t.missingCause,
        remediation: [...t.missingRemediation],
        evidence: {
          platform,
          managedDevices: devices,
          policies: covering.length,
          assignedPolicies: 0,
        },
        source,
        docsUrl: COVERAGE_DOCS[platform],
      });
    }
  }

  const met = checks.filter((check) => check.status === 'met').length;
  return buildTile({
    id: ID,
    value: t.value(met, used),
    summary: t.summary(used),
    findings,
    facts,
    sources: [source, countsSection.source],
    checks,
    fallback: used === 0 ? 'unknown' : 'ok',
  });
}
