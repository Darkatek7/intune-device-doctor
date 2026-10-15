/**
 * Intune-Fehlercodes mit Deutung. Jeder Eintrag MUSS eine Microsoft-Learn-URL haben (Test erzwingt das).
 * Basis: "Common error codes and descriptions in Microsoft Intune"
 * https://learn.microsoft.com/troubleshoot/mem/intune/general/troubleshoot-company-resource-access-problems
 */
import { hresultToHex } from '../../domain/format';
import type { KnowledgeEntry } from './types';
import { explainCode, type CodeExplanation } from './win32';

const INTUNE_COMMON_ERRORS_URL =
  'https://learn.microsoft.com/troubleshoot/mem/intune/general/troubleshoot-company-resource-access-problems#company-resource-access-common-errors';
const CONFLICTS_URL =
  'https://learn.microsoft.com/intune/intune-service/configuration/device-profile-troubleshoot#compliance-and-device-configuration-policies-that-conflict';

function entry(decimal: number, data: Omit<KnowledgeEntry, 'hex' | 'decimal'>): KnowledgeEntry {
  return { hex: hresultToHex(decimal), decimal, ...data };
}

export const INTUNE_ERROR_CODES: KnowledgeEntry[] = [
  entry(-2016281112, {
    title: 'Remediation failed (0x87D1FDE8)',
    cause:
      'Das Gerät konnte die Einstellung nicht wie vorgegeben anwenden, oder die Rückmeldung des Geräts stimmte nicht mit dem Sollwert überein. Bei benutzerdefinierten VPN-Profilen (OMA-URI) ist bekannt, dass abweichend formatiertes XML in der Rückmeldung diesen Fehler auslöst, obwohl die Verbindung funktioniert.',
    remediation: [
      'Prüfen, ob die Einstellung von Windows-Edition und -Version des Geräts unterstützt wird.',
      'Bei benutzerdefinierten VPN-Profilen: Verbindung am Gerät testen; funktioniert sie, kann der Fehler laut Microsoft ignoriert werden – alternativ ein Standard-VPN-Profil statt OMA-URI verwenden.',
      'Am Gerät die Ereignisanzeige unter „Anwendungs- und Dienstprotokolle › Microsoft › Windows › DeviceManagement-Enterprise-Diagnostics-Provider › Admin“ auf Fehler zur Einstellung prüfen.',
    ],
    docsUrl:
      'https://learn.microsoft.com/troubleshoot/mem/intune/device-configuration/device-configuration-profile-reports-error-2016281112',
  }),
  entry(-2016281106, {
    title: 'Not applicable because it lost in conflict resolution (0x87D1FDEE)',
    cause:
      'Eine andere Richtlinie setzt dieselbe Einstellung auf einen anderen Wert und hat sich durchgesetzt.',
    remediation: [
      'Im Intune Admin Center alle Profile ermitteln, die diese Einstellung konfigurieren.',
      'Konflikt manuell auflösen: Einstellung nur in einem Profil setzen oder Zuweisungen trennen.',
    ],
    docsUrl: CONFLICTS_URL,
  }),
  entry(-2016281111, {
    title: 'Not applicable for this device (0x87D1FDE9)',
    cause: 'Die Einstellung gilt für diese Geräteplattform, Edition oder Version nicht.',
    remediation: [
      'Zuweisung prüfen (z. B. per Filter auf passende Editionen/Versionen einschränken).',
      'Falls die Einstellung benötigt wird: Gerät auf eine unterstützte Version/Edition bringen.',
    ],
    docsUrl: INTUNE_COMMON_ERRORS_URL,
  }),
  entry(-2016281109, {
    title: 'Data type conversion failed (0x87D1FDEB)',
    cause: 'Der konfigurierte Wert passt nicht zum erwarteten Datentyp der Einstellung.',
    remediation: [
      'Wert und Datentyp der Einstellung im Profil prüfen (bei OMA-URI: Datentyp laut CSP-Dokumentation).',
    ],
    docsUrl: INTUNE_COMMON_ERRORS_URL,
  }),
  entry(-2016281108, {
    title: 'Referenced setting not found in CI (0x87D1FDEC)',
    cause: 'Das Gerät kennt die referenzierte Einstellung nicht.',
    remediation: [
      'Prüfen, ob die Einstellung für die Windows-Version des Geräts existiert und korrekt geschrieben ist.',
    ],
    docsUrl: INTUNE_COMMON_ERRORS_URL,
  }),
];

