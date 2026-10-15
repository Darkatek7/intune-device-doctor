/**
 * Richtlinien: Compliance-Richtlinien + Konfigurationsprofile pro Gerät.
 * error/conflict → critical, nonCompliant → warning. Fehlercodes werden nur über die Wissensbasis
 * gedeutet (sonst "Unbekannter Code" + Hex/Dezimal). Immer ein Hinweis zur Settings-Catalog-Lücke.
 */
import type {
  DataSource,
  DeviceSnapshot,
  Finding,
  PolicySettingInfo,
  PolicyStateInfo,
  Severity,
  Tile,
  TileFact,
} from '../../domain/types';
import { de } from '../../i18n/de';
import {
  loadingTile,
  sectionIssueFinding,
  sectionsLoaded,
  sortFindings,
  uniqueSources,
  worstActionable,
} from '../helpers';
import { Docs } from '../knowledge/docs';
import { describeErrorCode } from '../knowledge/errorCodes';
import { settingName } from './policySettings';

const t = de.rules.policies;
const f = de.rules.facts;

const STATE_SEVERITY: Partial<Record<PolicyStateInfo['state'], Severity>> = {
  error: 'critical',
  conflict: 'critical',
  nonCompliant: 'warning',
};

export function evaluatePolicies(snapshot: DeviceSnapshot, _now: Date): Tile {
  void _now;
  const sections: Tile['sections'] = ['compliancePolicies', 'configurationPolicies'];
  if (!sectionsLoaded(snapshot, sections)) return loadingTile('policies', sections);
  const compliance = snapshot.compliancePolicies!;
  const configuration = snapshot.configurationPolicies!;
  const findings: Finding[] = [];
  const facts: TileFact[] = [];

  for (const section of [configuration, compliance]) {
    if (section.status !== 'ok') {
      findings.push(
        sectionIssueFinding(
          `policies-${section === configuration ? 'configuration' : 'compliance'}`,
          section,
        ),
      );
      continue;
    }
    for (const policy of section.data) {
      const severity = STATE_SEVERITY[policy.state];
      if (severity) findings.push(policyFinding(policy, severity, section.source));
    }
  }

  const configCount = configuration.status === 'ok' ? configuration.data.length : null;
  const complianceCount = compliance.status === 'ok' ? compliance.data.length : null;
  facts.push({
    label: f.profiles,
    value:
      configCount === null
        ? de.availability[configuration.status as Exclude<typeof configuration.status, 'ok'>]
        : String(configCount),
  });
  facts.push({
    label: f.compliancePolicies,
    value:
      complianceCount === null
        ? de.availability[compliance.status as Exclude<typeof compliance.status, 'ok'>]
        : String(complianceCount),
  });

  // Dokumentierte Lücke immer offen ausweisen (CLAUDE.md Regel 2)
  findings.push({
    id: 'policies-settingsCatalog',
    severity: 'unknown',
    title: t.settingsCatalogTitle,
    detail: t.settingsCatalogDetail,
    cause: t.settingsCatalogCause,
    remediation: [...t.settingsCatalogRemediation],
    source: configuration.source,
    docsUrl: Docs.settingsCatalog,
  });

  const actionable = findings.filter((x) => x.severity === 'critical' || x.severity === 'warning');
  const critical = actionable.filter((x) => x.severity === 'critical').length;
  const anyUnavailable = compliance.status !== 'ok' || configuration.status !== 'ok';
  // Ohne Probleme, aber mit fehlenden Daten: nicht "alles in Ordnung" behaupten
  const severity = worstActionable(findings, anyUnavailable ? 'unknown' : 'ok');
  const missingStatus = configuration.status !== 'ok' ? configuration.status : compliance.status;
  const total = (configCount ?? 0) + (complianceCount ?? 0);
  const value =
    critical > 0
      ? t.valueProblems(critical)
      : actionable.length > 0
        ? t.valueWarnings(actionable.length)
        : missingStatus !== 'ok'
          ? de.availability[missingStatus]
          : total === 0
            ? t.valueNone
            : t.valueOk;
  const availability =
    configuration.status !== 'ok'
      ? configuration.status
      : compliance.status !== 'ok'
        ? compliance.status
        : undefined;
  const summary =
    configuration.status === 'forbidden'
      ? [t.forbiddenProfilesSummary, t.summary(null, complianceCount)].filter(Boolean).join(' · ')
      : t.summary(configCount, complianceCount);

  return {
    id: 'policies',
    title: de.tiles.policies,
    state: 'ready',
    severity,
    value,
    summary,
    findings: sortFindings(findings),
    sources: uniqueSources([configuration.source, compliance.source]),
    facts,
    availability,
    sections,
  };
}

