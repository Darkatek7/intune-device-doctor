import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TileId } from '../domain/types';
import { de } from '../i18n/de';
import type { Insight } from '../rules/correlate';
import type { TimelineEvent } from '../rules/timeline';
import { InsightCard } from './InsightCard';
import { TimelineButton } from './TimelineButton';

const t = de.analysis.timeline;

const event = (overrides: Partial<TimelineEvent>): TimelineEvent => ({
  id: 'e',
  time: '2026-10-14T09:30:00.000Z',
  kind: 'checkIn',
  severity: 'ok',
  title: 'Letzter Check-in bei Intune',
  detail: null,
  tileId: 'checkIn',
  source: 'intune',
  planned: false,
  ...overrides,
});

const EVENTS: TimelineEvent[] = [
  event({
    id: 'future',
    time: '2026-11-20T09:00:00.000Z',
    kind: 'certificate',
    severity: 'warning',
    title: 'MDM-Zertifikat läuft ab',
    tileId: 'deviceStatus',
    planned: true,
  }),
  event({
    id: 'fail',
    time: '2026-10-14T10:00:00.000Z',
    kind: 'signIn',
    severity: 'warning',
    title: 'Anmeldung blockiert',
    tileId: 'signIns',
    source: 'entra',
  }),
  event({ id: 'ok' }),
  event({ id: 'none', time: '2026-10-01T08:00:00.000Z', title: 'Ohne Kachel', tileId: null }),
];

const TILES = new Set<TileId>(['checkIn', 'signIns']);

function setup(onOpenTile = vi.fn()) {
  render(<TimelineButton events={EVENTS} openableTiles={TILES} onOpenTile={onOpenTile} />);
  return { onOpenTile, user: userEvent.setup() };
}

describe('TimelineSheet', () => {
  it('öffnet als Dialog mit Liste, <time>-Elementen und „Geplant“-Markierung', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: t.button }));
    const dialog = await screen.findByRole('dialog', { name: t.dialogTitle });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const list = within(dialog).getByRole('list', { name: t.listLabel });
    expect(list.querySelectorAll('time')).toHaveLength(EVENTS.length);
    expect(within(dialog).getByText(t.planned)).toBeInTheDocument();
    expect(within(dialog).getByText(t.count(4, 4))).toBeInTheDocument();
    // neueste zuerst: geplanter Termin steht vor dem Check-in
    const titles = within(dialog)
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '');
    expect(titles.findIndex((x) => x.includes('läuft ab'))).toBeLessThan(
      titles.findIndex((x) => x.includes('Ohne Kachel')),
    );
  });

  it('Filter „Nur Probleme“ blendet unproblematische Ereignisse aus', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: t.button }));
    const dialog = await screen.findByRole('dialog');
    const only = within(dialog).getByRole('button', { name: t.filterProblems });
    expect(only).toHaveAttribute('aria-pressed', 'false');
    await user.click(only);
    expect(only).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByText(t.count(2, 4))).toBeInTheDocument();
    expect(within(dialog).queryByText('Ohne Kachel')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Anmeldung blockiert')).toBeInTheDocument();
  });

  it('Klick auf einen Eintrag öffnet die Kachel und schließt die Zeitachse; ohne Kachel kein Knopf', async () => {
    const { user, onOpenTile } = setup();
    await user.click(screen.getByRole('button', { name: t.button }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /Ohne Kachel/ })).not.toBeInTheDocument();
    // Kachel „deviceStatus“ existiert in der Ansicht nicht → ebenfalls kein Knopf
    expect(within(dialog).queryByRole('button', { name: /läuft ab/ })).not.toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('button', {
        name: /Prüfen: Anmeldung blockiert – Kachel „Anmeldungen“ öffnen$/,
      }),
    );
    expect(onOpenTile).toHaveBeenCalledWith('signIns');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Escape schließt und gibt den Fokus an die Schaltfläche zurück', async () => {
    const { user } = setup();
    const button = screen.getByRole('button', { name: t.button });
    await user.click(button);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(button).toHaveFocus();
  });

  it('leere Zeitachse zeigt eine Meldung', async () => {
    const user = userEvent.setup();
    render(<TimelineButton events={[]} openableTiles={TILES} onOpenTile={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: t.button }));
    expect(await screen.findByText(t.empty)).toBeInTheDocument();
  });
});

describe('InsightCard', () => {
  const insight: Insight = {
    id: 'complianceBlocked',
    title: 'Zuerst die Compliance herstellen',
    explanation: 'Erklärungstext.',
    steps: ['Schritt eins', 'Schritt zwei'],
    relatedTiles: ['compliance', 'signIns'],
    why: 'Begründung.',
    docsUrl: 'https://learn.microsoft.com/intune/',
  };

  it('zeigt Titel, Hinweis, Kachel-Links und einen „Warum?“-Aufklappbereich mit Quelle', async () => {
    const user = userEvent.setup();
    const onOpenTile = vi.fn();
    render(
      <InsightCard
        insights={[insight]}
        openableTiles={new Set<TileId>(['compliance', 'signIns'])}
        onOpenTile={onOpenTile}
      />,
    );
    expect(screen.getByRole('heading', { name: de.analysis.insight.heading })).toBeInTheDocument();
    expect(screen.getByText(de.analysis.insight.note)).toBeInTheDocument();
    expect(screen.getByText(insight.title)).toBeInTheDocument();

    const details = screen.getByText(de.analysis.insight.why).closest('details')!;
    expect(details).not.toHaveAttribute('open');
    await user.click(screen.getByText(de.analysis.insight.why));
    expect(details).toHaveAttribute('open');
    expect(screen.getByText('Erklärungstext.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: de.analysis.insight.docs })).toHaveAttribute(
      'href',
      insight.docsUrl,
    );

    await user.click(
      screen.getByRole('button', { name: de.analysis.insight.openTile('Compliance') }),
    );
    expect(onOpenTile).toHaveBeenCalledWith('compliance');
  });
});
