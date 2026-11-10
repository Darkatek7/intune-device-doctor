import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test, waitForTilesReady } from './helpers';

/** Ansicht „Richtlinien“ (M15): Richtlinie → betroffene Geräte, Demo-Modus. Texte aus src/i18n/de-policies.ts. */
const P = {
  toolbar: 'Richtlinien',
  title: 'Richtlinien',
  filter: 'Richtlinien nach Namen filtern',
  back: 'Alle Richtlinien',
  onlyProblems: 'Nur Probleme',
  all: 'Alle Geräte',
  beta: 'Über dokumentierte API nicht verfügbar',
} as const;

const rows = (page: Page) => page.getByTestId('policy-row');
const statusRows = (page: Page) => page.getByTestId('policy-status-row');

async function openPolicies(page: Page): Promise<void> {
  await page.goto('/');
  // exakter Name: sichtbarer Text = Vorlesename (WCAG 2.5.3)
  await page.getByRole('button', { name: P.toolbar, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: P.title })).toBeVisible();
  await expect(rows(page).first()).toBeVisible();
}

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

test.describe('Ansicht „Richtlinien“', () => {
  test('Toolbar öffnet die Liste, sortiert nach Problemen, mit Namensfilter und Beta-Hinweis', async ({
    page,
  }) => {
    await openPolicies(page);
    await expect(page).toHaveURL(/view=policies/);
    await expect(rows(page).first()).toHaveAttribute('data-severity', 'critical');
    await expect(page.getByText(P.beta)).toBeVisible();

    await page.getByRole('searchbox', { name: P.filter }).fill('vpn');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Contoso – VPN Always On');
    await expect(rows(page).first()).toContainText('1 Fehler');
  });

  test('Gerätestatus: nur Probleme, alle Geräte, Zurück-Navigation', async ({ page }) => {
    await openPolicies(page);
    await rows(page).filter({ hasText: 'Contoso – Windows 11 Basis-Compliance' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Contoso – Windows 11 Basis-Compliance' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/policy=compliance%3A/);
    await expect(statusRows(page)).toHaveCount(1);
    await expect(statusRows(page).first()).toContainText('CONTOSO-PC042');
    await expect(statusRows(page).first()).toContainText('Nicht konform');
    await expect(page.getByRole('button', { name: P.onlyProblems })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', { name: P.all }).click();
    await expect.poll(() => statusRows(page).count()).toBeGreaterThan(1);

    // Browser-Zurück schließt die Richtlinie und bleibt in der Ansicht
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: P.title })).toBeVisible();
    await expect(page).not.toHaveURL(/policy=/);
    await page.goForward();
    await page.getByRole('button', { name: P.back }).click();
    await expect(page.getByRole('heading', { level: 1, name: P.title })).toBeVisible();
  });

  test('Gerätename öffnet die Geräteansicht über die Suche; Zurück führt zur Richtlinie', async ({
    page,
  }) => {
    await openPolicies(page);
    await rows(page).filter({ hasText: 'Contoso – VPN Always On' }).click();
    await page.getByRole('button', { name: 'CONTOSO-PC042', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'CONTOSO-PC042' })).toBeVisible();
    await waitForTilesReady(page);
    await expect(page).toHaveURL(/device=/);

    await page.goBack();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Contoso – VPN Always On' }),
    ).toBeVisible();
  });

  test('keine horizontale Scrollleiste der Seite (auch mobil)', async ({ page }) => {
    await openPolicies(page);
    const overflow = await page.evaluate<number>(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('Barrierefreiheit: Liste und Gerätestatus ohne schwere axe-Verstöße', async ({ page }) => {
    await openPolicies(page);
    await page.waitForTimeout(500);
    await expectNoSevereViolations(page, 'Richtlinien-Liste');
    await rows(page).filter({ hasText: 'Contoso – Edge Sicherheitsbaseline' }).click();
    await expect(statusRows(page).first()).toBeVisible();
    await page.waitForTimeout(500);
    await expectNoSevereViolations(page, 'Gerätestatus');
  });
});
