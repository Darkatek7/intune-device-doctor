/**
 * Kacheln aus einem Intune-DiagLogs-ZIP: Entra-Join & PRT (dsregcmd), Win32-Apps (IME-Registry + Logs),
 * Enrollment (Registry) und Diagnose-Sammlung (fehlgeschlagene Sammlungen, Analyse-Hinweise).
 * Quelle jedes Befunds ist der ZIP-Eintrag. Codes werden nur über die Wissensbasis gedeutet.
 */
import { formatDateTime, normalizeHex } from '../../domain/format';
import type { DataSource, Finding, Severity, Tile, TileFact } from '../../domain/types';
import type {
  DiagEntry,
  DiagnosticsReport,
  DsregStatus,
  Win32AppState,
} from '../../diagnostics/types';
import { de } from '../../i18n/de';
import { sortFindings, worstActionable } from '../helpers';
import { Docs } from '../knowledge/docs';
import { INSTALLER_EXIT_CODES } from '../knowledge/errorCodes';
import { findPrtError } from '../knowledge/prtErrors';
import { explainCode } from '../knowledge/win32';

const z = de.rules.zip;
const f = de.rules.facts;

/** Typischerweise fehlende Sammlungen, wenn die Komponente nicht installiert ist (docs/diaglogs-format.md). */
const HARMLESS_COLLECTION_PATTERNS = [
  /CloudManagedUpdate/i,
  /EPMAgent/i,
  /SetupDiag/i,
  /ccmsetup/i,
];

export function evaluateDiagnosticsTiles(report: DiagnosticsReport, _now: Date): Tile[] {
  void _now;
  return [
    entraJoinTile(report),
    win32AppsTile(report),
    enrollmentTile(report),
    collectionTile(report),
  ];
}

function zipSource(
  _report: DiagnosticsReport,
  entry: DiagEntry | undefined,
  fallback: string,
): DataSource {
  return { kind: 'zip', label: `${z.sourcePrefix} · ${entry?.path ?? fallback}` };
}

function findEntry(
  report: DiagnosticsReport,
  predicate: (entry: DiagEntry) => boolean,
): DiagEntry | undefined {
  return report.entries.find(predicate);
}

function tile(
  id: Tile['id'],
  severity: Severity,
  value: string,
  summary: string,
  findings: Finding[],
  sources: DataSource[],
  facts: TileFact[],
): Tile {
  return {
    id,
    title: de.tiles[id],
    state: 'ready',
    severity,
    value,
    summary,
    findings: sortFindings(findings),
    sources,
    facts,
    sections: [],
  };
}

// ---------- Entra-Join & PRT ----------

function joinType(ds: DsregStatus): string {
  const aad = ds.azureAdJoined?.toUpperCase() === 'YES';
  const domain = ds.domainJoined?.toUpperCase() === 'YES';
  if (aad && domain) return z.entraJoin.joinType.hybrid;
  if (aad) return z.entraJoin.joinType.entra;
  if (domain) return z.entraJoin.joinType.domain;
  return z.entraJoin.joinType.none;
}

function blockField(ds: DsregStatus, block: string, key: string): string | null {
  for (const section of ds.sections) {
    for (const b of section.blocks) {
      if (b.name.toLowerCase() !== block.toLowerCase()) continue;
      const field = b.fields.find((x) => x.key.toLowerCase() === key.toLowerCase());
      if (field?.value) return field.value;
    }
  }
  return null;
}

