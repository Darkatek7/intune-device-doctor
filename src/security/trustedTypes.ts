/**
 * Trusted Types (M16/S1): Die Produktions-CSP setzt `require-trusted-types-for 'script'`
 * (vite.config.ts). Der App-Code hat keine DOM-XSS-Senken (kein innerHTML, eval, …); die einzigen
 * Senken, die zur Laufzeit auftreten, sind Worker-Skript-URLs (eigener Analyse-Worker). Diese
 * Default-Policy lässt deshalb ausschließlich Skript-URLs derselben Origin (http/https oder `blob:`
 * der eigenen Origin) durch und lehnt jeden HTML- und Skript-String ab.
 *
 * Details zur Untersuchung der Bibliotheken: docs/tasks/M16-haertung.md.
 */

/** Minimaler Ausschnitt der Trusted-Types-API (die TS-DOM-Typen enthalten sie nicht überall). */
export interface TrustedTypePolicyFactoryLike {
  defaultPolicy?: unknown;
  createPolicy(
    name: string,
    rules: {
      createHTML?: (input: string) => string | null | undefined;
      createScript?: (input: string) => string | null | undefined;
      createScriptURL?: (input: string) => string | null | undefined;
    },
  ): unknown;
}

/** Erlaubt nur Skript-URLs der eigenen Origin; alles andere → `null` (Senke wirft TypeError). */
export function sameOriginScriptUrl(input: string, origin: string, base: string): string | null {
  let url: URL;
  try {
    url = new URL(input, base);
  } catch {
    return null;
  }
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    return url.origin === origin ? input : null;
  }
  if (url.protocol === 'blob:') {
    // URL.origin eines blob:-URLs ist die Origin des Erzeugers.
    return url.origin === origin ? input : null;
  }
  return null;
}

/**
 * Registriert die Default-Policy, sofern Trusted Types verfügbar sind und noch keine existiert.
 * Liefert `true`, wenn die Policy hier angelegt wurde.
 */
export function installDefaultTrustedTypesPolicy(
  factory: TrustedTypePolicyFactoryLike | undefined,
  origin: string,
  base: string,
): boolean {
  if (!factory || factory.defaultPolicy) return false;
  try {
    factory.createPolicy('default', {
      createHTML: () => null,
      createScript: () => null,
      createScriptURL: (input) => sameOriginScriptUrl(input, origin, base),
    });
    return true;
  } catch {
    // Die CSP verbietet den Namen „default“ (trusted-types-Direktive) – dann gilt deren Liste.
    return false;
  }
}
