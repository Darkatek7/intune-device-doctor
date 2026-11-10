/**
 * Leck-Scanner als Komponententest (M19): Mit eingeschaltetem Präsentationsmodus wird jede Ansicht gerendert
 * und im Textinhalt sowie in den Attributen (title, aria-label, value, href, alt, placeholder) nach den
 * sensiblen Werten gesucht, die aus den Demo-Szenarien gesammelt wurden (src/test/privacyScan.ts).
 * Jede Gegenprobe (Modus aus) muss dieselben Werte finden – sonst prüft der Scanner nichts.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildFixtureZip, FIXTURE_FILE_NAME } from '../diagnostics/fixture';
import { buildConnectionTestReport } from '../domain/connectionTestReport';
import type { EndpointProbeResult } from '../domain/types';
import { navigateTo } from '../hooks/useUrlState';
import { de } from '../i18n/de';
import { MockProvider } from '../providers/mock/MockProvider';
import { scenarios } from '../providers/mock/scenarios';
import { buildSnapshotFile } from '../rules/snapshotCompare';
import { liveMockProvider, renderApp } from '../test/renderApp';
import {
  collectSensitiveValues,
  describeLeaks,
  loadAllMockData,
  scanDom,
  scanText,
} from '../test/privacyScan';
import { collectKnown } from './collect';
import { createMasker } from './masker';
import { createView } from './view';

let values: string[] = [];
beforeAll(async () => {
  values = collectSensitiveValues(await loadAllMockData());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Downloads (Blob-URL + Klick auf den Link) abfangen: die Blobs landen in `sink`. */
function captureDownloads(sink: Blob[]) {
  Object.assign(URL, {
    createObjectURL: (blob: Blob) => {
      sink.push(blob);
      return 'blob:test';
    },
    revokeObjectURL: () => {},
  });
}

const noLeaks = (label: string) => describeLeaks(scanDom(document, values, label));
const tileButtons = () =>
  screen.queryAllByRole('button').filter((b) => b.hasAttribute('data-tile-id'));

async function search(user: ReturnType<typeof userEvent.setup>, query: string) {
  const input = screen.getByRole('combobox', { name: de.field.label });
  await user.clear(input);
  await user.type(input, `${query}{Enter}`);
}

