/**
 * App-Schutz (MAM) am Gerät (M20/S3, nur iOS/Android, optionaler Scope DeviceManagementApps.Read.All).
 * Grundlage sind die App-Schutz-Registrierungen des primären Benutzers (managedAppRegistrations, v1.0).
 * - flaggedReasons `rootedDevice` → Problem, wenn die Registrierung über den Gerätenamen zugeordnet ist;
 *   ist die Zuordnung nicht sicher (nur über den Benutzer), → Prüfen (kann ein anderes Gerät sein)
 * - letzte Synchronisierung älter als THRESHOLDS.appProtectionSyncWarningDays → Prüfen (eigener Richtwert)
 * - Zuordnung nur über den Benutzer → Hinweis, der das offen sagt
 * - keine Registrierung → Hinweis (kein Fehler: App-Schutz gilt je Benutzer und App)
 */
import { formatDateTime, formatRelativeTime } from '../../domain/format';
import type {
  AppProtectionRegistration,
  DeviceSnapshot,
  Finding,
  FindingTable,
  Tile,
  TileFact,
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
import { THRESHOLDS } from '../thresholds';

const t = de.fleet.appProtection;
const DAY_MS = 24 * 60 * 60 * 1000;

export const ROOTED_REASON = 'rootedDevice';

/** Ganze Tage seit der letzten Synchronisierung; null ohne gültigen Zeitstempel. */
export function daysSinceSync(entry: AppProtectionRegistration, now: Date): number | null {
  const time = Date.parse(entry.lastSyncDateTime ?? '');
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((now.getTime() - time) / DAY_MS));
}

const appName = (entry: AppProtectionRegistration) => entry.appIdentifier ?? entry.id;

export function appProtectionTable(
  registrations: AppProtectionRegistration[],
  now: Date,
): FindingTable {
  const c = t.columns;
  const value = (v: string | null) => v ?? t.noValue;
  return {
    columns: [c.app, c.device, c.platform, c.version, c.sdk, c.lastSync, c.flags],
    // Bundle-ID, Gerätetyp und Markierung sind Microsoft-Rohwerte; Versionen/Zeiten sprachneutral
    columnLangs: [null, null, null, null, null, null, 'en'],
    rows: registrations.map((entry) => {
      const flags = entry.flaggedReasons.join(', ');
      return {
        cells: [
          appName(entry),
          value(entry.deviceName),
          [entry.deviceType, entry.platformVersion].filter(Boolean).join(' ') || t.noValue,
          value(entry.applicationVersion),
          value(entry.managementSdkVersion),
          entry.lastSyncDateTime ? formatRelativeTime(entry.lastSyncDateTime, now) : t.noValue,
          flags || t.noValue,
        ],
        highlight: entry.flaggedReasons.includes(ROOTED_REASON),
        cellLangs: [null, null, null, null, null, null, flags ? 'en' : null],
      };
    }),
  };
}

