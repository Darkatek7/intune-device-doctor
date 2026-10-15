/**
 * Extraktor: Win32-App-Zustände aus dem Export von HKLM\SOFTWARE\Microsoft\IntuneManagementExtension.
 * Echte Archive: …\SideCarPolicies\StatusServiceReports\<UserOrDeviceId>\<AppGUID> mit den Werten
 * `AppId`, `Status` (Installed, Failed, NotApplicable …) und `ErrorCode` (signierte Dezimal-HRESULT).
 * Zusätzlich …\Win32Apps\<UserOrDeviceId>\<AppGUID>_<Revision>[\<Unterkey>] (ErrorCode-Fallback).
 */
import { hresultToHex } from '../../domain/format';
import type { Win32AppState } from '../types';
import { getRegValue, getRegString, type RegKey, type RegValue } from './regExport';

const GUID = '[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';
const APP_KEY_RE = new RegExp(`\\\\Win32Apps\\\\[^\\\\]+\\\\(${GUID})_\\d+(?:\\\\|$)`, 'i');
const STATUS_REPORT_KEY_RE = new RegExp(
  `\\\\SideCarPolicies\\\\StatusServiceReports\\\\[^\\\\]+\\\\(${GUID})$`,
  'i',
);

/** Keyfilter für parseRegExport: Win32Apps- und StatusServiceReports-Keys. */
export function isWin32AppsKey(path: string): boolean {
  return /\\(?:Win32Apps|SideCarPolicies\\StatusServiceReports)\\/i.test(path);
}

function appIdOf(key: RegKey): string | undefined {
  const reported = STATUS_REPORT_KEY_RE.exec(key.path)?.[1];
  if (reported) return getRegString(key, 'AppId') || reported;
  return APP_KEY_RE.exec(key.path)?.[1];
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
  appId: string;
  status: string | null;
  errorCode: number | null;
}

export function extractWin32Apps(keys: RegKey[]): Win32AppState[] {
  /** Schlüssel: App-GUID in Kleinschreibung (StatusServiceReports und Win32Apps schreiben sie unterschiedlich). */
  const best = new Map<string, Candidate>();
  /** Fallback: erster von 0 verschiedener ErrorCode irgendeines Keys der App */
  const fallbackError = new Map<string, number>();

  for (const key of keys) {
    const appId = appIdOf(key);
    if (!appId) continue;
    const id = appId.toLowerCase();
    const status = getRegString(key, 'Status');
    const errorCode = parseErrorCode(getRegValue(key, 'ErrorCode'));
    if (errorCode !== null && errorCode !== 0 && !fallbackError.has(id)) {
      fallbackError.set(id, errorCode);
    }
    if (status === null || status === '') continue;
    const current = best.get(id);
    if (!current || rank(status) > rank(current.status)) {
      best.set(id, { appId: current?.appId ?? appId, status, errorCode });
    }
  }

  const apps: Win32AppState[] = [];
  for (const [id, candidate] of best) {
    let code = candidate.errorCode;
    if ((code === null || code === 0) && candidate.status?.toLowerCase() === 'failed') {
      code = fallbackError.get(id) ?? code;
    }
    const errorCode = code !== null && code !== 0 ? code : null;
    apps.push({
      appId: candidate.appId,
      status: candidate.status,
      errorCodeDecimal: errorCode,
      errorCodeHex: errorCode === null ? null : hresultToHex(errorCode),
    });
  }
  return apps;
}
