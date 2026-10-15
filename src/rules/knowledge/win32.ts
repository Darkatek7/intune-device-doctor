/**
 * Generische Rückführung von HRESULTs auf Win32-/WinHTTP-/NTSTATUS-Codes (CLAUDE.md Regel 4).
 * Namen und Texte wörtlich von den verlinkten Microsoft-Learn-Seiten (System Error Codes,
 * WinHTTP Error Messages, MS-ERREF NTSTATUS). Unbekannte Codes werden nicht gedeutet.
 */
import { hexToSignedDecimal, hresultToHex, normalizeHex } from '../../domain/format';

const SYSTEM_ERROR_PAGES: Array<{ max: number; url: string }> = [
  { max: 499, url: 'https://learn.microsoft.com/windows/win32/debug/system-error-codes--0-499-' },
  { max: 999, url: 'https://learn.microsoft.com/windows/win32/debug/system-error-codes--500-999-' },
  {
    max: 1299,
    url: 'https://learn.microsoft.com/windows/win32/debug/system-error-codes--1000-1299-',
  },
  {
    max: 1699,
    url: 'https://learn.microsoft.com/windows/win32/debug/system-error-codes--1300-1699-',
  },
  {
    max: 3999,
    url: 'https://learn.microsoft.com/windows/win32/debug/system-error-codes--1700-3999-',
  },
  // Übersichtsseite für alle weiteren Bereiche
  { max: 65535, url: 'https://learn.microsoft.com/windows/win32/debug/system-error-codes' },
];

export const WINHTTP_ERRORS_URL =
  'https://learn.microsoft.com/windows/win32/winhttp/error-messages';
export const NTSTATUS_URL =
  'https://learn.microsoft.com/openspecs/windows_protocols/ms-erref/596a1078-e883-4972-9bbc-49e60bebca55';

/** Win32-Codes mit Namen + Originaltext (englisch, wörtlich von Microsoft Learn). */
const WIN32_NAMES: Record<number, { name: string; text: string }> = {
  1: { name: 'ERROR_INVALID_FUNCTION', text: 'Incorrect function.' },
  2: { name: 'ERROR_FILE_NOT_FOUND', text: 'The system cannot find the file specified.' },
  3: { name: 'ERROR_PATH_NOT_FOUND', text: 'The system cannot find the path specified.' },
  5: { name: 'ERROR_ACCESS_DENIED', text: 'Access is denied.' },
  1008: {
    name: 'ERROR_NO_TOKEN',
    text: 'An attempt was made to reference a token that does not exist.',
  },
  1168: { name: 'ERROR_NOT_FOUND', text: 'Element not found.' },
  1312: {
    name: 'ERROR_NO_SUCH_LOGON_SESSION',
    text: 'A specified logon session does not exist. It may already have been terminated.',
  },
  1602: { name: 'ERROR_INSTALL_USEREXIT', text: 'User cancelled installation.' },
  1603: { name: 'ERROR_INSTALL_FAILURE', text: 'Fatal error during installation.' },
  1618: {
    name: 'ERROR_INSTALL_ALREADY_RUNNING',
    text: 'Another installation is already in progress. Complete that installation before proceeding with this install.',
  },
  3010: {
    name: 'ERROR_SUCCESS_REBOOT_REQUIRED',
    text: 'The requested operation is successful. Changes will not be effective until the system is rebooted.',
  },
};

/** WinHTTP-Fehler (12xxx), wörtlich von der WinHTTP-Fehlerseite. */
const WINHTTP_NAMES: Record<number, { name: string; text: string }> = {
  12002: { name: 'ERROR_WINHTTP_TIMEOUT', text: 'The request has timed out.' },
  12007: { name: 'ERROR_WINHTTP_NAME_NOT_RESOLVED', text: 'The server name cannot be resolved.' },
  12029: {
    name: 'ERROR_WINHTTP_CANNOT_CONNECT',
    text: 'Returned if connection to the server failed.',
  },
  12030: {
    name: 'ERROR_WINHTTP_CONNECTION_ERROR',
    text: 'The connection with the server has been reset or terminated, or an incompatible SSL protocol was encountered.',
  },
  12167: {
    name: 'ERROR_WINHTTP_UNABLE_TO_DOWNLOAD_SCRIPT',
    text: 'The PAC file cannot be downloaded.',
  },
  12180: {
    name: 'ERROR_WINHTTP_AUTODETECTION_FAILED',
    text: 'Returned by WinHttpDetectAutoProxyConfigUrl if WinHTTP was unable to discover the URL of the Proxy Auto-Configuration (PAC) file.',
  },
};

