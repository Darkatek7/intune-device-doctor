import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { de } from '../i18n/de';
import { makeFinding, makeTile } from '../test/fixtures';
import { DetailSheet } from './DetailSheet';
import type { SectionNotice } from './sectionNotices';

describe('DetailSheet', () => {
  it('ist ein modaler Dialog mit Titel, Fakten, Befund, nummerierter Lösung und Quelle', () => {
    render(<DetailSheet tile={makeTile()} origin={null} notices={[]} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'BitLocker' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();

    expect(screen.getByText(de.sheet.facts)).toBeInTheDocument();
    expect(screen.getByText('BitLocker ist nicht aktiviert')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      expect.arrayContaining(['Gerät synchronisieren lassen.', 'Richtlinienzuweisung prüfen.']),
    );
    const link = screen.getByRole('link', { name: new RegExp(de.detail.docs) });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(link).toHaveAttribute(
      'href',
      'https://learn.microsoft.com/mem/intune/protect/encrypt-devices',
    );
    expect(screen.getAllByText(/Demo-Daten · GET/).length).toBeGreaterThan(0);
  });

  it('schließt per Escape, Schließen-Button und Scrim – aber nur einmal pro Aktion', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DetailSheet tile={makeTile()} origin={null} notices={[]} onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: de.detail.close }));
    expect(onClose).toHaveBeenCalledTimes(2);
    await user.click(screen.getByTestId('sheet-scrim'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('hält den Fokus im Dialog (Tab/Shift+Tab zyklisch)', async () => {
    const user = userEvent.setup();
    render(<DetailSheet tile={makeTile()} origin={null} notices={[]} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>('button, a[href]'));
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    expect(first).toBe(screen.getByRole('button', { name: de.detail.close }));

    last.focus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  it('versetzt den Hintergrund in inert, solange es offen ist', () => {
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    const { unmount } = render(
      <DetailSheet tile={makeTile()} origin={null} notices={[]} onClose={vi.fn()} />,
    );
    expect(outside).toHaveAttribute('inert');
    unmount();
    expect(outside).not.toHaveAttribute('inert');
    outside.remove();
  });

  it('zeigt bei Kachel ohne Befunde "Alles in Ordnung" samt geprüften Werten', () => {
    render(
      <DetailSheet
        tile={makeTile({ severity: 'ok', findings: [], value: 'Aktiv' })}
        origin={null}
        notices={[]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: de.sheet.allGood })).toBeInTheDocument();
    expect(screen.getByText('Verschlüsselt')).toBeInTheDocument();
  });

  it('bietet bei Ladefehlern "Erneut laden" an', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const notices: SectionNotice[] = [
      {
        key: 'bitlockerKeys',
        status: 'error',
        title: de.states.error,
        message: 'Netzwerkfehler',
        sourceLabel: 'GET …',
      },
    ];
    render(
      <DetailSheet
        tile={makeTile({ availability: 'error', findings: [] })}
        origin={null}
        notices={notices}
        onClose={vi.fn()}
        onRetry={onRetry}
      />,
    );
    expect(screen.queryByRole('heading', { name: de.sheet.allGood })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: de.sheet.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('nennt bei fehlender Berechtigung den benötigten Scope', () => {
    const notices: SectionNotice[] = [
      {
        key: 'configurationPolicies',
        status: 'forbidden',
        title: de.availability.forbidden,
        message: de.errors.forbidden,
        requiredScope: 'DeviceManagementConfiguration.Read.All',
        sourceLabel: 'GET …',
      },
    ];
    render(
      <DetailSheet
        tile={makeTile({ availability: 'forbidden', findings: [] })}
        origin={null}
        notices={notices}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('DeviceManagementConfiguration.Read.All')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: de.sheet.retry })).not.toBeInTheDocument();
  });

  it('zeigt eine ladende Kachel als Ladezustand', () => {
    render(
      <DetailSheet
        tile={makeTile({ state: 'loading', findings: [], facts: [] })}
        origin={null}
        notices={[]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText(de.sheet.loading)).toBeInTheDocument();
  });

  it('kennzeichnet unknown-Befunde als Hinweis', () => {
    render(
      <DetailSheet
        tile={makeTile({ findings: [makeFinding({ severity: 'unknown', title: 'Kein Wert' })] })}
        origin={null}
        notices={[]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(de.sheet.hint)).toBeInTheDocument();
  });
});
