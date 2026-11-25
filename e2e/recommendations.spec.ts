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

  test('Detail-Sheet: Liste „Alle Empfehlungen“ mit Filter und Learn-Link je Zeile', async ({
    page,
  }) => {
    await page.goto('/?view=recommendations&mode=demo');
    await waitForTilesReady(page);
    await tile(page, 'Compliance: Windows').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await settleSheet(page);
    const list = dialog.getByTestId('posture-check-list');
    await list.scrollIntoViewIfNeeded();
    await expect(list.getByRole('heading', { name: 'Alle Empfehlungen' })).toBeVisible();
    const rows = list.getByTestId('posture-check');
    await expect(rows.first()).toBeVisible();
    const deviating = await rows.count();

    await list.getByRole('radio', { name: /^Alle/ }).click();
    await expect(rows).not.toHaveCount(deviating);
    await expect(list.locator('[data-status="met"]').first()).toBeVisible();
    await list.getByRole('radio', { name: /^Erfüllt/ }).click();
    expect(await list.locator('[data-status="deviating"]').count()).toBe(0);

    const link = rows.first().getByRole('link', { name: /^Quelle auf Microsoft Learn: / });
    await expect(link).toHaveAttribute('href', /^https:\/\/learn\.microsoft\.com\//);
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('Export-Knopf lädt eine CSV-Datei herunter', async ({ page }) => {
    await page.goto('/?view=recommendations&mode=demo');
    await waitForTilesReady(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportieren (CSV)' }).click();
    expect((await download).suggestedFilename()).toMatch(
      /^mdm-doctor-empfehlungen-stufe-2-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });

  test('Barrierefreiheit und kein horizontales Scrollen mit geöffneter Liste (390 px)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?view=recommendations&mode=demo');
    await waitForTilesReady(page);
    await tile(page, 'Compliance: Windows').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await settleSheet(page);
    const list = dialog.getByTestId('posture-check-list');
    await list.getByRole('radio', { name: /^Alle/ }).click();
    await expectNoSevereViolations(page, 'Empfehlungen – Liste „Alle Empfehlungen“');
    const overflow = await page.evaluate<number>(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    );
    expect(overflow).toBeLessThanOrEqual(0);
    // Keine Zeile der Liste ragt über den Rand des Fensters hinaus
    const beyondEdge = await page.evaluate<number>(
      "Array.from(document.querySelectorAll('[data-testid=posture-check-list] *')).filter((n) => n.getBoundingClientRect().right > window.innerWidth + 0.5).length",
    );
    expect(beyondEdge).toBe(0);
  });
});