/** NTSTATUS-Werte, wörtlich aus MS-ERREF. */
const NTSTATUS_NAMES: Record<string, { name: string; text: string }> = {
  '0xC000023C': {
    name: 'STATUS_NETWORK_UNREACHABLE',
    text: 'The remote network is not reachable by the transport.',
  },
  '0xC0000072': {
    name: 'STATUS_ACCOUNT_DISABLED',
    text: 'The referenced account is currently disabled and cannot be logged on to.',
  },
  '0xC000006D': {
    name: 'STATUS_LOGON_FAILURE',
    text: 'The attempted logon is invalid. This is either due to a bad username or authentication information.',
  },
};

export interface CodeExplanation {
  hex: string;
  decimal: number;
  /** 'win32' = HRESULT 0x8007xxxx bzw. reiner Win32-Code, 'winhttp', 'ntstatus' oder 'unknown' */
  kind: 'win32' | 'winhttp' | 'ntstatus' | 'unknown';
  /** Abgeleiteter Basiscode (z. B. 1602 bei 0x80070642) */
  baseCode: number | null;
  name: string | null;
  /** Originaltext (englisch) von Microsoft Learn */
  text: string | null;
  docsUrl: string | null;
}

export function systemErrorPageFor(code: number): string {
  return (SYSTEM_ERROR_PAGES.find((page) => code <= page.max) ?? SYSTEM_ERROR_PAGES.at(-1)!).url;
}

/**
 * Deutung eines Codes (signierte Dezimalzahl, Hex-String oder Win32-Code). Liefert nie erfundene
 * Texte: Für unbekannte Codes bleiben name/text null, nur Hex/Dezimal werden angezeigt.
 */
export function explainCode(input: number | string): CodeExplanation {
  let decimal: number | null;
  if (typeof input === 'number') {
    decimal = input | 0;
  } else {
    decimal = hexToSignedDecimal(input);
  }
  if (decimal === null) {
    return {
      hex: String(input),
      decimal: NaN,
      kind: 'unknown',
      baseCode: null,
      name: null,
      text: null,
      docsUrl: null,
    };
  }
  const hex = hresultToHex(decimal);
  const unsigned = decimal >>> 0;

  const nt = NTSTATUS_NAMES[hex];
  if (nt) return { hex, decimal, kind: 'ntstatus', baseCode: null, ...nt, docsUrl: NTSTATUS_URL };

  // HRESULT_FROM_WIN32: Facility 7 (0x8007xxxx) → untere 16 Bit = Win32-Code
  const isWin32Hresult = (unsigned & 0xffff0000) >>> 0 === 0x80070000;
  // Reine Win32-Codes (kleine positive Zahlen, z. B. Exit-Codes)
  const isPlainWin32 = unsigned > 0 && unsigned < 0x10000;
  if (isWin32Hresult || isPlainWin32) {
    const base = unsigned & 0xffff;
    const winhttp = WINHTTP_NAMES[base];
    if (winhttp)
      return {
        hex,
        decimal,
        kind: 'winhttp',
        baseCode: base,
        ...winhttp,
        docsUrl: WINHTTP_ERRORS_URL,
      };
    const win32 = WIN32_NAMES[base];
    return {
      hex,
      decimal,
      kind: 'win32',
      baseCode: base,
      name: win32?.name ?? null,
      text: win32?.text ?? null,
      docsUrl: systemErrorPageFor(base),
    };
  }
  return { hex, decimal, kind: 'unknown', baseCode: null, name: null, text: null, docsUrl: null };
}

/** Hex-String normalisieren oder unverändert zurückgeben. */
export function displayHex(value: string): string {
  return normalizeHex(value) ?? value;
}
