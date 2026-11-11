import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Landmark } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { de } from '../i18n/de';
import { renderApp } from '../test/renderApp';
import { NAV_ITEMS } from './navItems';
import { Toolbar } from './Toolbar';

describe('Hauptnavigation (Toolbar)', () => {
  it('rendert die Einträge aus der Liste als nav mit aria-current und sichtbarem Text', async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    render(
      <Toolbar
        search={null}
        mode="demo"
        onModeChange={vi.fn()}
        liveAvailable={false}
        onHome={vi.fn()}
        navItems={[
          { id: 'a', label: 'Geräte', icon: Landmark, active: true, onSelect: vi.fn() },
          { id: 'b', label: 'Neu', icon: Landmark, active: false, onSelect: select },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: de.nav.label });
    const buttons = within(nav).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Geräte', 'Neu']);
    // WCAG 2.5.3: kein abweichender aria-label – der Name ist der sichtbare Text
    expect(buttons.every((b) => !b.hasAttribute('aria-label'))).toBe(true);
    expect(buttons[0]).toHaveAttribute('aria-current', 'page');
    expect(buttons[1]).not.toHaveAttribute('aria-current');
    await user.click(buttons[1]!);
    expect(select).toHaveBeenCalledOnce();
  });

  it('ohne Einträge gibt es keine Navigation', () => {
    render(
      <Toolbar
        search={null}
        mode="demo"
        onModeChange={vi.fn()}
        liveAvailable={false}
        onHome={vi.fn()}
      />,
    );
    expect(screen.queryByRole('navigation', { name: de.nav.label })).not.toBeInTheDocument();
  });

  it('NAV_ITEMS: Geräte, Richtlinien, Mandant mit eindeutigen IDs', () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual(['Geräte', 'Richtlinien', 'Mandant']);
    expect(new Set(NAV_ITEMS.map((i) => i.id)).size).toBe(NAV_ITEMS.length);
  });
});

describe('Hauptnavigation (App)', () => {
  const nav = () => screen.getByRole('navigation', { name: de.nav.label });
  const entry = (name: string) => within(nav()).getByRole('button', { name });

  it('wechselt zwischen Geräte, Richtlinien und Mandant und hält URL und aria-current synchron', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/');
    renderApp();
    expect(entry('Geräte')).toHaveAttribute('aria-current', 'page');

    await user.click(entry('Mandant'));
    await screen.findByRole('heading', { level: 1, name: de.tenantView.title });
    expect(window.location.search).toContain('view=tenant');
    expect(entry('Mandant')).toHaveAttribute('aria-current', 'page');
    expect(entry('Geräte')).not.toHaveAttribute('aria-current');

    await user.click(entry('Richtlinien'));
    await screen.findByRole('heading', { level: 1, name: de.policies.title });
    expect(window.location.search).toContain('view=policies');
    expect(entry('Richtlinien')).toHaveAttribute('aria-current', 'page');

    await user.click(entry('Geräte'));
    await waitFor(() => expect(window.location.search).not.toContain('view='));
    expect(entry('Geräte')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: de.hero.title })).toBeInTheDocument();
  });
});
