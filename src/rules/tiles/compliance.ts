/**
 * Compliance: Gesamtstatus des Geräts (complianceState) + Befunde je nicht konformer Richtlinie.
 */
import { formatDate, formatDateTime, formatRelativeTime } from '../../domain/format';
import type {
  DeviceSnapshot,
  Finding,
  PolicyStateInfo,
  Severity,
  Tile,
  TileFact,
} from '../../domain/types';
import type { ComplianceState } from '../../graph/dto';
import { de } from '../../i18n/de';
import {
  availabilityOf,
  loadingTile,
  sectionIssueFinding,
  sectionsLoaded,
  sortFindings,
  uniqueSources,
} from '../helpers';
import { Docs } from '../knowledge/docs';
import { settingLabel } from './policySettings';

const t = de.rules.compliance;
const f = de.rules.facts;

const STATE_SEVERITY: Record<ComplianceState, Severity> = {
  compliant: 'ok',
  inGracePeriod: 'warning',
  noncompliant: 'critical',
  error: 'critical',
  conflict: 'critical',
  unknown: 'unknown',
  configManager: 'unknown',
};

const BAD_POLICY_STATES = new Set(['nonCompliant', 'error', 'conflict']);

export function evaluateCompliance(snapshot: DeviceSnapshot, now: Date): Tile {
  const sections: Tile['sections'] = ['compliancePolicies'];
  if (!sectionsLoaded(snapshot, sections)) return loadingTile('compliance', sections);
  const { device } = snapshot;
  const policiesSection = snapshot.compliancePolicies!;
  const state = device.complianceState;
  const severity = STATE_SEVERITY[state];
  const findings: Finding[] = [];
  const facts: TileFact[] = [{ label: f.complianceState, value: t.value[state] ?? state }];
  const grace = device.complianceGracePeriodExpirationDateTime;

  if (state === 'inGracePeriod' && grace) {
    facts.push({
      label: f.gracePeriodEnds,
      value: formatDateTime(grace),
      title: formatRelativeTime(grace, now),
    });
  }

  if (state !== 'compliant') {
    const cause =
      state === 'inGracePeriod'
        ? t.graceCause
        : state === 'conflict'
          ? t.conflictCause
          : state === 'error'
            ? t.errorCause
            : state === 'configManager'
              ? t.configManagerCause
              : state === 'unknown'
                ? t.unknownCause
                : t.noncompliantCause;
    const remediation =
      state === 'inGracePeriod' && grace
        ? t.remediationGrace(formatDate(grace))
        : state === 'unknown'
          ? [...t.remediationUnknown]
          : state === 'configManager'
            ? [...t.remediationConfigManager]
            : [...t.remediationCommon];
    findings.push({
      id: `compliance-state-${state}`,
      severity,
      title: t.stateTitle[state] ?? t.stateDetail(state),
      detail:
        state === 'inGracePeriod' && grace
          ? t.graceDetail(formatDateTime(grace), formatRelativeTime(grace, now))
          : state === 'noncompliant'
            ? `${t.stateDetail(state)} ${t.validityHint}`
            : t.stateDetail(state),
      cause,
      remediation,
      evidence: { complianceState: state, complianceGracePeriodExpirationDateTime: grace },
      source: device.source,
      docsUrl:
        state === 'error'
          ? Docs.complianceErrorState
          : state === 'configManager'
            ? Docs.coManagement
            : state === 'conflict'
              ? Docs.complianceStateEnum
              : Docs.complianceMonitor,
    });
  }

  let summary: string;
  if (policiesSection.status === 'ok') {
    const policies = policiesSection.data;
    const bad = policies.filter((p) => BAD_POLICY_STATES.has(p.state));
    facts.push({ label: f.policiesEvaluated, value: String(policies.length) });
    for (const policy of bad)
      findings.push(
        policyFinding(policy, severity === 'ok' ? 'warning' : severity, policiesSection.source),
      );
    summary =
      state === 'inGracePeriod' && grace
        ? t.summaryGrace(formatDate(grace))
        : policies.length === 0
          ? t.summaryNoPolicies
          : t.summaryPolicies(bad.length, policies.length);
  } else {
    findings.push(sectionIssueFinding('compliance-policies', policiesSection));
    summary =
      state === 'inGracePeriod' && grace
        ? t.summaryGrace(formatDate(grace))
        : de.availability[policiesSection.status];
  }

  return {
    id: 'compliance',
    title: de.tiles.compliance,
    state: 'ready',
    severity,
    value: t.value[state] ?? state,
    summary,
    findings: sortFindings(findings),
    sources: uniqueSources([device.source, policiesSection.source]),
    facts,
    availability: availabilityOf(policiesSection),
    sections,
  };
}

function policyFinding(
  policy: PolicyStateInfo,
  severity: Severity,
  source: Finding['source'],
): Finding {
  const badSettings = policy.settings.filter((s) => BAD_POLICY_STATES.has(s.state));
  const settingsText = badSettings.map(settingLabel).join(', ');
  return {
    id: `compliance-policy-${policy.id}`,
    severity,
    title: t.policyTitle(policy.displayName),
    detail: t.policyDetail(badSettings.length),
    cause: t.policyCause,
    remediation: badSettings.length ? t.policyRemediation(settingsText) : [...t.remediationCommon],
    evidence: Object.fromEntries([
      ['policyId', policy.id],
      ['state', policy.state],
      ['version', policy.version],
      ...badSettings.flatMap((s, i) => [
        [`setting${i + 1}`, s.settingName ?? s.setting],
        [`setting${i + 1}.state`, s.state],
        [`setting${i + 1}.currentValue`, s.currentValue],
      ]),
    ]),
    source,
    docsUrl: Docs.complianceMonitor,
  };
}
