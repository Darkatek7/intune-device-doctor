/**
 * Kachel „Endpunktsicherheit“ (Beta-API, freigegebene Ausnahme M21): je Bereich mindestens eine
 * zugewiesene Richtlinie des **empfohlenen Profils** – nur die Bereiche, die Microsoft auf „Configure
 * Microsoft Intune for Zero Trust: Secure devices“ als Empfehlung nennt (jeweils „configured and assigned“).
 * Endpunkterkennung und -reaktion (EDR) nennt die Seite nicht als eigene Empfehlung → nur Fakt.
 *
 * Bereich ≠ Profil: Eine Vorlagenfamilie enthält mehrere Profile (Learn, Profillisten je Richtlinientyp),
 * die Empfehlung nennt aber ein bestimmtes. Beispiele: Kontoschutz = „Account protection“, „Local admin
 * password solution (Windows LAPS)“, „Local user group membership“ – empfohlen ist „Configure and deploy a
 * Local user group membership profile“. Verringerung der Angriffsfläche = u. a. „Device control“,
 * „Exploit protection“ – empfohlen ist „deploy Attack Surface Reduction Rules profiles“.
 *
 * **Heuristik, offen ausgewiesen:** Graph dokumentiert keine Liste der Vorlagen-IDs je Profil. Die App ordnet
 * eine Richtlinie deshalb über `templateReference.templateDisplayName` zu – Vergleich ohne Groß-/
 * Kleinschreibung mit dem auf Learn genannten englischen Profilnamen (`profiles`). Das steht auch im Text
 * der Kachel (Fakt „Zuordnung zum Profil“, Befund „Profiltyp nicht eindeutig“).
 * - Zugewiesene Richtlinie mit passendem Vorlagennamen → erfüllt.
 * - Zugewiesene Richtlinien der Familie, aber keine mit passendem (oder überhaupt einem) Vorlagennamen →
 *   nicht prüfbar „Profiltyp nicht eindeutig“, die gefundenen Richtlinien samt Vorlagennamen im Befund.
 * - Keine zugewiesene Richtlinie der Familie → weicht ab (wie bisher).
 * - `profiles: null` = Learn listet für Familie und Plattform genau ein Profil (macOS: Antivirus, FileVault,
 *   macOS firewall) → die Familie ist eindeutig, kein Namensvergleich nötig.
 *
 * Plattform mit nachweislich 0 Geräten → keine Prüfung. Severity: fehlende Richtlinie → warning,
 * nicht eindeutig → Hinweis. Grenze: Gelesen werden nur Richtlinien im Einstellungskatalog-Format; Profile
 * aus älteren Vorlagen (Intents) sieht die App nicht – das steht im Befundtext.
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
  /** Learn-Empfehlung (Zero Trust für Geräte) */
  docsUrl: string;
  /**
   * Englische Profilnamen laut Learn, die die Empfehlung erfüllen (Vergleich mit `templateDisplayName`
   * ohne Groß-/Kleinschreibung). null = Learn listet für Familie und Plattform nur ein Profil.
   */
  profiles: readonly string[] | null;
  /** Learn-Seite mit der Profilliste des Richtlinientyps */
  profilesDocsUrl: string;
}

