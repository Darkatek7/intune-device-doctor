/**
 * Stand und Quellen der Sollwerte der Ansicht „Empfehlungen“.
 *
 * Die Sollwerte der Frameworks (Compliance, App-Schutz, Zero Trust) sind **Daten in dieser App** – jede
 * mit der Learn-Seite, die genau diesen Wert nennt. Sie ändern sich nur mit einer neuen App-Version.
 * Live von Microsoft kommen dagegen bei jedem Laden: die Konfiguration des Mandanten, die Secure-Score-
 * Empfehlungen und die Baseline-Vorlagen samt Versionsstand.
 *
 * `POSTURE_CATALOG_VERIFIED_ON` ist der Tag, an dem die Sollwerte zuletzt gegen die Learn-Seiten geprüft
 * wurden. Ob sich eine Quellseite seither geändert hat, prüft `npm run posture:sources` (wöchentlich in
 * der CI); erst nach erneuter Prüfung der Werte wird das Datum angehoben.
 */
import { Docs } from '../knowledge/docs';

/** ISO-Datum (UTC) der letzten Prüfung der Sollwerte gegen Microsoft Learn. */
export const POSTURE_CATALOG_VERIFIED_ON = '2026-11-25';

/** Ab diesem Alter weist die Ansicht darauf hin, dass die App-Version aktualisiert werden sollte. */
export const POSTURE_CATALOG_STALE_AFTER_DAYS = 180;

const MS_PER_DAY = 86_400_000;

/** Alter der Sollwerte in ganzen Tagen (nie negativ). */
export function postureCatalogAgeDays(now: Date): number {
  const verified = Date.parse(`${POSTURE_CATALOG_VERIFIED_ON}T00:00:00Z`);
  return Math.max(0, Math.floor((now.getTime() - verified) / MS_PER_DAY));
}

export function isPostureCatalogStale(now: Date): boolean {
  return postureCatalogAgeDays(now) > POSTURE_CATALOG_STALE_AFTER_DAYS;
}

/** Ein Verweis der Wissensbasis, der zur Ansicht „Empfehlungen“ gehört. */
export interface PostureSourceLink {
  /** Schlüssel in `Docs` (beginnt mit `posture`) */
  key: string;
  url: string;
  /** Seite ohne Sprungmarke */
  page: string;
  /** Sprungmarke ohne `#`; null = Verweis auf die ganze Seite */
  fragment: string | null;
}

/** Alle Learn-Verweise der Ansicht (Schlüssel `posture…` der Wissensbasis). */
export function postureSourceLinks(): PostureSourceLink[] {
  return Object.entries(Docs)
    .filter(([key]) => key.startsWith('posture'))
    .map(([key, url]) => {
      const hash = url.indexOf('#');
      return {
        key,
        url,
        page: hash === -1 ? url : url.slice(0, hash),
        fragment: hash === -1 ? null : url.slice(hash + 1),
      };
    });
}

/** Die Learn-Seiten hinter den Verweisen – jede einmal, sortiert. */
export function postureSourcePages(): string[] {
  return [...new Set(postureSourceLinks().map((link) => link.page))].sort();
}
