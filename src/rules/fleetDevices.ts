/**
 * Regelwerk der Ansicht „Flotte“ (M22): reine Funktionen `FleetDevicesInfo → FleetOverview`.
 *
 * Bewertet wird nur, was die Geräteliste liefert, und mit denselben Maßstäben wie in der Geräteansicht:
 * - Compliance wie die Kachel „Compliance“ (`noncompliant`/`error`/`conflict` kritisch, `inGracePeriod`
 *   Warnung),
 * - Verschlüsselung wie die Kachel „Verschlüsselung“ (`isEncrypted === false` kritisch; null = keine
 *   Aussage, keine Auffälligkeit),
 * - letzter Check-in mit den Schwellwerten der Kachel „Letzter Check-in“ (`THRESHOLDS`),
 * - Jailbreak/Root wie die Kachel „Gerätestatus“ (`jailBroken === 'True'` kritisch).
 *
 * Die Verteilung der Betriebssystemversionen ist eine reine Zählung – ob eine Version „veraltet“ ist,
 * bewertet die Liste nicht (dafür fehlt je Plattform eine dokumentierte Quelle; die Geräteansicht prüft
 * Windows-Versionen einzeln).
 *
 * „Verwaltet von“ ordnet den Rohwert `managementAgent` einer Gruppe zu (`fleetManagementOf`). Grundlage
 * sind die Beschreibungen des Enums `managementAgentType` auf Learn; was dort nicht steht oder nicht
 * geliefert wird, landet sichtbar unter `other` und nie stillschweigend bei Intune.
 */
import type { FleetDevice, FleetDevicesInfo } from '../domain/fleetDevices';
import { hoursSince, osFamilyFrom } from '../domain/format';
import type { OsFamily, Severity } from '../domain/types';
import { THRESHOLDS } from './thresholds';

/** Auffälligkeiten in fester Reihenfolge (so erscheinen sie in Kacheln, Filter und Export). */
export const FLEET_ISSUES = [
  'nonCompliant',
  'notEncrypted',
  'jailbroken',
  'checkInOverdue',
  'gracePeriod',
  'checkInLate',
] as const;
export type FleetIssue = (typeof FLEET_ISSUES)[number];

export const FLEET_ISSUE_SEVERITY: Record<FleetIssue, 'critical' | 'warning'> = {
  nonCompliant: 'critical',
  notEncrypted: 'critical',
  jailbroken: 'critical',
  checkInOverdue: 'critical',
  gracePeriod: 'warning',
  checkInLate: 'warning',
};

/** Plattformen in fester Reihenfolge der Anzeige. */
export const FLEET_PLATFORMS: readonly OsFamily[] = [
  'windows',
  'macos',
  'ios',
  'android',
  'linux',
  'other',
];

/** Gruppen für „Verwaltet von“ in fester Reihenfolge der Anzeige. */
export const FLEET_MANAGEMENTS = [
  'intune',
  'coManaged',
  'configMgr',
  'mde',
  'eas',
  'jamf',
  'other',
] as const;
export type FleetManagement = (typeof FLEET_MANAGEMENTS)[number];

/**
 * Zuordnung `managementAgent` → Gruppe, nach den Beschreibungen auf Learn
 * (https://learn.microsoft.com/en-us/graph/api/resources/intune-shared-managementagenttype):
 * - `intune`: alle Werte, die Intune als MDM bzw. Intune-Client nennen. `googleCloudDevicePolicyController`
 *   („managed by Google's CloudDPC“) zählt dazu, weil Android-Enterprise-Geräte in Intune über diesen
 *   Agenten verwaltet werden – eine Ableitung, die Learn am Enum nicht ausdrücklich nennt.
 * - `coManaged`: Configuration Manager **und** MDM; `configMgr`: nur Configuration Manager.
 * - `mde`: `msSense`. Learn beschreibt den Wert nicht; die Zuordnung zu Microsoft Defender for Endpoint
 *   ist abgeleitet (Sicherheitseinstellungsverwaltung: solche Geräte zeigen im Intune Admin Center
 *   „Managed by: MDE“). Der Rohwert steht deshalb immer mit in Zeile und Export.
 * - alles andere (`unknown`, `google`, künftige Werte, nicht geliefert) → `other`.
 */
const MANAGEMENT_BY_AGENT: Readonly<Record<string, FleetManagement>> = {
  mdm: 'intune',
  easMdm: 'intune',
  intuneClient: 'intune',
  easIntuneClient: 'intune',
  microsoft365ManagedMdm: 'intune',
  intuneAosp: 'intune',
  googleCloudDevicePolicyController: 'intune',
  configurationManagerClientMdm: 'coManaged',
  configurationManagerClientMdmEas: 'coManaged',
  configurationManagerClient: 'configMgr',
  msSense: 'mde',
  eas: 'eas',
  jamf: 'jamf',
};

export function fleetManagementOf(managementAgent: string | null): FleetManagement {
  if (!managementAgent) return 'other';
  return Object.hasOwn(MANAGEMENT_BY_AGENT, managementAgent)
    ? MANAGEMENT_BY_AGENT[managementAgent]!
    : 'other';
}

