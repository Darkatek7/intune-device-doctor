/**
 * Content-Security-Policy des Produktions-Builds (vite.config.ts, cspPlugin; M16/S1):
 * Die Richtlinie ist gesetzt und blockiert in den Hauptabläufen nichts (Worker, Inline-Style-
 * Attribute von motion, Theme-Skript per Hash, ZIP-Analyse, Ansichten Mandant und Richtlinien).
 * Trusted Types sind erzwungen: HTML-/Skript-Strings und fremde Worker-URLs werden abgelehnt,
 * der eigene Worker läuft.
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

  test('Richtlinie gesetzt, keine Verstöße in allen Kernabläufen', async ({ page }) => {
    const consoleCsp: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (/Content Security Policy|Trusted Type/i.test(msg.text())) consoleCsp.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("style-src 'self';");
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
    expect(csp).not.toMatch(/style-src 'self' 'unsafe-inline'/);
    expect(csp).toContain("require-trusted-types-for 'script'");

    // Startseite → Gerät → Detail-Sheet
    await searchDevice(page, 'CONTOSO-PC042');
    await waitForTilesReady(page);
    await openTile(page, 'Richtlinien');
    await settleSheet(page);
    await page.keyboard.press('Escape');

    // Beispiel-ZIP (Web Worker)
    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(T.zipChip) }).click();
    await waitForTilesReady(page);

    // Ansicht „Mandant“
    await page.goto('/');
    await page.getByRole('button', { name: 'Mandant', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mandant' })).toBeVisible();
    await waitForTilesReady(page);

    // Ansicht „Richtlinien“ inkl. Unterseite
    await page.goto('/');
    await page.getByRole('button', { name: 'Richtlinien', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Richtlinien' })).toBeVisible();
    await page.getByTestId('policy-row').first().click();
    await expect(page.getByTestId('policy-status-row').first()).toBeVisible();

    const violations = await page.evaluate<string[]>('window.__cspViolations ?? []');
    expect(violations).toEqual([]);
    expect(consoleCsp).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Trusted Types: HTML/Skript-Strings und fremde Worker-URLs werden abgelehnt', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('combobox', { name: T.searchLabel })).toBeVisible();

    const result = await page.evaluate<Record<string, string>>(`(() => {
      const out = {};
      const attempt = (name, fn) => {
        try { fn(); out[name] = 'erlaubt'; } catch (e) { out[name] = 'abgelehnt:' + e.name; }
      };
      out.defaultPolicy = String(Boolean(window.trustedTypes && window.trustedTypes.defaultPolicy));
      attempt('innerHTML', () => { document.createElement('div').innerHTML = '<img src=x onerror=alert(1)>'; });
      attempt('fremderWorker', () => { new Worker('https://example.com/w.js').terminate(); });
      attempt('dataWorker', () => { new Worker('data:text/javascript,1').terminate(); });
      attempt('eigenerWorker', () => { new Worker('/assets/does-not-exist.js').terminate(); });
      return out;
    })()`);

    // eval läuft nur außerhalb des CDP-Auswertungskontexts unter der Seiten-CSP (dort ist es
    // ausgenommen), daher per Timer aus dem Seitenkontext.
    await page.evaluate(`setTimeout(() => {
      try { (0, eval)('1+1'); window.__evalResult = 'erlaubt'; }
      catch (e) { window.__evalResult = 'abgelehnt:' + e.name; }
    }, 0)`);
    await expect.poll(() => page.evaluate('window.__evalResult ?? ""')).toMatch(/^abgelehnt/);

    expect(result.defaultPolicy).toBe('true');
    expect(result.innerHTML).toMatch(/^abgelehnt/);
    expect(result.fremderWorker).toMatch(/^abgelehnt/);
    expect(result.dataWorker).toMatch(/^abgelehnt/);
    expect(result.eigenerWorker).toBe('erlaubt');
  });
});
