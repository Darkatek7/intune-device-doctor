/**
 * Microsoft Defender (windowsProtectionState + detectedMalwareState).
 * critical: aktive Malware, Schutz/Echtzeitschutz aus, deviceState critical, kritische productStatus-Flags.
 * warning: Signaturen/Scan überfällig, Neustart/Scan/manuelle Schritte ausstehend, Manipulationsschutz aus,
 *          behandelte Bedrohungen, weitere productStatus-Flags.
 */
import { formatDateTime, formatRelativeTime } from '../../domain/format';
import type {
  DeviceSnapshot,
  Finding,
  Severity,
  Tile,
  TileFact,
  WindowsProtectionInfo,
} from '../../domain/types';
import { de } from '../../i18n/de';
import {
  loadingTile,
  sectionsLoaded,
  sortFindings,
  unavailableTile,
  worstActionable,
} from '../helpers';
import { Docs } from '../knowledge/docs';

const t = de.rules.defender;
const f = de.rules.facts;

const ACTIVE_THREAT_STATES = new Set(['active', 'actionFailed']);
const NEEDS_ACTION_THREAT_STATES = new Set([
  'manualStepsRequired',
  'fullScanRequired',
  'rebootRequired',
]);
/** productStatus-Flags, die bereits über Booleans/deviceState abgedeckt sind */
const COVERED_FLAGS = new Set([
  'noStatus',
  'noStatusFlagsSet',
  'avSignaturesOutOfDate',
  'pendingRebootDueToThreatAction',
  'offlineScanRequired',
]);
const CRITICAL_FLAGS = new Set([
  'serviceNotRunning',
  'serviceStartedWithoutMalwareProtection',
  'threatRemediationFailedCritically',
  'productExpired',
]);
/** Rein informative Flags ohne Handlungsbedarf */
const INFO_FLAGS = new Set([
  'systemInitiatedScanInProgress',
  'systemInitiatedCleanInProgress',
  'platformUpdateInProgress',
  'serviceShutdownAsPartOfSystemShutdown',
]);

function onOff(value: boolean | null): string {
  return value === true ? f.on : value === false ? f.off : f.unknown;
}

