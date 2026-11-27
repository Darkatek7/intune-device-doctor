import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, screenshot, test, waitForTilesReady } from './helpers';

/**
 * M22: Ansicht „Flotte“ (alle verwalteten Geräte des Mandanten). Demo-Modus, Texte aus
 * src/i18n/de-fleet-devices.ts. (`fleet.spec.ts` gehört der Compliance-Übersicht aus M20.) Die genaue Zahl
 * der Demo-Geräte wird nie geprüft.
 */
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

const overflow = (page: Page) =>
  page.evaluate<number>(
    'document.documentElement.scrollWidth - document.documentElement.clientWidth',
  );

const rows = (page: Page) => page.locator('[data-fleet-row]');

async function openFleet(page: Page, search = '') {
  await page.goto(`/?view=fleet&mode=demo${search}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Flotte' })).toBeVisible();
  await expect(rows(page).first()).toBeVisible();
}

test.describe('Ansicht „Flotte“', () => {
  test('Navigation öffnet die Ansicht mit Gesamtbild, Karten und Geräteliste', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('button', { name: 'Flotte', exact: true })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Flotte' })).toBeVisible();
    await expect(page).toHaveURL(/view=fleet/);
    await expect(rows(page).first()).toBeVisible();
    await expect(page.getByTestId('fleet-summary')).toContainText(/\d+ Geräte/);
    await expect(page.locator('[data-issue]')).toHaveCount(6);
    await expect(page.getByTestId('fleet-counter')).toContainText(/\d+ von \d+ Geräten/);
    await expect(page.getByRole('heading', { level: 2, name: 'Versionsverteilung' })).toBeVisible();
  });

  test('Filter per Karte steht in der URL, überlebt Neuladen und Zurück', async ({ page }) => {
    await openFleet(page);
    const card = page.locator('[data-issue="nonCompliant"]');
    await card.click();
    await expect(page).toHaveURL(/issue=nonCompliant/);
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    const count = await rows(page).count();
    expect(count).toBeGreaterThan(0);
    for (const row of await rows(page).all()) {
      await expect(row).toContainText('Nicht konform');
    }
    await page.reload();
    await expect(page.locator('[data-issue="nonCompliant"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.locator('[data-issue="nonCompliant"]').click();
    await expect(page).not.toHaveURL(/issue=/);
    await page.getByRole('button', { name: 'Nur auffällige' }).click();
    await expect(page).toHaveURL(/issue=any/);
  });

  test('Plattformfilter und Suche schränken die Liste ein; Filter zurücksetzen', async ({
    page,
  }) => {
    await openFleet(page);
    const group = page.getByRole('group', { name: 'Plattform' });
    await group.getByRole('button', { name: /^Windows/ }).click();
    await expect(page).toHaveURL(/platform=windows/);
    const input = page.getByRole('searchbox', { name: 'Geräte durchsuchen' });
    await input.fill('gibt-es-garantiert-nicht');
    await expect(page.getByText('Kein Gerät passt zu den Filtern')).toBeVisible();
    await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
    await expect(page).not.toHaveURL(/platform=/);
    await expect(input).toHaveValue('');
    await expect(rows(page).first()).toBeVisible();
  });

  test('„Verwaltet von“ filtert per Mehrfachauswahl, steht in der URL und zieht alle Zahlen mit', async ({
    page,
  }) => {
    await openFleet(page);
    const summary = page.getByTestId('fleet-summary');
    const group = page.getByRole('group', { name: 'Verwaltet von' });
    const mde = group.getByRole('button', { name: /^Defender for Endpoint \(MDE\)/ });
    const intune = group.getByRole('button', { name: /^Intune/ });
    await expect(group.getByRole('button', { name: 'Alle Verwaltungsarten' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(summary).not.toContainText('von');

    await mde.click();
    await expect(page).toHaveURL(/managed=mde/);
    await expect(mde).toHaveAttribute('aria-pressed', 'true');
    const mdeCount = await rows(page).count();
    expect(mdeCount).toBeGreaterThan(0);
    for (const row of await rows(page).all()) {
      await expect(row.locator('[data-management]')).toHaveAttribute('data-management', 'mde');
    }
    // Gesamtbild und Plattformzahlen folgen der Auswahl
    await expect(summary).toContainText(new RegExp(`${mdeCount} von \\d+ Geräten`));
    await expect(summary).toContainText('Zahlen für die aktuelle Auswahl');
    await expect(
      page.getByRole('group', { name: 'Plattform' }).getByRole('button', { name: /^Windows/ }),
    ).toHaveText(`Windows (${mdeCount})`);

    await intune.click();
    await expect(page).toHaveURL(/managed=intune%2Cmde/);
    expect(await rows(page).count()).toBeGreaterThan(mdeCount);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Flotte' })).toBeVisible();
    await expect(
      page
        .getByRole('group', { name: 'Verwaltet von' })
        .getByRole('button', { name: /^Defender for Endpoint/ }),
    ).toHaveAttribute('aria-pressed', 'true');

    await page
      .getByRole('group', { name: 'Verwaltet von' })
      .getByRole('button', { name: 'Alle Verwaltungsarten' })
      .click();
    await expect(page).not.toHaveURL(/managed=/);
    await expect(page.getByTestId('fleet-summary')).not.toContainText('von');
    await expectNoSevereViolations(page, 'Flotte mit Leiste „Verwaltet von“');
  });

  test('Klick auf eine Zeile öffnet das Gerät, Zurück führt in die Flotte', async ({ page }) => {
    await openFleet(page);
    await page.locator('[data-issue="nonCompliant"]').click();
    await expect(page).toHaveURL(/issue=nonCompliant/);
    await rows(page).first().click();
    await expect(page).toHaveURL(/device=/);
    await waitForTilesReady(page);
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Flotte' })).toBeVisible();
    await expect(page).toHaveURL(/view=fleet/);
    await expect(page).toHaveURL(/issue=nonCompliant/);
    await expect(rows(page).first()).toBeVisible();
  });

  test('Zeile ist per Tastatur bedienbar (Enter öffnet das Gerät)', async ({ page }) => {
    await openFleet(page);
    await rows(page).first().focus();
    await expect(rows(page).first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/device=/);
  });

  test('Export-Knopf lädt eine CSV-Datei herunter', async ({ page }) => {
    await openFleet(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportieren (CSV)' }).click();
    expect((await download).suggestedFilename()).toMatch(
      /^mdm-doctor-flotte-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });

  test('Barrierefreiheit ohne schwere axe-Verstöße', async ({ page }) => {
    await openFleet(page);
    await expectNoSevereViolations(page, 'Flotte');
    await page.locator('[data-issue="notEncrypted"]').click();
    await expectNoSevereViolations(page, 'Flotte mit Filter');
  });

  test('390 px: kein horizontales Scrollen, Navigation mit fünf Einträgen nicht abgeschnitten', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFleet(page);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
    await expect(nav.getByRole('button')).toHaveCount(5);
    for (const button of await nav.getByRole('button').all()) {
      expect(await button.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    }
    // Keine Zeile ragt über den Rand hinaus
    const beyondEdge = await page.evaluate<number>(
      "Array.from(document.querySelectorAll('[data-fleet-row], [data-fleet-row] *, [data-issue]')).filter((n) => n.getBoundingClientRect().right > window.innerWidth + 0.5).length",
    );
    expect(beyondEdge).toBe(0);
    await expectNoSevereViolations(page, 'Flotte (390 px)');
  });

  test('Screenshot', async ({ page }, testInfo) => {
    await openFleet(page);
    await page.waitForTimeout(500);
    await screenshot(page, testInfo, 'fleet-devices');
  });
});
