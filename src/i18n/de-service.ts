/**
 * Texte für M18: Dienststatus (Microsoft-365-Dienststatus für Intune/Entra) und Registrierungsfehler.
 * Eingebunden in de.ts als `de.service`; alle Texte deutsch. Microsoft-Originaltexte (Titel und
 * Auswirkung eines Vorfalls, `failureReason`) werden nie übersetzt, sondern unverändert gezeigt.
 *
 * Ursachen und Lösungsschritte der Fehlerkategorien stützen sich ausschließlich auf die Microsoft-Learn-
 * Quellen in `src/rules/knowledge/enrollmentFailureCategories.ts`.
 */
import type {
  DeviceEnrollmentFailureReason,
  ServiceHealthClassificationType,
  ServiceHealthStatus,
  TroubleshootingEnrollmentType,
} from '../graph/dto';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Allgemeine, belegte Schritte für jede Fehlerkategorie (Bericht + Selbsthilfe-Diagnose). */
const genericSteps = [
  'Im Intune Admin Center unter Geräte › Überwachen › Registrierungsfehler den Benutzer wählen und die Zeile öffnen – dort zeigt Microsoft Details und empfohlene Schritte zu genau diesem Fehler.',
  'Im Microsoft 365 Admin Center unter Hilfe & Support die Selbsthilfe-Diagnose für die Plattform (Windows, iOS/iPadOS, Android, macOS) mit der E-Mail-Adresse des Benutzers ausführen – sie ändert nichts am Mandanten.',
] as const;

