/**
 * Fehlercodes der Windows-MDM-Registrierung (0x8018xxxx, 0x801Cxxxx u. a.). CLAUDE.md Regel 4:
 * Titel, Ursache und Lösung stammen ausschließlich von der jeweils verlinkten Microsoft-Learn-Seite
 * (abgerufen 2026-11-10); die Anker wurden gegen die Seiten geprüft.
 *
 * Quellen:
 * - Troubleshooting Windows device enrollment errors in Intune
 *   https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/troubleshoot-windows-enrollment-errors
 * - Windows user is not authorized to enroll
 *   https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/windows-user-cannot-enroll
 * - Mobile device enrollment – Enrollment error messages (MENROLL_E_*)
 *   https://learn.microsoft.com/windows/client-management/mobile-device-enrollment#enrollment-error-messages
 * - Windows Autopilot troubleshooting FAQ (0x80180014, 0x80180018)
 *   https://learn.microsoft.com/autopilot/troubleshooting-faq
 */
import { knowledgeEntry as entry } from './knowledgeEntry';
import type { KnowledgeEntry } from './types';

const ENROLLMENT_ERRORS_URL =
  'https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/troubleshoot-windows-enrollment-errors';
const USER_NOT_AUTHORIZED_URL =
  'https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/windows-user-cannot-enroll';
const MENROLL_URL =
  'https://learn.microsoft.com/windows/client-management/mobile-device-enrollment#enrollment-error-messages';
const AUTOPILOT_FAQ_URL = 'https://learn.microsoft.com/autopilot/troubleshooting-faq';

const USER_NOT_AUTHORIZED_CAUSE =
  'Laut Microsoft eine der folgenden Bedingungen: Der Benutzer hat bereits die maximal erlaubte Anzahl an Geräten in Intune registriert; das Gerät wird durch eine Gerätetyp-Einschränkung blockiert; auf dem Gerät läuft Windows Home (Registrierung und Entra-Join werden erst ab Pro unterstützt); oder die Entra-Einstellung „Benutzer dürfen Geräte mit Microsoft Entra ID verknüpfen“ steht auf „Keine“.';
const USER_NOT_AUTHORIZED_REMEDIATION = [
  'Geräte des Benutzers prüfen (Intune Admin Center › Benutzer › Alle Benutzer › Benutzer › Geräte) und ungenutzte Geräte entfernen.',
  'Gibt es keine ungenutzten Geräte: Gerätelimit in der Registrierungsbeschränkung erhöhen (wirkt für alle Benutzer).',
  'Gerätetyp-Einschränkungen prüfen: „Windows (MDM)“ muss auf „Zulassen“ stehen.',
  'Windows Home auf Pro oder eine höhere Edition aktualisieren.',
  'In Microsoft Entra ID › Geräte › Geräteeinstellungen „Benutzer dürfen Geräte mit Microsoft Entra ID verknüpfen“ prüfen (Alle bzw. die betroffenen Benutzer).',
];

/** MENROLL_E_*-Codes: Microsoft nennt nur Bedeutung und Hinweis aus der SOAP-Fehlermeldung. */
function menroll(
  hex: string,
  name: string,
  title: string,
  cause: string,
  remediation: string[],
): KnowledgeEntry {
  return entry(hex, {
    title: `${title} – ${name} (${hex})`,
    cause,
    remediation,
    docsUrl: MENROLL_URL,
  });
}

/** Hinweis aus der Fehlermeldung selbst: „Try again or contact your system administrator.“ */
const RETRY_OR_ADMIN =
  'Laut Microsoft: Registrierung erneut versuchen; besteht der Fehler weiter, ist der Administrator (Tenant-/Serverseite) gefragt.';
const NO_FURTHER_STEPS =
  'Microsoft nennt für diesen Code keine weiteren Lösungsschritte – Meldung und Zeitpunkt mit den übrigen Registrierungsbefunden abgleichen.';

