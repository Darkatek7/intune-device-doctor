/**
 * Ansicht „Mandant“ (M14/S5): mandantenweite Zertifikate und Token als Kacheln – unabhängig von einem
 * Gerät. Reine Funktion TenantStatus → Tile[]; dieselben Kachel-/Sheet-Komponenten wie bei Geräten.
 *
 * - Apple-MDM-Push-Zertifikat: abgelaufen → critical, ≤ 30 Tage → warning (wie in der Gerätekachel)
 * - Apple-VPP-Token: abgelaufen/`expired`/`invalid` → critical; ≤ 30 Tage → warning (eigener Richtwert,
 *   keine Microsoft-Vorgabe); lastSyncStatus `failed` → warning; `assignedToExternalMDM`/`unknown` → Hinweis
 * - Weitere Konnektoren (ADE/DEP, Android Enterprise, Autopilot-Sync, NDES): nur in der Beta-API
 *   dokumentiert → ehrlich als „nicht abrufbar“ ausgewiesen. Es gibt keine Links ins Admin Center: für
 *   diese Seiten ist in `src/links/intunePortal.ts` keine Portal-URL belegt.
 * Das VPP-Token selbst und die Apple-ID sind nie im Modell (siehe mapVppTokens).
 */
import { formatDate, formatDateTime, formatRelativeTime } from '../domain/format';
import type {
  Finding,
  SectionResult,
  Severity,
  TenantStatus,
  Tile,
  TileFact,
  TileId,
  VppTokenInfo,
} from '../domain/types';
import { de } from '../i18n/de';
import { sectionIssueFinding, sortFindings, worstActionable } from './helpers';
import {
  evaluateTenantChanges,
  evaluateTenantCompliance,
  evaluateTenantConfiguration,
} from './fleet';
import { evaluateEnrollmentFailures, evaluateServiceHealth } from './service';
import { Docs } from './knowledge/docs';
import { THRESHOLDS } from './thresholds';

const DAY = 24 * 60 * 60 * 1000;
const t = de.rules.tenant;

// ---------- Apple-MDM-Push-Zertifikat ----------

function evaluatePush(status: TenantStatus['applePushCertificate'], now: Date): Tile {
  const base = {
    id: 'tenantApplePush' as const,
    title: de.tiles.tenantApplePush,
    state: 'ready' as const,
    sections: [],
  };
  const s = de.rules.deviceStatus;
  if (status.status !== 'ok') {
    return {
      ...base,
      severity: 'unknown',
      value: de.availability[status.status],
      summary: summaryOfIssue(status),
      findings: [sectionIssueFinding('tenantApplePush', status)],
      sources: [status.source],
      facts: [],
      availability: status.status,
    };
  }
  const { expirationDateTime: expiry, lastModifiedDateTime: modified } = status.data;
  const facts: TileFact[] = [];
  const findings: Finding[] = [];
  let value: string = t.push.valueValid;
  const summary: string = expiry ? t.push.summaryValid(formatDate(expiry)) : t.push.noExpiryTitle;
  if (expiry) {
    facts.push({ label: t.push.facts.expires, value: formatDate(expiry) });
    const daysLeft = (new Date(expiry).getTime() - now.getTime()) / DAY;
    if (daysLeft <= THRESHOLDS.certificateWarningDays) {
      const expired = daysLeft <= 0;
      findings.push({
        id: expired ? 'tenantApplePush-expired' : 'tenantApplePush-expiring',
        severity: expired ? 'critical' : 'warning',
        title: expired ? s.apnsExpiredTitle : s.apnsExpiringTitle(formatRelativeTime(expiry, now)),
        detail: s.apnsDetail(formatDate(expiry)),
        cause: s.apnsCause,
        remediation: [...s.apnsRemediation],
        evidence: { expirationDateTime: expiry, lastModifiedDateTime: modified },
        source: status.source,
        docsUrl: Docs.appleMdmPushCertificate,
      });
      value = expired ? t.push.valueExpired : t.push.valueExpiring;
    }
  } else {
    findings.push({
      id: 'tenantApplePush-noExpiry',
      severity: 'unknown',
      title: t.push.noExpiryTitle,
      detail: t.push.noExpiryDetail,
      cause: t.push.noExpiryCause,
      remediation: [...t.push.noExpiryRemediation],
      source: status.source,
      docsUrl: Docs.appleMdmPushCertificate,
    });
    value = de.availability.unavailable;
  }
  if (modified) facts.push({ label: t.push.facts.modified, value: formatDateTime(modified) });
  return {
    ...base,
    severity: worstActionable(findings, expiry ? 'ok' : 'unknown'),
    value,
    summary,
    findings: sortFindings(findings),
    sources: [status.source],
    facts,
  };
}

