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
        : `Die ${shown} Einstellungen mit den meisten nicht konformen Geräten (von ${total} mit Verstößen).`,
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

  reasons: {
    summaryNotReported: 'Microsoft meldet für diesen Mandanten keine Zusammenfassung.',
  },
} as const;
