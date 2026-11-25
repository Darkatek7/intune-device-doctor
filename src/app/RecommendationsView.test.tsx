import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadTextFile } from '../lib/download';
import { de } from '../i18n/de';
import { MockProvider } from '../providers/mock/MockProvider';
import { POSTURE_CATALOG_STALE_AFTER_DAYS, POSTURE_SECTIONS } from '../rules/posture';
import { renderApp } from '../test/renderApp';

vi.mock('../lib/download', () => ({ downloadTextFile: vi.fn() }));

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(downloadTextFile).mockClear();
});

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
    // Je Abschnitt stehen auffällige Kacheln zuerst – deshalb ohne Reihenfolge vergleichen.
    expect(
      postureTiles()
        .map((b) => b.getAttribute('data-tile-id'))
        .sort(),
    ).toEqual([...IDS].sort());
    // Die unauffällige iOS-Kachel steht in ihrem Abschnitt hinter den auffälligen.
    const order = postureTiles().map((b) => b.getAttribute('data-tile-id'));
    expect(order.indexOf('postureComplianceIos')).toBeGreaterThan(
      order.indexOf('postureComplianceMacos'),
    );
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
        .some((a) => new URL((a as HTMLAnchorElement).href).hostname === 'learn.microsoft.com'),
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

  it('das Detail-Sheet listet jede Prüfung der Kachel, auch erfüllte, mit eigenem Learn-Link', async () => {
    const user = userEvent.setup();
    renderApp();
    await openView(user);
    await user.click(tileById('postureComplianceWindows'));
    const dialog = await screen.findByRole('dialog');
    const list = within(dialog).getByTestId('posture-check-list');
    await user.click(within(list).getByRole('radio', { name: /^Alle/ }));
    const rows = within(list).getAllByTestId('posture-check');
    const statuses = new Set(rows.map((row) => row.getAttribute('data-status')));
    expect(statuses.has('met')).toBe(true);
    expect(statuses.has('deviating')).toBe(true);
    for (const row of rows) {
      const link = within(row).getByRole('link');
      expect(link.getAttribute('href')).toMatch(/^https:\/\/learn\.microsoft\.com\//);
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    const counts = within(list)
      .getAllByRole('radio')
      .map((r) => Number(/\((\d+)\)/.exec(r.textContent ?? '')![1]));
    expect(counts[3]).toBe(rows.length);
    expect(counts[0]! + counts[1]! + counts[2]!).toBe(rows.length);
  });

  it('„Exportieren (CSV)“ lädt die angezeigten Prüfungen unter dem erwarteten Dateinamen', async () => {
    const user = userEvent.setup();
    renderApp();
    await openView(user);
    await user.click(screen.getByRole('button', { name: t.export.button }));
    expect(downloadTextFile).toHaveBeenCalledTimes(1);
    const [fileName, text, mime] = vi.mocked(downloadTextFile).mock.calls[0]!;
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    expect(fileName).toBe(
      `mdm-doctor-empfehlungen-stufe-2-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`,
    );
    expect(mime).toContain('text/csv');
    expect(text.startsWith('\uFEFF"Abschnitt";"Kachel"')).toBe(true);
    expect(text.split('\r\n').length).toBeGreaterThan(20);
  });

  it('der Export-Knopf ist während des Ladens deaktiviert', async () => {
    const inner = new MockProvider({ latency: false });
    const provider = Object.assign(Object.create(inner) as MockProvider, {
      getTenantPosture: () => new Promise<never>(() => {}),
    });
    window.history.replaceState({}, '', '/?view=recommendations&mode=demo');
    renderApp({ provider });
    expect(await screen.findByRole('button', { name: t.export.button })).toBeDisabled();
  });

  it('nennt den Stand der Sollwerte, ohne Warnung solange der Katalog aktuell ist', async () => {
    const user = userEvent.setup();
    renderApp();
    await openView(user);
    const note = screen.getByTestId('posture-catalog-note');
    expect(note.textContent).toContain('Stand 25.11.2026');
    expect(note.textContent).toContain('gegen Microsoft Learn geprüft');
    expect(screen.queryByTestId('posture-catalog-stale')).not.toBeInTheDocument();
  });

  it('weist auf veraltete Sollwerte hin', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-08-01T12:00:00Z'));
    const user = userEvent.setup();
    renderApp();
    await openView(user);
    const stale = screen.getByTestId('posture-catalog-stale');
    expect(stale.textContent).toContain(`${POSTURE_CATALOG_STALE_AFTER_DAYS} Tage`);
    expect(stale.textContent).toContain('aktualisieren');
  });
});
