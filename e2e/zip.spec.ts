import { buildFixtureZip, FIXTURE_FILE_NAME } from '../src/diagnostics/fixture';
import {
  BASE_TILE_TITLES,
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
  test('Beispiel-ZIP zeigt Befunde; Zusammenführen ergibt alle Windows-Kacheln plus sechs ZIP-Kacheln', async ({
    page,
  }) => {
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

    // Ereignisprotokoll (.evtx) aus dem Fixture: gruppierte Fehlerereignisse, Event 76 mit Learn-Beleg
    const events = await openTile(page, 'MDM-Ereignisse');
    await settleSheet(page);
    await expect(events).toContainText('Ereignis 76');
    await expect(events).toContainText('Auto MDM Enroll');
    await expect(events).not.toContainText('user@contoso.com');
    await page.keyboard.press('Escape');
    await expect(events).toBeHidden();

    await page.getByRole('button', { name: T.zipMerge }).click();
    await waitForTilesReady(page);
    await expect(tileButtons(page)).toHaveCount(BASE_TILE_TITLES.length + 6);
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