function entraJoinTile(report: DiagnosticsReport): Tile {
  const entry = findEntry(
    report,
    (e) => e.kind === 'Command' && /dsregcmd/i.test(e.name) && !e.failedHresult,
  );
  const source = zipSource(report, entry, 'dsregcmd /status');
  const ds = report.dsregcmd;
  const t = z.entraJoin;
  if (!ds) {
    return tile(
      'entraJoin',
      'unknown',
      de.availability.unavailable,
      t.noDsregDetail,
      [
        {
          id: 'entraJoin-missing',
          severity: 'unknown',
          title: t.noDsregTitle,
          detail: t.noDsregDetail,
          cause: t.noDsregCause,
          remediation: [...t.noDsregRemediation],
          source,
          docsUrl: Docs.dsregcmdDeviceState,
        },
      ],
      [source],
      [],
    );
  }

  const findings: Finding[] = [];
  const join = joinType(ds);
  const prtMissing = ds.azureAdPrt?.toUpperCase() === 'NO';
  const attempt =
    blockField(ds, 'AcquirePrtDiagnostics', 'Previous Prt Attempt') ??
    blockField(ds, 'RefreshPrtDiagnostics', 'Previous Prt Attempt');
  const credential =
    blockField(ds, 'AcquirePrtDiagnostics', 'Credential Type') ??
    blockField(ds, 'RefreshPrtDiagnostics', 'Credential Type');
  const httpStatus =
    blockField(ds, 'AcquirePrtDiagnostics', 'HTTP status') ??
    blockField(ds, 'RefreshPrtDiagnostics', 'HTTP status');

  if (prtMissing) {
    const status = ds.prtAttemptStatus ?? null;
    const http = ds.prtHttpError ?? null;
    const prt = findPrtError(status);
    const statusExplanation = status ? explainCode(status) : null;
    const httpExplanation = http && normalizeHex(http) !== '0x00000000' ? explainCode(http) : null;
    const codeNotes: string[] = [];
    if (status && statusExplanation) {
      if (
        statusExplanation.kind === 'ntstatus' &&
        statusExplanation.name &&
        statusExplanation.text
      ) {
        codeNotes.push(
          t.prtNtStatus(statusExplanation.hex, statusExplanation.name, statusExplanation.text),
        );
      } else if (!prt) {
        codeNotes.push(t.prtUnknownCode(statusExplanation.hex));
      }
    }
    if (httpExplanation?.kind === 'winhttp' && httpExplanation.name && httpExplanation.text) {
      codeNotes.push(
        t.prtHttpError(httpExplanation.hex, httpExplanation.name, httpExplanation.text),
      );
    }
    findings.push({
      id: 'entraJoin-prt',
      // Ein protokollierter, fehlgeschlagener PRT-Versuch ist ein echter Befund; ohne Diagnosedaten
      // kann "NO" auch am Ausführungskontext der Sammlung liegen.
      severity: status ? 'critical' : 'warning',
      title: t.prtTitle,
      detail: [t.prtDetail(attempt, status, http), ...codeNotes, t.contextHint].join(' '),
      cause: [prt ? t.prtCodeCause(prt.title, prt.cause) : null, t.prtCause]
        .filter(Boolean)
        .join(' '),
      remediation: [...(prt?.remediation ?? []), ...t.prtRemediation],
      evidence: {
        AzureAdPrt: ds.azureAdPrt ?? null,
        'Previous Prt Attempt': attempt,
        'Attempt Status': status,
        'HTTP Error': http,
        'HTTP status': httpStatus,
        'Credential Type': credential,
      },
      source,
      docsUrl: prt?.docsUrl ?? Docs.prtTroubleshoot,
    });
  }

  const wam = ds.wamDefaultSet;
  if (wam && /ERROR/i.test(wam)) {
    const codeMatch = /0x[0-9a-f]{8}/i.exec(wam);
    const explanation = codeMatch ? explainCode(codeMatch[0]) : null;
    const codeText =
      explanation && explanation.kind === 'win32' && explanation.baseCode !== null
        ? de.rules.policies.codeWin32(explanation.hex, explanation.baseCode, explanation.name)
        : null;
    findings.push({
      id: 'entraJoin-wam',
      severity: 'warning',
      title: t.wamTitle,
      detail: t.wamDetail(wam, codeText),
      cause: t.wamCause,
      remediation: [...t.wamRemediation],
      evidence: { WamDefaultSet: wam },
      source,
      docsUrl: Docs.dsregcmdUserState,
    });
  }

  if (ds.deviceAuthStatus && ds.deviceAuthStatus.toUpperCase() !== 'SUCCESS') {
    findings.push({
      id: 'entraJoin-deviceAuth',
      severity: 'critical',
      title: t.authTitle,
      detail: t.authDetail(ds.deviceAuthStatus),
      cause: t.authCause,
      remediation: [...t.authRemediation],
      evidence: { DeviceAuthStatus: ds.deviceAuthStatus },
      source,
      docsUrl: Docs.dsregcmdDeviceDetails,
    });
  }

  if (join === z.entraJoin.joinType.none) {
    findings.push({
      id: 'entraJoin-notJoined',
      severity: 'warning',
      title: t.notJoinedTitle,
      detail: t.notJoinedDetail,
      cause: t.notJoinedCause,
      remediation: [...t.notJoinedRemediation],
      evidence: { AzureAdJoined: ds.azureAdJoined ?? null, DomainJoined: ds.domainJoined ?? null },
      source,
      docsUrl: Docs.dsregcmdDeviceState,
    });
  }

  const facts: TileFact[] = [
    { label: f.trustType, value: join },
    { label: 'AzureAdPrt', value: ds.azureAdPrt ?? '–', mono: true },
    { label: 'DeviceAuthStatus', value: ds.deviceAuthStatus ?? '–', mono: true },
    { label: 'TpmProtected', value: ds.tpmProtected ?? '–', mono: true },
    { label: 'WamDefaultSet', value: ds.wamDefaultSet ?? '–', mono: true },
  ];
  if (ds.prtAttemptStatus)
    facts.push({ label: 'Attempt Status', value: ds.prtAttemptStatus, mono: true });
  if (ds.prtHttpError) facts.push({ label: 'HTTP Error', value: ds.prtHttpError, mono: true });

  const severity = worstActionable(findings);
  return tile(
    'entraJoin',
    severity,
    prtMissing ? t.valuePrtMissing : join,
    t.summary(join, prtMissing ? t.valuePrtMissing : t.valueOk),
    findings,
    [source],
    facts,
  );
}

