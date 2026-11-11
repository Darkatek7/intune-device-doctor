/**
 * Alle UI-Texte zentral (Deutsch). Komponenten verwenden ausschließlich diese Konstanten,
 * damit eine spätere Übersetzung nur diese Datei betrifft. Wird in M1–M6 erweitert.
 */
import { deAnalysis } from './de-analysis';
import { dePolicies } from './de-policies';
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
    placeholder: 'Gerätename, Benutzer oder Seriennummer …',
    button: 'Prüfen',
    noResults: 'Kein Gerät mit diesem Namen, Benutzer oder dieser Seriennummer gefunden.',
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
    apps: 'Apps',
    signIns: 'Anmeldungen',
    laps: 'Lokaler Administrator (LAPS)',
    autopilot: 'Autopilot',
    registration: 'Registrierung (Benutzer)',
    securityAlerts: 'Sicherheitswarnungen',
    // Ansicht „Mandant“ (M14/S5)
    tenantApplePush: 'Apple-MDM-Push-Zertifikat',
    tenantVpp: 'Apple-VPP-Token',
    tenantUnavailable: 'Weitere Konnektoren und Token',
    groups: 'Gruppen',
    attestation: 'Integritätsnachweis',
    enrollment: 'Enrollment',
    certsNetwork: 'Zertifikate & Netzwerk',
    diagCollection: 'Diagnosedaten',
    mdmEvents: 'MDM-Ereignisse',
    mdmDiagReport: 'MDM-Diagnosebericht',
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
    /** Zugänglicher Name der scrollbaren Befund-Tabelle (per Tastatur erreichbar) */
    table: (title: string) => `Tabelle: ${title}`,
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
  analysis: deAnalysis,
  policies: dePolicies,
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
    appsNoPrimaryUser:
      'Das Gerät hat keinen primären Benutzer – Intune meldet den App-Status über die dokumentierte API nur pro Benutzer.',
    applePushNotApple: 'Das Apple-MDM-Push-Zertifikat betrifft nur macOS-, iOS- und iPadOS-Geräte.',
    applePushNotReported:
      'Graph meldet HTTP 404 für das Apple-MDM-Push-Zertifikat – über diese Schnittstelle nicht verfügbar.',
    appsNotReported: 'Für den primären Benutzer wurde kein App-Status gefunden (HTTP 404).',
    // M10: Anmeldungen (Entra-Anmeldeprotokoll)
    signInsNoPrimaryUser:
      'Das Gerät hat keinen primären Benutzer – das Anmeldeprotokoll wird pro Benutzer abgefragt.',
    signInsNotReported:
      'Graph meldet HTTP 404 für das Anmeldeprotokoll – über diese Schnittstelle nicht verfügbar.',
    // M10: weitere Geräte des Benutzers (Geräte-Header)
    userDevicesNoUser: 'Das Gerät hat keinen primären Benutzer.',
    userDevicesNotReported: 'Graph liefert keine weiteren Geräte des Benutzers (HTTP 404).',
    // M10: Integritätsnachweis
    attestationNotWindows:
      'Der Integritätsnachweis (Device Health Attestation) gilt nur für Windows.',
    attestationNotReported:
      'Graph meldet HTTP 404 für den Integritätsnachweis – über diese Schnittstelle nicht verfügbar.',
    // M10: Gruppen des Geräts
    groupsNotReported:
      'Graph meldet HTTP 404 für das Entra-Gerät – die Gruppen sind über diese Schnittstelle nicht verfügbar.',
    // M10: Windows Autopilot
    autopilotNotWindows: 'Windows Autopilot gibt es nur unter Windows.',
    autopilotNotReported:
      'Graph meldet HTTP 404 für die Autopilot-Geräteliste – über diese Schnittstelle nicht verfügbar.',
    autopilotNotFoundInLimit: (pages: number) =>
      `Das Gerät wurde in den ersten ${pages} Seiten der Autopilot-Geräteliste nicht gefunden; weitere Seiten wurden nicht gelesen (für die Liste ist kein Filter dokumentiert). Das Gerät kann trotzdem registriert sein.`,
    // M10: Windows LAPS
    lapsNotWindows: 'Windows LAPS gibt es nur unter Windows.',
    lapsNotReported:
      'Graph liefert keinen LAPS-Eintrag für dieses Gerät (HTTP 404) – was das bedeutet, ist in der Dokumentation nicht beschrieben.',
    // M14/S5: Mandanten-Status
    vppTokensNotReported:
      'Graph meldet HTTP 404 für die VPP-Token – über diese Schnittstelle nicht verfügbar.',
    // M14/S4: Sicherheitswarnungen
    securityAlertsNotReported:
      'Graph meldet HTTP 404 für die Sicherheitswarnungen – über diese Schnittstelle nicht verfügbar.',
    // M14/S3: Registrierung des Benutzers
    licenseNoPrimaryUser:
      'Das Gerät hat keinen primären Benutzer – es gibt keine Lizenz zu prüfen.',
    licenseNotReported:
      'Graph meldet HTTP 404 für die Lizenzdetails des Benutzers – über diese Schnittstelle nicht verfügbar.',
    enrollmentLimitsNoPrimaryUser:
      'Das Gerät hat keinen primären Benutzer – das Gerätelimit gilt je Benutzer.',
    enrollmentLimitsNotReported:
      'Graph meldet HTTP 404 für die Registrierungskonfigurationen – über diese Schnittstelle nicht verfügbar.',
    // M14/S2: Zuweisungen
    assignmentsNothingToCheck:
      'Keine Richtlinien oder Apps aus den Gerätezuständen vorhanden – es gibt nichts abzugleichen.',
    assignmentsNotReported:
      'Graph meldet HTTP 404 für die Zuweisungen – über diese Schnittstelle nicht verfügbar.',
    // M14/S1: gleichnamige Entra-Objekte
    duplicatesNoName:
      'Das Gerät hat keinen Namen – gleichnamige Entra-Objekte lassen sich nicht suchen.',
    duplicatesNotReported:
      'Graph meldet HTTP 404 für die Suche nach gleichnamigen Entra-Objekten – über diese Schnittstelle nicht verfügbar.',
    appsNoEntries:
      'Graph (beta) meldet für den primären Benutzer keinen App-Status – über diese Schnittstelle nicht verfügbar. Status im Intune Admin Center unter „Managed Apps“ prüfen.',
    appsDeviceNotListed: (n: number) =>
      `Graph (beta) liefert App-Status für ${n} ${n === 1 ? 'Gerät' : 'Geräte'} des primären Benutzers, aber nicht für dieses Gerät. Status im Intune Admin Center unter „Managed Apps“ prüfen.`,
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
  theme: {
    toLight: 'Helles Erscheinungsbild',
    toDark: 'Dunkles Erscheinungsbild',
  },
  /** Links ins Intune Admin Center (src/links/intunePortal.ts) */
  links: {
    openApp: 'App im Intune Admin Center öffnen',
    assignIntuneLicense: 'Intune-Lizenzen zuweisen (Microsoft Learn)',
    openInDefender: 'Im Defender-Portal öffnen',
    openDevice: 'Gerät im Intune Admin Center öffnen',
    openManagedApps: 'Managed Apps des Geräts im Intune Admin Center',
    openDeviceInventory: 'Geräteinventar im Intune Admin Center',
    /** Kurztexte der Link-Zeile im Geräte-Header (voller Text als A11y-Name/Tooltip) */
    portalPrefix: 'Intune Admin Center:',
    shortDevice: 'Gerät',
    shortManagedApps: 'Managed Apps',
    shortDeviceInventory: 'Geräteinventar',
    configurationPolicies: 'Konfigurationsprofile im Intune Admin Center',
    appName: 'App-Name',
    publisher: 'Herausgeber',
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
    /** Hinweis auf der Anmelde-Ansicht nach automatischer Abmeldung (M16/S2) */
    idleSignedOut: (minutes: number) =>
      `Aus Sicherheitsgründen nach ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'} Inaktivität abgemeldet.`,
    idleWarningTitle: 'Bald abgemeldet',
    idleWarning:
      'Aus Sicherheitsgründen wirst du bei weiterer Inaktivität in weniger als einer Minute abgemeldet. Geladene Gerätedaten werden dabei verworfen.',
    idleSecondsLeft: (seconds: number) => `Noch ${seconds} s`,
    idleStay: 'Angemeldet bleiben',
  },
  /** UI-Shell (M2): Toolbar, Suche, Header, Sheet, Leerzustände */
  /** Verbindungstest (M14/S6, nur Live) */
  connectionTest: {
    open: 'Verbindungstest',
    openHint: 'Jeden verwendeten Graph-Endpunkt einmal lesend prüfen',
    title: 'Verbindungstest',
    subtitle:
      'Ruft jeden von MDM Doctor verwendeten Graph-Endpunkt genau einmal lesend (GET) auf und zeigt nur Ergebnis, Dauer, Anzahl der Einträge und die Namen der Felder – keine Werte.',
    deviceHint:
      'Die Parameter stammen vom gewählten Gerät. Am aussagekräftigsten ist ein Windows-Gerät mit primärem Benutzer.',
    back: 'Zurück zum Gerät',
    start: 'Test starten',
    restart: 'Erneut testen',
    cancel: 'Abbrechen',
    running: (done: number, total: number) =>
      `Endpunkt ${Math.min(done + 1, total)} von ${total} …`,
    finished: 'Test abgeschlossen',
    cancelled: 'Test abgebrochen – die bisherigen Ergebnisse bleiben erhalten.',
    failedToStart: 'Das Gerät konnte nicht geladen werden.',
    copy: 'Bericht kopieren (Markdown)',
    copied: 'Kopiert',
    copyFallback: 'Die Zwischenablage ist nicht verfügbar – Text bitte manuell kopieren:',
    reportLabel: 'Bericht als Markdown',
    privacy:
      'Der Bericht enthält keine IDs, Namen oder Antwortwerte und kann bedenkenlos in docs/live-verification.md übernommen werden.',
    betaBadge: 'Beta',
    betaTitle: 'Freigegebene Beta-Ausnahme (App-Installationsstatus)',
    tableLabel: 'Ergebnisse des Verbindungstests',
    columns: {
      endpoint: 'Endpunkt',
      version: 'Version',
      scope: 'Scope',
      result: 'Ergebnis',
      duration: 'Dauer',
      entries: 'Einträge',
      fields: 'Felder (Namen)',
    },
    outcome: {
      ok: 'OK',
      forbidden: 'Verweigert (403)',
      notFound: 'Nicht gefunden (404)',
      badRequest: 'Ungültige Anfrage (400)',
      error: 'Fehler',
      skipped: 'Übersprungen',
    },
    summary: (counts: Record<string, number>) =>
      [
        counts['ok'] ? `${counts['ok']} OK` : null,
        counts['forbidden'] ? `${counts['forbidden']} verweigert` : null,
        counts['notFound'] ? `${counts['notFound']} nicht gefunden` : null,
        counts['badRequest'] ? `${counts['badRequest']} ungültig` : null,
        counts['error'] ? `${counts['error']} Fehler` : null,
        counts['skipped'] ? `${counts['skipped']} übersprungen` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    skip: {
      noUser: 'Das Gerät hat keinen primären Benutzer.',
      noAzureAdId: 'Das Gerät hat keine Entra-Geräte-ID.',
      windowsOnly: 'Nur für Windows-Geräte.',
      noSource: 'Kein Eintrag in der vorherigen Antwort, aus dem sich die Kennung ableiten ließe.',
    },
    report: {
      title: 'Verbindungstest (MDM Doctor)',
      date: 'Datum',
      platform: 'Plattform des Testgeräts',
      platformNote: 'ohne Namen und IDs',
      result: 'Ergebnis',
      partial: 'abgebrochen, unvollständig',
      note: 'Nur Ergebnis, Dauer, Anzahl der Einträge und Feldnamen – keine Werte, IDs oder Namen.',
      betaMark: 'beta (freigegebene Ausnahme)',
      none: '–',
    },
    a11y: {
      running: 'Verbindungstest läuft …',
      done: (summary: string) => `Verbindungstest abgeschlossen: ${summary}`,
    },
  },
  /** Ansicht „Mandant“ (M14/S5) */
  tenantView: {
    title: 'Mandant',
    subtitle: 'Zertifikate und Token, die für alle Geräte gelten',
    back: 'Startseite',
    refresh: 'Aktualisieren',
    a11y: {
      loading: 'Mandanten-Status wird geladen …',
      done: (summary: string) => `Mandanten-Status geladen: ${summary}`,
    },
  },
  toolbar: {
    tenant: 'Mandanten-Status',
    tenantShort: 'Mandant',
    /** Ansicht „Richtlinien“ (M15) – sichtbarer Text = Vorlesename (WCAG 2.5.3) */
    policies: 'Richtlinien und betroffene Geräte',
    policiesShort: 'Richtlinien',
    home: 'MDM Doctor – zur Startseite',
    modeLabel: 'Datenmodus',
    skipToContent: 'Zum Inhalt springen',
  },
  field: {
    label: 'Gerätename, Benutzer oder Seriennummer',
    shortcutHint: 'Zum Suchen ⌘K, Strg+K oder / drücken',
    suggestions: 'Vorschläge',
    clear: 'Eingabe löschen',
    searching: 'Suche läuft …',
  },
  hero: {
    title: 'Intune-Geräte in Sekunden diagnostizieren',
    subtitle: 'Gerätenamen oder Benutzer eingeben – oder ein Beispielgerät laden.',
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
    portalLinks: 'Links ins Intune Admin Center',
    otherDevices: (user: string) => `Weitere Geräte von ${user}`,
    otherDevicesLabel: 'Weitere Geräte des Benutzers',
    openOtherDevice: (name: string, compliance: string) => `${name} öffnen (${compliance})`,
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
    /** Nur angezeigt, wenn die Suche über die Seriennummer getroffen hat */
    serial: (serialNumber: string) => `Seriennummer ${serialNumber}`,
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
      eventLogs: 'Ereignisprotokolle werden ausgewertet …',
      mdmCab: 'MDM-Diagnosepaket wird ausgewertet …',
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
  /** M12/B: Vorher/Nachher, zwei ZIPs vergleichen, Sammelprüfung, Lesezeichen */
  compare: {
    exportButton: 'Stand exportieren',
    exportHint:
      'Lädt die ausgewerteten Kacheln als JSON-Datei herunter (ohne Rohdaten, ohne Benutzer- und Seriennummern).',
    compareButton: 'Mit Stand vergleichen',
    compareHint:
      'Eine zuvor exportierte Stand-Datei wählen und mit dem aktuellen Stand vergleichen.',
    zipButton: 'Mit weiterer ZIP vergleichen',
    zipHint: 'Eine zweite DiagLogs-ZIP wählen – sie wird ebenfalls nur lokal analysiert.',
    zipAnalyzing: (fileName: string) => `${fileName} wird analysiert …`,
    controlsLabel: 'Vergleich',
    fileLocal: 'Die Datei bleibt auf diesem Gerät.',
    errors: {
      tooLarge: 'Die Datei ist zu groß für eine Stand-Datei.',
      notJson: 'Die Datei ist kein gültiges JSON.',
      wrongSchema: 'Das ist keine Stand-Datei von MDM Doctor.',
      wrongVersion: 'Diese Stand-Datei stammt aus einer nicht unterstützten Version.',
      invalid: 'Die Stand-Datei ist unvollständig oder beschädigt.',
      readFailed: 'Die Datei konnte nicht gelesen werden.',
    },
    dialog: {
      title: 'Vergleich',
      close: 'Vergleich schließen',
      before: 'Vorher',
      after: 'Nachher',
      mode: { demo: 'Demo', live: 'Live', zip: 'DiagLogs-ZIP' },
      exportedAt: (date: string) => `Stand vom ${date}`,
      collectedAt: (date: string) => `gesammelt am ${date}`,
      nameMismatch: (before: string, after: string) =>
        `Achtung: Die Gerätenamen stimmen nicht überein („${before}“ und „${after}“). Der Vergleich ist nur sinnvoll, wenn beide Stände zum selben Gerät gehören.`,
      unnamed: 'Ohne Namen',
      summaryLabel: 'Zusammenfassung des Vergleichs',
      worse: (n: number) => (n === 1 ? '1 schlechter' : `${n} schlechter`),
      better: (n: number) => (n === 1 ? '1 besser' : `${n} besser`),
      added: (n: number) => (n === 1 ? '1 neu' : `${n} neu`),
      removed: (n: number) => (n === 1 ? '1 entfallen' : `${n} entfallen`),
      same: (n: number) => (n === 1 ? '1 unverändert' : `${n} unverändert`),
      noChange: 'Keine Unterschiede zwischen den beiden Ständen.',
      tilesTitle: 'Kacheln',
      tilesLabel: 'Kacheln im Vergleich',
      trend: {
        worse: 'Schlechter',
        better: 'Besser',
        added: 'Neu',
        removed: 'Entfallen',
        same: 'Unverändert',
      },
      valueChanged: 'Wert geändert',
      absent: 'nicht vorhanden',
      transition: (from: string, to: string) => `von ${from} zu ${to}`,
      newFindings: 'Neue Befunde',
      resolvedFindings: 'Behobene Befunde',
      noNewFindings: 'Keine neuen Befunde.',
      noResolvedFindings: 'Keine Befunde behoben.',
    },
  },
  bulk: {
    openButton: 'Mehrere Geräte prüfen',
    openHint:
      'Viele Gerätenamen oder Seriennummern auf einmal nachschlagen (Compliance, letzter Check-in).',
    title: 'Mehrere Geräte prüfen',
    subtitle:
      'Pro Name wird genau eine Suche ausgeführt (höchstens zwei gleichzeitig). Vollständig geprüft wird erst beim Öffnen eines Geräts.',
    back: 'Zurück',
    inputLabel: 'Gerätenamen oder Seriennummern (einer pro Zeile)',
    inputPlaceholder: 'CONTOSO-PC001\nCONTOSO-PC042\nCONTOSO-LT108',
    fileButton: 'CSV/TXT wählen',
    fileLabel: 'CSV- oder TXT-Datei mit Gerätenamen oder Seriennummern',
    fileLocal: 'Die Datei wird nur lokal gelesen.',
    fileTooLarge: 'Die Datei ist zu groß.',
    fileReadFailed: 'Die Datei konnte nicht gelesen werden.',
    namesCount: (n: number) => (n === 1 ? '1 Name erkannt' : `${n} Namen erkannt`),
    overLimit: (max: number, ignored: number) =>
      `Es werden höchstens ${max} Namen geprüft – ${ignored} weitere ${ignored === 1 ? 'wird' : 'werden'} ignoriert.`,
    start: 'Prüfen',
    cancel: 'Abbrechen',
    clear: 'Neue Liste',
    exportCsv: 'Als CSV exportieren',
    exportCsvHint: 'Lädt die Tabelle als CSV-Datei herunter (nur lokal).',
    progress: (done: number, total: number) => `${done} von ${total} geprüft`,
    finished: (total: number) => `Prüfung abgeschlossen: ${total} Namen.`,
    cancelled: 'Prüfung abgebrochen.',
    throttled: (seconds: number) =>
      `Microsoft Graph drosselt die Anfragen – weiter in ${seconds} s.`,
    tableLabel: 'Ergebnis der Sammelprüfung',
    columns: {
      name: 'Name',
      matches: 'Treffer',
      platform: 'Plattform',
      compliance: 'Compliance',
      lastSync: 'Letzter Check-in',
      user: 'Benutzer',
    },
    match: {
      pending: 'Wartet',
      running: 'Wird geprüft …',
      none: 'Kein Treffer',
      one: 'Gefunden',
      manyShort: 'Mehrere Treffer',
      many: (n: number) => `${n} Treffer`,
      error: 'Fehler',
      cancelled: 'Abgebrochen',
    },
    openDevice: (name: string) => `${name} öffnen`,
    searchName: (name: string) => `Nach „${name}“ suchen (mehrere Treffer)`,
    noValue: '–',
    csv: {
      header: [
        'Name',
        'Treffer',
        'Gerät',
        'Plattform',
        'Compliance',
        'Letzter Check-in',
        'Bewertung',
        'Benutzer',
      ],
      fileName: (stamp: string) => `mdm-doctor-sammelpruefung-${stamp}.csv`,
    },
  },
  bookmarklet: {
    openButton: 'Lesezeichen für das Intune Admin Center',
    openHint: 'Ein Lesezeichen, das das geöffnete Gerät aus dem Admin Center in MDM Doctor öffnet.',
    title: 'Lesezeichen „In MDM Doctor öffnen“',
    close: 'Lesezeichen-Hinweise schließen',
    intro:
      'Mit diesem Lesezeichen öffnest du ein Gerät, das du im Microsoft Intune Admin Center ansiehst, mit einem Klick in MDM Doctor (Live-Modus).',
    linkLabel: 'In MDM Doctor öffnen',
    linkHint: 'Diesen Link in die Lesezeichenleiste ziehen – nicht anklicken.',
    stepsTitle: 'So geht’s',
    steps: [
      'Lesezeichenleiste des Browsers einblenden (Strg+Umschalt+B bzw. ⌘+Umschalt+B).',
      'Den Link oben mit der Maus in die Leiste ziehen.',
      'Im Intune Admin Center ein Gerät öffnen und das Lesezeichen anklicken – MDM Doctor öffnet sich in einem neuen Tab.',
    ],
    privacy:
      'Das Lesezeichen liest ausschließlich die Adresse der aktuellen Seite (location.href), um die Geräte-ID zu finden. Es greift nicht auf Inhalte der Seite zu und sendet nichts.',
    noDeviceMessage:
      'Keine Geräte-ID gefunden. Bitte zuerst im Intune Admin Center ein Gerät öffnen.',
    noDragTitle: 'Ziehen funktioniert nicht?',
    noDragBody: 'Neues Lesezeichen anlegen und den folgenden Code als Adresse (URL) eintragen.',
    codeLabel: 'Code des Lesezeichens',
    copy: 'Code kopieren',
    copied: 'Kopiert',
    appUrl: (url: string) => `Ziel: ${url}`,
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
      'CONTOSO-IP015': 'iPhone · nicht beaufsichtigt',
      'CONTOSO-AND21': 'Android · alter Patch',
      'CONTOSO-PC050': 'Fehlende Berechtigung',
    },
  },
  /** M9/B: Bedienkomfort – zuletzt geöffnete Geräte, Tastaturkürzel, Drucken */
  comfort: {
    recentTitle: 'Zuletzt geöffnet',
    recentList: 'Zuletzt geöffnete Geräte',
    recentOpen: (deviceName: string) => `${deviceName} erneut öffnen`,
    recentClear: 'Verlauf löschen',
    recentLocalOnly: 'Nur in diesem Browser gespeichert',
    shortcutApple: '⌘K',
    shortcutOther: 'Strg K',
    printButton: 'Drucken / PDF',
    printHint: 'Notiz drucken oder über den Druckdialog als PDF speichern.',
    printDialogBody:
      'Die Notiz wird beim Drucken ohne den Rest der Seite ausgegeben. Zum Speichern als PDF im Druckdialog „Als PDF speichern“ wählen.',
    printDocumentLabel: 'Druckansicht der Ticket-Notiz',
  },
} as const;
