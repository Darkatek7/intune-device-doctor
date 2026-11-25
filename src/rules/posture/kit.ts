/**
 * Gemeinsame Bausteine der Kacheln „Empfehlungen“: Kachel aus Einzelprüfungen bauen, Framework-Auswertung
 * je Richtlinie mit Stufenlogik, Befunde für Abweichungen und nicht prüfbare Empfehlungen.
 */
import type {
  CompliancePolicyConfig,
  PlatformDeviceCounts,
  PostureLevel,
  TenantPosture,
} from '../../domain/posture';
import type {
  DataSource,
  Finding,
  SectionResult,
  Severity,
  TileFact,
  TileId,
} from '../../domain/types';
import { de } from '../../i18n/de';
import { dePosture } from '../../i18n/de-posture';
import {
  sectionIssueFinding,
  sortFindings,
  summaryForIssue,
  uniqueSources,
  worstActionable,
} from '../helpers';
import type {
  CatalogCheck,
  CheckOutcome,
  PolicySubject,
  PostureCheckResult,
  PostureFramework,
  PostureTile,
} from './types';

const c = dePosture.common;

export type NotOk<T> = Exclude<SectionResult<T>, { status: 'ok' }>;

// ---------- Kacheln ----------

/** Kachel, deren benötigte Quelle nicht verfügbar ist: nie eine Aussage ohne Datenbasis. */
export function issueTile(
  id: TileId,
  section: NotOk<unknown>,
  extra: { findings?: Finding[]; facts?: TileFact[]; sources?: DataSource[] } = {},
): PostureTile {
  return {
    id,
    title: de.tiles[id],
    state: 'ready',
    severity: 'unknown',
    value: de.availability[section.status],
    summary: summaryForIssue(section),
    findings: [sectionIssueFinding(id, section), ...(extra.findings ?? [])],
    sources: uniqueSources([section.source, ...(extra.sources ?? [])]),
    facts: extra.facts ?? [],
    availability: section.status,
    sections: [],
    checks: [],
  };
}

export interface CheckCounts {
  met: number;
  deviating: number;
  notChecked: number;
}

export function countChecks(checks: readonly PostureCheckResult[]): CheckCounts {
  const counted = checks.filter((check) => check.counted);
  return {
    met: counted.filter((check) => check.status === 'met').length,
    deviating: counted.filter((check) => check.status === 'deviating').length,
    notChecked: counted.filter((check) => check.status === 'notChecked').length,
  };
}

/** „7 von 9 erfüllt“ (nicht prüfbare zählen nicht zum Nenner); ohne bewertbare Prüfung „Nicht prüfbar“. */
export function valueOfChecks(checks: readonly PostureCheckResult[]): string {
  let counts = countChecks(checks);
  // Nur nicht gezählte Prüfungen (z. B. ausschließlich nicht zugewiesene Richtlinien): trotzdem zeigen
  if (counts.met + counts.deviating === 0) {
    counts = countChecks(checks.map((check) => ({ ...check, counted: true })));
  }
  const evaluated = counts.met + counts.deviating;
  return evaluated === 0 ? c.valueNotChecked : c.valueMet(counts.met, evaluated);
}

export function summaryOfChecks(checks: readonly PostureCheckResult[]): string {
  const counts = countChecks(checks);
  return c.summaryCounts(counts.met, counts.deviating, counts.notChecked);
}

export interface TileParts {
  id: TileId;
  value?: string;
  summary?: string;
  findings: Finding[];
  facts: TileFact[];
  sources: Array<DataSource | undefined>;
  checks: PostureCheckResult[];
  /** Severity, wenn kein Befund handlungsrelevant ist (Standard: ok bei bewerteten Prüfungen, sonst unknown) */
  fallback?: Severity;
  availability?: PostureTile['availability'];
}

export function buildTile(parts: TileParts): PostureTile {
  const counts = countChecks(parts.checks);
  const fallback = parts.fallback ?? (counts.met + counts.deviating > 0 ? 'ok' : 'unknown');
  return {
    id: parts.id,
    title: de.tiles[parts.id],
    state: 'ready',
    severity: worstActionable(parts.findings, fallback),
    value: parts.value ?? valueOfChecks(parts.checks),
    summary: parts.summary ?? summaryOfChecks(parts.checks),
    findings: sortFindings(parts.findings),
    sources: uniqueSources(parts.sources),
    facts: parts.facts,
    ...(parts.availability ? { availability: parts.availability } : {}),
    sections: [],
    checks: parts.checks,
  };
}

// ---------- Plattformen ----------

export type PosturePlatform = 'windows' | 'ios' | 'android' | 'macos';
export const PLATFORMS: readonly PosturePlatform[] = ['windows', 'ios', 'android', 'macos'];

/**
 * Plattform einer Compliance-Richtlinie: aus dem v1.0-Typ, für `other` aus `@odata.type`
 * (z. B. `androidDeviceOwnerCompliancePolicy` → Android). null = keine der vier Plattformen.
 */
