/**
 * Texte für M19: Präsentationsmodus. Eingebunden in de.ts als `de.privacy`; alle Texte deutsch.
 *
 * Der Modus ersetzt Namen und Kennungen durch Pseudonyme (Gerät-7F3A, Benutzer-2C9E, …). Richtlinien-,
 * Gruppen- und App-Namen bleiben sichtbar – sie sind für die Diagnose nötig, können aber den Firmennamen
 * enthalten. Das sagt der Hinweis offen.
 */
export const dePrivacy = {
  toggle: {
    /** Bleibt konstant (aria-pressed trägt den Zustand) */
    label: 'Präsentationsmodus',
    hintOff: 'Präsentationsmodus einschalten: verbirgt Namen und Kennungen für Screenshots',
    hintOn: 'Präsentationsmodus ausschalten: echte Namen und Kennungen wieder anzeigen',
  },
  notice: {
    label: 'Hinweis zum Präsentationsmodus',
    pill: 'Präsentationsmodus · Namen verborgen',
    body: 'Geräte, Benutzer, Seriennummern und IDs sind durch Pseudonyme ersetzt (z. B. „Gerät-7F3A“). Richtlinien-, Gruppen- und App-Namen bleiben sichtbar und können den Firmennamen enthalten.',
  },
  /** Ein Satz je Dialog bzw. Ausgabe: was man sieht, bekommt man */
  output: {
    ticketNote:
      'Präsentationsmodus: Namen und Kennungen sind in der Notiz durch Pseudonyme ersetzt.',
    export: 'Im Präsentationsmodus enthält die Datei Pseudonyme statt echter Namen und Kennungen.',
    copyEvidence: 'Im Präsentationsmodus werden Pseudonyme kopiert.',
    connectionReport: 'Präsentationsmodus: Der Bericht enthält Pseudonyme statt echter Namen.',
    bulkCsv: 'Im Präsentationsmodus enthält die CSV-Datei Pseudonyme statt echter Namen.',
    compare: 'Präsentationsmodus: Der Vergleich zeigt Pseudonyme statt echter Namen.',
  },
  /** Echo der Sucheingabe entfällt, solange Namen verborgen sind */
  picker: {
    subtitle: (count: number) =>
      `${count} Geräte passen zu deiner Suche – bitte eines auswählen.`,
  },
  notFoundBody:
    'Zu deiner Suche gibt es kein Gerät. Prüfe die Schreibweise – es genügt auch ein Teil des Namens.',
  /** Sammelprüfung: Die Eingabeliste wird nach dem Start geleert */
  bulkInputCleared: 'Die Eingabeliste wurde nach dem Start verborgen.',
  /** Dateiname einer verborgenen Datei (Pseudonym trägt die Endung selbst) */
  fileExtension: '.zip',
} as const;
