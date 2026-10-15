import {
  BASE_TILE_TITLES,
  T,
  expect,
  openDevice,
  searchDevice,
  tile,
  tileButtons,
  test,
  waitForTilesReady,
} from './helpers';

test.describe('Suche', () => {
  test('CONTOSO-PC001 öffnet das Gerät mit sieben Kacheln, alle in Ordnung', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC001');

    await expect(tileButtons(page)).toHaveCount(BASE_TILE_TITLES.length);
    for (const title of BASE_TILE_TITLES) {
      await expect(tile(page, title)).toBeVisible();
    }
    await expect(tileButtons(page).getByText(T.ok, { exact: true })).toHaveCount(
      BASE_TILE_TITLES.length,
    );
    await expect(page).toHaveTitle(/CONTOSO-PC001/);
  });

  test('Teilname „contoso-pc0“ zeigt die Auswahlliste mit mehreren Geräten', async ({ page }) => {
    await page.goto('/');
    await searchDevice(page, 'contoso-pc0');

    await expect(page.getByRole('heading', { name: T.pickerTitle })).toBeVisible();
    const list = page.getByRole('list', { name: T.pickerList });
    // Demo-Daten: PC001, PC014, PC027, PC033, PC042, PC050 (LT108 und MAC07 passen nicht).
    await expect(list.getByRole('button')).toHaveCount(6);

    await list.getByRole('button', { name: 'CONTOSO-PC042 auswählen' }).click();
    await waitForTilesReady(page);
    await expect(page).toHaveTitle(/CONTOSO-PC042/);
    await expect(tile(page, 'Richtlinien')).toBeVisible();
  });

  test('unbekannter Name zeigt den Leerzustand ohne Kacheln', async ({ page }) => {
    await page.goto('/');
    await searchDevice(page, 'CONTOSO-XYZ999');

    await expect(page.getByRole('heading', { name: T.notFoundTitle })).toBeVisible();
    await expect(
      page.getByText('Zu „CONTOSO-XYZ999“ gibt es kein Gerät.', { exact: false }),
    ).toBeVisible();
    await expect(tileButtons(page)).toHaveCount(0);
  });
});