export const deService = {
  tiles: {
    tenantServiceHealth: 'Dienststatus',
    tenantEnrollmentFailures: 'Registrierungsfehler',
  },

  // ---------- Dienststatus ----------
  health: {
    /** Bezeichnung der Dienste, wenn der Name nicht eindeutig ist */
    kind: { intune: 'Microsoft Intune', entra: 'Microsoft Entra' },
    /** Statuswerte laut serviceHealthStatus (deutsche Kurzform; Rohwert steht in den Rohdaten) */
    status: {
      serviceOperational: 'Betriebsbereit',
      investigating: 'Wird untersucht',
      restoringService: 'Dienst wird wiederhergestellt',
      verifyingService: 'Behebung wird überprüft',
      serviceRestored: 'Dienst wiederhergestellt',
      postIncidentReviewPublished: 'Nachbericht veröffentlicht',
      serviceDegradation: 'Eingeschränkt',
      serviceInterruption: 'Unterbrochen',
      extendedRecovery: 'Längere Wiederherstellung',
      falsePositive: 'Fehlalarm',
      investigationSuspended: 'Untersuchung ausgesetzt',
      resolved: 'resolved (reserviert)',
      mitigatedExternal: 'mitigatedExternal (reserviert)',
      mitigated: 'mitigated (reserviert)',
      resolvedExternal: 'resolvedExternal (reserviert)',
      confirmed: 'confirmed (reserviert)',
      reported: 'reported (reserviert)',
      unknownFutureValue: 'Unbekannter Status',
    } satisfies Record<ServiceHealthStatus, string>,
    statusUnknown: (raw: string | null) =>
      raw ? `Unbekannter Status (${raw})` : 'Kein Status gemeldet',
    classification: {
      incident: 'Vorfall',
      advisory: 'Hinweis',
      unknownFutureValue: 'Unbekannte Einstufung',
    } satisfies Record<ServiceHealthClassificationType, string>,
    classificationUnknown: 'Einstufung unbekannt',

    valueOk: 'Keine Störung',
    valueIssues: (n: number) => `${n} ${plural(n, 'offener Eintrag', 'offene Einträge')}`,
    valueNotFound: 'Intune nicht gefunden',
    summaryOk: 'Microsoft meldet für Intune und Entra keine offenen Vorfälle.',
    summaryIssues: (incidents: number, advisories: number) =>
      [
        incidents > 0 ? `${incidents} ${plural(incidents, 'Vorfall', 'Vorfälle')}` : null,
        advisories > 0 ? `${advisories} ${plural(advisories, 'Hinweis', 'Hinweise')}` : null,
      ]
        .filter(Boolean)
        .join(' und ') + ' von Microsoft offen.',
    summaryNotFound: 'In der Dienstliste dieses Mandanten ist kein Eintrag für Intune erkennbar.',

    serviceTitle: (service: string, status: string) => `${service}: ${status}`,
    serviceDetail: (service: string, raw: string | null) =>
      `Microsoft meldet für „${service}“ den Gesamtstatus ${raw ? `„${raw}“` : '(ohne Wert)'}.`,
    serviceCause: {
      problem:
        'Die Ursache liegt laut Microsoft beim Dienst selbst – nicht am Gerät oder an der Konfiguration im Mandanten.',
      unknown:
        'Microsoft dokumentiert diesen Statuswert nicht näher (reserviert oder neu) – er wird deshalb nicht bewertet.',
    },
    issueCause: (service: string) =>
      `Microsoft führt diesen Eintrag für „${service}“ als offen. Solange er besteht, können Fehler in diesem Bereich vom Dienst und nicht vom Gerät kommen.`,
    issueDetailMissing: 'Microsoft hat keine Beschreibung der Auswirkung angegeben.',
    issueRemediation: [
      'Vor einer Fehlersuche am Gerät prüfen, ob der Eintrag das Problem erklärt – Microsoft empfiehlt, zuerst den Dienststatus zu prüfen, bevor man den Support kontaktiert oder Zeit in die Fehlersuche steckt.',
      'Verlauf und Updates im Microsoft 365 Admin Center unter Integrität › Dienstintegrität ansehen (oder im Intune Admin Center unter Mandantenverwaltung › Mandantenstatus › Dienstintegrität und Nachrichtencenter).',
      'Optional E-Mail-Benachrichtigungen zur Dienstintegrität einrichten (Microsoft 365 Admin Center › Integrität › Dienstintegrität › Anpassen › E-Mail).',
    ],
    serviceRemediation: [
      'Offene Vorfälle und Hinweise im Microsoft 365 Admin Center unter Integrität › Dienstintegrität ansehen.',
    ],
    notFoundTitle: 'Intune in der Dienstliste nicht gefunden',
    notFoundDetail: (count: number) =>
      `Die Dienstliste enthält ${count} ${plural(count, 'Dienst', 'Dienste')}, aber keinen, dessen Name „Intune“ enthält. Microsoft dokumentiert keine festen Dienstnamen – sie sind je Mandant aus healthOverviews zu lesen.`,
    notFoundCause: 'Der Dienst heißt in diesem Mandanten anders oder ist nicht abonniert.',
    notFoundRemediation: [
      'Die Dienstliste unten mit der Dienstintegrität im Microsoft 365 Admin Center vergleichen.',
    ],
    overviewTitle: 'Alle gemeldeten Dienste',
    overviewDetail: (count: number, truncated: boolean) =>
      `${count} ${plural(count, 'Dienst', 'Dienste')} laut healthOverviews${truncated ? ' (weitere Seiten nicht gelesen)' : ''}.`,
    overviewCause: 'Informativ – der Gesamtstatus jedes Dienstes, den der Mandant abonniert hat.',
    columns: { service: 'Dienst', status: 'Status', open: 'Offen', resolved: 'Behoben' },
    facts: {
      intune: 'Intune',
      entra: 'Entra',
      open: 'Offene Einträge',
      notListed: 'nicht gelistet',
    },
    /** Hinweis in der Geräteansicht */
    notice: {
      label: 'Hinweis von Microsoft',
      text: 'Microsoft meldet aktuell eine Störung bei Intune:',
      more: (n: number) => `und ${n} ${plural(n, 'weiterer Vorfall', 'weitere Vorfälle')}`,
      open: 'Dienststatus ansehen',
    },
  },

  // ---------- Registrierungsfehler ----------
  failures: {
    category: {
      unknown: 'Unbekannt',
      authentication: 'Authentifizierung',
      authorization: 'Autorisierung',
      accountValidation: 'Kontoprüfung',
      userValidation: 'Benutzerprüfung',
      deviceNotSupported: 'Gerät nicht unterstützt',
      inMaintenance: 'Konto in Wartung',
      badRequest: 'Ungültige Anfrage',
      featureNotSupported: 'Funktion nicht unterstützt',
      enrollmentRestrictionsEnforced: 'Registrierungsbeschränkung',
      clientDisconnected: 'Verbindung abgebrochen',
      userAbandonment: 'Vom Benutzer abgebrochen',
    } satisfies Record<DeviceEnrollmentFailureReason, string>,
    categoryRaw: (raw: string | null) => (raw ? `Unbekannter Wert (${raw})` : 'Ohne Kategorie'),
    enrollmentType: {
      unknown: 'Unbekannt',
      userEnrollment: 'Benutzer-Registrierung',
      deviceEnrollmentManager: 'Geräteregistrierungs-Manager (DEM)',
      appleBulkWithUser: 'Apple-Massenregistrierung mit Benutzer',
      appleBulkWithoutUser: 'Apple-Massenregistrierung ohne Benutzer',
      windowsAzureADJoin: 'Windows Entra-Join',
      windowsBulkUserless: 'Windows-Massenregistrierung ohne Benutzer',
      windowsAutoEnrollment: 'Windows automatische Registrierung',
      windowsBulkAzureDomainJoin: 'Windows-Massen-Entra-Join',
      windowsCoManagement: 'Windows Co-Verwaltung',
    } satisfies Record<TroubleshootingEnrollmentType, string>,
    /** Ursache (Microsoft-Beschreibung des Enum-Werts, übersetzt) + Lösungsschritte je Kategorie */
    causes: {
      unknown: 'Microsoft meldet keine Kategorie („failure reason is unknown“).',
      authentication: 'Die Authentifizierung ist fehlgeschlagen.',
      authorization: 'Der Aufruf war authentifiziert, aber nicht zur Registrierung berechtigt.',
      accountValidation:
        'Das Konto konnte für die Registrierung nicht validiert werden (laut Microsoft z. B. Konto gesperrt oder Registrierung nicht aktiviert).',
      userValidation:
        'Der Benutzer konnte nicht validiert werden (laut Microsoft z. B. Benutzer existiert nicht oder Lizenz fehlt).',
      deviceNotSupported: 'Das Gerät wird für die mobile Geräteverwaltung nicht unterstützt.',
      inMaintenance: 'Das Konto befindet sich in Wartung.',
      badRequest:
        'Der Client hat eine Anfrage gesendet, die der Dienst nicht versteht oder nicht unterstützt.',
      featureNotSupported:
        'Eine bei dieser Registrierung verwendete Funktion wird für dieses Konto nicht unterstützt.',
      enrollmentRestrictionsEnforced:
        'Eine vom Administrator konfigurierte Registrierungsbeschränkung hat diese Registrierung blockiert.',
      clientDisconnected:
        'Zeitüberschreitung beim Client, oder der Benutzer hat die Registrierung abgebrochen.',
      userAbandonment:
        'Der Benutzer hat die Registrierung begonnen, aber nicht rechtzeitig abgeschlossen.',
    } satisfies Record<DeviceEnrollmentFailureReason, string>,
    remediation: {
      unknown: [...genericSteps],
      authentication: [
        'Datum und Uhrzeit des Geräts prüfen: laut Microsoft nach einem Neustart nah an der richtigen Zeit (höchstens ±12 Stunden) für die Zeitzone des Benutzers; ggf. das Unternehmensportal neu installieren.',
        ...genericSteps,
      ],
      authorization: [...genericSteps],
      accountValidation: [
        'Prüfen, ob die MDM-Autorität im Mandanten gesetzt ist (Intune Admin Center › Mandantenverwaltung) – ohne sie scheitert jede Registrierung.',
        ...genericSteps,
      ],
      userValidation: [
        'Dem Benutzer eine passende Intune-Lizenz zuweisen (Microsoft 365 Admin Center › Benutzer › Lizenzen) – laut Microsoft scheitert die Registrierung ohne passende Lizenz.',
        ...genericSteps,
      ],
      deviceNotSupported: [...genericSteps],
      inMaintenance: [
        'Laut Microsoft lassen sich keine neuen Geräte registrieren, solange das Konto in Wartung ist – den Mandantenstatus und die Dienstintegrität prüfen und später erneut versuchen.',
        ...genericSteps,
      ],
      badRequest: [...genericSteps],
      featureNotSupported: [...genericSteps],
      enrollmentRestrictionsEnforced: [
        'Registrierungsbeschränkungen prüfen (Intune Admin Center › Geräte › Registrierung): Geräteplattform, Betriebssystemversion, Hersteller und privat genutzte Geräte.',
        'Gerätelimit des Benutzers prüfen (Intune Admin Center › Geräte › Registrierungsbeschränkungen für das Gerätelimit) – die Kachel „Registrierung (Benutzer)“ eines Geräts zeigt die Limit-Konfigurationen.',
        ...genericSteps,
      ],
      clientDisconnected: [
        'Den Benutzer die Registrierung erneut starten lassen, möglichst in einem anderen Netzwerk.',
        ...genericSteps,
      ],
      userAbandonment: [
        'Den Benutzer die Registrierung erneut starten und vollständig abschließen lassen.',
        ...genericSteps,
      ],
    } satisfies Record<DeviceEnrollmentFailureReason, string[]>,
    rawCause:
      'Microsoft liefert einen Wert, den die Dokumentation nicht beschreibt – deshalb keine Deutung, nur der Rohwert.',
    rawRemediation: [...genericSteps],

    // Ansicht „Mandant“
    valueNone: 'Keine Fehler',
    valueCount: (n: number) => `${n} ${plural(n, 'Fehlschlag', 'Fehlschläge')}`,
    summaryNone: (pages: number, truncated: boolean) =>
      truncated
        ? `Keine fehlgeschlagenen Registrierungen in den ersten ${pages} ${plural(pages, 'Seite', 'Seiten')}.`
        : 'Keine fehlgeschlagenen Registrierungen gemeldet.',
    summary: (n: number, categories: number, latest: string | null) =>
      `${n} ${plural(n, 'fehlgeschlagene Registrierung', 'fehlgeschlagene Registrierungen')} in ${categories} ${plural(categories, 'Kategorie', 'Kategorien')}${latest ? `, zuletzt ${latest}` : ''}.`,
    categoryTitle: (label: string, count: number) =>
      `${label}: ${count} ${plural(count, 'Fehlschlag', 'Fehlschläge')}`,
    categoryDetail: (latest: string | null, reasons: string[]) =>
      [
        latest ? `Zuletzt ${latest}.` : null,
        reasons.length > 0 ? `Gemeldete Fehlergründe: ${reasons.join(' · ')}` : null,
      ]
        .filter(Boolean)
        .join(' '),
    truncatedTitle: (pages: number) =>
      `Nur die ersten ${pages} ${plural(pages, 'Seite', 'Seiten')} geprüft`,
    truncatedDetail:
      'Microsoft liefert weitere Einträge. Für diese Liste sind weder Filter noch Sortierung dokumentiert – ältere oder spätere Fehlschläge können fehlen.',
    truncatedCause: 'Bewusste Grenze, damit die Ansicht schnell bleibt.',
    truncatedRemediation: [
      'Die vollständige Liste im Intune Admin Center unter Geräte › Überwachen › Registrierungsfehler ansehen.',
    ],
    listTitle: 'Jüngste fehlgeschlagene Registrierungen',
    listDetail: (shown: number, total: number) =>
      shown === total
        ? `${total} ${plural(total, 'Eintrag', 'Einträge')}, neueste zuerst.`
        : `Die ${shown} neuesten von ${total} Einträgen.`,
    listCause:
      'Informativ. Der Benutzer erscheint nur als Objekt-ID: Die Ressource enthält keinen Namen, und ein Name ist mit den vorhandenen Berechtigungen nicht abrufbar.',
    columns: {
      time: 'Zeitpunkt',
      os: 'Betriebssystem',
      type: 'Registrierungsart',
      category: 'Kategorie',
      reason: 'Fehlergrund',
      user: 'Benutzer-ID',
    },
    noReason: '–',
    unknownValue: 'unbekannt',
    facts: {
      count: 'Fehlschläge',
      categories: 'Kategorien',
      latest: 'Zuletzt',
      pages: 'Geprüfte Seiten',
    },

    // Geräteansicht (Kachel „Registrierung (Benutzer)“)
    deviceFact: 'Fehlgeschlagene Registrierungen',
    deviceFactNone: 'keine gefunden',
    deviceFactTruncated: (pages: number) =>
      `(nur ${pages} ${plural(pages, 'Seite', 'Seiten')} geprüft)`,

    /** Hinweis bei Suche ohne Treffer */
    searchHint: {
      text: 'Registrierung fehlgeschlagen?',
      link: 'Registrierungsfehler im Mandanten ansehen',
    },
  },

  reasons: {
    serviceHealthNotReported: 'Der Dienststatus ist für diesen Mandanten nicht verfügbar.',
    troubleshootingNotReported: 'Registrierungsfehler sind für diesen Mandanten nicht verfügbar.',
    enrollmentFailuresNoUser:
      'Das Gerät hat keinen primären Benutzer – Registrierungsfehler sind nur je Benutzer zuordenbar.',
  },
};
