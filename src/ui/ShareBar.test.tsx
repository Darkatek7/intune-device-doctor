import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShareBar } from './ShareBar';

describe('ShareBar', () => {
  it('hat eine Textalternative mit Zahlen und Anteilen und eine Legende (Status nie nur über Farbe)', () => {
    render(
      <ShareBar
        summary={{
          kind: 'compliance',
          counts: { compliantDeviceCount: 75, nonCompliantDeviceCount: 25, errorDeviceCount: 0 },
        }}
      />,
    );
    const bar = screen.getByRole('img');
    expect(bar).toHaveAttribute('aria-label', expect.stringContaining('Konform: 75'));
    expect(bar).toHaveAttribute('aria-label', expect.stringContaining('Nicht konform: 25'));
    const legend = screen.getByRole('list', { name: 'Legende' });
    expect(within(legend).getAllByRole('listitem')).toHaveLength(2);
    expect(legend).toHaveTextContent('Nicht konform');
    expect(legend).toHaveTextContent('25');
  });

  it('ohne gemeldete Geräte entfällt der Balken', () => {
    const { container } = render(
      <ShareBar summary={{ kind: 'configuration', counts: { compliantDeviceCount: 0 } }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
