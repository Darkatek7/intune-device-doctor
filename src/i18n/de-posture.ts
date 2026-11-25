/**
 * Texte für M21: Ansicht „Empfehlungen“ – Abgleich der Mandanten-Konfiguration mit den auf Microsoft
 * Learn dokumentierten Empfehlungen. Eingebunden in de.ts als `de.posture`; alle Texte deutsch.
 *
 * - Sollwerte und Wegbeschreibungen stammen ausschließlich aus den Learn-Seiten im Block „M21“ von
 *   `src/rules/knowledge/docs.ts`. Die Spalte „Empfehlung“ übersetzt den Learn-Wert, sie interpretiert
 *   ihn nicht.
 * - Bewertung: „weicht von der Empfehlung ab“ – nie „falsch“ oder „unsicher“. Microsoft nennt die Werte
 *   selbst einen Ausgangspunkt.
 * - Microsoft-Originaltexte (Secure Score, Einstellungsnamen aus Baselines) werden nie übersetzt.
 */
import type { PostureLevel } from '../domain/posture';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const policies = (n: number) => `${n} ${plural(n, 'Richtlinie', 'Richtlinien')}`;
const settingsCount = (n: number) => `${n} ${plural(n, 'Einstellung', 'Einstellungen')}`;

/** Bezeichnung und Learn-Sollwert (übersetzt) einer Katalogprüfung. */
interface CheckText {
  label: string;
  expected: string;
}

const REQUIRED = 'Erforderlich';
const BLOCK = 'Blockieren';

