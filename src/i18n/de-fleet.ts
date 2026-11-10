/**
 * Texte für M20: Compliance-Übersicht des Mandanten, Änderungsprotokoll, App-Schutz (MAM) am Gerät und
 * letzte Remote-Aktionen. Eingebunden in de.ts als `de.fleet`; alle Texte deutsch. Microsoft-Rohwerte
 * (Aktivitätsnamen, `actionName`, Einstellungsnamen) werden nie übersetzt, sondern unverändert gezeigt.
 *
 * Ursachen und Lösungsschritte stützen sich ausschließlich auf die Microsoft-Learn-Quellen in
 * `src/rules/knowledge/docs.ts` (Abschnitte M20). Eigene Schwellenwerte sind als „eigener Richtwert“
 * gekennzeichnet.
 */
import type { DeviceStateCountField, SettingSummaryPlatformType } from '../graph/dto';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const devices = (n: number) => `${n} ${plural(n, 'Gerät', 'Geräte')}`;

export const deFleet = {
  tiles: {
    tenantCompliance: 'Compliance im Mandanten',
    tenantConfiguration: 'Konfigurationsprofile im Mandanten',
    tenantChanges: 'Letzte Änderungen',
    appProtection: 'App-Schutz',
  },

  /** Abschnitte der Ansicht „Mandant“ */
  sections: {
    overview: 'Compliance und Konfiguration',
    service: 'Dienststatus und Registrierung',
    changes: 'Änderungen',
    certificates: 'Zertifikate und Token',
  },

  // ---------- S1: Compliance-Übersicht ----------
  summary: {
    /** Bezeichnungen der dokumentierten Zähler (Graph-Feldname → deutsch) */
    count: {
      compliantDeviceCount: 'Konform',
      nonCompliantDeviceCount: 'Nicht konform',
      inGracePeriodCount: 'In Schonfrist',
      errorDeviceCount: 'Fehler',
      conflictDeviceCount: 'Konflikt',
      unknownDeviceCount: 'Unbekannt',
      notApplicableDeviceCount: 'Nicht anwendbar',
      remediatedDeviceCount: 'Behoben',
      configManagerCount: 'Über Configuration Manager',
    } satisfies Record<DeviceStateCountField, string>,
    /** Für Profile heißt „konform“ in der Oberfläche „erfolgreich“ – der Feldname bleibt in den Rohdaten. */
    configurationCount: {
      compliantDeviceCount: 'Erfolgreich',
      nonCompliantDeviceCount: 'Fehlgeschlagen',
    } as Partial<Record<DeviceStateCountField, string>>,
    platform: {
      android: 'Android',
      iOS: 'iOS/iPadOS',
      macOS: 'macOS',
      windowsPhone81: 'Windows Phone 8.1',
      windows81AndLater: 'Windows 8.1 und neuer',
      windows10AndLater: 'Windows 10 und neuer',
      androidWorkProfile: 'Android (Arbeitsprofil)',
      linux: 'Linux',
      all: 'Alle Plattformen',
    } satisfies Record<SettingSummaryPlatformType, string>,
    platformRaw: (raw: string | null) => (raw ? `Nicht dokumentiert: ${raw}` : 'Ohne Angabe'),
    noValue: '–',
    /** Eigener Richtwert: Anteil nicht konformer Geräte, ab dem die Kachel „Prüfen“ zeigt */
    shareThresholdNote: (percent: number) =>
      `Eigener Richtwert der App (kein Microsoft-Wert): ab ${percent} % nicht konformer Geräte „Prüfen“.`,
    valueShare: (percent: string) => `${percent} konform`,
    valueNone: 'Keine Geräte gemeldet',
    summary: (nonCompliant: number, problems: number) =>
      [
        `${devices(nonCompliant)} nicht konform`,
        problems > 0 ? `${devices(problems)} mit Fehler oder Konflikt` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    summaryConfiguration: (failed: number, problems: number) =>
      [
        `${devices(failed)} fehlgeschlagen`,
        problems > 0 ? `${devices(problems)} mit Fehler oder Konflikt` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    summaryNone: 'Microsoft meldet für keine Kategorie Geräte.',
    configurationValue: (percent: string) => `${percent} erfolgreich`,
    facts: {
      total: 'Summe der Zähler',
      share: 'Anteil konform',
      shareConfiguration: 'Anteil erfolgreich',
    },
    errorTitle: (n: number) => `${devices(n)} melden einen Fehler`,
    errorDetail:
      'Mindestens eine Einstellung meldet „Fehler“. Laut Microsoft bleibt der Compliance-Status eines Geräts dann bis zu sieben Tage unverändert; meldet die Einstellung danach weiter einen Fehler, wird das Gerät als nicht konform (oder „in Schonfrist“) geführt.',
    errorCause:
      'Die Auswertung einer Einstellung ist auf dem Gerät fehlgeschlagen oder noch nicht abgeschlossen.',
    errorRemediation: [
      'Im Intune Admin Center unter Geräte › Compliance › Überwachen den Bericht „Einstellungs-Compliance“ öffnen und die Einstellungen mit Fehlern prüfen.',
      'Einzelne betroffene Geräte hier in der App öffnen – die Kachel „Compliance“ zeigt die fehlerhafte Einstellung mit Fehlercode.',
    ],
    configurationErrorDetail:
      'Mindestens ein Profil meldet auf diesen Geräten „Fehler“ – die Einstellung wurde nicht angewendet.',
    configurationErrorRemediation: [
      'In der Ansicht „Richtlinien“ die Profile mit Fehlern öffnen und die betroffenen Geräte prüfen.',
      'Ein betroffenes Gerät hier in der App öffnen – die Kachel „Richtlinien“ zeigt Einstellung und Fehlercode.',
    ],
    conflictTitle: (n: number) => `${devices(n)} melden einen Konflikt`,
    conflictDetail:
      'Mehrere Richtlinien setzen dieselbe Einstellung unterschiedlich. Laut Microsoft hat bei Konflikten zwischen Compliance- und Konfigurationsrichtlinie die Compliance-Richtlinie Vorrang; bei mehreren Compliance-Richtlinien gilt die strengste.',
    conflictCause: 'Überlappende Zuweisungen mit widersprüchlichen Werten.',
    conflictRemediation: [
      'Die Zuweisungen der beteiligten Richtlinien vergleichen und den Wert nur in einer Richtlinie setzen.',
      'Ein betroffenes Gerät hier in der App öffnen – die Kachel „Richtlinien“ nennt die Quellen des Konflikts.',
    ],
    nonCompliantTitle: (n: number, percent: string) =>
      `${devices(n)} nicht konform (${percent} der gemeldeten Geräte)`,
    nonCompliantDetail: (threshold: number) =>
      `Nicht konforme Geräte erfüllen mindestens eine Einstellung einer zugewiesenen Compliance-Richtlinie nicht. Eigener Richtwert der App (kein Microsoft-Wert): ab ${threshold} % zeigt die Kachel „Prüfen“, darunter ist es ein Hinweis.`,
    nonCompliantCause:
      'Geräte erfüllen Einstellungen nicht (z. B. Kennwort, Verschlüsselung, Betriebssystemversion) oder Benutzer haben sie noch nicht angepasst.',
    nonCompliantRemediation: [
      'Die häufigsten Verstöße (unten) zuerst angehen – sie betreffen die meisten Geräte.',
      'Im Intune Admin Center unter Geräte › Compliance › Überwachen den Bericht „Nicht konforme Geräte“ öffnen.',
    ],
    countsTitle: 'Alle Zähler',
    countsDetail:
      'Die Zähler stammen unverändert von Microsoft. Ob sich Kategorien überschneiden, dokumentiert Microsoft nicht – der Anteil bezieht sich deshalb auf die Summe der Zähler.',
    countsCause: 'Übersicht, kein Befund.',
    countsRemediation: [
      'Für Details den Bericht im Intune Admin Center öffnen (Geräte › Compliance › Überwachen).',
    ],
    columns: { category: 'Kategorie', count: 'Geräte', field: 'Graph-Feld' },
    topTitle: 'Häufigste Verstöße',
    topDetail: (shown: number, total: number) =>
      shown === total
        ? `${shown} ${plural(shown, 'Einstellung', 'Einstellungen')} mit nicht konformen Geräten, meiste zuerst.`
        : `Die ${shown} Einstellungen mit den meisten nicht konformen Geräten (von ${total} mit Verstößen). Die Grenze von ${shown} ist ein eigener Richtwert der App.`,
    topNone: 'Keine Einstellung meldet nicht konforme Geräte.',
    topCause:
      'Einstellungen mit den meisten nicht konformen Geräten über alle Compliance-Richtlinien.',
    topRemediation: [
      'Die Einstellung im Intune Admin Center unter Geräte › Compliance › Überwachen › Einstellungs-Compliance öffnen und die betroffenen Geräte ansehen.',
    ],
    topColumns: {
      setting: 'Einstellung',
      platform: 'Plattform',
      nonCompliant: 'Nicht konform',
      error: 'Fehler',
      conflict: 'Konflikt',
    },
    truncatedTitle: (pages: number) =>
      `Nur die ersten ${pages} ${plural(pages, 'Seite', 'Seiten')} der Einstellungen geprüft`,
    truncatedDetail:
      'Microsoft liefert weitere Einstellungen. Für diese Liste sind weder Filter noch Sortierung dokumentiert – Einstellungen mit vielen Verstößen können fehlen.',
    truncatedCause: 'Bewusste Grenze, damit die Ansicht schnell bleibt.',
    truncatedRemediation: [
      'Die vollständige Liste im Intune Admin Center unter Geräte › Compliance › Überwachen › Einstellungs-Compliance ansehen.',
    ],
    settingsIssueTitle: 'Häufigste Verstöße nicht abrufbar',
    bar: {
      label: (kind: string) => `Anteile ${kind}`,
      compliance: 'Compliance im Mandanten',
      configuration: 'Konfigurationsprofile im Mandanten',
      /** Textalternative des Balkens */
      text: (parts: string[]) => parts.join(', '),
      part: (label: string, count: number, percent: string) => `${label}: ${count} (${percent})`,
      legend: 'Legende',
    },
  },

  // ---------- S2: Änderungsprotokoll ----------
  audit: {
    value: (n: number) =>
      n === 0 ? 'Keine Änderungen' : `${n} ${plural(n, 'Änderung', 'Änderungen')}`,
    summary: (days: number, latest: string | null) =>
      latest ? `Letzte ${days} Tage · zuletzt ${latest}` : `Letzte ${days} Tage`,
    summaryNone: (days: number) => `In den letzten ${days} Tagen wurde nichts protokolliert.`,
    listTitle: (days: number) => `Änderungen der letzten ${days} Tage`,
    listDetail: (shown: number, total: number) =>
      shown === total
        ? `${shown} ${plural(shown, 'Eintrag', 'Einträge')} aus dem Intune-Überwachungsprotokoll, neueste zuerst.`
        : `Die neuesten ${shown} von ${total} Einträgen aus dem Intune-Überwachungsprotokoll.`,
    listCause:
      'Übersicht, kein Befund. Das Zeitfenster ist ein eigener Richtwert der App, keine Microsoft-Vorgabe. Aktivität, Kategorie und Ergebnis stammen unverändert von Microsoft. Angezeigt wird, wer die Änderung ausgelöst hat (Benutzer oder Anwendung) – IP-Adressen und Berechtigungen liest die App nie.',
    listRemediation: [
      'Details (geänderte Eigenschaften, alte und neue Werte) im Intune Admin Center unter Mandantenverwaltung › Überwachungsprotokolle öffnen.',
    ],
    noneTitle: (days: number) => `Keine Änderungen in den letzten ${days} Tagen`,
    noneDetail: (read: number) =>
      `Unter den ${read} gelesenen Einträgen liegt keiner im Zeitfenster.`,
    columns: {
      time: 'Zeitpunkt',
      activity: 'Aktivität',
      category: 'Kategorie / Komponente',
      result: 'Ergebnis',
      object: 'Objekt (Typ)',
      actor: 'Wer',
    },
    actor: {
      user: (name: string) => name,
      application: (name: string) => `${name} (Anwendung)`,
      unknown: 'Nicht angegeben',
    },
    objectCell: (name: string | null, type: string | null) =>
      [name ?? '–', type ? `(${type})` : null].filter(Boolean).join(' '),
    noValue: '–',
    truncatedTitle: (pages: number) =>
      `Nur die ersten ${pages} ${plural(pages, 'Seite', 'Seiten')} des Protokolls gelesen`,
    truncatedDetail:
      'Microsoft liefert weitere Einträge. Für das Überwachungsprotokoll sind weder Filter noch Sortierung dokumentiert, auch die Reihenfolge der Seiten nicht – Änderungen im Zeitfenster können deshalb fehlen.',
    truncatedCause: 'Bewusste Grenze, damit die Ansicht schnell bleibt.',
    truncatedRemediation: [
      'Das vollständige Protokoll im Intune Admin Center unter Mandantenverwaltung › Überwachungsprotokolle mit Datumsfilter ansehen.',
    ],
    facts: {
      window: 'Zeitfenster (eigener Richtwert)',
      count: 'Änderungen',
      read: 'Gelesene Einträge',
      pages: 'Gelesene Seiten',
    },
    windowValue: (days: number) => `${days} Tage`,
    // Richtlinien-Detail
    policyTitle: 'Änderungen an dieser Richtlinie',
    policyNone: 'Im gelesenen Protokoll gibt es keine Änderung an dieser Richtlinie.',
    policyLoading: 'Änderungsprotokoll wird geladen …',
    policyTableLabel: (policy: string) => `Änderungen an ${policy}`,
    policyMatchNote:
      'Abgleich: Ressourcen-ID des Protokolleintrags (auditResource.resourceId) gleich der ID der Richtlinie. Dass beide übereinstimmen, dokumentiert Microsoft nicht ausdrücklich – fehlende Einträge heißen deshalb nicht sicher „keine Änderung“. Es werden nur die gelesenen Seiten berücksichtigt.',
    policyForbidden: (scope: string) =>
      `Änderungen nicht abrufbar: Es fehlt die Berechtigung ${scope} oder eine Intune-Rolle mit „Audit data – Read“.`,
    policyUnavailable: (reason: string) => `Änderungen nicht abrufbar: ${reason}`,
    /** Ruhiger Hinweis – ausdrücklich ohne Kausalität */
    changedBeforeProblems: (date: string, activity: string, devices: number) =>
      `Am ${date} geändert („${activity}“). Danach ${devices === 1 ? 'meldete 1 Gerät' : `meldeten ${devices} Geräte`} ein Problem mit dieser Richtlinie. Ein Zusammenhang ist möglich, aber nicht belegt.`,
    changedBeforeProblemsNote: (days: number) =>
      `Eigener Richtwert der App: Änderungen bis ${days} Tage vor der Meldung werden genannt.`,
  },

  // ---------- S3: App-Schutz (MAM) am Gerät ----------
  appProtection: {
    value: (n: number) => `${n} ${plural(n, 'App', 'Apps')}`,
    valueFlagged: (n: number) => `${n} markiert`,
    valueNone: 'Keine Registrierung',
    summary: (n: number, matchedByDevice: boolean) =>
      matchedByDevice
        ? `${n} ${plural(n, 'App-Schutz-Registrierung meldet', 'App-Schutz-Registrierungen melden')} den Namen dieses Geräts.`
        : `${n} ${plural(n, 'Registrierung', 'Registrierungen')} des Benutzers – Zuordnung zum Gerät nicht sicher.`,
    summaryNone: 'Für den primären Benutzer ist keine App-Schutz-Registrierung gemeldet.',
    columns: {
      app: 'App',
      device: 'Gerätename (gemeldet)',
      platform: 'Betriebssystem',
      version: 'App-Version',
      sdk: 'SDK-Version',
      lastSync: 'Letzte Synchronisierung',
      flags: 'Markierung',
    },
    noValue: '–',
    tableLabel: 'App-Schutz-Registrierungen',
    listTitle: (n: number) =>
      `${n} ${plural(n, 'App-Schutz-Registrierung', 'App-Schutz-Registrierungen')}`,
    listDetail:
      'Registrierungen der App-Schutzrichtlinien (MAM) des primären Benutzers, zuletzt synchronisierte zuerst. Bundle-ID bzw. Paketname, Versionen und Markierungen erscheinen unverändert, wie Microsoft sie meldet.',
    /** Ergänzt listDetail, wenn die Zuordnung über den Gerätenamen gelang */
    deviceMatchNote:
      'Zuordnung zum Gerät über den gemeldeten Gerätenamen, nicht über eine Geräte-ID: Tragen mehrere Geräte des Benutzers denselben Namen, erscheinen auch deren Registrierungen.',
    listCause:
      'Jede App mit Intune App SDK, in der sich der Benutzer mit dem Geschäftskonto anmeldet, registriert sich beim Intune-App-Schutzdienst.',
    listRemediation: [
      'Details im Intune Admin Center unter Apps › Überwachen › App-Schutzstatus › Zugewiesene Benutzer für den Benutzer prüfen (Richtlinie, Status, letzte Synchronisierung).',
    ],
    rootedTitle: (app: string) => `${app}: läuft laut Intune auf einem Gerät mit Jailbreak/Root`,
    rootedDetail: (deviceName: string | null, sure: boolean) =>
      `Die Registrierung ist mit „rootedDevice“ markiert${deviceName ? ` (gemeldeter Gerätename „${deviceName}“)` : ''}.${
        sure
          ? ' Zugeordnet über den gleichen Gerätenamen – eine Geräte-ID nennt die Graph-API v1.0 an der Registrierung nicht.'
          : ' Die Zuordnung zu diesem Gerät ist nicht sicher – es kann sich um ein anderes Gerät des Benutzers handeln.'
      }`,
    rootedCause:
      'Der App-Schutzdienst hat erkannt, dass das Gerät per Jailbreak oder Root entsperrt ist. Auf solchen Geräten sind die Schutzmechanismen des Betriebssystems umgangen.',
    rootedRemediation: [
      'Mit dem Benutzer klären, ob das Gerät entsperrt (Jailbreak/Root) ist; geschäftliche Daten sollten auf einem solchen Gerät nicht genutzt werden.',
      'In der App-Schutzrichtlinie unter „Bedingter Start“ die Gerätebedingung „Gerät mit Jailbreak/Rooting“ prüfen – Microsoft sieht dort „Zugriff blockieren“ oder „Daten löschen“ vor.',
      'Status im Intune Admin Center unter Apps › Überwachen › App-Schutzstatus kontrollieren.',
    ],
    staleTitle: (app: string, days: number) => `${app}: seit ${days} Tagen nicht synchronisiert`,
    staleDetail: (relative: string, threshold: number) =>
      `Letzte Synchronisierung ${relative}. Hinweis ab ${threshold} Tagen – eigener Richtwert dieser App, keine Microsoft-Vorgabe.`,
    staleCause:
      'Warum die Synchronisierung ausbleibt, zeigen die Daten nicht. Laut Microsoft prüft das Intune App SDK regelmäßig auf Richtlinienänderungen; das verzögert sich, wenn sich die App nicht beim Dienst gemeldet hat oder das Unternehmensportal vom Gerät entfernt wurde. Ist der Benutzer in der App nicht mit dem Geschäftskonto angemeldet, kommen Richtlinienänderungen nicht an.',
    staleRemediation: [
      'Mit dem Benutzer klären, ob die App auf diesem Gerät noch genutzt wird und mit dem Geschäftskonto angemeldet ist.',
      'Netzwerkverbindung prüfen; auf Android die aktuelle Version des Unternehmensportals sicherstellen.',
      'Wird die App nicht mehr genutzt, ist kein Eingriff nötig – die Registrierung bleibt in den Berichten noch eine Zeit lang sichtbar.',
    ],
    userMatchTitle: 'Zuordnung zum Gerät nicht sicher',
    userMatchDetail: (deviceName: string, count: number) =>
      `Keine Registrierung meldet den Gerätenamen „${deviceName}“. Die Graph-API v1.0 nennt an der Registrierung keine Geräte-ID – deshalb zeigt die Kachel alle ${count} ${plural(count, 'Registrierung', 'Registrierungen')} des Benutzers, möglicherweise auch von anderen Geräten.`,
    userMatchCause:
      'Ab iOS 16 melden alle App-Schutz-Berichte laut Microsoft nur einen generischen Gerätenamen (z. B. „iPhone“). Außerdem kann der Benutzer mehrere Geräte nutzen.',
    userMatchRemediation: [
      'Im Intune Admin Center unter Apps › Überwachen › App-Schutzstatus den Benutzer öffnen – dort stehen je App-Instanz Gerätetyp, Plattform und ggf. die MDM-Geräte-ID.',
    ],
    noneTitle: 'Keine App-Schutz-Registrierung',
    noneDetail: (pagesRead: number, truncated: boolean) =>
      truncated
        ? `In den ersten ${pagesRead} Seiten der Mandantenliste ist für den primären Benutzer keine Registrierung enthalten; weitere Seiten wurden nicht gelesen.`
        : 'Für den primären Benutzer meldet Intune keine App-Schutz-Registrierung.',
    noneCause:
      'Eine Registrierung entsteht erst, wenn sich der Benutzer in einer App mit Intune App SDK mit dem Geschäftskonto anmeldet und eine App-Schutzrichtlinie dem Benutzer zugewiesen ist. App-Schutzrichtlinien gelten nur für Benutzer, nicht für Geräte.',
    noneRemediation: [
      'Prüfen, ob dem Benutzer eine App-Schutzrichtlinie zugewiesen ist (Apps › App-Schutzrichtlinien › Zuweisungen).',
      'Im Intune Admin Center unter Apps › Überwachen › App-Schutzstatus › Zugewiesene Benutzer den Benutzer auswählen.',
    ],
    truncatedTitle: (pages: number) => `Nur die ersten ${pages} Seiten geprüft`,
    truncatedDetail:
      'Für die Liste der App-Schutz-Registrierungen sind weder Filter noch Sortierung dokumentiert. Die App liest nur die ersten Seiten der Mandantenliste; weitere Registrierungen des Benutzers können fehlen.',
    truncatedCause: 'Großer Mandant mit vielen App-Instanzen.',
    truncatedRemediation: [
      'Vollständige Liste im Intune Admin Center unter Apps › Überwachen › App-Schutzstatus.',
    ],
    facts: {
      registrations: 'Registrierungen',
      flagged: 'Markiert (Jailbreak/Root)',
      stale: (days: number) => `Älter als ${days} Tage (eigener Richtwert)`,
      latest: 'Zuletzt synchronisiert',
      matchedBy: 'Zuordnung',
      matchedByDevice: 'über den Gerätenamen',
      matchedByUser: 'nur über den Benutzer',
    },
  },

  // ---------- S4: Letzte Remote-Aktionen ----------
  remoteActions: {
    /** Zustände laut actionState (v1.0) */
    state: {
      none: 'Keiner',
      pending: 'Ausstehend',
      canceled: 'Abgebrochen',
      active: 'Aktiv',
      done: 'Abgeschlossen',
      failed: 'Fehlgeschlagen',
      notSupported: 'Nicht unterstützt',
      unknown: 'Unbekannt',
    } as Record<string, string>,
    /** Hinweis in jedem Befund: die App liest nur */
    readOnlyNote:
      'MDM Doctor löst selbst keine Aktionen aus – die Angaben stammen aus Intune (managedDevice.deviceActionResults).',
    columns: {
      action: 'Aktion (Rohwert)',
      state: 'Status',
      started: 'Gestartet',
      updated: 'Zuletzt aktualisiert',
    },
    noValue: '–',
    tableLabel: 'Letzte Remote-Aktionen',
    unnamed: 'Aktion ohne Namen',
    listTitle: (n: number) =>
      `${n} ${plural(n, 'Remote-Aktion', 'Remote-Aktionen')} in den letzten Tagen`,
    listDetail: (days: number) =>
      `Von Intune gemeldete Remote-Aktionen der letzten ${days} Tage (Zeitraum: eigener Richtwert). Der Aktionsname erscheint unverändert, wie Microsoft ihn liefert.`,
    listCause:
      'Remote-Aktionen werden von Administratoren im Intune Admin Center, per Graph-API oder vom Benutzer im Unternehmensportal ausgelöst.',
    listRemediation: [
      'Alle Aktionen des Mandanten mit Status unter Geräte › Überwachen › Geräteaktionen ansehen.',
      'Wer eine Aktion ausgelöst hat, zeigt Mandantenverwaltung › Überwachungsprotokolle (Spalte „Initiiert von“).',
    ],
    failedTitle: (action: string) => `Remote-Aktion „${action}“ fehlgeschlagen`,
    failedDetail: (when: string) =>
      `Intune meldet die Aktion als fehlgeschlagen (zuletzt aktualisiert ${when}).`,
    failedCause:
      'Das Gerät konnte die Aktion nicht ausführen, oder sie wird auf dieser Plattform bzw. in diesem Registrierungstyp nicht unterstützt. Gründe nennt Microsoft je Aktion in der Fehlerbehebung für Geräteaktionen.',
    failedRemediation: [
      'Status und Details unter Geräte › Überwachen › Geräteaktionen prüfen.',
      'Voraussetzungen der Aktion (Plattform, Registrierungstyp, Rolle) in der Microsoft-Dokumentation der Aktion abgleichen und die Aktion bei Bedarf im Intune Admin Center erneut auslösen.',
    ],
    wipeTitle: (action: string) =>
      `„${action}“ ist noch nicht abgeschlossen – Gerät wird möglicherweise zurückgesetzt oder abgekoppelt`,
    wipeDetail: (state: string, when: string) =>
      `Status „${state}“, gestartet ${when}. Sobald sich das Gerät meldet, kann es zurückgesetzt bzw. aus der Verwaltung entfernt werden – Fehlersuche an diesem Gerät ist dann womöglich nicht mehr sinnvoll.`,
    wipeCause:
      'Laut Microsoft melden Geräte ihren Status nicht immer an Intune zurück, bevor das Zurücksetzen bzw. Abkoppeln beginnt – der Status bleibt dann „Ausstehend“. Ein Gerät, das sich nicht meldet, bleibt ausstehend, bis sein MDM-Zertifikat abläuft. Zurücksetzen, Abkoppeln und Löschen haben Vorrang vor allen anderen ausstehenden Aktionen.',
    wipeRemediation: [
      'Vor weiteren Schritten mit dem Benutzer bzw. dem auslösenden Administrator klären, ob das Zurücksetzen/Abkoppeln gewollt ist (Überwachungsprotokolle, Spalte „Initiiert von“).',
      'Ist die Aktion nachweislich erfolgt, das Gerät laut Microsoft aus Intune löschen.',
    ],
    wipeNameNote:
      'Erkannt am Rohwert des Aktionsnamens (enthält „wipe“ oder „retire“); Microsoft dokumentiert keine Werteliste – live zu verifizieren.',
    facts: {
      recent: (days: number) => `Remote-Aktionen (${days} Tage)`,
      failed: 'Davon fehlgeschlagen',
      latest: 'Letzte Aktion',
    },
    valueFailed: 'Aktion fehlgeschlagen',
    /** Kurzwert der Kachel: Rohwert der Aktion und Status – bewusst ohne Deutung */
    valuePending: (action: string, state: string) => `${action} · ${state}`,
    timelineTitle: (action: string) => `Remote-Aktion „${action}“`,
    timelineDetail: (state: string) =>
      `Status: ${state}. Ausgelöst in Intune, nicht durch MDM Doctor.`,
    /** Zeitachse: noch offenes Zurücksetzen/Abkoppeln – Erkennung am Rohwert offenlegen */
    timelineDetailPending: (state: string) =>
      `Status: ${state}. Als Zurücksetzen bzw. Abkoppeln am Rohwert des Aktionsnamens erkannt (Microsoft dokumentiert keine Werteliste). Ausgelöst in Intune, nicht durch MDM Doctor.`,
  },

  reasons: {
    summaryNotReported: 'Microsoft meldet für diesen Mandanten keine Zusammenfassung.',
    auditNotReported: 'Das Überwachungsprotokoll ist für diesen Mandanten nicht verfügbar.',
    appProtectionPlatform:
      'App-Schutz-Registrierungen werden nur für iOS/iPadOS und Android ausgewertet. Windows-MAM ist nur in der Beta-API dokumentiert und wird nicht abgefragt.',
    appProtectionNoUser:
      'Kein primärer Benutzer – App-Schutzrichtlinien gelten je Benutzer, eine Zuordnung ist nicht möglich.',
    appProtectionNotReported:
      'Microsoft meldet für diesen Mandanten keine App-Schutz-Registrierungen.',
  },
} as const;
