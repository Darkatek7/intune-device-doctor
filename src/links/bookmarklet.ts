/**
 * Lesezeichen „In MDM Doctor öffnen“ (M12/B4).
 *
 * Das Bookmarklet läuft auf der Intune-Seite (nicht in der App), liest ausschließlich `location.href`
 * und öffnet `<App-URL>?device=<id>&mode=live` in einem neuen Tab. Es greift nicht auf Inhalte der
 * Seite zu und sendet nichts. Die Muster entsprechen den Direktlinks in `intunePortal.ts`
 * (`mdmDeviceId/{id}`, `managedDeviceId/{id}`).
 */

/** Geräte-ID (GUID) hinter `mdmDeviceId/` bzw. `managedDeviceId/` in der Portal-URL. */
const DEVICE_ID_SOURCE =
  '(?:mdmDeviceId|managedDeviceId)\\/([0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})';

/** Liest die Intune-Geräte-ID aus einer Portal-URL; null, wenn keine enthalten ist. */
export function parseDeviceIdFromPortalUrl(href: string): string | null {
  const match = new RegExp(DEVICE_ID_SOURCE, 'i').exec(href);
  return match?.[1]?.toLowerCase() ?? null;
}

/** App-URL ohne Query/Hash: aktuelle Origin + Base-Pfad (z. B. https://host/mdm-doctor/). */
export function appBaseUrl(origin: string, baseUrl: string): string {
  const base = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;
  return `${origin}${base.endsWith('/') ? base : `${base}/`}`;
}

/** Link zum Öffnen eines Live-Geräts in der App. */
export function appDeviceUrl(appUrl: string, deviceId: string): string {
  return `${appUrl}?device=${encodeURIComponent(deviceId)}&mode=live`;
}

/** JS-Zeichenkette in einfachen Anführungszeichen; vermeidet `%`, `"` und Zeilenumbrüche. */
function jsString(text: string): string {
  return `'${text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/[\r\n]+/g, ' ')
    .replace(/%/g, '\\x25')
    .replace(/"/g, '\\x22')}'`;
}

/**
 * Baut den `javascript:`-Code. `message` wird per alert() gezeigt, wenn die aktuelle Seite keine
 * Geräte-ID enthält.
 */
export function buildBookmarklet(appUrl: string, message: string): string {
  const body =
    `var m=/${DEVICE_ID_SOURCE}/i.exec(location.href);` +
    `if(m){window.open(${jsString(appUrl)}+'?device='+m[1]+'&mode=live','_blank','noopener')}` +
    `else{alert(${jsString(message)})}`;
  return `javascript:(function(){${body}})()`;
}
