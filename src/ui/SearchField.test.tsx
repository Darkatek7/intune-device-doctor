import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DeviceSearchResult } from '../domain/types';
import { de } from '../i18n/de';
import { SearchField } from './SearchField';

const suggestion = (id: string, name: string): DeviceSearchResult => ({
  id,
  deviceName: name,
  userPrincipalName: null,
  userDisplayName: 'Max Muster',
  operatingSystem: 'Windows',
  osVersion: '10.0',
  model: null,
  complianceState: 'compliant',
  lastSyncDateTime: null,
});

function Harness(props: {
  onSubmit: (v: string) => void;
  onSelect?: (s: DeviceSearchResult) => void;
  suggestions?: DeviceSearchResult[];
}) {
  const [value, setValue] = useState('');
  return (
    <SearchField
      value={value}
      onChange={setValue}
      onSubmit={props.onSubmit}
      onSelectSuggestion={props.onSelect}
      suggestions={props.suggestions}
    />
  );
}

describe('SearchField', () => {
  it('sucht bei Enter sofort mit dem eingegebenen Wert', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await user.type(screen.getByRole('combobox'), 'CONTOSO-PC001{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('CONTOSO-PC001');
  });

  it('wählt Vorschläge per Pfeiltasten und Enter', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onSelect = vi.fn();
    const items = [suggestion('1', 'CONTOSO-PC001'), suggestion('2', 'CONTOSO-PC014')];
    render(<Harness onSubmit={onSubmit} onSelect={onSelect} suggestions={items} />);

    const input = screen.getByRole('combobox');
    await user.type(input, 'contoso');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(2);

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(items[1]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('schließt die Vorschläge mit Escape', async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} suggestions={[suggestion('1', 'CONTOSO-PC001')]} />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'c');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('leert das Feld über den Löschen-Button', async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'abc');
    await user.click(screen.getByRole('button', { name: de.field.clear }));
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });
});
