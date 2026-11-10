import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Download, Printer } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { de } from '../i18n/de';
import { ActionMenu, type ActionMenuItem } from './ActionMenu';

function setup(items?: ActionMenuItem[]) {
  const onPrint = vi.fn();
  const onExport = vi.fn();
  const list = items ?? [
    { id: 'print', label: 'Drucken', icon: Printer, onSelect: onPrint },
    { id: 'export', label: 'Exportieren', icon: Download, onSelect: onExport },
    { id: 'off', label: 'Gesperrt', icon: Download, disabled: true, onSelect: vi.fn() },
  ];
  render(
    <div>
      <button type="button">davor</button>
      <ActionMenu items={list} />
      <button type="button">danach</button>
    </div>,
  );
  return { onPrint, onExport, trigger: screen.getByRole('button', { name: de.actions.more }) };
}

describe('ActionMenu', () => {
  it('Schaltfläche trägt aria-haspopup="menu" und aria-expanded', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: de.actions.more })).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  });

  it('Klick öffnet das Menü mit Fokus auf dem ersten Eintrag; Pfeiltasten wandern zyklisch und überspringen gesperrte', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger);
    const [print, exportItem] = screen.getAllByRole('menuitem');
    await waitFor(() => expect(print).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    expect(exportItem).toHaveFocus();
    await user.keyboard('{ArrowDown}'); // „Gesperrt“ wird übersprungen
    expect(print).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(exportItem).toHaveFocus();
    await user.keyboard('{Home}');
    expect(print).toHaveFocus();
    await user.keyboard('{End}');
    expect(exportItem).toHaveFocus();
  });

  it('Pfeiltaste auf der Schaltfläche öffnet das Menü (runter: erster, hoch: letzter Eintrag)', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    trigger.focus();
    await user.keyboard('{ArrowUp}');
    const [, exportItem] = screen.getAllByRole('menuitem');
    await waitFor(() => expect(exportItem).toHaveFocus());
  });

  it('Enter löst den Eintrag aus, schließt das Menü und gibt den Fokus zurück', async () => {
    const user = userEvent.setup();
    const { trigger, onExport } = setup();
    await user.click(trigger);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onExport).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('gesperrte Einträge lösen nichts aus', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    setup([{ id: 'a', label: 'Aus', icon: Printer, disabled: true, onSelect }]);
    await user.click(screen.getByRole('button', { name: de.actions.more }));
    await user.click(screen.getByRole('menuitem', { name: 'Aus' }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitem', { name: 'Aus' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('Escape schließt und gibt den Fokus an die Schaltfläche zurück', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('Klick außerhalb schließt das Menü', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'danach' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Tab schließt das Menü und lässt den Fokus weiterwandern', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger);
    await user.tab();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).not.toHaveFocus();
  });

  it('erneuter Klick auf die Schaltfläche schließt das Menü', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger);
    await user.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