export interface FleetRow {
  device: FleetDevice;
  platform: OsFamily;
  /** Gruppe für „Verwaltet von“; der Rohwert steht in `device.managementAgent` */
  management: FleetManagement;
  issues: FleetIssue[];
  /** Schlimmste Auffälligkeit; `ok` = keine */
  severity: Extract<Severity, 'ok' | 'warning' | 'critical'>;
  /** Volle Tage seit dem letzten Check-in; null = kein Zeitpunkt gemeldet */
  daysSinceCheckIn: number | null;
}

export interface FleetIssueGroup {
  issue: FleetIssue;
  severity: 'critical' | 'warning';
  count: number;
}

export interface FleetPlatformCount {
  platform: OsFamily;
  count: number;
  withIssues: number;
}

export interface FleetManagementCount {
  management: FleetManagement;
  count: number;
}

export interface FleetOsVersions {
  platform: OsFamily;
  total: number;
  /** Neueste Version zuerst; Geräte ohne gemeldete Version unter `version: null` am Ende */
  versions: Array<{ version: string | null; count: number }>;
}

/** Zählung über eine Menge von Zeilen – die ganze Flotte oder ein gefilterter Ausschnitt. */
export interface FleetCounts {
  total: number;
  /** Geräte mit mindestens einer Auffälligkeit */
  withIssues: number;
  critical: number;
  warning: number;
  /** Alle Auffälligkeiten in fester Reihenfolge, auch mit `count: 0` */
  groups: FleetIssueGroup[];
  /** Nur Plattformen mit Geräten */
  platforms: FleetPlatformCount[];
  /** Nur Gruppen mit Geräten */
  managements: FleetManagementCount[];
  osVersions: FleetOsVersions[];
}

export interface FleetOverview extends FleetCounts {
  /** Auffällige zuerst (kritisch, Warnung), dann nach Anzahl der Auffälligkeiten, dann nach Name */
  rows: FleetRow[];
  truncated: boolean;
}

const NON_COMPLIANT_STATES = new Set(['noncompliant', 'error', 'conflict']);

/** Auffälligkeiten eines Geräts (in der Reihenfolge von `FLEET_ISSUES`). */
export function fleetIssuesOf(device: FleetDevice, now: Date): FleetIssue[] {
  const hours = hoursSince(device.lastSyncDateTime, now);
  const found = new Set<FleetIssue>();
  if (NON_COMPLIANT_STATES.has(device.complianceState)) found.add('nonCompliant');
  if (device.complianceState === 'inGracePeriod') found.add('gracePeriod');
  if (device.isEncrypted === false) found.add('notEncrypted');
  if (device.jailBroken === 'True') found.add('jailbroken');
  if (hours !== null) {
    if (hours > THRESHOLDS.checkInCriticalDays * 24) found.add('checkInOverdue');
    else if (hours > THRESHOLDS.checkInWarningDays * 24) found.add('checkInLate');
  }
  return FLEET_ISSUES.filter((issue) => found.has(issue));
}

function severityOf(issues: readonly FleetIssue[]): FleetRow['severity'] {
  if (issues.some((issue) => FLEET_ISSUE_SEVERITY[issue] === 'critical')) return 'critical';
  return issues.length > 0 ? 'warning' : 'ok';
}

const SEVERITY_RANK: Record<FleetRow['severity'], number> = { critical: 0, warning: 1, ok: 2 };

const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

/** Versionsvergleich über die Zahlenfolgen (`10.0.22631.4460` > `10.0.19045.5131`), sonst alphabetisch. */
export function compareOsVersions(a: string, b: string): number {
  const partsA = a.match(/\d+/g)?.map(Number) ?? [];
  const partsB = b.match(/\d+/g)?.map(Number) ?? [];
  const length = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return collator.compare(a, b);
}

function osVersionsOf(rows: readonly FleetRow[]): FleetOsVersions[] {
  return FLEET_PLATFORMS.flatMap((platform) => {
    const ofPlatform = rows.filter((row) => row.platform === platform);
    if (ofPlatform.length === 0) return [];
    const counts = new Map<string | null, number>();
    for (const row of ofPlatform) {
      const version = row.device.osVersion?.trim() || null;
      counts.set(version, (counts.get(version) ?? 0) + 1);
    }
    const versions = [...counts]
      .map(([version, count]) => ({ version, count }))
      .sort((a, b) => {
        if (a.version === null) return 1;
        if (b.version === null) return -1;
        return compareOsVersions(b.version, a.version);
      });
    return [{ platform, total: ofPlatform.length, versions }];
  });
}

