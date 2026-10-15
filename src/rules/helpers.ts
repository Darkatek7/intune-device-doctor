/**
 * Gemeinsame Bausteine der Kachel-Regeln.
 */
import type {
  DataSource,
  DeviceSnapshot,
  Finding,
  SectionResult,
  Severity,
  SnapshotSectionKey,
  Tile,
  TileAvailability,
  TileId,
} from '../domain/types';
import { de } from '../i18n/de';

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  unknown: 2,
  ok: 3,
};

/** Schlechteste Severity (critical > warning > unknown > ok). Leere Liste → fallback. */
export function worstSeverity(severities: Severity[], fallback: Severity = 'ok'): Severity {
  if (severities.length === 0) return fallback;
  return severities.reduce((a, b) => (SEVERITY_RANK[b] < SEVERITY_RANK[a] ? b : a));
}

/** Schlechteste Severity, aber "unknown" (Hinweise) zählt nicht gegen ein sonst gesundes Ergebnis. */
export function worstActionable(findings: Finding[], fallback: Severity = 'ok'): Severity {
  const relevant = findings
    .map((f) => f.severity)
    .filter((s) => s === 'critical' || s === 'warning');
  return worstSeverity(relevant, fallback);
}

export function sortFindings(findings: Finding[]): Finding[] {
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.finding.severity] - SEVERITY_RANK[b.finding.severity] || a.index - b.index,
    )
    .map(({ finding }) => finding);
}

export function loadingTile(id: TileId, sections: SnapshotSectionKey[]): Tile {
  return {
    id,
    title: de.tiles[id],
    state: 'loading',
    severity: 'unknown',
    value: de.states.loading,
    summary: '',
    findings: [],
    sources: [],
    facts: [],
    sections,
  };
}

/** Alle genannten Sections geladen? */
export function sectionsLoaded(snapshot: DeviceSnapshot, sections: SnapshotSectionKey[]): boolean {
  return sections.every((key) => snapshot[key] !== undefined);
}

export function availabilityOf(section: SectionResult<unknown>): TileAvailability | undefined {
  return section.status === 'ok' ? undefined : section.status;
}

/** Wert-Text für eine nicht verfügbare Section ("Fehlende Berechtigung", "Nicht anwendbar" …). */
export function availabilityValue(availability: TileAvailability): string {
  return de.availability[availability];
}

/**
 * Befund für eine Section, die nicht "ok" ist: erklärt fehlende Berechtigung, Nichtanwendbarkeit,
 * Nichtverfügbarkeit oder Ladefehler – immer mit Ursache und Lösung.
 */
export function sectionIssueFinding(
  idPrefix: string,
  section: Exclude<SectionResult<unknown>, { status: 'ok' }>,
): Finding {
  const base = { source: section.source, docsUrl: section.source.docsUrl };
  switch (section.status) {
    case 'forbidden': {
      const scope = section.error.requiredScope ?? de.rules.common.unknownScope;
      return {
        ...base,
        id: `${idPrefix}-forbidden`,
        severity: 'unknown',
        title: de.rules.common.forbiddenTitle,
        detail: de.rules.common.forbiddenDetail(section.source.label),
        cause: de.rules.common.forbiddenCause(scope),
        remediation: de.rules.common.forbiddenRemediation(scope),
        evidence: {
          requiredScope: scope,
          httpStatus: section.error.httpStatus ?? null,
          graphCode: section.error.graphCode ?? null,
          requestId: section.error.requestId ?? null,
        },
        docsUrl: PERMISSIONS_DOCS_URL,
      };
    }
    case 'notApplicable':
      return {
        ...base,
        id: `${idPrefix}-notApplicable`,
        severity: 'unknown',
        title: de.rules.common.notApplicableTitle,
        detail: section.reason,
        cause: de.rules.common.notApplicableCause,
        remediation: [de.rules.common.notApplicableRemediation],
      };
    case 'unavailable':
      return {
        ...base,
        id: `${idPrefix}-unavailable`,
        severity: 'unknown',
        title: de.rules.common.unavailableTitle,
        detail: section.reason,
        cause: de.rules.common.unavailableCause,
        remediation: [de.rules.common.unavailableRemediation],
      };
    case 'error': {
      const throttled = section.error.code === 'throttled';
      return {
        ...base,
        id: `${idPrefix}-error`,
        severity: 'unknown',
        title: throttled ? de.rules.common.throttledTitle : de.rules.common.errorTitle,
        detail: section.error.message,
        cause: throttled ? de.rules.common.throttledCause : de.rules.common.errorCause,
        remediation: throttled
          ? [de.rules.common.throttledRemediation]
          : [de.rules.common.errorRemediation],
        evidence: {
          code: section.error.code,
          httpStatus: section.error.httpStatus ?? null,
          graphCode: section.error.graphCode ?? null,
          requestId: section.error.requestId ?? null,
          retryAfterSeconds: section.error.retryAfterSeconds ?? null,
        },
        docsUrl: throttled ? THROTTLING_DOCS_URL : ERRORS_DOCS_URL,
      };
    }
  }
}

export const PERMISSIONS_DOCS_URL = 'https://learn.microsoft.com/en-us/graph/permissions-reference';
export const THROTTLING_DOCS_URL = 'https://learn.microsoft.com/en-us/graph/throttling';
export const ERRORS_DOCS_URL = 'https://learn.microsoft.com/en-us/graph/errors';

/** Kachel, deren einzige Section nicht ok ist. */
export function unavailableTile(
  id: TileId,
  sections: SnapshotSectionKey[],
  section: Exclude<SectionResult<unknown>, { status: 'ok' }>,
  summary?: string,
): Tile {
  return {
    id,
    title: de.tiles[id],
    state: 'ready',
    severity: 'unknown',
    value: availabilityValue(section.status),
    summary: summary ?? summaryForIssue(section),
    findings: [sectionIssueFinding(id, section)],
    sources: [section.source],
    facts: [],
    availability: section.status,
    sections,
  };
}

export function summaryForIssue(
  section: Exclude<SectionResult<unknown>, { status: 'ok' }>,
): string {
  switch (section.status) {
    case 'forbidden':
      return de.rules.common.forbiddenSummary(
        section.error.requiredScope ?? de.rules.common.unknownScope,
      );
    case 'notApplicable':
    case 'unavailable':
      return section.reason;
    case 'error':
      return section.error.code === 'throttled' ? de.states.throttled : section.error.message;
  }
}

/** Quellen ohne Duplikate (nach label). */
export function uniqueSources(sources: Array<DataSource | undefined>): DataSource[] {
  const seen = new Set<string>();
  const result: DataSource[] = [];
  for (const source of sources) {
    if (!source || seen.has(source.label)) continue;
    seen.add(source.label);
    result.push(source);
  }
  return result;
}
