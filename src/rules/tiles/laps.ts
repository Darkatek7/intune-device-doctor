/**
 * Windows LAPS (nur Windows, optionaler Scope DeviceLocalCredential.ReadBasic.All):
 * Zeitpunkte der letzten Sicherung und der nächsten Aktualisierung des lokalen Administrator-Kennworts.
 * Das Kennwort selbst wird nie angefordert oder angezeigt.
 * - Sicherung älter als THRESHOLDS.lapsBackupWarningDays → warning (eigener Richtwert)
 * - Kein Sicherungszeitpunkt → Hinweis
 * - refreshDateTime mehr als THRESHOLDS.lapsRefreshOverdueDays überschritten → Hinweis „Rotation überfällig“
 */
import { daysSince, formatDateTime, formatRelativeTime } from '../../domain/format';
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
import { THRESHOLDS } from '../thresholds';

const t = de.rules.laps;

export function evaluateLaps(snapshot: DeviceSnapshot, now: Date): Tile {
  const sections: Tile['sections'] = ['localAdmin'];
  if (!sectionsLoaded(snapshot, sections)) return loadingTile('laps', sections);
  const section = snapshot.localAdmin!;
  if (section.status !== 'ok') return unavailableTile('laps', sections, section);

  const { data } = section;
  const base = { source: section.source, docsUrl: Docs.lapsResource };
  const findings: Finding[] = [];

  const backupAge = daysSince(data.lastBackupDateTime, now);
  const refreshOverdue =
    data.refreshDateTime === null ? null : daysSince(data.refreshDateTime, now);
  const stale = backupAge !== null && backupAge > THRESHOLDS.lapsBackupWarningDays;

  if (data.lastBackupDateTime === null) {
    findings.push({
      ...base,
      id: 'laps-noBackup',
      severity: 'unknown',
      title: t.noBackupTitle,
      detail: t.noBackupDetail,
      cause: t.noBackupCause,
      remediation: [...t.staleRemediation],
      docsUrl: Docs.lapsIntuneDeploy,
    });
  } else if (stale) {
    findings.push({
      ...base,
      id: 'laps-backupStale',
      severity: 'warning',
      title: t.staleTitle,
      detail: t.staleDetail(
        formatDateTime(data.lastBackupDateTime),
        backupAge,
        THRESHOLDS.lapsBackupWarningDays,
      ),
      cause: t.staleCause,
      remediation: [...t.staleRemediation],
      evidence: {
        lastBackupDateTime: data.lastBackupDateTime,
        refreshDateTime: data.refreshDateTime,
        ageDays: backupAge,
        thresholdDays: THRESHOLDS.lapsBackupWarningDays,
      },
      docsUrl: Docs.lapsIntuneOverview,
    });
  }

  if (refreshOverdue !== null && refreshOverdue > THRESHOLDS.lapsRefreshOverdueDays) {
    findings.push({
      ...base,
      id: 'laps-refreshOverdue',
      severity: 'unknown',
      title: t.hintTitle,
      detail: t.hintDetail(
        formatDateTime(data.refreshDateTime),
        refreshOverdue,
        THRESHOLDS.lapsRefreshOverdueDays,
      ),
      cause: t.hintCause,
      remediation: [...t.hintRemediation],
      evidence: {
        refreshDateTime: data.refreshDateTime,
        overdueDays: refreshOverdue,
        thresholdDays: THRESHOLDS.lapsRefreshOverdueDays,
      },
      docsUrl: Docs.lapsEventLog,
    });
  }

  const facts: TileFact[] = [];
  if (data.lastBackupDateTime) {
    facts.push({
      label: t.facts.lastBackup,
      value: formatRelativeTime(data.lastBackupDateTime, now),
      title: formatDateTime(data.lastBackupDateTime),
    });
  }
  if (data.refreshDateTime) {
    facts.push({
      label: t.facts.nextRefresh,
      value: formatDateTime(data.refreshDateTime),
    });
  }
  if (data.deviceName) facts.push({ label: t.facts.deviceName, value: data.deviceName });
  facts.push({ label: t.facts.passwordNote, value: t.facts.passwordNever });

  const severity = worstActionable(findings, 'ok');
  return {
    id: 'laps',
    title: de.tiles.laps,
    state: 'ready',
    severity,
    value:
      data.lastBackupDateTime === null
        ? t.valueNoBackup
        : stale
          ? t.valueStale
          : refreshOverdue !== null && refreshOverdue > THRESHOLDS.lapsRefreshOverdueDays
            ? t.valueHint
            : t.valueOk,
    summary:
      data.lastBackupDateTime === null
        ? t.summaryNoBackup
        : t.summaryOk(formatRelativeTime(data.lastBackupDateTime, now)),
    findings: sortFindings(findings),
    sources: [section.source],
    facts,
    availability: availabilityOf(section),
    sections,
  };
}
