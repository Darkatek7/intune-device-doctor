import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de';
import { isApplePlatform, shortcutLabel, useSearchShortcut } from './useSearchShortcut';

function Harness({ withDialog = false }: { withDialog?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useSearchShortcut(ref);
  return (
    <>
      <input ref={ref} aria-label="Suche" defaultValue="CONTOSO-PC001" />
      <input aria-label="Anderes Feld" />
      <button type="button">Knopf</button>
      {withDialog && (
        <div role="dialog" aria-modal="true" aria-label="Dialog">
          <textarea aria-label="Text" />
        </div>
      )}
    </>
  );
}

const nav = (platform: string, uaPlatform?: string) =>
  ({
    platform,
    ...(uaPlatform ? { userAgentData: { platform: uaPlatform } } : {}),
  }) as unknown as Navigator;

describe('useSearchShortcut', () => {
  it('Strg+K fokussiert die Suche und markiert den Inhalt', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('button', { name: 'Knopf' }).focus();
    await user.keyboard('{Control>}k{/Control}');
    const input = screen.getByLabelText<HTMLInputElement>('Suche');
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it('⌘K funktioniert ebenfalls, auch aus einem anderen Eingabefeld', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByLabelText('Anderes Feld'));
    await user.keyboard('{Meta>}k{/Meta}');
    expect(screen.getByLabelText('Suche')).toHaveFocus();
  });

  it('„/“ fokussiert die Suche außerhalb von Eingabefeldern', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('button', { name: 'Knopf' }).focus();
    await user.keyboard('/');
    expect(screen.getByLabelText('Suche')).toHaveFocus();
  });

  it('„/“ in einem Eingabefeld wird normal getippt', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const other = screen.getByLabelText('Anderes Feld');
    await user.click(other);
    await user.keyboard('a/b');
    expect(other).toHaveFocus();
    expect(other).toHaveValue('a/b');
  });

  it('tut nichts, solange ein modaler Dialog offen ist', async () => {
    const user = userEvent.setup();
    render(<Harness withDialog />);
    await user.click(screen.getByLabelText('Text'));
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByLabelText('Text')).toHaveFocus();
    screen.getByRole('button', { name: 'Knopf' }).focus();
    await user.keyboard('/');
    expect(screen.getByLabelText('Suche')).not.toHaveFocus();
  });

  it('wählt die Beschriftung des Hinweis-Chips nach Plattform', () => {
    expect(isApplePlatform(nav('MacIntel'))).toBe(true);
    expect(isApplePlatform(nav('iPhone'))).toBe(true);
    expect(isApplePlatform(nav('Win32'))).toBe(false);
    // userAgentData hat Vorrang vor navigator.platform
    expect(isApplePlatform(nav('Win32', 'macOS'))).toBe(true);
    expect(shortcutLabel(nav('MacIntel'))).toBe(de.comfort.shortcutApple);
    expect(shortcutLabel(nav('Linux x86_64'))).toBe(de.comfort.shortcutOther);
  });
});
