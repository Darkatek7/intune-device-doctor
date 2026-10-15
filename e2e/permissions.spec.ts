import { T, expect, openDevice, openTile, settleSheet, statusBadge, tile, test } from './helpers';

/** CONTOSO-PC050: Konfigurationsprofile und BitLocker-Schlüssel sind per Graph nicht lesbar (403). */
test.describe('Fehlende Berechtigung (CONTOSO-PC050)', () => {
  test('Richtlinien-Kachel zeigt „Fehlende Berechtigung“ und nennt den Scope im Sheet', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC050');

    const policies = tile(page, 'Richtlinien');
    await expect(statusBadge(policies, T.forbidden)).toBeVisible();

    const dialog = await openTile(page, 'Richtlinien');
    await settleSheet(page);
    await expect(dialog).toContainText('DeviceManagementConfiguration.Read.All');
    await expect(dialog.getByText(T.forbidden, { exact: true }).first()).toBeVisible();
  });

  test('BitLocker-Kachel zeigt „Fehlende Berechtigung“ und nennt den Scope im Sheet', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC050');

    const bitlocker = tile(page, 'BitLocker');
    await expect(statusBadge(bitlocker, T.forbidden)).toBeVisible();

    const dialog = await openTile(page, 'BitLocker');
    await settleSheet(page);
    await expect(dialog).toContainText('BitlockerKey.ReadBasic.All');
  });

  test('übrige Kacheln funktionieren normal (Defender in Ordnung, Sheet ohne Befund)', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC050');

    const defender = tile(page, 'Defender');
    await expect(statusBadge(defender, T.ok)).toBeVisible();

    const dialog = await openTile(page, 'Defender');
    await settleSheet(page);
    await expect(dialog.getByRole('heading', { name: T.allGood })).toBeVisible();
    await expect(dialog.getByText(T.forbidden, { exact: true })).toHaveCount(0);
  });
});
