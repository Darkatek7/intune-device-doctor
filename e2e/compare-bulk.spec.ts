/**
 * M12/B: Vorher/Nachher-Vergleich, zwei ZIPs vergleichen, Sammelprüfung (Demo) und Lesezeichen.
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { buildFixtureZip, FIXTURE_FILE_NAME } from '../src/diagnostics/fixture';
import { T, expect, openDevice, test, waitForTilesReady } from './helpers';

const HOME_BUTTON = 'MDM Doctor – zur Startseite';

/** Vergleich ist erst möglich, wenn alles geladen ist (inkl. Zuweisungen, die nach den Kacheln kommen). */
async function compareInput(page: Page) {
  await expect(page.getByRole('button', { name: 'Mit Stand vergleichen' })).toBeEnabled();
  return page.getByTestId('compare-input');
}

test.describe('Vorher/Nachher (Gerät)', () => {
  test('Export lädt eine Datei herunter, Vergleich mit demselben Gerät zeigt keine Unterschiede', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC042');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Stand exportieren' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^mdm-doctor-stand-CONTOSO-PC042-\d{8}-\d{4}\.json$/);
    const target = path.join(
      mkdtempSync(path.join(tmpdir(), 'mdm-stand-')),
      file.suggestedFilename(),
    );
    await file.saveAs(target);

    const exported = JSON.parse(readFileSync(target, 'utf8')) as {
      schema: string;
      tiles: unknown[];
    };
    expect(exported.schema).toBe('mdm-doctor/stand');
    expect(exported.tiles.length).toBeGreaterThan(5);
    // Keine Rohdaten, keine UPNs
    expect(readFileSync(target, 'utf8')).not.toMatch(/@contoso\.com/i);

    await (await compareInput(page)).setInputFiles(target);
    const dialog = page.getByRole('dialog', { name: 'Vergleich' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('compare-name-mismatch')).toHaveCount(0);
    await expect(dialog.getByText('Keine Unterschiede zwischen den beiden Ständen.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('anderes Gerät: Warnung bei abweichendem Namen, Kacheln mit Trend', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC001');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Stand exportieren' }).click();
    const target = path.join(mkdtempSync(path.join(tmpdir(), 'mdm-stand-')), 'pc001.json');
    await (await download).saveAs(target);

    await openDevice(page, 'CONTOSO-PC042');
    await (await compareInput(page)).setInputFiles(target);
    const dialog = page.getByRole('dialog', { name: 'Vergleich' });
    await expect(dialog.getByTestId('compare-name-mismatch')).toContainText('CONTOSO-PC001');
    await expect(dialog.getByRole('list', { name: 'Kacheln im Vergleich' })).toBeVisible();
    await expect(dialog.locator('[data-trend="worse"]').first()).toBeVisible();
  });

  test('fremde Datei wird abgelehnt', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC042');
    await (
      await compareInput(page)
    ).setInputFiles({
      name: 'fremd.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"hello":"world"}'),
    });
    await expect(page.getByText('Das ist keine Stand-Datei von MDM Doctor.')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('Zwei ZIPs vergleichen', () => {
  test('zweite ZIP wird lokal analysiert; abweichender Gerätename wird gewarnt', async ({
    page,
    network,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(T.zipChip) }).click();
    await waitForTilesReady(page);

    await page.getByTestId('compare-zip-input').setInputFiles({
      name: 'DiagLogs-CONTOSO-PC001-20261020T080000Z.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(buildFixtureZip()),
    });
    const dialog = page.getByRole('dialog', { name: 'Vergleich' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('compare-name-mismatch')).toContainText('CONTOSO-PC001');
    await expect(dialog.getByText(/gesammelt am/).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(network.unsafe).toEqual([]);
  });

  test('gleiche Datei unter gleichem Namen: keine Warnung', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(T.zipChip) }).click();
    await waitForTilesReady(page);
    await page.getByTestId('compare-zip-input').setInputFiles({
      name: FIXTURE_FILE_NAME,
      mimeType: 'application/zip',
      buffer: Buffer.from(buildFixtureZip()),
    });
    const dialog = page.getByRole('dialog', { name: 'Vergleich' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('compare-name-mismatch')).toHaveCount(0);
  });
});

test.describe('Sammelprüfung (Demo)', () => {
  test('Namen prüfen, Gerät öffnen, zurück zur Tabelle, CSV exportieren', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Mehrere Geräte prüfen' }).click();
    await expect(page.getByRole('heading', { name: 'Mehrere Geräte prüfen' })).toBeVisible();

    await page
      .getByLabel('Gerätenamen (einer pro Zeile)')
      .fill('CONTOSO-PC001\nCONTOSO-PC033\ncontoso-pc014\nGIBT-ES-NICHT');
    await expect(page.getByText('4 Namen erkannt')).toBeVisible();
    await page.getByRole('button', { name: 'Prüfen', exact: true }).click();

    await expect(page.getByText('Prüfung abgeschlossen: 4 Namen.')).toBeVisible();
    const table = page.getByRole('table', { name: 'Ergebnis der Sammelprüfung' });
    const rows = table.getByTestId('bulk-row');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText('Konform');
    await expect(rows.nth(1)).toContainText('Problem'); // Check-in überfällig
    await expect(rows.nth(3)).toContainText('Kein Treffer');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Als CSV exportieren' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^mdm-doctor-sammelpruefung-.*\.csv$/);

    await page.getByRole('button', { name: 'CONTOSO-PC033 öffnen' }).click();
    await waitForTilesReady(page);
    await expect(page).toHaveURL(/device=/);

    await page.goBack();
    await expect(page.getByRole('table', { name: 'Ergebnis der Sammelprüfung' })).toBeVisible();
    await expect(page.getByTestId('bulk-row')).toHaveCount(4);

    await page.getByRole('button', { name: HOME_BUTTON }).click();
    await expect(page.getByRole('heading', { name: T.heroTitle })).toBeVisible();
  });
});

test.describe('Lesezeichen', () => {
  test('Dialog zeigt den ziehbaren Link; das Lesezeichen öffnet das Gerät in neuem Tab', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Lesezeichen für das Intune Admin Center' }).click();
    const dialog = page.getByRole('dialog', { name: /Lesezeichen/ });
    await expect(dialog).toBeVisible();

    const href = (await dialog.getByTestId('bookmarklet-link').getAttribute('href')) ?? '';
    expect(href.startsWith('javascript:')).toBe(true);
    expect(href).not.toContain('React has blocked');
    const code = href.slice('javascript:'.length);

    // Die Intune-Seite wird lokal nachgestellt (Netzwerk-Sperre bleibt aktiv).
    const guid = '11111111-2222-3333-4444-555555555555';
    await context.route('https://intune.microsoft.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Intune</title>' }),
    );
    const portal = await context.newPage();
    await portal.goto(
      `https://intune.microsoft.com/#view/Microsoft_Intune_Devices/DeviceSettingsMenuBlade/~/overview/mdmDeviceId/${guid}`,
    );
    const popupPromise = context.waitForEvent('page');
    await portal.evaluate(code);
    const popup = await popupPromise;
    await expect(popup).toHaveURL(new RegExp(`\\?device=${guid}&mode=live$`));

    // Ohne Geräte-ID: kurze Meldung statt neuem Tab
    await portal.goto('https://intune.microsoft.com/#view/home');
    const dialogMessage = portal.waitForEvent('dialog');
    void portal.evaluate(code);
    const message = await dialogMessage;
    expect(message.message()).toContain('Keine Geräte-ID gefunden');
    await message.dismiss();
  });
});