export const ENDPOINT_AREAS: readonly EndpointArea[] = [
  {
    // „Configure Intune policies to manage Microsoft Defender Antivirus“; weitere Profile der Familie:
    // Microsoft Defender Antivirus exclusions, Windows Security experience, Defender Update controls
    key: 'antivirusWindows',
    family: 'endpointSecurityAntivirus',
    platform: 'windows10',
    docsUrl: Docs.postureZtAntivirusWindows,
    profiles: ['Microsoft Defender Antivirus'],
    profilesDocsUrl: Docs.postureEsAntivirusProfiles,
  },
  {
    key: 'antivirusMacos',
    family: 'endpointSecurityAntivirus',
    platform: 'macOS',
    docsUrl: Docs.postureZtAntivirusMacos,
    profiles: null,
    profilesDocsUrl: Docs.postureEsAntivirusProfiles,
  },
  {
    // „Create a BitLocker policy“; weiteres Profil der Familie: Personal Data Encryption
    key: 'diskEncryptionWindows',
    family: 'endpointSecurityDiskEncryption',
    platform: 'windows10',
    docsUrl: Docs.postureZtBitLocker,
    profiles: ['BitLocker'],
    profilesDocsUrl: Docs.postureEsDiskEncryptionProfiles,
  },
  {
    // „Create a FileVault disk encryption policy“ – FileVault ist das einzige macOS-Profil der Familie
    key: 'diskEncryptionMacos',
    family: 'endpointSecurityDiskEncryption',
    platform: 'macOS',
    docsUrl: Docs.postureZtFileVault,
    profiles: null,
    profilesDocsUrl: Docs.postureEsDiskEncryptionProfiles,
  },
  {
    // Learn nennt beide als „two complementary profiles“; weiteres Profil: Windows Hyper-V Firewall Rules
    key: 'firewallWindows',
    family: 'endpointSecurityFirewall',
    platform: 'windows10',
    docsUrl: Docs.postureZtFirewallWindows,
    profiles: ['Windows Firewall', 'Windows Firewall Rules'],
    profilesDocsUrl: Docs.postureEsFirewallProfiles,
  },
  {
    key: 'firewallMacos',
    family: 'endpointSecurityFirewall',
    platform: 'macOS',
    docsUrl: Docs.postureZtFirewallMacos,
    profiles: null,
    profilesDocsUrl: Docs.postureEsFirewallProfiles,
  },
  {
    // „deploy Attack Surface Reduction Rules profiles“
    key: 'asrWindows',
    family: 'endpointSecurityAttackSurfaceReduction',
    platform: 'windows10',
    docsUrl: Docs.postureZtAsr,
    profiles: ['Attack Surface Reduction Rules'],
    profilesDocsUrl: Docs.postureEsAsrProfiles,
  },
  {
    // „Configure and deploy a Local user group membership profile“
    key: 'accountProtectionWindows',
    family: 'endpointSecurityAccountProtection',
    platform: 'windows10',
    docsUrl: Docs.postureZtLocalAccounts,
    profiles: ['Local user group membership'],
    profilesDocsUrl: Docs.postureEsAccountProtectionProfiles,
  },
];

const normalize = (name: string) => name.trim().toLowerCase();

/** Passt der Vorlagenname einer Richtlinie zu einem der empfohlenen Profile? */
export function matchesProfile(policy: CatalogPolicyConfig, area: EndpointArea): boolean {
  if (area.profiles === null) return true;
  const name = policy.templateDisplayName;
  if (!name) return false;
  return area.profiles.some((profile) => normalize(profile) === normalize(name));
}

interface AreaResult {
  outcome: CheckOutcome;
  /** Zugewiesene (oder in der Zuweisung unbekannte) Richtlinien der Familie ohne passenden Vorlagennamen */
  ambiguous: CatalogPolicyConfig[];
}