export function evaluateAppProtection(snapshot: DeviceSnapshot, now: Date): Tile {
  const sections: Tile['sections'] = ['appProtection'];
  if (!sectionsLoaded(snapshot, sections)) return loadingTile('appProtection', sections);
  const section = snapshot.appProtection!;
  if (section.status !== 'ok') return unavailableTile('appProtection', sections, section);

  const { registrations, matchedBy, userRegistrationCount, pagesRead, truncated } = section.data;
  const sure = matchedBy === 'deviceName';
  const source = section.source;
  const findings: Finding[] = [];
  const threshold = THRESHOLDS.appProtectionSyncWarningDays;

  const rooted = registrations.filter((entry) => entry.flaggedReasons.includes(ROOTED_REASON));
  for (const entry of rooted) {
    findings.push({
      id: `appProtection-rooted-${entry.id}`,
      severity: sure ? 'critical' : 'warning',
      title: t.rootedTitle(appName(entry)),
      detail: t.rootedDetail(entry.deviceName, sure),
      cause: t.rootedCause,
      remediation: [...t.rootedRemediation],
      evidence: {
        appIdentifier: entry.appIdentifier,
        flaggedReasons: entry.flaggedReasons.join(', '),
        deviceName: entry.deviceName,
        matchedBy,
      },
      source,
      docsUrl:
        entry.appPlatform === 'android'
          ? Docs.appProtectionConditionalLaunchAndroid
          : Docs.appProtectionConditionalLaunch,
    });
  }

  const stale = registrations.filter((entry) => {
    const days = daysSinceSync(entry, now);
    return days !== null && days > threshold;
  });
  for (const entry of stale) {
    findings.push({
      id: `appProtection-stale-${entry.id}`,
      severity: 'warning',
      title: t.staleTitle(appName(entry), daysSinceSync(entry, now)!),
      detail: t.staleDetail(formatRelativeTime(entry.lastSyncDateTime!, now), threshold),
      cause: t.staleCause,
      remediation: [...t.staleRemediation],
      evidence: {
        appIdentifier: entry.appIdentifier,
        lastSyncDateTime: entry.lastSyncDateTime,
        thresholdDays: threshold,
      },
      source,
      docsUrl: Docs.appProtectionTroubleshooting,
    });
  }

  if (registrations.length > 0) {
    findings.push({
      id: 'appProtection-list',
      severity: 'ok',
      title: t.listTitle(registrations.length),
      detail: sure ? `${t.listDetail} ${t.deviceMatchNote}` : t.listDetail,
      cause: t.listCause,
      remediation: [...t.listRemediation],
      table: appProtectionTable(registrations, now),
      source,
      docsUrl: Docs.appProtectionMonitor,
    });
  }

  if (!sure && registrations.length > 0) {
    findings.push({
      id: 'appProtection-userMatch',
      severity: 'unknown',
      title: t.userMatchTitle,
      detail: t.userMatchDetail(snapshot.device.deviceName, userRegistrationCount),
      cause: t.userMatchCause,
      remediation: [...t.userMatchRemediation],
      evidence: { matchedBy, userRegistrations: userRegistrationCount },
      source,
      docsUrl: Docs.appProtectionMonitor,
    });
  }

  if (registrations.length === 0) {
    findings.push({
      id: 'appProtection-none',
      severity: 'unknown',
      title: t.noneTitle,
      detail: t.noneDetail(pagesRead, truncated),
      cause: t.noneCause,
      remediation: [...t.noneRemediation],
      evidence: { pagesRead, truncated },
      source,
      docsUrl: Docs.appProtectionTroubleshooting,
    });
  }

  if (truncated) {
    findings.push({
      id: 'appProtection-truncated',
      severity: 'unknown',
      title: t.truncatedTitle(pagesRead),
      detail: t.truncatedDetail,
      cause: t.truncatedCause,
      remediation: [...t.truncatedRemediation],
      evidence: { pagesRead, truncated },
      source,
      docsUrl: Docs.managedAppRegistrationsList,
    });
  }

  const facts: TileFact[] = [
    { label: t.facts.registrations, value: String(registrations.length) },
    { label: t.facts.flagged, value: String(rooted.length) },
    { label: t.facts.stale(threshold), value: String(stale.length) },
    {
      label: t.facts.matchedBy,
      value: sure ? t.facts.matchedByDevice : t.facts.matchedByUser,
    },
  ];
  const latest = registrations[0]?.lastSyncDateTime;
  if (latest) {
    facts.push({
      label: t.facts.latest,
      value: formatRelativeTime(latest, now),
      title: formatDateTime(latest),
    });
  }

  return {
    id: 'appProtection',
    title: de.tiles.appProtection,
    state: 'ready',
    // ohne Registrierung gibt es nichts zu bewerten → Hinweis statt „In Ordnung“
    severity: worstActionable(findings, registrations.length === 0 ? 'unknown' : 'ok'),
    value:
      registrations.length === 0
        ? t.valueNone
        : rooted.length > 0
          ? t.valueFlagged(rooted.length)
          : t.value(registrations.length),
    summary: registrations.length === 0 ? t.summaryNone : t.summary(registrations.length, sure),
    findings: sortFindings(findings),
    sources: [source],
    facts,
    sections,
  };
}