export const dePosture = {
  /** Abschnitte der Ansicht „Empfehlungen“ */
  sections: {
    basics: 'Grundlagen',
    compliance: 'Compliance-Richtlinien',
    appProtection: 'App-Schutz',
    endpoint: 'Baselines und Endpunktsicherheit (Beta)',
    secureScore: 'Microsoft Secure Score',
  },

  /** Einleitung der Ansicht (UI) */
  intro:
    'Vergleich der Konfiguration mit den auf Microsoft Learn dokumentierten Empfehlungen. Microsoft nennt diese Werte selbst einen Ausgangspunkt – eine Abweichung kann bewusst entschieden sein.',

  /** Ansicht „Empfehlungen“ (S4): Kopf, Gesamtbild, Stufenwahl */
  view: {
    title: 'Empfehlungen',
    subtitle: 'Abgleich mit den von Microsoft dokumentierten Empfehlungen',
    back: 'Startseite',
    refresh: 'Aktualisieren',
    note: 'Die Werte sind laut Microsoft ein Ausgangspunkt – eine Abweichung kann bewusst entschieden sein. Die App liest nur und ändert nichts.',
    a11y: {
      loading: 'Empfehlungen werden geladen …',
      done: (summary: string) => `Empfehlungen geladen: ${summary}`,
    },
    overall: {
      title: 'Gesamtbild',
      headline: (met: number, total: number) =>
        `${met} von ${total} ${total === 1 ? 'Empfehlung' : 'Empfehlungen'} erfüllt`,
      empty: 'Keine prüfbaren Empfehlungen vorhanden.',
      barLabel: (met: number, deviating: number, notChecked: number, total: number) =>
        `Anteil der Empfehlungen: ${met} von ${total} erfüllt, ${deviating} weichen ab, ${notChecked} nicht prüfbar`,
      legend: 'Legende des Gesamtbilds',
      met: 'Erfüllt',
      deviating: 'Weicht ab',
      notChecked: 'Nicht prüfbar',
    },
    level: {
      label: 'Stufe der Empfehlungen',
      hint: 'Die Stufe betrifft nur Frameworks mit Stufen: Compliance für iOS und Android sowie App-Schutz. Die übrigen Prüfungen sind stufenunabhängig.',
      options: {
        1: 'Basis',
        2: 'Erweitert',
        3: 'Hoch',
      } satisfies Record<PostureLevel, string>,
    },
  },

  levels: {
    1: 'Stufe 1 (Basis)',
    2: 'Stufe 2 (erweitert)',
    3: 'Stufe 3 (hoch)',
  } satisfies Record<PostureLevel, string>,
  levelShort: (level: PostureLevel | null) => (level === null ? 'Ohne Stufe' : `Stufe ${level}`),

  /** Gemeinsame Bausteine der Kacheln */
  common: {
    valueMet: (met: number, total: number) => `${met} von ${total} erfüllt`,
    valueLevel: (level: PostureLevel) => `Stufe ${level} erreicht`,
    valueNotUsed: 'Nicht genutzt',
    valueNotChecked: 'Nicht prüfbar',
    valueNoPolicy: 'Keine Richtlinie',
    valueNoTarget: 'Kein Sollwert',
    summaryCounts: (met: number, deviating: number, notChecked: number) =>
      [
        `${met} erfüllt`,
        deviating > 0 ? `${deviating} ${plural(deviating, 'weicht', 'weichen')} ab` : null,
        notChecked > 0 ? `${notChecked} nicht prüfbar` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    summaryNotUsed: 'Keine Geräte und keine Richtlinie für diese Plattform.',
    beta: 'Beta-API',
    betaFact: 'Datenquelle',
    betaValue: 'Microsoft Graph Beta-API (freigegebene Ausnahme)',
    columns: {
      setting: 'Einstellung',
      actual: 'Ist',
      expected: 'Empfehlung',
      levelStatus: 'Stufe/Status',
      level: 'Stufe',
      reason: 'Grund',
    },
    statusDeviating: 'weicht ab',
    statusNotChecked: 'nicht prüfbar',
    statusMet: 'erfüllt',
    levelStatus: (levelText: string, status: string) => `${levelText} · ${status}`,
    unassignedSuffix: ' (nicht zugewiesen)',
    assignmentUnknownSuffix: ' (Zuweisung unbekannt)',
    starting:
      'Microsoft nennt diese Werte einen Ausgangspunkt. Eine Abweichung kann bewusst entschieden sein – dann genügt es, sie zu dokumentieren.',
    facts: {
      level: 'Bewertete Stufe',
      levelRaised: (selected: PostureLevel, used: PostureLevel) =>
        `Stufe ${used} (Microsoft bietet hier keine Stufe ${selected} an – Stufe ${used} ist das empfohlene Minimum)`,
      policies: 'Richtlinien',
      truncated: 'Vollständigkeit',
      truncatedValue: 'Nicht alle Richtlinien gelesen (Seitengrenze)',
    },
    policyFact: (name: string) => `Richtlinie „${name}“`,
    policyFactValue: (met: number, total: number, levelText: string | null) =>
      [`${met} von ${total} erfüllt`, levelText].filter(Boolean).join(' · '),
    reachedLevel: (level: PostureLevel | null) =>
      level === null ? 'keine Stufe vollständig erreicht' : `Stufe ${level} erreicht`,
    notDelivered: 'Wert nicht geliefert',
    notDeliveredReason:
      'Microsoft Graph hat die Einstellung für diese Richtlinie nicht geliefert – sie kann nicht bewertet werden.',
    unknownFormat: (raw: string) => `Unbekanntes Format: ${raw}`,
    truncatedTitle: 'Nicht alle Richtlinien gelesen',
    truncatedDetail:
      'Die Liste hat mehr Einträge, als die App liest. Fehlende Richtlinien werden nicht bewertet; eine „fehlende“ Richtlinie kann deshalb trotzdem existieren.',
    truncatedCause: 'Seitengrenze der App (Schutz vor sehr langen Ladezeiten).',
    truncatedRemediation: ['Die vollständige Liste im Intune Admin Center prüfen.'],
    noPolicyInList:
      'Nicht alle Richtlinien wurden gelesen – ob eine passende Richtlinie existiert, ist nicht sicher.',
  },

  /** Darstellung von Ist-Werten */
  values: {
    yes: 'Ja',
    no: 'Nein',
    notConfigured: 'Nicht konfiguriert',
    set: (value: string) => `Gesetzt (${value})`,
    notSet: 'Nicht gesetzt',
    minutes: (n: number) => `${n} ${plural(n, 'Minute', 'Minuten')}`,
    hours: (n: number) => `${n} ${plural(n, 'Stunde', 'Stunden')}`,
    days: (n: number) => `${n} ${plural(n, 'Tag', 'Tage')}`,
    characters: (n: number) => `${n} ${plural(n, 'Zeichen', 'Zeichen')}`,
    count: (n: number) => String(n),
    immediately: 'Sofort',
    afterHours: (n: number) => `Nach ${n} ${plural(n, 'Stunde', 'Stunden')}`,
    noBlockAction:
      'Keine Aktion vom Typ „block“ geliefert – die Zuordnung zu „Gerät als nicht konform markieren“ ist dann nicht sicher.',
    actionsNotRead: 'Aktionen bei Nichtkonformität nicht gelesen',
    join: (parts: string[]) => parts.join(' · '),
    /** Enum-Werte laut Graph → deutsch (unbekannte Werte bleiben roh) */
    enums: {
      requiredPasswordType: {
        deviceDefault: 'Gerätestandard',
        alphanumeric: 'Alphanumerisch',
        numeric: 'Numerisch',
      } as Record<string, string>,
      androidRequiredPasswordType: {
        deviceDefault: 'Gerätestandard',
        alphabetic: 'Mindestens alphabetisch',
        alphanumeric: 'Mindestens alphanumerisch',
        alphanumericWithSymbols: 'Mindestens alphanumerisch mit Symbolen',
        lowSecurityBiometric: 'Biometrie mit niedriger Sicherheit',
        numeric: 'Mindestens numerisch',
        numericComplex: 'Numerisch komplex',
        any: 'Beliebig',
      } as Record<string, string>,
      deviceThreatProtectionLevel: {
        unavailable: 'Nicht verfügbar',
        secured: 'Geschützt',
        low: 'Niedrig',
        medium: 'Mittel',
        high: 'Hoch',
        notSet: 'Nicht festgelegt',
      } as Record<string, string>,
      managedAppDataTransferLevel: {
        allApps: 'Alle Apps',
        managedApps: 'Durch Richtlinie verwaltete Apps',
        none: 'Keine',
      } as Record<string, string>,
      managedAppClipboardSharingLevel: {
        allApps: 'Beliebige App',
        managedAppsWithPasteIn: 'Verwaltete Apps mit Einfügen',
        managedApps: 'Durch Richtlinie verwaltete Apps',
        blocked: 'Blockiert',
      } as Record<string, string>,
      managedBrowserType: {
        notConfigured: 'Nicht konfiguriert',
        microsoftEdge: 'Microsoft Edge',
      } as Record<string, string>,
    },
  },

  /**
   * Katalog: Bezeichnung und Learn-Sollwert je Prüfung. Die Bezeichnungen folgen den Einstellungsnamen
   * im Intune Admin Center; der Sollwert ist der Wert der Learn-Tabelle (übersetzt).
   */
  catalog: {
    // Windows 10 und neuer – Zero Trust, „Recommended compliance settings for Windows 10 and later“
    winBitLocker: { label: 'BitLocker erforderlich (Integritätsnachweis)', expected: REQUIRED },
    winSecureBoot: { label: 'Sicherer Start muss aktiviert sein', expected: REQUIRED },
    winCodeIntegrity: { label: 'Codeintegrität erforderlich', expected: REQUIRED },
    winPasswordRequired: { label: 'Kennwort zum Entsperren erforderlich', expected: REQUIRED },
    winPasswordBlockSimple: { label: 'Einfache Kennwörter', expected: BLOCK },
    winPasswordMinLength: { label: 'Minimale Kennwortlänge', expected: '6 Zeichen oder mehr' },
    winPasswordInactivity: {
      label: 'Maximale Inaktivität, bevor ein Kennwort nötig ist',
      expected: 'Höchstens 15 Minuten',
    },
    winPasswordExpiration: {
      label: 'Kennwortablauf (Tage)',
      expected: 'Höchstens 41 Tage',
    },
    winPasswordReuse: {
      label: 'Anzahl vorheriger Kennwörter, die nicht wiederverwendet werden dürfen',
      expected: '5 oder mehr',
    },
    winPasswordIdle: {
      label: 'Kennwort nach Leerlauf erforderlich (Mobile und Holographic)',
      expected: REQUIRED,
    },
    winEncryption: { label: 'Verschlüsselung des Datenspeichers', expected: REQUIRED },

    // iOS/iPadOS – Compliance-Sicherheitskonfiguration Stufe 2/3
    iosJailbreak: { label: 'Geräte mit Jailbreak', expected: BLOCK },
    iosOsMinimum: {
      label: 'Minimale Betriebssystemversion',
      expected: 'Gesetzt (Microsoft: unterstützte Hauptversion, N-1)',
    },
    iosPasscodeRequired: { label: 'Kennwort zum Entsperren erforderlich', expected: REQUIRED },
    iosPasscodeBlockSimple: { label: 'Einfache Kennwörter', expected: BLOCK },
    iosPasscodeMinLength: { label: 'Minimale Kennwortlänge', expected: '6 Zeichen oder mehr' },
    iosPasscodeType: {
      label: 'Erforderlicher Kennworttyp',
      expected: 'Numerisch (oder strenger: alphanumerisch)',
    },
    iosPasscodeAfterLock: {
      label: 'Maximale Minuten nach Bildschirmsperre, bis ein Kennwort nötig ist',
      expected: 'Höchstens 5 Minuten',
    },
    iosMarkNoncompliant: {
      label: 'Gerät als nicht konform markieren',
      expected: 'Sofort',
    },
    iosThreatLevel: {
      label: 'Gerät höchstens auf Bedrohungsstufe (Mobile Threat Defense)',
      expected: 'Geschützt',
    },
    iosPasscodeExpiration: { label: 'Kennwortablauf (Tage)', expected: 'Höchstens 365 Tage' },

    // Android Enterprise, persönliches Gerät mit Arbeitsprofil – Stufe 2/3
    awpRooted: { label: 'Gerootete Geräte', expected: BLOCK },
    awpPlayServices: { label: 'Google Play-Dienste konfiguriert', expected: REQUIRED },
    awpSecurityProvider: { label: 'Aktueller Sicherheitsanbieter', expected: REQUIRED },
    awpBasicIntegrity: {
      label: 'Play Integrity: grundlegende Integrität',
      expected: REQUIRED,
    },
    awpDeviceIntegrity: {
      label: 'Play Integrity: Geräteintegrität',
      expected: REQUIRED,
    },
    awpOsMinimum: {
      label: 'Minimale Betriebssystemversion',
      expected: 'Gesetzt (Microsoft: von Microsoft-Apps unterstützte Version)',
    },
    awpEncryption: { label: 'Verschlüsselung des Datenspeichers', expected: REQUIRED },
    awpUnknownSources: { label: 'Apps aus unbekannten Quellen', expected: BLOCK },
    awpCompanyPortalIntegrity: {
      label: 'Laufzeitintegrität der Unternehmensportal-App',
      expected: REQUIRED,
    },
    awpUsbDebugging: { label: 'USB-Debugging auf dem Gerät', expected: BLOCK },
    awpPasswordRequired: { label: 'Kennwort zum Entsperren erforderlich', expected: REQUIRED },
    awpPasswordType: {
      label: 'Erforderlicher Kennworttyp',
      expected: 'Numerisch komplex (oder strenger)',
    },
    awpPasswordMinLength: { label: 'Minimale Kennwortlänge', expected: '6 Zeichen oder mehr' },
    awpPasswordInactivity: {
      label: 'Maximale Inaktivität, bevor ein Kennwort nötig ist',
      expected: 'Höchstens 5 Minuten',
    },
    awpMarkNoncompliant: { label: 'Gerät als nicht konform markieren', expected: 'Sofort' },
    awpThreatLevel: {
      label: 'Gerät höchstens auf Bedrohungsstufe (Mobile Threat Defense)',
      expected: 'Geschützt',
    },
    awpPasswordExpiration: {
      label: 'Tage bis zum Kennwortablauf',
      expected: 'Höchstens 365 Tage',
    },
    awpPasswordReuse: {
      label: 'Anzahl vorheriger Kennwörter, die nicht wiederverwendet werden dürfen',
      expected: '5 oder mehr',
    },

    // App-Schutz – Data Protection Framework (iOS/iPadOS und Android)
    appPinRequired: { label: 'PIN für den Zugriff', expected: REQUIRED },
    appPinMinLength4: { label: 'Minimale PIN-Länge', expected: '4 oder mehr' },
    appPinWhenDevicePin: {
      label: 'App-PIN, wenn eine Geräte-PIN festgelegt ist',
      expected: REQUIRED,
    },
    appRecheckAccess: {
      label: 'Zugriffsanforderungen erneut prüfen nach (Minuten Inaktivität)',
      expected: 'Höchstens 30 Minuten',
    },
    appMaxPinRetries: { label: 'Maximale PIN-Versuche', expected: 'Höchstens 5' },
    appOfflineBlock: {
      label: 'Offline-Toleranzzeitraum, bis der Zugriff blockiert wird',
      expected: 'Höchstens 10080 Minuten (7 Tage)',
    },
    appOfflineWipe90: {
      label: 'Offline-Toleranzzeitraum, bis Daten gelöscht werden',
      expected: 'Höchstens 90 Tage',
    },
    appEncryptData: { label: 'Organisationsdaten verschlüsseln', expected: REQUIRED },
    appEncryptEnrolled: {
      label: 'Organisationsdaten auf registrierten Geräten verschlüsseln',
      expected: REQUIRED,
    },
    appBackupBlocked: { label: 'Sicherung von Organisationsdaten', expected: BLOCK },
    appSendOrgData: {
      label: 'Organisationsdaten an andere Apps senden',
      expected: 'Durch Richtlinie verwaltete Apps (oder strenger)',
    },
    appSaveAsBlocked: { label: 'Kopien von Organisationsdaten speichern', expected: BLOCK },
    appClipboard: {
      label: 'Ausschneiden, Kopieren und Einfügen zwischen Apps',
      expected: 'Verwaltete Apps mit Einfügen (oder strenger)',
    },
    appWebContentEdge: {
      label: 'Übertragung von Webinhalten an andere Apps',
      expected: 'Microsoft Edge',
    },
    appOfflineWipe30: {
      label: 'Offline-Toleranzzeitraum, bis Daten gelöscht werden',
      expected: 'Höchstens 30 Tage',
    },
    appMinOs: {
      label: 'Minimale Betriebssystemversion (Zugriff blockieren)',
      expected: 'Gesetzt (Microsoft: von Microsoft-Apps unterstützte Version)',
    },
    appScreenCapture: { label: 'Bildschirmaufnahme und Google Assistant', expected: BLOCK },
    appMinPatch: {
      label: 'Minimale Patchversion (Zugriff blockieren)',
      expected: 'Gesetzt',
    },
    appReceiveOrgData: {
      label: 'Daten aus anderen Apps empfangen',
      expected: 'Durch Richtlinie verwaltete Apps (oder strenger)',
    },
    appPrintBlocked: { label: 'Organisationsdaten drucken', expected: BLOCK },
    appSimplePinBlocked: { label: 'Einfache PIN', expected: BLOCK },
    appPinMinLength6: { label: 'Minimale PIN-Länge', expected: '6 oder mehr' },
    appPinReset365: {
      label: 'PIN-Zurücksetzung nach Anzahl Tagen',
      expected: 'Ja, höchstens 365 Tage',
    },
  } satisfies Record<string, CheckText>,

  /** Learn-Sollwerte, für die es keine v1.0-Eigenschaft gibt (bzw. keine dokumentierte Zuordnung). */
  uncheckable: {
    winFirewall: { label: 'Firewall', expected: REQUIRED },
    winAntivirus: { label: 'Antivirus', expected: REQUIRED },
    winAntispyware: { label: 'Antispyware', expected: REQUIRED },
    winDefender: { label: 'Microsoft Defender Antischadsoftware', expected: REQUIRED },
    winDefenderVersion: {
      label: 'Mindestversion von Microsoft Defender Antischadsoftware',
      expected: 'Höchstens fünf Versionen hinter der aktuellen',
    },
    winSignatures: {
      label: 'Signaturen von Microsoft Defender Antischadsoftware aktuell',
      expected: REQUIRED,
    },
    winRealTime: { label: 'Echtzeitschutz', expected: REQUIRED },
    winMdeRisk: {
      label: 'Gerät höchstens auf Computerrisikobewertung (Defender for Endpoint)',
      expected: 'Mittel',
    },
    iosScreenLock: {
      label: 'Maximale Minuten Inaktivität bis zur Bildschirmsperre',
      expected: 'Höchstens 5 Minuten',
    },
    iosMdeRisk: {
      label: 'Gerät höchstens auf Computerrisikobewertung (Defender for Endpoint)',
      expected: 'Frei',
    },
    awpStrongIntegrity: {
      label: 'Starke Integrität mit hardwaregestützten Sicherheitsfunktionen',
      expected: 'Starke Integrität prüfen',
    },
    awpMdeRisk: {
      label: 'Gerät höchstens auf Computerrisikobewertung (Defender for Endpoint)',
      expected: 'Frei',
    },
    appEncryptIos: { label: 'Organisationsdaten verschlüsseln (iOS/iPadOS)', expected: REQUIRED },
    appOverrideBiometrics: {
      label:
        'Biometrie nach Zeitüberschreitung durch PIN ersetzen (Zeitüberschreitung 1440 Minuten)',
      expected: REQUIRED,
    },
    appJailbreakBlock: { label: 'Geräte mit Jailbreak/Rooting', expected: 'Zugriff blockieren' },
    appPlayIntegrity: {
      label: 'Gerätenachweis (Play Integrity)',
      expected: 'Grundlegende Integrität und zertifizierte Geräte / Zugriff blockieren',
    },
    appThreatScan: { label: 'Bedrohungsscan für Apps', expected: 'Zugriff blockieren' },
    appDeviceLockLow: { label: 'Gerätesperre erforderlich', expected: 'Niedrig / Warnen' },
    appOrgDataNotifications: {
      label: 'Benachrichtigungen mit Organisationsdaten',
      expected: 'Organisationsdaten blockieren',
    },
    appDisabledAccount: { label: 'Deaktiviertes Konto', expected: 'Zugriff blockieren' },
    appHardwareAttestation: {
      label: 'Erforderlicher Auswertungstyp (Play Integrity)',
      expected: 'Hardwaregestützter Schlüssel',
    },
    appDeviceLockMedium: {
      label: 'Gerätesperre erforderlich',
      expected: 'Mittel / Zugriff blockieren',
    },
    appSamsungKnox: {
      label: 'Samsung Knox-Gerätenachweis',
      expected: 'Zugriff blockieren',
    },
    appOpenIntoOrgDocs: {
      label: 'Daten in Organisationsdokumenten öffnen',
      expected: BLOCK,
    },
    appThirdPartyKeyboards: { label: 'Tastaturen von Drittanbietern', expected: BLOCK },
    appApprovedKeyboards: { label: 'Genehmigte Tastaturen', expected: REQUIRED },
    appClass3Biometrics: { label: 'Biometrie der Klasse 3 (Android 9.0+)', expected: REQUIRED },
    appOverrideBiometricsUpdates: {
      label: 'Biometrie nach biometrischen Updates durch PIN ersetzen',
      expected: REQUIRED,
    },
    appDeviceLockHigh: {
      label: 'Gerätesperre erforderlich',
      expected: 'Hoch / Zugriff blockieren',
    },
    appJailbreakWipe: { label: 'Geräte mit Jailbreak/Rooting', expected: 'Daten löschen' },
    appMaxThreatLevel: {
      label: 'Maximal zulässige Bedrohungsstufe',
      expected: 'Geschützt / Zugriff blockieren',
    },
    appMaxOs: {
      label: 'Maximale Betriebssystemversion',
      expected: 'Gesetzt / Zugriff blockieren',
    },
    appSamsungKnoxWipe: { label: 'Samsung Knox-Gerätenachweis', expected: 'Daten löschen' },
    appDialerAndroid: {
      label: 'Telekommunikationsdaten übertragen an',
      expected: 'Beliebige durch Richtlinie verwaltete Wähl-App',
    },
    appDialerIos: {
      label: 'Telekommunikationsdaten übertragen an',
      expected: 'Eine bestimmte Wähl-App',
    },
  } satisfies Record<string, CheckText>,
  uncheckableReason: {
    noV1Property: 'Keine Eigenschaft in der v1.0-API',
    noMapping: 'Zuordnung zur v1.0-Eigenschaft nicht dokumentiert',
  },
  uncheckableTitle: (n: number) =>
    `${n} ${plural(n, 'Empfehlung ist', 'Empfehlungen sind')} über die dokumentierte API nicht prüfbar`,
  uncheckableDetail:
    'Microsoft nennt für diese Einstellungen einen Sollwert, die dokumentierte Graph-API (v1.0) liefert den Wert aber nicht. Die App rät nicht – bitte im Intune Admin Center selbst prüfen.',
  uncheckableCause: 'Einstellung nur in der Beta-API oder ohne dokumentierte Zuordnung.',

  // ---------- Kacheln ----------

  tenantSettings: {
    secureByDefault: 'Geräte ohne zugewiesene Compliance-Richtlinie markieren als',
    secureByDefaultExpected: 'Nicht konform (wenn Bedingter Zugriff Konformität verlangt)',
    compliant: 'Konform',
    notCompliant: 'Nicht konform',
    validity: 'Gültigkeitszeitraum des Compliance-Status',
    validityValue: (days: number) => `${days} ${plural(days, 'Tag', 'Tage')}`,
    criticalTitle: 'Geräte ohne Compliance-Richtlinie gelten als konform',
    criticalDetail:
      'Mindestens eine aktive Richtlinie für Bedingten Zugriff verlangt ein konformes Gerät. Geräte, denen keine Compliance-Richtlinie zugewiesen ist, gelten in diesem Mandanten aber als „konform“ und erhalten dadurch Zugriff. Microsoft empfiehlt für diesen Fall „Nicht konform“.',
    reportOnlyTitle: 'Geräte ohne Compliance-Richtlinie gelten als konform',
    reportOnlyDetail:
      'Eine Richtlinie für Bedingten Zugriff verlangt ein konformes Gerät, läuft aber nur im Berichtsmodus. Sobald sie aktiviert wird, erhielten Geräte ohne Compliance-Richtlinie Zugriff. Microsoft empfiehlt dafür „Nicht konform“.',
    cause:
      'Die Mandanteneinstellung „Geräte ohne zugewiesene Compliance-Richtlinie markieren als“ steht auf „Konform“ (Standardwert).',
    remediation: [
      'Im Intune Admin Center unter Endpunktsicherheit › Gerätekonformität › Compliance-Richtlinieneinstellungen den Wert „Geräte ohne zugewiesene Compliance-Richtlinie markieren als“ prüfen.',
      'Vor einer Änderung sicherstellen, dass jede genutzte Plattform eine zugewiesene Compliance-Richtlinie hat (Kachel „Abdeckung der Plattformen“) – sonst verlieren Geräte den Zugriff.',
    ],
    notUsedTitle: 'Empfehlung gilt nur mit Bedingtem Zugriff',
    notUsedDetail:
      'Microsoft empfiehlt „Nicht konform“, wenn Bedingter Zugriff Konformität verlangt. Derzeit verlangt keine gelesene Richtlinie für Bedingten Zugriff ein konformes Gerät – die Empfehlung wird deshalb nicht bewertet.',
    notUsedCause: 'Keine Richtlinie für Bedingten Zugriff mit „Gerät als konform markiert“.',
    notUsedRemediation: [
      'Wird Bedingter Zugriff mit Konformität eingeführt, diese Einstellung vorher auf „Nicht konform“ stellen.',
    ],
    caUnknownReason:
      'Ob Bedingter Zugriff ein konformes Gerät verlangt, ist nicht lesbar – die Empfehlung hängt davon ab.',
    validityTitle: 'Gültigkeitszeitraum: Microsoft dokumentiert keinen Sollwert',
    validityDetail: (days: number | null) =>
      `${days === null ? 'Der Wert wurde nicht geliefert.' : `Eingestellt sind ${days} Tage.`} Microsoft nennt als Standard 30 Tage (möglich sind 1 bis 120 Tage), aber keinen Sollwert. Meldet ein Gerät innerhalb dieses Zeitraums keinen Compliance-Status, gilt es als nicht konform.`,
    validityCause: 'Kein dokumentierter Sollwert – reine Information.',
    validityRemediation: [
      'Den Wert bei Bedarf unter Endpunktsicherheit › Gerätekonformität › Compliance-Richtlinieneinstellungen anpassen.',
    ],
    valueOk: 'Empfehlung erfüllt',
    valueNotEvaluated: 'Nicht anwendbar',
    summaryOk: 'Geräte ohne Richtlinie gelten als nicht konform.',
    summaryDeviating: 'Geräte ohne Richtlinie gelten als konform.',
    summaryNotEvaluated: 'Empfehlung gilt nur zusammen mit Bedingtem Zugriff.',
  },

  coverage: {
    platforms: {
      windows: 'Windows',
      ios: 'iOS/iPadOS',
      android: 'Android',
      macos: 'macOS',
    },
    checkLabel: (platform: string) => `${platform}: zugewiesene Compliance-Richtlinie`,
    expected: 'Mindestens eine zugewiesene Richtlinie',
    actualAssigned: (n: number) => `${policies(n)} zugewiesen`,
    actualUnassigned: (n: number) => `${policies(n)}, keine zugewiesen`,
    actualNone: 'Keine Richtlinie',
    actualUnknown: (n: number) => `${policies(n)}, Zuweisung unbekannt`,
    countUnknownReason: 'Die Anzahl der Geräte dieser Plattform wurde nicht geliefert.',
    assignmentUnknownReason: 'Die Zuweisungen der Richtlinien konnten nicht gelesen werden.',
    deviceFact: (platform: string) => `${platform}: Geräte`,
    deviceFactValue: (devices: number | null, policyCount: number) =>
      `${devices === null ? 'unbekannt' : devices} · ${policies(policyCount)}`,
    notUsedFact: 'nicht genutzt',
    missingTitle: (platform: string, devices: number) =>
      `${platform}: ${devices} ${plural(devices, 'Gerät', 'Geräte')} ohne zugewiesene Compliance-Richtlinie`,
    missingDetail:
      'Für diese Plattform gibt es verwaltete Geräte, aber keine zugewiesene Compliance-Richtlinie. Microsoft nennt das ausdrücklich als Risiko: Ohne Compliance-Richtlinie fehlen Prüfungen wie Kennwort, Verschlüsselung und Betriebssystemversion, und nicht konforme Geräte fallen nicht auf.',
    missingCause:
      'Keine Richtlinie für die Plattform angelegt, oder die vorhandene Richtlinie ist keiner Gruppe zugewiesen.',
    missingRemediation: [
      'Im Intune Admin Center unter Geräte › Compliance die Richtlinien der Plattform prüfen und ihre Zuweisungen kontrollieren.',
      'Die Kachel „Compliance“ der Plattform zeigt, wie vorhandene Richtlinien von der Empfehlung abweichen.',
    ],
    windowsNote: 'Für Windows zählen nur Richtlinien vom Typ „Windows 10 und neuer“.',
    value: (covered: number, used: number) => `${covered} von ${used} Plattformen abgedeckt`,
    summary: (used: number) =>
      used === 0
        ? 'Keine Plattform mit verwalteten Geräten gemeldet.'
        : `${used} ${plural(used, 'Plattform', 'Plattformen')} mit verwalteten Geräten`,
  },

  access: {
    compliantLabel: 'Aktive Richtlinie verlangt ein konformes Gerät',
    compliantExpected: 'Aktiviert (nicht nur Berichtsmodus)',
    scopeLabel: 'Geltungsbereich der Richtlinie',
    scopeExpected: 'Alle Benutzer und alle Ressourcen',
    appLabel: 'Aktive Richtlinie verlangt genehmigte App oder App-Schutz-Richtlinie',
    appExpected: 'Aktiviert',
    actualEnabled: (names: string[]) => `Aktiviert: ${names.join(', ')}`,
    actualReportOnly: (names: string[]) => `Nur Berichtsmodus: ${names.join(', ')}`,
    actualAlternative: (names: string[]) =>
      `Nur als Alternative (ODER) zu anderen Steuerungen: ${names.join(', ')}`,
    actualNone: 'Keine Richtlinie',
    actualScopeAll: 'Alle Benutzer und alle Ressourcen',
    actualScopePartial: 'Nur ein Teil der Benutzer oder Ressourcen',
    compliantTitle: 'Keine aktive Richtlinie verlangt ein konformes Gerät',
    compliantDetail:
      'Microsoft empfiehlt eine Richtlinie für Bedingten Zugriff, die für den Zugriff ein konformes Gerät verlangt („Require compliant PCs and mobile devices“). Ohne sie wirkt sich das Ergebnis der Compliance-Richtlinien nicht auf den Zugriff aus.',
    compliantCause:
      'Keine solche Richtlinie vorhanden, sie ist deaktiviert, läuft nur im Berichtsmodus oder lässt andere Steuerungen als Alternative zu.',
    compliantRemediation: [
      'Im Microsoft Entra Admin Center unter Entra ID › Bedingter Zugriff › Richtlinien prüfen, ob eine Richtlinie „Gerät muss als konform markiert sein“ verlangt und aktiviert ist.',
      'Vor dem Aktivieren das eigene Gerät auf Konformität prüfen und Notfallkonten ausschließen, damit sich niemand aussperrt.',
    ],
    scopeTitle: 'Richtlinie für konforme Geräte gilt nicht für alle Benutzer und Ressourcen',
    scopeDetail:
      'Microsoft beschreibt die Richtlinie mit „Alle Benutzer“ und „Alle Ressourcen“ (Ausschluss nur für Notfallkonten). Die aktive Richtlinie gilt nur für einen Teil.',
    scopeCause: 'Bewusst eingeschränkter Geltungsbereich, z. B. während der Einführung.',
    scopeRemediation: [
      'Im Microsoft Entra Admin Center unter Entra ID › Bedingter Zugriff › Richtlinien die Zuweisungen (Benutzer, Zielressourcen) der Richtlinie prüfen.',
    ],
    appTitle: 'Keine aktive Richtlinie verlangt eine genehmigte App oder App-Schutz-Richtlinie',
    appDetail:
      'App-Schutz-Richtlinien greifen laut Microsoft erst zusammen mit einer Richtlinie für Bedingten Zugriff, die eine genehmigte Client-App oder eine App-Schutz-Richtlinie verlangt.',
    appCause: 'Keine solche Richtlinie vorhanden, deaktiviert oder nur im Berichtsmodus.',
    appRemediation: [
      'Im Microsoft Entra Admin Center unter Entra ID › Bedingter Zugriff › Richtlinien prüfen, ob „Genehmigte Client-App“ bzw. „App-Schutz-Richtlinie“ für mobile Geräte verlangt wird.',
    ],
    truncatedReason:
      'Nicht alle Richtlinien für Bedingten Zugriff wurden gelesen – eine passende Richtlinie kann existieren.',
    facts: {
      total: 'Richtlinien gesamt',
      enabled: 'Aktiviert',
      reportOnly: 'Nur Berichtsmodus',
      disabled: 'Deaktiviert',
      exclusions: 'Richtlinie mit Ausschlüssen',
      exclusionsValue: (n: number) =>
        n === 0 ? 'keine' : `${policies(n)} (z. B. Notfallkonten – laut Microsoft empfohlen)`,
    },
  },

  compliance: {
    policyTitle: (name: string, count: number) =>
      `„${name}“ weicht in ${settingsCount(count)} von der Empfehlung ab`,
    policyTitleUnassigned: (name: string, count: number) =>
      `„${name}“ (nicht zugewiesen) weicht in ${settingsCount(count)} ab`,
    policyNotCheckedTitle: (name: string, count: number) =>
      `„${name}“: ${settingsCount(count)} nicht prüfbar`,
    policyDetail: (levelText: string, reached: string) =>
      `Bewertet gegen ${levelText}; ${reached}. Strengere Werte als empfohlen gelten als erfüllt.`,
    policyDetailUnleveled:
      'Microsoft nennt für diese Empfehlungen keine Stufen. Strengere Werte als empfohlen gelten als erfüllt.',
    unassignedDetail:
      'Die Richtlinie ist keiner Gruppe zugewiesen und gilt deshalb für kein Gerät – sie zählt nicht zum Gesamtbild.',
    cause:
      'Die Richtlinie setzt diese Werte anders als die Microsoft-Sicherheitskonfiguration (oder gar nicht).',
    remediation: [
      'Im Intune Admin Center unter Geräte › Compliance die Richtlinie öffnen und unter Eigenschaften › Compliance-Einstellungen die genannten Werte prüfen.',
      'Microsoft nennt die Werte einen Ausgangspunkt („Organizations should update this setting to match their password policy“) – Abweichungen bewusst entscheiden.',
    ],
    noPolicyTitle: 'Keine Compliance-Richtlinie für diese Plattform',
    noPolicyDetail:
      'Es gibt verwaltete Geräte, aber keine Compliance-Richtlinie dieser Plattform. Die Bewertung steht in der Kachel „Abdeckung der Plattformen“.',
    noPolicyCause: 'Keine Richtlinie angelegt.',
    noPolicyRemediation: [
      'Im Intune Admin Center unter Geräte › Compliance eine Richtlinie für die Plattform anlegen und zuweisen.',
    ],
    noTargetTitle: 'Microsoft dokumentiert dafür keinen Sollwert',
    noTargetMacos:
      'Für macOS-Compliance-Richtlinien nennt Microsoft Learn keine Sicherheitskonfiguration mit Sollwerten. Geprüft wird nur, ob eine Richtlinie zugewiesen ist (Kachel „Abdeckung der Plattformen“).',
    noTargetDeviceAdmin: (names: string[]) =>
      `Für Android-Geräteadministrator-Richtlinien (${names.join(', ')}) gibt es keine Microsoft-Sicherheitskonfiguration. Microsoft hat die Verwaltung per Geräteadministrator für Geräte mit Google Mobile Services eingestellt.`,
    noTargetWindowsOther: (names: string[]) =>
      `Für diese Windows-Richtlinientypen (${names.join(', ')}) gibt es keine Microsoft-Empfehlung; bewertet werden nur Richtlinien „Windows 10 und neuer“.`,
    noTargetCause: 'Kein dokumentierter Sollwert – reine Information.',
    noTargetRemediation: ['Keine Aktion nötig.'],
    betaTypeLabel: 'Richtlinientyp prüfen',
    betaTypeExpected: 'Sicherheitskonfiguration laut Microsoft Learn',
    betaTypeActual: (odataType: string | null) => odataType ?? 'Unbekannter Typ',
    betaTypeReason:
      'Dieser Richtlinientyp ist nur in der Beta-API mit Einstellungen dokumentiert (z. B. Android Enterprise vollständig verwaltet) – über die dokumentierte v1.0-API nicht prüfbar.',
    betaTypeTitle: (n: number) => `${policies(n)} über die dokumentierte API nicht prüfbar`,
    betaTypeDetail: (names: string[]) =>
      `Für ${names.join(', ')} gibt es Microsoft-Empfehlungen (z. B. Android Enterprise vollständig verwaltet, Stufe 1–3), der Richtlinientyp ist aber nur in der Beta-API mit Einstellungen dokumentiert. Die App rät nicht.`,
    betaTypeCause: 'Richtlinientyp ohne Einstellungen in der v1.0-API.',
    betaTypeRemediation: [
      'Die Richtlinie im Intune Admin Center unter Geräte › Compliance mit der verlinkten Microsoft-Empfehlung vergleichen.',
    ],
    summaryPolicies: (n: number, reached: string | null) =>
      [policies(n), reached].filter(Boolean).join(' · '),
  },

  appProtection: {
    coverageLabel: 'Zugewiesene App-Schutz-Richtlinie',
    coverageExpected: 'Mindestens eine (eine Richtlinie je Plattform)',
    coverageTitle: 'Keine zugewiesene App-Schutz-Richtlinie',
    coverageDetail:
      'Microsoft empfiehlt eine App-Schutz-Richtlinie je mobiler Plattform („Apply Application Protection Policies (APP) for data protection“). Für diese Plattform ist keine zugewiesen.',
    coverageCause: 'Keine Richtlinie angelegt oder keiner Gruppe zugewiesen.',
    coverageRemediation: [
      'Im Intune Admin Center unter Apps › Schutz die Richtlinien der Plattform und ihre Zuweisungen prüfen.',
    ],
    remediation: [
      'Im Intune Admin Center unter Apps › Schutz die Richtlinie öffnen und unter Eigenschaften die Bereiche Datenschutz, Zugriffsanforderungen und Bedingter Start prüfen.',
      'Microsoft nennt die Stufen einen Ausgangspunkt („settings … may need to be adjusted based on the needs of the organization“) – Abweichungen bewusst entscheiden.',
    ],
    cause:
      'Die Richtlinie setzt diese Werte anders als das Microsoft-Datenschutzframework (oder gar nicht).',
    appsFact: (name: string) => `Apps in „${name}“`,
    appsValue: (n: number | null) => (n === null ? 'unbekannt' : String(n)),
  },

  baselines: {
    windowsLabel: 'Windows-Sicherheitsbaseline zugewiesen',
    windowsExpected: 'Mindestens eine zugewiesene Baseline',
    windowsTitle: 'Keine zugewiesene Sicherheitsbaseline für Windows',
    windowsDetail:
      'Microsoft empfiehlt, Windows-Geräte mit Sicherheitsbaselines zu härten („Security baselines are applied to Windows devices“). Gelesen werden nur Baselines im aktuellen Format (seit Mai 2023, Einstellungskatalog).',
    windowsCause: 'Keine Baseline angelegt, keine zugewiesen oder nur Baselines im älteren Format.',
    windowsRemediation: [
      'Im Intune Admin Center unter Endpunktsicherheit › Sicherheitsbaselines die Baselines und ihre Zuweisungen prüfen.',
    ],
    actualAssigned: (n: number) => `${n} zugewiesen`,
    actualUnassigned: (n: number) => `${n} vorhanden, keine zugewiesen`,
    actualNone: 'Keine',
    versionLabel: (name: string) => `„${name}“: Vorlagenversion aktuell`,
    versionExpected: 'Aktuelle Version',
    versionActual: (version: string | null, state: string) =>
      `${version ?? 'Version unbekannt'} (${state})`,
    lifecycle: {
      active: 'aktuell',
      superseded: 'abgelöst',
      deprecated: 'veraltet',
      retired: 'eingestellt',
      draft: 'Entwurf',
      invalid: 'ungültig',
    } as Record<string, string>,
    versionUnknownReason: 'Die Vorlage der Baseline wurde nicht gefunden oder nicht gelesen.',
    versionTitle: (name: string) => `„${name}“ nutzt eine ältere Baseline-Version`,
    versionDetail:
      'Microsoft empfiehlt, ältere Baseline-Versionen so bald wie praktikabel auf die neueste Version zu aktualisieren. Neuere Versionen enthalten neue Einstellungen und passen Standardwerte an aktuelle Empfehlungen an.',
    versionCause: 'Neue Baseline-Versionen werden nicht automatisch übernommen.',
    versionRemediation: [
      'Im Intune Admin Center unter Endpunktsicherheit › Sicherheitsbaselines den Baseline-Typ wählen, das Profil markieren und „Version aktualisieren“ wählen (erstellt eine neue Instanz ohne Zuweisungen).',
      'Die neue Version zuerst an einer Testgruppe prüfen.',
    ],
    defaultsLabel: (name: string) => `„${name}“: Standardwerte der Vorlage`,
    defaultsExpected: 'Standardwerte (empfohlene Konfiguration)',
    defaultsActualMet: (compared: number) =>
      `${settingsCount(compared)} verglichen, keine Abweichung`,
    defaultsActualDeviating: (n: number, compared: number) => `${n} von ${compared} weichen ab`,
    defaultsNotCompared: 'Nicht verglichen (Obergrenze der App erreicht)',
    defaultsTitle: (name: string, n: number) =>
      `„${name}“ weicht in ${settingsCount(n)} vom Standard der Baseline ab`,
    defaultsDetail:
      'Die Standardwerte einer Baseline sind laut Microsoft die empfohlene Sicherheitskonfiguration des jeweiligen Produktteams. Microsoft rät zugleich, jeden Wert zu prüfen und bei Bedarf anzupassen – eine Abweichung kann also beabsichtigt sein.',
    defaultsCause: 'Einstellungen wurden in der Baseline angepasst.',
    defaultsRemediation: [
      'Im Intune Admin Center unter Endpunktsicherheit › Sicherheitsbaselines das Profil öffnen und unter Eigenschaften › Konfigurationseinstellungen die genannten Werte prüfen.',
    ],
    defaultsColumns: { setting: 'Einstellung', configured: 'Ist', default: 'Standard' },
    missingValue: 'Nicht in der Richtlinie',
    noName: 'Ohne Namen',
    skippedFact: 'Nicht vergleichbare Einstellungen',
    comparedFact: (name: string) => `Verglichen in „${name}“`,
    comparedValue: (n: number) => settingsCount(n),
    unassignedTitle: (names: string[]) => `Nicht zugewiesen: ${names.join(', ')}`,
    unassignedDetail:
      'Diese Baselines sind keiner Gruppe zugewiesen und gelten für kein Gerät. Sie werden angezeigt, zählen aber nicht zum Gesamtbild.',
    unassignedCause: 'Baseline angelegt, aber nicht zugewiesen (z. B. Test oder Vorbereitung).',
    unassignedRemediation: [
      'Unter Endpunktsicherheit › Sicherheitsbaselines prüfen, ob die Baseline noch gebraucht wird.',
    ],
    value: (n: number) => `${n} ${plural(n, 'Baseline', 'Baselines')}`,
    summaryNone: 'Keine Sicherheitsbaseline im aktuellen Format gefunden.',
  },

  endpointSecurity: {
    areas: {
      antivirusWindows: 'Antivirus (Windows)',
      antivirusMacos: 'Antivirus (macOS)',
      diskEncryptionWindows: 'Datenträgerverschlüsselung – BitLocker (Windows)',
      diskEncryptionMacos: 'Datenträgerverschlüsselung – FileVault (macOS)',
      firewallWindows: 'Firewall (Windows)',
      firewallMacos: 'Firewall (macOS)',
      asrWindows: 'Verringerung der Angriffsfläche (Windows)',
      accountProtectionWindows: 'Kontoschutz, z. B. lokale Gruppenmitgliedschaft (Windows)',
    },
    expected: 'Mindestens eine zugewiesene Richtlinie',
    actualAssigned: (n: number) => `${policies(n)} zugewiesen`,
    actualUnassigned: (n: number) => `${policies(n)}, keine zugewiesen`,
    actualNone: 'Keine Richtlinie',
    actualUnknown: (n: number) => `${policies(n)}, Zuweisung unbekannt`,
    notUsedReason: 'Keine Geräte dieser Plattform.',
    title: (area: string) => `${area}: keine zugewiesene Richtlinie`,
    detail:
      'Microsoft empfiehlt für diesen Bereich eine konfigurierte und zugewiesene Richtlinie der Endpunktsicherheit. Gelesen werden nur Richtlinien im Format des Einstellungskatalogs (Beta-API); Profile aus älteren Vorlagen sieht die App nicht.',
    cause: 'Keine Richtlinie angelegt, keine zugewiesen oder nur ältere Profile vorhanden.',
    remediation: [
      'Im Intune Admin Center unter Endpunktsicherheit den Bereich öffnen (z. B. Antivirus, Datenträgerverschlüsselung, Firewall, Verringerung der Angriffsfläche, Kontoschutz) und die Richtlinien samt Zuweisungen prüfen.',
    ],
    edrFact: 'Endpunkterkennung und -reaktion (EDR)',
    edrValue: (n: number) => `${policies(n)} (Microsoft nennt hier keinen Sollwert)`,
    value: (met: number, total: number) => `${met} von ${total} Bereichen abgedeckt`,
  },

  secureScore: {
    title: 'Offene Empfehlungen für Geräte',
    detail: (open: number, total: number) =>
      `${open} von ${total} Empfehlungen der Kategorie „Device“ bzw. des Dienstes Intune haben noch nicht die volle Punktzahl. Titel und Texte stammen unverändert von Microsoft.`,
    cause:
      'Empfehlung nicht oder nur teilweise umgesetzt. Microsoft weist darauf hin, dass nicht jede Empfehlung zu jeder Umgebung passt.',
    remediation: [
      'Im Microsoft Defender-Portal unter Secure Score › Empfohlene Aktionen die Empfehlung öffnen – dort stehen Voraussetzungen und Umsetzungsschritte.',
      'Nach einer Änderung kann es 24 bis 48 Stunden dauern, bis sich die Punktzahl aktualisiert.',
    ],
    columns: {
      title: 'Empfehlung',
      points: 'Punkte',
      category: 'Kategorie',
      service: 'Dienst',
    },
    points: (score: number | null, max: number | null) =>
      `${score === null ? '–' : formatNumber(score)} / ${max === null ? '–' : formatNumber(max)}`,
    controlCause: 'Laut Microsoft noch nicht vollständig umgesetzt.',
    controlRemediation: [
      'Im Microsoft Defender-Portal unter Secure Score › Empfohlene Aktionen die Empfehlung öffnen.',
    ],
    controlTitleFallback: 'Empfehlung ohne Titel',
    controlDetailFallback: 'Microsoft liefert keine Beschreibung.',
    notCheckedReason: 'Microsoft liefert keine Punktzahl für diese Empfehlung.',
    expected: 'Volle Punktzahl laut Microsoft',
    facts: {
      score: 'Secure Score gesamt',
      scoreValue: (score: number | null, max: number | null) =>
        score === null || max === null
          ? 'nicht geliefert'
          : `${formatNumber(score)} von ${formatNumber(max)} Punkten`,
      date: 'Stand',
      deviceControls: 'Empfehlungen für Geräte',
      deviceControlsValue: (met: number, total: number) => `${met} von ${total} umgesetzt`,
    },
    noneTitle: 'Keine Empfehlungen für Geräte geliefert',
    noneDetail:
      'Der Secure Score enthält keine Empfehlung der Kategorie „Device“ und keine des Dienstes Intune.',
    noneCause: 'Microsoft liefert für diesen Mandanten keine passenden Empfehlungen.',
    noneRemediation: ['Keine Aktion nötig.'],
    valueNone: 'Keine Geräte-Empfehlungen',
  },
} as const;

function formatNumber(n: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(n);
}