function summaryOfIssue(section: Exclude<SectionResult<unknown>, { status: 'ok' }>): string {
  switch (section.status) {
    case 'forbidden':
      return de.rules.common.forbiddenSummary(
        section.error.requiredScope ?? de.rules.common.unknownScope,
      );
    case 'error':
      return section.error.message;
    default:
      return section.reason;
  }
}

// ---------- Apple-VPP-Token ----------

function tokenFindings(
  token: VppTokenInfo,
  index: number,
  source: Finding['source'],
  now: Date,
): Finding[] {
  const v = t.vpp;
  const name = v.tokenLabel(token.organizationName, index);
  const expiry = token.expirationDateTime;
  const expiryText = expiry ? formatDate(expiry) : null;
  const daysLeft = expiry ? (new Date(expiry).getTime() - now.getTime()) / DAY : null;
  const evidence = {
    state: token.state,
    expirationDateTime: expiry,
    lastSyncStatus: token.lastSyncStatus,
    lastSyncDateTime: token.lastSyncDateTime,
    vppTokenAccountType: token.accountType,
    countryOrRegion: token.countryOrRegion,
  };
  const common = { source, evidence };
  const findings: Finding[] = [];

  const expired = token.state === 'expired' || (daysLeft !== null && daysLeft <= 0);
  if (expired) {
    findings.push({
      ...common,
      id: `tenantVpp-expired-${token.id}`,
      severity: 'critical',
      title: v.expiredTitle(name),
      detail: v.expiredDetail(expiryText),
      cause: v.expiredCause,
      remediation: [...v.renewRemediation],
      docsUrl: Docs.vppTokenRenew,
    });
  } else if (token.state === 'invalid') {
    findings.push({
      ...common,
      id: `tenantVpp-invalid-${token.id}`,
      severity: 'critical',
      title: v.invalidTitle(name),
      detail: v.invalidDetail(expiryText),
      cause: v.invalidCause,
      remediation: [...v.renewRemediation],
      docsUrl: Docs.vppTokenRenew,
    });
  } else if (daysLeft !== null && daysLeft <= THRESHOLDS.vppTokenWarningDays && expiry) {
    findings.push({
      ...common,
      id: `tenantVpp-expiring-${token.id}`,
      severity: 'warning',
      title: v.expiringTitle(name, formatRelativeTime(expiry, now)),
      detail: v.expiringDetail(formatDate(expiry), THRESHOLDS.vppTokenWarningDays),
      cause: v.expiringCause,
      remediation: [...v.renewRemediation],
      docsUrl: Docs.vppTokenRenew,
    });
  } else if (token.state === 'assignedToExternalMDM') {
    findings.push({
      ...common,
      id: `tenantVpp-external-${token.id}`,
      severity: 'unknown',
      title: v.externalTitle(name),
      detail: v.externalDetail,
      cause: v.externalCause,
      remediation: [...v.externalRemediation],
      docsUrl: Docs.vppTokenResource,
    });
  } else if (token.state === 'unknown') {
    findings.push({
      ...common,
      id: `tenantVpp-unknownState-${token.id}`,
      severity: 'unknown',
      title: v.unknownStateTitle(name),
      detail: v.unknownStateDetail,
      cause: v.unknownStateCause,
      remediation: [...v.unknownStateRemediation],
      docsUrl: Docs.vppTokenResource,
    });
  }

  if (token.lastSyncStatus === 'failed') {
    findings.push({
      ...common,
      id: `tenantVpp-syncFailed-${token.id}`,
      severity: 'warning',
      title: v.syncFailedTitle(name),
      detail: v.syncFailedDetail(
        token.lastSyncDateTime ? formatDateTime(token.lastSyncDateTime) : null,
      ),
      cause: v.syncFailedCause,
      remediation: [...v.syncFailedRemediation],
      docsUrl: Docs.vppTokenSync,
    });
  }
  return findings;
}