// ---------- Win32-Apps ----------

function codeDescription(app: Win32AppState): {
  text: string;
  docsUrl: string | null;
  installer?: (typeof INSTALLER_EXIT_CODES)[number];
} {
  const w = z.win32;
  if (app.errorCodeDecimal === null || app.errorCodeDecimal === 0)
    return { text: w.codeNone, docsUrl: null };
  const ex = explainCode(app.errorCodeDecimal);
  if (ex.kind === 'win32' && ex.baseCode !== null) {
    const installer = INSTALLER_EXIT_CODES.find((c) => c.code === ex.baseCode);
    return {
      text: w.codeWin32(ex.hex, ex.decimal, ex.baseCode, ex.name, ex.text),
      docsUrl: installer?.docsUrl ?? ex.docsUrl,
      installer,
    };
  }
  return { text: w.codeUnknown(ex.hex, ex.decimal), docsUrl: null };
}

function win32AppsTile(report: DiagnosticsReport): Tile {
  const w = z.win32;
  const entry = findEntry(
    report,
    (e) =>
      e.kind === 'RegistryKey' && /IntuneManagementExtension/i.test(e.name) && !e.failedHresult,
  );
  const source = zipSource(report, entry, 'HKLM\\Software\\Microsoft\\IntuneManagementExtension');
  const apps = report.win32Apps;
  const findings: Finding[] = [];
  const failed = apps.filter((a) => a.status?.toLowerCase() === 'failed');
  const pendingReboot = apps.filter((a) => a.status?.toLowerCase() === 'installedpendingreboot');
  const installed = apps.filter((a) => a.status?.toLowerCase() === 'installed');

  for (const app of failed) {
    const code = codeDescription(app);
    findings.push({
      id: `win32-failed-${app.appId}`,
      severity: 'warning',
      title: w.failedTitle(app.appId),
      detail: w.failedDetail(code.text),
      cause: [w.failedCause, code.installer?.cause].filter(Boolean).join(' '),
      remediation: [...(code.installer?.remediation ?? []), ...w.failedRemediation],
      evidence: {
        appId: app.appId,
        status: app.status,
        errorCode: app.errorCodeHex,
        errorCodeDecimal: app.errorCodeDecimal,
      },
      source,
      docsUrl: code.docsUrl ?? Docs.win32AppTroubleshoot,
    });
  }
  for (const app of pendingReboot) {
    findings.push({
      id: `win32-reboot-${app.appId}`,
      severity: 'warning',
      title: w.pendingRebootTitle(app.appId),
      detail: w.pendingRebootDetail,
      cause: w.pendingRebootCause,
      remediation: [...w.pendingRebootRemediation],
      evidence: { appId: app.appId, status: app.status },
      source,
      docsUrl: Docs.win32AppTroubleshoot,
    });
  }

  const imeIssues = report.imeIssues;
  if (imeIssues.length > 0) {
    const errors = imeIssues.filter((i) => i.type === 3).length;
    const warnings = imeIssues.filter((i) => i.type === 2).length;
    const imeEntry = findEntry(
      report,
      (e) => e.kind === 'FoldersFiles' && /IntuneManagementExtension_Logs\/.+\.log$/i.test(e.name),
    );
    const sample = imeIssues.slice(-5);
    findings.push({
      id: 'win32-imeLog',
      severity: 'unknown',
      title: w.imeTitle(errors, warnings),
      detail: w.imeDetail(sample.map((i) => `„${i.message.split(/\r?\n/)[0]}“`).join(' · ')),
      cause: w.imeCause,
      remediation: [...w.imeRemediation],
      evidence: Object.fromEntries(
        sample.map((i, index) => [
          `${index + 1}. ${i.timestamp ?? ''} (Typ ${i.type})`,
          i.message.split(/\r?\n/)[0] ?? '',
        ]),
      ),
      source: zipSource(report, imeEntry, 'IntuneManagementExtension.log'),
      docsUrl: Docs.win32AppTroubleshoot,
    });
  }

  const facts: TileFact[] = apps.map((app) => ({
    label: app.appId,
    value: [app.status ?? '–', app.errorCodeHex].filter(Boolean).join(' · '),
    mono: true,
  }));
  const severity = apps.length === 0 ? 'unknown' : worstActionable(findings);
  const other = apps.length - failed.length - installed.length;
  return tile(
    'win32Apps',
    severity,
    apps.length === 0
      ? w.valueNone
      : failed.length > 0
        ? w.valueFailed(failed.length, apps.length)
        : w.valueOk(apps.length),
    apps.length === 0 ? w.summaryNone : w.summaryCounts(installed.length, failed.length, other),
    findings,
    [source],
    facts,
  );
}

