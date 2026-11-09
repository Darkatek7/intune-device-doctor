/**
 * Zeitachse: sammelt alle Zeitpunkte, die in den geladenen Daten tatsächlich gesetzt sind
 * (DeviceSnapshot und/oder DiagLogs-ZIP), als sortierte Ereignisliste. Reine Funktion – "now" wird
 * übergeben. Keine neue Datenquelle, keine Bewertung über die bestehenden Schwellwerte hinaus.
 *
 * Zukunftstermine (Ablauf, geplante Rotation, Ende der Schonfrist) sind mit `planned: true` markiert.
 */
import type { DiagnosticsReport } from '../diagnostics/types';
import { daysSince, formatRelativeTime, hoursSince, maskUserPaths } from '../domain/format';
import type { DeviceSnapshot, Severity, TileId } from '../domain/types';
import { de } from '../i18n/de';
import { SEVERITY_RANK } from './helpers';
import { findEntraSignInError } from './knowledge/entraSignInErrors';
import { findEventKnowledge } from './knowledge/events';
import { THRESHOLDS } from './thresholds';

const e = de.analysis.timeline.events;
const DAY_MS = 86_400_000;

export type TimelineKind =
  | 'enrollment'
  | 'checkIn'
  | 'entraSignIn'
  | 'signIn'
  | 'compliance'
  | 'laps'
  | 'autopilot'
  | 'bitlocker'
  | 'defender'
  | 'certificate'
  | 'zipCollected'
  | 'mdmEvent'
  | 'imeLog';

export type TimelineSource = 'intune' | 'entra' | 'zip';

export interface TimelineEvent {
  /** Stabile ID (für React-Keys und Tests) */
  id: string;
  /** ISO-Zeitpunkt */
  time: string;
  kind: TimelineKind;
  /** warning/critical = Problem; unknown = Hinweis */
  severity: Severity;
  title: string;
  detail: string | null;
  /** Kachel, die zum Ereignis gehört (null = keine) */
  tileId: TileId | null;
  source: TimelineSource;
  /** true = Zeitpunkt liegt in der Zukunft */
  planned: boolean;
}

export interface TimelineInput {
  snapshot?: DeviceSnapshot;
  /** Nur ZIP-Ansicht; mit Snapshot gilt snapshot.diagnostics */
  diagnostics?: DiagnosticsReport;
  now: Date;
}

const MAX_SIGN_INS = 25;
const MAX_ZIP_CERTS = 15;
const MAX_IME = 20;
const MAX_EVENT_GROUPS = 40;

function validTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Problem im Sinne des Filters „nur Probleme“. */
export function isProblemEvent(event: TimelineEvent): boolean {
  return event.severity === 'warning' || event.severity === 'critical';
}

export function buildTimeline({ snapshot, diagnostics, now }: TimelineInput): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const nowMs = now.getTime();

  const push = (
    event: Omit<TimelineEvent, 'planned' | 'time'> & { time: string | null | undefined },
  ): void => {
    const ms = validTime(event.time);
    if (ms === null || !event.time) return;
    events.push({ ...event, time: event.time, planned: ms > nowMs });
  };

  if (snapshot) addSnapshotEvents(snapshot, now, push);
  const report = snapshot?.diagnostics ?? diagnostics;
  if (report) addDiagnosticsEvents(report, now, push);

  // Neueste zuerst; bei gleichem Zeitpunkt schlimmste Severity zuerst, dann stabil nach ID.
  return events.sort(
    (a, b) =>
      new Date(b.time).getTime() - new Date(a.time).getTime() ||
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.id.localeCompare(b.id),
  );
}

type Push = (
  event: Omit<TimelineEvent, 'planned' | 'time'> & { time: string | null | undefined },
) => void;

// ---------------------------------------------------------------------------
// Live-/Demo-Daten
// ---------------------------------------------------------------------------

