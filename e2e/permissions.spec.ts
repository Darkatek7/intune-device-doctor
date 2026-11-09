import { T, expect, openDevice, openTile, settleSheet, statusBadge, tile, test } from './helpers';

/** CONTOSO-PC050: Konfigurationsprofile und BitLocker-Schlüssel sind per Graph nicht lesbar (403). */
test.describe('Fehlende Berechtigung (CONTOSO-PC050)', () => {
  test('Richtlinien-Kachel zeigt „Fehlende Berechtigung“ und nennt den Scope im Sheet', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC050');

    const policies = tile(page, 'Richtlinien');
    await expect(statusBadge(policies, T.forbiddenBadge)).toBeVisible();
    await expect(policies).toContainText(T.forbidden);

    const dialog = await openTile(page, 'Richtlinien');
    await settleSheet(page);
    await expect(dialog).toContainText('DeviceManagementConfiguration.Read.All');
    await expect(dialog.getByText(T.forbidden, { exact: true }).first()).toBeVisible();
  });

  test('BitLocker-Kachel zeigt „Fehlende Berechtigung“ und nennt den Scope im Sheet', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC050');

    const bitlocker = tile(page, 'BitLocker');
    await expect(statusBadge(bitlocker, T.forbiddenBadge)).toBeVisible();

    const dialog = await openTile(page, 'BitLocker');
    await settleSheet(page);
    await expect(dialog).toContainText('BitlockerKey.ReadBasic.All');
  });

  const OPTIONAL_SCOPE_CASES = [
    { title: 'Anmeldungen', scope: 'AuditLog.Read.All' },
    { title: 'Lokaler Administrator (LAPS)', scope: 'DeviceLocalCredential.ReadBasic.All' },
    { title: 'Autopilot', scope: 'DeviceManagementServiceConfig.Read.All' },
    { title: 'Sicherheitswarnungen', scope: 'SecurityAlert.Read.All' },
  ] as const;

  for (const { title, scope } of OPTIONAL_SCOPE_CASES) {
    test(`Kachel „${title}“ zeigt „Fehlende Berechtigung“ mit dem optionalen Scope ${scope}`, async ({
      page,
    }) => {
      await openDevice(page, 'CONTOSO-PC050');

      const card = tile(page, title);
      await expect(statusBadge(card, T.forbiddenBadge)).toBeVisible();

      const dialog = await openTile(page, title);
      await settleSheet(page);
      await expect(dialog).toContainText(scope);
      await expect(dialog.getByText(T.forbidden, { exact: true }).first()).toBeVisible();
    });
  }

  test('Gruppen und Integritätsnachweis brauchen keinen optionalen Scope und bleiben nutzbar', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC050');
    await expect(statusBadge(tile(page, 'Gruppen'), T.ok)).toBeVisible();
    await expect(statusBadge(tile(page, 'Integritätsnachweis'), T.ok)).toBeVisible();
  });

  test('übrige Kacheln funktionieren normal (Defender in Ordnung, Sheet ohne Befund)', async ({
    page,
  }) => {
    await openDevice(page, 'CONTOSO-PC050');

    const defender = tile(page, 'Defender');
    await expect(statusBadge(defender, T.ok)).toBeVisible();

    const dialog = await openTile(page, 'Defender');
    await settleSheet(page);
    await expect(dialog.getByRole('heading', { name: T.allGood })).toBeVisible();
    await expect(dialog.getByText(T.forbidden, { exact: true })).toHaveCount(0);
  });
});
