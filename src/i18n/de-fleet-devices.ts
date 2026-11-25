/**
 * Texte der Ansicht „Flotte“ (M22): alle verwalteten Geräte des Mandanten in einer Liste. Eingehängt als
 * `de.fleetDevices`. (`de.fleet` gehört der Compliance-Übersicht aus M20.)
 */
import type { OsFamily } from '../domain/types';
import { THRESHOLDS } from '../rules/thresholds';

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const deFleetDevices = {
  title: 'Flotte',
  subtitle: 'Alle verwalteten Geräte des Mandanten – auffällige zuerst.',
  back: 'Zurück',
  refresh: 'Aktualisieren',
  export: {
    button: 'Exportieren (CSV)',
    columns: {
      device: 'Gerät',
      user: 'Benutzer',
      upn: 'UPN',
      platform: 'Plattform',
      osVersion: 'Version',
      model: 'Modell',
      serial: 'Seriennummer',
      compliance: 'Compliance',
      encryption: 'Verschlüsselung',
      lastCheckIn: 'Letzter Check-in',
      daysSinceCheckIn: 'Tage seit Check-in',
      issues: 'Auffälligkeiten',
    },
  },
  note: 'Die Liste zeigt nur, welche Geräte auffallen. Erklärung, Ursache und Lösung stehen in der Geräteansicht – ein Klick auf das Gerät öffnet sie.',
  summary: {
    label: 'Gesamtbild der Flotte',
    total: (n: number) => count(n, 'Gerät', 'Geräte'),
    totalMin: (n: number) => `mind. ${count(n, 'Gerät', 'Geräte')}`,
    withIssues: (n: number) => `${n} auffällig`,
    critical: (n: number) => `${n} kritisch`,
    warning: (n: number) => (n === 1 ? '1 Warnung' : `${n} Warnungen`),
    allClear: 'Keine Auffälligkeiten',
  },
  truncated: {
    title: 'Die Liste ist unvollständig',
    body: 'Microsoft Graph liefert die Geräte seitenweise; MDM Doctor liest nur eine begrenzte Zahl Seiten. Alle Zahlen sind deshalb Mindestwerte, weitere Geräte können fehlen.',
  },
  issues: {
    label: 'Auffälligkeiten',
    hint: 'Ein Klick filtert die Liste, ein zweiter hebt den Filter auf.',
    all: 'Alle Geräte',
    any: 'Nur auffällige',
    names: {
      nonCompliant: 'Nicht konform',
      notEncrypted: 'Nicht verschlüsselt',
      jailbroken: 'Jailbreak/Root',
      checkInOverdue: `Check-in seit über ${THRESHOLDS.checkInCriticalDays} Tagen`,
      gracePeriod: 'Karenzzeit',
      checkInLate: `Check-in seit über ${THRESHOLDS.checkInWarningDays} Tagen`,
    },
    severity: { critical: 'Kritisch', warning: 'Warnung' },
  },
  platform: {
    label: 'Plattform',
    all: 'Alle Plattformen',
    names: {
      windows: 'Windows',
      macos: 'macOS',
      ios: 'iOS/iPadOS',
      android: 'Android',
      linux: 'Linux',
      other: 'Sonstige',
    } satisfies Record<OsFamily, string>,
  },
  search: {
    label: 'Geräte durchsuchen',
    placeholder: 'Name, Benutzer, Seriennummer …',
    clear: 'Suche löschen',
  },
  list: {
    label: 'Geräteliste',
    counter: (shown: number, total: number) => `${shown} von ${count(total, 'Gerät', 'Geräten')}`,
    showMore: (n: number) => `Weitere anzeigen (${n})`,
    open: 'Gerät öffnen',
    columns: {
      device: 'Gerät',
      user: 'Benutzer',
      platform: 'Plattform',
      compliance: 'Compliance',
      encryption: 'Verschlüsselung',
      checkIn: 'Letzter Check-in',
      issues: 'Auffälligkeiten',
    },
    noUser: 'Kein Benutzer',
    noModel: 'Modell unbekannt',
    noVersion: 'Version unbekannt',
    noCheckIn: 'Kein Check-in gemeldet',
    noIssues: 'Keine Auffälligkeiten',
    encryption: { yes: 'Verschlüsselt', no: 'Nicht verschlüsselt', unknown: 'Unbekannt' },
    rowLabel: 'Gerät',
    empty: {
      title: 'Kein Gerät passt zu den Filtern',
      body: 'Lockere die Auswahl oder die Suche.',
      reset: 'Filter zurücksetzen',
    },
  },
  versions: {
    title: 'Versionsverteilung',
    hint: 'Eine reine Zählung der gemeldeten Betriebssystemversionen – ohne Bewertung, ob eine Version noch unterstützt wird.',
    platformTitle: (platform: string, total: number) =>
      `${platform} · ${count(total, 'Gerät', 'Geräte')}`,
    unknown: 'Version nicht gemeldet',
    share: (version: string, n: number, percent: string) =>
      `${version}: ${count(n, 'Gerät', 'Geräte')} (${percent})`,
    barLabel: (platform: string) => `Anteile der Versionen: ${platform}`,
    showAll: (n: number) => `Alle ${n} Versionen anzeigen`,
    showLess: 'Weniger anzeigen',
  },
  states: {
    loading: 'Geräte werden geladen …',
    loaded: (total: number, issues: number) =>
      `${count(total, 'Gerät', 'Geräte')} geladen, davon ${issues} auffällig.`,
    emptyTitle: 'Keine verwalteten Geräte',
    emptyBody: 'In diesem Mandanten sind keine Geräte in Intune registriert.',
    forbiddenBody:
      'Die Geräteliste braucht Lesezugriff auf verwaltete Geräte. Ein Administrator muss die Berechtigung erteilen.',
    requiredScope: 'Benötigte Berechtigung',
    unavailableTitle: 'Nicht verfügbar',
    errorTitle: 'Die Geräteliste konnte nicht geladen werden',
    retry: 'Erneut versuchen',
  },
} as const;
