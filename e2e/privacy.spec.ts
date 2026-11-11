import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, openDevice, searchDevice, test, waitForTilesReady } from './helpers';

/** Präsentationsmodus (M19). Texte aus src/i18n/de-privacy.ts. */
const PRIVACY = {
  toggle: 'Präsentationsmodus',
  pill: 'Präsentationsmodus · Namen verborgen',
} as const;
const PSEUDONYM = /^Gerät-[0-9A-F]{4}$/;
/** Echte Werte der Demo-Szenarien (nur diese Datei), kleingeschrieben */
const REAL = ['contoso-pc042', 'sophie.hartmann', 'sophie hartmann', 'demo-000042'];
/** Weitere Geräte desselben Benutzers (Jonas Weber: PC014 + IP015) */
const REAL_OTHERS = ['contoso-pc014', 'contoso-ip015', 'jonas.weber', 'jonas weber'];

const toggle = (page: Page) => page.getByRole('button', { name: PRIVACY.toggle, exact: true });

async function enable(page: Page): Promise<void> {
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(PRIVACY.pill)).toBeVisible();
}

/** Sichtbarer Text, HTML (inkl. Attribute) und Werte der Eingabefelder – alles kleingeschrieben. */
async function pageContents(page: Page): Promise<string> {
  const text = await page.locator('body').innerText();
  const html = await page.content();
  const fields = await page.evaluate(
    `Array.from(document.querySelectorAll('input, textarea')).map((el) => el.value).join(' ')`,
  );
  return `${text}\n${html}\n${String(fields)}\n${await page.title()}`.toLowerCase();
}

async function expectNoRealValues(page: Page, label: string): Promise<void> {
  const contents = await pageContents(page);
  const leaked = REAL.filter((value) => contents.includes(value));
  expect(leaked, `Echte Werte sichtbar bei „${label}“`).toEqual([]);
}

test.describe('Präsentationsmodus', () => {
  test('verbirgt Gerät und Benutzer, Funktion bleibt, Zustand übersteht das Neuladen', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText(PRIVACY.pill)).toHaveCount(0);
    await enable(page);

    await searchDevice(page, 'CONTOSO-PC042');
    await waitForTilesReady(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(PSEUDONYM);
    await expectNoRealValues(page, 'Geräteansicht');

    // Funktion bleibt: Detail-Sheet, Rohdaten, Zeitachse
    await page.locator('button[data-tile-id="compliance"]').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expectNoRealValues(page, 'Detail-Sheet');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: 'Zeitachse', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoRealValues(page, 'Zeitachse');
    await page.keyboard.press('Escape');

    // Reload: Modus bleibt an, das Gerät lädt weiter (Adresszeile trägt die Geräte-ID)
    await page.reload();
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
    await waitForTilesReady(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(PSEUDONYM);
    await expectNoRealValues(page, 'nach dem Neuladen');

    // Aus: echte Namen sind wieder da
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('heading', { level: 1, name: 'CONTOSO-PC042' })).toBeVisible();
    await expect(page.getByText(PRIVACY.pill)).toHaveCount(0);
  });

  test('„weitere Geräte des Benutzers“ öffnen das echte Gerät, angezeigt wird nur das Pseudonym', async ({
    page,
  }) => {
    await page.goto('/');
    await enable(page);
    await searchDevice(page, 'CONTOSO-PC014');
    await waitForTilesReady(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(PSEUDONYM);

    const others = page.getByTestId('other-devices');
    await expect(others).toBeVisible();
    const target = others.getByRole('button').first();
    await expect(target).toHaveText(PSEUDONYM);
    const targetName = (await target.innerText()).trim();
    await target.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(targetName);
    await waitForTilesReady(page);
    const contents = await pageContents(page);
    expect(REAL_OTHERS.filter((value) => contents.includes(value))).toEqual([]);
  });

  test('Richtlinie → Gerät öffnen: Name verborgen, Klick öffnet das echte Gerät', async ({
    page,
  }) => {
    await page.goto('/');
    await enable(page);
    await page.getByRole('button', { name: 'Richtlinien', exact: true }).click();
    await page.getByTestId('policy-row').filter({ hasText: 'Contoso – VPN Always On' }).click();
    const row = page.getByTestId('policy-status-row').first();
    await expect(row).toBeVisible();
    await expectNoRealValues(page, 'Richtlinien-Gerätestatus');
    const deviceButton = row.getByRole('button');
    await expect(deviceButton).toHaveText(PSEUDONYM);
    await deviceButton.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(PSEUDONYM);
    await waitForTilesReady(page);
    await expectNoRealValues(page, 'Gerät aus Richtlinie');
  });

  test('Suchfeld und Trefferauswahl zeigen keine echten Namen mehr', async ({ page }) => {
    await page.goto('/');
    await enable(page);
    await searchDevice(page, 'contoso-pc0');
    await expect(page.getByRole('list', { name: 'Gefundene Geräte' })).toBeVisible();
    // Das Echo der Eingabe entfällt im Untertitel
    expect(await page.locator('body').innerText()).not.toContain('contoso-ip015');
    await page.getByRole('list', { name: 'Gefundene Geräte' }).getByRole('button').first().click();
    await waitForTilesReady(page);
    await expect(
      page.getByRole('combobox', { name: 'Gerätename, Benutzer oder Seriennummer' }),
    ).toHaveValue('');
  });

  test('Barrierefreiheit: Geräteansicht und Startseite mit eingeschaltetem Modus', async ({
    page,
  }) => {
    await page.goto('/');
    await enable(page);
    await page.waitForTimeout(300);
    await expectNoSevereViolations(page, 'Startseite');
    await searchDevice(page, 'CONTOSO-PC042');
    await waitForTilesReady(page);
    await expectNoSevereViolations(page, 'Geräteansicht');
  });

  test('Beispiel-ZIP: Dateiname und Gerät verborgen', async ({ page }) => {
    await page.goto('/');
    await enable(page);
    await page.getByRole('button', { name: /Beispiel-ZIP analysieren/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(PSEUDONYM);
    const contents = await pageContents(page);
    expect(contents).not.toContain('contoso-pc042');
    expect(contents).not.toContain('user@contoso.com');
  });

  test('ohne Modus bleibt alles wie bisher (Standard aus)', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC042');
    await expect(page.getByRole('heading', { level: 1, name: 'CONTOSO-PC042' })).toBeVisible();
  });
});

async function expectNoSevereViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const severe = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  const details = severe
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
    .join('\n');
  expect(severe, `Schwere a11y-Verstöße bei „${label}“:\n${details}`).toEqual([]);
}
