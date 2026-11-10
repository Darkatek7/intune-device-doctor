/**
 * Fehlercodes der App-Installation unter Windows (Win32/IME, LOB/MSIX). CLAUDE.md Regel 4:
 * Titel, Ursache und Lösung stammen ausschließlich von der verlinkten Microsoft-Learn-Seite
 * (abgerufen 2026-11-10).
 *
 * Quelle: Intune app installation error reference – Abschnitt „Other installation errors“
 * https://learn.microsoft.com/troubleshoot/mem/intune/app-management/app-install-error-codes#other-installation-errors
 *
 * Die Dezimalwerte auf der Seite sind teils fehlerhaft (z. B. 0x80073CF3 mit dem Wert von 0x80073CF0);
 * knowledgeEntry() berechnet sie deshalb aus der Hex-Form.
 */
import { knowledgeEntry as entry } from './knowledgeEntry';
import type { KnowledgeEntry } from './types';

const APP_ERRORS_URL =
  'https://learn.microsoft.com/troubleshoot/mem/intune/app-management/app-install-error-codes#other-installation-errors';

const SIDELOADING_CAUSE =
  'Laut Microsoft ist für die Installation dieser App ein System mit aktiviertem Querladen (Sideloading) nötig.';
const SIDELOADING_REMEDIATION = [
  'Sicherstellen, dass das App-Paket mit einer vertrauenswürdigen Signatur signiert ist.',
  'Das Gerät muss domänengebunden sein und die Richtlinie „AllowAllTrustedApps“ aktiviert haben – oder eine Windows-Sideloading-Lizenz mit aktivierter „AllowAllTrustedApps“-Richtlinie besitzen.',
];

export const APP_ERROR_CODES: KnowledgeEntry[] = [
  entry('0x87D1041C', {
    title: 'App nach erfolgreicher Installation nicht erkannt (0x87D1041C)',
    cause:
      'Laut Microsoft war die Installation erfolgreich, die App wird aber nicht erkannt: Intune hat sie bereitgestellt, danach wurde sie wieder deinstalliert – etwa durch den Benutzer, weil die Identitätsinformationen im Paket nicht zu dem passen, was das Gerät meldet, oder weil sich bei selbstaktualisierenden MSIs die Produktversion nach einem Update außerhalb von Intune geändert hat.',
    remediation: [
      'Den Benutzer bitten, die App über das Unternehmensportal neu zu installieren.',
      'Erforderliche Apps werden laut Microsoft beim nächsten Check-in des Geräts automatisch neu installiert.',
      'Bei selbstaktualisierenden MSIs die Erkennungsregel bzw. Produktversion der App in Intune prüfen.',
    ],
    docsUrl: APP_ERRORS_URL,
  }),
  entry('0x80073CFF', {
    title: 'Querladen (Sideloading) nicht aktiviert (0x80073CFF)',
    cause: SIDELOADING_CAUSE,
    remediation: SIDELOADING_REMEDIATION,
    docsUrl: APP_ERRORS_URL,
    context: 'app',
  }),
  entry('0x80CF201C', {
    title: 'Querladen (Sideloading) nicht aktiviert (0x80CF201C)',
    cause: SIDELOADING_CAUSE,
    remediation: SIDELOADING_REMEDIATION,
    docsUrl: APP_ERRORS_URL,
  }),
  entry('0x80073CF0', {
    title: 'App-Paket konnte nicht geöffnet werden (0x80073CF0)',
    cause:
      'Laut Microsoft konnte das Paket nicht geöffnet werden: Es ist nicht signiert, oder der Herausgebername passt nicht zum Antragsteller des Signaturzertifikats.',
    remediation: [
      'Das Ereignisprotokoll „AppxPackagingOM“ am Gerät auf Details prüfen.',
      'Signatur und Herausgebername des Pakets prüfen und das Paket ggf. neu signieren.',
    ],
    docsUrl: APP_ERRORS_URL,
    context: 'app',
  }),
  entry('0x80073CF3', {
    title: 'App-Paket: Update-, Abhängigkeits- oder Konfliktprüfung fehlgeschlagen (0x80073CF3)',
    cause:
      'Laut Microsoft steht das Paket in Konflikt mit einem installierten Paket, eine angegebene Paketabhängigkeit wurde nicht gefunden, oder das Paket unterstützt die Prozessorarchitektur nicht.',
    remediation: [
      'Das Ereignisprotokoll „AppXDeployment-Server“ am Gerät auf Details prüfen.',
      'Abhängigkeiten und Zielarchitektur des Pakets prüfen.',
    ],
    docsUrl: APP_ERRORS_URL,
    context: 'app',
  }),
  entry('0x80073CFB', {
    title: 'App-Paket bereits installiert – Neuinstallation blockiert (0x80073CFB)',
    cause:
      'Laut Microsoft ist das Paket bereits installiert und die Neuinstallation wird blockiert – etwa, weil das neue Paket nicht bitgenau mit dem installierten übereinstimmt (z. B. nach Neuerstellung oder Neusignierung).',
    remediation: [
      'Versionsnummer der App erhöhen, Paket neu erstellen und neu signieren.',
      'Alternativ das alte Paket für jeden Benutzer des Systems entfernen, bevor das neue installiert wird.',
    ],
    docsUrl: APP_ERRORS_URL,
    context: 'app',
  }),
  entry('0x8000FFFF', {
    title: 'Unerwarteter Fehler bei der Installation (0x8000FFFF)',
    cause: 'Laut Microsoft ist während der Installation ein unerwarteter Fehler aufgetreten.',
    remediation: ['Die Installationsprotokolle auf weitere Informationen prüfen.'],
    docsUrl: APP_ERRORS_URL,
    // 0x8000FFFF ist der generische COM-Fehler E_UNEXPECTED – nur im App-Kontext so deuten.
    context: 'app',
  }),
];
