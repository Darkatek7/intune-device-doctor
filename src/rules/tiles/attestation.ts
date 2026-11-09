/**
 * Integritätsnachweis / Device Health Attestation (nur Windows): zeigt die Rohwerte aus
 * managedDevice.deviceHealthAttestationState. Microsoft dokumentiert für fast alle Felder keine Werte
 * (String ohne Aufzählung) – deshalb keine Bewertung einzelner Werte.
 * - healthStatusMismatchInfo gesetzt ("This attribute appears if DHA-Service detects an integrity issue") → warning
 * - alle Felder leer → Hinweis (kein Befund)
 * - sonst ok, mit Rohwerten als Fakten
 */
import { formatDateTime } from '../../domain/format';
import type { DeviceSnapshot, Finding, Tile, TileFact } from '../../domain/types';
import { de } from '../../i18n/de';
import {
  availabilityOf,
  loadingTile,
  sectionsLoaded,
  sortFindings,
  unavailableTile,
  worstActionable,
} from '../helpers';
import { Docs } from '../knowledge/docs';

const t = de.rules.attestation;

/** Zeitwerte sind laut Doku teils String, teils DateTimeOffset – nur ISO-artige Werte formatieren. */
function displayTime(value: string): { value: string; title?: string } {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? { value }
    : { value: formatDateTime(value), title: value };
}

/** `now` wird nicht gebraucht (keine zeitabhängige Bewertung), bleibt aber für eine einheitliche Regel-Signatur. */
export function evaluateAttestation(snapshot: DeviceSnapshot): Tile {
  const sections: Tile['sections'] = ['healthAttestation'];
  if (!sectionsLoaded(snapshot, sections)) return loadingTile('attestation', sections);
  const section = snapshot.healthAttestation!;
  if (section.status !== 'ok') return unavailableTile('attestation', sections, section);

  const { data } = section;
  const base = { source: section.source, docsUrl: Docs.healthAttestationResource };
  const findings: Finding[] = [];

  const hasAnyValue = Object.values(data).some((v) => v !== null);
  const mismatch = data.healthStatusMismatchInfo;

  if (mismatch !== null) {
    findings.push({
      ...base,
      id: 'attestation-mismatch',
      severity: 'warning',
      title: t.mismatchTitle,
      detail: t.mismatchDetail(mismatch),
      cause: t.mismatchCause,
      remediation: [...t.mismatchRemediation],
      evidence: { healthStatusMismatchInfo: mismatch },
    });
  } else if (!hasAnyValue) {
    findings.push({
      ...base,
      id: 'attestation-noData',
      severity: 'unknown',
      title: t.noneTitle,
      detail: t.noneDetail,
      cause: t.noneCause,
      remediation: [...t.noneRemediation],
    });
  }

  const facts: TileFact[] = [];
  const raw = (label: string, value: string | null, mono = true) => {
    if (value !== null) facts.push({ label, value, mono });
  };
  raw(t.facts.secureBoot, data.secureBoot);
  raw(t.facts.bitLockerStatus, data.bitLockerStatus);
  raw(t.facts.codeIntegrity, data.codeIntegrity);
  raw(t.facts.elam, data.earlyLaunchAntiMalwareDriverProtection);
  raw(t.facts.bootDebugging, data.bootDebugging);
  raw(t.facts.testSigning, data.testSigning);
  raw(t.facts.tpmVersion, data.tpmVersion);
  raw(t.facts.supported, data.healthAttestationSupportedStatus);
  raw(t.facts.mismatch, data.healthStatusMismatchInfo);
  if (data.lastUpdateDateTime !== null) {
    facts.push({ label: t.facts.lastUpdate, ...displayTime(data.lastUpdateDateTime) });
  }
  if (data.issuedDateTime !== null) {
    facts.push({ label: t.facts.issued, ...displayTime(data.issuedDateTime) });
  }
  facts.push({ label: t.facts.note, value: t.facts.noteValue });

  return {
    id: 'attestation',
    title: de.tiles.attestation,
    state: 'ready',
    severity: worstActionable(findings, 'ok'),
    value: mismatch !== null ? t.valueMismatch : hasAnyValue ? t.valueData : t.valueNone,
    summary: hasAnyValue ? t.summaryData : t.summaryNone,
    findings: sortFindings(findings),
    sources: [section.source],
    facts,
    availability: availabilityOf(section),
    sections,
  };
}
