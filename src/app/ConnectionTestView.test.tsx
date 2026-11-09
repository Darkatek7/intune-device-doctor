import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EndpointProbeResult } from '../domain/types';
import { de } from '../i18n/de';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { liveMockProvider, renderApp } from '../test/renderApp';

const t = de.connectionTest;

const probe = (overrides: Partial<EndpointProbeResult> = {}): EndpointProbeResult => ({
  endpointId: 'managedDevice',
  display: 'GET /deviceManagement/managedDevices/{id}',
  version: 'v1.0',
  scope: 'DeviceManagementManagedDevices.Read.All',
  outcome: 'ok',
  httpStatus: null,
  durationMs: 120,
  entryCount: 1,
  fieldNames: ['id', 'deviceName'],
  skipReason: null,
  ...overrides,
});

const RESULTS: EndpointProbeResult[] = [
  probe(),
  probe({
    endpointId: 'vppTokens',
    display: 'GET /deviceAppManagement/vppTokens',
    scope: 'DeviceManagementServiceConfig.Read.All',
    outcome: 'forbidden',
    httpStatus: 403,
    durationMs: 80,
    entryCount: null,
    fieldNames: [],
  }),
  probe({
    endpointId: 'mobileAppIntentAndStates',
    display: 'GET /beta/users/{userId}/mobileAppIntentAndStates',
    version: 'beta',
    entryCount: 4,
    fieldNames: ['id', 'mobileAppList'],
  }),
  probe({
    endpointId: 'windowsProtectionState',
    display: 'GET /deviceManagement/managedDevices/{id}/windowsProtectionState',
    outcome: 'skipped',
    durationMs: null,
    entryCount: null,
    fieldNames: [],
    skipReason: t.skip.windowsOnly,
  }),
];

/** Liefert alle Ergebnisse sofort und meldet sie nacheinander an onResult. */
function fakeTest() {
  return vi.fn<NonNullable<DeviceDataProvider['testConnection']>>(async (_device, options) => {
    RESULTS.forEach((result, index) => options?.onResult?.(result, index, RESULTS.length));
    return RESULTS;
  });
}

async function liveDeviceId(provider: DeviceDataProvider): Promise<string> {
  const [hit] = await provider.searchDevices('CONTOSO-PC001');
  return hit!.id;
}

function openLive(provider: DeviceDataProvider) {
  return renderApp({ provider, liveAvailable: true });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Verbindungstest – Einstieg', () => {
  it('fehlt im Demo-Modus (Provider ohne testConnection)', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByRole('combobox', { name: de.field.label }), 'CONTOSO-PC001{Enter}');
    await screen.findByRole('heading', { level: 1, name: /CONTOSO-PC001/ });
    expect(screen.queryByRole('button', { name: t.open })).not.toBeInTheDocument();
  });

  it('Demo-Deep-Link ?view=connection-test zeigt die normale Geräteansicht', async () => {
    const provider = liveMockProvider();
    const id = await liveDeviceId(provider);
    window.history.replaceState({}, '', `/?device=${id}&view=connection-test&mode=demo`);
    renderApp();
    await screen.findByRole('heading', { level: 1, name: /CONTOSO-PC001/ });
    expect(screen.queryByRole('heading', { level: 1, name: t.title })).not.toBeInTheDocument();
  });

  it('Live: Button in der Geräteansicht öffnet die Ansicht, schreibt view=connection-test und kehrt zurück', async () => {
    const user = userEvent.setup();
    const provider = liveMockProvider({ testConnection: fakeTest() });
    openLive(provider);
    await user.type(screen.getByRole('combobox', { name: de.field.label }), 'CONTOSO-PC001{Enter}');
    await user.click(await screen.findByRole('button', { name: t.open }));

    expect(await screen.findByRole('heading', { level: 1, name: t.title })).toBeInTheDocument();
    expect(window.location.search).toContain('view=connection-test');
    expect(window.location.search).toContain('device=');
    expect(window.location.search).not.toContain('tile=');
    // Der Test startet nie von selbst
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.back }));
    await screen.findByRole('heading', { level: 1, name: /CONTOSO-PC001/ });
    expect(window.location.search).not.toContain('view=');
  });

  it('Deep-Link öffnet die Ansicht direkt', async () => {
    const provider = liveMockProvider({ testConnection: fakeTest() });
    const id = await liveDeviceId(provider);
    window.history.replaceState({}, '', `/?device=${id}&view=connection-test&mode=live`);
    openLive(provider);
    expect(await screen.findByRole('heading', { level: 1, name: t.title })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: t.start })).toBeEnabled());
  });
});

