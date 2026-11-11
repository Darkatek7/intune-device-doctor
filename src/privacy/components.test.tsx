import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DiagnosticsReport } from '../diagnostics/types';
import { de } from '../i18n/de';
import { PrivacyNotice, PrivacyToggle } from '../ui/PrivacyToggle';
import { PrivateLink } from '../ui/PrivateLink';
import { maskedZipTitle } from '../ui/zipTitle';
import { maskFileName } from './fileName';
import { createMasker } from './masker';
import { PrivacyProvider } from './PrivacyProvider';
import { PRIVACY_STORAGE_KEY, readStoredPrivacy } from './storage';

function Harness(props: { initialEnabled?: boolean }) {
  return (
    <PrivacyProvider salt="t" {...props}>
      <PrivacyToggle />
      <PrivacyNotice />
    </PrivacyProvider>
  );
}

describe('PrivacyToggle', () => {
  it('ist standardmäßig aus, trägt den Zustand in aria-pressed und merkt ihn in localStorage', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const button = screen.getByRole('button', { name: de.privacy.toggle.label });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('title', de.privacy.toggle.hintOff);
    expect(screen.queryByTestId('privacy-notice')).not.toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('title', de.privacy.toggle.hintOn);
    expect(screen.getByText(de.privacy.notice.pill)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp('Richtlinien-, Gruppen- und App-Namen')),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(PRIVACY_STORAGE_KEY)).toBe('on');

    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(window.localStorage.getItem(PRIVACY_STORAGE_KEY)).toBeNull();
  });

  it('liest den gespeicherten Zustand beim Start', () => {
    window.localStorage.setItem(PRIVACY_STORAGE_KEY, 'on');
    render(
      <PrivacyProvider>
        <PrivacyToggle />
      </PrivacyProvider>,
    );
    expect(screen.getByRole('button', { name: de.privacy.toggle.label })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('übersteht gesperrten Speicher (kein Fehler, Standard aus)', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    expect(readStoredPrivacy()).toBe(false);
    const user = userEvent.setup();
    render(<Harness />);
    const button = screen.getByRole('button', { name: de.privacy.toggle.label });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('PrivateLink', () => {
  const real =
    'https://intune.microsoft.com/#view/device/deviceId/12345678-90ab-cdef-1234-567890abcdef';

  it('lässt die Adresse aus, wenn der Modus aus ist', () => {
    render(
      <PrivacyProvider initialEnabled={false}>
        <PrivateLink href={real}>Öffnen</PrivateLink>
      </PrivacyProvider>,
    );
    expect(screen.getByRole('link', { name: 'Öffnen' })).toHaveAttribute('href', real);
  });

  it('zeigt im Modus die maskierte Adresse, ein Klick öffnet die echte', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <PrivacyProvider initialEnabled>
        <PrivateLink href={real}>Öffnen</PrivateLink>
      </PrivacyProvider>,
    );
    const link = screen.getByRole('link', { name: 'Öffnen' });
    expect(link.getAttribute('href')).not.toContain('12345678-90ab');
    await userEvent.click(link);
    expect(open).toHaveBeenCalledWith(real, '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });
});

describe('maskFileName', () => {
  const masker = createMasker('t');
  it('ersetzt bei DiagLogs-ZIPs nur den Gerätenamen', () => {
    expect(maskFileName(masker, 'DiagLogs-CONTOSO-PC042-20261014T125356Z.zip')).toBe(
      `DiagLogs-${masker.device('CONTOSO-PC042')}-20261014T125356Z.zip`,
    );
    expect(maskFileName(masker, 'DiagLogs-A-B-20261014T125356Z (2).zip')).toContain(
      masker.device('A-B'),
    );
  });
  it('ersetzt andere Dateinamen vollständig, behält die Endung', () => {
    expect(maskFileName(masker, 'kunde-mueller.zip')).toMatch(/^Datei-[0-9A-F]{4}\.zip$/);
    expect(maskFileName(masker, '')).toBe('');
  });
});

describe('maskedZipTitle', () => {
  const m = createMasker('t');
  const report = (values: Partial<DiagnosticsReport>) => values as DiagnosticsReport;
  const named = report({
    deviceNameFromFile: 'CONTOSO-PC042',
    fileName: 'DiagLogs-CONTOSO-PC042-20261110T101500Z.zip',
  });

  it('nennt das Gerät überall gleich: Kopf der ZIP-Ansicht und Etikett im Vergleich', () => {
    expect(maskedZipTitle(named, { enabled: true, masker: m })).toBe(m.device('CONTOSO-PC042'));
    expect(maskedZipTitle(named, { enabled: true, masker: m })).toMatch(/^Gerät-[0-9A-F]{4}$/);
  });

  it('ohne erkennbaren Gerätenamen: Pseudonym des Dateinamens; Modus aus: unverändert', () => {
    const other = report({ deviceNameFromFile: null, fileName: 'export-anna.zip' });
    expect(maskedZipTitle(other, { enabled: true, masker: m })).toMatch(/^Datei-[0-9A-F]{4}$/);
    expect(maskedZipTitle(named, { enabled: false, masker: m })).toBe('CONTOSO-PC042');
  });
});
