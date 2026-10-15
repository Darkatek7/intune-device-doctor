import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { T, expect, openDevice, openTile, settleSheet, test } from './helpers';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

/** Scannt die Seite und schlägt fehl bei serious/critical-Verstößen (id und Ziel im Fehlertext). */
async function expectNoSevereViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const severe = results.violations.filter(
    (violation) => violation.impact && BLOCKING_IMPACTS.has(violation.impact),
  );
  const details = severe
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.nodes
          .map((node) => node.target.join(' '))
          .join(' | ')}`,
    )
    .join('\n');
  expect(severe, `Schwere a11y-Verstöße bei „${label}“:\n${details}`).toEqual([]);
}

test.describe('Barrierefreiheit (WCAG 2.1 AA, axe)', () => {
  test('Startseite', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: T.heroTitle })).toBeVisible();
    await expectNoSevereViolations(page, 'Startseite');
  });

  test('Dashboard CONTOSO-PC042', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC042');
    await expectNoSevereViolations(page, 'Dashboard PC042');
  });

  test('offenes Detail-Sheet (CONTOSO-PC042, Richtlinien)', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC042');
    await openTile(page, 'Richtlinien');
    await settleSheet(page);
    await expectNoSevereViolations(page, 'Detail-Sheet PC042');
  });
});
