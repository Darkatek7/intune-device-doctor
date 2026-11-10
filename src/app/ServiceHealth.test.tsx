/**
 * M18: Hinweis „Microsoft meldet aktuell eine Störung bei Intune“ in der Geräteansicht, Verweis auf die
 * Registrierungsfehler bei einer Suche ohne Treffer, Kacheln der Ansicht „Mandant“.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { de } from '../i18n/de';
import { MockProvider } from '../providers/mock/MockProvider';
import { defaultServiceHealth, healthyServiceHealth } from '../providers/mock/service';
import type { MockTenantFixture } from '../providers/mock/types';
import { renderApp } from '../test/renderApp';

const n = de.service.health.notice;

async function search(user: ReturnType<typeof userEvent.setup>, query: string) {
  const input = screen.getByRole('combobox', { name: de.field.label });
  await user.clear(input);
  await user.type(input, `${query}{Enter}`);
}

const provider = (tenant: MockTenantFixture = {}) => new MockProvider({ latency: false, tenant });

afterEach(() => window.sessionStorage.clear());

describe('Dienststatus-Hinweis in der Geräteansicht (M18)', () => {
  it('Demo: zeigt den offenen Intune-Vorfall (Originaltitel lang="en") und springt zum Dienststatus', async () => {
    const user = userEvent.setup();
    renderApp({ provider: provider() });
    await search(user, 'CONTOSO-PC001');
    const notice = await screen.findByRole('complementary', { name: n.label });
    expect(within(notice).getByText(n.text, { exact: false })).toBeInTheDocument();
    const title = within(notice).getByText(/unable to enroll new Windows devices/);
    expect(title).toHaveAttribute('lang', 'en');

    await user.click(within(notice).getByRole('button', { name: n.open }));
    expect(
      await screen.findByRole('heading', { level: 1, name: de.tenantView.title }),
    ).toBeInTheDocument();
    const dialog = await screen.findByRole('dialog');
    // Das Sheet blendet ein (Opacity) – erst danach gilt die Überschrift als sichtbar.
    await waitFor(() =>
      expect(
        within(dialog).getByRole('heading', { name: de.tiles.tenantServiceHealth }),
      ).toBeVisible(),
    );
    expect(window.location.search).toContain('tile=tenantServiceHealth');
    // Englischer Originaltitel des Vorfalls im Sheet mit lang="en"
    const issueTitle = within(dialog).getByRole('heading', {
      name: /unable to enroll new Windows devices/,
    });
    expect(issueTitle).toHaveAttribute('lang', 'en');
  });

  it('kein Hinweis, wenn alles in Ordnung ist oder die Berechtigung fehlt – und kein Fehler', async () => {
    for (const tenant of [
      { serviceHealth: { status: 'ok', data: healthyServiceHealth(new Date()) } },
      { serviceHealth: { status: 'forbidden' } },
    ] satisfies MockTenantFixture[]) {
      const user = userEvent.setup();
      const view = renderApp({ provider: provider(tenant) });
      await search(user, 'CONTOSO-PC001');
      await screen.findByRole('heading', { level: 1, name: 'CONTOSO-PC001' });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(screen.queryByRole('complementary', { name: n.label })).not.toBeInTheDocument();
      expect(screen.queryByText(de.availability.forbidden)).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it('lädt den Dienststatus einmal pro Sitzung (Gerätewechsel ohne neuen Abruf)', async () => {
    const p = provider();
    const spy = vi.spyOn(p, 'getServiceHealth');
    const user = userEvent.setup();
    renderApp({ provider: p });
    await search(user, 'CONTOSO-PC001');
    await screen.findByRole('complementary', { name: n.label });
    await search(user, 'CONTOSO-PC014');
    await screen.findByRole('heading', { level: 1, name: 'CONTOSO-PC014' });
    await screen.findByRole('complementary', { name: n.label });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('„Ausblenden“ gilt für die Sitzung, auch nach Gerätewechsel und Neuladen', async () => {
    const user = userEvent.setup();
    const first = renderApp({ provider: provider() });
    await search(user, 'CONTOSO-PC001');
    const notice = await screen.findByRole('complementary', { name: n.label });
    await user.click(within(notice).getByRole('button', { name: n.dismiss }));
    expect(screen.queryByRole('complementary', { name: n.label })).not.toBeInTheDocument();

    await search(user, 'CONTOSO-PC014');
    await screen.findByRole('heading', { level: 1, name: 'CONTOSO-PC014' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('complementary', { name: n.label })).not.toBeInTheDocument();
    first.unmount();

    // „Neuladen“: neue App-Instanz, neuer Provider – sessionStorage bleibt
    renderApp({ provider: provider() });
    await search(user, 'CONTOSO-PC001');
    await screen.findByRole('heading', { level: 1, name: 'CONTOSO-PC001' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('complementary', { name: n.label })).not.toBeInTheDocument();
  });

  it('ein weiterer Vorfall bringt den ausgeblendeten Hinweis zurück', async () => {
    const user = userEvent.setup();
    const first = renderApp({ provider: provider() });
    await search(user, 'CONTOSO-PC001');
    const notice = await screen.findByRole('complementary', { name: n.label });
    await user.click(within(notice).getByRole('button', { name: n.dismiss }));
    first.unmount();

    const health = defaultServiceHealth(new Date());
    const intune = health.services.find(
      (service) => service.kind === 'intune' && service.openIssues.length > 0,
    )!;
    const incident = intune.openIssues.find((issue) => issue.classification === 'incident')!;
    intune.openIssues.push({ ...incident, id: 'IT999999' });
    renderApp({ provider: provider({ serviceHealth: { status: 'ok', data: health } }) });
    await search(user, 'CONTOSO-PC001');
    expect(await screen.findByRole('complementary', { name: n.label })).toBeInTheDocument();
  });
});

describe('Suche ohne Treffer → Registrierungsfehler (M18)', () => {
  it('zeigt den Verweis und öffnet die Kachel „Registrierungsfehler“ in der Ansicht „Mandant“', async () => {
    const user = userEvent.setup();
    renderApp({ provider: provider() });
    await search(user, 'gibt-es-nicht');
    await screen.findByRole('heading', { name: de.empty.notFoundTitle });
    expect(screen.getByText(de.service.failures.searchHint.text, { exact: false })).toBeVisible();
    await user.click(screen.getByRole('button', { name: de.service.failures.searchHint.link }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(
        within(dialog).getByRole('heading', { name: de.tiles.tenantEnrollmentFailures }),
      ).toBeVisible(),
    );
    expect(window.location.search).toContain('view=tenant');
    expect(window.location.search).toContain('tile=tenantEnrollmentFailures');
    expect(
      within(dialog).getByText(
        de.service.failures.categoryTitle(de.service.failures.category.userValidation, 2),
      ),
    ).toBeInTheDocument();
  });
});

describe('Ansicht „Mandant“ – neue Kacheln (M18)', () => {
  const tiles = () =>
    screen
      .queryAllByRole('button')
      .filter((b) => b.getAttribute('data-tile-id')?.startsWith('tenant'));
  const byId = (id: string) => tiles().find((b) => b.getAttribute('data-tile-id') === id)!;

  it('Demo: Dienststatus „Prüfen“ (offener Vorfall), Registrierungsfehler mit Anzahl', async () => {
    window.history.replaceState({}, '', '/?view=tenant&mode=demo');
    renderApp({ provider: provider() });
    await waitFor(() => expect(tiles()).toHaveLength(5));
    expect(byId('tenantServiceHealth')).toHaveAttribute('data-severity', 'warning');
    expect(
      within(byId('tenantServiceHealth')).getByText(de.service.health.valueIssues(2)),
    ).toBeInTheDocument();
    expect(byId('tenantEnrollmentFailures')).toHaveAttribute('data-severity', 'warning');
    expect(
      within(byId('tenantEnrollmentFailures')).getByText(de.service.failures.valueCount(7)),
    ).toBeInTheDocument();
  });

  it('fehlende Berechtigung für den Dienststatus betrifft nur seine Kachel', async () => {
    window.history.replaceState({}, '', '/?view=tenant&mode=demo');
    renderApp({ provider: provider({ serviceHealth: { status: 'forbidden' } }) });
    await waitFor(() => expect(tiles()).toHaveLength(5));
    expect(
      within(byId('tenantServiceHealth')).getByText(de.availability.forbidden),
    ).toBeInTheDocument();
    expect(byId('tenantEnrollmentFailures')).toHaveAttribute('data-severity', 'warning');
    expect(byId('tenantApplePush')).toHaveAttribute('data-severity', 'ok');
  });
});
