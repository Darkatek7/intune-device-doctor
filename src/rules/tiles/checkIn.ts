/**
 * Letzter Check-in (lastSyncDateTime). ≤ 24 h ok, ≤ 7 Tage Warnung, sonst kritisch.
 * Entra-Anmeldung wird – sobald geladen – nur als zusätzlicher Wert angezeigt.
 */
import { daysSince, formatDateTime, formatRelativeTime, hoursSince } from '../../domain/format';
import type { DeviceSnapshot, Finding, Severity, Tile, TileFact } from '../../domain/types';
import { de } from '../../i18n/de';
import { uniqueSources } from '../helpers';
import { Docs } from '../knowledge/docs';
import { THRESHOLDS } from '../thresholds';

const t = de.rules.checkIn;
const f = de.rules.facts;

export function evaluateCheckIn(snapshot: DeviceSnapshot, now: Date): Tile {
  const { device } = snapshot;
  const last = device.lastSyncDateTime;
  const hours = hoursSince(last, now);
  const days = daysSince(last, now);
  const facts: TileFact[] = [
    { label: f.lastSync, value: formatRelativeTime(last, now), title: formatDateTime(last) },
  ];
  const entra = snapshot.entraDevice;
  if (entra?.status === 'ok' && entra.data?.approximateLastSignInDateTime) {
    const signIn = entra.data.approximateLastSignInDateTime;
    facts.push({
      label: f.entraLastSignIn,
      value: formatRelativeTime(signIn, now),
      title: formatDateTime(signIn),
    });
  }

  const findings: Finding[] = [];
  let severity: Severity = 'ok';
  const evidence = {
    lastSyncDateTime: last,
    hoursSinceLastSync: hours === null ? null : Math.round(hours),
    entraApproximateLastSignInDateTime:
      entra?.status === 'ok' ? (entra.data?.approximateLastSignInDateTime ?? null) : null,
  };
  const remediation = [...t.remediation];

  if (hours === null || days === null) {
    severity = 'unknown';
    findings.push({
      id: 'checkIn-never',
      severity: 'unknown',
      title: t.neverTitle,
      detail: t.neverDetail,
      cause: t.cause,
      remediation,
      evidence,
      source: device.source,
      docsUrl: Docs.deviceSync,
    });
  } else if (hours > THRESHOLDS.checkInWarningDays * 24) {
    severity = 'critical';
    findings.push({
      id: 'checkIn-stale',
      severity,
      title: t.staleTitle(formatRelativeTime(last, now)),
      detail: `${t.staleDetail(formatDateTime(last), days)} ${t.staleExtra}`,
      cause: t.cause,
      remediation,
      evidence,
      source: device.source,
      docsUrl: Docs.deviceSync,
    });
  } else if (hours > THRESHOLDS.checkInOkHours) {
    severity = 'warning';
    findings.push({
      id: 'checkIn-delayed',
      severity,
      title: t.warnTitle(formatRelativeTime(last, now)),
      detail: t.warnDetail(formatDateTime(last)),
      cause: t.cause,
      remediation,
      evidence,
      source: device.source,
      docsUrl: Docs.deviceSync,
    });
  }

  return {
    id: 'checkIn',
    title: de.tiles.checkIn,
    state: 'ready',
    severity,
    value: last ? formatRelativeTime(last, now) : t.valueNever,
    summary: last ? t.summary(formatDateTime(last)) : t.neverDetail,
    findings,
    sources: uniqueSources([device.source, entra?.status === 'ok' ? entra.source : undefined]),
    facts,
    sections: [],
  };
}
