/**
 * Texte der Ansicht „Richtlinien“ (M15): Richtlinie → betroffene Geräte. Eingebunden in de.ts als
 * `de.policies`; alle Texte deutsch.
 */
import type { ComplianceStatus } from '../graph/dto';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const dePolicies = {
  title: 'Richtlinien',
  subtitle: 'Bei welchen Geräten schlägt eine Richtlinie fehl?',
  back: 'Startseite',
  refresh: 'Aktualisieren',
  filterLabel: 'Richtlinien nach Namen filtern',
  filterPlaceholder: 'Name filtern …',
  listLabel: 'Richtlinien, sortiert nach Problemen',
  count: (shown: number, total: number) =>
    shown === total
      ? `${total} ${plural(total, 'Richtlinie', 'Richtlinien')}`
      : `${shown} von ${total} Richtlinien`,
  empty: 'Keine Konfigurationsprofile oder Compliance-Richtlinien gefunden.',
  emptyFilter: (query: string) => `Keine Richtlinie enthält „${query}“.`,
  kind: {
    configuration: 'Konfiguration',
    compliance: 'Compliance',
  },
  /** Überschrift der Hinweise je Liste */
  listName: {
    configuration: 'Konfigurationsprofile',
    compliance: 'Compliance-Richtlinien',
  },
  platform: {
    windows: 'Windows',
    macos: 'macOS',
    ios: 'iOS/iPadOS',
    android: 'Android',
    linux: 'Linux',
    other: 'Andere',
  },
  platformUnknown: 'Plattform nicht erkennbar',
  modified: (relative: string) => `geändert ${relative}`,
  counts: {
    error: 'Fehler',
    failed: 'Fehlgeschlagen',
    pending: 'Ausstehend',
    success: 'Erfolgreich',
    notApplicable: 'Nicht anwendbar',
  },
  /** Zähler-Chips in der Liste (Zahl + Text, nie nur Farbe) */
  countChip: {
    error: (n: number) => `${n} Fehler`,
    failed: (n: number) => `${n} fehlgeschlagen`,
    pending: (n: number) => `${n} ausstehend`,
    success: (n: number) => `${n} erfolgreich`,
  },
  noDevices: 'Keine Geräte gemeldet',
  overview: {
    notRequested: 'Zähler nicht abgefragt',
    forbidden: 'Zähler: fehlende Berechtigung',
    unavailable: 'Zähler nicht verfügbar',
    error: 'Zähler: Fehler beim Laden',
  },
  notes: {
    counts:
      'Die Zähler stammen aus deviceStatusOverview (v1.0): Fehler, fehlgeschlagen, ausstehend, erfolgreich und nicht anwendbar. Einen Zähler für Konflikte oder „nicht konform“ gibt es dort nicht – beides zeigt der Gerätestatus einer Richtlinie.',
    notRequested: (limit: number, skipped: number) =>
      `Zähler werden höchstens für ${limit} Richtlinien abgefragt, die zuletzt geänderten zuerst. ${skipped} ${plural(skipped, 'weitere Richtlinie wurde', 'weitere Richtlinien wurden')} nicht abgefragt – ein Klick zeigt den Gerätestatus trotzdem.`,
    listTruncated: (list: string) =>
      `${list}: Die Liste ist länger als die gelesenen Seiten – nicht alle Richtlinien werden angezeigt.`,
    betaTitle: 'Über dokumentierte API nicht verfügbar',
    beta: 'Profile aus dem Einstellungskatalog (configurationPolicies) und Richtlinien der Endpunktsicherheit (intents) gibt es nur in der Beta-Version von Microsoft Graph. Sie fehlen in dieser Liste – ihren Status im Intune Admin Center prüfen.',
  },
  listForbidden: (list: string) => `${list}: fehlende Berechtigung`,
  listError: (list: string) => `${list}: Fehler beim Laden`,
  listUnavailable: (list: string) => `${list}: nicht verfügbar`,
  requiredScope: 'Benötigte Berechtigung',
  retry: 'Erneut versuchen',
  openPolicy: 'Gerätestatus anzeigen',
  a11y: {
    loading: 'Richtlinien werden geladen …',
    done: (count: number, problems: number) =>
      `${count} ${plural(count, 'Richtlinie', 'Richtlinien')} geladen, ${problems} mit Problemen.`,
    detailLoading: 'Gerätestatus wird geladen …',
    detailDone: (shown: number, total: number) => `${shown} von ${total} Geräten angezeigt.`,
  },
  detail: {
    back: 'Alle Richtlinien',
    notFoundTitle: 'Richtlinie nicht gefunden',
    notFoundBody:
      'Die Richtlinie steht nicht in der geladenen Liste – sie wurde vielleicht gelöscht, oder die Liste ist unvollständig.',
    filterLabel: 'Geräte filtern',
    filterProblems: 'Nur Probleme',
    filterAll: 'Alle Geräte',
    tableLabel: (policy: string) => `Gerätestatus der Richtlinie ${policy}`,
    columns: {
      device: 'Gerät',
      user: 'Benutzer',
      model: 'Modell',
      status: 'Status',
      lastReported: 'Zuletzt gemeldet',
    },
    noValue: '–',
    empty: 'Für diese Richtlinie hat noch kein Gerät einen Status gemeldet.',
    emptyProblems:
      'Kein Gerät meldet für diese Richtlinie einen Fehler, Konflikt oder „nicht konform“.',
    truncated: (pages: number) =>
      `Gelesen wurden die ersten ${pages} ${plural(pages, 'Seite', 'Seiten')} des Gerätestatus; weitere Geräte wurden nicht abgefragt.`,
    deviceHint:
      'Der Gerätestatus enthält keine dokumentierte Geräte-ID. Ein Klick auf den Namen sucht das Gerät deshalb über die normale Suche.',
    platformNote:
      'Eine Plattform je Gerät ist im Gerätestatus nicht dokumentiert – angezeigt wird das gemeldete Modell.',
    deprecation:
      'Microsoft kennzeichnet den Gerätestatus von Konfigurationsprofilen (deviceConfigurationDeviceStatus) als „being deprecated starting May 2026“. Fehlen hier Geräte, im Intune Admin Center gegenprüfen.',
    source: 'Quelle',
    docs: 'Microsoft-Dokumentation',
    openDevice: 'Gerät suchen und öffnen',
  },
  /** Status je Gerät (complianceStatus, Enum laut Doku) */
  status: {
    unknown: 'Unbekannt',
    notApplicable: 'Nicht anwendbar',
    compliant: 'Erfolgreich',
    remediated: 'Behoben',
    nonCompliant: 'Nicht konform',
    error: 'Fehler',
    conflict: 'Konflikt',
    notAssigned: 'Nicht zugewiesen',
  } satisfies Record<ComplianceStatus, string>,
  reasons: {
    listNotFound: 'Microsoft Graph kennt diese Richtlinienliste nicht (HTTP 404).',
    overviewNotFound: 'Für diese Richtlinie liefert Microsoft Graph keine Übersicht (HTTP 404).',
    statusesNotFound:
      'Microsoft Graph kennt unter dieser ID keine Richtlinie dieses Typs (HTTP 404) – sie wurde vielleicht gelöscht.',
  },
};
