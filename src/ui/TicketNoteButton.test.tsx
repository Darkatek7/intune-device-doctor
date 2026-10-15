import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { de } from '../i18n/de';
import { TicketNoteButton } from './TicketNoteButton';

const NOTE = '## MDM Doctor – Befunde für CONTOSO-PC042\n';

function withoutClipboard<T>(run: () => Promise<T>): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  return run().finally(() => {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else delete (navigator as unknown as Record<string, unknown>)['clipboard'];
  });
}

afterEach(() => vi.restoreAllMocks());

describe('TicketNoteButton', () => {
  it('kopiert die Notiz und bestätigt dezent mit "Kopiert"', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    render(<TicketNoteButton getNote={() => NOTE} />);

    await user.click(screen.getByRole('button', { name: de.ticket.button }));
    expect(writeText).toHaveBeenCalledWith(NOTE);
    const feedback = await screen.findByText(de.ticket.copied);
    expect(feedback.closest('[aria-live="polite"]')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('blendet die Bestätigung nach etwa 2 Sekunden wieder aus', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
      render(<TicketNoteButton getNote={() => NOTE} />);
      await user.click(screen.getByRole('button', { name: de.ticket.button }));
      expect(await screen.findByText(de.ticket.copied)).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });
      expect(screen.queryByText(de.ticket.copied)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('ist deaktiviert, solange Kacheln laden', () => {
    render(<TicketNoteButton getNote={() => NOTE} disabled />);
    expect(screen.getByRole('button', { name: de.ticket.button })).toBeDisabled();
  });

  it('zeigt ohne Clipboard-API einen Dialog mit dem Text zum manuellen Kopieren', async () => {
    const user = userEvent.setup();
    render(<TicketNoteButton getNote={() => NOTE} />);
    await withoutClipboard(async () => {
      await user.click(screen.getByRole('button', { name: de.ticket.button }));
      const dialog = await screen.findByRole('dialog', { name: de.ticket.dialogTitle });
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      const area = screen.getByRole('textbox', { name: de.ticket.textLabel });
      expect(area).toHaveValue(NOTE);
      await waitFor(() => expect(area).toHaveFocus());
      expect(screen.queryByText(de.ticket.copied)).not.toBeInTheDocument();
    });
  });

  it('fällt bei abgelehnter Zwischenablage auf den Dialog zurück; Escape schließt und gibt den Fokus zurück', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    render(<TicketNoteButton getNote={() => NOTE} />);
    const button = screen.getByRole('button', { name: de.ticket.button });

    await user.click(button);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(button).toHaveFocus();
  });

  it('schließt den Dialog über den Schließen-Button und hält den Fokus im Dialog', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    render(<TicketNoteButton getNote={() => NOTE} />);
    await user.click(screen.getByRole('button', { name: de.ticket.button }));
    const dialog = await screen.findByRole('dialog');

    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await user.click(screen.getByRole('button', { name: de.detail.close }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
