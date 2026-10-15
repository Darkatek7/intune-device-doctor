/**
 * PRT-Fehlercodes aus dsregcmd ("Attempt Status"). Nur Codes, die auf
 * "Troubleshoot primary refresh token issues on Windows devices" stehen – mit Abschnitts-Anker.
 * https://learn.microsoft.com/entra/identity/devices/troubleshoot-primary-refresh-token
 */
import { normalizeHex } from '../../domain/format';

const PRT_URL =
  'https://learn.microsoft.com/entra/identity/devices/troubleshoot-primary-refresh-token';
const STATUS_ANCHOR = `${PRT_URL}#status-codes-status_-prefix-codes-that-begin-with-0xc000`;
const CLOUDAP_ANCHOR = `${PRT_URL}#common-cloudap-plug-in-error-codes-aad_cloudap_e_-prefix-codes-that-begin-with-0xc004`;

export interface PrtErrorEntry {
  hex: string;
  name: string;
  title: string;
  cause: string;
  remediation: string[];
  docsUrl: string;
}

const NETWORK_REMEDIATION = [
  'Netzwerkzugriff des Geräts auf die Microsoft-Entra-Endpunkte (z. B. login.microsoftonline.com) prüfen – DNS, Firewall, Proxy.',
  'Bei ausgehendem Proxy: sicherstellen, dass das Computerkonto den Proxy finden und sich still authentifizieren kann.',
  'Am Gerät die Ereignisanzeige „Anwendungs- und Dienstprotokolle › Microsoft › Windows › AAD“ auswerten (Operational: Events 1081/1088/1084, Analytic: 1022) – dort stehen Server-Fehlercode und URL.',
];

export const PRT_ERRORS: PrtErrorEntry[] = [
  ...(['0xC000023C', '0xC00000BE', '0xC00000C4'] as const).map((hex) => ({
    hex,
    name: {
      '0xC000023C': 'STATUS_NETWORK_UNREACHABLE',
      '0xC00000BE': 'STATUS_BAD_NETWORK_PATH',
      '0xC00000C4': 'STATUS_UNEXPECTED_NETWORK_ERROR',
    }[hex],
    title: 'Netzwerkproblem beim PRT-Abruf',
    cause:
      'Laut Microsoft besteht ein Netzwerkproblem zu einem benötigten Endpunkt, oder das Gerät hat eine 4xx-Antwort vom Entra-Authentifizierungsdienst bzw. einem WS-Trust-Endpunkt erhalten.',
    remediation: NETWORK_REMEDIATION,
    docsUrl: STATUS_ANCHOR,
  })),
  ...(['0xC000006D', '0xC000006A'] as const).map((hex) => ({
    hex,
    name: hex === '0xC000006D' ? 'STATUS_LOGON_FAILURE' : 'STATUS_WRONG_PASSWORD',
    title: 'Anmeldung beim PRT-Abruf fehlgeschlagen',
    cause:
      'Das Gerät erreicht den Entra-Authentifizierungsdienst nicht, oder der Dienst bzw. ein WS-Trust-Endpunkt antwortet mit „400 Bad Request“.',
    remediation: [
      'Proxy-Authentifizierung des Computerkontos prüfen.',
      'Server-Fehlercode (AADSTS…) aus Event 1081 bzw. 1088 im AAD-Operational-Log nachschlagen.',
    ],
    docsUrl: STATUS_ANCHOR,
  })),
  {
    hex: '0xC00000D0',
    name: 'STATUS_REQUEST_NOT_ACCEPTED',
    title: 'PRT-Anfrage abgelehnt',
    cause:
      'Das Gerät hat vom Entra-Authentifizierungsdienst oder einem WS-Trust-Endpunkt „400 Bad Request“ erhalten.',
    remediation: [
      'Server-Fehlercode (AADSTS…) aus den AAD-Ereignisprotokollen (Event 1081/1088) auswerten.',
    ],
    docsUrl: STATUS_ANCHOR,
  },
  {
    hex: '0xC000005F',
    name: 'STATUS_NO_SUCH_LOGON_SESSION',
    title: 'Benutzerdomäne nicht gefunden',
    cause:
      'Die Realm-Erkennung ist fehlgeschlagen, weil der Entra-Dienst die Domäne des UPN nicht kennt.',
    remediation: [
      'UPN-Domäne als benutzerdefinierte Domäne in Microsoft Entra ID hinzufügen.',
      'Bei nicht routbarer Domäne (z. B. .local): Alternate Login ID konfigurieren.',
    ],
    docsUrl: STATUS_ANCHOR,
  },
  {
    hex: '0xC004844C',
    name: 'AAD_CLOUDAP_E_OAUTH_USERNAME_IS_MALFORMED',
    title: 'UPN hat ein ungültiges Format',
    cause: 'Der UPN des Benutzers hat nicht das erwartete Format.',
    remediation: [
      'UPN als Internet-Style-Namen setzen; bei Hybrid-Geräten mit `whoami /upn` prüfen.',
    ],
    docsUrl: CLOUDAP_ANCHOR,
  },
  {
    hex: '0xC0048442',
    name: 'AAD_CLOUDAP_E_OAUTH_USER_SID_IS_EMPTY',
    title: 'Benutzer-SID fehlt im ID-Token',
    cause: 'Im vom Entra-Dienst gelieferten ID-Token fehlt die Benutzer-SID.',
    remediation: ['Prüfen, ob ein Proxy die Serverantwort verändert.'],
    docsUrl: CLOUDAP_ANCHOR,
  },
];

export function findPrtError(code: string | null | undefined): PrtErrorEntry | undefined {
  const hex = normalizeHex(code);
  if (!hex) return undefined;
  return PRT_ERRORS.find((entry) => entry.hex === hex);
}
