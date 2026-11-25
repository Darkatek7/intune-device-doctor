/**
 * Kacheln „Compliance: Windows | iOS/iPadOS | Android | macOS“: jede Compliance-Richtlinie einzeln gegen
 * das passende Microsoft-Framework (nicht zusammengeführt – welche Richtlinie für ein Gerät gilt, hängt
 * von den Zuweisungen ab).
 *
 * - Windows 10 und neuer → Zero-Trust-Tabelle (ungestuft); andere Windows-Typen → kein Sollwert.
 * - iOS/iPadOS → Sicherheitskonfiguration Stufe 2/3 (Stufe 1 bietet Microsoft nicht an → Stufe 2).
 * - Android: bewertet wird das Framework „persönliches Gerät mit Arbeitsprofil“ (Stufe 2/3);
 *   Android-Geräteadministrator → kein Sollwert (Verwaltung von Microsoft eingestellt); nur in beta
 *   dokumentierte Typen (z. B. vollständig verwaltet/unternehmenseigen) → nicht prüfbar. Ob unternehmens-
 *   eigene Geräte überhaupt abgedeckt sind, bewertet die Kachel „Abdeckung der Plattformen“ getrennt.
 * - „Stufe N erreicht“: nicht prüfbare Empfehlungen verhindern die Stufe nicht und bestätigen sie nicht –
 *   gibt es welche, lautet der Wert „Stufe N erreicht, soweit prüfbar“.
 * - macOS → Microsoft dokumentiert keinen Sollwert; nur Abdeckung (eigene Kachel).
 * Plattform ohne Geräte und ohne Richtlinie → „Nicht genutzt“ (kein Befund).
 */
import type { CompliancePolicyConfig, PostureLevel, TenantPosture } from '../../domain/posture';
import type { DataSource, Finding, TileFact, TileId } from '../../domain/types';
import { dePosture } from '../../i18n/de-posture';
import { Docs } from '../knowledge/docs';
import { COVERAGE_DOCS } from './coverage';
import { ANDROID_WORK_PROFILE_COMPLIANCE, IOS_COMPLIANCE, WINDOWS_COMPLIANCE } from './catalog';
import {
  buildTile,
  compliancePolicyPlatform,
  countChecks,
  evaluateFramework,
  issueTile,
  levelFact,
  platformUnused,
  policyCheckResults,
  policyLabel,
  policyOutcome,
  summaryOfChecks,
  truncatedFinding,
  uncheckableOutcome,
  valueOfChecks,
  type PosturePlatform,
} from './kit';
import type { PostureCheckResult, PostureFramework, PostureOptions, PostureTile } from './types';

const t = dePosture.compliance;
const c = dePosture.common;

export const COMPLIANCE_TILE: Record<PosturePlatform, TileId> = {
  windows: 'postureComplianceWindows',
  ios: 'postureComplianceIos',
  android: 'postureComplianceAndroid',
  macos: 'postureComplianceMacos',
};

type Handling =
  { kind: 'framework'; framework: PostureFramework } | { kind: 'noTarget' } | { kind: 'betaOnly' };

/** Welche Bewertung eine Richtlinie bekommt. */
export function complianceHandling(policy: CompliancePolicyConfig): Handling {
  switch (policy.type) {
    case 'windows10':
      return { kind: 'framework', framework: WINDOWS_COMPLIANCE };
    case 'ios':
      return { kind: 'framework', framework: IOS_COMPLIANCE };
    case 'androidWorkProfile':
      return { kind: 'framework', framework: ANDROID_WORK_PROFILE_COMPLIANCE };
    case 'androidDeviceAdministrator':
    case 'macos':
      return { kind: 'noTarget' };
    case 'other': {
      const platform = compliancePolicyPlatform(policy);
      // Android- und iOS-Typen, die nur beta mit Einstellungen dokumentiert, haben Learn-Empfehlungen
      return platform === 'android' || platform === 'ios'
        ? { kind: 'betaOnly' }
        : { kind: 'noTarget' };
    }
  }
}

function noTargetFinding(
  tile: TileId,
  platform: PosturePlatform,
  policies: CompliancePolicyConfig[],
  source: DataSource,
): Finding {
  const names = policies.map((policy) => policy.displayName);
  const detail =
    platform === 'macos'
      ? t.noTargetMacos
      : platform === 'android'
        ? t.noTargetDeviceAdmin(names)
        : t.noTargetWindowsOther(names);
  return {
    id: `${tile}-noTarget`,
    severity: 'unknown',
    title: t.noTargetTitle,
    detail,
    cause: t.noTargetCause,
    remediation: [...t.noTargetRemediation],
    source,
    docsUrl:
      platform === 'macos'
        ? Docs.postureMacosComplianceSettings
        : platform === 'android'
          ? Docs.postureNoncomplianceActions
          : Docs.postureWindowsCompliance,
  };
}

