/**
 * Alle UI-Texte zentral (Deutsch). Komponenten verwenden ausschließlich diese Konstanten,
 * damit eine spätere Übersetzung nur diese Datei betrifft. Wird in M1–M6 erweitert.
 */
import { deRules } from './de-rules';

export const de = {
  app: {
    name: 'MDM Doctor',
    tagline: 'Intune-Geräte in Sekunden diagnostizieren',
  },
  mode: {
    demo: 'Demo',
    live: 'Live',
    liveNotConfigured:
      'Live-Modus nicht konfiguriert – Client-ID und Tenant-ID in .env.local setzen.',
  },
  search: {
    placeholder: 'Gerätename eingeben …',
    button: 'Prüfen',
    noResults: 'Kein Gerät mit diesem Namen gefunden.',
    multipleResults: 'Mehrere Geräte gefunden – bitte auswählen.',
  },
  dropZone: {
    hint: 'oder DiagLogs-ZIP hierher ziehen',
    privacy: 'Die Datei wird nur lokal im Browser analysiert und nicht hochgeladen.',
  },
  tiles: {
    deviceStatus: 'Gerätestatus',
    compliance: 'Compliance',
    checkIn: 'Letzter Check-in',
    osVersion: 'Betriebssystem',
    bitlocker: 'BitLocker',
    defender: 'Defender',
    policies: 'Richtlinien',
    entraJoin: 'Entra-Join & PRT',
    win32Apps: 'Win32-Apps',
    enrollment: 'Enrollment',
    diagCollection: 'Diagnosedaten',
  },
  severity: {
    ok: 'In Ordnung',
    warning: 'Prüfen',
    critical: 'Problem',
    unknown: 'Unbekannt',
  },
  detail: {
    finding: 'Befund',
    cause: 'Ursache',
    remediation: 'Lösung',
    evidence: 'Rohdaten',
    source: 'Quelle',
    docs: 'Microsoft-Dokumentation',
    close: 'Schließen',
  },
  states: {
    loading: 'Wird geladen …',
    forbidden: 'Fehlende Berechtigung',
    notApplicable: 'Für dieses Gerät nicht anwendbar',
    unavailable: 'Daten nicht verfügbar',
    error: 'Fehler beim Laden',
    throttled: 'Microsoft Graph drosselt Anfragen – neuer Versuch folgt automatisch.',
    retryAfter: (seconds: number) =>
      seconds === 1
        ? 'Nächster Versuch in etwa 1 Sekunde.'
        : `Nächster Versuch in etwa ${seconds} Sekunden.`,
    offline:
      'Keine Internetverbindung – Microsoft Graph nicht erreichbar. Demo-Modus und ZIP-Analyse funktionieren weiter.',
    loadingLive: 'Live-Modus wird geladen …',
  },
  /** "Ticket-Notiz kopieren" (rein lokal, Markdown in die Zwischenablage) */
  ticket: {
    button: 'Ticket-Notiz kopieren',
    buttonHint: 'Befunde als Markdown in die Zwischenablage – es wird nichts gesendet.',
    copied: 'Kopiert',
    dialogTitle: 'Ticket-Notiz',
    dialogBody:
      'Das automatische Kopieren ist in diesem Browser nicht möglich. Markiere den Text und kopiere ihn mit Strg+C bzw. ⌘C.',
    textLabel: 'Ticket-Notiz als Markdown',
  },
  /** Kurzwert einer Kachel, deren Daten nicht ausgewertet werden konnten */
  availability: {
    forbidden: 'Fehlende Berechtigung',
    notApplicable: 'Nicht anwendbar',
    unavailable: 'Nicht verfügbar',
    error: 'Fehler beim Laden',
  },
  /** Kurzform für den Kachel-Badge (volle Form steht als Wert/Tooltip) */
  availabilityShort: {
    forbidden: 'Kein Zugriff',
    notApplicable: 'Nicht anwendbar',
    unavailable: 'Nicht verfügbar',
    error: 'Fehler',
  },
  /** Texte der Regel-Engine – siehe ./de-rules.ts */
  rules: deRules,
  /** Begründungen für SectionResult notApplicable/unavailable (Provider) */
  reasons: {
    defenderNotWindows:
      'Microsoft Defender-Status (windowsProtectionState) gibt es nur für Windows-Geräte.',
    defenderNotReported: 'Das Gerät hat noch keinen Defender-Status an Intune gemeldet.',
    noAzureAdDeviceId:
      'Das Gerät hat keine Entra-Geräte-ID (azureADDeviceId) – Entra-Daten können nicht zugeordnet werden.',
    bitlockerNotWindows: 'BitLocker-Wiederherstellungsschlüssel gibt es nur für Windows-Geräte.',
    entraNotReported: 'Microsoft Entra ID hat für dieses Gerät keine Daten geliefert (HTTP 404).',
    bitlockerNotReported:
      'Für dieses Gerät wurden keine BitLocker-Schlüsselinformationen gefunden (HTTP 404).',
    configurationPoliciesNotReported:
      'Für dieses Gerät wurden keine Konfigurationsprofil-Zustände gemeldet.',
    compliancePoliciesNotReported:
      'Für dieses Gerät wurden keine Compliance-Richtlinien-Zustände gemeldet.',
  },
  errors: {
    forbidden: 'Zugriff verweigert (HTTP 403).',
    deviceNotFound: 'Gerät nicht gefunden.',
    unauthenticated: 'Anmeldung erforderlich oder abgelaufen.',
    throttled: 'Zu viele Anfragen (HTTP 429) – Microsoft Graph drosselt.',
    network: 'Netzwerkfehler – Microsoft Graph ist nicht erreichbar.',
    aborted: 'Anfrage abgebrochen.',
    graph: 'Microsoft Graph hat einen Fehler gemeldet.',
    unknown: 'Unbekannter Fehler.',
    notFound: 'Ressource nicht gefunden (HTTP 404).',
    invalidNextLink:
      'Ungültiger Seitenlink – nur Adressen von graph.microsoft.com werden abgerufen.',
    parse: 'Die Antwort von Microsoft Graph konnte nicht gelesen werden.',
  },
  /** Anmeldung (MSAL) */
  auth: {
    title: 'Anmeldung erforderlich',
    description:
      'Der Live-Modus liest Gerätedaten read-only über Microsoft Graph. Melde dich mit einem Konto an, das Intune-Geräte lesen darf.',
    signIn: 'Mit Microsoft anmelden',
    signOut: 'Abmelden',
    signingIn: 'Anmeldung läuft …',
    loading: 'Anmeldestatus wird geprüft …',
    failed: 'Anmeldung fehlgeschlagen.',
    account: 'Angemeldetes Konto',
    notConfigured: 'Anmeldung nicht möglich: Client-ID und Tenant-ID fehlen (.env.local).',
  },
  /** UI-Shell (M2): Toolbar, Suche, Header, Sheet, Leerzustände */
  toolbar: {
    home: 'MDM Doctor – zur Startseite',
    modeLabel: 'Datenmodus',
    skipToContent: 'Zum Inhalt springen',
  },
  field: {
    label: 'Gerätename',
    shortcut: '⌘K',
    shortcutHint: 'Zum Suchen ⌘K, Strg+K oder / drücken',
    suggestions: 'Vorschläge',
    clear: 'Eingabe löschen',
    searching: 'Suche läuft …',
  },
  hero: {
    title: 'Intune-Geräte in Sekunden diagnostizieren',
    subtitle: 'Gerätenamen eingeben – oder ein Beispielgerät laden.',
  },
  header: {
    loadingDevice: 'Gerät wird geladen …',
    checking: (done: number, total: number) => `Auswertung läuft … ${done} von ${total}`,
    critical: (n: number) => (n === 1 ? '1 Problem' : `${n} Probleme`),
    warning: (n: number) => (n === 1 ? '1 Hinweis' : `${n} Hinweise`),
    unknown: (n: number) => `${n} ohne Bewertung`,
    allOk: 'Alles in Ordnung',
    enrolled: (date: string) => `Registriert am ${date}`,
    summaryLabel: 'Zusammenfassung',
  },
  grid: {
    label: 'Statuskacheln',
    open: 'Details anzeigen',
  },
  sheet: {
    loading: 'Wird ausgewertet …',
    allGood: 'Alles in Ordnung',
    allGoodHint: 'Es wurden keine Auffälligkeiten festgestellt.',
    facts: 'Geprüfte Werte',
    sources: 'Quellen',
    demoSource: (label: string) => `Demo-Daten · ${label}`,
    retry: 'Erneut laden',
    requiredScope: 'Benötigte Berechtigung',
    noticeTitle: 'Daten nicht ausgewertet',
    dragHandle: 'Zum Schließen nach unten ziehen',
    steps: 'Lösungsschritte',
    hint: 'Hinweis',
    copy: 'Kopieren',
    copied: 'Kopiert',
    copyFailed: 'Kopieren nicht möglich',
    showEvidence: 'Rohdaten anzeigen',
    hideEvidence: 'Rohdaten ausblenden',
  },
  picker: {
    title: 'Mehrere Geräte gefunden',
    subtitle: (count: number, query: string) =>
      `${count} Geräte passen zu „${query}“ – bitte eines auswählen.`,
    list: 'Gefundene Geräte',
    noUser: 'Kein Nutzer zugeordnet',
    lastSync: 'Letzter Check-in',
    select: (name: string) => `${name} auswählen`,
    compliance: {
      compliant: 'Konform',
      noncompliant: 'Nicht konform',
      conflict: 'Konflikt',
      error: 'Fehler',
      inGracePeriod: 'Karenzzeit',
      configManager: 'Configuration Manager',
      unknown: 'Unbekannt',
    },
  },
  empty: {
    notFoundTitle: 'Kein Gerät gefunden',
    notFoundBody: (query: string) =>
      `Zu „${query}“ gibt es kein Gerät. Prüfe die Schreibweise – es genügt auch ein Teil des Namens.`,
    searchFailedTitle: 'Die Suche ist fehlgeschlagen',
    liveUnavailableTitle: 'Live-Modus nicht konfiguriert',
    liveUnavailableBody:
      'Für den Live-Modus fehlen Client-ID und Tenant-ID einer Entra-App (.env.local, siehe README). Der Demo-Modus funktioniert ohne Konfiguration.',
    switchToDemo: 'Zum Demo-Modus wechseln',
    backToSearch: 'Neue Suche',
  },
  errorState: {
    titles: {
      forbidden: 'Fehlende Berechtigung',
      notFound: 'Gerät nicht gefunden',
      unauthenticated: 'Anmeldung erforderlich',
      throttled: 'Anfragen werden gedrosselt',
      network: 'Keine Verbindung',
      default: 'Gerät konnte nicht geladen werden',
    },
    requiredScope: 'Benötigte Berechtigung',
    requestId: 'Request-ID (für den Support)',
    retry: 'Erneut versuchen',
  },
  dropZoneUi: {
    label: 'DiagLogs-ZIP analysieren',
    choose: 'Datei auswählen',
    comingSoon: 'Die ZIP-Analyse ist hier nicht verfügbar.',
    dropActive: 'Zum Analysieren loslassen',
    notZip: 'Bitte eine ZIP-Datei auswählen.',
  },
  a11y: {
    searching: 'Suche läuft …',
    resultsFound: (n: number) => (n === 1 ? '1 Gerät gefunden' : `${n} Geräte gefunden`),
    noResults: 'Kein Gerät gefunden',
    deviceLoading: (name: string) => `${name} wird ausgewertet …`,
    deviceDone: (name: string, summary: string) => `${name}: Auswertung abgeschlossen. ${summary}`,
    sheetClosed: 'Details geschlossen',
  },
  diagnostics: {
    progress: {
      opening: 'ZIP-Verzeichnis wird gelesen …',
      results: 'Sammelprotokoll wird ausgewertet …',
      dsregcmd: 'Entra-Join-Status wird ausgewertet …',
      registry: 'Registry-Exporte werden ausgewertet …',
      imeLogs: (done: number, total: number) =>
        `IME-Logs werden ausgewertet … ${done} von ${total}`,
      done: 'Analyse abgeschlossen',
    },
    aborted: 'Analyse abgebrochen.',
    workerError: 'Die Analyse im Hintergrund ist fehlgeschlagen.',
    meaning: {
      pathNotFound: 'Pfad nicht gefunden',
      fileNotFound: 'Datei nicht gefunden',
    },
    notes: {
      parseFailed: (entry: string) =>
        `„${entry}“ konnte nicht ausgewertet werden (unerwartetes Format).`,
      binarySkipped: (count: number, byExtension: string) =>
        count === 1
          ? `1 Binärdatei nicht ausgewertet (${byExtension}).`
          : `${count} Binärdateien nicht ausgewertet (${byExtension}).`,
      tooLarge: (name: string, sizeMiB: number) =>
        `„${name}“ übersprungen: ${sizeMiB} MiB überschreiten das Größenlimit.`,
      unreadable: (name: string) => `„${name}“ konnte nicht gelesen werden.`,
      suspectEncoding: (name: string) =>
        `„${name}“ enthält nicht darstellbare Zeichen (evtl. andere Codepage).`,
      unknownEntries: (count: number) =>
        count === 1
          ? '1 Eintrag mit unbekanntem Namensschema wurde ignoriert.'
          : `${count} Einträge mit unbekanntem Namensschema wurden ignoriert.`,
      textNotEvaluated: (count: number) =>
        count === 1
          ? '1 Text-Eintrag wird im MVP nicht ausgewertet.'
          : `${count} Text-Einträge werden im MVP nicht ausgewertet.`,
      noDsregcmd: 'Keine dsregcmd-/status-Ausgabe im Archiv gefunden.',
      noEnrollments: 'Kein Enrollments-Registry-Export im Archiv gefunden.',
      noWin32Apps: 'Kein IntuneManagementExtension-Registry-Export im Archiv gefunden.',
      noImeLogs: 'Keine IME-Logdateien im Archiv gefunden.',
    },
  },
  /** DiagLogs-ZIP-Ansicht (M5): Fortschritt, Ergebnis, Fehler, Zusammenführen */
  zipView: {
    kind: 'DiagLogs-ZIP',
    collectedAt: (date: string) => `gesammelt am ${date}`,
    back: 'Andere Datei',
    exampleChip: 'Beispiel-ZIP analysieren',
    exampleChipHint: 'Fiktive Diagnosedaten',
    progress: {
      title: 'ZIP-Datei wird analysiert',
      starting: 'Analyse wird gestartet …',
      barLabel: 'Analysefortschritt',
      step: (done: number, total: number) => `Schritt ${done} von ${total}`,
      cancel: 'Abbrechen',
    },
    errors: {
      invalid: 'Keine gültige DiagLogs-ZIP-Datei.',
      invalidHint:
        'Erwartet wird die ZIP aus der Intune-Geräteaktion „Diagnose sammeln“ (DiagLogs-<Gerät>-<Zeitstempel>.zip).',
      notZip: 'Bitte eine ZIP-Datei auswählen.',
    },
    overlay: {
      title: 'DiagLogs-ZIP hier ablegen',
    },
    a11y: {
      analyzing: (fileName: string) => `${fileName} wird analysiert …`,
      done: (name: string, summary: string) => `${name}: Analyse abgeschlossen. ${summary}`,
    },
    merge: {
      title: (deviceName: string) => `Gerät ${deviceName} ist in Intune vorhanden`,
      body: 'Die Befunde aus der ZIP-Datei lassen sich mit den Intune-Daten in einer Ansicht zusammen anzeigen.',
      action: 'Mit Intune-Daten zusammenführen',
    },
    chip: {
      label: '+ DiagLogs-ZIP',
      title: (fileName: string) => `Befunde aus ${fileName}`,
      remove: 'DiagLogs-ZIP entfernen',
    },
  },
  demo: {
    examplesTitle: 'Beispielgeräte',
    scenarios: {
      'CONTOSO-PC001': 'Gesundes Gerät',
      'CONTOSO-PC014': 'BitLocker aus',
      'CONTOSO-PC027': 'Defender-Warnungen',
      'CONTOSO-PC033': 'Check-in überfällig',
      'CONTOSO-PC042': 'Richtlinienkonflikt',
      'CONTOSO-LT108': 'Windows 10 · Entra deaktiviert',
      'CONTOSO-MAC07': 'macOS-Gerät',
      'CONTOSO-PC050': 'Fehlende Berechtigung',
    },
  },
} as const;