describe('Verbindungstest – Lauf', () => {
  async function runTest() {
    const user = userEvent.setup();
    const testConnection = fakeTest();
    const provider = liveMockProvider({ testConnection });
    const id = await liveDeviceId(provider);
    window.history.replaceState({}, '', `/?device=${id}&view=connection-test&mode=live`);
    openLive(provider);
    const start = await screen.findByRole('button', { name: t.start });
    await waitFor(() => expect(start).toBeEnabled());
    await user.click(start);
    await screen.findByRole('table', { name: t.tableLabel });
    return { user, testConnection };
  }

  it('startet auf Klick, ruft den Provider einmal mit dem Gerät auf und zeigt eine Zeile je Endpunkt', async () => {
    const { testConnection } = await runTest();
    expect(testConnection).toHaveBeenCalledTimes(1);
    expect(testConnection.mock.calls[0]?.[0].deviceName).toBe('CONTOSO-PC001');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(RESULTS.length);

    const managed = rows.find((row) => row.getAttribute('data-endpoint-id') === 'managedDevice')!;
    expect(within(managed).getByText(t.outcome.ok)).toBeInTheDocument();
    expect(within(managed).getByText('120 ms')).toBeInTheDocument();
    expect(within(managed).getByText('id, deviceName')).toBeInTheDocument();

    const vpp = rows.find((row) => row.getAttribute('data-endpoint-id') === 'vppTokens')!;
    expect(within(vpp).getByText(t.outcome.forbidden)).toBeInTheDocument();
    expect(within(vpp).getByText('DeviceManagementServiceConfig.Read.All')).toBeInTheDocument();

    const skipped = rows.find(
      (row) => row.getAttribute('data-endpoint-id') === 'windowsProtectionState',
    )!;
    expect(within(skipped).getByText(t.outcome.skipped)).toBeInTheDocument();
    expect(within(skipped).getByText(t.skip.windowsOnly)).toBeInTheDocument();
  });

  it('kennzeichnet den Beta-Endpunkt', async () => {
    await runTest();
    const beta = screen
      .getAllByRole('row')
      .find((row) => row.getAttribute('data-endpoint-id') === 'mobileAppIntentAndStates')!;
    expect(within(beta).getByText(t.betaBadge)).toBeInTheDocument();
    const others = screen.getAllByText(t.betaBadge);
    expect(others).toHaveLength(1);
  });

  it('zeigt die Zusammenfassung und den Markdown-Bericht ohne Gerätenamen', async () => {
    await runTest();
    expect(await screen.findByText(t.finished)).toBeInTheDocument();
    expect(screen.getByText(t.summary({ ok: 2, forbidden: 1, skipped: 1 }))).toBeInTheDocument();
    const report = screen.getByRole('textbox', { name: t.reportLabel }) as HTMLTextAreaElement;
    expect(report.value).toContain(`## ${t.report.title}`);
    expect(report.value).toContain('`GET /deviceAppManagement/vppTokens`');
    expect(report.value).toContain('forbidden');
    expect(report.value).not.toMatch(/CONTOSO-PC001/);
    expect(report.value).not.toMatch(/contoso\.com/i);
    expect(report.value).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });

  it('kopiert den Bericht in die Zwischenablage', async () => {
    const { user } = await runTest();
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await user.click(await screen.findByRole('button', { name: t.copy }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const text = (writeText.mock.calls[0] as unknown as [string])[0];
    expect(text).toContain(`## ${t.report.title}`);
    expect(await screen.findByText(t.copied)).toBeInTheDocument();
  });

  it('weist bei fehlender Zwischenablage auf manuelles Kopieren hin', async () => {
    const { user } = await runTest();
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    await user.click(await screen.findByRole('button', { name: t.copy }));
    expect(await screen.findByText(t.copyFallback)).toBeInTheDocument();
  });

  it('lässt sich erneut starten', async () => {
    const { user, testConnection } = await runTest();
    await user.click(await screen.findByRole('button', { name: t.restart }));
    await waitFor(() => expect(testConnection).toHaveBeenCalledTimes(2));
  });
});

describe('Verbindungstest – Abbruch und Fehler', () => {
  it('Abbrechen beendet den Lauf, behält die bisherigen Ergebnisse und kennzeichnet den Bericht', async () => {
    const user = userEvent.setup();
    const testConnection = vi.fn<NonNullable<DeviceDataProvider['testConnection']>>(
      (_device, options) =>
        new Promise((_resolve, reject) => {
          options?.onResult?.(RESULTS[0]!, 0, RESULTS.length);
          options?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const provider = liveMockProvider({ testConnection });
    const id = await liveDeviceId(provider);
    window.history.replaceState({}, '', `/?device=${id}&view=connection-test&mode=live`);
    openLive(provider);
    const start = await screen.findByRole('button', { name: t.start });
    await waitFor(() => expect(start).toBeEnabled());
    await user.click(start);

    expect(await screen.findByText(t.running(1, RESULTS.length))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.cancel }));

    expect(await screen.findByText(t.cancelled)).toBeInTheDocument();
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(1);
    const report = screen.getByRole('textbox', { name: t.reportLabel }) as HTMLTextAreaElement;
    expect(report.value).toContain(t.report.partial);
    expect(screen.getByRole('button', { name: t.restart })).toBeEnabled();
  });

  it('bricht den laufenden Test ab, wenn die Ansicht verlassen wird', async () => {
    const user = userEvent.setup();
    let signal: AbortSignal | undefined;
    const testConnection = vi.fn<NonNullable<DeviceDataProvider['testConnection']>>(
      (_device, options) => {
        signal = options?.signal;
        return new Promise(() => undefined);
      },
    );
    const provider = liveMockProvider({ testConnection });
    const id = await liveDeviceId(provider);
    window.history.replaceState({}, '', `/?device=${id}&view=connection-test&mode=live`);
    openLive(provider);
    const start = await screen.findByRole('button', { name: t.start });
    await waitFor(() => expect(start).toBeEnabled());
    await user.click(start);
    await waitFor(() => expect(signal).toBeDefined());
    await user.click(screen.getByRole('button', { name: t.back }));
    await waitFor(() => expect(signal?.aborted).toBe(true));
  });

  it('zeigt einen Fehler des Aufrufs an und erlaubt einen neuen Versuch', async () => {
    const user = userEvent.setup();
    const testConnection = vi
      .fn<NonNullable<DeviceDataProvider['testConnection']>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(RESULTS);
    const provider = liveMockProvider({ testConnection });
    const id = await liveDeviceId(provider);
    window.history.replaceState({}, '', `/?device=${id}&view=connection-test&mode=live`);
    openLive(provider);
    const start = await screen.findByRole('button', { name: t.start });
    await waitFor(() => expect(start).toBeEnabled());
    await user.click(start);
    expect(await screen.findByRole('alert')).toHaveTextContent(de.errors.unknown);
    await user.click(screen.getByRole('button', { name: t.restart }));
    await screen.findByRole('table', { name: t.tableLabel });
  });
});
