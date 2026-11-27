/**
 * Kacheln „Compliance: Windows | iOS/iPadOS | Android | macOS“: jede Compliance-Richtlinie einzeln gegen
 * das passende Microsoft-Framework (nicht zusammengeführt – welche Richtlinie für ein Gerät gilt, hängt
 * von den Zuweisungen ab).
 *
 * - Windows 10 und neuer → Zero-Trust-Tabelle (ungestuft); andere Windows-Typen → kein Sollwert.
 * - iOS/iPadOS → Sicherheitskonfiguration Stufe 2/3 (Stufe 1 bietet Microsoft nicht an → Stufe 2).
 * - Android: bis zu **zwei** Frameworks – „persönliches Gerät mit Arbeitsprofil“ (Stufe 2/3, v1.0) und
 *   „vollständig verwaltet“ (Stufe 1–3; Typ `androidDeviceOwner`, Einstellungen aus der Beta-Liste,
 *   dritte freigegebene Beta-Ausnahme 2026-11-27 → Kachel als Beta gekennzeichnet). Der Graph-Typ gilt
 *   auch für dedizierte Geräte und unternehmenseigene Geräte mit Arbeitsprofil – die Kachel weist das aus.
 *   Android-Geräteadministrator → kein Sollwert (Verwaltung von Microsoft eingestellt). `type: 'other'`
 *   mit Android-Typ (anderer Beta-Typ wie AOSP, oder Beta-Liste nicht lesbar) → nicht prüfbar, mit dem
 *   zutreffenden Grund. Ob unternehmenseigene Geräte überhaupt abgedeckt sind, bewertet die Kachel
 *   „Abdeckung der Geräte“ getrennt.
 * - „Stufe N erreicht“: nur, wenn alle bewerteten Frameworks der Kachel gegen dieselbe Stufe bewertet
 *   werden und jede gezählte Richtlinie sie erreicht (Arbeitsprofil kennt keine Stufe 1 – bei Stufe 1
 *   gilt dort Stufe 2; dann zeigt die Kachel den Zählwert). Nicht prüfbare Empfehlungen verhindern die
 *   Stufe nicht und bestätigen sie nicht – gibt es welche, lautet der Wert „Stufe N erreicht, soweit prüfbar“.
 * - macOS → Microsoft dokumentiert keinen Sollwert; nur Abdeckung (eigene Kachel).
 * - Richtlinien, deren Typ keiner Plattform zuzuordnen ist (weder v1.0 noch die Beta-Liste weisen einen
 *   passenden Typ aus, oder die Beta-Liste war nicht lesbar): Sie verschwinden nicht. Hat eine Plattform
 *   keine eigene Richtlinie, lautet die Kachel „Nicht prüfbar“ statt „Keine Richtlinie“ und nennt sie;
 *   sonst stehen sie als Fakt dabei.
 * Plattform ohne Geräte und ohne Richtlinie → „Nicht genutzt“ (kein Befund).
 */
import type {
  CompliancePolicyConfig,
  CompliancePolicyConfigList,
  PostureLevel,
  TenantPosture,
} from '../../domain/posture';
import type { DataSource, Finding, TileFact, TileId } from '../../domain/types';
import { dePosture } from '../../i18n/de-posture';
import { Docs } from '../knowledge/docs';
import { COVERAGE_DOCS } from './coverage';
import {
  ANDROID_FULLY_MANAGED_COMPLIANCE,
  ANDROID_WORK_PROFILE_COMPLIANCE,
  IOS_COMPLIANCE,
  WINDOWS_COMPLIANCE,
} from './catalog';
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
    // Einstellungen aus der Beta-Liste (androidDeviceOwnerCompliancePolicy)
    case 'androidDeviceOwner':
      return { kind: 'framework', framework: ANDROID_FULLY_MANAGED_COMPLIANCE };
    case 'androidDeviceAdministrator':
    case 'macos':
      return { kind: 'noTarget' };
    case 'other': {
      const platform = compliancePolicyPlatform(policy);
      // Android-/iOS-Typ ohne Einstellungen: anderer Beta-Typ (z. B. AOSP) oder Beta-Liste nicht lesbar
      return platform === 'android' || platform === 'ios'
        ? { kind: 'betaOnly' }
        : { kind: 'noTarget' };
    }
  }
}

/** Zustand der Beta-Liste der Compliance-Richtlinien (nur gelesen, wenn v1.0 Richtlinien ohne Typ liefert). */
type BetaState = 'notRead' | 'failed' | 'truncated' | 'ok';

