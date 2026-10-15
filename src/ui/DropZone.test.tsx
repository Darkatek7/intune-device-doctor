import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { de } from '../i18n/de';
import { DropZone } from './DropZone';

describe('DropZone', () => {
  it('ist ohne Handler deaktiviert und nennt den Datenschutzhinweis', () => {
    render(<DropZone />);
    expect(screen.getByRole('button', { name: de.dropZoneUi.choose })).toBeDisabled();
    expect(screen.getByText(new RegExp(de.dropZone.privacy))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(de.dropZoneUi.comingSoon))).toBeInTheDocument();
  });

  it('nimmt ZIP-Dateien über den Datei-Button an', async () => {
    const user = userEvent.setup();
    const onFile = vi.fn();
    render(<DropZone onFile={onFile} />);
    const file = new File(['x'], 'DiagLogs-DEMO.zip', { type: 'application/zip' });
    await user.upload(screen.getByTestId('dropzone-input'), file);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('weist andere Dateitypen ab', () => {
    const onFile = vi.fn();
    render(<DropZone onFile={onFile} />);
    const file = new File(['x'], 'notizen.txt', { type: 'text/plain' });
    fireEvent.drop(screen.getByRole('group'), { dataTransfer: { files: [file] } });
    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(de.dropZoneUi.notZip);
  });

  it('nimmt per Drag & Drop abgelegte ZIPs an', () => {
    const onFile = vi.fn();
    render(<DropZone onFile={onFile} />);
    const file = new File(['x'], 'a.ZIP');
    fireEvent.drop(screen.getByRole('group'), { dataTransfer: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });
});
