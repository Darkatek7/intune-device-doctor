import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BulkState } from '../hooks/useBulkCheck';
import { de } from '../i18n/de';
import * as download from '../lib/download';
import type { DeviceSearchResult } from '../domain/types';
import { BookmarkletDialog } from './BookmarkletDialog';
import { BulkView } from './BulkView';

afterEach(() => vi.restoreAllMocks());

const device: DeviceSearchResult = {
  id: 'id-1',
  deviceName: 'CONTOSO-PC001',
  userPrincipalName: 'alex@contoso.com',
  userDisplayName: 'Alex Beispiel',
  operatingSystem: 'Windows',
  osVersion: '10.0',
  model: null,
  complianceState: 'compliant',
  lastSyncDateTime: '2026-11-09T10:00:00Z',
};

const base = (over: Partial<BulkState> = {}): BulkState => ({
  status: 'idle',
  rows: [],
  checkedAt: new Date('2026-11-09T12:00:00Z'),
  throttleSeconds: null,
  ...over,
});

const noop = () => undefined;
const props = {
  onStart: noop,
  onCancel: noop,
  onReset: noop,
  onBack: noop,
  onOpenDevice: noop,
  onSearchName: noop,
};

describe('BulkView', () => {
  it('liest Namen aus dem Textfeld und startet die Prüfung', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<BulkView state={base()} {...props} onStart={onStart} />);
    await user.type(screen.getByLabelText(de.bulk.inputLabel), 'CONTOSO-PC001{Enter}CONTOSO-PC042');
    expect(screen.getByText(de.bulk.namesCount(2))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: de.bulk.start }));
    expect(onStart).toHaveBeenCalledWith(['CONTOSO-PC001', 'CONTOSO-PC042']);
  });

  it('übernimmt Namen aus einer CSV-Datei', async () => {
    const user = userEvent.setup();
    render(<BulkView state={base()} {...props} />);
    await user.upload(
      screen.getByTestId('bulk-file-input'),
      new File(['Name;Ort\nCONTOSO-PC001;Berlin\nCONTOSO-PC014;Wien\n'], 'liste.csv'),
    );
    expect(await screen.findByText(de.bulk.namesCount(2))).toBeInTheDocument();
  });

  it('zeigt Tabelle, öffnet Geräte per Klick und exportiert CSV lokal', async () => {
    const user = userEvent.setup();
    const onOpenDevice = vi.fn();
    const onSearchName = vi.fn();
    const spy = vi.spyOn(download, 'downloadTextFile').mockImplementation(() => undefined);
    const state = base({
      status: 'done',
      rows: [
        { name: 'CONTOSO-PC001', status: 'done', matchCount: 1, device },
        { name: 'CONTOSO-PC', status: 'done', matchCount: 3, device: null },
        { name: 'NOPE', status: 'done', matchCount: 0, device: null },
      ],
    });
    render(
      <BulkView state={state} {...props} onOpenDevice={onOpenDevice} onSearchName={onSearchName} />,
    );
    const rows = screen.getAllByTestId('bulk-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('Konform')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Alex Beispiel')).toBeInTheDocument();
    expect(within(rows[1]!).getByText(de.bulk.match.many(3))).toBeInTheDocument();
    expect(within(rows[2]!).getByText(de.bulk.match.none)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: de.bulk.openDevice('CONTOSO-PC001') }));
    expect(onOpenDevice).toHaveBeenCalledWith(device);
    await user.click(screen.getByRole('button', { name: de.bulk.searchName('CONTOSO-PC') }));
    expect(onSearchName).toHaveBeenCalledWith('CONTOSO-PC');

    await user.click(screen.getByRole('button', { name: de.bulk.exportCsv }));
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]![0]).toMatch(/^mdm-doctor-sammelpruefung-\d{8}-\d{4}\.csv$/);
  });

  it('bietet während der Prüfung „Abbrechen“ und zeigt Drosselung an', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <BulkView
        state={base({
          status: 'running',
          throttleSeconds: 7,
          rows: [{ name: 'A', status: 'running', matchCount: 0, device: null }],
        })}
        {...props}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByTestId('bulk-throttle')).toHaveTextContent('7 s');
    await user.click(screen.getByRole('button', { name: de.bulk.cancel }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('BookmarkletDialog', () => {
  it('setzt den javascript:-Link per setAttribute (React würde ihn blockieren)', () => {
    render(<BookmarkletDialog onClose={noop} appUrl="https://tools.contoso.com/mdm-doctor/" />);
    const link = screen.getByTestId('bookmarklet-link');
    const href = link.getAttribute('href') ?? '';
    expect(href.startsWith('javascript:')).toBe(true);
    expect(href).not.toContain('React has blocked');
    expect(href).toContain('https://tools.contoso.com/mdm-doctor/');
    expect(href).toContain('mode=live');
  });

  it('zeigt Anleitung und schließt per Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BookmarkletDialog onClose={onClose} appUrl="https://x.example/" />);
    expect(screen.getByRole('dialog', { name: de.bookmarklet.title })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
