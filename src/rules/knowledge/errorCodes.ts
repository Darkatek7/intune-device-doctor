/**
 * Zentrale Fehlercode-Wissensbasis. Jeder Eintrag MUSS eine Microsoft-Learn-URL haben (Test erzwingt das).
 * - Richtlinien-/Einstellungsfehler (hier): "Common error codes and descriptions in Microsoft Intune"
 *   https://learn.microsoft.com/troubleshoot/mem/intune/general/troubleshoot-company-resource-access-problems
 * - Registrierung: enrollmentErrors.ts, Autopilot/ESP: autopilotErrors.ts, App-Installation: appErrors.ts
 * - Installer-Exitcodes (MSI): unten, aus "Application installation common error codes reference"
 *
 * Nachschlagen immer über describeErrorCode() – mit optionalem Kontext für mehrdeutige Win32-Codes.
 */
import { hresultToHex } from '../../domain/format';
import { APP_ERROR_CODES } from './appErrors';
import { AUTOPILOT_ERROR_CODES } from './autopilotErrors';
import { ENROLLMENT_ERROR_CODES } from './enrollmentErrors';
import type { ErrorCodeContext, KnowledgeEntry } from './types';
import { explainCode, type CodeExplanation } from './win32';

const INTUNE_COMMON_ERRORS_URL =
  'https://learn.microsoft.com/troubleshoot/mem/intune/general/troubleshoot-company-resource-access-problems#company-resource-access-common-errors';
const CONFLICTS_URL =
  'https://learn.microsoft.com/intune/intune-service/configuration/device-profile-troubleshoot#compliance-and-device-configuration-policies-that-conflict';

function entry(decimal: number, data: Omit<KnowledgeEntry, 'hex' | 'decimal'>): KnowledgeEntry {
  return { hex: hresultToHex(decimal), decimal, ...data };
}

/** Richtlinien-/Einstellungsfehler (0x87D1FDxx). */
export const INTUNE_ERROR_CODES: KnowledgeEntry[] = [
  entry(-2016281112, {
    title: 'Einstellung nicht angewendet – „Remediation failed“ (0x87D1FDE8)',
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
    title:
      'Konflikt verloren – „Not applicable because it lost in conflict resolution“ (0x87D1FDEE)',
    cause:
      'Eine andere Richtlinie setzt dieselbe Einstellung auf einen anderen Wert und hat sich durchgesetzt.',
    remediation: [
      'Im Intune Admin Center alle Profile ermitteln, die diese Einstellung konfigurieren.',
      'Konflikt manuell auflösen: Einstellung nur in einem Profil setzen oder Zuweisungen trennen.',
    ],
    docsUrl: CONFLICTS_URL,
  }),
  entry(-2016281111, {
    title: 'Für dieses Gerät nicht anwendbar – „Not applicable for this device“ (0x87D1FDE9)',
    cause: 'Die Einstellung gilt für diese Geräteplattform, Edition oder Version nicht.',
    remediation: [
      'Zuweisung prüfen (z. B. per Filter auf passende Editionen/Versionen einschränken).',
      'Falls die Einstellung benötigt wird: Gerät auf eine unterstützte Version/Edition bringen.',
    ],
    docsUrl: INTUNE_COMMON_ERRORS_URL,
  }),
  entry(-2016281109, {
    title: 'Datentyp-Konvertierung fehlgeschlagen – „Data type conversion failed“ (0x87D1FDEB)',
    cause: 'Der konfigurierte Wert passt nicht zum erwarteten Datentyp der Einstellung.',
    remediation: [
      'Wert und Datentyp der Einstellung im Profil prüfen (bei OMA-URI: Datentyp laut CSP-Dokumentation).',
    ],
    docsUrl: INTUNE_COMMON_ERRORS_URL,
  }),
  entry(-2016281108, {
    title: 'Einstellung unbekannt – „Referenced setting not found in CI“ (0x87D1FDEC)',
    cause: 'Das Gerät kennt die referenzierte Einstellung nicht.',
    remediation: [
      'Prüfen, ob die Einstellung für die Windows-Version des Geräts existiert und korrekt geschrieben ist.',
    ],
    docsUrl: INTUNE_COMMON_ERRORS_URL,
  }),
];

const APP_INSTALL_REFERENCE_URL =
  'https://learn.microsoft.com/intune/configmgr/tenant-attach/app-install-error-reference';

/** Alle Wissensbasis-Einträge mit HRESULT-Form – Hex-Werte sind über alle Gruppen eindeutig (Test). */
export const ALL_ERROR_CODES: KnowledgeEntry[] = [
  ...INTUNE_ERROR_CODES,
  ...ENROLLMENT_ERROR_CODES,
  ...AUTOPILOT_ERROR_CODES,
  ...APP_ERROR_CODES,
];

