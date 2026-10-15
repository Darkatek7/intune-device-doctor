import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SectionResult, WindowsProtectionInfo } from '../domain/types';
import { de } from '../i18n/de';
import { ProviderError } from '../providers/DeviceDataProvider';
import { liveMockProvider, renderApp } from '../test/renderApp';

async function search(user: ReturnType<typeof userEvent.setup>, query: string) {
  const input = screen.getByRole('combobox', { name: de.field.label });
  await user.clear(input);
  await user.type(input, `${query}{Enter}`);
}

const tileButtons = () =>
  screen.queryAllByRole('button').filter((b) => b.getAttribute('aria-haspopup') === 'dialog');

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

afterEach(() => {
  // zurück auf das jsdom-Verhalten (Prototyp-Getter)
  delete (window.navigator as unknown as Record<string, unknown>)['onLine'];
});

describe('Offline-Hinweis', () => {
  it('erscheint im Live-Modus ohne Verbindung und verschwindet wieder', () => {
    renderApp({ provider: liveMockProvider(), liveAvailable: true });
    expect(screen.queryByText(de.states.offline)).not.toBeInTheDocument();

    setOnline(false);
    const banner = screen.getByText(de.states.offline);
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveAttribute('aria-live', 'polite');

    setOnline(true);
    expect(screen.queryByText(de.states.offline)).not.toBeInTheDocument();
  });

  it('erscheint im Demo-Modus nicht (Demo und ZIP funktionieren offline)', () => {
    renderApp();
    setOnline(false);
    expect(screen.queryByText(de.states.offline)).not.toBeInTheDocument();
  });
});

describe('Drosselung', () => {
  it('zeigt im Geräte-Header den Hinweis samt Retry-After', async () => {
    const user = userEvent.setup();
    const throttled: SectionResult<WindowsProtectionInfo> = {
      status: 'error',
      error: { code: 'throttled', message: de.errors.throttled, retryAfterSeconds: 30 },
      source: { kind: 'graph', label: 'GET windowsProtectionState' },
    };
    renderApp({
      provider: liveMockProvider({ getProtectionState: async () => throttled }),
      liveAvailable: true,
    });
    await search(user, 'CONTOSO-PC001');

    const notice = await screen.findByTestId('throttle-notice');
    expect(notice).toHaveTextContent(de.states.throttled);
    expect(notice).toHaveTextContent(de.states.retryAfter(30));
    expect(notice).toHaveAttribute('aria-live', 'polite');
  });

  it('zeigt ohne Drosselung keinen Hinweis', async () => {
    const user = userEvent.setup();
    renderApp({ provider: liveMockProvider(), liveAvailable: true });
    await search(user, 'CONTOSO-PC001');
    await waitFor(() => expect(tileButtons()).toHaveLength(7));
    expect(screen.queryByTestId('throttle-notice')).not.toBeInTheDocument();
  });
});

describe('Fehlerzustände', () => {
  it('zeigt bei getDevice-Fehler Meldung, Request-ID und Retry', async () => {
    const user = userEvent.setup();
    renderApp({
      provider: liveMockProvider({
        getDevice: async () => {
          throw new ProviderError({
            code: 'graph',
            message: de.errors.graph,
            requestId: 'req-0000-contoso',
          });
        },
      }),
      liveAvailable: true,
    });
    await search(user, 'CONTOSO-PC001');

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(de.errors.graph)).toBeInTheDocument();
    expect(within(alert).getByText('req-0000-contoso')).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: de.errorState.retry })).toBeInTheDocument();
  });
});

describe('Ticket-Notiz im Geräte-Header', () => {
  afterEach(() => vi.restoreAllMocks());

  it('ist erst nach dem Laden aller Kacheln aktiv und kopiert Markdown mit Gerätename', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    renderApp();
    await search(user, 'CONTOSO-PC042');

    const button = await screen.findByRole('button', { name: de.ticket.button });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(writeText).toHaveBeenCalledTimes(1);
    const note = writeText.mock.calls[0]![0];
    expect(note).toContain('CONTOSO-PC042');
    expect(note).toContain(`## ${de.rules.ticket.heading('CONTOSO-PC042')}`);
    expect(note).toContain(de.rules.ticket.modeDemo);
    expect(await screen.findByText(de.ticket.copied)).toBeInTheDocument();
  });

  it('nutzt für die OS-Zeile den Wert der Betriebssystem-Kachel', async () => {
    const user = userEvent.setup();
    renderApp();
    await search(user, 'CONTOSO-PC042');
    await waitFor(() => expect(tileButtons()).toHaveLength(7));
    const meta = screen.getByRole('heading', { level: 1 }).parentElement!.querySelector('p')!;
    expect(meta.textContent).toMatch(/Windows 11 \d\dH\d/);
    expect(meta.textContent).not.toContain('10.0.22631');
  });
});
