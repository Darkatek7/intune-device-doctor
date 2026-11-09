/**
 * Windows Autopilot (nur Windows, optionaler Scope DeviceManagementServiceConfig.Read.All):
 * Eintrag des Geräts in der Autopilot-Geräteliste (v1.0).
 * - enrollmentState = failed → warning
 * - Group Tag, Status, letzter Kontakt als Fakten; das Bereitstellungsprofil ist nur in beta lesbar →
 *   als „über dokumentierte API nicht verfügbar“ ausgewiesen
 * - nicht registriert → neutraler Hinweis (kein Fehler)
 */
import { formatDateTime, formatRelativeTime } from '../../domain/format';
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

const t = de.rules.autopilot;

export function evaluateAutopilot(snapshot: DeviceSnapshot, now: Date): Tile {
  const sections: Tile['sections'] = ['autopilot'];
  if (!sectionsLoaded(snapshot, sections)) return loadingTile('autopilot', sections);
  const section = snapshot.autopilot!;
  if (section.status !== 'ok') return unavailableTile('autopilot', sections, section);

  const { data } = section;
  const base = { source: section.source, docsUrl: Docs.autopilotRegistration };
  const findings: Finding[] = [];
  const facts: TileFact[] = [];

  if (data === null) {
    findings.push({
      ...base,
      id: 'autopilot-notRegistered',
      severity: 'unknown',
      title: t.notRegisteredTitle,
      detail: t.notRegisteredDetail,
      cause: t.notRegisteredCause,
      remediation: [...t.notRegisteredRemediation],
      docsUrl: Docs.autopilotRegistration,
    });
  } else {
    if (data.enrollmentState === 'failed') {
      findings.push({
        ...base,
        id: 'autopilot-failed',
        severity: 'warning',
        title: t.failedTitle,
        detail: t.failedDetail,
        cause: t.failedCause,
        remediation: [...t.failedRemediation],
        evidence: {
          enrollmentState: data.enrollmentState,
          groupTag: data.groupTag,
          lastContactedDateTime: data.lastContactedDateTime,
        },
      });
    }
    facts.push({ label: t.facts.groupTag, value: data.groupTag ?? t.facts.groupTagNone });
    facts.push({
      label: t.facts.enrollmentState,
      value: data.enrollmentState ? (t.states[data.enrollmentState] ?? data.enrollmentState) : '–',
    });
    if (data.lastContactedDateTime) {
      facts.push({
        label: t.facts.lastContacted,
        value: formatRelativeTime(data.lastContactedDateTime, now),
        title: formatDateTime(data.lastContactedDateTime),
      });
    }
    const hardware = [data.manufacturer, data.model].filter(Boolean).join(' ');
    if (hardware) facts.push({ label: t.facts.hardware, value: hardware });
    facts.push({
      label: t.facts.matchedBy,
      value:
        data.matchedBy === 'managedDeviceId'
          ? t.facts.matchedByManagedDeviceId
          : t.facts.matchedBySerialNumber,
    });
  }
  facts.push({ label: t.facts.profile, value: t.facts.profileUnavailable });

  const failed = data?.enrollmentState === 'failed';
  return {
    id: 'autopilot',
    title: de.tiles.autopilot,
    state: 'ready',
    severity: worstActionable(findings, 'ok'),
    value: data === null ? t.valueNotRegistered : failed ? t.valueFailed : t.valueRegistered,
    summary: data === null ? t.summaryNotRegistered : t.summaryRegistered(data.groupTag),
    findings: sortFindings(findings),
    sources: [section.source],
    facts,
    availability: availabilityOf(section),
    sections,
  };
}
