/**
 * Letzte Remote-Aktionen (M20/S4) – Beitrag zur Kachel „Gerätestatus“ und zur Zeitachse.
 * Grundlage: managedDevice.deviceActionResults (v1.0, ohne zusätzlichen Abruf). MDM Doctor löst selbst
 * keine Aktion aus; jeder Befund sagt das.
 *
 * - nur Aktionen der letzten THRESHOLDS.remoteActionRecentDays Tage (eigener Richtwert)
 * - actionState `failed` → Prüfen
 * - `pending`/`active` und Aktionsname enthält „wipe“ oder „retire“ → deutlicher Hinweis (Prüfen). Für
 *   `actionName` ist keine Werteliste dokumentiert – die Erkennung am Rohwert ist live zu verifizieren.
 * - sonst eine Tabelle der Aktionen (In Ordnung)
 */
import { formatDateTime, formatRelativeTime } from '../../domain/format';
import type {
  DeviceActionResultInfo,
  DeviceSnapshot,
  Finding,
  FindingTable,
  Severity,
  TileFact,
} from '../../domain/types';
import { de } from '../../i18n/de';
import { Docs } from '../knowledge/docs';
import { THRESHOLDS } from '../thresholds';

const t = de.fleet.remoteActions;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Höchstens so viele Aktionen einzeln als Befund bzw. in der Tabelle. */
export const MAX_ACTION_ROWS = 10;

export interface RemoteActionsContribution {
  findings: Finding[];
  facts: TileFact[];
  value?: { severity: Severity; value: string };
}

const actionTime = (action: DeviceActionResultInfo) =>
  action.lastUpdatedDateTime ?? action.startDateTime;

export const actionLabel = (action: DeviceActionResultInfo) => action.actionName ?? t.unnamed;
export const stateLabel = (action: DeviceActionResultInfo) =>
  action.actionState === 'unknown' && action.actionStateRaw
    ? action.actionStateRaw
    : (t.state[action.actionState] ?? action.actionState);

/** Zurücksetzen/Abkoppeln am Rohwert erkannt (keine Werteliste dokumentiert). */
export function isWipeOrRetire(action: DeviceActionResultInfo): boolean {
  return /wipe|retire/i.test(action.actionName ?? '');
}

/** Aktionen im Zeitfenster (eigener Richtwert), Eingabe ist bereits zuletzt aktualisierte zuerst. */
export function recentActions(
  actions: DeviceActionResultInfo[] | undefined,
  now: Date,
  days: number = THRESHOLDS.remoteActionRecentDays,
): DeviceActionResultInfo[] {
  const since = now.getTime() - days * DAY_MS;
  return (actions ?? []).filter((action) => {
    const ms = Date.parse(actionTime(action) ?? '');
    return !Number.isNaN(ms) && ms >= since;
  });
}

export function remoteActionsTable(actions: DeviceActionResultInfo[], now: Date): FindingTable {
  const c = t.columns;
  const when = (iso: string | null) => (iso ? formatRelativeTime(iso, now) : t.noValue);
  return {
    columns: [c.action, c.state, c.started, c.updated],
    rows: actions.slice(0, MAX_ACTION_ROWS).map((action) => ({
      cells: [
        actionLabel(action),
        stateLabel(action),
        when(action.startDateTime),
        when(action.lastUpdatedDateTime),
      ],
      highlight: action.actionState === 'failed',
      // Aktionsname ist ein englischer Microsoft-Rohwert; unbekannter Zustand ebenfalls
      cellLangs: [
        action.actionName ? 'en' : null,
        action.actionState === 'unknown' && action.actionStateRaw ? 'en' : null,
        null,
        null,
      ],
    })),
  };
}

export function remoteActionsContribution(
  snapshot: DeviceSnapshot,
  now: Date,
): RemoteActionsContribution {
  const { device } = snapshot;
  if (!device.actionResults) return { findings: [], facts: [] };
  const days = THRESHOLDS.remoteActionRecentDays;
  const recent = recentActions(device.actionResults, now, days);
  if (recent.length === 0) return { findings: [], facts: [] };

  const findings: Finding[] = [];
  const values: Array<{ severity: Severity; value: string }> = [];
  const base = { source: device.source };
  const when = (action: DeviceActionResultInfo) => {
    const time = actionTime(action);
    return time ? formatRelativeTime(time, now) : t.noValue;
  };
  const evidence = (action: DeviceActionResultInfo, index: number): Finding['evidence'] => ({
    actionName: action.actionName,
    actionState: action.actionStateRaw ?? action.actionState,
    startDateTime: action.startDateTime,
    lastUpdatedDateTime: action.lastUpdatedDateTime,
    index,
  });

  recent.slice(0, MAX_ACTION_ROWS).forEach((action, index) => {
    if (action.actionState === 'failed') {
      findings.push({
        ...base,
        id: `deviceStatus-action-failed-${index}`,
        severity: 'warning',
        title: t.failedTitle(actionLabel(action)),
        detail: `${t.failedDetail(when(action))} ${t.readOnlyNote}`,
        cause: t.failedCause,
        remediation: [...t.failedRemediation],
        evidence: evidence(action, index),
        docsUrl: Docs.deviceActionsTroubleshooting,
      });
      values.push({ severity: 'warning', value: t.valueFailed });
    } else if (
      (action.actionState === 'pending' || action.actionState === 'active') &&
      isWipeOrRetire(action)
    ) {
      const started = action.startDateTime
        ? formatRelativeTime(action.startDateTime, now)
        : t.noValue;
      findings.push({
        ...base,
        id: `deviceStatus-action-wipe-${index}`,
        severity: 'warning',
        title: t.wipeTitle(actionLabel(action)),
        detail: `${t.wipeDetail(stateLabel(action), started)} ${t.wipeNameNote} ${t.readOnlyNote}`,
        cause: t.wipeCause,
        remediation: [...t.wipeRemediation],
        evidence: evidence(action, index),
        docsUrl: Docs.deviceActionsTroubleshooting,
      });
      values.push({ severity: 'warning', value: t.valueWipe });
    }
  });

  findings.push({
    ...base,
    id: 'deviceStatus-actions',
    severity: 'ok',
    title: t.listTitle(recent.length),
    detail: `${t.listDetail(days)} ${t.readOnlyNote}`,
    cause: t.listCause,
    remediation: [...t.listRemediation],
    table: remoteActionsTable(recent, now),
    docsUrl: Docs.deviceActions,
  });

  const latest = recent[0]!;
  const latestTime = actionTime(latest);
  const facts: TileFact[] = [
    { label: t.facts.recent(days), value: String(recent.length) },
    {
      label: t.facts.failed,
      value: String(recent.filter((action) => action.actionState === 'failed').length),
    },
    {
      label: t.facts.latest,
      value: `${actionLabel(latest)} · ${stateLabel(latest)}`,
      ...(latestTime ? { title: formatDateTime(latestTime) } : {}),
    },
  ];
  // Zurücksetzen hat Vorrang vor „fehlgeschlagen“ als Kurzwert
  const value = values.find((v) => v.value === t.valueWipe) ?? values[0];
  return { findings, facts, ...(value ? { value } : {}) };
}