export function areaOutcome(
  area: EndpointArea,
  family: CatalogPolicyConfig[],
  truncated: boolean,
): AreaResult {
  const recommended = family.filter((policy) => matchesProfile(policy, area));
  const assigned = recommended.filter((policy) => policy.isAssigned === true);
  if (assigned.length > 0) {
    return { outcome: { status: 'met', actual: t.actualAssigned(assigned.length) }, ambiguous: [] };
  }
  if (recommended.some((policy) => policy.isAssigned === null)) {
    return {
      outcome: {
        status: 'notChecked',
        actual: t.actualUnknown(recommended.length),
        reason: dePosture.coverage.assignmentUnknownReason,
      },
      ambiguous: [],
    };
  }
  // Andere Profile der Familie sind zugewiesen (oder unbekannt): ob eines davon das empfohlene Profil ist,
  // lässt sich über den Vorlagennamen nicht sagen → nicht prüfbar statt einer falschen Aussage
  const others = family.filter(
    (policy) => !matchesProfile(policy, area) && policy.isAssigned !== false,
  );
  if (others.length > 0) {
    return {
      outcome: {
        status: 'notChecked',
        actual: t.actualOtherProfiles(others.length),
        reason: t.ambiguousReason,
      },
      ambiguous: others,
    };
  }
  const actual = family.length > 0 ? t.actualUnassigned(family.length) : t.actualNone;
  if (truncated) {
    return { outcome: { status: 'notChecked', actual, reason: c.noPolicyInList }, ambiguous: [] };
  }
  return { outcome: { status: 'deviating', actual }, ambiguous: [] };
}

export function evaluateEndpointSecurity(posture: TenantPosture): PostureTile {
  const section = posture.catalogPolicies;
  if (section.status !== 'ok') return issueTile(ID, section);
  const source = section.source;
  const { policies, truncated } = section.data;
  const findings: Finding[] = truncated ? [truncatedFinding(ID, source)] : [];
  const facts: TileFact[] = [
    { label: c.betaFact, value: c.betaValue },
    { label: t.matchingFact, value: t.matchingValue },
  ];
  const checks: PostureCheckResult[] = [];
  const devices = {
    windows10: deviceCount(posture.platformCounts, 'windows'),
    macOS: deviceCount(posture.platformCounts, 'macos'),
  };

  for (const area of ENDPOINT_AREAS) {
    // Nachweislich keine Geräte der Plattform → Empfehlung greift nicht
    if (devices[area.platform] === 0) continue;
    const label = t.areas[area.key];
    const family = policies.filter(
      (policy) =>
        policy.templateFamily === area.family && hasPlatform(policy.platforms, area.platform),
    );
    const { outcome, ambiguous } = areaOutcome(area, family, truncated);
    checks.push({
      id: `${ID}:${area.key}`,
      tile: ID,
      label,
      status: outcome.status,
      level: null,
      actual: outcome.actual,
      expected: area.profiles === null ? t.expected : t.expectedProfile(area.profiles),
      docsUrl: area.docsUrl,
      ...(outcome.reason ? { reason: outcome.reason } : {}),
      counted: true,
    });
    if (outcome.status === 'deviating') {
      findings.push({
        id: `${ID}-${area.key}`,
        severity: 'warning',
        title: t.title(label),
        detail: area.profiles === null ? t.detail : `${t.detail} ${t.profileNote(area.profiles)}`,
        cause: t.cause,
        remediation: [...t.remediation],
        evidence: {
          templateFamily: area.family,
          platform: area.platform,
          policies: family.length,
        },
        source,
        docsUrl: area.docsUrl,
      });
    }
    if (ambiguous.length > 0 && area.profiles !== null) {
      const col = t.ambiguousColumns;
      findings.push({
        id: `${ID}-${area.key}-ambiguous`,
        severity: 'unknown',
        title: t.ambiguousTitle(label),
        detail: t.ambiguousDetail(area.profiles),
        cause: t.ambiguousCause,
        remediation: [...t.ambiguousRemediation],
        table: {
          columns: [col.policy, col.template, col.assigned],
          columnLangs: [null, 'en', null],
          rows: ambiguous.map((policy) => ({
            cells: [
              policy.name,
              policy.templateDisplayName ?? t.noTemplateName,
              policy.isAssigned === true ? t.assignedYes : t.assignedUnknown,
            ],
            cellLangs: [null, policy.templateDisplayName ? 'en' : null, null],
          })),
        },
        evidence: {
          templateFamily: area.family,
          platform: area.platform,
          expectedProfiles: area.profiles.join(', '),
        },
        source,
        docsUrl: area.profilesDocsUrl,
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
