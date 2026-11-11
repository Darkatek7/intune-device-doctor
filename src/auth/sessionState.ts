/**
 * Sitzungs-Merker des Live-Modus (M16/S2) in `sessionStorage` (endet mit dem Tab, wie der
 * MSAL-Token-Cache) plus ein kleiner Benachrichtigungskanal für die lokale Abmeldung.
 * Jeder Speicherzugriff ist abgesichert (Privatmodus/gesperrter Speicher → Merker fehlen).
 */

const IDLE_KEY = 'mdm-doctor.idleLogout';
const FORCE_LOGIN_KEY = 'mdm-doctor.forceLogin';

function write(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Speicher nicht verfügbar – der Hinweis entfällt, die Abmeldung selbst bleibt wirksam.
  }
}

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function remove(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // nichts zu tun
  }
}

/** Merkt eine Abmeldung wegen Inaktivität: Hinweis anzeigen und nächste Anmeldung erzwingen. */
export function markIdleSignOut(minutes: number): void {
  write(IDLE_KEY, String(minutes));
  write(FORCE_LOGIN_KEY, '1');
}

/** Minuten der letzten Inaktivitäts-Abmeldung dieser Sitzung (für den Hinweis), sonst `null`. */
export function readIdleSignOutMinutes(): number | null {
  const raw = read(IDLE_KEY);
  if (raw === null || !/^\d{1,4}$/.test(raw)) return null;
  return Number(raw);
}

/** Nach Inaktivität muss die nächste Anmeldung erneut authentifizieren (`prompt: 'login'`). */
export function shouldForceLogin(): boolean {
  return read(FORCE_LOGIN_KEY) === '1';
}

/** Nach erfolgreicher Anmeldung: Hinweis und Erzwingung zurücksetzen. */
export function clearIdleSignOutMarkers(): void {
  remove(IDLE_KEY);
  remove(FORCE_LOGIN_KEY);
}

type Listener = () => void;
const localSignOutListeners = new Set<Listener>();

/** MSAL meldet `clearCache()` nicht per Ereignis – die Auth-Ansicht abonniert deshalb hier. */
export function subscribeLocalSignOut(listener: Listener): () => void {
  localSignOutListeners.add(listener);
  return () => localSignOutListeners.delete(listener);
}

export function notifyLocalSignOut(): void {
  for (const listener of [...localSignOutListeners]) listener();
}
