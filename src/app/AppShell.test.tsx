import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de';
import { renderApp } from '../test/renderApp';

async function search(user: ReturnType<typeof userEvent.setup>, query: string) {
  const input = screen.getByRole('combobox', { name: de.field.label });
  await user.clear(input);
  await user.type(input, `${query}{Enter}`);
}

const tileButtons = () =>
  screen.queryAllByRole('button').filter((b) => b.getAttribute('aria-haspopup') === 'dialog');

describe('AppShell', () => {
  it('zeigt nach der Suche 7 Kacheln und schreibt den URL-State', async () => {
    const user = userEvent.setup();
    renderApp();
    await search(user, 'CONTOSO-PC001');

    await waitFor(() => expect(tileButtons()).toHaveLength(7));
    expect(screen.getByRole('heading', { level: 1, name: 'CONTOSO-PC001' })).toBeInTheDocument();
    expect(window.location.search).toMatch(/device=.+&mode=demo/);
  });

  it('lädt ein Beispielgerät per Chip', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /CONTOSO-PC014/ }));
    await waitFor(() => expect(tileButtons()).toHaveLength(7));
    expect(screen.getByRole('heading', { level: 1, name: 'CONTOSO-PC014' })).toBeInTheDocument();
  });

  it('zeigt bei mehrdeutiger Suche eine Auswahlliste und lädt das gewählte Gerät', async () => {
    const user = userEvent.setup();
    renderApp();
    await search(user, 'contoso-pc0');

    const list = await screen.findByRole('list', { name: de.picker.list });
    expect(within(list).getAllByRole('button').length).toBeGreaterThan(1);

    await user.click(within(list).getByRole('button', { name: de.picker.select('CONTOSO-PC042') }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'CONTOSO-PC042' }),
    ).toBeInTheDocument();
  });

  it('zeigt für unbekannte Namen einen freundlichen Leerzustand', async () => {
    const user = userEvent.setup();
    renderApp();
    await search(user, 'gibt-es-nicht');
    expect(
      await screen.findByRole('heading', { name: de.empty.notFoundTitle }),
    ).toBeInTheDocument();
    expect(screen.getByText(de.empty.notFoundBody('gibt-es-nicht'))).toBeInTheDocument();
  });

  it('öffnet eine Kachel per Tastatur, Escape schließt, Fokus kehrt zur Kachel zurück', async () => {
    const user = userEvent.setup();
    renderApp();
    await search(user, 'CONTOSO-PC014');
    await waitFor(() => expect(tileButtons()).toHaveLength(7));

    const tile = document.querySelector<HTMLButtonElement>('[data-tile-id="bitlocker"]')!;
    tile.focus();
    await user.keyboard('{Enter}');

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(tile.querySelector('span span:last-child')!.textContent!);
    expect(window.location.search).toContain('tile=bitlocker');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(tile).toHaveFocus());
    expect(window.location.search).not.toContain('tile=');
  });

  it('Browser-Zurück schließt das Sheet und kehrt danach zur Suche zurück', async () => {
    const user = userEvent.setup();
    renderApp();
    await search(user, 'CONTOSO-PC001');
    await waitFor(() => expect(tileButtons()).toHaveLength(7));

    await user.click(document.querySelector<HTMLButtonElement>('[data-tile-id="compliance"]')!);
    await screen.findByRole('dialog');

    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 30));
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(tileButtons()).toHaveLength(7);

    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(await screen.findByRole('heading', { name: de.hero.title })).toBeInTheDocument();
  });

  it('Live ist ohne Konfiguration deaktiviert (aria-disabled + Hinweis)', async () => {
    const user = userEvent.setup();
    renderApp();
    const live = screen.getByRole('radio', { name: de.mode.live });
    expect(live).toHaveAttribute('aria-disabled', 'true');
    expect(live).toHaveAttribute('title', de.mode.liveNotConfigured);
    await user.click(live);
    expect(screen.getByRole('radio', { name: de.mode.demo })).toBeChecked();
  });

  it('zeigt einen Hinweis, wenn Live gewählt ist, aber noch kein Provider existiert', async () => {
    const user = userEvent.setup();
    renderApp({ liveAvailable: true });
    await user.click(screen.getByRole('radio', { name: de.mode.live }));
    expect(
      await screen.findByRole('heading', { name: de.empty.liveUnavailableTitle }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: de.empty.switchToDemo }));
    expect(await screen.findByRole('heading', { name: de.hero.title })).toBeInTheDocument();
  });

  it('stellt Gerät und offenes Sheet aus der URL wieder her', async () => {
    const user = userEvent.setup();
    const first = renderApp();
    await search(user, 'CONTOSO-PC001');
    await waitFor(() => expect(tileButtons()).toHaveLength(7));
    await user.click(document.querySelector<HTMLButtonElement>('[data-tile-id="checkIn"]')!);
    await screen.findByRole('dialog');
    first.unmount();

    renderApp();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'CONTOSO-PC001' }),
    ).toBeInTheDocument();
  });

  it('fokussiert das Suchfeld per Strg+K', async () => {
    const user = userEvent.setup();
    renderApp();
    await search(user, 'CONTOSO-PC001');
    await waitFor(() => expect(tileButtons()).toHaveLength(7));
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('combobox', { name: de.field.label })).toHaveFocus();
  });
});
