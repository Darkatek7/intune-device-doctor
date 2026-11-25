/**
 * Kachel „Sicherheitsbaselines“ (Beta-API, freigegebene Ausnahme M21).
 *
 * Prüfungen:
 * 1. Windows-Geräte vorhanden → mindestens eine zugewiesene Baseline für `windows10` (Zero Trust für
 *    Geräte: „Security baselines are applied to Windows devices“).
 * 2. Je Baseline: Vorlagenversion aktuell (`lifecycleState` der Vorlage = `active`). Learn: „We recommend
 *    updating older baseline versions to the latest version as soon as it's practical“.
 * 3. Je Baseline: Einstellungen entsprechen den Standardwerten der Vorlage. Learn: „The default presets
 *    found in a baseline represent the recommended security posture“ – zugleich „reconfigure a default
 *    preset when your business needs require“ → Abweichung ist ein Prüfpunkt, kein Fehler.
 * Severity: alle Abweichungen → warning; nicht zugewiesene Baselines → Hinweis, nicht gezählt.
 * Englische Einstellungsnamen und Werte bleiben unverändert (`lang="en"`).
 */
import type {
  BaselineComparisonInfo,
  CatalogPolicyConfig,
  TenantPosture,
} from '../../domain/posture';
import type { Finding, FindingTable, TileFact } from '../../domain/types';
import { dePosture } from '../../i18n/de-posture';
import { summaryForIssue } from '../helpers';
import { Docs } from '../knowledge/docs';
import { buildTile, deviceCount, issueTile, policyLabel, truncatedFinding } from './kit';
import type { CheckOutcome, PostureCheckResult, PostureTile } from './types';

const t = dePosture.baselines;
const c = dePosture.common;
const ID = 'postureBaselines' as const;

/** `platforms` ist eine Flag-Aufzählung (z. B. `windows10` oder `windows10,macOS`). */
export function hasPlatform(platforms: string | null, platform: 'windows10' | 'macOS'): boolean {
  if (!platforms) return false;
  return platforms
    .split(/[,\s]+/)
    .some((part) => part.trim().toLowerCase() === platform.toLowerCase());
}

const OUTDATED_STATES = ['superseded', 'deprecated', 'retired'];

function versionOutcome(
  policy: CatalogPolicyConfig,
  templates: TenantPosture['policyTemplates'],
): CheckOutcome {
  if (templates.status !== 'ok' || !policy.templateId) {
    return {
      status: 'notChecked',
      actual: policy.templateDisplayVersion ?? c.notDelivered,
      reason: templates.status !== 'ok' ? summaryForIssue(templates) : t.versionUnknownReason,
    };
  }
  const template = templates.data.templates.find((entry) => entry.id === policy.templateId);
  const state = template?.lifecycleState ?? null;
  if (!template || !state) {
    return {
      status: 'notChecked',
      actual: policy.templateDisplayVersion ?? c.notDelivered,
      reason: t.versionUnknownReason,
    };
  }
  const actual = t.versionActual(
    template.displayVersion ?? policy.templateDisplayVersion,
    t.lifecycle[state] ?? state,
  );
  if (state === 'active') return { status: 'met', actual };
  if (OUTDATED_STATES.includes(state)) return { status: 'deviating', actual };
  return { status: 'notChecked', actual, reason: t.versionUnknownReason };
}

function deviationTable(info: BaselineComparisonInfo): FindingTable {
  const col = t.defaultsColumns;
  return {
    columns: [col.setting, col.configured, col.default],
    // Einstellungsnamen und Werte sind Microsoft-Originalwerte (englisch)
    columnLangs: ['en', 'en', 'en'],
    rows: info.deviations.map((deviation) => ({
      cells: [
        deviation.settingName ?? deviation.settingDefinitionId,
        deviation.configuredValue ?? t.missingValue,
        deviation.defaultValue ?? c.notDelivered,
      ],
      cellLangs: [
        'en',
        deviation.configuredValue === null ? null : 'en',
        deviation.defaultValue === null ? null : 'en',
      ],
    })),
  };
}