export const ENROLLMENT_ERROR_CODES: KnowledgeEntry[] = [
  entry('0x8007064C', {
    title: 'Gerät bereits registriert – „The machine is already enrolled“ (0x8007064C)',
    cause:
      'Laut Microsoft war das Gerät bereits registriert, es nutzt das geklonte Image eines bereits registrierten Geräts, oder das Kontozertifikat der vorherigen Registrierung ist noch auf dem Gerät vorhanden.',
    remediation: [
      'Am Gerät in der Zertifikatsverwaltung (Computerkonto › Eigene Zertifikate) nach dem von „Sc_Online_Issuing“ ausgestellten Intune-Zertifikat suchen und es entfernen.',
      'Den Registrierungsschlüssel HKLM\\SOFTWARE\\Microsoft\\OnlineManagement samt Unterschlüsseln entfernen (vorher die Registry sichern) und die Registrierung erneut versuchen.',
      'Scheitert es weiterhin: die weiteren Schritte der Microsoft-Seite befolgen (Installer-Produktschlüssel) und erneut registrieren.',
    ],
    docsUrl: `${ENROLLMENT_ERRORS_URL}#error-hr-0x8007064c-the-machine-is-already-enrolled`,
    // 0x8007064C ist generisch Win32-Fehler 1612 – nur im Registrierungskontext so deuten.
    context: 'enrollment',
  }),
  entry('0x8018000A', {
    title: 'Gerät bereits registriert – „The device is already enrolled“ (0x8018000A)',
    cause:
      'Laut Microsoft hat ein anderer Benutzer das Gerät bereits in Intune registriert oder mit Microsoft Entra ID verknüpft (unter Einstellungen › Konten › Auf Arbeits- oder Schulkonto zugreifen erkennbar).',
    remediation: [
      'Mit dem Konto anmelden, das das Gerät registriert bzw. verknüpft hat, und dort das Arbeits- oder Schulkonto entfernen.',
      'Wieder mit dem eigenen Konto anmelden und das Gerät erneut registrieren bzw. mit Microsoft Entra ID verknüpfen.',
    ],
    docsUrl: `${ENROLLMENT_ERRORS_URL}#error-8018000a-the-device-is-already-enrolled`,
  }),
  entry('0x80180026', {
    title: 'Entra-Join scheitert – „Something went wrong“ (0x80180026)',
    cause:
      'Laut Microsoft tritt der Fehler beim Verknüpfen eines Windows-Geräts mit Microsoft Entra ID auf, wenn die automatische MDM-Registrierung aktiv ist und gleichzeitig der Intune-PC-Softwareclient (Intune PC Agent) installiert ist.',
    remediation: [
      'Entweder die automatische MDM-Registrierung deaktivieren (Microsoft Entra ID › Mobilität (MDM und MAM) › Microsoft Intune › MDM-Benutzerbereich „Keine“)',
      'oder den Intune-PC-Softwareclient vom Gerät deinstallieren.',
    ],
    docsUrl: `${ENROLLMENT_ERRORS_URL}#something-went-wrong`,
  }),
  entry('0x80CF4017', {
    title: 'Clientsoftware veraltet (0x80CF4017)',
    cause:
      'Laut Microsoft ist die Clientsoftware veraltet („The software cannot be installed“ bzw. „The account certificate is not valid and may be expired“).',
    remediation: [
      'Aktuelle Clientsoftware im Admin-Portal herunterladen (Admin › Client Software Download) und installieren.',
    ],
    docsUrl: `${ENROLLMENT_ERRORS_URL}#the-software-cannot-be-installed`,
  }),
  entry('0x8018002B', {
    title: 'Automatische MDM-Registrierung fehlgeschlagen – „Auto MDM Enroll: Failed“ (0x8018002B)',
    cause:
      'Laut Microsoft (Registrierung per Gruppenrichtlinie, Ereignis 76): Der UPN enthält eine nicht verifizierte oder nicht routbare Domäne (z. B. .local), oder der MDM-Benutzerbereich steht auf „Keine“.',
    remediation: [
      'UPN-Suffix der betroffenen Benutzer im Active Directory auf eine verifizierte, routbare Domäne (z. B. contoso.com) umstellen und die nächste Synchronisierung abwarten.',
      'In Microsoft Entra ID › Mobilität (MDM und MAM) › Microsoft Intune den MDM-Benutzerbereich auf „Alle“ oder „Einige“ (mit den betroffenen Gruppen) setzen.',
    ],
    docsUrl: `${ENROLLMENT_ERRORS_URL}#auto-mdm-enroll-failed`,
  }),
  entry('0x80180022', {
    title: 'Registrierung bei Windows Home nicht möglich (0x80180022)',
    cause:
      'Laut Microsoft läuft auf dem bereitgestellten Gerät Windows Home Edition (Autopilot-Registrierung mit HRESULT 0x80180022).',
    remediation: ['Das Gerät auf Windows Pro oder eine höhere Edition aktualisieren.'],
    docsUrl: `${ENROLLMENT_ERRORS_URL}#autopilot-device-enrollment-failed-with-error-hresult--0x80180022`,
  }),
  entry('0x801C0003', {
    title: 'Benutzer nicht zur Registrierung berechtigt (0x801C0003)',
    cause: USER_NOT_AUTHORIZED_CAUSE,
    remediation: USER_NOT_AUTHORIZED_REMEDIATION,
    docsUrl: USER_NOT_AUTHORIZED_URL,
  }),
  entry('0x80180003', {
    title: 'Benutzer nicht zur Registrierung berechtigt (0x80180003)',
    cause: USER_NOT_AUTHORIZED_CAUSE,
    remediation: USER_NOT_AUTHORIZED_REMEDIATION,
    docsUrl: USER_NOT_AUTHORIZED_URL,
  }),
  entry('0x80180014', {
    title: 'Registrierung blockiert – Gerät/Plattform nicht unterstützt (0x80180014)',
    cause:
      'Laut Microsoft zwei Szenarien: (1) Ein Gerät, das per Autopilot im Self-Deploying- oder Pre-Provisioning-Modus bereitgestellt wurde, wird wiederverwendet bzw. zurückgesetzt – dafür muss der von Intune erstellte Geräteeintrag entfernt bzw. das Gerät entsperrt werden. (2) Die Windows-MDM-Registrierung ist im Tenant durch eine Gerätetyp-Einschränkung blockiert.',
    remediation: [
      'Szenario 1: Im Intune Admin Center unter Geräte › Windows › Registrierung › Windows Autopilot › Geräte das Gerät auswählen, „Gerät entsperren“ wählen und das Autopilot-Profil erneut bereitstellen.',
      'Szenario 2: Unter Geräte › Windows › Registrierung › Geräteplattformbeschränkung alle Einschränkungen prüfen, ob „Windows (MDM)“ für die Gruppe des Benutzers auf „Zulassen“ steht.',
    ],
    docsUrl: `${AUTOPILOT_FAQ_URL}#why-is-error-code--0x80180014--occurring-when-trying-to-re-enroll-a-previously-enrolled-device-`,
  }),
  entry('0x80180018', {
    title: 'Registrierung fehlgeschlagen – Lizenz oder Gerätelimit (0x80180018)',
    cause:
      'Laut Microsoft sind häufige Ursachen fehlende oder falsche Lizenzen des Benutzers oder zu viele registrierte Geräte des Benutzers.',
    remediation: [
      'Lizenzzuweisung des Benutzers prüfen (Intune- bzw. passende Microsoft-365-Lizenz).',
      'Anzahl der registrierten Geräte des Benutzers mit dem Gerätelimit vergleichen und ungenutzte Geräte entfernen.',
    ],
    docsUrl: `${AUTOPILOT_FAQ_URL}#why-is-enrollment-in-microsoft-intune-or-a-non-microsoft-mdm-solution-failing-with-an-error-code--80180018--`,
  }),

  // ---- MENROLL_E_* aus der Registrierungsprotokoll-Dokumentation ----
  menroll(
    '0x80180001',
    'MENROLL_E_DEVICE_MESSAGE_FORMAT_ERROR',
    'Ungültige Nachricht vom MDM-Server',
    'Laut Microsoft hat das Gerät eine ungültige Nachricht vom MDM-Server erhalten.',
    [RETRY_OR_ADMIN],
  ),
  menroll(
    '0x80180002',
    'MENROLL_E_DEVICE_AUTHENTICATION_ERROR',
    'Benutzer konnte nicht authentifiziert werden',
    'Laut Microsoft konnte der MDM-Server den Benutzer nicht authentifizieren.',
    [RETRY_OR_ADMIN],
  ),
  menroll(
    '0x80180004',
    'MENROLL_E_DEVICE_CERTIFICATEREQUEST_ERROR',
    'Zertifikatsanforderung fehlgeschlagen',
    'Laut Microsoft hat der Benutzer keine Berechtigung für die Zertifikatvorlage, oder die Zertifizierungsstelle ist nicht erreichbar.',
    [RETRY_OR_ADMIN],
  ),
  menroll(
    '0x80180005',
    'MENROLL_E_DEVICE_CONFIGMGRSERVER_ERROR',
    'Fehler auf dem MDM-Server',
    'Laut Microsoft ist auf dem MDM-Server ein Fehler aufgetreten.',
    [RETRY_OR_ADMIN],
  ),
  menroll(
    '0x80180006',
    'MENROLL_E_DEVICE_INTERNALSERVICE_ERROR',
    'Unbehandelte Ausnahme auf dem MDM-Server',
    'Laut Microsoft gab es auf dem MDM-Server eine unbehandelte Ausnahme.',
    [RETRY_OR_ADMIN],
  ),
  menroll(
    '0x80180007',
    'MENROLL_E_DEVICE_INVALIDSECURITY_ERROR',
    'Konto konnte nicht validiert werden',
    'Laut Microsoft konnte der MDM-Server das Konto des Benutzers nicht validieren.',
    [RETRY_OR_ADMIN],
  ),
  menroll(
    '0x80180013',
    'MENROLL_E_DEVICECAPREACHED',
    'Gerätelimit erreicht',
    'Laut Microsoft hat das Konto zu viele Geräte in der MDM registriert.',
    [
      'Alte Geräte des Benutzers löschen bzw. deren Registrierung aufheben, danach erneut registrieren.',
    ],
  ),
  menroll(
    '0x80180015',
    'MENROLL_E_NOT_SUPPORTED',
    'MDM für dieses Gerät nicht unterstützt',
    'Laut Microsoft wird die Mobilgeräteverwaltung (MDM) für dieses Gerät nicht unterstützt.',
    [NO_FURTHER_STEPS],
  ),
  menroll(
    '0x80180016',
    'MENROLL_E_NOTELIGIBLETORENEW',
    'Erneuerung des MDM-Zertifikats abgelehnt',
    'Laut Microsoft versucht das Gerät, das MDM-Zertifikat zu erneuern, der Server hat die Anforderung aber abgelehnt.',
    ['Den Erneuerungszeitplan auf dem Gerät prüfen.'],
  ),
  menroll(
    '0x80180017',
    'MENROLL_E_INMAINTENANCE',
    'Konto im Wartungsmodus',
    'Laut Microsoft meldet der MDM-Server, dass sich das Konto im Wartungsmodus befindet.',
    ['Die Registrierung später erneut versuchen.'],
  ),
  menroll(
    '0x80180019',
    'MENROLL_E_ENROLLMENTDATAINVALID',
    'Registrierungsdaten abgelehnt',
    'Laut Microsoft hat der MDM-Server die Registrierungsdaten abgelehnt; der Server ist möglicherweise nicht korrekt konfiguriert.',
    ['Die Registrierungskonfiguration auf Serverseite (Tenant) prüfen.'],
  ),
];