function codeText(setting: PolicySettingInfo): string | null {
  if (setting.errorCode === null || setting.errorCode === 0) return null;
  const description = describeErrorCode(setting.errorCode, '');
  const { hex, decimal, kind, baseCode, name } = description.explanation;
  if (description.intune || description.installer) return t.codeKnown(description.label);
  if (kind === 'win32' && baseCode !== null) return t.codeWin32(hex, baseCode, name);
  if (description.explanation.name) return t.codeKnown(description.label);
  return t.codeUnknown(hex, decimal);
}

function policyFinding(policy: PolicyStateInfo, severity: Severity, source: DataSource): Finding {
  const kind = policy.kind === 'configuration' ? t.kindProfile : t.kindCompliance;
  const affected = policy.settings.filter(
    (s) => s.state === policy.state || STATE_SEVERITY[s.state],
  );
  const settingsText = affected
    .map((s) => {
      const code =
        s.errorCode && s.errorCode !== 0
          ? describeErrorCode(s.errorCode, '').explanation.hex
          : null;
      return code ? t.settingWithCode(settingName(s), code) : settingName(s);
    })
    .join(', ');
  const codeTexts = affected.map(codeText).filter((x): x is string => Boolean(x));
  const conflictSources = [
    ...new Set(
      affected.flatMap((s) =>
        s.sources.map((src) => src.displayName).filter((n): n is string => Boolean(n)),
      ),
    ),
  ];
  const knowledge = affected
    .map((s) => (s.errorCode ? describeErrorCode(s.errorCode, '') : null))
    .find((d) => d?.intune || d?.installer);

  const title =
    policy.state === 'error'
      ? t.errorTitle(kind, policy.displayName)
      : policy.state === 'conflict'
        ? t.conflictTitle(kind, policy.displayName)
        : t.nonCompliantTitle(kind, policy.displayName);
  const baseCause =
    policy.state === 'error'
      ? t.errorCause
      : policy.state === 'conflict'
        ? t.conflictCause
        : t.nonCompliantCause;
  const knowledgeCause = knowledge?.intune?.cause ?? knowledge?.installer?.cause;
  const cause = [
    knowledgeCause ?? baseCause,
    conflictSources.length > 1 ? t.conflictSources(conflictSources.join(', ')) : null,
  ]
    .filter(Boolean)
    .join(' ');
  const baseRemediation =
    policy.state === 'error'
      ? [...t.errorRemediation]
      : policy.state === 'conflict'
        ? [...t.conflictRemediation]
        : [...t.nonCompliantRemediation];
  const remediation = knowledge
    ? [
        ...(knowledge.intune?.remediation ?? knowledge.installer?.remediation ?? []),
        ...baseRemediation.slice(-1),
      ]
    : baseRemediation;

  const evidence: Record<string, string | number | boolean | null> = {
    policyId: policy.id,
    kind: policy.kind,
    state: policy.state,
    version: policy.version,
    platformType: policy.platformType,
  };
  affected.forEach((s, i) => {
    const prefix = `setting${i + 1}`;
    evidence[prefix] = settingName(s);
    evidence[`${prefix}.state`] = s.state;
    if (s.errorCode) {
      const ex = describeErrorCode(s.errorCode, '').explanation;
      evidence[`${prefix}.errorCode`] = `${ex.hex} (${ex.decimal})`;
    }
    if (s.errorDescription) evidence[`${prefix}.errorDescription`] = s.errorDescription;
    if (s.currentValue !== null) evidence[`${prefix}.currentValue`] = s.currentValue;
    if (s.sources.length)
      evidence[`${prefix}.sources`] = s.sources.map((src) => src.displayName ?? src.id).join(', ');
  });

  return {
    id: `policies-${policy.kind}-${policy.id}`,
    severity,
    title,
    detail: [
      t.policyDetail(t.stateLabel[policy.state] ?? policy.state, settingsText),
      ...codeTexts,
    ].join(' '),
    cause,
    remediation,
    evidence,
    source,
    docsUrl:
      knowledge?.docsUrl ??
      (policy.state === 'conflict'
        ? Docs.policyConflicts
        : policy.kind === 'compliance'
          ? Docs.complianceMonitor
          : Docs.intuneCommonErrors),
  };
}