export function evaluateBaselines(posture: TenantPosture): PostureTile {
  const section = posture.catalogPolicies;
  if (section.status !== 'ok') return issueTile(ID, section);
  const source = section.source;
  const sources = [source, posture.policyTemplates.source, posture.platformCounts.source];
  const { truncated } = section.data;
  const baselines = section.data.policies.filter((policy) => policy.templateFamily === 'baseline');
  const findings: Finding[] = truncated ? [truncatedFinding(ID, source)] : [];
  const facts: TileFact[] = [{ label: c.betaFact, value: c.betaValue }];
  const checks: PostureCheckResult[] = [];

  // 1. Windows-Baseline zugewiesen
  const windowsDevices = deviceCount(posture.platformCounts, 'windows');
  if (windowsDevices !== 0) {
    const windows = baselines.filter((policy) => hasPlatform(policy.platforms, 'windows10'));
    const assigned = windows.filter((policy) => policy.isAssigned === true);
    let outcome: CheckOutcome;
    if (assigned.length > 0) outcome = { status: 'met', actual: t.actualAssigned(assigned.length) };
    else if (windows.some((policy) => policy.isAssigned === null)) {
      outcome = {
        status: 'notChecked',
        actual: dePosture.coverage.actualUnknown(windows.length),
        reason: dePosture.coverage.assignmentUnknownReason,
      };
    } else if (truncated) {
      outcome = { status: 'notChecked', actual: t.actualNone, reason: c.noPolicyInList };
    } else {
      outcome = {
        status: 'deviating',
        actual: windows.length > 0 ? t.actualUnassigned(windows.length) : t.actualNone,
      };
    }
    checks.push({
      id: `${ID}:windows`,
      tile: ID,
      label: t.windowsLabel,
      status: outcome.status,
      level: null,
      actual: outcome.actual,
      expected: t.windowsExpected,
      docsUrl: Docs.postureZtBaselines,
      ...(outcome.reason ? { reason: outcome.reason } : {}),
      counted: true,
    });
    if (outcome.status === 'deviating') {
      findings.push({
        id: `${ID}-windows`,
        severity: 'warning',
        title: t.windowsTitle,
        detail: t.windowsDetail,
        cause: t.windowsCause,
        remediation: [...t.windowsRemediation],
        evidence: { baselines: windows.length, assigned: 0 },
        source,
        docsUrl: Docs.postureZtBaselines,
      });
    }
  }

  // 2./3. Je Baseline: Version und Standardwerte
  for (const policy of baselines) {
    const name = policy.name || t.noName;
    const ref = { id: policy.id, name, assigned: policy.isAssigned };
    const counted = policy.isAssigned !== false;
    facts.push({
      label: c.policyFact(policyLabel(ref)),
      value:
        [policy.templateDisplayName, policy.templateDisplayVersion].filter(Boolean).join(' · ') ||
        '–',
    });

    const version = versionOutcome(policy, posture.policyTemplates);
    checks.push({
      id: `${ID}:version:${policy.id}`,
      tile: ID,
      label: t.versionLabel(name),
      status: version.status,
      level: null,
      actual: version.actual,
      expected: t.versionExpected,
      docsUrl: Docs.postureBaselineVersions,
      subject: name,
      ...(version.reason ? { reason: version.reason } : {}),
      counted,
    });
    if (version.status === 'deviating') {
      findings.push({
        id: `${ID}-version-${policy.id}`,
        severity: counted ? 'warning' : 'unknown',
        title: t.versionTitle(name),
        detail: t.versionDetail,
        cause: t.versionCause,
        remediation: [...t.versionRemediation],
        evidence: {
          templateId: policy.templateId,
          templateDisplayVersion: policy.templateDisplayVersion,
          assigned: policy.isAssigned,
        },
        source: posture.policyTemplates.source,
        docsUrl: Docs.postureBaselineVersions,
      });
    }

    let defaults: CheckOutcome;
    const comparison = policy.comparison;
    if (comparison === null) {
      defaults = {
        status: 'notChecked',
        actual: t.defaultsNotCompared,
        reason: t.defaultsNotCompared,
      };
    } else if (comparison.status !== 'ok') {
      const reason = summaryForIssue(comparison);
      defaults = { status: 'notChecked', actual: reason, reason };
    } else {
      const info = comparison.data;
      facts.push({
        label: t.comparedFact(name),
        value: t.comparedValue(info.comparedCount),
      });
      if (info.skippedCount > 0) {
        facts.push({ label: t.skippedFact, value: String(info.skippedCount) });
      }
      if (info.deviations.length === 0) {
        defaults = { status: 'met', actual: t.defaultsActualMet(info.comparedCount) };
      } else {
        defaults = {
          status: 'deviating',
          actual: t.defaultsActualDeviating(info.deviations.length, info.comparedCount),
        };
        findings.push({
          id: `${ID}-defaults-${policy.id}`,
          severity: counted ? 'warning' : 'unknown',
          title: t.defaultsTitle(name, info.deviations.length),
          detail: [t.defaultsDetail, counted ? null : t.unassignedDetail].filter(Boolean).join(' '),
          cause: t.defaultsCause,
          remediation: [...t.defaultsRemediation],
          table: deviationTable(info),
          evidence: {
            comparedCount: info.comparedCount,
            skippedCount: info.skippedCount,
            truncated: info.truncated,
          },
          source: comparison.source,
          docsUrl: Docs.postureBaselineDefaults,
        });
      }
    }
    checks.push({
      id: `${ID}:defaults:${policy.id}`,
      tile: ID,
      label: t.defaultsLabel(name),
      status: defaults.status,
      level: null,
      actual: defaults.actual,
      expected: t.defaultsExpected,
      docsUrl: Docs.postureBaselineDefaults,
      subject: name,
      ...(defaults.reason ? { reason: defaults.reason } : {}),
      counted,
    });
  }

  const unassigned = baselines.filter((policy) => policy.isAssigned === false);
  if (unassigned.length > 0) {
    findings.push({
      id: `${ID}-unassigned`,
      severity: 'unknown',
      title: t.unassignedTitle(unassigned.map((policy) => `„${policy.name || t.noName}“`)),
      detail: t.unassignedDetail,
      cause: t.unassignedCause,
      remediation: [...t.unassignedRemediation],
      source,
      docsUrl: Docs.postureBaselineVersions,
    });
  }

  return buildTile({
    id: ID,
    summary:
      baselines.length === 0
        ? `${t.summaryNone} · ${c.beta}`
        : `${t.value(baselines.length)} · ${c.beta}`,
    findings,
    facts,
    sources,
    checks,
  });
}
