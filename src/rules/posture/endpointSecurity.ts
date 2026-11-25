/**
 * Kachel „Endpunktsicherheit“ (Beta-API, freigegebene Ausnahme M21): je Bereich mindestens eine
 * zugewiesene Richtlinie – nur die Bereiche, die Microsoft auf „Configure Microsoft Intune for Zero Trust:
 * Secure devices“ als Empfehlung nennt (jeweils „configured and assigned“):
 * Antivirus (Windows, macOS), BitLocker (Windows), FileVault (macOS), Firewall (Windows, macOS),
 * Verringerung der Angriffsfläche (Windows), Kontoschutz/lokale Gruppenmitgliedschaft (Windows).
 * Endpunkterkennung und -reaktion (EDR) nennt die Seite nicht als eigene Empfehlung → nur Fakt.
 *
 * Plattform mit nachweislich 0 Geräten → keine Prüfung. Severity: fehlende Richtlinie → warning.
 * Grenze: Gelesen werden nur Richtlinien im Einstellungskatalog-Format; Profile aus älteren Vorlagen
 * (Intents) sieht die App nicht – das steht im Befundtext.
 */
import type { CatalogPolicyConfig, TenantPosture } from '../../domain/posture';
import type { Finding, TileFact } from '../../domain/types';
import { dePosture } from '../../i18n/de-posture';
import { Docs } from '../knowledge/docs';
import { hasPlatform } from './baselines';
import { buildTile, deviceCount, issueTile, truncatedFinding } from './kit';
import type { CheckOutcome, PostureCheckResult, PostureTile } from './types';

const t = dePosture.endpointSecurity;
const c = dePosture.common;
const ID = 'postureEndpointSecurity' as const;

type AreaKey = keyof typeof t.areas;

export interface EndpointArea {
  key: AreaKey;
  /** `templateReference.templateFamily` laut Graph (beta) */
  family: string;
  platform: 'windows10' | 'macOS';
  docsUrl: string;
}

export const ENDPOINT_AREAS: readonly EndpointArea[] = [
  {
    key: 'antivirusWindows',
    family: 'endpointSecurityAntivirus',
    platform: 'windows10',
    docsUrl: Docs.postureZtAntivirusWindows,
  },
  {
    key: 'antivirusMacos',
    family: 'endpointSecurityAntivirus',
    platform: 'macOS',
    docsUrl: Docs.postureZtAntivirusMacos,
  },
  {
    key: 'diskEncryptionWindows',
    family: 'endpointSecurityDiskEncryption',
    platform: 'windows10',
    docsUrl: Docs.postureZtBitLocker,
  },
  {
    key: 'diskEncryptionMacos',
    family: 'endpointSecurityDiskEncryption',
    platform: 'macOS',
    docsUrl: Docs.postureZtFileVault,
  },
  {
    key: 'firewallWindows',
    family: 'endpointSecurityFirewall',
    platform: 'windows10',
    docsUrl: Docs.postureZtFirewallWindows,
  },
  {
    key: 'firewallMacos',
    family: 'endpointSecurityFirewall',
    platform: 'macOS',
    docsUrl: Docs.postureZtFirewallMacos,
  },
  {
    key: 'asrWindows',
    family: 'endpointSecurityAttackSurfaceReduction',
    platform: 'windows10',
    docsUrl: Docs.postureZtAsr,
  },
  {
    key: 'accountProtectionWindows',
    family: 'endpointSecurityAccountProtection',
    platform: 'windows10',
    docsUrl: Docs.postureZtLocalAccounts,
  },
];

function areaOutcome(policies: CatalogPolicyConfig[], truncated: boolean): CheckOutcome {
  const assigned = policies.filter((policy) => policy.isAssigned === true);
  if (assigned.length > 0) return { status: 'met', actual: t.actualAssigned(assigned.length) };
  if (policies.some((policy) => policy.isAssigned === null)) {
    return {
      status: 'notChecked',
      actual: t.actualUnknown(policies.length),
      reason: dePosture.coverage.assignmentUnknownReason,
    };
  }
  if (truncated) {
    return {
      status: 'notChecked',
      actual: policies.length > 0 ? t.actualUnassigned(policies.length) : t.actualNone,
      reason: c.noPolicyInList,
    };
  }
  return {
    status: 'deviating',
    actual: policies.length > 0 ? t.actualUnassigned(policies.length) : t.actualNone,
  };
}

export function evaluateEndpointSecurity(posture: TenantPosture): PostureTile {
  const section = posture.catalogPolicies;
  if (section.status !== 'ok') return issueTile(ID, section);
  const source = section.source;
  const { policies, truncated } = section.data;
  const findings: Finding[] = truncated ? [truncatedFinding(ID, source)] : [];
  const facts: TileFact[] = [{ label: c.betaFact, value: c.betaValue }];
  const checks: PostureCheckResult[] = [];
  const devices = {
    windows10: deviceCount(posture.platformCounts, 'windows'),
    macOS: deviceCount(posture.platformCounts, 'macos'),
  };

  for (const area of ENDPOINT_AREAS) {
    // Nachweislich keine Geräte der Plattform → Empfehlung greift nicht
    if (devices[area.platform] === 0) continue;
    const label = t.areas[area.key];
    const matching = policies.filter(
      (policy) =>
        policy.templateFamily === area.family && hasPlatform(policy.platforms, area.platform),
    );
    const outcome = areaOutcome(matching, truncated);
    checks.push({
      id: `${ID}:${area.key}`,
      tile: ID,
      label,
      status: outcome.status,
      level: null,
      actual: outcome.actual,
      expected: t.expected,
      docsUrl: area.docsUrl,
      ...(outcome.reason ? { reason: outcome.reason } : {}),
      counted: true,
    });
    if (outcome.status === 'deviating') {
      findings.push({
        id: `${ID}-${area.key}`,
        severity: 'warning',
        title: t.title(label),
        detail: t.detail,
        cause: t.cause,
        remediation: [...t.remediation],
        evidence: {
          templateFamily: area.family,
          platform: area.platform,
          policies: matching.length,
        },
        source,
        docsUrl: area.docsUrl,
      });
    }
  }

  const edr = policies.filter(
    (policy) => policy.templateFamily === 'endpointSecurityEndpointDetectionAndResponse',
  );
  facts.push({ label: t.edrFact, value: t.edrValue(edr.length) });

  const met = checks.filter((check) => check.status === 'met').length;
  const evaluated = checks.filter((check) => check.status !== 'notChecked').length;
  return buildTile({
    id: ID,
    value: evaluated === 0 ? c.valueNotChecked : t.value(met, evaluated),
    summary: `${dePosture.common.summaryCounts(
      met,
      evaluated - met,
      checks.length - evaluated,
    )} · ${c.beta}`,
    findings,
    facts,
    sources: [source, posture.platformCounts.source],
    checks,
  });
}
