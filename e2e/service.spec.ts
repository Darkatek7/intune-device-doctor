import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import {
  T,
  expect,
  openDevice,
  searchDevice,
  settleSheet,
  statusBadge,
  tile,
  tileButtons,
  test,
  waitForTilesReady,
} from './helpers';

/**
 * M18: Dienststatus (Hinweis in der Geräteansicht, Kachel in „Mandant“) und Registrierungsfehler
 * (Kachel in „Mandant“, Verweis bei einer Suche ohne Treffer). Demo-Modus, Texte aus src/i18n/de-service.ts.
 */
const S = {
  noticeLabel: 'Hinweis von Microsoft',
  noticeText: 'Microsoft meldet aktuell eine Störung bei Intune:',
  noticeOpen: 'Dienststatus ansehen',
  noticeDismiss: 'Ausblenden',
  serviceTile: 'Dienststatus',
  failuresTile: 'Registrierungsfehler',
  hint: 'Registrierungsfehler im Mandanten ansehen',
  incidentTitle: 'Some users may be unable to enroll new Windows devices in Microsoft Intune',
};

async function expectNoSevereViolations(page: Page, label: string) {
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

test.describe('Dienststatus und Registrierungsfehler (M18)', () => {
  test('Geräteansicht: Hinweis auf den offenen Intune-Vorfall springt in den Dienststatus', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC001');
    const notice = page.getByRole('complementary', { name: S.noticeLabel });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(S.noticeText);
    await expect(notice.getByText(S.incidentTitle)).toHaveAttribute('lang', 'en');

    await notice.getByRole('button', { name: S.noticeOpen }).click();
    await expect(page).toHaveURL(/view=tenant/);
    await expect(page).toHaveURL(/tile=tenantServiceHealth/);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await settleSheet(page);
    await expect(dialog.getByRole('heading', { name: S.incidentTitle })).toHaveAttribute(
      'lang',
      'en',
    );
    await expect(dialog.getByRole('heading', { name: T.remediation }).first()).toBeVisible();
  });

  test('Hinweis lässt sich für die Sitzung ausblenden (bleibt nach Neuladen und Gerätewechsel weg)', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC001');
    const notice = page.getByRole('complementary', { name: S.noticeLabel });
    await expect(notice).toBeVisible();
    await notice.getByRole('button', { name: S.noticeDismiss }).click();
    await expect(notice).toHaveCount(0);

    await page.reload();
    await waitForTilesReady(page);
    await expect(notice).toHaveCount(0);
    await openDevice(page, 'CONTOSO-PC014');
    await expect(notice).toHaveCount(0);
    // Die Kachel „Dienststatus“ in der Ansicht „Mandant“ bleibt davon unberührt
    await page.goto('/?view=tenant&mode=demo');
    await expect(tile(page, S.serviceTile)).toBeVisible();
  });

  test('Mandant: Dienststatus „Prüfen“, Registrierungsfehler nach Kategorie mit Ursache und Lösung', async ({
    page,
  }) => {
    await page.goto('/?view=tenant&mode=demo');
    await expect(tileButtons(page)).toHaveCount(5);
    await expect(statusBadge(tile(page, S.serviceTile), T.warning)).toBeVisible();
    await expect(statusBadge(tile(page, S.failuresTile), T.warning)).toBeVisible();

    await tile(page, S.failuresTile).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await settleSheet(page);
    await expect(dialog.getByText('Benutzerprüfung: 2 Fehlschläge')).toBeVisible();
    await expect(dialog.getByRole('heading', { name: T.cause }).first()).toBeVisible();
    await expect(dialog.getByText('Jüngste fehlgeschlagene Registrierungen')).toBeVisible();
  });

  test('Suche ohne Treffer verweist auf die Registrierungsfehler im Mandanten', async ({
    page,
  }) => {
    await page.goto('/');
    await searchDevice(page, 'CONTOSO-PC999');
    await expect(page.getByRole('heading', { name: 'Kein Gerät gefunden' })).toBeVisible();
    await page.getByRole('button', { name: S.hint }).click();
    await expect(page).toHaveURL(/tile=tenantEnrollmentFailures/);
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('Barrierefreiheit: Hinweis, Mandant und „nicht gefunden“ ohne schwere axe-Verstöße', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC001');
    await expect(page.getByRole('complementary', { name: S.noticeLabel })).toBeVisible();
    await page.waitForTimeout(500);
    await expectNoSevereViolations(page, 'Geräteansicht mit Dienststatus-Hinweis');

    await page.goto('/?view=tenant&mode=demo');
    await expect(tileButtons(page)).toHaveCount(5);
    await tile(page, S.serviceTile).click();
    await settleSheet(page);
    await expectNoSevereViolations(page, 'Dienststatus-Sheet');

    await page.goto('/');
    await searchDevice(page, 'CONTOSO-PC999');
    await expect(page.getByRole('button', { name: S.hint })).toBeVisible();
    await expectNoSevereViolations(page, 'Kein Gerät gefunden');
  });
});
