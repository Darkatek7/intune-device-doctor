/**
 * M17: Dashboard-UX – kompakte gesunde Kacheln, Menü „Mehr“, Hauptnavigation, Startseite.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import {
  T,
  expect,
  openDevice,
  openMoreMenu,
  openTile,
  settleSheet,
  tile,
  tileButtons,
  test,
} from './helpers';

/** Dokumenthöhe von CONTOSO-PC042 mobil lag vor M17 bei 3280 px (alle 15 Kacheln groß). */
const MOBILE_MAX_DOC_HEIGHT = 2400;

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

const docHeight = (page: Page) =>
  page.evaluate('document.documentElement.scrollHeight') as Promise<number>;

test.describe('Gesunde Kacheln kompakt (U1)', () => {
  test('PC042: Kacheln mit Befund bleiben groß, 10 gesunde stehen kompakt unter „In Ordnung · 10“', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC042');
    await expect(page.getByRole('heading', { level: 2, name: 'In Ordnung · 10' })).toBeVisible();

    const compact = page.locator('button[data-tile-compact]');
    await expect(compact).toHaveCount(10);
    await expect(tileButtons(page)).toHaveCount(15);

    // Große Karte (Befund) deutlich höher als eine kompakte Zeile
    const large = await tile(page, 'Richtlinien').boundingBox();
    const small = await tile(page, 'Gruppen').boundingBox();
    expect(small!.height).toBeLessThan(80);
    expect(large!.height).toBeGreaterThan(small!.height * 2);

    // Status nie nur über Farbe: kompakte Kachel nennt den Status im Namen
    await expect(tile(page, 'Gruppen')).toHaveAccessibleName(/In Ordnung/);
    await expect(tile(page, 'Gruppen')).toHaveAttribute('aria-haspopup', 'dialog');
  });

  test('kompakte Kachel öffnet das Detail-Sheet; Fokus kehrt zurück', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC042');
    const card = tile(page, 'Gruppen');
    const dialog = await openTile(page, 'Gruppen');
    await settleSheet(page);
    await expect(dialog.getByRole('heading', { name: 'Gruppen' }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(card).toBeFocused();
  });

  test('PC001 (alles in Ordnung): klare positive Aussage oben, dann die kompakten Kacheln', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC001');
    const banner = page.getByTestId('all-ok-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Keine Auffälligkeiten');
    await expect(page.locator('button[data-tile-compact]')).toHaveCount(15);
    // Banner steht über den kompakten Kacheln
    const bannerBox = await banner.boundingBox();
    const firstTile = await tileButtons(page).first().boundingBox();
    expect(bannerBox!.y).toBeLessThan(firstTile!.y);
  });

  test('mobil: Dashboard von PC042 ist deutlich kürzer als vorher', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Höhenvergleich nur im Mobil-Projekt');
    await openDevice(page, 'CONTOSO-PC042');
    await page.waitForTimeout(800);
    expect(await docHeight(page)).toBeLessThan(MOBILE_MAX_DOC_HEIGHT);
  });

  test('zusammengeführte Ansicht (ZIP + Gerät) und ZIP-Ansicht nutzen denselben Aufbau', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(T.zipChip) }).click();
    await expect(tileButtons(page).first()).toBeVisible();
    // Die ZIP-Ansicht hat Befunde (große Karten) und gesunde Kacheln (kompakt)
    await expect(page.locator('button[data-tile-compact]').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /^In Ordnung · \d+$/ })).toBeVisible();
  });
});

