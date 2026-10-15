import { buildFixtureZip, FIXTURE_FILE_NAME } from '../src/diagnostics/fixture';
import {
  T,
  expect,
  openDevice,
  openTile,
  screenshot,
  settleSheet,
  test,
  waitForTilesReady,
} from './helpers';

/**
 * Nur Erzeugung von Screenshots für die visuelle Abnahme (e2e-artifacts/<projekt>/).
 * Keine Pixel-Vergleiche – Baselines wären instabil.
 */
test.describe('Screenshots', () => {
  test('start', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: T.heroTitle })).toBeVisible();
    await screenshot(page, testInfo, 'start');
  });

  test('dashboard-healthy', async ({ page }, testInfo) => {
    await openDevice(page, 'CONTOSO-PC001');
    await page.waitForTimeout(700);
    await screenshot(page, testInfo, 'dashboard-healthy');
  });

  test('dashboard-pc042', async ({ page }, testInfo) => {
    await openDevice(page, 'CONTOSO-PC042');
    await page.waitForTimeout(700);
    await screenshot(page, testInfo, 'dashboard-pc042');
  });

  test('sheet-open', async ({ page }, testInfo) => {
    await openDevice(page, 'CONTOSO-PC042');
    await openTile(page, 'Richtlinien');
    await settleSheet(page);
    await screenshot(page, testInfo, 'sheet-open');
  });

  test('zip-view', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles({
      name: FIXTURE_FILE_NAME,
      mimeType: 'application/zip',
      buffer: Buffer.from(buildFixtureZip()),
    });
    await waitForTilesReady(page);
    await page.waitForTimeout(700);
    await screenshot(page, testInfo, 'zip-view');
  });

  test('permissions', async ({ page }, testInfo) => {
    await openDevice(page, 'CONTOSO-PC050');
    await page.waitForTimeout(700);
    await screenshot(page, testInfo, 'permissions');
  });
});