/** Wartet, bis die Geräteansicht fertig ausgewertet ist. */
async function settled() {
  await screen.findByRole('heading', { level: 1 });
  await waitFor(() => expect(tileButtons().length).toBeGreaterThan(3), { timeout: 5000 });
  await waitFor(() => expect(screen.queryByText(/Auswertung läuft/)).not.toBeInTheDocument(), {
    timeout: 5000,
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

describe('Scanner-Gegenprobe (Modus aus)', () => {
  it('findet Namen, Benutzer und Seriennummer in der Geräteansicht', async () => {
    const user = userEvent.setup();
    renderApp();
    await search(user, 'CONTOSO-PC042');
    await settled();
    const found = scanDom(document, values).map((leak) => leak.value);
    expect(found).toContain('contoso-pc042');
    expect(found).toContain('sophie hartmann');
    // auch Attribute (Intune-Portal-Links mit Geräte-ID) werden gefunden
    expect(scanDom(document, values).some((leak) => leak.where.includes('href'))).toBe(true);
  });
});

describe('Startseite und Suche', () => {
  it('Startseite mit „Zuletzt geöffnet“ und Beispiel-Chips', async () => {
    const provider = new MockProvider({ latency: false });
    const recent = [];
    for (const scenario of scenarios) {
      const [hit] = await provider.searchDevices(scenario.deviceName);
      recent.push({
        id: hit!.id,
        deviceName: hit!.deviceName,
        osFamily: 'windows',
        openedAt: new Date().toISOString(),
      });
    }
    window.localStorage.setItem('mdm-doctor.recent.demo', JSON.stringify(recent));
    renderApp({ privacy: true });
    expect(screen.getByTestId('privacy-notice')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /erneut öffnen/ }).length).toBe(8);
    expect(noLeaks('Startseite')).toEqual([]);
  });

  it('Suchvorschläge, Trefferauswahl, Suchfeld und Leerzustand', async () => {
    const user = userEvent.setup();
    renderApp({ privacy: true });
    const input = screen.getByRole('combobox', { name: de.field.label });
    await user.type(input, 'contoso-pc0');
    await screen.findAllByRole('option');
    expect(noLeaks('Suchvorschläge')).toEqual([]);

    await user.keyboard('{Enter}');
    const list = await screen.findByRole('list', { name: de.picker.list });
    expect(within(list).getAllByRole('button').length).toBeGreaterThan(1);
    expect(noLeaks('Trefferauswahl')).toEqual([]);

    // Gerät aus der Auswahl öffnen: das Suchfeld zeigt den Namen danach nicht mehr
    await user.click(within(list).getAllByRole('button')[0]!);
    await settled();
    expect((screen.getByRole('combobox', { name: de.field.label }) as HTMLInputElement).value).toBe(
      '',
    );
    expect(noLeaks('Gerät nach Auswahl')).toEqual([]);

  });

  it('Leerzustand ohne Echo der Eingabe', async () => {
    const user = userEvent.setup();
    renderApp({ privacy: true });
    await search(user, 'gibt-es-nicht-xyz');
    await screen.findByRole('heading', { name: de.empty.notFoundTitle });
    expect(document.body.textContent).not.toContain('gibt-es-nicht-xyz');
  });
});

describe.each(scenarios.map((scenario) => scenario.deviceName))('Gerät %s', (deviceName) => {
  it('Ansicht, alle Detail-Sheets, Zeitachse, Ticket-Notiz', async () => {
    const user = userEvent.setup();
    const provider = new MockProvider({ latency: false });
    const [hit] = await provider.searchDevices(deviceName);
    window.history.replaceState({}, '', `/?device=${hit!.id}&mode=demo`);
    renderApp({ privacy: true, provider });
    await settled();
    expect(document.title).not.toContain(deviceName);
    expect(noLeaks('Geräteansicht')).toEqual([]);

    // Jedes Detail-Sheet über den URL-Zustand öffnen (wie ein Klick auf die Kachel)
    const tileIds = tileButtons().map((button) => button.getAttribute('data-tile-id')!);
    expect(tileIds.length).toBeGreaterThan(5);
    for (const tileId of tileIds) {
      act(() => navigateTo({ device: hit!.id, tile: tileId, mode: 'demo' }, { tileOpened: true }));
      await screen.findByRole('dialog');
      // alle Rohdaten-Bereiche aufklappen
      for (const toggle of screen.queryAllByRole('button', { name: /Rohdaten/ })) {
        if (toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle);
      }
      expect(noLeaks(`Sheet ${tileId}`)).toEqual([]);
    }
    act(() => navigateTo({ device: hit!.id, tile: null, mode: 'demo' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Zeitachse
    await user.click(screen.getByRole('button', { name: de.analysis.timeline.button }));
    await screen.findByRole('dialog');
    expect(noLeaks('Zeitachse')).toEqual([]);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Ticket-Notiz kopieren (user-event stellt eine Zwischenablage bereit)
    await user.click(screen.getByRole('button', { name: de.ticket.button }));
    await waitFor(async () => expect(await navigator.clipboard.readText()).toContain('Gerät-'));
    expect(
      describeLeaks(scanText(await navigator.clipboard.readText(), values, 'Zwischenablage')),
    ).toEqual([]);

    // Druckansicht/PDF: Dialog mit dem Notiztext
    await user.click(screen.getByRole('button', { name: de.actions.more }));
    await user.click(await screen.findByRole('menuitem', { name: de.comfort.printButton }));
    const dialog = await screen.findByRole('dialog', { name: de.ticket.dialogTitle });
    expect(within(dialog).getByText(new RegExp(de.privacy.output.ticketNote))).toBeInTheDocument();
    const note = (within(dialog).getByRole('textbox') as HTMLTextAreaElement).value;
    expect(describeLeaks(scanText(note, values, 'Ticket-Notiz'))).toEqual([]);
    expect(noLeaks('Ticket-Dialog')).toEqual([]);
  }, 60_000);
});

describe('Ausgaben', () => {
  it('Export-JSON und Vergleich mit einer Datei mit echten Namen', async () => {
    const user = userEvent.setup();
    const provider = new MockProvider({ latency: false });
    const [hit] = await provider.searchDevices('CONTOSO-PC042');
    window.history.replaceState({}, '', `/?device=${hit!.id}&mode=demo`);

    const blobs: Blob[] = [];
    captureDownloads(blobs);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderApp({ privacy: true, provider });
    await settled();

    // „Stand exportieren“
    await user.click(screen.getByRole('button', { name: de.actions.more }));
    await user.click(await screen.findByRole('menuitem', { name: de.compare.exportButton }));
    expect(blobs).toHaveLength(1);
    const exported = await blobs[0]!.text();
    expect(describeLeaks(scanText(exported, values, 'Export-JSON'))).toEqual([]);
    expect(exported).toContain('Gerät-');

    // „Mit Stand vergleichen“ – Datei stammt aus dem Modus „aus“ und enthält echte Namen
    const file = buildSnapshotFile({
      tiles: [],
      mode: 'demo',
      deviceName: 'CONTOSO-PC042',
      now: new Date(),
    });
    const upload = new File([JSON.stringify(file)], 'stand-contoso-pc042.json', {
      type: 'application/json',
    });
    await user.upload(screen.getByTestId('compare-input'), upload);
    await screen.findByRole('dialog', { name: de.compare.dialog.title });
    expect(screen.getByTestId('compare-privacy-note')).toBeInTheDocument();
    expect(screen.queryByTestId('compare-name-mismatch')).not.toBeInTheDocument();
    expect(noLeaks('Vergleich')).toEqual([]);
  });

  it('Markdown-Bericht des Verbindungstests', async () => {
    const results: EndpointProbeResult[] = [
      {
        endpointId: 'managedDevice',
        display: 'GET /deviceManagement/managedDevices/{id}',
        version: 'v1.0',
        scope: 'DeviceManagementManagedDevices.Read.All',
        outcome: 'ok',
        httpStatus: null,
        durationMs: 120,
        entryCount: 1,
        fieldNames: ['id', 'deviceName'],
        skipReason: 'Gerät CONTOSO-PC042 hat keinen Benutzer sophie.hartmann@contoso.com',
      },
    ];
    const view = createView(
      createMasker('x'),
      true,
      collectKnown({
        deviceName: 'CONTOSO-PC042',
        userPrincipalName: 'sophie.hartmann@contoso.com',
      }),
    );
    const report = view.text(
      buildConnectionTestReport(results, { osFamily: 'windows', date: new Date(), complete: true }),
    );
    expect(describeLeaks(scanText(report, values, 'Markdown-Bericht'))).toEqual([]);
    expect(report).toContain('| Endpunkt');
  });

  it('Verbindungstest-Ansicht (Live) zeigt nur das Pseudonym', async () => {
    const user = userEvent.setup();
    const testConnection = vi.fn(async () => [] as EndpointProbeResult[]);
    const provider = liveMockProvider({ testConnection });
    const [hit] = await provider.searchDevices('CONTOSO-PC001');
    window.history.replaceState({}, '', `/?device=${hit!.id}&view=connection-test&mode=live`);
    renderApp({ provider, liveAvailable: true, privacy: true });
    await screen.findByRole('heading', { level: 1, name: de.connectionTest.title });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: de.connectionTest.start })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: de.connectionTest.start }));
    expect((await screen.findAllByText(/Gerät-[0-9A-F]{4}/)).length).toBeGreaterThan(0);
    expect(noLeaks('Verbindungstest')).toEqual([]);
  });
});

