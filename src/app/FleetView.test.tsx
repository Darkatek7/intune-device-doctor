import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FleetDevice, FleetDevicesInfo } from '../domain/fleetDevices';
import { de } from '../i18n/de';
import { downloadTextFile } from '../lib/download';
import { PrivacyProvider } from '../privacy/PrivacyProvider';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { MockProvider } from '../providers/mock/MockProvider';
import type { MockSection } from '../providers/mock/types';
import { renderApp } from '../test/renderApp';
import { FleetView, type FleetFilterState } from './FleetView';

vi.mock('../lib/download', () => ({ downloadTextFile: vi.fn() }));

afterEach(() => {
  vi.mocked(downloadTextFile).mockClear();
  window.history.replaceState({}, '', '/');
});

const t = de.fleetDevices;
const NOW = new Date().toISOString();
const DAYS_AGO = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

function device(index: number, overrides: Partial<FleetDevice> = {}): FleetDevice {
  const n = String(index).padStart(3, '0');
  return {
    id: `dev-${n}`,
    deviceName: `CONTOSO-PC${n}`,
    userPrincipalName: `user${n}@contoso.com`,
    userDisplayName: `Benutzer ${n}`,
    operatingSystem: 'Windows',
    osVersion: '10.0.22631.4460',
    model: 'Contoso Book 14',
    manufacturer: 'Contoso',
    serialNumber: `SN-${n}`,
    complianceState: 'compliant',
    lastSyncDateTime: NOW,
    enrolledDateTime: null,
    isEncrypted: true,
    jailBroken: null,
    ...overrides,
  };
}

function providerWith(
  devices: FleetDevice[],
  extra: Partial<FleetDevicesInfo> = {},
  section?: MockSection<FleetDevicesInfo>,
): DeviceDataProvider {
  return new MockProvider({
    latency: false,
    tenant: {
      fleetDevices: section ?? {
        status: 'ok',
        data: { devices, truncated: false, pagesRead: 1, ...extra },
      },
    },
  });
}

/** Hält den Filter wie die URL in AppShell. */
function Harness({
  provider,
  initial = { issue: null, platform: null },
  onOpenDevice = () => {},
  onFilter,
}: {
  provider: DeviceDataProvider;
  initial?: FleetFilterState;
  onOpenDevice?: (d: { id: string; deviceName: string }) => void;
  onFilter?: (f: FleetFilterState) => void;
}) {
  const [filter, setFilter] = useState(initial);
  return (
    <PrivacyProvider initialEnabled={false} salt="test">
      <FleetView
        provider={provider}
        issue={filter.issue}
        platform={filter.platform}
        onFilterChange={(next) => {
          onFilter?.(next);
          setFilter(next);
        }}
        onOpenDevice={onOpenDevice}
        onBack={() => {}}
      />
    </PrivacyProvider>
  );
}

const rows = () => screen.queryAllByRole('button').filter((b) => b.hasAttribute('data-fleet-row'));
const issueCard = (issue: string) =>
  screen.getAllByRole('button').find((b) => b.getAttribute('data-issue') === issue)!;

const MIXED = [
  device(1),
  device(2, { complianceState: 'noncompliant', isEncrypted: false }),
  device(3, { operatingSystem: 'macOS', osVersion: '15.1', model: 'Contoso Mac' }),
  device(4, { lastSyncDateTime: DAYS_AGO(40) }),
  device(5, { operatingSystem: 'iOS', osVersion: '18.1', complianceState: 'inGracePeriod' }),
];

