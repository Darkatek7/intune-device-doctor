import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { de } from '../i18n/de';
import { DiagnosticsChip } from './DiagnosticsChip';
import { DropOverlay } from './DropOverlay';
import { ExampleZipChip } from './ExampleZipChip';
import { MergeOffer } from './MergeOffer';
import { ZipProgress } from './ZipProgress';

describe('ZipProgress', () => {
  it('zeigt Dateiname, Meldung, Balken und Datenschutzhinweis; Abbrechen funktioniert', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ZipProgress
        fileName="DiagLogs-X.zip"
        progress={{
          stage: 'dsregcmd',
          message: 'Entra-Join-Status wird ausgewertet …',
          completed: 2,
          total: 5,
        }}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('DiagLogs-X.zip')).toBeInTheDocument();
    const message = screen.getByText('Entra-Join-Status wird ausgewertet …');
    expect(message).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('progressbar', { name: de.zipView.progress.barLabel })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
    expect(screen.getByText(de.zipView.progress.step(2, 5))).toBeInTheDocument();
    expect(screen.getByText(de.dropZone.privacy)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: de.zipView.progress.cancel }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('zeigt ohne Fortschritt den Startzustand', () => {
    render(<ZipProgress fileName="a.zip" onCancel={() => {}} />);
    expect(screen.getByText(de.zipView.progress.starting)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });
});

describe('MergeOffer', () => {
  it('nennt das Gerät und löst das Zusammenführen aus', async () => {
    const user = userEvent.setup();
    const onMerge = vi.fn();
    render(<MergeOffer deviceName="CONTOSO-PC042" onMerge={onMerge} />);
    expect(screen.getByText(de.zipView.merge.title('CONTOSO-PC042'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: de.zipView.merge.action }));
    expect(onMerge).toHaveBeenCalled();
  });
});

describe('DiagnosticsChip', () => {
  it('zeigt den Chip und entfernt per Klick', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<DiagnosticsChip fileName="DiagLogs-X.zip" onRemove={onRemove} />);
    expect(screen.getByText(de.zipView.chip.label)).toHaveAttribute(
      'title',
      de.zipView.chip.title('DiagLogs-X.zip'),
    );
    await user.click(screen.getByRole('button', { name: de.zipView.chip.remove }));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe('ExampleZipChip', () => {
  it('löst den Klick aus', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ul>
        <ExampleZipChip onClick={onClick} />
      </ul>,
    );
    await user.click(screen.getByRole('button', { name: new RegExp(de.zipView.exampleChip) }));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('DropOverlay', () => {
  it('ist nur sichtbar, wenn visible gesetzt ist', () => {
    const { rerender } = render(<DropOverlay visible={false} />);
    expect(screen.queryByTestId('drop-overlay')).not.toBeInTheDocument();
    rerender(<DropOverlay visible />);
    expect(screen.getByTestId('drop-overlay')).toHaveTextContent(de.zipView.overlay.title);
    fireEvent.click(screen.getByTestId('drop-overlay'));
  });
});
