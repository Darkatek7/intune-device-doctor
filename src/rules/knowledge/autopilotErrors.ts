/**
 * Fehlercodes aus Windows Autopilot und der Registrierungsstatusseite (ESP). CLAUDE.md Regel 4:
 * Titel, Ursache und Lösung stammen ausschließlich von der jeweils verlinkten Microsoft-Learn-Seite
 * (abgerufen 2026-11-10); die Anker wurden gegen die Seiten geprüft.
 *
 * Quellen:
 * - Windows Autopilot – known issues  https://learn.microsoft.com/autopilot/known-issues
 * - Troubleshooting Windows device enrollment errors in Intune
 *   https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/troubleshoot-windows-enrollment-errors
 */
import { knowledgeEntry as entry } from './knowledgeEntry';
import type { KnowledgeEntry } from './types';

const KNOWN_ISSUES_URL = 'https://learn.microsoft.com/autopilot/known-issues';
const ENROLLMENT_ERRORS_URL =
  'https://learn.microsoft.com/troubleshoot/mem/intune/device-enrollment/troubleshoot-windows-enrollment-errors';

export const AUTOPILOT_ERROR_CODES: KnowledgeEntry[] = [
  entry('0x801C03EA', {
    title: 'Registrierung für die Mobilgeräteverwaltung fehlgeschlagen – TPM (0x801C03EA)',
    cause:
      'Laut Microsoft („Registering your device for mobile management (Failed: 3, 0x801C03EA)“) hat das Gerät einen TPM-Chip, der Version 2.0 unterstützt, aber noch nicht auf 2.0 aktualisiert wurde.',
    remediation: [
      'TPM-Chip auf Version 2.0 aktualisieren (Firmware-Update des Herstellers).',
      'Besteht das Problem weiter: prüfen, ob das Gerät in zwei zugewiesenen Gruppen mit unterschiedlichen Autopilot-Profilen ist, und eine der beiden Profilzuweisungen entfernen.',
    ],
    docsUrl: `${ENROLLMENT_ERRORS_URL}#registering-your-device-for-mobile-management-failed-3-0x801c03ea`,
  }),
  entry('0x800705B4', {
    title: 'Hardware absichern fehlgeschlagen – „Securing your hardware (Failed: 0x800705b4)“',
    cause:
      'Laut Microsoft erfüllt das Gerät eine der Voraussetzungen für den Self-Deploying-Modus nicht: ein physischer TPM-2.0-Chip (virtuelle TPMs, z. B. Hyper-V-VMs, und TPM 1.2 funktionieren nicht) sowie Windows 10 ab Build 1709 (bei Microsoft Entra hybrid join ab Build 1809).',
    remediation: [
      'Sicherstellen, dass das Gerät einen physischen TPM-2.0-Chip hat (keine VM, kein TPM 1.2).',
      'Windows-Version prüfen: mindestens Windows 10 1709, bei Microsoft Entra hybrid join mindestens 1809.',
    ],
    docsUrl: `${ENROLLMENT_ERRORS_URL}#securing-your-hardware-failed-0x800705b4`,
    // 0x800705B4 ist generisch ERROR_TIMEOUT – nur im Registrierungskontext so deuten.
    context: 'enrollment',
  }),
  entry('0x80070774', {
    title: 'Domänencontroller nicht erreichbar – Hybrid-Autopilot (0x80070774)',
    cause:
      'Laut Microsoft tritt der Fehler typischerweise in einem Hybrid-Autopilot-Szenario auf, bevor das Gerät neu startet: Der Domänencontroller ist nicht erreichbar, oder das Gerät kann der Domäne nicht mehr beitreten. Häufigste Ursache ist die Funktion „Benutzer zuweisen“ im Autopilot-Profil zusammen mit Microsoft Entra hybrid join. Weitere Ursachen: Das zum Autopilot-Objekt gehörende Entra-Gerät wurde gelöscht, oder dem Intune Connector für Active Directory fehlen Rechte auf der Organisationseinheit (Ereignis 30132 im ODJ-Connector-Protokoll).',
    remediation: [
      'Im Intune Admin Center unter Geräte › Windows das Gerät auswählen, „Benutzerzuweisung aufheben“ wählen und prüfen, dass das Hybrid-Autopilot-Profil zugewiesen ist, bevor OOBE erneut startet.',
      'Wurde das Entra-Gerät gelöscht: Autopilot-Objekt löschen und den Hardware-Hash neu importieren.',
      'Auf dem Server mit dem Intune Connector für Active Directory im ODJ-Connector-Protokoll nach Ereignis 30132 suchen und ggf. die Delegierung auf der Organisationseinheit korrigieren (Computerobjekte erstellen/löschen).',
    ],
    docsUrl: `${ENROLLMENT_ERRORS_URL}#something-went-wrong-error-code-80070774`,
    // 0x80070774 ist generisch Win32-Fehler 1908 – nur im Registrierungskontext so deuten.
    context: 'enrollment',
  }),
  entry('0x81039001', {
    title: 'TPM-Attestierung: maximale Wiederholungen überschritten (0x81039001)',
    cause:
      'Laut Microsoft (E_AUTOPILOT_CLIENT_TPM_MAX_ATTESTATION_RETRY_EXCEEDED) scheitert die TPM-Attestierung bei manchen Geräten sporadisch im Schritt „Securing your hardware“ – beim Pre-Provisioning (Techniker-Ablauf) oder im Self-Deploying-Modus.',
    remediation: [
      'Bereitstellung erneut versuchen – laut Microsoft kann ein weiterer Versuch das Problem lösen.',
    ],
    docsUrl: `${KNOWN_ISSUES_URL}#tpm-attestation-failure-with-error-code-0x81039001`,
  }),
  entry('0x81039023', {
    title: 'TPM-Attestierung unter Windows 11 fehlgeschlagen (0x81039023)',
    cause:
      'Laut Microsoft scheitert die TPM-Attestierung auf manchen Geräten unter Windows 11 beim Pre-Provisioning (Techniker-Ablauf) oder im Self-Deploying-Modus.',
    remediation: [
      'Das kumulative Update für Windows 11 21H2 vom Mai 2022 (KB5013943) oder neuer installieren.',
    ],
    docsUrl: `${KNOWN_ISSUES_URL}#tpm-attestation-failure-on-windows-11-error-code-0x81039023`,
  }),
  entry('0x81039024', {
    title: 'TPM-Attestierung: bekannte TPM-Schwachstellen (0x81039024)',
    cause:
      'Laut Microsoft wurden bekannte Schwachstellen im TPM erkannt; deshalb schlägt die Attestierung beim Pre-Provisioning oder im Self-Deploying-Modus fehl.',
    remediation: ['TPM-Firmware über die Website des Geräteherstellers aktualisieren.'],
    docsUrl: `${KNOWN_ISSUES_URL}#tpm-attestation-failure-on-windows-11-error-code-0x81039024`,
  }),
  entry('0xC1036501', {
    title: 'Mehrere MDM-Konfigurationen in Microsoft Entra ID (0xC1036501)',
    cause:
      'Laut Microsoft kann das Gerät keine automatische MDM-Registrierung durchführen, weil in Microsoft Entra ID mehrere MDM-Konfigurationen vorhanden sind (Self-Deploying-Modus).',
    remediation: [
      'In Microsoft Entra ID unter Mobilität (MDM und MAM) die MDM-Konfigurationen prüfen, sodass für das Gerät nur eine greift.',
    ],
    docsUrl: `${KNOWN_ISSUES_URL}#windows-autopilot-self-deploying-mode-fails-with-an-error-code`,
  }),
  entry('0x801C03F3', {
    title: 'Entra-Geräteobjekt nicht gefunden – Pre-Provisioning (0x801C03F3)',
    cause:
      'Laut Microsoft findet Microsoft Entra ID kein Geräteobjekt für das bereitgestellte Gerät, weil es manuell gelöscht wurde. Sichtbar im Ereignisprotokoll „Microsoft-Windows-User Device Registration/Admin“.',
    remediation: [
      'Gerät aus Microsoft Entra ID, Intune und Windows Autopilot entfernen und erneut bei Windows Autopilot registrieren – dadurch wird das Entra-Geräteobjekt neu erstellt.',
      'Für Protokolle: Mdmdiagnosticstool.exe -area Autopilot;TPM -cab c:\\autopilot.cab',
    ],
    docsUrl: `${KNOWN_ISSUES_URL}#pre-provisioning-gives-an-error-screen-and-the-microsoft-windows-user-device-registrationadmin-event-log-displays-hresult-error-code-0x801c03f3`,
  }),
];
