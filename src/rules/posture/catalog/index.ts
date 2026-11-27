/** Alle Kataloge der Ansicht „Empfehlungen“ (Daten, getrennt von der Auswertungslogik). */
import type { PostureFramework } from '../types';
import { APP_PROTECTION_ANDROID, APP_PROTECTION_IOS } from './appProtection';
import {
  ANDROID_FULLY_MANAGED_COMPLIANCE,
  ANDROID_WORK_PROFILE_COMPLIANCE,
  IOS_COMPLIANCE,
  WINDOWS_COMPLIANCE,
} from './compliance';

export { APP_PROTECTION_ANDROID, APP_PROTECTION_IOS } from './appProtection';
export {
  ANDROID_FULLY_MANAGED_COMPLIANCE,
  ANDROID_WORK_PROFILE_COMPLIANCE,
  IOS_COMPLIANCE,
  WINDOWS_COMPLIANCE,
} from './compliance';

export const ALL_FRAMEWORKS: readonly PostureFramework[] = [
  WINDOWS_COMPLIANCE,
  IOS_COMPLIANCE,
  ANDROID_WORK_PROFILE_COMPLIANCE,
  ANDROID_FULLY_MANAGED_COMPLIANCE,
  APP_PROTECTION_IOS,
  APP_PROTECTION_ANDROID,
];
