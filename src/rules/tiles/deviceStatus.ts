/**
 * Gerätestatus: Entra-Objekt (aktiviert/vorhanden), Mobile-Threat-Defense, Jailbreak, Speicher.
 */
import { formatBytes, formatDate, formatPercent } from '../../domain/format';
import type { DeviceSnapshot, Finding, Severity, Tile, TileFact } from '../../domain/types';
import { de } from '../../i18n/de';
import {
  availabilityOf,
  loadingTile,
  sectionIssueFinding,
  sectionsLoaded,
  sortFindings,
  summaryForIssue,
  uniqueSources,
  worstActionable,
} from '../helpers';
import { Docs } from '../knowledge/docs';
import { THRESHOLDS } from '../thresholds';

const t = de.rules.deviceStatus;
const f = de.rules.facts;

const THREAT_CRITICAL = new Set(['highSeverity', 'compromised']);
const THREAT_WARNING = new Set(['mediumSeverity']);

export function evaluateDeviceStatus(snapshot: DeviceSnapshot, _now: Date): Tile {
  void _now;
  const sections: Tile['sections'] = ['entraDevice'];
  if (!sectionsLoaded(snapshot, sections)) return loadingTile('deviceStatus', sections);
  const { device } = snapshot;
  const entra = snapshot.entraDevice!;
  const findings: Finding[] = [];
  const facts: TileFact[] = [];
  const values: Array<{ severity: Severity; value: string }> = [];

  if (entra.status === 'ok') {
    if (entra.data === null) {
      findings.push({
        id: 'deviceStatus-noEntra',
        severity: 'warning',
        title: t.noEntraTitle,
        detail: t.noEntraDetail(device.azureADDeviceId ?? '–'),
        cause: t.noEntraCause,
        remediation: [...t.noEntraRemediation],
        evidence: { azureADDeviceId: device.azureADDeviceId },
        source: entra.source,
        docsUrl: Docs.entraStaleDevices,
      });
      values.push({ severity: 'warning', value: t.valueNoEntra });
      facts.push({ label: f.entraStatus, value: t.valueNoEntra });
    } else {
      const e = entra.data;
      if (e.accountEnabled === false) {
        findings.push({
          id: 'deviceStatus-disabled',
          severity: 'critical',
          title: t.disabledTitle,
          detail: t.disabledDetail(e.displayName ?? device.deviceName),
          cause: t.disabledCause,
          remediation: [...t.disabledRemediation],
          evidence: {
            accountEnabled: e.accountEnabled,
            deviceId: e.deviceId,
            trustType: e.trustType,
            approximateLastSignInDateTime: e.approximateLastSignInDateTime,
          },
          source: entra.source,
          docsUrl: Docs.entraDisableDevice,
        });
        values.push({ severity: 'critical', value: t.valueDisabled });
      }
      facts.push({
        label: f.entraStatus,
        value:
          e.accountEnabled === false
            ? t.valueDisabled
            : e.accountEnabled
              ? t.valueActive
              : f.unknown,
      });
      if (e.trustType) facts.push({ label: f.trustType, value: de.rules.trustType[e.trustType] });
    }
  } else {
    findings.push(sectionIssueFinding('deviceStatus-entra', entra));
  }

  const threat = device.partnerReportedThreatState;
  if (THREAT_CRITICAL.has(threat) || THREAT_WARNING.has(threat)) {
    const severity: Severity = THREAT_CRITICAL.has(threat) ? 'critical' : 'warning';
    findings.push({
      id: 'deviceStatus-threat',
      severity,
      title: t.threatTitle(threat),
      detail: t.threatDetail,
      cause: t.threatCause,
      remediation: [...t.threatRemediation],
      evidence: { partnerReportedThreatState: threat },
      source: device.source,
      docsUrl: Docs.managedDevice,
    });
    values.push({ severity, value: t.valueThreat });
  }

  if (device.jailBroken === 'True') {
    findings.push({
      id: 'deviceStatus-jailbroken',
      severity: 'critical',
      title: t.jailbrokenTitle,
      detail: t.jailbrokenDetail,
      cause: t.jailbrokenCause,
      remediation: [...t.jailbrokenRemediation],
      evidence: { jailBroken: device.jailBroken },
      source: device.source,
      docsUrl: Docs.managedDevice,
    });
    values.push({ severity: 'critical', value: t.valueJailbroken });
  }

  const free = device.freeStorageSpaceInBytes;
  const total = device.totalStorageSpaceInBytes;
  if (free != null && total != null && total > 0) {
    const ratio = free / total;
    facts.push({
      label: f.storage,
      value: `${formatBytes(free)} / ${formatBytes(total)} (${formatPercent(ratio)})`,
    });
    if (ratio < THRESHOLDS.lowStorageRatio) {
      findings.push({
        id: 'deviceStatus-storage',
        severity: 'warning',
        title: t.lowStorageTitle,
        detail: t.lowStorageDetail(formatBytes(free), formatBytes(total), formatPercent(ratio)),
        cause: t.lowStorageCause,
        remediation: [...t.lowStorageRemediation],
        evidence: { freeStorageSpaceInBytes: free, totalStorageSpaceInBytes: total },
        source: device.source,
        docsUrl: Docs.managedDevice,
      });
      values.push({ severity: 'warning', value: t.valueLowStorage });
    }
  }

  facts.push({ label: f.managementAgent, value: de.rules.managementAgent[device.managementAgent] });
  facts.push({ label: f.enrollmentType, value: device.deviceEnrollmentType, mono: true });
  if (device.enrolledDateTime)
    facts.push({ label: f.enrolled, value: formatDate(device.enrolledDateTime) });
  if (threat !== 'unknown') facts.push({ label: f.threatState, value: threat, mono: true });

  const severity = worstActionable(findings, entra.status === 'ok' ? 'ok' : 'unknown');
  const primary = values.find((v) => v.severity === severity)?.value;
  const summaryParts = [
    entra.status === 'ok'
      ? entra.data?.trustType
        ? de.rules.trustType[entra.data.trustType]
        : null
      : summaryForIssue(entra),
    de.rules.managementAgent[device.managementAgent],
  ].filter((part): part is string => Boolean(part));

  return {
    id: 'deviceStatus',
    title: de.tiles.deviceStatus,
    state: 'ready',
    severity,
    value: primary ?? (entra.status === 'ok' ? t.valueActive : de.availability[entra.status]),
    summary: t.summary(summaryParts),
    findings: sortFindings(findings),
    sources: uniqueSources([device.source, entra.source]),
    facts,
    availability: availabilityOf(entra),
    sections,
  };
}