export function evaluateComplianceTile(
  posture: TenantPosture,
  platform: PosturePlatform,
  options: PostureOptions,
): PostureTile {
  const id = COMPLIANCE_TILE[platform];
  const section = posture.compliancePolicies;
  if (section.status !== 'ok') return issueTile(id, section);
  const source = section.source;
  const sources = [source, posture.platformCounts.source];
  const own = section.data.policies.filter(
    (policy) => compliancePolicyPlatform(policy) === platform,
  );
  const truncated = section.data.truncated;
  const findings: Finding[] = truncated ? [truncatedFinding(id, source)] : [];
  const facts: TileFact[] = truncated
    ? [{ label: c.facts.truncated, value: c.facts.truncatedValue }]
    : [];

  if (own.length === 0) {
    if (platformUnused(posture.platformCounts, platform) && !truncated) {
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
    findings.push({
      id: `${id}-noPolicy`,
      severity: 'unknown',
      title: t.noPolicyTitle,
      detail: t.noPolicyDetail,
      cause: t.noPolicyCause,
      remediation: [...t.noPolicyRemediation],
      source,
      docsUrl: COVERAGE_DOCS[platform],
    });
    return buildTile({
      id,
      value: c.valueNoPolicy,
      summary: t.noPolicyTitle,
      findings,
      facts,
      sources,
      checks: [],
      fallback: 'unknown',
    });
  }

  const checks: PostureCheckResult[] = [];
  const noTarget: CompliancePolicyConfig[] = [];
  const betaOnly: CompliancePolicyConfig[] = [];
  const evaluatedFrameworks = new Map<
    string,
    { framework: PostureFramework; level: PostureLevel | null; counted: boolean }
  >();
  const reachedLevels: Array<PostureLevel | null> = [];
  facts.push({ label: c.facts.policies, value: String(own.length) });
  // Die Android-Kachel bewertet das Arbeitsprofil-Framework; vollständig verwaltet ist nur beta
  if (platform === 'android')
    facts.push({ label: t.androidFrameworkFact, value: t.androidFrameworkValue });

  for (const policy of own) {
    const handling = complianceHandling(policy);
    const ref = { id: policy.id, name: policy.displayName, assigned: policy.assigned };
    if (handling.kind === 'noTarget') {
      noTarget.push(policy);
      facts.push({ label: c.policyFact(policyLabel(ref)), value: c.valueNoTarget });
      continue;
    }
    if (handling.kind === 'betaOnly') {
      betaOnly.push(policy);
      checks.push({
        id: `${id}:betaType:${policy.id}`,
        tile: id,
        label: t.betaTypeLabel,
        status: 'notChecked',
        level: null,
        actual: t.betaTypeActual(policy.odataType),
        expected: t.betaTypeExpected,
        docsUrl:
          platform === 'android'
            ? Docs.postureAndroidFullyManaged
            : Docs.postureIosComplianceLevel2,
        subject: policy.displayName,
        reason: t.betaTypeReason,
        counted: policy.assigned !== false,
      });
      facts.push({ label: c.policyFact(policyLabel(ref)), value: c.valueNotChecked });
      continue;
    }
    const { framework } = handling;
    const evaluation = evaluateFramework(
      framework,
      { settings: policy.settings, scheduledActions: policy.scheduledActions },
      options.level,
    );
    evaluatedFrameworks.set(framework.id, {
      framework,
      level: evaluation.effectiveLevel,
      counted:
        (evaluatedFrameworks.get(framework.id)?.counted ?? false) || policy.assigned !== false,
    });
    const results = policyCheckResults(id, ref, evaluation);
    checks.push(...results);
    if (policy.assigned !== false) reachedLevels.push(evaluation.reached);
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
    if (outcome.finding) findings.push(outcome.finding);
  }

  for (const { framework, level, counted } of evaluatedFrameworks.values()) {
    const uncheckable = uncheckableOutcome(id, framework, level, source, counted);
    checks.push(...uncheckable.checks);
    if (uncheckable.finding) findings.push(uncheckable.finding);
    const fact = levelFact(framework, options.level);
    if (fact) facts.unshift(fact);
  }
  if (noTarget.length > 0) findings.push(noTargetFinding(id, platform, noTarget, source));
  if (betaOnly.length > 0) {
    findings.push({
      id: `${id}-betaOnly`,
      severity: 'unknown',
      title: t.betaTypeTitle(betaOnly.length),
      detail: t.betaTypeDetail(betaOnly.map((policy) => `„${policy.displayName}“`)),
      cause: t.betaTypeCause,
      remediation: [...t.betaTypeRemediation],
      evidence: { odataTypes: betaOnly.map((policy) => policy.odataType ?? '').join(', ') },
      source,
      docsUrl:
        platform === 'android' ? Docs.postureAndroidFullyManaged : Docs.postureIosComplianceLevel2,
    });
  }

  const counts = countChecks(checks);
  const leveled = [...evaluatedFrameworks.values()].find((entry) => entry.level !== null);
  const allReached =
    leveled?.level != null &&
    reachedLevels.length > 0 &&
    counts.deviating === 0 &&
    reachedLevels.every(
      (reached) => reached !== null && reached >= (leveled.level as PostureLevel),
    );
  const value =
    evaluatedFrameworks.size === 0
      ? noTarget.length > 0 && betaOnly.length === 0
        ? c.valueNoTarget
        : c.valueNotChecked
      : allReached
        ? c.valueLevel(leveled.level as PostureLevel, counts.notChecked === 0)
        : valueOfChecks(checks);
  return buildTile({
    id,
    value,
    summary:
      checks.length > 0
        ? t.summaryPolicies(own.length, summaryOfChecks(checks))
        : t.summaryPolicies(own.length, null),
    findings,
    facts,
    sources,
    checks,
  });
}