/** Zählt eine Menge von Zeilen aus (Reihenfolge der Zeilen spielt keine Rolle). */
export function countFleetRows(rows: readonly FleetRow[]): FleetCounts {
  return {
    total: rows.length,
    withIssues: rows.filter((row) => row.severity !== 'ok').length,
    critical: rows.filter((row) => row.severity === 'critical').length,
    warning: rows.filter((row) => row.severity === 'warning').length,
    groups: FLEET_ISSUES.map((issue) => ({
      issue,
      severity: FLEET_ISSUE_SEVERITY[issue],
      count: rows.filter((row) => row.issues.includes(issue)).length,
    })),
    platforms: FLEET_PLATFORMS.flatMap((platform) => {
      const ofPlatform = rows.filter((row) => row.platform === platform);
      return ofPlatform.length === 0
        ? []
        : [
            {
              platform,
              count: ofPlatform.length,
              withIssues: ofPlatform.filter((row) => row.severity !== 'ok').length,
            },
          ];
    }),
    managements: FLEET_MANAGEMENTS.flatMap((management) => {
      const count = rows.filter((row) => row.management === management).length;
      return count === 0 ? [] : [{ management, count }];
    }),
    osVersions: osVersionsOf(rows),
  };
}

export function evaluateFleet(info: FleetDevicesInfo, now: Date): FleetOverview {
  const rows: FleetRow[] = info.devices.map((device) => {
    const issues = fleetIssuesOf(device, now);
    const hours = hoursSince(device.lastSyncDateTime, now);
    return {
      device,
      platform: osFamilyFrom(device.operatingSystem),
      management: fleetManagementOf(device.managementAgent),
      issues,
      severity: severityOf(issues),
      daysSinceCheckIn: hours === null ? null : Math.floor(hours / 24),
    };
  });
  rows.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.issues.length - a.issues.length ||
      collator.compare(a.device.deviceName, b.device.deviceName),
  );
  return { ...countFleetRows(rows), rows, truncated: info.truncated };
}

export interface FleetFilter {
  /** null = alle Geräte; `'any'` = nur auffällige */
  issue: FleetIssue | 'any' | null;
  platform: OsFamily | null;
  /** „Verwaltet von“, Mehrfachauswahl; leer = alle */
  managements: readonly FleetManagement[];
  /** Freitext über Gerätename, Benutzer, Seriennummer, Modell, OS-Version (ohne Groß-/Kleinschreibung) */
  query: string;
}

export const EMPTY_FLEET_FILTER: FleetFilter = {
  issue: null,
  platform: null,
  managements: [],
  query: '',
};

/** Filtert die (bereits sortierten) Zeilen; die Reihenfolge bleibt erhalten. */
export function filterFleetRows(rows: readonly FleetRow[], filter: FleetFilter): FleetRow[] {
  const needle = filter.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter.issue === 'any' && row.issues.length === 0) return false;
    if (filter.issue && filter.issue !== 'any' && !row.issues.includes(filter.issue)) return false;
    if (filter.platform && row.platform !== filter.platform) return false;
    if (filter.managements.length > 0 && !filter.managements.includes(row.management)) return false;
    if (!needle) return true;
    const { device } = row;
    return [
      device.deviceName,
      device.userPrincipalName,
      device.userDisplayName,
      device.serialNumber,
      device.model,
      device.manufacturer,
      device.osVersion,
    ].some((value) => value?.toLowerCase().includes(needle));
  });
}

export function isFleetIssue(value: string | null | undefined): value is FleetIssue {
  return FLEET_ISSUES.includes(value as FleetIssue);
}

/**
 * Zahlen passend zur aktuellen Auswahl. Jede Filterleiste zählt mit allen **anderen** Filtern (so zeigt
 * eine Zahl, was ein Klick ergibt, und die gewählte Option fällt nicht auf 0); Gesamtbild und
 * Versionsverteilung zählen genau die Zeilen der Liste.
 */
export interface FleetFacets {
  /** Zeilen der Liste (alle Filter), Reihenfolge wie übergeben */
  rows: FleetRow[];
  /** Zählung über genau diese Zeilen */
  counts: FleetCounts;
  /** Je Auffälligkeit: Geräte ohne den Auffälligkeiten-Filter */
  issues: Record<FleetIssue, number>;
  /** Je Plattform: Geräte ohne den Plattformfilter */
  platforms: Record<OsFamily, number>;
  /** Je Gruppe: Geräte ohne den Filter „Verwaltet von“ */
  managements: Record<FleetManagement, number>;
}

function tally<K extends string>(keys: readonly K[], values: Iterable<K>): Record<K, number> {
  const result = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const value of values) result[value] += 1;
  return result;
}

export function fleetFacets(rows: readonly FleetRow[], filter: FleetFilter): FleetFacets {
  const listed = filterFleetRows(rows, filter);
  const withoutIssue = filterFleetRows(rows, { ...filter, issue: null });
  const withoutPlatform = filterFleetRows(rows, { ...filter, platform: null });
  const withoutManagement = filterFleetRows(rows, { ...filter, managements: [] });
  return {
    rows: listed,
    counts: countFleetRows(listed),
    issues: tally(
      FLEET_ISSUES,
      withoutIssue.flatMap((row) => row.issues),
    ),
    platforms: tally(
      FLEET_PLATFORMS,
      withoutPlatform.map((row) => row.platform),
    ),
    managements: tally(
      FLEET_MANAGEMENTS,
      withoutManagement.map((row) => row.management),
    ),
  };
}

export function isFleetManagement(value: string | null | undefined): value is FleetManagement {
  return FLEET_MANAGEMENTS.includes(value as FleetManagement);
}
