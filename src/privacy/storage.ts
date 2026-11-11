/** Schalterzustand des Präsentationsmodus in localStorage – abgesichert wie `mdm-doctor.theme`. */
export const PRIVACY_STORAGE_KEY = 'mdm-doctor.privacy';

export function readStoredPrivacy(): boolean {
  try {
    return localStorage.getItem(PRIVACY_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeStoredPrivacy(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(PRIVACY_STORAGE_KEY, 'on');
    else localStorage.removeItem(PRIVACY_STORAGE_KEY);
  } catch {
    // Privater Modus o. ä.: Wahl gilt dann nur für diese Sitzung.
  }
}
