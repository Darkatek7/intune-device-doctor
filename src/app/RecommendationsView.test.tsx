import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de';
import { MockProvider } from '../providers/mock/MockProvider';
import { POSTURE_SECTIONS } from '../rules/posture';
import { renderApp } from '../test/renderApp';

const IDS = POSTURE_SECTIONS.flatMap((section) => section.tiles);
const t = de.posture.view;
const LONG = { timeout: 5000 };

const postureTiles = () =>
  screen
    .queryAllByRole('button')
    .filter((b) => b.getAttribute('data-tile-id')?.startsWith('posture'));
const tileById = (id: string) => postureTiles().find((b) => b.getAttribute('data-tile-id') === id)!;

async function openView(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: de.nav.recommendations }));
  await waitFor(() => expect(postureTiles()).toHaveLength(IDS.length), LONG);
}

describe('Ansicht „Empfehlungen“', () => {
  it('ist über die Navigation erreichbar und zeigt Abschnitte und zwölf Kacheln', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: de.nav.recommendations }));
    expect(
      await screen.findByRole('heading', { level: 1, name: t.title }, LONG),
    ).toBeInTheDocument();
    await waitFor(() => expect(postureTiles()).toHaveLength(12), LONG);
    expect(postureTiles().map((b) => b.getAttribute('data-tile-id'))).toEqual(IDS);
    for (const section of POSTURE_SECTIONS) {
      expect(
        screen.getByRole('heading', { level: 2, name: de.posture.sections[section.key] }),
      ).toBeInTheDocument();
    }
    expect(window.location.search).toContain('view=recommendations');
    expect(window.location.search).not.toContain('level=');
    expect(document.title).toContain(t.title);
    expect(screen.getByText(t.note)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: de.nav.recommendations })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('Gesamtbild nennt Zahlen und hat eine Textalternative', async () => {
    const user = userEvent.setup();
    renderApp();
    await openView(user);
    const score = screen.getByTestId('posture-score');
    expect(within(score).getByText(/^\d+ von \d+ Empfehlungen erfüllt$/)).toBeInTheDocument();
    const bar = within(score).getByRole('img');
    expect(bar.getAttribute('aria-label')).toMatch(
      /\d+ von \d+ erfüllt, \d+ weichen ab, \d+ nicht prüfbar/,
    );
    expect(within(score).getByText(de.posture.view.overall.deviating)).toBeInTheDocument();
  });

  it('Stufenwahl per Tastatur ändert Ergebnis und URL, ohne neu zu laden', async () => {
    let calls = 0;
    const inner = new MockProvider({ latency: false });
    const provider = Object.assign(Object.create(inner) as MockProvider, {
      getTenantPosture: (options?: Parameters<MockProvider['getTenantPosture']>[0]) => {
        calls += 1;
        return inner.getTenantPosture(options);
      },
    });
    const user = userEvent.setup();
    renderApp({ provider });
    await openView(user);

    const group = screen.getByRole('radiogroup', { name: t.level.label });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).toHaveAttribute('tabindex', '0');
    expect(radios[0]).toHaveAttribute('tabindex', '-1');
    expect(screen.getByText(t.level.hint)).toBeInTheDocument();

    const before = tileById('postureAppProtectionAndroid').textContent;
    const scoreBefore = screen.getByTestId('posture-score').textContent;
    radios[1]!.focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(window.location.search).toContain('level=3'));
    expect(within(group).getAllByRole('radio')[2]).toHaveAttribute('aria-checked', 'true');
    expect(within(group).getAllByRole('radio')[2]).toHaveFocus();
    await waitFor(() =>
      expect(tileById('postureAppProtectionAndroid').textContent).not.toBe(before),
    );
    expect(screen.getByTestId('posture-score').textContent).not.toBe(scoreBefore);
    expect(calls).toBe(1);

    await user.keyboard('{ArrowRight}');
    expect(within(group).getAllByRole('radio')[0]).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(window.location.search).toContain('level=1'));
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(window.location.search).not.toContain('level='));
    expect(calls).toBe(1);
  });

  it('eine Kachel öffnet das Detail-Sheet mit Tabelle und Learn-Link; Escape gibt den Fokus zurück', async () => {
    const user = userEvent.setup();
    renderApp();
    await openView(user);
    await user.click(tileById('postureComplianceWindows'));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog).toBeVisible());
    expect(window.location.search).toContain('tile=postureComplianceWindows');
    expect(within(dialog).getAllByRole('table').length).toBeGreaterThan(0);
    expect(
      within(dialog)
        .getAllByRole('link')
        .some((a) => (a.getAttribute('href') ?? '').startsWith('https://learn.microsoft.com')),
    ).toBe(true);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('data-tile-id')).toBe('postureComplianceWindows'),
    );
  });

  it('eine verweigerte Quelle betrifft nur ihre Kachel', async () => {
    const provider = new MockProvider({
      latency: false,
      tenant: { posture: { secureScore: { status: 'forbidden' } } },
    });
    const user = userEvent.setup();
    renderApp({ provider });
    await openView(user);
    expect(
      within(tileById('postureSecureScore')).getByText(de.availability.forbidden),
    ).toBeInTheDocument();
    for (const id of IDS.filter((x) => x !== 'postureSecureScore')) {
      expect(within(tileById(id)).queryByText(de.availability.forbidden)).not.toBeInTheDocument();
    }
    await user.click(tileById('postureComplianceWindows'));
    const other = await screen.findByRole('dialog');
    expect(other.textContent).not.toContain('SecurityEvents.Read.All');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(tileById('postureSecureScore'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('SecurityEvents.Read.All');
  });

  it('ein Fehler des Aufrufs zeigt den Fehlerzustand mit „Erneut versuchen“', async () => {
    const inner = new MockProvider({ latency: false });
    let fail = true;
    const provider = Object.assign(Object.create(inner) as MockProvider, {
      getTenantPosture: (options?: Parameters<MockProvider['getTenantPosture']>[0]) =>
        fail ? Promise.reject(new Error('kaputt')) : inner.getTenantPosture(options),
    });
    window.history.replaceState({}, '', '/?view=recommendations&mode=demo');
    const user = userEvent.setup();
    renderApp({ provider });
    const retry = await screen.findByRole('button', { name: de.errorState.retry }, LONG);
    fail = false;
    await user.click(retry);
    await waitFor(() => expect(postureTiles()).toHaveLength(IDS.length), LONG);
  });

  it('Direktlink mit Stufe und Kachel öffnet das Sheet', async () => {
    window.history.replaceState(
      {},
      '',
      '/?view=recommendations&level=3&tile=postureAppProtectionIos&mode=demo',
    );
    renderApp();
    const dialog = await screen.findByRole('dialog', {}, LONG);
    await waitFor(() => expect(dialog).toBeVisible());
    expect(
      within(screen.getByRole('radiogroup', { name: t.level.label })).getAllByRole('radio')[2],
    ).toHaveAttribute('aria-checked', 'true');
    expect(dialog.textContent).toContain(de.tiles.postureAppProtectionIos);
  });

  it('„Startseite“ führt zurück', async () => {
    const user = userEvent.setup();
    renderApp();
    await openView(user);
    await user.click(screen.getByRole('button', { name: t.back }));
    expect(await screen.findByRole('heading', { name: de.hero.title })).toBeInTheDocument();
    expect(window.location.search).not.toContain('view=');
  });
});
