import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RecentDevice } from '../hooks/useRecentDevices';
import { de } from '../i18n/de';
import { RecentDevices } from './RecentDevices';

const devices: RecentDevice[] = [
  {
    id: 'a',
    deviceName: 'CONTOSO-PC042',
    osFamily: 'windows',
    openedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  },
  { id: 'b', deviceName: 'CONTOSO-IP015', osFamily: 'ios', openedAt: new Date().toISOString() },
];

describe('RecentDevices', () => {
  it('zeigt nichts, wenn die Liste leer ist', () => {
    const { container } = render(
      <RecentDevices devices={[]} mode="demo" onOpen={vi.fn()} onClear={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('listet Geräte mit relativer Zeit; Klick öffnet, „Verlauf löschen“ leert', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onClear = vi.fn();
    render(<RecentDevices devices={devices} mode="demo" onOpen={onOpen} onClear={onClear} />);

    const list = screen.getByRole('list', { name: de.comfort.recentList });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText(/vor 3 Std\./)).toBeInTheDocument();
    expect(screen.queryByText(de.comfort.recentLocalOnly)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: de.comfort.recentOpen('CONTOSO-PC042') }));
    expect(onOpen).toHaveBeenCalledWith(devices[0]);
    await user.click(screen.getByRole('button', { name: de.comfort.recentClear }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('weist im Live-Modus darauf hin, dass nur im Browser gespeichert wird', () => {
    render(<RecentDevices devices={devices} mode="live" onOpen={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByText(de.comfort.recentLocalOnly)).toBeInTheDocument();
  });
});
