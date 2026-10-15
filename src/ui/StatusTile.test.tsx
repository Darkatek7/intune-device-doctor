import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { de } from '../i18n/de';
import { makeTile } from '../test/fixtures';
import { StatusTile } from './StatusTile';
import { TileGrid } from './TileGrid';

describe('StatusTile', () => {
  it('ist ein Button mit aria-haspopup, zeigt Status als Text und öffnet per Tastatur', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const tile = makeTile();
    render(<StatusTile tile={tile} onOpen={onOpen} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveTextContent(de.severity.critical);
    expect(button).toHaveTextContent('Nicht aktiv');

    button.focus();
    await user.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledWith(tile, button);
    await user.keyboard(' ');
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('zeigt bei fehlender Berechtigung Text statt Severity', () => {
    render(
      <StatusTile
        tile={makeTile({ availability: 'forbidden', severity: 'unknown', findings: [] })}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toHaveTextContent(de.availability.forbidden);
  });

  it('zeigt "Nicht anwendbar" für notApplicable', () => {
    render(<StatusTile tile={makeTile({ availability: 'notApplicable' })} onOpen={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent(de.availability.notApplicable);
  });
});

describe('TileGrid', () => {
  it('rendert Skeletons für ladende Kacheln und Buttons für fertige', () => {
    render(
      <TileGrid
        tiles={[
          makeTile(),
          makeTile({ id: 'defender', title: 'Microsoft Defender', state: 'loading' }),
        ]}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('group', { name: /Microsoft Defender/ })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });
});
