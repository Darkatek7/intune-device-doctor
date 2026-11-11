import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderContextProvider } from '../app/providerContext';
import { de } from '../i18n/de';
import * as download from '../lib/download';
import { MockProvider } from '../providers/mock/MockProvider';
import { SNAPSHOT_SCHEMA, SNAPSHOT_VERSION, type SnapshotFile } from '../rules/snapshotCompare';
import { HeaderActions } from './HeaderActions';

const snapshot = (): SnapshotFile => ({
  schema: SNAPSHOT_SCHEMA,
  version: SNAPSHOT_VERSION,
  exportedAt: '2026-11-09T10:00:00.000Z',
  mode: 'demo',
  deviceName: 'CONTOSO-PC042',
  collectedAt: null,
  tiles: [{ id: 'bitlocker', title: 'BitLocker', severity: 'ok', value: 'Aktiv', findings: [] }],
});

function setup(props: { disabled?: boolean; onOpenConnectionTest?: () => void } = {}) {
  render(
    <HeaderActions
      timeline={{ events: [], openableTiles: new Set(), onOpenTile: vi.fn() }}
      getTicketNote={() => '## Notiz'}
      compare={{ kind: 'device', getCurrent: snapshot, currentLabel: 'CONTOSO-PC042' }}
      {...props}
    />,
  );
}

const more = () => screen.getByRole('button', { name: de.actions.more });

afterEach(() => vi.restoreAllMocks());

describe('HeaderActions', () => {
  it('zeigt nur „Zeitachse“, „Ticket-Notiz kopieren“ und „Mehr“ als Schaltflächen', () => {
    setup();
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual([de.analysis.timeline.button, de.ticket.button, `${de.actions.more}`]);
    expect(screen.queryByRole('button', { name: de.comfort.printButton })).not.toBeInTheDocument();
  });

  it('„Mehr“ bündelt Drucken, Export und Vergleich', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(more());
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      de.comfort.printButton,
      de.compare.exportButton,
      de.compare.compareButton,
    ]);
  });

  it('Verbindungstest erscheint nur, wenn er angeboten wird, und löst aus', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    setup({ onOpenConnectionTest: onOpen });
    await user.click(more());
    await user.click(screen.getByRole('menuitem', { name: de.connectionTest.open }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('„Stand exportieren“ lädt den Stand herunter', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(download, 'downloadTextFile').mockImplementation(() => undefined);
    setup();
    await user.click(more());
    await user.click(screen.getByRole('menuitem', { name: de.compare.exportButton }));
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]![0]).toMatch(/^mdm-doctor-stand-CONTOSO-PC042-/);
  });

  it('„Drucken / PDF“ öffnet den Druck-Dialog; Escape gibt den Fokus an „Mehr“ zurück', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(more());
    await user.click(screen.getByRole('menuitem', { name: de.comfort.printButton }));
    const dialog = await screen.findByRole('dialog', { name: de.ticket.dialogTitle });
    expect(within(dialog).getByText(de.comfort.printDialogBody)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(more()).toHaveFocus();
  });

  it('„Mit Stand vergleichen“ nimmt die Datei an und öffnet den Vergleich; Fokus kehrt zu „Mehr“ zurück', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(more());
    await user.click(screen.getByRole('menuitem', { name: de.compare.compareButton }));
    await user.upload(
      screen.getByTestId('compare-input'),
      new File([JSON.stringify(snapshot())], 'stand.json', { type: 'application/json' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('stand.json');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(more()).toHaveFocus();
  });

  it('sperrt Drucken, Export und Vergleich, solange Kacheln laden', async () => {
    const user = userEvent.setup();
    setup({ disabled: true });
    expect(screen.getByRole('button', { name: de.ticket.button })).toBeDisabled();
    await user.click(more());
    for (const name of [
      de.comfort.printButton,
      de.compare.exportButton,
      de.compare.compareButton,
    ]) {
      expect(screen.getByRole('menuitem', { name })).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('ZIP-Variante bietet „Mit weiterer ZIP vergleichen“ im Menü', async () => {
    const user = userEvent.setup();
    render(
      <ProviderContextProvider
        provider={new MockProvider({ latency: false })}
        liveAvailable={false}
      >
        <HeaderActions
          timeline={{ events: [], openableTiles: new Set(), onOpenTile: vi.fn() }}
          getTicketNote={() => ''}
          compare={{ kind: 'zip', report: { fileName: 'DiagLogs-X.zip' } as never, tiles: [] }}
        />
      </ProviderContextProvider>,
    );
    await user.click(more());
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      de.comfort.printButton,
      de.compare.zipButton,
    ]);
  });
});
