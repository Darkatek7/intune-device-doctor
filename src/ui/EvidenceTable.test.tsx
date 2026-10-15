import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { de } from '../i18n/de';
import { EvidenceTable } from './EvidenceTable';

describe('EvidenceTable', () => {
  it('ist eingeklappt, klappt per Button auf und kopiert die Rohdaten', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    render(<EvidenceTable evidence={{ errorCode: '0x87D1FDE8', retries: 3, flag: null }} />);

    const toggle = screen.getByRole('button', { name: new RegExp(de.detail.evidence) });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('0x87D1FDE8')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('0x87D1FDE8')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: de.sheet.copy }));
    expect(writeText).toHaveBeenCalledWith('errorCode: 0x87D1FDE8\nretries: 3\nflag: –');
    expect(await screen.findByText(de.sheet.copied)).toBeInTheDocument();
  });

  it('meldet, wenn Kopieren nicht möglich ist', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    render(<EvidenceTable evidence={{ a: 1 }} />);
    await user.click(screen.getByRole('button', { name: new RegExp(de.detail.evidence) }));
    await user.click(screen.getByRole('button', { name: de.sheet.copy }));
    expect(await screen.findByText(de.sheet.copyFailed)).toBeInTheDocument();
  });
});