function betaState(list: CompliancePolicyConfigList): BetaState {
  const read = list.betaRead;
  if (!read) return 'notRead';
  if (read.status === 'failed') return 'failed';
  return read.truncated ? 'truncated' : 'ok';
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
  const own = section.data.policies.filter(
    (policy) => compliancePolicyPlatform(policy) === platform,
  );
  // Typ ohne erkennbare Plattform: könnte zu jeder Plattform gehören – weder zählen noch verschweigen.
  const unclassified = section.data.policies.filter(
    (policy) => compliancePolicyPlatform(policy) === null,
  );
  const unclassifiedNames = unclassified.map((policy) => `„${policy.displayName}“`);
  const truncated = section.data.truncated;

  // Beta-Liste: Zustand, Kennzeichnung und Quelle
  const betaRead = section.data.betaRead;
  const beta = betaState(section.data);
  const shown = [...own, ...unclassified];
  // Als Beta gekennzeichnet wird nur, was tatsächlich Daten aus der Beta-Liste zeigt
  const usesBeta =
    own.some((policy) => policy.beta === true) ||
    (own.length === 0 && unclassified.some((policy) => policy.beta === true));
  // Richtlinien, deren Typ/Einstellungen von der Beta-Liste abhängen (aufgewertet oder offen geblieben)
  const dependsOnBeta = shown.some((policy) => policy.beta === true || policy.type === 'other');
  const sources = [
    source,
    posture.platformCounts.source,
    ...(betaRead && (usesBeta || dependsOnBeta) ? [betaRead.source] : []),
  ];
  const withBeta = (summary: string) => (usesBeta ? `${summary} · ${c.beta}` : summary);
  const betaFacts: TileFact[] = [
    ...(usesBeta ? [{ label: c.betaFact, value: c.betaValue }] : []),
    ...((beta === 'failed' || beta === 'truncated') && dependsOnBeta
      ? [{ label: t.betaReadFact, value: t.betaReadValue[beta] }]
      : []),
  ];

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
        sources: [source, posture.platformCounts.source],
        checks: [],
        fallback: 'unknown',
      });
    }
    if (unclassified.length > 0) {
      findings.push({
        id: `${id}-unclassified`,
        severity: 'unknown',
        title: t.unclassifiedTitle(unclassified.length),
        detail: [t.unclassifiedDetail(unclassifiedNames), t.unclassifiedBetaNote[beta]]
          .filter(Boolean)
          .join(' '),
        cause: t.unclassifiedCause[beta],
        remediation: [
          ...(beta === 'failed' ? t.betaFailedRemediation : []),
          ...t.unclassifiedRemediation,
        ],
        evidence: {
          odataTypes: unclassified
            .map((policy) => policy.odataType ?? t.unclassifiedNoType)
            .join(', '),
          ...(beta === 'notRead' ? {} : { betaList: beta }),
        },
        source: beta === 'failed' && betaRead ? betaRead.source : source,
        docsUrl: COVERAGE_DOCS[platform],
      });
      facts.push({ label: t.unclassifiedFact, value: unclassifiedNames.join(', ') }, ...betaFacts);
      return buildTile({
        id,
        value: c.valueNotChecked,
        summary: withBeta(t.unclassifiedTitle(unclassified.length)),
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
  const policyFacts: TileFact[] = [];

  for (const policy of own) {
    const handling = complianceHandling(policy);
    const ref = { id: policy.id, name: policy.displayName, assigned: policy.assigned };
    if (handling.kind === 'noTarget') {
      noTarget.push(policy);
      policyFacts.push({ label: c.policyFact(policyLabel(ref)), value: c.valueNoTarget });
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
        // Die Beta-Liste nennt einen anderen Typ → der Zustand der Liste ist nicht der Grund
        reason: t.betaTypeReason[policy.beta === true ? 'otherType' : beta],
        counted: policy.assigned !== false,
      });
      policyFacts.push({ label: c.policyFact(policyLabel(ref)), value: c.valueNotChecked });
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
    policyFacts.push(outcome.fact);
    if (outcome.finding) {
      findings.push(
        policy.type === 'androidDeviceOwner'
          ? { ...outcome.finding, detail: `${outcome.finding.detail} ${t.deviceOwnerScopeNote}` }
          : outcome.finding,
      );
    }
  }

  const frameworks = [...evaluatedFrameworks.values()];
  for (const { framework, level, counted } of frameworks) {
    const uncheckable = uncheckableOutcome(
      id,
      framework,
      level,
      source,
      counted,
      // Zwei Frameworks auf einer Kachel (Android): je Framework ein eigener Befund
      frameworks.length > 1 ? `${id}-uncheckable-${framework.id}` : undefined,
    );
    checks.push(...uncheckable.checks);
    if (uncheckable.finding) findings.push(uncheckable.finding);
  }
  if (noTarget.length > 0) findings.push(noTargetFinding(id, platform, noTarget, source));
  if (betaOnly.length > 0) {
    // Zustand der Beta-Liste zählt nur für Richtlinien, die sie nicht aufgewertet hat
    const open = betaOnly.some((policy) => policy.beta !== true);
    const state: BetaState = open ? beta : 'ok';
    findings.push({
      id: `${id}-betaOnly`,
      severity: 'unknown',
      title: t.betaTypeTitle(betaOnly.length),
      detail: [
        t.betaTypeDetail(betaOnly.map((policy) => `„${policy.displayName}“`)),
        t.betaTypeDetailNote[state],
      ]
        .filter(Boolean)
        .join(' '),
      cause: t.betaTypeCause[state],
      remediation: [
        ...(state === 'failed' ? t.betaFailedRemediation : []),
        ...t.betaTypeManualRemediation,
      ],
      evidence: {
        odataTypes: betaOnly.map((policy) => policy.odataType ?? '').join(', '),
        ...(beta === 'notRead' ? {} : { betaList: beta }),
      },
      source: state === 'failed' && betaRead ? betaRead.source : source,
      docsUrl:
        platform === 'android' ? Docs.postureAndroidFullyManaged : Docs.postureIosComplianceLevel2,
    });
  }

  // Fakten: Stufe(n) zuerst, dann Überblick, dann je Richtlinie
  const levelFacts = frameworks.flatMap(({ framework }) => {
    const fact = levelFact(framework, options.level);
    return fact ? [{ framework, fact }] : [];
  });
  const firstLevelFact = levelFacts[0]?.fact;
  // Gleiche Stufe für alle Frameworks → ein Fakt; sonst je Framework einer mit eigener Bezeichnung
  const headFacts: TileFact[] = !firstLevelFact
    ? []
    : levelFacts.every(({ fact }) => fact.value === firstLevelFact.value)
      ? [firstLevelFact]
      : levelFacts.map(({ framework, fact }) => ({
          ...fact,
          label: c.facts.levelFor(t.frameworkShort[framework.id] ?? framework.id),
        }));
  const overview: TileFact[] = [{ label: c.facts.policies, value: String(own.length) }];
  if (unclassified.length > 0)
    overview.push({ label: t.unclassifiedFact, value: unclassifiedNames.join(', ') });
  // Android bewertet bis zu zwei Frameworks – die Kachel nennt, welche tatsächlich bewertet wurden
  if (platform === 'android' && frameworks.length > 0) {
    overview.push({
      label: t.frameworksFact(frameworks.length),
      value: frameworks
        .map(({ framework }) => t.frameworkNames[framework.id] ?? framework.id)
        .join(' · '),
    });
  }
  if (own.some((policy) => policy.type === 'androidDeviceOwner'))
    overview.push({ label: t.deviceOwnerScopeFact, value: t.deviceOwnerScopeNote });
  facts.unshift(...headFacts);
  facts.push(...overview, ...betaFacts, ...policyFacts);

  // „Stufe N erreicht“ nur, wenn alle bewerteten Frameworks (auch die nur nicht zugewiesener Richtlinien)
  // gegen dieselbe Stufe bewertet werden und jede gezählte Richtlinie sie erreicht
  const counts = countChecks(checks);
  const frameworkLevels = frameworks.map((entry) => entry.level);
  const commonLevel =
    frameworkLevels.length > 0 && frameworkLevels.every((level) => level === frameworkLevels[0])
      ? (frameworkLevels[0] ?? null)
      : null;
  const allReached =
    commonLevel !== null &&
    reachedLevels.length > 0 &&
    counts.deviating === 0 &&
    reachedLevels.every((reached) => reached !== null && reached >= commonLevel);
  const value =
    evaluatedFrameworks.size === 0
      ? noTarget.length > 0 && betaOnly.length === 0
        ? c.valueNoTarget
        : c.valueNotChecked
      : allReached
        ? c.valueLevel(commonLevel, counts.notChecked === 0)
        : valueOfChecks(checks);
  return buildTile({
    id,
    value,
    summary: withBeta(
      checks.length > 0
        ? t.summaryPolicies(own.length, summaryOfChecks(checks))
        : t.summaryPolicies(own.length, null),
    ),
    findings,
    facts,
    sources,
    checks,
  });
}
