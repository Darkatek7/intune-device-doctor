import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, settleSheet, tile, tileButtons, test, waitForTilesReady } from './helpers';

/** Ansicht „Empfehlungen“ (M21/S4): Demo-Modus, Texte aus src/i18n/de-posture.ts. */
async function expectNoSevereViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const mismatch = await new AxeBuilder({ page })
    .withRules(['label-content-name-mismatch'])
    .analyze();
  const all = [
    ...results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ...mismatch.violations,
  ];
  const details = all
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
    .join('\n');
  expect(all, `a11y-Verstöße bei „${label}“:\n${details}`).toEqual([]);
}

test.describe('Ansicht „Empfehlungen“', () => {
  test('Navigation öffnet die Ansicht mit zwölf Kacheln und Gesamtbild', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('button', { name: 'Empfehlungen', exact: true })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Empfehlungen' })).toBeVisible();
    await expect(page).toHaveURL(/view=recommendations/);
    await expect(tileButtons(page)).toHaveCount(12);
    await expect(page.getByTestId('posture-score')).toContainText(
      /\d+ von \d+ Empfehlungen erfüllt/,
    );
    await expect(page.getByRole('img', { name: /Anteil der Empfehlungen/ })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Grundlagen' })).toBeVisible();
  });

  test('Stufenwahl per Tastatur schreibt level in die URL', async ({ page }) => {
    await page.goto('/?view=recommendations&mode=demo');
    await waitForTilesReady(page);
    const group = page.getByRole('radiogroup', { name: 'Stufe der Empfehlungen' });
    await expect(group.getByRole('radio', { name: /Stufe 2/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await group.getByRole('radio', { name: /Stufe 2/ }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/level=3/);
    await expect(group.getByRole('radio', { name: /Stufe 3/ })).toBeFocused();
    await expect(group.getByRole('radio', { name: /Stufe 3/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.keyboard.press('ArrowLeft');
    await expect(page).not.toHaveURL(/level=/);
  });

  test('Detail-Sheet zeigt Tabelle und Learn-Link; Escape schließt', async ({ page }) => {
    await page.goto('/?view=recommendations&mode=demo');
    await waitForTilesReady(page);
    await tile(page, 'Compliance: Windows').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await settleSheet(page);
    await expect(dialog.getByRole('table').first()).toBeVisible();
    await expect(dialog.locator('a[href^="https://learn.microsoft.com"]').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(tile(page, 'Compliance: Windows')).toBeFocused();
  });

  test('Barrierefreiheit: Ansicht und Detail-Sheet ohne schwere axe-Verstöße', async ({ page }) => {
    await page.goto('/?view=recommendations&mode=demo');
    await waitForTilesReady(page);
    await expectNoSevereViolations(page, 'Empfehlungen');
    await tile(page, 'App-Schutz: Android').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await settleSheet(page);
    await expectNoSevereViolations(page, 'Empfehlungen – Detail-Sheet');
  });

  test('keine horizontale Scrollleiste der Seite (auch mobil, auch mit offenem Sheet)', async ({
    page,
  }) => {
    const overflow = () =>
      page.evaluate<number>(
        'document.documentElement.scrollWidth - document.documentElement.clientWidth',
      );
    await page.goto('/?view=recommendations&mode=demo');
    await waitForTilesReady(page);
    expect(await overflow()).toBeLessThanOrEqual(0);
    // Hauptnavigation: kein Eintrag wird abgeschnitten
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
    expect(await nav.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);

    await tile(page, 'Compliance: Windows').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await settleSheet(page);
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
});
