/**
 * Gemeinsame E2E-Helfer (Demo-Modus, Chromium).
 *
 * - `test` erweitert Playwrights `test` um eine automatische Netzwerk-Sperre: Alles außerhalb
 *   von localhost wird abgebrochen und protokolliert; schreibende Anfragen an localhost ebenso.
 *   Nach jedem Test muss das Protokoll leer sein.
 * - Texte stehen bewusst als Strings hier (kein Import aus src/i18n – Vite-Aliase/ESM).
 *   Quelle der Texte: src/i18n/de.ts und src/i18n/de-rules.ts.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { test as base, expect, type Locator, type Page, type TestInfo } from '@playwright/test';

export { expect };

/** Texte der Oberfläche (src/i18n/de.ts) */
export const T = {
  searchLabel: 'Gerätename',
  notFoundTitle: 'Kein Gerät gefunden',
  pickerTitle: 'Mehrere Geräte gefunden',
  pickerList: 'Gefundene Geräte',
  statusTiles: 'Statuskacheln',
  loading: 'Wird geladen …',
  heroTitle: 'Intune-Geräte in Sekunden diagnostizieren',
  close: 'Schließen',
  zipChip: 'Beispiel-ZIP analysieren',
  zipMerge: 'Mit Intune-Daten zusammenführen',
  finding: 'Befund',
  cause: 'Ursache',
  remediation: 'Lösung',
  source: 'Quelle',
  allGood: 'Alles in Ordnung',
  ok: 'In Ordnung',
  warning: 'Prüfen',
  critical: 'Problem',
  forbidden: 'Fehlende Berechtigung',
  forbiddenBadge: 'Kein Zugriff',
  notApplicable: 'Nicht anwendbar',
} as const;

/** Die sieben Standard-Kacheln eines Windows-Geräts (Reihenfolge = TILE_ORDER, ohne ZIP-Kacheln) */
export const BASE_TILE_TITLES = [
  'Gerätestatus',
  'Compliance',
  'Letzter Check-in',
  'Betriebssystem',
  'BitLocker',
  'Defender',
  'Richtlinien',
] as const;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface NetworkLog {
  /** Abgebrochene Anfragen an fremde Hosts, Format „METHOD URL“ */
  blocked: string[];
  /** Abgebrochene Nicht-GET-Anfragen oder Anfragen mit Body an localhost */
  unsafe: string[];
}

/**
 * Test mit Netzwerk-Sperre. Die Fixture ist `auto`, gilt also für jede Spec ohne Zutun.
 * Fremde Hosts (z. B. graph.microsoft.com, login.microsoftonline.com) werden abgebrochen.
 */
export const test = base.extend<{ network: NetworkLog }>({
  network: [
    async ({ page }, use) => {
      const log: NetworkLog = { blocked: [], unsafe: [] };

      await page.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const label = `${request.method()} ${request.url()}`;

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          await route.fallback();
          return;
        }
        if (!LOCAL_HOSTS.has(url.hostname)) {
          log.blocked.push(label);
          await route.abort();
          return;
        }
        if (request.method() !== 'GET' || request.postDataBuffer() !== null) {
          log.unsafe.push(label);
          await route.abort();
          return;
        }
        await route.continue();
      });

      await use(log);

      // soft: beide Prüfungen laufen durch, damit im Fehlerfall beide Befunde sichtbar sind.
      expect.soft(log.blocked, 'Anfragen an fremde Hosts').toEqual([]);
      expect.soft(log.unsafe, 'Nicht-GET-Anfragen oder Body-Anfragen an localhost').toEqual([]);
    },
    { auto: true },
  ],
});

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Sucht über das Suchfeld (Rolle combobox, Name „Gerätename“) und bestätigt mit Enter. */
export async function searchDevice(page: Page, query: string): Promise<void> {
  const field = page.getByRole('combobox', { name: T.searchLabel });
  await field.fill(query);
  await field.press('Enter');
}

/** Startseite öffnen, Gerät suchen und auf fertig geladene Kacheln warten. */
export async function openDevice(page: Page, query: string): Promise<void> {
  await page.goto('/');
  await searchDevice(page, query);
  await waitForTilesReady(page);
}

/** Kachel-Button über den Anfang seines Namens (Titel steht am Anfang des accessible name). */
export function tile(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^${escapeRegExp(title)}`) });
}

/** Alle Kachel-Buttons der Ansicht (Skeletons zählen nicht). */
export function tileButtons(page: Page): Locator {
  return page.locator('button[data-tile-id]');
}

/** Wartet, bis keine Platzhalter (aria-busy) und keine Ladetexte mehr sichtbar sind. */
export async function waitForTilesReady(page: Page): Promise<void> {
  await expect(tileButtons(page).first()).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByText(T.loading, { exact: true })).toHaveCount(0);
}

/** Öffnet das Detail-Sheet einer Kachel per Klick und liefert den Dialog. */
export async function openTile(page: Page, title: string): Promise<Locator> {
  await tile(page, title).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Opacity von Sheet und Sheet-Inhalt als „panel|inhalt“ (leer, wenn kein Dialog offen ist). */
const SHEET_OPACITY_SCRIPT = `(() => {
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return '';
  const content = dialog.firstElementChild;
  const contentOpacity = content ? getComputedStyle(content).opacity : '';
  return getComputedStyle(dialog).opacity + '|' + contentOpacity;
})()`;

/**
 * Lässt Motion-Animationen (Feder, Ein-/Ausblenden) zur Ruhe kommen.
 * Motion nutzt JS-Animationen, daher Opacity-Abfrage plus kurze Pause.
 */
export async function settleSheet(page: Page): Promise<void> {
  await expect
    .poll(() =>
      // String statt Funktion: tsconfig.node.json hat kein DOM-Lib, Browser-Globals wären Typfehler.
      page.evaluate(SHEET_OPACITY_SCRIPT),
    )
    .toBe('1|1');
  await page.waitForTimeout(700);
}

/**
 * Tab drücken, bis die Kachel mit dem Titel den Fokus hat (Tab-Reihenfolge vor den Kacheln
 * ist nicht fest: Kopfzeilen-Buttons kommen davor). Vergleich über data-tile-id.
 */
export async function tabToTile(page: Page, title: string, maxPresses = 60): Promise<void> {
  const card = tile(page, title);
  const tileId = await card.getAttribute('data-tile-id');
  const isFocused = `document.activeElement?.getAttribute('data-tile-id') === ${JSON.stringify(tileId)}`;
  for (let i = 0; i < maxPresses; i++) {
    if (await page.evaluate(isFocused)) return;
    await page.keyboard.press('Tab');
  }
  await expect(card).toBeFocused();
}

/**
 * Status-Badge einer Kachel. Der Badge-Text kann auch als Kachelwert vorkommen (z. B. „Nicht
 * anwendbar“); der Badge steht im Kopf der Kachel und damit in DOM-Reihenfolge vor dem Wert.
 */
export function statusBadge(card: Locator, text: string): Locator {
  return card.getByText(text, { exact: true }).first();
}

/** Screenshot nach e2e-artifacts/<projekt>/<name>.png (relativ zum Arbeitsverzeichnis = Repo-Wurzel). */
export async function screenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const dir = path.resolve('e2e-artifacts', testInfo.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: path.join(dir, `${name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}