function addSnapshotEvents(snapshot: DeviceSnapshot, now: Date, push: Push): void {
  const { device } = snapshot;

  push({
    id: 'enrolled',
    time: device.enrolledDateTime,
    kind: 'enrollment',
    severity: 'ok',
    title: e.enrolled,
    detail: null,
    tileId: 'deviceStatus',
    source: 'intune',
  });

  // Check-in: gleiche Schwellwerte wie die Kachel „Letzter Check-in“
  const hours = hoursSince(device.lastSyncDateTime, now);
  if (hours !== null) {
    const severity: Severity =
      hours > THRESHOLDS.checkInCriticalDays * 24
        ? 'critical'
        : hours > THRESHOLDS.checkInWarningDays * 24
          ? 'warning'
          : 'ok';
    push({
      id: 'checkIn',
      time: device.lastSyncDateTime,
      kind: 'checkIn',
      severity,
      title: e.checkIn,
      detail: e.checkInDetail(formatRelativeTime(device.lastSyncDateTime, now)),
      tileId: 'checkIn',
      source: 'intune',
    });
  }

  // Compliance: Ende der Schonfrist
  if (device.complianceState === 'inGracePeriod') {
    const grace = device.complianceGracePeriodExpirationDateTime;
    const ms = validTime(grace);
    push({
      id: 'graceEnd',
      time: grace,
      kind: 'compliance',
      severity: 'warning',
      title: ms !== null && ms > now.getTime() ? e.graceEnds : e.graceEnded,
      detail: null,
      tileId: 'compliance',
      source: 'intune',
    });
  }

  // MDM-Zertifikat des Geräts
  addExpiry(push, {
    id: 'mdmCert',
    time: device.managementCertificateExpirationDate,
    kind: 'certificate',
    expired: e.mdmCertExpired,
    expires: e.mdmCertExpires,
    tileId: 'deviceStatus',
    now,
  });

  const entra = snapshot.entraDevice;
  if (entra?.status === 'ok' && entra.data?.approximateLastSignInDateTime) {
    const signIn = entra.data.approximateLastSignInDateTime;
    const days = daysSince(signIn, now);
    const stale = days !== null && days > THRESHOLDS.entraSignInStaleDays;
    push({
      id: 'entraSignIn',
      time: signIn,
      kind: 'entraSignIn',
      severity: stale ? 'unknown' : 'ok',
      title: e.entraSignIn,
      detail: stale && days !== null ? e.entraSignInStale(days) : null,
      tileId: 'checkIn',
      source: 'entra',
    });
  }

  // Anmeldungen (Entra-Anmeldeprotokoll, M10)
  const signIns = snapshot.signIns;
  if (signIns?.status === 'ok') {
    signIns.data.entries.slice(0, MAX_SIGN_INS).forEach((entry, index) => {
      const failed = entry.conditionalAccessStatus === 'failure';
      const app = entry.appDisplayName ?? '–';
      const known =
        failed && entry.errorCode !== null && entry.errorCode !== 0
          ? findEntraSignInError(entry.errorCode)
          : undefined;
      push({
        id: `signIn-${entry.id || index}`,
        time: entry.createdDateTime,
        kind: 'signIn',
        severity: failed ? 'warning' : 'ok',
        title: failed ? e.signInFailed(app) : e.signInOk(app),
        detail:
          e.signInDetail(
            entry.resourceDisplayName,
            failed && entry.errorCode !== null && entry.errorCode !== 0
              ? e.signInError(entry.errorCode, known?.name ?? null)
              : null,
          ) || null,
        tileId: 'signIns',
        source: 'entra',
      });
    });
  }

  // Windows LAPS (M10): nur Zeitpunkte, nie das Kennwort
  const laps = snapshot.localAdmin;
  if (laps?.status === 'ok') {
    const age = daysSince(laps.data.lastBackupDateTime, now);
    const stale = age !== null && age > THRESHOLDS.lapsBackupWarningDays;
    push({
      id: 'lapsBackup',
      time: laps.data.lastBackupDateTime,
      kind: 'laps',
      severity: stale ? 'warning' : 'ok',
      title: e.lapsBackup,
      detail: stale && age !== null ? e.lapsBackupStale(age) : null,
      tileId: 'laps',
      source: 'entra',
    });
    const refresh = laps.data.refreshDateTime;
    const refreshMs = validTime(refresh);
    if (refresh && refreshMs !== null) {
      const future = refreshMs > now.getTime();
      const overdue = future ? null : daysSince(refresh, now);
      const isOverdue = overdue !== null && overdue > THRESHOLDS.lapsRefreshOverdueDays;
      push({
        id: 'lapsRefresh',
        time: refresh,
        kind: 'laps',
        severity: isOverdue ? 'unknown' : 'ok',
        title: future ? e.lapsRefreshPlanned : e.lapsRefreshPast,
        detail: isOverdue && overdue !== null ? e.lapsRefreshOverdue(overdue) : null,
        tileId: 'laps',
        source: 'entra',
      });
    }
  }

  // Autopilot (M10)
  const autopilot = snapshot.autopilot;
  if (autopilot?.status === 'ok' && autopilot.data) {
    push({
      id: 'autopilot',
      time: autopilot.data.lastContactedDateTime,
      kind: 'autopilot',
      severity: 'ok',
      title: e.autopilot,
      detail: null,
      tileId: 'autopilot',
      source: 'intune',
    });
  }

  // BitLocker: Zeitpunkte der gesicherten Wiederherstellungsschlüssel (nur Metadaten)
  const keys = snapshot.bitlockerKeys;
  if (keys?.status === 'ok') {
    keys.data.forEach((key, index) =>
      push({
        id: `bitlockerKey-${key.id || index}`,
        time: key.createdDateTime,
        kind: 'bitlocker',
        severity: 'ok',
        title: e.bitlockerKey(e.bitlockerVolume[key.volumeType] ?? key.volumeType),
        detail: null,
        tileId: 'bitlocker',
        source: 'entra',
      }),
    );
  }

  // Defender: Scans und letzter Statusbericht
  const protection = snapshot.protection;
  if (protection?.status === 'ok') {
    const p = protection.data;
    push({
      id: 'defenderQuick',
      time: p.lastQuickScanDateTime,
      kind: 'defender',
      severity: p.quickScanOverdue === true ? 'warning' : 'ok',
      title: e.defenderQuick,
      detail: p.quickScanOverdue === true ? e.defenderScanOverdue : null,
      tileId: 'defender',
      source: 'intune',
    });
    push({
      id: 'defenderFull',
      time: p.lastFullScanDateTime,
      kind: 'defender',
      severity: p.fullScanOverdue === true ? 'warning' : 'ok',
      title: e.defenderFull,
      detail: p.fullScanOverdue === true ? e.defenderScanOverdue : null,
      tileId: 'defender',
      source: 'intune',
    });
    push({
      id: 'defenderReported',
      time: p.lastReportedDateTime,
      kind: 'defender',
      severity: p.signatureUpdateOverdue === true ? 'warning' : 'ok',
      title: e.defenderReported,
      detail: p.signatureUpdateOverdue === true ? e.defenderSignaturesOverdue : null,
      tileId: 'defender',
      source: 'intune',
    });
  }

  // Apple-MDM-Push-Zertifikat (Tenant-weit)
  const apple = snapshot.applePushCertificate;
  if (apple?.status === 'ok') {
    addExpiry(push, {
      id: 'applePush',
      time: apple.data.expirationDateTime,
      kind: 'certificate',
      expired: e.applePushExpired,
      expires: e.applePushExpires,
      tileId: 'deviceStatus',
      now,
    });
  }
}

