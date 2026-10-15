import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DeviceSearchResult } from '../domain/types';
import { de } from '../i18n/de';
import { ErrorState } from './ErrorState';
import { Landing } from './Landing';
import { ResultPicker } from './ResultPicker';

const now = new Date('2026-10-15T12:00:00Z');
const result = (over: Partial<DeviceSearchResult>): DeviceSearchResult => ({
  id: '1',
  deviceName: 'CONTOSO-PC001',
  userPrincipalName: 'a@contoso.com',
  userDisplayName: 'Anna Beispiel',
  operatingSystem: 'Windows',
  osVersion: '10.0.26100',
  model: null,
  complianceState: 'noncompliant',
  lastSyncDateTime: '2026-10-15T09:00:00Z',
  ...over,
});

describe('ResultPicker', () => {
  it('zeigt Nutzer, OS, Compliance als Text und relativen Sync; Auswahl per Klick', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const items = [
      result({}),
      result({ id: '2', deviceName: 'CONTOSO-PC014', userDisplayName: null }),
    ];
    render(<ResultPicker results={items} query="contoso" now={now} onSelect={onSelect} />);

    const first = screen.getByRole('button', { name: de.picker.select('CONTOSO-PC001') });
    expect(first).toHaveTextContent('Anna Beispiel');
    expect(first).toHaveTextContent('Windows 10.0.26100');
    expect(first).toHaveTextContent(de.picker.compliance.noncompliant);
    expect(first).toHaveTextContent(/vor 3 Std\./);

    await user.click(screen.getByRole('button', { name: de.picker.select('CONTOSO-PC014') }));
    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });
});

describe('Landing', () => {
  it('zeigt Beispiel-Chips, lädt per Klick und bietet Platz für Extra-Chips', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <Landing
        search={<div />}
        examples={[{ deviceName: 'CONTOSO-PC001', label: 'Gesundes Gerät' }]}
        onPickExample={onPick}
        extraChips={<li>Beispiel-ZIP</li>}
      />,
    );
    await user.click(screen.getByRole('button', { name: /CONTOSO-PC001/ }));
    expect(onPick).toHaveBeenCalledWith('CONTOSO-PC001');
    expect(screen.getByText('Beispiel-ZIP')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(de.dropZone.privacy))).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('zeigt Meldung und Scope und bietet Retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <ErrorState
        error={{
          code: 'forbidden',
          message: 'Zugriff verweigert',
          requiredScope: 'Device.Read.All',
        }}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Zugriff verweigert');
    expect(screen.getByText('Device.Read.All')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: de.errorState.retry }));
    expect(onRetry).toHaveBeenCalled();
  });
});