function evaluateVpp(status: TenantStatus['vppTokens'], now: Date): Tile {
  const base = {
    id: 'tenantVpp' as const,
    title: de.tiles.tenantVpp,
    state: 'ready' as const,
    sections: [],
  };
  const v = t.vpp;
  if (status.status !== 'ok') {
    return {
      ...base,
      severity: 'unknown',
      value: de.availability[status.status],
      summary: summaryOfIssue(status),
      findings: [sectionIssueFinding('tenantVpp', status)],
      sources: [status.source],
      facts: [],
      availability: status.status,
    };
  }
  const tokens = status.data;
  const findings: Finding[] = [];
  let problems = 0;
  if (tokens.length === 0) {
    findings.push({
      id: 'tenantVpp-none',
      severity: 'unknown',
      title: v.noneTitle,
      detail: v.noneDetail,
      cause: v.noneCause,
      remediation: [...v.noneRemediation],
      source: status.source,
      docsUrl: Docs.vppTokenList,
    });
  } else {
    tokens.forEach((token, index) => {
      const own = tokenFindings(token, index, status.source, now);
      if (own.some((f) => f.severity === 'critical' || f.severity === 'warning')) problems += 1;
      findings.push(...own);
    });
    findings.push({
      id: 'tenantVpp-overview',
      severity: 'unknown',
      title: v.overviewTitle,
      detail: v.overviewDetail(tokens.length),
      cause: v.overviewCause,
      remediation: [...v.overviewRemediation],
      table: {
        columns: [
          v.columns.name,
          v.columns.type,
          v.columns.expires,
          v.columns.lastSync,
          v.columns.state,
          v.columns.apps,
        ],
        rows: tokens.map((token, index) => ({
          cells: [
            v.tokenLabel(token.organizationName, index),
            token.accountType ? (v.types[token.accountType] ?? token.accountType) : v.unknownValue,
            token.expirationDateTime ? formatDate(token.expirationDateTime) : v.unknownValue,
            token.lastSyncDateTime
              ? `${formatDateTime(token.lastSyncDateTime)}${
                  token.lastSyncStatus
                    ? ` (${v.syncStatuses[token.lastSyncStatus] ?? token.lastSyncStatus})`
                    : ''
                }`
              : v.unknownValue,
            token.state ? (v.states[token.state] ?? token.state) : v.unknownValue,
            token.lastAppCount === null ? v.unknownValue : String(token.lastAppCount),
          ],
        })),
      },
      source: status.source,
      docsUrl: Docs.vppTokenList,
    });
  }

  const severity: Severity = worstActionable(findings, 'ok');
  const earliest = tokens.find((token) => token.expirationDateTime)?.expirationDateTime ?? null;
  const facts: TileFact[] = [{ label: v.facts.count, value: String(tokens.length) }];
  if (earliest) facts.push({ label: v.facts.earliest, value: formatDate(earliest) });
  return {
    ...base,
    severity,
    value: tokens.length === 0 ? v.valueNone : problems > 0 ? v.valueProblems(problems) : v.valueOk,
    summary:
      tokens.length === 0
        ? v.summaryNone
        : v.summary(tokens.length, earliest ? formatDate(earliest) : null),
    findings: sortFindings(findings),
    sources: [status.source],
    facts,
  };
}

