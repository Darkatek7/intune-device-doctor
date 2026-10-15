/**
 * Alle UI-Texte zentral (Deutsch). Komponenten verwenden ausschließlich diese Konstanten,
 * damit eine spätere Übersetzung nur diese Datei betrifft. Wird in M1–M6 erweitert.
 */
export const de = {
  app: {
    name: 'MDM Doctor',
    tagline: 'Intune-Geräte in Sekunden diagnostizieren',
  },
  mode: {
    demo: 'Demo',
    live: 'Live',
    liveNotConfigured: 'Live-Modus nicht konfiguriert – Client-ID und Tenant-ID in .env.local setzen.',
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
    defender: 'Microsoft Defender',
    policies: 'Richtlinien',
    entraJoin: 'Entra-Join & PRT',
    win32Apps: 'Win32-Apps',
    enrollment: 'Enrollment',
    diagCollection: 'Diagnose-Sammlung',
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
  },
} as const;
