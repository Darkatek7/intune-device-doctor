import {
  T,
  expect,
  openDevice,
  openTile,
  settleSheet,
  statusBadge,
  tabToTile,
  tile,
  test,
  waitForTilesReady,
} from './helpers';

/** Schlüsselkacheln je Demo-Szenario mit der erwarteten Severity bzw. Verfügbarkeit (Badge-Text). */
const SEVERITY_CASES = [
  { device: 'CONTOSO-PC014', title: 'BitLocker', badge: T.critical },
  { device: 'CONTOSO-PC027', title: 'Defender', badge: T.warning },
  { device: 'CONTOSO-PC033', title: 'Letzter Check-in', badge: T.critical },
  { device: 'CONTOSO-PC042', title: 'Richtlinien', badge: T.critical },
  { device: 'CONTOSO-PC042', title: 'Compliance', badge: T.warning },
  { device: 'CONTOSO-LT108', title: 'Gerätestatus', badge: T.critical },
  { device: 'CONTOSO-PC014', title: 'Anmeldungen', badge: T.warning },
  { device: 'CONTOSO-PC014', title: 'Integritätsnachweis', badge: T.warning },
  { device: 'CONTOSO-PC033', title: 'Lokaler Administrator (LAPS)', badge: T.warning },
  { device: 'CONTOSO-LT108', title: 'Autopilot', badge: T.warning },
  { device: 'CONTOSO-PC042', title: 'Gruppen', badge: T.ok },
  { device: 'CONTOSO-MAC07', title: 'FileVault', badge: T.ok },
  { device: 'CONTOSO-MAC07', title: 'Defender', badge: T.notApplicable },
] as const;

test.describe('Kacheln je Szenario', () => {
  for (const { device, title, badge } of SEVERITY_CASES) {
    test(`${device}: Kachel „${title}“ zeigt „${badge}“`, async ({ page }) => {
      await openDevice(page, device);
      await expect(statusBadge(tile(page, title), badge)).toBeVisible();
    });
  }
});

test.describe('Windows-spezifische Kacheln (M10)', () => {
  test('macOS-Gerät zeigt weder LAPS, Autopilot noch Integritätsnachweis', async ({ page }) => {
    await openDevice(page, 'CONTOSO-MAC07');
    for (const title of ['Lokaler Administrator (LAPS)', 'Autopilot', 'Integritätsnachweis']) {
      await expect(tile(page, title)).toHaveCount(0);
    }
    // Anmeldungen und Gruppen gelten für alle Plattformen
    await expect(tile(page, 'Gruppen')).toBeVisible();
  });

  test('LAPS (PC033): Sheet zeigt Befund, Ursache, Lösung und Quelle – ohne Kennwort', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC033');
    const dialog = await openTile(page, 'Lokaler Administrator (LAPS)');
    await settleSheet(page);

    await expect(dialog.getByRole('heading', { name: T.finding }).first()).toBeVisible();
    await expect(dialog.getByRole('heading', { name: T.cause }).first()).toBeVisible();
    await expect(dialog.getByRole('heading', { name: T.remediation }).first()).toBeVisible();
    await expect(dialog.getByText(`${T.source}:`, { exact: true }).first()).toBeVisible();
  });

  test('Integritätsnachweis (PC014): Rohwerte werden unverändert angezeigt, mit Hinweis', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC014');
    const dialog = await openTile(page, 'Integritätsnachweis');
    await settleSheet(page);

    await expect(dialog.getByRole('heading', { name: T.finding }).first()).toBeVisible();
    await expect(dialog).toContainText('healthStatusMismatchInfo');
    await expect(dialog).toContainText('Microsoft dokumentiert dafür keine Bedeutung');
  });
});

test.describe('Detail-Sheet', () => {
  test('Klick auf Richtlinien (PC042) zeigt Befund, Ursache, Lösung und Quelle', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC042');
    const dialog = await openTile(page, 'Richtlinien');
    await settleSheet(page);

    await expect(dialog.getByRole('heading', { name: T.finding }).first()).toBeVisible();
    await expect(dialog.getByRole('heading', { name: T.cause }).first()).toBeVisible();
    await expect(dialog.getByRole('heading', { name: T.remediation }).first()).toBeVisible();
    // „Quelle“ ist im Sheet ein Label („Quelle:“), keine Überschrift.
    await expect(dialog.getByText(`${T.source}:`, { exact: true }).first()).toBeVisible();
  });

  test('Escape schließt das Sheet, der Fokus kehrt zur Kachel zurück', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC042');
    const card = tile(page, 'Richtlinien');
    const dialog = await openTile(page, 'Richtlinien');
    await settleSheet(page);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(card).toBeFocused();
  });

  test('Schaltfläche „Schließen“ schließt das Sheet und gibt den Fokus zurück', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC042');
    const card = tile(page, 'Richtlinien');
    const dialog = await openTile(page, 'Richtlinien');
    await settleSheet(page);

    await dialog.getByRole('button', { name: T.close }).click();
    await expect(dialog).toBeHidden();
    await expect(card).toBeFocused();
  });

  test('komplett per Tastatur: Strg+K, Gerät suchen, Kachel öffnen, Escape', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('combobox', { name: T.searchLabel })).toBeFocused();

    await page.keyboard.type('CONTOSO-PC042');
    await page.keyboard.press('Enter');
    await waitForTilesReady(page);

    const card = tile(page, 'Richtlinien');
    await tabToTile(page, 'Richtlinien');
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await settleSheet(page);
    await expect(dialog.getByRole('heading', { name: T.finding }).first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(card).toBeFocused();
  });
});
