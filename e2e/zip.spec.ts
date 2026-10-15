import { buildFixtureZip, FIXTURE_FILE_NAME } from '../src/diagnostics/fixture';
import {
  T,
  expect,
  openTile,
  settleSheet,
  statusBadge,
  tile,
  tileButtons,
  test,
  waitForTilesReady,
} from './helpers';

test.describe('DiagLogs-ZIP', () => {
  test('Beispiel-ZIP zeigt Befunde; Zusammenführen ergibt elf Kacheln', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(T.zipChip) }).click();
    await waitForTilesReady(page);

    const entra = tile(page, 'Entra-Join & PRT');
    await expect(statusBadge(entra, T.critical)).toBeVisible();

    const dialog = await openTile(page, 'Win32-Apps');
    await settleSheet(page);
    await expect(dialog).toContainText('0x80070642');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: T.zipMerge }).click();
    await waitForTilesReady(page);
    await expect(tileButtons(page)).toHaveCount(11);
  });

  test('Upload per Datei-Eingabe: ZIP-Ansicht erscheint, kein Request sendet die Datei', async ({
    page,
    network,
  }) => {
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles({
      name: FIXTURE_FILE_NAME,
      mimeType: 'application/zip',
      buffer: Buffer.from(buildFixtureZip()),
    });

    await waitForTilesReady(page);
    await expect(tile(page, 'Entra-Join & PRT')).toBeVisible();
    // Die Netzwerk-Sperre (Fixture „network“) wirft nach dem Test, falls ein Upload gesendet wurde.
    expect(network.unsafe).toEqual([]);
    expect(network.blocked).toEqual([]);
  });
});