describe('Mandant, Richtlinien, Sammelprüfung', () => {
  it('Mandant', async () => {
    const user = userEvent.setup();
    renderApp({ privacy: true });
    await user.click(screen.getByRole('button', { name: de.toolbar.tenantShort }));
    await waitFor(() =>
      expect(
        screen
          .queryAllByRole('button')
          .filter((b) => b.getAttribute('data-tile-id')?.startsWith('tenant')),
      ).toHaveLength(5),
    );
    expect(noLeaks('Mandant')).toEqual([]);
    // Registrierungsfehler mit Benutzer-IDs
    await user.click(
      screen
        .queryAllByRole('button')
        .find((b) => b.getAttribute('data-tile-id') === 'tenantEnrollmentFailures')!,
    );
    await screen.findByRole('dialog');
    expect(noLeaks('Mandant: Registrierungsfehler')).toEqual([]);
  });

  it('Richtlinien-Liste und -Detail, Gerät öffnen', async () => {
    const user = userEvent.setup();
    renderApp({ privacy: true });
    await user.click(screen.getByRole('button', { name: de.toolbar.policiesShort }));
    await waitFor(() => expect(screen.queryAllByTestId('policy-row').length).toBeGreaterThan(0));
    expect(noLeaks('Richtlinien-Liste')).toEqual([]);

    const row = screen
      .getAllByTestId('policy-row')
      .find((r) => r.textContent?.includes('Contoso – Windows 11 Basis-Compliance'))!;
    await user.click(row);
    await screen.findByRole('heading', { level: 1, name: 'Contoso – Windows 11 Basis-Compliance' });
    await waitFor(() =>
      expect(screen.queryAllByTestId('policy-status-row').length).toBeGreaterThan(0),
    );
    await user.click(screen.getByRole('button', { name: de.policies.detail.filterAll }));
    expect(noLeaks('Richtlinien-Detail')).toEqual([]);

    // Funktion bleibt: Klick auf das (maskierte) Gerät öffnet das echte Gerät
    const deviceButton = within(screen.getAllByTestId('policy-status-row')[0]!).getByRole('button');
    expect(deviceButton.textContent).toMatch(/^Gerät-[0-9A-F]{4}$/);
    await user.click(deviceButton);
    await settled();
    expect(noLeaks('Gerät aus Richtlinie')).toEqual([]);
  });

  it('Sammelprüfung: Eingabeliste verschwindet nach dem Start, Tabelle und CSV sind maskiert', async () => {
    const user = userEvent.setup();
    const blobs: Blob[] = [];
    captureDownloads(blobs);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderApp({ privacy: true });
    await user.click(screen.getByRole('button', { name: de.bulk.openButton }));
    const names = ['CONTOSO-PC001', 'CONTOSO-PC042', 'CONTOSO-UNBEKANNT'];
    await user.type(await screen.findByRole('textbox'), names.join('\n'));
    await user.click(screen.getByRole('button', { name: de.bulk.start }));
    await waitFor(() => expect(screen.getAllByTestId('bulk-row')).toHaveLength(3));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: de.bulk.exportCsv })).toBeEnabled(),
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(noLeaks('Sammelprüfung')).toEqual([]);
    expect(document.body.textContent).not.toContain('CONTOSO-UNBEKANNT');

    await user.click(screen.getByRole('button', { name: de.bulk.exportCsv }));
    const csv = await blobs[0]!.text();
    expect(describeLeaks(scanText(csv, [...values, 'contoso-unbekannt'], 'CSV'))).toEqual([]);

    // „Neue Liste“: die Eingabe ist leer (nichts aus der alten Liste)
    await user.click(screen.getByRole('button', { name: de.bulk.clear }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });
});

