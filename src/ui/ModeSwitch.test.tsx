import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { de } from '../i18n/de';
import { ModeSwitch } from './ModeSwitch';

describe('ModeSwitch', () => {
  it('wechselt per Klick und Pfeiltaste, wenn Live verfügbar ist', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModeSwitch mode="demo" onChange={onChange} liveAvailable />);
    await user.click(screen.getByRole('radio', { name: de.mode.live }));
    expect(onChange).toHaveBeenLastCalledWith('live');

    screen.getByRole('radio', { name: de.mode.demo }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('sperrt Live ohne Konfiguration, erklärt warum und ändert nichts', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModeSwitch mode="demo" onChange={onChange} liveAvailable={false} />);
    const live = screen.getByRole('radio', { name: de.mode.live });
    expect(live).toHaveAttribute('aria-disabled', 'true');
    expect(live).toHaveAccessibleDescription(de.mode.liveNotConfigured);
    await user.click(live);
    screen.getByRole('radio', { name: de.mode.demo }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).not.toHaveBeenCalled();
    expect(live).toHaveFocus();
  });
});