// ---------- Nicht über die dokumentierte v1.0-API verfügbar ----------

function evaluateUnavailable(): Tile {
  const u = t.unavailable;
  const items = [
    { key: 'ade', ...u.ade, docsUrl: Docs.depOnboardingSettingBeta },
    { key: 'android', ...u.android, docsUrl: Docs.androidManagedStoreSettingsBeta },
    { key: 'autopilot', ...u.autopilot, docsUrl: Docs.windowsAutopilotSettingsBeta },
    { key: 'ndes', ...u.ndes, docsUrl: Docs.ndesConnectorBeta },
  ];
  // Die Endpunkte werden nie aufgerufen; die „Quelle“ verweist auf die Beta-Doku des Bereichs.
  const sourceOf = (item: (typeof items)[number]) => ({
    kind: 'graph' as const,
    label: u.sourceLabel(item.resource),
    docsUrl: item.docsUrl,
  });
  const findings: Finding[] = items.map((item) => ({
    id: `tenantUnavailable-${item.key}`,
    severity: 'unknown',
    title: item.title,
    detail: u.betaOnly(item.resource),
    cause: u.cause,
    remediation: [...item.remediation],
    source: sourceOf(item),
    docsUrl: item.docsUrl,
  }));
  return {
    id: 'tenantUnavailable',
    title: de.tiles.tenantUnavailable,
    state: 'ready',
    severity: 'unknown',
    value: u.value(items.length),
    summary: u.summary,
    findings,
    sources: items.map(sourceOf),
    facts: [{ label: u.facts.count, value: String(items.length) }],
    availability: 'unavailable',
    sections: [],
  };
}

/**
 * Kacheln der Ansicht „Mandant“ in fester Reihenfolge: Compliance- und Konfigurations-Übersicht (M20),
 * Dienststatus und Registrierungsfehler (M18), letzte Änderungen (M20), Push-Zertifikat, VPP-Token, nicht abrufbare Bereiche.
 */
export function evaluateTenant(status: TenantStatus, now: Date): Tile[] {
  return [
    evaluateTenantCompliance(status.complianceSummary, status.complianceSettings),
    evaluateTenantConfiguration(status.configurationSummary),
    evaluateServiceHealth(status.serviceHealth, now),
    evaluateEnrollmentFailures(status.enrollmentFailures, now),
    evaluateTenantChanges(status.auditEvents, now),
    evaluatePush(status.applePushCertificate, now),
    evaluateVpp(status.vppTokens, now),
    evaluateUnavailable(),
  ];
}

export type TenantSectionKey = keyof typeof de.fleet.sections;

/** Abschnitte der Ansicht „Mandant“ (M20): welche Kachel unter welcher Überschrift steht. */
export const TENANT_SECTIONS: ReadonlyArray<{ key: TenantSectionKey; tiles: readonly TileId[] }> = [
  { key: 'overview', tiles: ['tenantCompliance', 'tenantConfiguration'] },
  { key: 'service', tiles: ['tenantServiceHealth', 'tenantEnrollmentFailures'] },
  { key: 'changes', tiles: ['tenantChanges'] },
  { key: 'certificates', tiles: ['tenantApplePush', 'tenantVpp', 'tenantUnavailable'] },
];

/** Kacheln nach Abschnitt; leere Abschnitte entfallen. */
export function groupTenantTiles(tiles: Tile[]): Array<{ key: TenantSectionKey; tiles: Tile[] }> {
  return TENANT_SECTIONS.map((section) => ({
    key: section.key,
    tiles: tiles.filter((tile) => section.tiles.includes(tile.id)),
  })).filter((section) => section.tiles.length > 0);
}
