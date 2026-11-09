/**
 * Kachel „MDM-Diagnosebericht“ aus dem MDM-Diagnosepaket `mdmlogs-*.cab` im DiagLogs-ZIP.
 *
 * Belegt (Microsoft Learn, „Collect MDM logs“ und „Diagnose provisioning packages“) ist nur, dass
 * das Paket MDMDiagReport.xml (detaillierte MDM-Konfiguration), MdmDiagLogMetadata.json
 * (Kommandozeilenargumente), HTML-Bericht, Registry-Dump und .evtx-Dateien enthält und dass
 * `Multivariant`-Knoten eine `Condition` tragen. Der übrige Elementaufbau ist nicht dokumentiert –
 * deshalb zeigt die Kachel nur Rohdaten (Elementnamen/Anzahl, Bedingungen, Dateiliste) mit
 * Severity „Hinweis“ und ohne Deutung. Werte wie UPN, IDs, URLs und Seriennummern werden nicht
 * übernommen bzw. sind im Worker maskiert.
 */
import {
  DEFAULT_MAX_MDM_CAB_BYTES,
  DEFAULT_MAX_MDM_DIAG_XML_BYTES,
} from '../../diagnostics/limits';
import type {
  DiagEntry,
  DiagnosticsReport,
  MdmDiagMemberStatus,
  MdmDiagPackage,
} from '../../diagnostics/types';
import { formatBytes, maskUserPaths } from '../../domain/format';
import type { DataSource, Finding, Tile, TileFact } from '../../domain/types';
import { de } from '../../i18n/de';
import { sortFindings, worstActionable } from '../helpers';
import { Docs } from '../knowledge/docs';

const z = de.rules.zip;
const m = z.mdmDiagReport;

/** Anzahl der Zeilen, die als Evidenz einzeln aufgelistet werden. */
const MAX_LISTED = 40;
const MIB = 1024 * 1024;

function source(entry: DiagEntry | undefined, fallback: string): DataSource {
  return { kind: 'zip', label: `${z.sourcePrefix} · ${maskUserPaths(entry?.path ?? fallback)}` };
}

const mib = (bytes: number): number => Math.max(1, Math.ceil(bytes / MIB));

function packageProblem(pkg: MdmDiagPackage): { key: string; text: string } {
  switch (pkg.status) {
    case 'tooLarge':
      return {
        key: 'tooLarge',
        text: m.packageReason.tooLarge(
          mib(pkg.sizeBytes),
          Math.round(DEFAULT_MAX_MDM_CAB_BYTES / MIB),
        ),
      };
    case 'invalid':
      return { key: 'invalid', text: m.packageReason.invalid };
    default:
      return { key: 'unreadable', text: m.packageReason.unreadable };
  }
}

function reportProblem(pkg: MdmDiagPackage): string {
  const status = pkg.reportStatus as Exclude<MdmDiagMemberStatus, 'ok'>;
  switch (status) {
    case 'tooLarge':
      return m.reportReason.tooLarge(
        mib(pkg.files.find((f) => /mdmdiagreport\.xml$/i.test(f.name))?.sizeBytes ?? 0),
        Math.round(DEFAULT_MAX_MDM_DIAG_XML_BYTES / MIB),
      );
    case 'unsupported':
      return m.reportReason.unsupported(
        m.unsupported[pkg.unsupportedReason ?? 'unknown'] ?? m.unsupported['unknown'] ?? '',
      );
    case 'missing':
      return m.reportReason.missing;
    case 'invalid':
      return m.reportReason.invalid;
    default:
      return m.reportReason.unreadable;
  }
}

