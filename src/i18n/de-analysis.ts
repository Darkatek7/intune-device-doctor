/**
 * Texte der Analyse-Funktionen (M12/A): Zeitachse und „Wahrscheinlichste Ursache“.
 * Wird in de.ts als `de.analysis` eingebunden; alle Texte deutsch.
 */
export const deAnalysis = {
  timeline: {
    /** Schaltfläche im Geräte-/ZIP-Header */
    button: 'Zeitachse',
    buttonHint: 'Alle Zeitpunkte aus den geladenen Daten in einer Übersicht anzeigen',
    dialogTitle: 'Zeitachse',
    close: 'Zeitachse schließen',
    intro:
      'Zeitpunkte aus den geladenen Daten, neueste zuerst. Termine in der Zukunft sind als „geplant“ markiert.',
    filterLabel: 'Anzeige filtern',
    filterAll: 'Alle Ereignisse',
    filterProblems: 'Nur Probleme',
    listLabel: 'Ereignisse der Zeitachse',
    empty: 'Keine Zeitpunkte in den geladenen Daten.',
    emptyProblems: 'Keine Probleme in der Zeitachse.',
    planned: 'Geplant',
    /** Nur für Screenreader am Ende des Eintrags; der sichtbare Text bleibt Teil des Namens (WCAG 2.5.3). */
    open: (tile: string) => `– Kachel „${tile}“ öffnen`,
    dayToday: 'Heute',
    count: (shown: number, total: number) =>
      shown === total ? `${total} Ereignisse` : `${shown} von ${total} Ereignissen`,
    /** Kurzname der Datenquelle je Ereignis */
    source: {
      intune: 'Intune',
      entra: 'Entra',
      zip: 'DiagLogs-ZIP',
    },
    kind: {
      enrollment: 'Registrierung',
      checkIn: 'Check-in',
      entraSignIn: 'Entra-Anmeldung',
      signIn: 'Anmeldung',
      compliance: 'Compliance',
      laps: 'LAPS',
      autopilot: 'Autopilot',
      bitlocker: 'BitLocker',
      defender: 'Defender',
      certificate: 'Zertifikat',
      zipCollected: 'Sammlung',
      mdmEvent: 'MDM-Ereignis',
      imeLog: 'IME-Protokoll',
    } as Record<string, string>,
    /** Titel und Details der Ereignisse */
    events: {
      enrolled: 'Gerät in Intune registriert',
      checkIn: 'Letzter Check-in bei Intune',
      checkInDetail: (relative: string) => `Das Gerät hat sich zuletzt ${relative} gemeldet.`,
      entraSignIn: 'Letzte Anmeldung des Geräts in Entra (ungefähr)',
      entraSignInStale: (days: number) =>
        `Hinweis: Die letzte Entra-Anmeldung liegt ${days} Tage zurück.`,
      signInOk: (app: string) => `Anmeldung bei ${app}`,
      signInFailed: (app: string) => `Anmeldung blockiert (Conditional Access): ${app}`,
      signInDetail: (resource: string | null, error: string | null) =>
        [resource ? `Ressource: ${resource}` : null, error].filter(Boolean).join(' · '),
      signInError: (code: number, name: string | null) =>
        name ? `Fehler ${code} (${name})` : `Fehlercode ${code}`,
      lapsBackup: 'Kennwort des lokalen Administrators gesichert (LAPS)',
      lapsBackupStale: (days: number) =>
        `Die Sicherung ist ${days} Tage alt (Richtwert der App: 30 Tage).`,
      lapsRefreshPlanned: 'Geplante Rotation des lokalen Administrator-Kennworts (LAPS)',
      lapsRefreshPast: 'Rotation des lokalen Administrator-Kennworts war geplant (LAPS)',
      lapsRefreshOverdue: (days: number) =>
        `Hinweis: Der Termin liegt ${days} Tage zurück, eine neue Sicherung steht aus.`,
      autopilot: 'Autopilot-Eintrag zuletzt kontaktiert',
      bitlockerKey: (volume: string) =>
        `BitLocker-Wiederherstellungsschlüssel gesichert (${volume})`,
      bitlockerVolume: {
        operatingSystemVolume: 'Systemlaufwerk',
        fixedDataVolume: 'Datenlaufwerk',
        removableDataVolume: 'Wechseldatenträger',
        unknown: 'Laufwerk unbekannt',
      } as Record<string, string>,
      defenderQuick: 'Defender: letzter Schnellscan',
      defenderFull: 'Defender: letzter vollständiger Scan',
      defenderScanOverdue: 'Laut Defender ist ein weiterer Scan überfällig.',
      defenderReported: 'Defender: Status zuletzt an Intune gemeldet',
      defenderSignaturesOverdue: 'Laut Defender sind die Signaturen veraltet.',
      mdmCertExpired: 'MDM-Zertifikat des Geräts abgelaufen',
      mdmCertExpires: 'MDM-Zertifikat des Geräts läuft ab',
      applePushExpired: 'Apple-MDM-Push-Zertifikat abgelaufen',
      applePushExpires: 'Apple-MDM-Push-Zertifikat läuft ab',
      graceEnds: 'Schonfrist der Compliance endet',
      graceEnded: 'Schonfrist der Compliance ist abgelaufen',
      zipCollected: 'Diagnosedaten gesammelt',
      zipCollectedDetail: (file: string) => `Archiv: ${file}`,
      mdmEvent: (id: number, title: string | null) =>
        title ? `MDM-Ereignis ${id}: ${title}` : `MDM-Ereignis ${id}`,
      mdmEventDetail: (count: number, level: string, log: string) =>
        `${count}× ${level} im Protokoll „${log}“ (jüngstes Ereignis)`,
      mdmLevel: { 1: 'Kritisch', 2: 'Fehler', 3: 'Warnung' } as Record<number, string>,
      mdmLog: {
        mdmAdmin: 'DeviceManagement-Enterprise-Diagnostics-Provider/Admin',
        aadOperational: 'AAD/Operational',
      } as Record<string, string>,
      imeIssue: (component: string | null) =>
        component ? `IME-Protokoll: ${component}` : 'IME-Protokoll',
      imeHint: 'Typ 3 markiert auch manche Informationen – nur als Hinweis werten.',
      certExpired: (subject: string | null) =>
        `Zertifikat abgelaufen${subject ? `: ${subject}` : ''}`,
      certExpires: (subject: string | null) =>
        `Zertifikat läuft ab${subject ? `: ${subject}` : ''}`,
      certDetail: 'Zeitpunkt aus der certutil-Ausgabe; abgelaufen bezogen auf den Sammelzeitpunkt.',
    },
  },
  insight: {
    heading: 'Wahrscheinlichste Ursache',
    note: 'Automatische Einschätzung aus den angezeigten Befunden.',
    why: 'Warum?',
    steps: 'Vorgehen',
    related: 'Beteiligte Kacheln',
    openTile: (tile: string) => `Kachel „${tile}“ öffnen`,
    docs: 'Microsoft-Dokumentation',
    ticketHeading: 'Wahrscheinlichste Ursache',
    ticketTimelineHeading: 'Zeitachse (letzte Probleme)',
    items: {
      deviceDisabled: {
        title: 'Das Gerät ist in Entra deaktiviert',
        explanation:
          'In Entra ist das Gerät deaktiviert, und gleichzeitig wurden Anmeldungen durch Conditional Access abgewiesen. Laut Microsoft kann ein deaktiviertes oder gelöschtes Gerät keine durch gerätebasiertes Conditional Access geschützten Ressourcen erreichen. Die Anmeldefehler sind daher sehr wahrscheinlich eine Folge – nicht die eigentliche Ursache.',
        steps: [
          'Im Entra Admin Center unter Geräte prüfen, warum das Gerät deaktiviert wurde (Administrator, Benutzer, bei Hybrid-Join auch das Deaktivieren des Computerkontos).',
          'Ist die Deaktivierung unbeabsichtigt, das Gerät dort wieder aktivieren; andernfalls das Gerät neu registrieren (Entra-Join bzw. -Registrierung).',
          'Danach die Anmeldungen erneut prüfen.',
        ],
        why: 'Kachel „Gerätestatus“: Das Entra-Gerät ist deaktiviert (accountEnabled = false). Kachel „Anmeldungen“: mindestens eine Anmeldung mit Conditional-Access-Fehler.',
      },
      prtMissing: {
        title: 'Entra-Join bzw. PRT zuerst beheben',
        explanation:
          'Im DiagLogs-ZIP fehlt der Primary Refresh Token (PRT) oder der Entra-Join ist fehlerhaft, und gleichzeitig wurden Anmeldungen durch Conditional Access abgewiesen. Der PRT trägt die Geräte- und Benutzerangaben, mit denen Entra ID Conditional Access (z. B. „konformes Gerät erforderlich“) auswertet. Ohne gültigen PRT kann das Gerät diese Bedingung nicht belegen – auch wenn es in Intune konform ist.',
        steps: [
          'Zuerst die Kachel „Entra-Join & PRT“ abarbeiten (Join-Status, Geräteauthentifizierung, PRT-Fehlercodes).',
          'Erst danach die Conditional-Access-Richtlinien und die Compliance bewerten.',
          'Nach der Korrektur am Gerät ab- und wieder anmelden bzw. neu starten und die Anmeldungen erneut prüfen.',
        ],
        why: (finding: string) =>
          `Kachel „Entra-Join & PRT“: ${finding}. Kachel „Anmeldungen“: mindestens eine Anmeldung mit Conditional-Access-Fehler.`,
      },
      autoEnrollment: {
        title: 'Automatische MDM-Registrierung prüfen',
        explanation:
          'Das MDM-Ereignisprotokoll enthält das Ereignis 76 („Auto MDM Enroll: Failed“), und das Enrollment ist auffällig. Laut Microsoft zeigt Ereignis 76 eine fehlgeschlagene automatische Registrierung an; der Fehlercode steht im Ereignis.',
        steps: [
          'Den Fehlercode aus Ereignis 76 (Kachel „MDM-Ereignisse“, Rohdaten) mit der Microsoft-Seite zu Windows-Registrierungsfehlern abgleichen.',
          'Die Voraussetzungen der automatischen Registrierung prüfen: Intune-Lizenz des Benutzers, MDM-Benutzerbereich, Gruppenrichtlinie „Enable automatic MDM enrollment using default Microsoft Entra credentials“, Entra-Geräteeinstellungen und Registrierungsbeschränkungen.',
          'Im Protokoll nach einem späteren Ereignis 75 („Auto MDM Enroll: Succeeded“) suchen.',
        ],
        why: (finding: string) =>
          `Kachel „MDM-Ereignisse“: Ereignis 76 im Protokoll. Kachel „Enrollment“: ${finding}.`,
      },
      staleCheckIn: {
        title: 'Befunde sind evtl. veraltet – zuerst die Synchronisierung klären',
        explanation:
          'Der letzte Check-in liegt lange zurück, und gleichzeitig zeigen Richtlinien, Apps oder Compliance Probleme. Intune-Berichte zeigen laut Microsoft den Stand des letzten Check-ins; ein Gerät, das sich nicht meldet, erhält keine Richtlinien. Die angezeigten Befunde können daher den heutigen Gerätezustand nicht mehr wiedergeben.',
        steps: [
          'Prüfen, ob das Gerät eingeschaltet ist und Netzwerkzugriff auf Intune hat.',
          'Am Gerät eine Synchronisierung auslösen (Windows: Einstellungen › Konten › Auf Arbeits- oder Schulkonto zugreifen › Info › Synchronisieren) bzw. über die Unternehmensportal-App.',
          'Danach den Gerätestatus hier erneut laden und die Befunde neu bewerten.',
        ],
        why: (checkIn: string, others: string) =>
          `Kachel „Letzter Check-in“: ${checkIn}. Auffällig sind außerdem: ${others}.`,
      },
      complianceBlocked: {
        title: 'Zuerst die Compliance herstellen',
        explanation:
          'Das Gerät ist nicht konform, und Anmeldungen wurden mit AADSTS53000 (DeviceNotCompliant) abgewiesen. Laut Microsoft kann Conditional Access ein nicht konformes Gerät blockieren; 53000 bedeutet, dass eine Richtlinie ein konformes Gerät verlangt. Die Blockade löst sich, sobald das Gerät wieder als konform gemeldet wird.',
        steps: [
          'Die Kachel „Compliance“ abarbeiten: auslösende Richtlinie und Einstellung beheben.',
          'Nach der Korrektur das Gerät synchronisieren lassen, damit der neue Compliance-Status gemeldet wird.',
          'Danach die Anmeldungen erneut prüfen.',
        ],
        why: 'Kachel „Compliance“: Das Gerät ist laut Intune nicht konform. Kachel „Anmeldungen“: mindestens eine Anmeldung mit dem Fehlercode 53000 (DeviceNotCompliant).',
      },
    },
  },
} as const;
