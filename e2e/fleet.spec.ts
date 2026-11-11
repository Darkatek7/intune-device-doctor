import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import {
  T,
  expect,
  openDevice,
  openTile,
  settleSheet,
  statusBadge,
  tile,
  tileButtons,
  test,
  waitForTilesReady,
} from './helpers';

/**
 * M20: Compliance-Übersicht und Änderungsprotokoll (Ansicht „Mandant“, Richtlinien-Detail), App-Schutz und
 * Remote-Aktionen (Geräteansicht). Demo-Modus, Texte aus src/i18n/de-fleet.ts.
 */
const F = {
  sectionOverview: 'Compliance und Konfiguration',
  sectionChanges: 'Änderungen',
  complianceTile: 'Compliance im Mandanten',
  configurationTile: 'Konfigurationsprofile im Mandanten',
  changesTile: 'Letzte Änderungen',
  policyChanges: 'Änderungen an dieser Richtlinie',
  noCausality: 'Ein Zusammenhang ist möglich, aber nicht belegt.',
  appProtectionTile: 'App-Schutz',
  deviceStatusTile: 'Gerätestatus',
  readOnly: 'MDM Doctor löst selbst keine Aktionen aus',
};

const TENANT_TILE_COUNT = 8;

async function expectNoSevereViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const severe = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  // Sichtbarer Text muss im zugänglichen Namen enthalten sein (WCAG 2.5.3, axe-Regel ist „experimental“)
  const mismatch = await new AxeBuilder({ page })
    .withRules(['label-content-name-mismatch'])
    .analyze();
  const all = [...severe, ...mismatch.violations];
  const details = all
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
    .join('\n');
  expect(all, `a11y-Verstöße bei „${label}“:\n${details}`).toEqual([]);
}

test.describe('Übersicht, Änderungsprotokoll, App-Schutz, Remote-Aktionen (M20)', () => {
  test('Mandant: Abschnitte, Anteilsbalken mit Textalternative und „Letzte Änderungen“', async ({
    page,
  }) => {
    await page.goto('/?view=tenant&mode=demo');
    await expect(tileButtons(page)).toHaveCount(TENANT_TILE_COUNT);
    await expect(page.getByRole('heading', { level: 2, name: F.sectionOverview })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: F.sectionChanges })).toBeVisible();
    await expect(
      page.getByRole('img', { name: /^Anteile Compliance im Mandanten:/ }),
    ).toBeVisible();
    await expect(statusBadge(tile(page, F.complianceTile), T.warning)).toBeVisible();
    await expect(tile(page, F.configurationTile)).toBeVisible();

    await tile(page, F.changesTile).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await settleSheet(page);
    await expect(dialog.getByText('Patch DeviceConfiguration').first()).toHaveAttribute(
      'lang',
      'en',
    );
    await expect(dialog).not.toContainText('203.0.113');
    await expectNoSevereViolations(page, 'Mandant – Letzte Änderungen');
  });

  test('Richtlinien-Detail: Änderungen an „VPN Always On“ mit ruhigem Hinweis ohne Kausalität', async ({
    page,
  }) => {
    await page.goto('/?view=policies&mode=demo');
    await page.getByTestId('policy-row').filter({ hasText: 'Contoso – VPN Always On' }).click();
    const changes = page.getByTestId('policy-changes');
    await expect(changes.getByRole('heading', { name: F.policyChanges })).toBeVisible();
    await expect(changes.getByTestId('policy-change-row')).toHaveCount(2);
    await expect(changes.getByTestId('policy-change-hint')).toContainText(F.noCausality);
    await expectNoSevereViolations(page, 'Richtlinien-Detail mit Änderungen');
  });

  test('App-Schutz: AND21 rootedDevice → Problem; IP015 offen nur über den Benutzer zugeordnet', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-AND21');
    await waitForTilesReady(page);
    await expect(statusBadge(tile(page, F.appProtectionTile), T.critical)).toBeVisible();
    const dialog = await openTile(page, F.appProtectionTile);
    await settleSheet(page);
    await expect(dialog).toContainText('rootedDevice');
    await expectNoSevereViolations(page, 'App-Schutz-Sheet');

    await openDevice(page, 'CONTOSO-IP015');
    await waitForTilesReady(page);
    await expect(statusBadge(tile(page, F.appProtectionTile), T.warning)).toBeVisible();

    await openDevice(page, 'CONTOSO-PC001');
    await waitForTilesReady(page);
    await expect(tile(page, F.appProtectionTile)).toHaveCount(0);
  });

  test('Remote-Aktionen: PC027 mit fehlgeschlagener Aktion im Gerätestatus, App löst nichts aus', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC027');
    await waitForTilesReady(page);
    await expect(statusBadge(tile(page, F.deviceStatusTile), T.warning)).toBeVisible();
    const dialog = await openTile(page, F.deviceStatusTile);
    await settleSheet(page);
    await expect(dialog).toContainText('rebootNow');
    await expect(dialog).toContainText(F.readOnly);
    await expectNoSevereViolations(page, 'Gerätestatus mit Remote-Aktionen');
  });
});