// ---------- Enrollment ----------

function enrollmentTile(report: DiagnosticsReport): Tile {
  const t = z.enrollment;
  const entry = findEntry(
    report,
    (e) => e.kind === 'RegistryKey' && /Microsoft_Enrollments/i.test(e.name) && !e.failedHresult,
  );
  const source = zipSource(report, entry, 'HKLM\\Software\\Microsoft\\Enrollments');
  const enrollments = report.enrollments;
  if (enrollments.length === 0) {
    return tile(
      'enrollment',
      'unknown',
      t.valueNone,
      de.availability.unavailable,
      [],
      [source],
      [],
    );
  }
  const findings: Finding[] = [];
  const mdm = enrollments.filter((e) => e.providerId === 'MS DM Server');
  const sccm = enrollments.filter((e) => e.providerId === 'WMI_Bridge_SCCM_Server');

  if (mdm.length === 0) {
    findings.push({
      id: 'enrollment-missing',
      severity: 'critical',
      title: t.missingTitle,
      detail: t.missingDetail,
      cause: t.missingCause,
      remediation: [...t.missingRemediation],
      evidence: Object.fromEntries(enrollments.map((e) => [e.enrollmentId, e.providerId])),
      source,
      docsUrl: Docs.windowsEnrollmentErrors,
    });
  }
  if (mdm.length > 0 && sccm.length > 0) {
    findings.push({
      id: 'enrollment-comanaged',
      severity: 'unknown',
      title: t.coManagedTitle,
      detail: t.coManagedDetail,
      cause: t.coManagedCause,
      remediation: [...t.coManagedRemediation],
      evidence: { mdmEnrollments: mdm.length, configMgrEnrollments: sccm.length },
      source,
      docsUrl: Docs.coManagement,
    });
  }

  const facts: TileFact[] = enrollments.map((e) => ({
    label: t.providerLabel(e.providerId ?? '–'),
    value: t.providerValue(e.enrollmentState, e.enrollmentType),
    mono: true,
  }));
  const upn = mdm.find((e) => e.upnMasked)?.upnMasked ?? null;
  const severity = worstActionable(findings);
  return tile(
    'enrollment',
    severity,
    mdm.length === 0 ? t.valueMissing : sccm.length > 0 ? t.valueCoManaged : t.valueMdm,
    t.summary(enrollments.length, upn),
    findings,
    [source],
    facts,
  );
}

