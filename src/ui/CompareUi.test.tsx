import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { de } from '../i18n/de';
import * as download from '../lib/download';
import {
  SNAPSHOT_SCHEMA,
  SNAPSHOT_VERSION,
  type SnapshotFile,
  type SnapshotTile,
} from '../rules/snapshotCompare';
import { CompareControls } from './CompareControls';
import { CompareDialog } from './CompareDialog';

const tile = (over: Partial<SnapshotTile> = {}): SnapshotTile => ({
  id: 'bitlocker',
  title: 'BitLocker',
  severity: 'ok',
  value: 'Aktiv',
  findings: [],
  ...over,
});

const snapshot = (over: Partial<SnapshotFile> = {}): SnapshotFile => ({
  schema: SNAPSHOT_SCHEMA,
  version: SNAPSHOT_VERSION,
  exportedAt: '2026-11-09T10:00:00.000Z',
  mode: 'demo',
  deviceName: 'CONTOSO-PC042',
  collectedAt: null,
  tiles: [tile()],
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('CompareDialog', () => {
  it('zeigt Trend, neue und behobene Befunde und schließt per Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const before = snapshot({
      tiles: [
        tile({
          severity: 'critical',
          value: 'Aus',
          findings: [{ id: 'off', severity: 'critical', title: 'BitLocker ist aus' }],
        }),
        tile({ id: 'defender', title: 'Defender', severity: 'ok', value: 'Aktiv' }),
      ],
    });
    const after = snapshot({
      tiles: [
        tile({ severity: 'ok', value: 'Aktiv' }),
        tile({
          id: 'defender',
          title: 'Defender',
          severity: 'warning',
          value: 'Veraltet',
          findings: [{ id: 'old', severity: 'warning', title: 'Signaturen veraltet' }],
        }),
      ],
    });
    render(
      <CompareDialog
        before={before}
        after={after}
        beforeLabel="alt.json"
        afterLabel="CONTOSO-PC042"
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: de.compare.dialog.title });
    expect(within(dialog).getByTestId('compare-count-better')).toHaveTextContent('1 besser');
    expect(within(dialog).getByTestId('compare-count-worse')).toHaveTextContent('1 schlechter');
    expect(within(dialog).getByText('Signaturen veraltet')).toBeInTheDocument();
    expect(within(dialog).getByText('BitLocker ist aus')).toBeInTheDocument();
    expect(screen.queryByTestId('compare-name-mismatch')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('warnt, wenn die Gerätenamen nicht übereinstimmen', () => {
    render(
      <CompareDialog
        before={snapshot({ deviceName: 'CONTOSO-PC001' })}
        after={snapshot()}
        beforeLabel="a"
        afterLabel="b"
        onClose={() => undefined}
      />,
    );
    expect(screen.getByTestId('compare-name-mismatch')).toHaveTextContent('CONTOSO-PC001');
  });
});

describe('CompareControls', () => {
  const file = (content: string, name = 'stand.json') =>
    new File([content], name, { type: 'application/json' });

  it('exportiert den Stand als Download – nichts wird gespeichert', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(download, 'downloadTextFile').mockImplementation(() => undefined);
    render(<CompareControls getCurrent={() => snapshot()} currentLabel="CONTOSO-PC042" />);
    await user.click(screen.getByRole('button', { name: de.compare.exportButton }));
    expect(spy).toHaveBeenCalledOnce();
    const [name, text, mime] = spy.mock.calls[0]!;
    expect(name).toMatch(/^mdm-doctor-stand-CONTOSO-PC042-.*\.json$/);
    expect(mime).toBe('application/json');
    expect(JSON.parse(text).schema).toBe(SNAPSHOT_SCHEMA);
    expect(localStorage.length).toBe(0);
  });

  it('lehnt fremde Dateien mit einer Meldung ab', async () => {
    const user = userEvent.setup();
    render(<CompareControls getCurrent={() => snapshot()} currentLabel="x" />);
    await user.upload(screen.getByTestId('compare-input'), file('{"foo":1}'));
    expect(await screen.findByText(de.compare.errors.wrongSchema)).toBeInTheDocument();
    await user.upload(screen.getByTestId('compare-input'), file('kein json'));
    expect(await screen.findByText(de.compare.errors.notJson)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('öffnet den Vergleich für eine gültige Datei', async () => {
    const user = userEvent.setup();
    render(<CompareControls getCurrent={() => snapshot()} currentLabel="CONTOSO-PC042" />);
    await user.upload(screen.getByTestId('compare-input'), file(JSON.stringify(snapshot())));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByRole('dialog')).toHaveTextContent('stand.json');
  });

  it('ist deaktiviert, solange kein Stand vorliegt', () => {
    render(<CompareControls getCurrent={() => null} disabled currentLabel="x" />);
    expect(screen.getByRole('button', { name: de.compare.exportButton })).toBeDisabled();
    expect(screen.getByRole('button', { name: de.compare.compareButton })).toBeDisabled();
  });
});
