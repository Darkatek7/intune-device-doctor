import {
  T,
  expect,
  openDevice,
  settleSheet,
  statusBadge,
  tile,
  tileButtons,
  test,
} from './helpers';

/** Ansicht „Mandant“ (M14/S5) und Abgrenzung zum Verbindungstest (M14/S6, nur Live). */
test.describe('Ansicht „Mandant“', () => {
  test('Toolbar öffnet die fünf Mandanten-Kacheln; VPP-Token läuft bald ab', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Mandant', exact: true }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Mandant' })).toBeVisible();
    await expect(tileButtons(page)).toHaveCount(5);
    await expect(page).toHaveURL(/view=tenant/);

    await expect(statusBadge(tile(page, 'Apple-MDM-Push-Zertifikat'), T.ok)).toBeVisible();
    await expect(statusBadge(tile(page, 'Apple-VPP-Token'), T.warning)).toBeVisible();
    await expect(tile(page, 'Weitere Konnektoren und Token')).toBeVisible();
  });

  test('Detail-Sheet der VPP-Kachel zeigt Befund, Ursache, Lösung und Quelle', async ({ page }) => {
    await page.goto('/?view=tenant&mode=demo');
    await expect(tileButtons(page)).toHaveCount(5);
    await tile(page, 'Apple-VPP-Token').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await settleSheet(page);

    await expect(dialog.getByRole('heading', { name: T.finding }).first()).toBeVisible();
    await expect(dialog.getByRole('heading', { name: T.cause }).first()).toBeVisible();
    await expect(dialog.getByRole('heading', { name: T.remediation }).first()).toBeVisible();
    await expect(dialog.getByText(`${T.source}:`, { exact: true }).first()).toBeVisible();
    await expect(dialog).not.toContainText('SECRET');
  });

  test('Der Verbindungstest gehört nur zum Live-Modus und fehlt in der Demo-Geräteansicht', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC001');
    await expect(page.getByRole('button', { name: 'Verbindungstest' })).toHaveCount(0);
  });
});