export function mdmDiagReportTile(report: DiagnosticsReport): Tile | null {
  const pkg = report.mdmDiag;
  if (!pkg) return null;
  const entry = report.entries.find((e) => e.path === pkg.entryPath);
  const src = source(entry, pkg.entryName);

  // Paket nicht lesbar → Kachel „nicht verfügbar“ mit Grund
  if (pkg.status !== 'ok') {
    const problem = packageProblem(pkg);
    return {
      id: 'mdmDiagReport',
      title: de.tiles.mdmDiagReport,
      state: 'ready',
      severity: 'unknown',
      value: de.availability.unavailable,
      summary: problem.text,
      findings: [
        {
          id: 'mdmDiag-package-unavailable',
          severity: 'unknown',
          title: m.packageUnavailableTitle,
          detail: problem.text,
          cause: m.packageUnavailableCause[problem.key] ?? '',
          remediation: [...m.packageUnavailableRemediation],
          source: src,
          docsUrl: Docs.mdmCollectLogs,
        },
      ],
      sources: [src],
      facts: [{ label: m.factPackage, value: maskUserPaths(pkg.entryName), mono: true }],
      sections: [],
    };
  }

  const findings: Finding[] = [];
  const summary = pkg.report;

  // Paketinhalt (Dateiliste)
  findings.push({
    id: 'mdmDiag-package',
    severity: 'unknown',
    title: m.packageTitle(pkg.fileCount),
    detail: m.packageDetail(
      maskUserPaths(pkg.entryName),
      pkg.fileCount,
      pkg.files.length,
      pkg.adminLogFromPackage,
    ),
    cause: m.packageCause,
    remediation: [...m.packageRemediation],
    evidence: Object.fromEntries(
      pkg.files
        .slice(0, MAX_LISTED)
        .map((file, index) => [`${index + 1}. ${file.name}`, formatBytes(file.sizeBytes)]),
    ),
    source: src,
    docsUrl: Docs.mdmCollectLogs,
  });

  if (pkg.truncated) {
    findings.push({
      id: 'mdmDiag-truncated',
      severity: 'unknown',
      title: m.truncatedTitle,
      detail: m.truncatedDetail,
      cause: m.truncatedCause,
      remediation: [...m.truncatedRemediation],
      source: src,
      docsUrl: Docs.cabinetFormat,
    });
  }

  if (summary) {
    // Aufbau der Datei: nur Elementnamen und Anzahl
    findings.push({
      id: 'mdmDiag-structure',
      severity: 'unknown',
      title: m.structureTitle,
      detail: [
        m.structureDetail(summary.rootElement, summary.elementCount, summary.sections.length),
        m.structureLimited(summary.truncated, summary.sectionsTruncated),
      ]
        .filter(Boolean)
        .join(' '),
      cause: m.structureCause,
      remediation: [...m.structureRemediation],
      evidence: Object.fromEntries(
        summary.sections
          .slice(0, MAX_LISTED)
          .map((section) => [section.name, m.structureLine(section.count, section.childNames)]),
      ),
      source: src,
      docsUrl: Docs.mdmCollectLogs,
    });

    if (summary.multivariantTotal > 0) {
      findings.push({
        id: 'mdmDiag-multivariant',
        severity: 'unknown',
        title: m.multivariantTitle(summary.multivariantTotal),
        detail: m.multivariantDetail(summary.multivariantTotal, summary.multivariant.length),
        cause: m.multivariantCause,
        remediation: [...m.multivariantRemediation],
        evidence: Object.fromEntries(
          summary.multivariant.map((condition, index) => [`${index + 1}.`, condition]),
        ),
        source: src,
        docsUrl: Docs.diagnoseProvisioningPackages,
      });
    }
  } else {
    const reason = reportProblem(pkg);
    findings.push({
      id: 'mdmDiag-report-unavailable',
      severity: 'unknown',
      title: m.reportUnavailableTitle,
      detail: reason,
      cause:
        m.reportUnavailableCause[pkg.reportStatus] ?? m.reportUnavailableCause['unreadable'] ?? '',
      remediation: [...m.reportUnavailableRemediation],
      source: src,
      docsUrl: pkg.reportStatus === 'unsupported' ? Docs.cabinetFormat : Docs.mdmCollectLogs,
    });
  }

  if (pkg.metadataStatus === 'ok' && pkg.metadata.length > 0) {
    findings.push({
      id: 'mdmDiag-metadata',
      severity: 'unknown',
      title: m.metadataTitle,
      detail: m.metadataDetail(pkg.metadata.length),
      cause: m.metadataCause,
      remediation: [...m.metadataRemediation],
      evidence: Object.fromEntries(pkg.metadata.map((field) => [field.key, field.value])),
      source: src,
      docsUrl: Docs.mdmCollectLogs,
    });
  }

  // Quelle des MDM-Admin-Ereignisprotokolls
  const adminLog = report.eventLogs?.find((log) => log.id === 'mdmAdmin');
  const adminLogFact = pkg.adminLogFromPackage
    ? m.factAdminLogFromPackage
    : adminLog
      ? m.factAdminLogFromZip
      : m.factAdminLogMissing;

  const facts: TileFact[] = [
    { label: m.factPackage, value: maskUserPaths(pkg.entryName), mono: true },
    { label: m.factPackageSize, value: formatBytes(pkg.sizeBytes) },
    { label: m.factFiles, value: String(pkg.fileCount) },
    {
      label: m.factReport,
      value: summary
        ? m.factReportOk(summary.elementCount)
        : (m.factReportStatus[pkg.reportStatus] ?? pkg.reportStatus),
    },
  ];
  if (summary) facts.push({ label: m.factConditions, value: String(summary.multivariantTotal) });
  facts.push({ label: m.factAdminLog, value: adminLogFact });

  return {
    id: 'mdmDiagReport',
    title: de.tiles.mdmDiagReport,
    state: 'ready',
    // Rohdaten ohne belegte Bewertung → „Hinweis“, nie Warnung/Problem
    severity: worstActionable(findings, 'unknown'),
    value: summary
      ? m.valueReport(summary.sections.length, summary.multivariantTotal)
      : m.valueFiles(pkg.fileCount),
    summary: summary ? m.summaryRaw : reportProblem(pkg),
    findings: sortFindings(findings),
    sources: [src],
    facts,
    sections: [],
  };
}