// ---------- Diagnose-Sammlung ----------

function collectionTile(report: DiagnosticsReport): Tile {
  const t = z.collection;
  const source: DataSource = { kind: 'zip', label: `${z.sourcePrefix} · ${report.fileName}` };
  const findings: Finding[] = [];
  let real = 0;
  let harmless = 0;
  for (const failure of report.collectionFailures) {
    const isHarmless = HARMLESS_COLLECTION_PATTERNS.some((pattern) => pattern.test(failure.target));
    if (isHarmless) harmless++;
    else real++;
    const entry = findEntry(report, (e) => e.failedHresult !== null && e.name === failure.target);
    findings.push({
      id: `collection-${failure.kind}-${failure.target}`,
      severity: isHarmless ? 'unknown' : 'warning',
      title: t.failedTitle(t.kind[failure.kind] ?? failure.kind, failure.target),
      detail: t.failedDetail(failure.hresult, failure.meaning),
      cause: isHarmless ? t.harmlessCause : t.failedCause,
      remediation: isHarmless ? [...t.harmlessRemediation] : [...t.failedRemediation],
      evidence: { kind: failure.kind, target: failure.target, hresult: failure.hresult },
      source: zipSource(report, entry, 'results.xml'),
      docsUrl: explainCode(failure.hresult).docsUrl ?? undefined,
    });
  }
  if (report.analysisNotes.length > 0) {
    findings.push({
      id: 'collection-notes',
      severity: 'unknown',
      title: t.notesTitle,
      detail: report.analysisNotes.join(' '),
      cause: t.notesCause,
      remediation: [...t.notesRemediation],
      source,
    });
  }
  const facts: TileFact[] = [
    { label: f.zipFile, value: report.fileName, mono: true },
    { label: f.zipEntries, value: String(report.entryCount) },
  ];
  if (report.collectedAtUtc)
    facts.push({ label: f.zipCollected, value: formatDateTime(report.collectedAtUtc) });
  const severity = worstActionable(findings);
  return tile(
    'diagCollection',
    severity,
    real > 0 ? t.valueFailed(real) : harmless > 0 ? t.valueHarmless(harmless) : t.valueOk,
    t.summary(
      report.entryCount,
      report.collectedAtUtc ? formatDateTime(report.collectedAtUtc) : null,
    ),
    findings,
    [source],
    facts,
  );
}
