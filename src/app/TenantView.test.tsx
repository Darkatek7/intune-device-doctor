import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de';
import { MockProvider } from '../providers/mock/MockProvider';
import { renderApp } from '../test/renderApp';

const tenantTiles = () =>
  screen
    .queryAllByRole('button')
    .filter((b) => b.getAttribute('data-tile-id')?.startsWith('tenant'));

async function openTenant(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: de.toolbar.tenant }));
}

describe('Ansicht „Mandant“', () => {
  it('ist über die Toolbar erreichbar, schreibt ?view=tenant und zeigt die drei Kacheln', async () => {
    const user = userEvent.setup();
    renderApp();
    await openTenant(user);

    expect(
      await screen.findByRole('heading', { level: 1, name: de.tenantView.title }),
    ).toBeInTheDocument();
    await waitFor(() => expect(tenantTiles()).toHaveLength(3));
    expect(window.location.search).toContain('view=tenant');
    expect(window.location.search).not.toContain('device=');
    expect(tenantTiles().map((b) => b.getAttribute('data-tile-id'))).toEqual([
      'tenantApplePush',
      'tenantVpp',
      'tenantUnavailable',
    ]);
  });

  it('Demo: VPP-Tokens zeigen „1 Token prüfen“ (Ablauf in 20 Tagen), Detail-Sheet mit Befund und Tabelle', async () => {
    const user = userEvent.setup();
    renderApp();
    await openTenant(user);
    await waitFor(() => expect(tenantTiles()).toHaveLength(3));

    const vpp = tenantTiles().find((b) => b.getAttribute('data-tile-id') === 'tenantVpp')!;
    expect(vpp).toHaveAttribute('data-severity', 'warning');
    expect(within(vpp).getByText(de.rules.tenant.vpp.valueProblems(1))).toBeInTheDocument();

    await user.click(vpp);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/läuft .* ab/)).toBeInTheDocument();
    expect(within(dialog).getByText(de.rules.tenant.vpp.overviewTitle)).toBeInTheDocument();
    expect(window.location.search).toContain('tile=tenantVpp');
  });

  it('Deep-Link ?view=tenant öffnet die Ansicht direkt', async () => {
    window.history.replaceState({}, '', '/?view=tenant&mode=demo');
    renderApp();
    expect(
      await screen.findByRole('heading', { level: 1, name: de.tenantView.title }),
    ).toBeInTheDocument();
    await waitFor(() => expect(tenantTiles()).toHaveLength(3));
  });

  it('eine fehlende Berechtigung betrifft nur die VPP-Kachel', async () => {
    const provider = new MockProvider({
      latency: false,
      tenant: { vppTokens: { status: 'forbidden' } },
    });
    const user = userEvent.setup();
    renderApp({ provider });
    await openTenant(user);
    await waitFor(() => expect(tenantTiles()).toHaveLength(3));

    const byId = (id: string) => tenantTiles().find((b) => b.getAttribute('data-tile-id') === id)!;
    expect(within(byId('tenantVpp')).getByText(de.availability.forbidden)).toBeInTheDocument();
    expect(byId('tenantApplePush')).toHaveAttribute('data-severity', 'ok');
  });

  it('„Startseite“ führt zurück; eine Suche verlässt die Ansicht', async () => {
    const user = userEvent.setup();
    renderApp();
    await openTenant(user);
    await screen.findByRole('heading', { level: 1, name: de.tenantView.title });

    const input = screen.getByRole('combobox', { name: de.field.label });
    await user.type(input, 'CONTOSO-PC001{Enter}');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'CONTOSO-PC001' }),
    ).toBeInTheDocument();
    expect(window.location.search).not.toContain('view=tenant');

    await openTenant(user);
    await user.click(await screen.findByRole('button', { name: de.tenantView.back }));
    expect(await screen.findByRole('heading', { name: de.hero.title })).toBeInTheDocument();
    expect(window.location.search).not.toContain('view=tenant');
  });

  it('„Aktualisieren“ lädt den Status erneut', async () => {
    let calls = 0;
    const inner = new MockProvider({ latency: false });
    const provider = Object.assign(Object.create(inner) as MockProvider, {
      getTenantStatus: (options?: Parameters<MockProvider['getTenantStatus']>[0]) => {
        calls += 1;
        return inner.getTenantStatus(options);
      },
    });
    const user = userEvent.setup();
    renderApp({ provider });
    await openTenant(user);
    await waitFor(() => expect(tenantTiles()).toHaveLength(3));
    expect(calls).toBe(1);
    await user.click(screen.getByRole('button', { name: de.tenantView.refresh }));
    await waitFor(() => expect(calls).toBe(2));
    await waitFor(() => expect(tenantTiles()).toHaveLength(3));
  });
});