/** Ablauf-Ereignis: in der Vergangenheit = abgelaufen (critical), sonst geplant (Warnung ≤ Richtwert). */
function addExpiry(
  push: Push,
  opts: {
    id: string;
    time: string | null | undefined;
    kind: TimelineKind;
    expired: string;
    expires: string;
    tileId: TileId;
    now: Date;
  },
): void {
  const ms = validTime(opts.time);
  if (ms === null) return;
  const daysLeft = (ms - opts.now.getTime()) / DAY_MS;
  const expired = daysLeft <= 0;
  push({
    id: opts.id,
    time: opts.time,
    kind: opts.kind,
    severity: expired
      ? 'critical'
      : daysLeft <= THRESHOLDS.certificateWarningDays
        ? 'warning'
        : 'ok',
    title: expired ? opts.expired : opts.expires,
    detail: null,
    tileId: opts.tileId,
    source: 'intune',
  });
}

// ---------------------------------------------------------------------------
// DiagLogs-ZIP
// ---------------------------------------------------------------------------

const MAX_TEXT = 160;
const clip = (text: string): string =>
  text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;

function addDiagnosticsEvents(report: DiagnosticsReport, now: Date, push: Push): void {
  push({
    id: 'zipCollected',
    time: report.collectedAtUtc,
    kind: 'zipCollected',
    severity: 'ok',
    title: e.zipCollected,
    detail: e.zipCollectedDetail(maskUserPaths(report.fileName)),
    tileId: 'diagCollection',
    source: 'zip',
  });

  // MDM-/Entra-Ereignisse: je Protokoll und Ereignis-ID ein Eintrag (jüngstes Vorkommen)
  const groups: Array<{
    logId: string;
    eventId: number;
    level: 1 | 2 | 3;
    count: number;
    time: string | null;
  }> = [];
  for (const log of report.eventLogs ?? []) {
    if (log.status !== 'ok') continue;
    const byId = new Map<number, (typeof groups)[number]>();
    for (const event of log.events) {
      const known = byId.get(event.eventId);
      if (!known) {
        const group = {
          logId: log.id,
          eventId: event.eventId,
          level: event.level,
          count: 1,
          time: event.timeUtc,
        };
        byId.set(event.eventId, group);
        groups.push(group);
        continue;
      }
      known.count++;
      known.level = Math.min(known.level, event.level) as 1 | 2 | 3;
      if ((event.timeUtc ?? '') > (known.time ?? '')) known.time = event.timeUtc;
    }
  }
  const errors = groups.reduce((sum, g) => sum + (g.level <= 2 ? g.count : 0), 0);
  groups
    .filter((g) => g.time)
    .sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))
    .slice(0, MAX_EVENT_GROUPS)
    .forEach((g) => {
      const known = findEventKnowledge(g.logId as 'mdmAdmin' | 'aadOperational', g.eventId);
      push({
        id: `mdmEvent-${g.logId}-${g.eventId}`,
        time: g.time,
        kind: 'mdmEvent',
        // wie die Kachel: Fehler → Prüfen (ab Richtwert), Warnungen nur als Hinweis
        severity:
          g.level <= 2 && errors >= THRESHOLDS.eventLogErrorWarningCount ? 'warning' : 'unknown',
        title: e.mdmEvent(g.eventId, known?.title ?? null),
        detail: e.mdmEventDetail(
          g.count,
          e.mdmLevel[g.level] ?? String(g.level),
          e.mdmLog[g.logId] ?? g.logId,
        ),
        tileId: 'mdmEvents',
        source: 'zip',
      });
    });

  // IME-Protokoll: Typ 2 = Warnung, Typ 3 nur als Hinweis (markiert auch Informationen)
  report.imeIssues
    .filter((issue) => issue.timestamp)
    .slice(-MAX_IME)
    .forEach((issue, index) => {
      // CMTrace-Zeitstempel tragen keine Zeitzone; wie bei Zertifikaten als UTC behandelt
      const time = issue.timestamp!.endsWith('Z') ? issue.timestamp! : `${issue.timestamp}Z`;
      push({
        id: `imeLog-${index}`,
        time,
        kind: 'imeLog',
        severity: issue.type === 2 ? 'warning' : 'unknown',
        title: clip(maskUserPaths(issue.message.split(/\r?\n/)[0] ?? '')),
        detail: issue.type === 3 ? e.imeHint : null,
        tileId: 'win32Apps',
        source: 'zip',
      });
    });

  // Zertifikate: nur abgelaufene bzw. bald ablaufende (bezogen auf den Sammelzeitpunkt)
  const reference = validTime(report.collectedAtUtc) ?? now.getTime();
  report.certificates
    .map((cert) => ({ cert, ms: validTime(cert.notAfter) }))
    .filter(
      (c): c is { cert: typeof c.cert; ms: number } =>
        c.ms !== null && c.ms - reference <= THRESHOLDS.certificateWarningDays * DAY_MS,
    )
    .sort((a, b) => b.ms - a.ms)
    .slice(0, MAX_ZIP_CERTS)
    .forEach(({ cert, ms }, index) => {
      push({
        id: `cert-${index}`,
        time: cert.notAfter,
        kind: 'certificate',
        // Die Kachel „Zertifikate & Netzwerk“ bewertet nicht über „Hinweis“ hinaus.
        severity: 'unknown',
        title:
          ms < reference ? e.certExpired(cert.subjectMasked) : e.certExpires(cert.subjectMasked),
        detail: e.certDetail,
        tileId: 'certsNetwork',
        source: 'zip',
      });
    });
}