/** Bekannte MSI-/Installer-Codes für Win32-Apps (Intune "Application installation error codes"). */
export const INSTALLER_EXIT_CODES: Array<{
  code: number;
  title: string;
  cause: string;
  remediation: string[];
  docsUrl: string;
}> = [
  {
    code: 1602,
    title: 'Installation durch Benutzer abgebrochen (1602)',
    cause: 'Die Installation wurde abgebrochen – laut Microsoft durch den Benutzer.',
    remediation: [
      'Nutzer bitten, die Installation vollständig durchlaufen zu lassen (z. B. über das Unternehmensportal erneut starten).',
      'Installationsbefehl auf unbeaufsichtigte Ausführung prüfen (z. B. msiexec /qn), damit keine Rückfrage erscheint.',
    ],
    docsUrl:
      'https://learn.microsoft.com/intune/configmgr/tenant-attach/app-install-error-reference#msi-errors',
  },
  {
    code: 1603,
    title: 'Schwerer Fehler bei der Installation (1603)',
    cause: 'Der Installer meldet einen schweren Fehler während der Installation.',
    remediation: [
      'IME-Logs (AppWorkload.log, IntuneManagementExtension.log) und das MSI-Log am Gerät auswerten.',
      'Installation testweise im Systemkontext ausführen (z. B. per PsExec), um die Ursache zu reproduzieren.',
    ],
    docsUrl:
      'https://learn.microsoft.com/intune/configmgr/tenant-attach/app-install-error-reference#msi-errors',
  },
  {
    code: 1618,
    title: 'Andere Installation läuft bereits (1618)',
    cause: 'Eine andere Installation war zum Zeitpunkt aktiv.',
    remediation: [
      'Warten, bis die vorherige Installation abgeschlossen ist; Intune wiederholt die Installation automatisch.',
    ],
    docsUrl:
      'https://learn.microsoft.com/intune/configmgr/tenant-attach/app-install-error-reference#msi-errors',
  },
];

export function findIntuneErrorCode(decimalOrHex: number | string): KnowledgeEntry | undefined {
  const explanation = explainCode(decimalOrHex);
  return INTUNE_ERROR_CODES.find((e) => e.hex === explanation.hex);
}

export interface ErrorCodeDescription {
  explanation: CodeExplanation;
  intune?: KnowledgeEntry;
  installer?: (typeof INSTALLER_EXIT_CODES)[number];
  /** Kurztext für Kachel/Finding, z. B. "0x87D1FDE8 · Remediation failed" oder "Unbekannter Code" */
  label: string;
  docsUrl: string | null;
}

/** Fehlercode beschreiben: Intune-Wissensbasis → Installer-Codes → generische Win32/WinHTTP/NTSTATUS-Deutung. */
export function describeErrorCode(
  decimalOrHex: number | string,
  unknownLabel: string,
): ErrorCodeDescription {
  const explanation = explainCode(decimalOrHex);
  const intune = INTUNE_ERROR_CODES.find((e) => e.hex === explanation.hex);
  if (intune) return { explanation, intune, label: intune.title, docsUrl: intune.docsUrl };
  const installer =
    explanation.kind === 'win32'
      ? INSTALLER_EXIT_CODES.find((c) => c.code === explanation.baseCode)
      : undefined;
  if (installer)
    return { explanation, installer, label: installer.title, docsUrl: installer.docsUrl };
  if (explanation.name) {
    return {
      explanation,
      label: `${explanation.name} – ${explanation.text}`,
      docsUrl: explanation.docsUrl,
    };
  }
  return { explanation, label: unknownLabel, docsUrl: explanation.docsUrl };
}