export function compliancePolicyPlatform(policy: CompliancePolicyConfig): PosturePlatform | null {
  switch (policy.type) {
    case 'windows10':
      return 'windows';
    case 'ios':
      return 'ios';
    case 'macos':
      return 'macos';
    case 'androidDeviceAdministrator':
    case 'androidWorkProfile':
      return 'android';
    case 'other': {
      const type = (policy.odataType ?? '').toLowerCase();
      if (type.includes('android') || type.includes('aosp')) return 'android';
      if (type.includes('macos')) return 'macos';
      if (type.includes('ios')) return 'ios';
      if (type.includes('windows')) return 'windows';
      return null;
    }
  }
}

/**
 * Geräte je Plattform: Zahl, null (Quelle ok, Wert fehlt) oder undefined (Quelle nicht verfügbar).
 */
export function deviceCount(
  counts: TenantPosture['platformCounts'],
  platform: PosturePlatform,
): number | null | undefined {
  if (counts.status !== 'ok') return undefined;
  return (counts.data as PlatformDeviceCounts)[platform];
}

/** Plattform ist „nicht genutzt“: nachweislich keine Geräte. */
export function platformUnused(
  counts: TenantPosture['platformCounts'],
  platform: PosturePlatform,
): boolean {
  return deviceCount(counts, platform) === 0;
}

// ---------- Framework-Auswertung je Richtlinie ----------

export interface EvaluatedCheck {
  check: CatalogCheck;
  outcome: CheckOutcome;
}

export interface FrameworkEvaluation {
  /** Stufe, gegen die bewertet wird (bei fehlender Stufe 1 die niedrigste angebotene); null = ungestuft */
  effectiveLevel: PostureLevel | null;
  /** Prüfungen bis einschließlich effectiveLevel */
  included: EvaluatedCheck[];
  /** Höchste Stufe, deren Prüfungen (soweit prüfbar) alle erfüllt sind; null = keine bzw. ungestuft */
  reached: PostureLevel | null;
}

export function effectiveLevel(
  framework: PostureFramework,
  selected: PostureLevel,
): PostureLevel | null {
  if (!framework.levels) return null;
  const minimum = Math.min(...framework.levels) as PostureLevel;
  return (selected < minimum ? minimum : selected) as PostureLevel;
}

export function evaluateFramework(
  framework: PostureFramework,
  subject: PolicySubject,
  selected: PostureLevel,
): FrameworkEvaluation {
  const level = effectiveLevel(framework, selected);
  const all = framework.checks.map((check) => ({ check, outcome: check.evaluate(subject) }));
  const included =
    level === null
      ? all
      : all.filter((entry) => entry.check.level !== null && entry.check.level <= level);
  let reached: PostureLevel | null = null;
  if (framework.levels) {
    for (const candidate of [...framework.levels].sort()) {
      const relevant = all.filter(
        (entry) => entry.check.level !== null && entry.check.level <= candidate,
      );
      if (relevant.some((entry) => entry.outcome.status === 'deviating')) break;
      reached = candidate;
    }
  }
  return { effectiveLevel: level, included, reached };
}

export function checkText(check: CatalogCheck): { label: string; expected: string } {
  return dePosture.catalog[check.id];
}

export interface PolicyRef {
  id: string;
  name: string;
  /** false = nicht zugewiesen, null = unbekannt */
  assigned: boolean | null;
}

export function policyLabel(policy: PolicyRef): string {
  if (policy.assigned === false) return `${policy.name}${c.unassignedSuffix}`;
  if (policy.assigned === null) return `${policy.name}${c.assignmentUnknownSuffix}`;
  return policy.name;
}

/** Einzelprüfungen einer Richtlinie (nur die eingeschlossenen Stufen). */
export function policyCheckResults(
  tile: TileId,
  policy: PolicyRef,
  evaluation: FrameworkEvaluation,
): PostureCheckResult[] {
  return evaluation.included.map(({ check, outcome }) => {
    const text = checkText(check);
    return {
      id: `${tile}:${check.id}:${policy.id}`,
      tile,
      label: text.label,
      status: outcome.status,
      level: check.level,
      actual: outcome.actual,
      expected: text.expected,
      docsUrl: check.docsUrl,
      subject: policy.name,
      ...(outcome.reason ? { reason: outcome.reason } : {}),
      // Nicht zugewiesene Richtlinien gelten für kein Gerät → angezeigt, aber nicht gezählt
      counted: policy.assigned !== false,
    };
  });
}

function statusText(status: PostureCheckResult['status']): string {
  switch (status) {
    case 'met':
      return c.statusMet;
    case 'deviating':
      return c.statusDeviating;
    case 'notChecked':
      return c.statusNotChecked;
  }
}

/** Tabelle Einstellung | Ist | Empfehlung | Stufe/Status. */
export function checkTable(results: readonly PostureCheckResult[]): Finding['table'] {
  const col = c.columns;
  return {
    columns: [col.setting, col.actual, col.expected, col.levelStatus],
    rows: results.map((result) => ({
      cells: [
        result.label,
        result.actual,
        result.expected,
        c.levelStatus(dePosture.levelShort(result.level), statusText(result.status)),
      ],
    })),
  };
}