describe('FleetView', { timeout: 15_000 }, () => {
  it('zeigt Gesamtbild und Liste mit auffälligen Geräten zuerst', async () => {
    render(<Harness provider={providerWith(MIXED)} />);
    expect(await screen.findByRole('heading', { level: 1, name: t.title })).toBeInTheDocument();
    await waitFor(() => expect(rows()).toHaveLength(5));
    const summary = screen.getByTestId('fleet-summary');
    expect(summary).toHaveTextContent('5 Geräte');
    expect(summary).toHaveTextContent('3 auffällig');
    expect(summary).toHaveTextContent('2 kritisch');
    expect(summary).toHaveTextContent('1 Warnung');
    expect(rows()[0]).toHaveAttribute('data-severity', 'critical');
    expect(rows()[4]).toHaveAttribute('data-severity', 'ok');
    expect(screen.getByTestId('fleet-counter')).toHaveTextContent('5 von 5 Geräten');
    expect(screen.getByText(t.note)).toBeInTheDocument();
  });

  it('Auffälligkeitskarten filtern, melden den Filter und lösen ihn wieder', async () => {
    const user = userEvent.setup();
    const onFilter = vi.fn();
    render(<Harness provider={providerWith(MIXED)} onFilter={onFilter} />);
    await waitFor(() => expect(rows()).toHaveLength(5));

    expect(issueCard('notEncrypted')).toHaveAttribute('aria-pressed', 'false');
    await user.click(issueCard('notEncrypted'));
    expect(onFilter).toHaveBeenLastCalledWith({ issue: 'notEncrypted', platform: null });
    expect(issueCard('notEncrypted')).toHaveAttribute('aria-pressed', 'true');
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('CONTOSO-PC002');

    await user.click(issueCard('notEncrypted'));
    expect(onFilter).toHaveBeenLastCalledWith({ issue: null, platform: null });
    expect(rows()).toHaveLength(5);

    await user.click(screen.getByRole('button', { name: t.issues.any }));
    expect(onFilter).toHaveBeenLastCalledWith({ issue: 'any', platform: null });
    expect(rows()).toHaveLength(3);
    // Karte ohne Treffer bleibt sichtbar und bedienbar
    expect(issueCard('jailbroken')).toHaveTextContent('0');
  });

  it('Plattformfilter zeigt nur Plattformen mit Geräten und filtert', async () => {
    const user = userEvent.setup();
    render(<Harness provider={providerWith(MIXED)} />);
    await waitFor(() => expect(rows()).toHaveLength(5));
    const group = screen.getByRole('group', { name: t.platform.label });
    expect(within(group).getByRole('button', { name: 'macOS (1)' })).toBeInTheDocument();
    expect(within(group).queryByRole('button', { name: /Android/ })).not.toBeInTheDocument();
    await user.click(within(group).getByRole('button', { name: 'macOS (1)' }));
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('CONTOSO-PC003');
  });

  it('Suche filtert lokal nach Name, Benutzer, Seriennummer, Modell; Löschen-Knopf leert sie', async () => {
    const user = userEvent.setup();
    render(<Harness provider={providerWith(MIXED)} />);
    await waitFor(() => expect(rows()).toHaveLength(5));
    const input = screen.getByRole('searchbox', { name: t.search.label });
    await user.type(input, 'contoso mac');
    expect(rows()).toHaveLength(1);
    await user.clear(input);
    await user.type(input, 'sn-004');
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('CONTOSO-PC004');
    await user.click(screen.getByRole('button', { name: t.search.clear }));
    expect(input).toHaveValue('');
    expect(rows()).toHaveLength(5);
  });

  it('leerer Filter zeigt einen ruhigen Text, „Filter zurücksetzen“ stellt die Liste wieder her', async () => {
    const user = userEvent.setup();
    render(<Harness provider={providerWith(MIXED)} />);
    await waitFor(() => expect(rows()).toHaveLength(5));
    await user.type(screen.getByRole('searchbox'), 'gibt-es-nicht');
    expect(screen.getByText(t.list.empty.title)).toBeInTheDocument();
    expect(rows()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: t.list.empty.reset }));
    expect(rows()).toHaveLength(5);
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('zeigt zunächst 50 Zeilen und lädt je 50 nach', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 120 }, (_, i) => device(i + 1));
    render(<Harness provider={providerWith(many)} />);
    await waitFor(() => expect(rows()).toHaveLength(50));
    const counter = screen.getByTestId('fleet-counter');
    expect(counter).toHaveAttribute('aria-live', 'polite');
    expect(counter).toHaveTextContent('50 von 120 Geräten');
    await user.click(screen.getByRole('button', { name: /Weitere anzeigen/ }));
    expect(rows()).toHaveLength(100);
    expect(rows()[50]).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Weitere anzeigen (20)' }));
    expect(rows()).toHaveLength(120);
    expect(counter).toHaveTextContent('120 von 120 Geräten');
    expect(screen.queryByRole('button', { name: /Weitere anzeigen/ })).not.toBeInTheDocument();
  });

  it('Klick auf eine Zeile öffnet das Gerät (Tastatur: Enter)', async () => {
    const user = userEvent.setup();
    const onOpenDevice = vi.fn();
    render(<Harness provider={providerWith(MIXED)} onOpenDevice={onOpenDevice} />);
    await waitFor(() => expect(rows()).toHaveLength(5));
    await user.click(rows()[0]!);
    expect(onOpenDevice).toHaveBeenCalledWith({ id: 'dev-002', deviceName: 'CONTOSO-PC002' });
    rows()[1]!.focus();
    await user.keyboard('{Enter}');
    expect(onOpenDevice).toHaveBeenCalledTimes(2);
  });

  it('Auffälligkeiten stehen als Text, Compliance und Verschlüsselung mit vorhandenen Bezeichnungen', async () => {
    render(<Harness provider={providerWith(MIXED)} />);
    await waitFor(() => expect(rows()).toHaveLength(5));
    const first = rows()[0]!;
    expect(first).toHaveTextContent(t.issues.names.nonCompliant);
    expect(first).toHaveTextContent(t.issues.names.notEncrypted);
    expect(first).toHaveTextContent(de.picker.compliance.noncompliant);
    expect(first).toHaveTextContent(t.list.encryption.no);
  });

  it('Export lädt die gefilterte Liste als CSV', async () => {
    const user = userEvent.setup();
    render(<Harness provider={providerWith(MIXED)} />);
    await waitFor(() => expect(rows()).toHaveLength(5));
    await user.click(issueCard('notEncrypted'));
    await user.click(screen.getByRole('button', { name: t.export.button }));
    expect(downloadTextFile).toHaveBeenCalledTimes(1);
    const [name, text, mime] = vi.mocked(downloadTextFile).mock.calls[0]!;
    expect(name).toMatch(/^mdm-doctor-flotte-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(mime).toContain('text/csv');
    expect(text.trimEnd().split('\r\n')).toHaveLength(2);
    expect(text).toContain('CONTOSO-PC002');
    expect(text).not.toContain('CONTOSO-PC001');
  });

  it('weist eine unvollständige Liste aus und nennt die Zahlen Mindestwerte', async () => {
    render(<Harness provider={providerWith(MIXED, { truncated: true })} />);
    const note = await screen.findByTestId('fleet-truncated');
    expect(note).toHaveTextContent(t.truncated.title);
    expect(screen.getByTestId('fleet-summary')).toHaveTextContent('mind. 5 Geräte');
  });

  it('zeigt die Versionsverteilung je Plattform ohne Bewertung', async () => {
    render(<Harness provider={providerWith(MIXED)} />);
    const win = await screen.findByTestId('fleet-versions-windows');
    expect(win).toHaveTextContent('10.0.22631.4460');
    expect(win).toHaveTextContent('3 (100 %)');
    expect(screen.getByText(t.versions.hint)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/veraltet/i);
  });

  it('fehlende Berechtigung nennt den Scope, kein Absturz', async () => {
    const provider = providerWith([], {}, { status: 'forbidden' });
    render(<Harness provider={provider} />);
    expect(await screen.findByText(de.states.forbidden)).toBeInTheDocument();
    expect(screen.getByText('DeviceManagementManagedDevices.Read.All')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.export.button })).toBeDisabled();
  });

  it('leerer Mandant zeigt eine ruhige Meldung', async () => {
    render(<Harness provider={providerWith([])} />);
    expect(await screen.findByText(t.states.emptyTitle)).toBeInTheDocument();
    expect(rows()).toHaveLength(0);
  });

  it('Fehler des Aufrufs zeigt den Fehlerzustand mit Wiederholen', async () => {
    const user = userEvent.setup();
    const inner = providerWith(MIXED);
    let calls = 0;
    const provider: DeviceDataProvider = {
      ...inner,
      mode: 'demo',
      getFleetDevices: (options) => {
        calls += 1;
        return calls === 1 ? Promise.reject(new Error('kaputt')) : inner.getFleetDevices(options);
      },
    };
    render(<Harness provider={provider} />);
    await user.click(await screen.findByRole('button', { name: de.errorState.retry }));
    await waitFor(() => expect(rows()).toHaveLength(5));
  });
});

