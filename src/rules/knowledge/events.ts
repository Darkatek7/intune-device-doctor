/**
 * Event-IDs aus Windows-Ereignisprotokollen, deren Bedeutung Microsoft Learn dokumentiert
 * (abgerufen 2026-11-09). CLAUDE.md Regel 4: Jeder Eintrag MUSS eine Microsoft-Learn-URL haben;
 * ohne Beleg gibt es keine Deutung – die Kachel zeigt dann nur ID und Rohdaten.
 *
 * Die Meldungstexte selbst stehen nicht im .evtx, sondern in den Ressourcen des Providers auf dem
 * Gerät. Hier steht deshalb nur, was die verlinkte Seite zur jeweiligen ID aussagt.
 */
import type { DiagEventLogId } from '../../diagnostics/types';
import { Docs } from './docs';

export interface EventKnowledge {
  log: DiagEventLogId;
  eventId: number;
  /** Kurzbezeichnung laut Microsoft-Seite (deutsch) */
  title: string;
  /** Was die Seite zu dieser ID sagt */
  cause: string;
  remediation: string[];
  /** Pflicht: offizielle Microsoft-Learn-Seite */
  docsUrl: string;
}

export const EVENT_KNOWLEDGE: EventKnowledge[] = [
  {
    log: 'mdmAdmin',
    eventId: 76,
    title: 'Automatische MDM-Registrierung fehlgeschlagen',
    cause:
      'Laut Microsoft kennzeichnet Ereignis 76 („Auto MDM Enroll: Failed“) eine fehlgeschlagene automatische Registrierung; der Fehlercode steht im Ereignis. Eine erfolgreiche automatische Registrierung wird als Ereignis 75 („Auto MDM Enroll: Succeeded“) protokolliert.',
    remediation: [
      'Den Fehlercode aus den Rohdaten mit der Microsoft-Seite „Troubleshooting Windows device enrollment errors in Intune“ abgleichen.',
      'Im selben Protokoll nach einem späteren Ereignis 75 („Auto MDM Enroll: Succeeded“) suchen – es zeigt laut Microsoft eine erfolgreiche automatische Registrierung an.',
    ],
    docsUrl: Docs.autoEnrollmentMdmLogs,
  },
  {
    log: 'mdmAdmin',
    eventId: 1819,
    title: 'Microsoft-Defender-for-Endpoint-CSP: Wert konnte nicht gesetzt werden',
    cause:
      'Laut Microsoft meldet Ereignis 1819 (Stufe Fehler, „Microsoft Defender for Endpoint CSP: Failed to Set Node’s Value“) mit NodeId, TokenName und Result, dass das CSP einen Knotenwert nicht setzen konnte – aufgeführt bei den MDM-Ereignissen zur Fehlerbehebung beim Onboarding von Microsoft Defender for Endpoint.',
    remediation: [
      'NodeId, TokenName und Result aus den Rohdaten prüfen.',
      'Die Onboarding-Konfiguration (Intune-Richtlinie für Microsoft Defender for Endpoint) und die Hinweise der Microsoft-Seite zur Fehlerbehebung beim Onboarding prüfen.',
    ],
    docsUrl: Docs.defenderOnboardingMdmEvents,
  },
  {
    log: 'aadOperational',
    eventId: 1081,
    title: 'Fehlerantwort des Microsoft-Entra-Authentifizierungsdiensts',
    cause:
      'Laut Microsoft enthält Ereignis 1081 im Operational-Protokoll von Microsoft Entra den Fehlercode des Servers bei Fehlern, die vom Microsoft-Entra-Authentifizierungsdienst stammen (Fehlersuche nach der Geräteregistrierung).',
    remediation: [
      'Den Servercode aus den Rohdaten mit der Liste häufiger Servercodes auf der Microsoft-Seite zur Fehlerbehebung bei Microsoft Entra hybrid joined Geräten abgleichen.',
    ],
    docsUrl: Docs.hybridJoinPostJoinAuth,
  },
  {
    log: 'aadOperational',
    eventId: 1088,
    title: 'Fehler des WS-Trust-Endpunkts',
    cause:
      'Laut Microsoft enthält Ereignis 1088 im Operational-Protokoll von Microsoft Entra die Fehlerbeschreibung bei Fehlern, die vom WS-Trust-Endpunkt stammen (relevant bei föderierter Authentifizierung).',
    remediation: [
      'Die Fehlerbeschreibung aus den Rohdaten prüfen und mit den Hinweisen der Microsoft-Seite zur Fehlerbehebung bei Microsoft Entra hybrid joined Geräten abgleichen (u. a. Föderationskonfiguration, Proxy).',
    ],
    docsUrl: Docs.hybridJoinPostJoinAuth,
  },
];

export function findEventKnowledge(
  log: DiagEventLogId,
  eventId: number,
): EventKnowledge | undefined {
  return EVENT_KNOWLEDGE.find((e) => e.log === log && e.eventId === eventId);
}
