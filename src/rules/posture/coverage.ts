/**
 * Kachel „Abdeckung der Geräte“: Jede Gerätegruppe mit verwalteten Geräten hat mindestens eine
 * **zugewiesene** Compliance-Richtlinie (Zero-Trust-Empfehlungen für Intune-Mandanten, „Compliance
 * policies protect … devices“).
 *
 * Gerätegruppen = die getrennten Learn-Empfehlungen: Windows, macOS, iOS/iPadOS und Android **zweimal**
 * („fully managed and corporate-owned“ bzw. „personally owned“):
 * - Android persönlich (`androidPersonal`) → zugewiesene Richtlinie vom Typ `androidWorkProfile`.
 * - Android unternehmenseigen (`androidCorporate`) → zugewiesene Richtlinie mit `@odata.type`
 *   `#microsoft.graph.androidDeviceOwnerCompliancePolicy`. Dieser Typ ist nur in beta dokumentiert (kommt
 *   als `type: 'other'`). Wird keine zugewiesene gefunden, ist das **keine** Abweichung, sondern nicht
 *   prüfbar – über v1.0 ist nicht sicher lesbar, ob es solche Richtlinien gibt.
 * - Android-Geräteadministrator gehört zu keiner Learn-Empfehlung (kein Android Enterprise) → keine Prüfung.
 *
 * Severity: Gruppe mit Geräten ohne zugewiesene Richtlinie → `critical`. Begründung: Die Learn-Seite
 * nennt genau diese Lücke ausdrücklich als Risiko („If compliance policies … aren't configured and
 * assigned, threat actors can exploit unmanaged or noncompliant endpoints …“, Docs.postureCoverage*).
 * Windows zählt nur Richtlinien „Windows 10 und neuer“ (ältere Windows-Typen gelten nicht für diese Geräte).
 * Gruppe ohne Geräte → „nicht genutzt“, keine Prüfung. Geräteanzahl unbekannt → nicht prüfbar.
 */
import type {
  CompliancePolicyConfig,
  PlatformDeviceCounts,
  TenantPosture,
} from '../../domain/posture';
import type { Finding, TileFact } from '../../domain/types';
import { dePosture } from '../../i18n/de-posture';
import { sectionIssueFinding } from '../helpers';
import { Docs } from '../knowledge/docs';
import {
  buildTile,
  compliancePolicyPlatform,
  issueTile,
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

/** Eine Learn-Empfehlung „Compliance policies protect … devices“. */
export type CoverageGroup = 'windows' | 'ios' | 'androidCorporate' | 'androidPersonal' | 'macos';

export const COVERAGE_GROUPS: readonly CoverageGroup[] = [
  'windows',
  'ios',
  'androidCorporate',
  'androidPersonal',
  'macos',
];

const GROUP_DOCS: Record<CoverageGroup, string> = {
  windows: Docs.postureCoverageWindows,
  ios: Docs.postureCoverageIos,
  androidCorporate: Docs.postureCoverageAndroidCorporate,
  androidPersonal: Docs.postureCoverageAndroid,
  macos: Docs.postureCoverageMacos,
};

/** Nur in beta mit Einstellungen dokumentiert; v1.0 liefert ihn – wenn überhaupt – als `type: 'other'`. */
export const ANDROID_DEVICE_OWNER_TYPE = '#microsoft.graph.androidDeviceOwnerCompliancePolicy';

/** Richtlinien, die Geräte der Gruppe abdecken können. */
export function coveringPolicies(
  policies: readonly CompliancePolicyConfig[],
  group: CoverageGroup,
): CompliancePolicyConfig[] {
  switch (group) {
    case 'windows':
      return policies.filter((policy) => policy.type === 'windows10');
    case 'androidPersonal':
      return policies.filter((policy) => policy.type === 'androidWorkProfile');
    case 'androidCorporate':
      return policies.filter(
        (policy) => policy.odataType?.toLowerCase() === ANDROID_DEVICE_OWNER_TYPE.toLowerCase(),
      );
    case 'ios':
    case 'macos':
      return policies.filter((policy) => compliancePolicyPlatform(policy) === group);
  }
}

/** Geräte der Gruppe: Zahl oder null (nicht geliefert). Android-Gesamtzahl 0 → beide Gruppen 0. */
function groupDevices(counts: PlatformDeviceCounts, group: CoverageGroup): number | null {
  if (group === 'androidPersonal' || group === 'androidCorporate') {
    return counts.android === 0 ? 0 : counts[group];
  }
  return counts[group];
}

function coverageOutcome(
  group: CoverageGroup,
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
  const actual = covering.length > 0 ? t.actualUnassigned(covering.length) : t.actualNone;
  // Vollständig verwaltet/unternehmenseigen: Richtlinientyp nur in beta → Fehlen ist keine Abweichung
  if (group === 'androidCorporate') {
    return { status: 'notChecked', actual, reason: t.corporateBetaReason };
  }
  if (truncated) {
    return { status: 'notChecked', actual, reason: dePosture.common.noPolicyInList };
  }
  return { status: 'deviating', actual };
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
  const counts = countsSection.data;
  const source = policiesSection.source;
  const checks: PostureCheckResult[] = [];
  const findings: Finding[] = truncated ? [truncatedFinding(ID, source)] : [];
  const facts: TileFact[] = [];
  let used = 0;

  for (const group of COVERAGE_GROUPS) {
    const name = t.groups[group];
    const devices = groupDevices(counts, group);
    const covering = coveringPolicies(policies, group);
    facts.push({
      label: t.deviceFact(name),
      value:
        devices === 0 && covering.length === 0
          ? t.notUsedFact
          : t.deviceFactValue(devices, covering.length),
    });
    if (devices === 0) continue;
    used += 1;
    const outcome = coverageOutcome(group, devices, covering, truncated);
    checks.push({
      id: `${ID}:${group}`,
      tile: ID,
      label: t.checkLabel(name),
      status: outcome.status,
      level: null,
      actual: outcome.actual,
      expected: group === 'androidCorporate' ? t.expectedCorporate : t.expected,
      docsUrl: GROUP_DOCS[group],
      ...(outcome.reason ? { reason: outcome.reason } : {}),
      counted: true,
    });
    if (outcome.status === 'deviating' && devices !== null) {
      findings.push({
        id: `${ID}-missing-${group}`,
        severity: 'critical',
        title: t.missingTitle(name, devices),
        detail:
          group === 'windows'
            ? `${t.missingDetail} ${t.windowsNote}`
            : group === 'androidPersonal'
              ? `${t.missingDetail} ${t.androidPersonalNote}`
              : t.missingDetail,
        cause: t.missingCause,
        remediation: [...t.missingRemediation],
        evidence: {
          group,
          managedDevices: devices,
          policies: covering.length,
          assignedPolicies: 0,
        },
        source,
        docsUrl: GROUP_DOCS[group],
      });
    }
    if (group === 'androidCorporate' && outcome.status === 'notChecked' && devices !== null) {
      findings.push({
        id: `${ID}-androidCorporate-beta`,
        severity: 'unknown',
        title: t.corporateBetaTitle(devices),
        detail: t.corporateBetaDetail,
        cause: t.corporateBetaCause,
        remediation: [...t.corporateBetaRemediation],
        evidence: { managedDevices: devices, policies: covering.length },
        source,
        docsUrl: GROUP_DOCS[group],
      });
    }
  }
  // Android gesamt (inkl. Geräteadministrator, der zu keiner Learn-Empfehlung gehört)
  if (counts.android !== null && counts.android > 0) {
    facts.push({ label: t.androidTotalFact, value: t.androidTotalValue(counts.android) });
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