describe('Ansicht „Flotte“ in der App', { timeout: 20_000 }, () => {
  it('Navigation öffnet die Ansicht; Filter stehen in der URL; Klick öffnet das Gerät', async () => {
    const user = userEvent.setup();
    renderApp({ provider: providerWith(MIXED) });
    await user.click(screen.getByRole('button', { name: de.nav.fleet }));
    expect(await screen.findByRole('heading', { level: 1, name: t.title })).toBeInTheDocument();
    expect(window.location.search).toContain('view=fleet');
    await waitFor(() => expect(rows()).toHaveLength(5));
    await user.click(issueCard('notEncrypted'));
    expect(window.location.search).toContain('issue=notEncrypted');
    expect(window.location.search).toContain('view=fleet');
    await user.click(
      within(screen.getByRole('group', { name: t.platform.label })).getByRole('button', {
        name: /Windows/,
      }),
    );
    expect(window.location.search).toContain('platform=windows');
    expect(screen.getByRole('button', { name: de.nav.fleet })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('liest die Filter aus der URL', async () => {
    window.history.replaceState({}, '', '/?view=fleet&issue=any&platform=ios&mode=demo');
    renderApp({ provider: providerWith(MIXED) });
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent('CONTOSO-PC005');
    expect(issueCard('gracePeriod')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: t.issues.any })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
