/**
 * Extraktor: MDM-Enrollments aus dem Export von HKLM\Software\Microsoft\Enrollments.
 * AADTenantID und Push\ChannelURI werden NIE gelesen oder übernommen; die UPN nur maskiert.
 */
import { maskUpn } from '../../domain/format';
import type { EnrollmentInfo } from '../types';
import { getRegDword, getRegString, type RegKey } from './regExport';

const ENROLLMENT_KEY_RE = /\\Enrollments\\([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i;

/** Keyfilter für parseRegExport: nur Enrollment-Wurzelkeys (verwirft Push, DMClient usw.). */
export function isEnrollmentRootKey(path: string): boolean {
  return ENROLLMENT_KEY_RE.test(path);
}

function numeric(key: RegKey, name: string): number | null {
  const dword = getRegDword(key, name);
  if (dword !== null) return dword;
  const text = getRegString(key, name);
  if (text !== null && /^-?\d+$/.test(text.trim())) return Number(text);
  return null;
}

export function extractEnrollments(keys: RegKey[]): EnrollmentInfo[] {
  const result: EnrollmentInfo[] = [];
  for (const key of keys) {
    const id = ENROLLMENT_KEY_RE.exec(key.path)?.[1];
    if (!id) continue;
    const providerId = getRegString(key, 'ProviderID');
    const enrollmentState = numeric(key, 'EnrollmentState');
    // Echte Geräte haben Dutzende Enrollment-Keys ohne ProviderID (System-/Zertifikats-
    // Enrollments) – für MDM-Troubleshooting zählen nur Enrollments mit ProviderID.
    if (!providerId) continue;
    result.push({
      enrollmentId: id,
      providerId,
      enrollmentState,
      enrollmentType: numeric(key, 'EnrollmentType'),
      upnMasked: maskUpn(getRegString(key, 'UPN') || null),
    });
  }
  return result;
}
