import { T, expect, openDevice, test, waitForTilesReady } from './helpers';

test.describe('Bedienkomfort', () => {
  test('geöffnetes Gerät erscheint nach „zurück“ unter „Zuletzt geöffnet“', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('list', { name: 'Zuletzt geöffnete Geräte' })).toHaveCount(0);

    await openDevice(page, 'CONTOSO-PC042');
    await page.getByRole('button', { name: 'MDM Doctor – zur Startseite' }).click();

    const list = page.getByRole('list', { name: 'Zuletzt geöffnete Geräte' });
    await expect(list).toBeVisible();
    await list.getByRole('button', { name: 'CONTOSO-PC042 erneut öffnen' }).click();
    await waitForTilesReady(page);
    await expect(page).toHaveTitle(/CONTOSO-PC042/);

    await page.getByRole('button', { name: 'MDM Doctor – zur Startseite' }).click();
    await page.getByRole('button', { name: 'Verlauf löschen' }).click();
    await expect(page.getByRole('list', { name: 'Zuletzt geöffnete Geräte' })).toHaveCount(0);
  });

  test('Strg+K und „/“ fokussieren die Suche', async ({ page }) => {
    await page.goto('/');
    const search = page.getByRole('combobox', { name: T.searchLabel });

    await page.keyboard.press('Control+k');
    await expect(search).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(search).not.toBeFocused();
    await page.keyboard.press('/');
    await expect(search).toBeFocused();
  });

  test('Ticket-Notiz: „Drucken / PDF“ zeigt im Druck nur die Notiz', async ({ page }) => {
    let printCalls = 0;
    await page.exposeFunction('__recordPrint', () => {
      printCalls += 1;
    });
    await page.addInitScript('window.print = () => window.__recordPrint();');
    await openDevice(page, 'CONTOSO-PC042');
    await page.getByRole('button', { name: 'Drucken / PDF' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Drucken / PDF' }).click();
    expect(printCalls).toBe(1);

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#root')).toBeHidden();
    await expect(page.locator('[data-print-text]')).toBeVisible();
    await expect(page.locator('[data-print-text]')).toContainText('CONTOSO-PC042');
  });
});