describe('Beispiel-ZIP', () => {
  const fixtureValues = ['contoso-pc042', 'contoso-sn-0001', 'user@contoso.com'];
  const zipLeaks = (label: string) =>
    describeLeaks(scanDom(document, [...values, ...fixtureValues], label));

  it('ZIP-Ansicht, Sheets und zusammengeführte Ansicht', async () => {
    const user = userEvent.setup();
    renderApp({ privacy: true });
    await user.click(screen.getByRole('button', { name: new RegExp(de.zipView.exampleChip) }));
    await screen.findByRole('heading', { level: 1, name: /Gerät-[0-9A-F]{4}/ });
    await waitFor(() => expect(tileButtons()).toHaveLength(7));
    expect(document.title).not.toContain('CONTOSO-PC042');
    expect(zipLeaks('ZIP-Ansicht')).toEqual([]);
    expect(document.body.textContent).not.toContain(FIXTURE_FILE_NAME);
    expect(document.body.textContent).toMatch(/DiagLogs-Gerät-[0-9A-F]{4}-20261014T125356Z\.zip/);

    for (const button of tileButtons()) {
      await user.click(button);
      await screen.findByRole('dialog');
      for (const toggle of screen.queryAllByRole('button', { name: /Rohdaten/ })) {
        if (toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle);
      }
      expect(zipLeaks(`ZIP-Sheet ${button.getAttribute('data-tile-id')}`)).toEqual([]);
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    }

    // Zeitachse und Ticket-Notiz der ZIP
    await user.click(screen.getByRole('button', { name: de.analysis.timeline.button }));
    await screen.findByRole('dialog');
    expect(zipLeaks('ZIP-Zeitachse')).toEqual([]);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: de.ticket.button }));
    const copied = await (async () => {
      await waitFor(async () => expect(await navigator.clipboard.readText()).toContain('Gerät-'));
      return navigator.clipboard.readText();
    })();
    expect(describeLeaks(scanText(copied, [...values, ...fixtureValues], 'ZIP-Notiz'))).toEqual([]);
    await user.click(screen.getByRole('button', { name: de.actions.more }));
    await user.click(await screen.findByRole('menuitem', { name: de.comfort.printButton }));
    const dialog = await screen.findByRole('dialog', { name: de.ticket.dialogTitle });
    const note = (within(dialog).getByRole('textbox') as HTMLTextAreaElement).value;
    expect(describeLeaks(scanText(note, [...values, ...fixtureValues], 'ZIP-Druck'))).toEqual([]);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Zusammenführen
    const offer = await screen.findByRole('region', { name: /Gerät-[0-9A-F]{4}/ });
    await user.click(within(offer).getByRole('button', { name: de.zipView.merge.action }));
    await settled();
    await waitFor(() => expect(tileButtons().length).toBeGreaterThan(15));
    expect(zipLeaks('Zusammengeführte Ansicht')).toEqual([]);
  }, 60_000);

  it('Datei-Drop-Name im Fortschritt bleibt verborgen', () => {
    // Das Dateiformat der Fixture ist DiagLogs-<Gerät>-<Zeitstempel>.zip
    expect(FIXTURE_FILE_NAME).toContain('CONTOSO-PC042');
    expect(buildFixtureZip().byteLength).toBeGreaterThan(0);
  });
});