/**
 * Befund und Fakt je Richtlinie: Abweichungen bzw. nicht prüfbare Werte → Befund mit Tabelle; alles
 * erfüllt → nur ein Fakt.
 *
 * Severity: Abweichung von einer Learn-Empfehlung → `warning` (Microsoft nennt die Werte einen
 * Ausgangspunkt, nie `critical`); nicht zugewiesene Richtlinie → Hinweis (`unknown`).
 */
export function policyOutcome(args: {
  tile: TileId;
  policy: PolicyRef;
  framework: PostureFramework;
  evaluation: FrameworkEvaluation;
  results: PostureCheckResult[];
  source: DataSource;
  texts: { cause: string; remediation: readonly string[] };
}): { finding: Finding | null; fact: TileFact } {
  const { policy, evaluation, results } = args;
  const t = dePosture.compliance;
  const evaluated = results.filter((result) => result.status !== 'notChecked');
  const met = evaluated.filter((result) => result.status === 'met').length;
  const reachedText = args.framework.levels ? c.reachedLevel(evaluation.reached) : null;
  const fact: TileFact = {
    label: c.policyFact(policyLabel(policy)),
    value: c.policyFactValue(met, evaluated.length, reachedText),
  };
  const deviating = results.filter((result) => result.status === 'deviating');
  const unchecked = results.filter((result) => result.status === 'notChecked');
  if (deviating.length === 0 && unchecked.length === 0) return { finding: null, fact };
  const levelText =
    evaluation.effectiveLevel === null
      ? dePosture.levelShort(null)
      : dePosture.levels[evaluation.effectiveLevel];
  const unassigned = policy.assigned === false;
  const title =
    deviating.length === 0
      ? t.policyNotCheckedTitle(policy.name, unchecked.length)
      : unassigned
        ? t.policyTitleUnassigned(policy.name, deviating.length)
        : t.policyTitle(policy.name, deviating.length);
  const finding: Finding = {
    id: `${args.tile}-policy-${policy.id}`,
    severity: unassigned || deviating.length === 0 ? 'unknown' : 'warning',
    title,
    detail: [
      reachedText === null ? t.policyDetailUnleveled : t.policyDetail(levelText, reachedText),
      unassigned ? t.unassignedDetail : null,
    ]
      .filter(Boolean)
      .join(' '),
    cause: args.texts.cause,
    remediation: [...args.texts.remediation],
    table: checkTable([...deviating, ...unchecked]),
    evidence: {
      policyId: policy.id,
      assigned: policy.assigned,
      deviating: deviating.length,
      notChecked: unchecked.length,
    },
    source: args.source,
    docsUrl: args.framework.docsUrl,
  };
  return { finding, fact };
}

/**
 * Learn-Empfehlungen ohne v1.0-Eigenschaft: einmal je Kachel als Befund (Hinweis) und als nicht prüfbare
 * Einzelprüfungen – nur, wenn mindestens eine Richtlinie gegen das Framework bewertet wurde.
 */
export function uncheckableOutcome(
  tile: TileId,
  framework: PostureFramework,
  level: PostureLevel | null,
  source: DataSource,
  counted = true,
): { finding: Finding | null; checks: PostureCheckResult[] } {
  const items = framework.uncheckable.filter(
    (item) => level === null || item.level === null || item.level <= level,
  );
  if (items.length === 0) return { finding: null, checks: [] };
  const col = c.columns;
  const checks: PostureCheckResult[] = items.map((item) => {
    const text = dePosture.uncheckable[item.id];
    const reason = dePosture.uncheckableReason[item.reason];
    return {
      id: `${tile}:${item.id}`,
      tile,
      label: text.label,
      status: 'notChecked',
      level: item.level,
      actual: reason,
      expected: text.expected,
      docsUrl: item.docsUrl,
      reason,
      counted,
    };
  });
  const finding: Finding = {
    id: `${tile}-uncheckable`,
    severity: 'unknown',
    title: dePosture.uncheckableTitle(items.length),
    detail: dePosture.uncheckableDetail,
    cause: dePosture.uncheckableCause,
    remediation: [...dePosture.compliance.betaTypeRemediation],
    table: {
      columns: [col.setting, col.expected, col.level, col.reason],
      rows: checks.map((check) => ({
        cells: [check.label, check.expected, dePosture.levelShort(check.level), check.reason ?? ''],
      })),
    },
    source,
    docsUrl: framework.docsUrl,
  };
  return { finding, checks };
}

export function truncatedFinding(tile: TileId, source: DataSource): Finding {
  return {
    id: `${tile}-truncated`,
    severity: 'unknown',
    title: c.truncatedTitle,
    detail: c.truncatedDetail,
    cause: c.truncatedCause,
    remediation: [...c.truncatedRemediation],
    source,
  };
}

/** Fakt „Bewertete Stufe“ (mit Hinweis, wenn Microsoft die gewählte Stufe nicht anbietet). */
export function levelFact(framework: PostureFramework, selected: PostureLevel): TileFact | null {
  const level = effectiveLevel(framework, selected);
  if (level === null) return null;
  return {
    label: c.facts.level,
    value: level === selected ? dePosture.levels[level] : c.facts.levelRaised(selected, level),
  };
}
