import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { de } from '../i18n/de';
import { makeTile } from '../test/fixtures';
import { CompactTile } from './CompactTile';
import { TileGrid } from './TileGrid';
import { isHealthyTile } from './tileGroups';

const okTile = (over = {}) =>
  makeTile({
    id: 'defender',
    title: 'Defender',
    severity: 'ok',
    value: 'Geschützt',
    summary: 'Letzter Schnellscan vor 9 Std.',
    findings: [],
    ...over,
  });

describe('CompactTile', () => {
  it('ist ein Button mit denselben Textbausteinen wie die große Kachel und öffnet per Tastatur', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const tile = okTile();
    render(<CompactTile tile={tile} onOpen={onOpen} />);

    const button = screen.getByRole('button', { name: /^Defender/ });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('data-tile-id', 'defender');
    // Zugänglicher Name: Titel, Status (Text, nicht nur Farbe), Wert, Kontext – in dieser Reihenfolge
    const name = button.textContent ?? '';
    const order = ['Defender', de.severity.ok, 'Geschützt', 'Letzter Schnellscan vor 9 Std.'].map(
      (part) => name.indexOf(part),
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    button.focus();
    await user.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledWith(tile, button);
  });

  it('zeigt „nicht anwendbar“ mit eigenem Status statt „In Ordnung“', () => {
    render(
      <CompactTile
        tile={okTile({ availability: 'notApplicable', value: 'Nicht anwendbar' })}
        onOpen={vi.fn()}
      />,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent(de.availabilityShort.notApplicable);
    expect(button).not.toHaveTextContent(de.severity.ok);
  });
});

describe('isHealthyTile', () => {
  it('nur ok und nicht anwendbar sind unauffällig', () => {
    expect(isHealthyTile(okTile())).toBe(true);
    expect(isHealthyTile(okTile({ availability: 'notApplicable' }))).toBe(true);
    for (const severity of ['warning', 'critical', 'unknown'] as const) {
      expect(isHealthyTile(okTile({ severity }))).toBe(false);
    }
    for (const availability of ['forbidden', 'unavailable', 'error'] as const) {
      expect(isHealthyTile(okTile({ availability }))).toBe(false);
    }
    expect(isHealthyTile(okTile({ state: 'loading' }))).toBe(false);
  });
});

describe('TileGrid – Abschnitt „In Ordnung“', () => {
  const tiles = [
    makeTile(),
    okTile(),
    okTile({ id: 'compliance', title: 'Compliance', value: 'Konform' }),
    okTile({
      id: 'autopilot',
      title: 'Autopilot',
      availability: 'notApplicable',
      value: 'Nicht anwendbar',
    }),
  ];

  it('zeigt Kacheln mit Befund groß und unauffällige kompakt unter einer Überschrift mit Anzahl', () => {
    render(<TileGrid tiles={tiles} onOpen={vi.fn()} />);
    expect(
      screen.getByRole('heading', { level: 2, name: de.grid.healthyTitle(3) }),
    ).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
    expect(buttons.filter((b) => b.hasAttribute('data-tile-compact'))).toHaveLength(3);
    expect(screen.getByRole('button', { name: /^BitLocker/ })).not.toHaveAttribute(
      'data-tile-compact',
    );
    // Keine positive Banner-Aussage, solange es einen Befund gibt
    expect(screen.queryByTestId('all-ok-banner')).not.toBeInTheDocument();
  });

  it('bleibt flach (große Karten, keine Überschrift), solange noch eine Kachel lädt', () => {
    render(
      <TileGrid
        tiles={[okTile(), okTile({ id: 'compliance', title: 'Compliance', state: 'loading' })]}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(document.querySelector('[data-tile-compact]')).toBeNull();
  });

  it('`settled={false}` hält die flache Darstellung auch ohne ladende Kachel', () => {
    render(<TileGrid tiles={tiles} onOpen={vi.fn()} settled={false} />);
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });

  it('sagt es klar, wenn alles in Ordnung ist, und zeigt danach die kompakten Kacheln', () => {
    render(<TileGrid tiles={tiles.slice(1)} onOpen={vi.fn()} />);
    const banner = screen.getByTestId('all-ok-banner');
    expect(banner).toHaveTextContent(de.grid.allOkTitle);
    expect(banner).toHaveTextContent(de.grid.allOkBody(3));
    expect(within(banner).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button').every((b) => b.hasAttribute('data-tile-compact'))).toBe(
      true,
    );
  });

  it('öffnet auch eine kompakte Kachel über onOpen', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<TileGrid tiles={tiles} onOpen={onOpen} />);
    await user.click(screen.getByRole('button', { name: /^Compliance/ }));
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'compliance' }),
      expect.any(HTMLButtonElement),
    );
  });
});
