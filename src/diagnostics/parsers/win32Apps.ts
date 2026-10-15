/**
 * Extraktor: Win32-App-Zustände aus dem Export von HKLM\SOFTWARE\Microsoft\IntuneManagementExtension.
 * Pfad: …\Win32Apps\<UserOrDeviceId>\<AppGUID>_<Revision>[\<Unterkey>] mit Wert `Status`.
 */
import { hresultToHex } from '../../domain/format';
import type { Win32AppState } from '../types';
import { getRegValue, getRegString, type RegKey, type RegValue } from './regExport';

const APP_KEY_RE =
  /\\Win32Apps\\[^\\]+\\([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})_\d+(?:\\|$)/i;

/** Keyfilter für parseRegExport: nur Win32Apps-Keys. */
export function isWin32AppsKey(path: string): boolean {
  return /\\Win32Apps\\/i.test(path);
}

/** Höher = aussagekräftiger. Failed > InstalledPendingReboot > Installed > NotApplicable. */
const STATUS_RANK: Record<string, number> = {
  failed: 4,
  installedpendingreboot: 3,
  installed: 2,
  notapplicable: 1,
};

function rank(status: string | null): number {
  return status === null ? 0 : (STATUS_RANK[status.toLowerCase()] ?? 0);
}

function parseErrorCode(value: RegValue | undefined): number | null {
  let n: number;
  if (value?.kind === 'dword') n = value.value;
  else if (value?.kind === 'string' && /^-?\d+$/.test(value.value.trim())) n = Number(value.value);
  else return null;
  if (!Number.isFinite(n) || n > 0xffffffff || n < -0x80000000) return null;
  return n | 0;
}

interface Candidate {
  status: string | null;
  errorCode: number | null;
}

export function extractWin32Apps(keys: RegKey[]): Win32AppState[] {
  const best = new Map<string, Candidate>();
  /** Fallback: erster von 0 verschiedener ErrorCode irgendeines Keys der App */
  const fallbackError = new Map<string, number>();

  for (const key of keys) {
    const appId = APP_KEY_RE.exec(key.path)?.[1];
    if (!appId) continue;
    const status = getRegString(key, 'Status');
    const errorCode = parseErrorCode(getRegValue(key, 'ErrorCode'));
    if (errorCode !== null && errorCode !== 0 && !fallbackError.has(appId)) {
      fallbackError.set(appId, errorCode);
    }
    if (status === null || status === '') continue;
    const current = best.get(appId);
    if (!current || rank(status) > rank(current.status)) {
      best.set(appId, { status, errorCode });
    }
  }

  const apps: Win32AppState[] = [];
  for (const [appId, candidate] of best) {
    let code = candidate.errorCode;
    if ((code === null || code === 0) && candidate.status?.toLowerCase() === 'failed') {
      code = fallbackError.get(appId) ?? code;
    }
    const errorCode = code !== null && code !== 0 ? code : null;
    apps.push({
      appId,
      status: candidate.status,
      errorCodeDecimal: errorCode,
      errorCodeHex: errorCode === null ? null : hresultToHex(errorCode),
    });
  }
  return apps;
}