async function expectNoSevereViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const severe = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  const details = severe.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
  expect(severe, `Schwere a11y-Verstöße bei „${label}“:\n${details.join('\n')}`).toEqual([]);
}

test.describe('Barrierefreiheit M12/B', () => {
  test('Sammelprüfung mit Ergebnis, Vergleich und Lesezeichen-Dialog', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Mehrere Geräte prüfen' }).click();
    await expectNoSevereViolations(page, 'Sammelprüfung leer');
    await page
      .getByLabel('Gerätenamen (einer pro Zeile)')
      .fill('CONTOSO-PC001\nCONTOSO-PC033\nGIBT-ES-NICHT');
    await page.getByRole('button', { name: 'Prüfen', exact: true }).click();
    await expect(page.getByText('Prüfung abgeschlossen: 3 Namen.')).toBeVisible();
    await expectNoSevereViolations(page, 'Sammelprüfung Ergebnis');

    await page.getByRole('button', { name: HOME_BUTTON }).click();
    await page.getByRole('button', { name: 'Lesezeichen für das Intune Admin Center' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForTimeout(700);
    await expectNoSevereViolations(page, 'Lesezeichen-Dialog');
  });

  test('Vergleichsdialog (Gerät)', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC042');
    await (
      await compareInput(page)
    ).setInputFiles({
      name: 'x.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          schema: 'mdm-doctor/stand',
          version: 1,
          exportedAt: '2026-11-01T10:00:00.000Z',
          mode: 'demo',
          deviceName: 'CONTOSO-PC042',
          collectedAt: null,
          tiles: [
            {
              id: 'bitlocker',
              title: 'BitLocker',
              severity: 'critical',
              value: 'Aus',
              findings: [],
            },
          ],
        }),
      ),
    });
    await expect(page.getByRole('dialog', { name: 'Vergleich' })).toBeVisible();
    await page.waitForTimeout(700);
    await expectNoSevereViolations(page, 'Vergleichsdialog');
  });
});