test.describe('Menü „Mehr“ (U2)', () => {
  test('Tastatur: Enter öffnet, Pfeiltasten wandern, Escape schließt und gibt den Fokus zurück', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC042');
    const more = page.getByRole('button', { name: 'Mehr', exact: true });
    await expect(more).toHaveAttribute('aria-haspopup', 'menu');
    await expect(more).toHaveAttribute('aria-expanded', 'false');

    await more.focus();
    await page.keyboard.press('Enter');
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    const items = page.getByRole('menuitem');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(items.nth(2)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(0)).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(more).toBeFocused();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
  });

  test('Klick außerhalb schließt das Menü', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC042');
    await openMoreMenu(page);
    await page.getByRole('heading', { level: 1 }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('Zeitachse und Ticket-Notiz bleiben sichtbar, Weiteres liegt im Menü', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC042');
    await expect(page.getByRole('button', { name: 'Zeitachse' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ticket-Notiz kopieren' })).toBeVisible();
    for (const hidden of ['Drucken / PDF', 'Stand exportieren', 'Mit Stand vergleichen']) {
      await expect(page.getByRole('button', { name: hidden })).toHaveCount(0);
    }
    const menu = await openMoreMenu(page);
    for (const name of ['Drucken / PDF', 'Stand exportieren', 'Mit Stand vergleichen']) {
      await expect(menu.getByRole('menuitem', { name })).toBeVisible();
    }
  });

  test('Menü bleibt im Anzeigebereich und besteht den axe-Check', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC042');
    const menu = await openMoreMenu(page);
    await page.waitForTimeout(500);
    const box = await menu.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    await expectNoSevereViolations(page, 'Menü „Mehr“');
  });
});

test.describe('Hauptnavigation (U4)', () => {
  test('Einträge mit sichtbarem Text, aria-current und unverändertem URL-Zustand', async ({
    page,
  }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
    for (const label of ['Geräte', 'Richtlinien', 'Mandant']) {
      const entry = nav.getByRole('button', { name: label, exact: true });
      await expect(entry).toBeVisible();
      // Sichtbarer Text, keine reine Symbol-Schaltfläche (auch mobil)
      await expect(entry).toHaveText(label);
      expect(await entry.evaluate((el) => el.hasAttribute('aria-label'))).toBe(false);
    }
    await expect(nav.getByRole('button', { name: 'Geräte' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await nav.getByRole('button', { name: 'Mandant' }).click();
    await expect(page).toHaveURL(/view=tenant/);
    await expect(nav.getByRole('button', { name: 'Mandant' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await nav.getByRole('button', { name: 'Richtlinien' }).click();
    await expect(page).toHaveURL(/view=policies/);
    await expect(page.getByRole('heading', { level: 1, name: 'Richtlinien' })).toBeVisible();
    await nav.getByRole('button', { name: 'Geräte' }).click();
    await expect(page).not.toHaveURL(/view=/);
    await expect(page.getByRole('heading', { name: T.heroTitle })).toBeVisible();
  });

  test('Direktlink ?view=policies lädt die nachgeladene Ansicht', async ({ page }) => {
    await page.goto('/?view=policies&mode=demo');
    await expect(page.getByRole('heading', { level: 1, name: 'Richtlinien' })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', {
        name: 'Richtlinien',
      }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('Navigation besteht den axe-Check (label-content-name-mismatch)', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC042');
    const results = await new AxeBuilder({ page })
      .withRules(['label-content-name-mismatch'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
    await expectNoSevereViolations(page, 'Dashboard mit Navigation');
  });
});

test.describe('Startseite (U3)', () => {
  test('Untertitel nennt die Seriennummer wie das Suchfeld', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByText('Gerätenamen, Benutzer oder Seriennummer eingeben', { exact: false }),
    ).toBeVisible();
  });

  test('Beispielgeräte zeigen das Plattform-Symbol (iPhone/Android: Smartphone)', async ({
    page,
  }) => {
    await page.goto('/');
    const iconOf = (name: string) =>
      page
        .getByRole('button', { name: new RegExp(name) })
        .locator('svg')
        .first()
        .getAttribute('class');
    expect(await iconOf('CONTOSO-IP015')).toContain('lucide-smartphone');
    expect(await iconOf('CONTOSO-AND21')).toContain('lucide-smartphone');
    expect(await iconOf('CONTOSO-PC001')).toContain('lucide-laptop');
  });

  test('„Beispiel-ZIP analysieren“ wird nicht abgeschnitten', async ({ page }) => {
    await page.goto('/');
    const label = page.getByText(T.zipChip, { exact: true });
    await expect(label).toBeVisible();
    // Abgeschnittener Text (text-overflow) hätte scrollWidth > clientWidth
    const clipped = await label.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(clipped).toBe(false);
  });
});
