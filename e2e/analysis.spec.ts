import AxeBuilder from '@axe-core/playwright';
import { T, expect, openDevice, settleSheet, test, tile, waitForTilesReady } from './helpers';

/** Texte aus src/i18n/de-analysis.ts */
const A = {
  timelineButton: 'Zeitachse',
  timelineList: 'Ereignisse der Zeitachse',
  onlyProblems: 'Nur Probleme',
  allEvents: 'Alle Ereignisse',
  planned: 'Geplant',
  insightHeading: 'Wahrscheinlichste Ursache',
  insightNote: 'Automatische Einschätzung aus den angezeigten Befunden.',
  why: 'Warum?',
  docs: 'Microsoft-Dokumentation',
} as const;

const timelineButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: A.timelineButton, exact: true });

test.describe('Zeitachse', () => {
  test('PC014: Dialog mit Liste, Filter „Nur Probleme“ und Sprung zur Kachel „Anmeldungen“', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC014');
    await timelineButton(page).click();

    const dialog = page.getByRole('dialog', { name: A.timelineButton });
    await expect(dialog).toBeVisible();
    const list = dialog.getByRole('list', { name: A.timelineList });
    await expect(list.locator('time').first()).toBeVisible();
    const all = await list.locator('time').count();
    expect(all).toBeGreaterThan(5);

    await dialog.getByRole('button', { name: A.onlyProblems }).click();
    const problems = await list.locator('time').count();
    expect(problems).toBeGreaterThan(0);
    expect(problems).toBeLessThan(all);
    await expect(
      dialog.getByText(T.warning).or(dialog.getByText(T.critical)).first(),
    ).toBeAttached();

    // Klick auf einen blockierten Anmeldeversuch öffnet die Kachel „Anmeldungen“
    await dialog
      .getByRole('button', { name: /Anmeldung blockiert.*Kachel „Anmeldungen“/ })
      .first()
      .click();
    const sheet = page.getByRole('dialog', { name: 'Anmeldungen' });
    await expect(sheet).toBeVisible();
    await expect(page.getByRole('dialog', { name: A.timelineButton })).toHaveCount(0);
    await settleSheet(page);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('Escape schließt die Zeitachse, Fokus kehrt zur Schaltfläche zurück', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC001');
    await timelineButton(page).click();
    const dialog = page.getByRole('dialog', { name: A.timelineButton });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(timelineButton(page)).toBeFocused();
  });

  test('geplante Termine (z. B. LAPS-Rotation) sind markiert', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC001');
    await timelineButton(page).click();
    const dialog = page.getByRole('dialog', { name: A.timelineButton });
    await expect(dialog.getByText(A.planned, { exact: true }).first()).toBeVisible();
  });

  test('DiagLogs-ZIP: Zeitachse mit Sammelzeitpunkt und MDM-Ereignissen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(T.zipChip) }).click();
    await waitForTilesReady(page);
    await timelineButton(page).click();
    const dialog = page.getByRole('dialog', { name: A.timelineButton });
    await expect(dialog).toContainText('Diagnosedaten gesammelt');
    await expect(dialog).toContainText('MDM-Ereignis 76');
    await dialog.getByRole('button', { name: /MDM-Ereignis 76.*Kachel „MDM-Ereignisse“/ }).click();
    await expect(page.getByRole('dialog', { name: 'MDM-Ereignisse' })).toBeVisible();
  });

  test('Zeitachse besteht den axe-Check', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC014');
    await timelineButton(page).click();
    await expect(page.getByRole('dialog', { name: A.timelineButton })).toBeVisible();
    await settleSheet(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});

test.describe('Wahrscheinlichste Ursache', () => {
  test('PC014 (nicht konform + CA 53000): Karte mit „Warum?“, Hinweis, Quelle und Kachel-Link', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC014');
    const card = page.getByTestId('insight-card');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { name: A.insightHeading })).toBeVisible();
    await expect(card).toContainText(A.insightNote);
    await expect(card).toContainText('Zuerst die Compliance herstellen');

    await card.getByText(A.why, { exact: true }).click();
    await expect(card.getByRole('link', { name: A.docs })).toHaveAttribute(
      'href',
      /^https:\/\/learn\.microsoft\.com\//,
    );

    await card.getByRole('button', { name: 'Kachel „Compliance“ öffnen' }).click();
    await expect(page.getByRole('dialog', { name: 'Compliance' })).toBeVisible();
  });

  test('PC033 (41 Tage ohne Check-in): „Befunde evtl. veraltet“', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC033');
    await expect(page.getByTestId('insight-card')).toContainText('Befunde sind evtl. veraltet');
  });

  test('gesundes Gerät (PC001), PC042 (nur Schonfrist) und PC050 (forbidden): keine Karte', async ({
    page,
  }) => {
    for (const name of ['CONTOSO-PC001', 'CONTOSO-PC042', 'CONTOSO-PC050']) {
      await openDevice(page, name);
      await expect(page.getByTestId('insight-card'), name).toHaveCount(0);
    }
  });

  test('Ticket-Notiz enthält die Ursache oben und die Zeitachse unten', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC014');
    await page.getByRole('button', { name: 'Ticket-Notiz kopieren' }).click();
    // Zwischenablage ist im Test nicht erlaubt → Fallback-Dialog mit dem Text
    const text = page.getByRole('textbox');
    await expect(text).toBeVisible();
    const note = await text.inputValue();
    expect(note).toContain('### Wahrscheinlichste Ursache');
    expect(note.indexOf('Wahrscheinlichste Ursache')).toBeLessThan(note.indexOf('### Status'));
    expect(note).toContain('### Zeitachse (letzte Probleme)');
  });

  test('Karte besteht den axe-Check', async ({ page }) => {
    await openDevice(page, 'CONTOSO-PC014');
    await expect(tile(page, 'Compliance')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