export function evaluateDefender(snapshot: DeviceSnapshot, now: Date): Tile {
  const sections: Tile['sections'] = ['protection'];
  if (!sectionsLoaded(snapshot, sections)) return loadingTile('defender', sections);
  const section = snapshot.protection!;
  if (section.status !== 'ok') return unavailableTile('defender', sections, section);
  const p = section.data;
  const source = section.source;
  const findings: Finding[] = [];
  const labels: Array<{ severity: Severity; value: string }> = [];
  const add = (
    finding: Omit<Finding, 'source'> & { source?: Finding['source'] },
    value: string,
  ) => {
    findings.push({ source, ...finding });
    labels.push({ severity: finding.severity, value });
  };
  const baseEvidence = evidenceOf(p);

  for (const m of p.detectedMalware) {
    const name = m.displayName ?? m.category ?? m.id;
    const detail = t.malwareDetail(
      m.severity,
      m.state,
      m.threatState,
      m.initialDetectionDateTime ? formatRelativeTime(m.initialDetectionDateTime, now) : '–',
    );
    const evidence = {
      displayName: m.displayName,
      category: m.category,
      severity: m.severity,
      state: m.state,
      threatState: m.threatState,
      initialDetectionDateTime: m.initialDetectionDateTime,
      lastStateChangeDateTime: m.lastStateChangeDateTime,
      detectionCount: m.detectionCount,
    };
    if (ACTIVE_THREAT_STATES.has(m.threatState)) {
      add(
        {
          id: `defender-malware-${m.id}`,
          severity: 'critical',
          title: t.activeMalwareTitle(name),
          detail,
          cause: t.activeMalwareCause,
          remediation: [...t.activeMalwareRemediation],
          evidence,
          docsUrl: m.additionalInformationUrl ?? Docs.malwareState,
        },
        t.valueThreat,
      );
    } else {
      add(
        {
          id: `defender-malware-${m.id}`,
          severity:
            NEEDS_ACTION_THREAT_STATES.has(m.threatState) || m.severity !== 'low'
              ? 'warning'
              : 'unknown',
          title: t.remediatedMalwareTitle(name),
          detail,
          cause: t.remediatedMalwareCause,
          remediation: [...t.remediatedMalwareRemediation],
          evidence,
          docsUrl: m.additionalInformationUrl ?? Docs.malwareState,
        },
        t.valueTreated,
      );
    }
  }

  if (p.malwareProtectionEnabled === false) {
    add(
      {
        id: 'defender-protectionOff',
        severity: 'critical',
        title: t.protectionOffTitle,
        detail: t.protectionOffDetail,
        cause: t.protectionOffCause,
        remediation: [...t.protectionOffRemediation],
        evidence: baseEvidence,
        docsUrl: Docs.defenderNotUpdated,
      },
      t.valueDisabled,
    );
  } else if (p.realTimeProtectionEnabled === false) {
    add(
      {
        id: 'defender-rtpOff',
        severity: 'critical',
        title: t.rtpOffTitle,
        detail: t.rtpOffDetail,
        cause: t.protectionOffCause,
        remediation: [...t.protectionOffRemediation],
        evidence: baseEvidence,
        docsUrl: Docs.realTimeProtection,
      },
      t.valueDisabled,
    );
  }

  if (p.deviceState === 'critical') {
    add(
      {
        id: 'defender-deviceCritical',
        severity: 'critical',
        title: t.deviceCriticalTitle,
        detail: t.deviceCriticalDetail,
        cause: t.deviceCriticalCause,
        remediation: [...t.deviceCriticalRemediation],
        evidence: baseEvidence,
        docsUrl: Docs.windowsProtectionState,
      },
      t.valueCritical,
    );
  }

  if (p.signatureUpdateOverdue || p.productStatus.includes('avSignaturesOutOfDate')) {
    add(
      {
        id: 'defender-signatures',
        severity: 'warning',
        title: t.signaturesTitle,
        detail: t.signaturesDetail(p.signatureVersion ?? '–'),
        cause: t.signaturesCause,
        remediation: [...t.signaturesRemediation],
        evidence: baseEvidence,
        docsUrl: Docs.defenderNotUpdated,
      },
      t.valueSignatures,
    );
  }

  if (
    p.rebootRequired ||
    p.deviceState === 'rebootPending' ||
    p.productStatus.includes('pendingRebootDueToThreatAction')
  ) {
    add(
      {
        id: 'defender-reboot',
        severity: 'warning',
        title: t.rebootTitle,
        detail: t.rebootDetail(p.deviceState ?? '–'),
        cause: t.rebootCause,
        remediation: [...t.rebootRemediation],
        evidence: baseEvidence,
        docsUrl: Docs.windowsProtectionState,
      },
      t.valueReboot,
    );
  }

  if (p.fullScanRequired || p.deviceState === 'fullScanPending') {
    add(
      {
        id: 'defender-fullScan',
        severity: 'warning',
        title: t.fullScanTitle,
        detail: t.fullScanDetail,
        cause: t.fullScanCause,
        remediation: [...t.fullScanRemediation],
        evidence: baseEvidence,
        docsUrl: Docs.windowsProtectionState,
      },
      t.valueAttention,
    );
  }

  if (p.deviceState === 'manualStepsPending') {
    add(
      {
        id: 'defender-manualSteps',
        severity: 'warning',
        title: t.manualStepsTitle,
        detail: t.manualStepsDetail,
        cause: t.manualStepsCause,
        remediation: [...t.manualStepsRemediation],
        evidence: baseEvidence,
        docsUrl: Docs.windowsProtectionState,
      },
      t.valueAttention,
    );
  }

  if (p.deviceState === 'offlineScanPending' || p.productStatus.includes('offlineScanRequired')) {
    add(
      {
        id: 'defender-offlineScan',
        severity: 'warning',
        title: t.offlineScanTitle,
        detail: t.offlineScanDetail,
        cause: t.offlineScanCause,
        remediation: [...t.offlineScanRemediation],
        evidence: baseEvidence,
        docsUrl: Docs.windowsProtectionState,
      },
      t.valueAttention,
    );
  }

  if (p.quickScanOverdue) {
    add(
      {
        id: 'defender-quickScan',
        severity: 'warning',
        title: t.quickScanTitle,
        detail: t.quickScanDetail(
          p.lastQuickScanDateTime ? formatRelativeTime(p.lastQuickScanDateTime, now) : '–',
        ),
        cause: t.quickScanCause,
        remediation: [...t.quickScanRemediation],
        evidence: baseEvidence,
        docsUrl: Docs.windowsProtectionState,
      },
      t.valueAttention,
    );
  }

  if (p.tamperProtectionEnabled === false) {
    add(
      {
        id: 'defender-tamper',
        severity: 'warning',
        title: t.tamperTitle,
        detail: t.tamperDetail,
        cause: t.tamperCause,
        remediation: [...t.tamperRemediation],
        evidence: baseEvidence,
        docsUrl: Docs.tamperProtection,
      },
      t.valueAttention,
    );
  }

  const extraFlags = p.productStatus.filter((flag) => !COVERED_FLAGS.has(flag));
  if (extraFlags.length > 0) {
    const severity: Severity = extraFlags.some((flag) => CRITICAL_FLAGS.has(flag))
      ? 'critical'
      : extraFlags.every((flag) => INFO_FLAGS.has(flag))
        ? 'unknown'
        : 'warning';
    add(
      {
        id: 'defender-productStatus',
        severity,
        title: t.productStatusTitle,
        detail: t.productStatusDetail(
          extraFlags.map((flag) => t.productStatus[flag] ?? flag).join(', '),
        ),
        cause: t.productStatusCause,
        remediation: [...t.productStatusRemediation],
        evidence: { productStatus: p.productStatus.join(',') },
        docsUrl: Docs.defenderProductStatus,
      },
      severity === 'critical' ? t.valueCritical : t.valueAttention,
    );
  }

  const severity = worstActionable(findings);
  // Spezifische Werte (z. B. "Neustart ausstehend") vor allgemeinen ("Prüfen", "Bedrohung behandelt")
  const generic: string[] = [t.valueAttention, t.valueTreated];
  const candidates = labels.filter((l) => l.severity === severity);
  const value =
    candidates.find((l) => !generic.includes(l.value))?.value ??
    candidates[0]?.value ??
    t.valueProtected;
  const facts: TileFact[] = [
    { label: f.realTime, value: onOff(p.realTimeProtectionEnabled) },
    { label: f.tamper, value: onOff(p.tamperProtectionEnabled) },
    { label: f.signatureVersion, value: p.signatureVersion ?? '–', mono: true },
    { label: f.engineVersion, value: p.engineVersion ?? '–', mono: true },
    {
      label: f.lastQuickScan,
      value: formatRelativeTime(p.lastQuickScanDateTime, now),
      title: formatDateTime(p.lastQuickScanDateTime),
    },
    {
      label: f.lastReported,
      value: formatRelativeTime(p.lastReportedDateTime, now),
      title: formatDateTime(p.lastReportedDateTime),
    },
  ];

  return {
    id: 'defender',
    title: de.tiles.defender,
    state: 'ready',
    severity,
    value,
    summary: t.summary(formatRelativeTime(p.lastQuickScanDateTime, now)),
    findings: sortFindings(findings),
    sources: [source],
    facts,
    sections,
  };
}

function evidenceOf(p: WindowsProtectionInfo): Record<string, string | number | boolean | null> {
  return {
    malwareProtectionEnabled: p.malwareProtectionEnabled,
    realTimeProtectionEnabled: p.realTimeProtectionEnabled,
    tamperProtectionEnabled: p.tamperProtectionEnabled,
    deviceState: p.deviceState,
    productStatus: p.productStatus.join(','),
    signatureUpdateOverdue: p.signatureUpdateOverdue,
    quickScanOverdue: p.quickScanOverdue,
    fullScanRequired: p.fullScanRequired,
    rebootRequired: p.rebootRequired,
    signatureVersion: p.signatureVersion,
    engineVersion: p.engineVersion,
    lastReportedDateTime: p.lastReportedDateTime,
  };
}
