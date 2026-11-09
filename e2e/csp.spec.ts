/**
 * Content-Security-Policy des Produktions-Builds (vite.config.ts, cspPlugin):
 * Die Richtlinie ist gesetzt und blockiert in den Hauptabläufen nichts (Worker, Inline-Styles von
 * motion, Theme-Skript per Hash, ZIP-Analyse).
 */
import { T, expect, openTile, searchDevice, settleSheet, test, waitForTilesReady } from './helpers';

/** Als String, weil die E2E-Typkonfiguration keine DOM-Typen enthält. */
const COLLECT_VIOLATIONS = `
  window.__cspViolations = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    window.__cspViolations.push(e.effectiveDirective + ' ' + e.blockedURI);
  });
`;

test.describe('Content-Security-Policy', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript({ content: COLLECT_VIOLATIONS });
  });

  test('Richtlinie gesetzt, keine Verstöße in Suche, Detail-Sheet und ZIP-Analyse', async ({
    page,
  }) => {
    const consoleCsp: string[] = [];
    page.on('console', (msg) => {
      if (/Content Security Policy/i.test(msg.text())) consoleCsp.push(msg.text());
    });

    await page.goto('/');
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");

    await searchDevice(page, 'CONTOSO-PC042');
    await waitForTilesReady(page);
    await openTile(page, 'Richtlinien');
    await settleSheet(page);
    await page.keyboard.press('Escape');

    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(T.zipChip) }).click();
    await waitForTilesReady(page);

    const violations = await page.evaluate<string[]>('window.__cspViolations ?? []');
    expect(violations).toEqual([]);
    expect(consoleCsp).toEqual([]);
  });
});