/**
 * Bekannte MSI-/Installer-Exitcodes für Win32-Apps, Abschnitt „MSI errors“ der Seite
 * "Application installation common error codes reference" (Anker je Code geprüft, 2026-11-10).
 */
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
      'Laut Microsoft die Installation nach Möglichkeit im Systemkontext statt im Benutzerkontext ausführen.',
    ],
    docsUrl: `${APP_INSTALL_REFERENCE_URL}#1602`,
  },
  {
    code: 1603,
    title: 'Schwerer Fehler bei der Installation (1603)',
    cause: 'Der Installer meldet einen schweren Fehler während der Installation.',
    remediation: [
      'Windows-Installer-Protokollierung aktivieren und die Installation wiederholen; im MSI-Log steht der Fehlergrund typischerweise in der Nähe von „Return value 3“.',
      'Installation testweise im Systemkontext ausführen (z. B. per PsExec), um die Ursache zu reproduzieren.',
    ],
    docsUrl: `${APP_INSTALL_REFERENCE_URL}#1603`,
  },
  {
    code: 1605,
    title: 'Produkt nicht installiert (1605)',
    cause:
      'Laut Microsoft ist die Aktion nur für Produkte gültig, die aktuell installiert sind („This action is only valid for products that are currently installed“).',
    remediation: [
      'Sicherstellen, dass das Produkt installiert ist, bevor eine davon abhängige Installation läuft.',
    ],
    docsUrl: `${APP_INSTALL_REFERENCE_URL}#1605`,
  },
  {
    code: 1618,
    title: 'Andere Installation läuft bereits (1618)',
    cause: 'Eine andere Installation war zum Zeitpunkt aktiv.',
    remediation: [
      'Warten, bis die vorherige Installation abgeschlossen ist, bevor eine neue startet.',
      'Reagiert die vorherige Installation nicht mehr, kann sie laut Microsoft beendet werden – mit möglichen unerwünschten Folgen.',
    ],
    docsUrl: `${APP_INSTALL_REFERENCE_URL}#1618`,
  },
  {
    code: 1633,
    title: 'Prozessortyp nicht unterstützt (1633)',
    cause: 'Laut Microsoft wird das Installationspaket von diesem Prozessortyp nicht unterstützt.',
    remediation: [
      'Prüfen, ob die Prozessorarchitektur des Geräts zur Software passt und die Mindestanforderungen erfüllt.',
      'Erfüllt das Gerät die Anforderungen des Herstellers, den Produkthersteller kontaktieren.',
    ],
    docsUrl: `${APP_INSTALL_REFERENCE_URL}#1633`,
  },
  {
    code: 1638,
    title: 'Andere Version bereits installiert (1638)',
    cause:
      'Laut Microsoft ist bereits eine andere Version dieses Produkts installiert; die Installation dieser Version kann nicht fortgesetzt werden.',
    remediation: [
      'Die unerwünschte Version deinstallieren – per Verwaltungswerkzeug/Skript oder manuell über Einstellungen › Apps.',
    ],
    docsUrl: `${APP_INSTALL_REFERENCE_URL}#1638`,
  },
  {
    code: 1642,
    title: 'Upgrade-Patch nicht anwendbar (1642)',
    cause:
      'Laut Microsoft kann der Windows Installer den Upgrade-Patch nicht installieren: Das zu aktualisierende Programm fehlt möglicherweise, oder der Patch gilt für eine andere Version.',
    remediation: [
      'Prüfen, ob das Gerät die Versionsvoraussetzungen des Produkts für die Installation erfüllt.',
    ],
    docsUrl: `${APP_INSTALL_REFERENCE_URL}#1642`,
  },
];

/** Passt der Eintrag in den Kontext? Kontextfreie Einträge passen immer. */
function matchesContext(entry: KnowledgeEntry, context: ErrorCodeContext | undefined): boolean {
  return entry.context === undefined || entry.context === context;
}

/** Wissensbasis-Eintrag zu einem Code (Hex oder signierte Dezimalzahl), ggf. kontextabhängig. */
export function findIntuneErrorCode(
  decimalOrHex: number | string,
  context?: ErrorCodeContext,
): KnowledgeEntry | undefined {
  const explanation = explainCode(decimalOrHex);
  return ALL_ERROR_CODES.find((e) => e.hex === explanation.hex && matchesContext(e, context));
}

export interface ErrorCodeDescription {
  explanation: CodeExplanation;
  /** Treffer in der Wissensbasis (Richtlinie, Registrierung, Autopilot oder App) */
  intune?: KnowledgeEntry;
  installer?: (typeof INSTALLER_EXIT_CODES)[number];
  /** Kurztext für Kachel/Finding, z. B. "0x87D1FDE8 · Remediation failed" oder "Unbekannter Code" */
  label: string;
  docsUrl: string | null;
}

/**
 * Fehlercode beschreiben: Wissensbasis → Installer-Codes → generische Win32/WinHTTP/NTSTATUS-Deutung.
 * `context` schaltet Einträge frei, die nur in einem Kontext eindeutig sind (z. B. 0x800705B4 bei der
 * Registrierung); ohne Kontext werden nur eindeutige Codes gedeutet. Installer-Exitcodes gelten im
 * App-Kontext und ohne Kontext (bisheriges Verhalten der Richtlinien-Kachel), nicht bei der Registrierung.
 */
export function describeErrorCode(
  decimalOrHex: number | string,
  unknownLabel: string,
  context?: ErrorCodeContext,
): ErrorCodeDescription {
  const explanation = explainCode(decimalOrHex);
  const intune = findIntuneErrorCode(decimalOrHex, context);
  if (intune) return { explanation, intune, label: intune.title, docsUrl: intune.docsUrl };
  const installer =
    explanation.kind === 'win32' && context !== 'enrollment'
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
