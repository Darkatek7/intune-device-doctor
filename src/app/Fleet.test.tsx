/** M20: neue Inhalte der Ansicht „Mandant“ und der Geräteansicht (Demo-Modus). */
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de';
import { MockProvider } from '../providers/mock/MockProvider';
import { VPN_POLICY_ID } from '../providers/mock/fleet';
import { renderApp } from '../test/renderApp';

const tileById = (id: string) =>
  screen.getAllByRole('button').find((b) => b.getAttribute('data-tile-id') === id)!;

// Erster Render lädt die Ansicht lazy – unter Last dauert das länger als 5 s.
describe('Ansicht „Mandant“ – Compliance-Übersicht (M20/S1)', { timeout: 20_000 }, () => {
  it('zeigt Abschnitte, Kachel mit Anteil und einen Balken mit Textalternative', async () => {
    window.history.replaceState({}, '', '/?view=tenant&mode=demo');
    renderApp({ provider: new MockProvider({ latency: false }) });
    const heading = await screen.findByRole('heading', {
      level: 2,
      name: de.fleet.sections.overview,
    });
    expect(heading).toBeInTheDocument();
    await waitFor(() => expect(tileById('tenantCompliance')).toBeDefined());
    expect(
      within(tileById('tenantCompliance')).getByText(de.fleet.summary.valueShare('80 %')),
    ).toBeInTheDocument();
    const bar = screen.getByRole('img', { name: /Anteile Compliance im Mandanten: Konform: 212/ });
    expect(bar).toBeInTheDocument();
    expect(screen.getAllByRole('list', { name: de.fleet.summary.bar.legend })[0]).toHaveTextContent(
      'Nicht konform31',
    );
  });

  it('fehlende Berechtigung für die Zähler betrifft nur ihre Kachel (kein Balken)', async () => {
    window.history.replaceState({}, '', '/?view=tenant&mode=demo');
    renderApp({
      provider: new MockProvider({
        latency: false,
        tenant: { complianceSummary: { status: 'forbidden' } },
      }),
    });
    await waitFor(() => expect(tileById('tenantCompliance')).toBeDefined());
    expect(
      within(tileById('tenantCompliance')).getByText(de.availability.forbidden),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('share-bar-compliance')).toBeNull();
    expect(screen.getByTestId('share-bar-configuration')).toBeInTheDocument();
  });
});

describe('Änderungsprotokoll (M20/S2)', { timeout: 20_000 }, () => {
  it('Ansicht „Mandant“: Kachel „Letzte Änderungen“ im Abschnitt „Änderungen“', async () => {
    window.history.replaceState({}, '', '/?view=tenant&mode=demo');
    renderApp({ provider: new MockProvider({ latency: false }) });
    await screen.findByRole('heading', { level: 2, name: de.fleet.sections.changes });
    await waitFor(() => expect(tileById('tenantChanges')).toBeDefined());
    expect(
      within(tileById('tenantChanges')).getByText(de.fleet.audit.value(4)),
    ).toBeInTheDocument();
  });

  it('Richtlinien-Detail: Änderungen an „VPN Always On“ mit ruhigem Hinweis ohne Kausalität', async () => {
    window.history.replaceState(
      {},
      '',
      `/?view=policies&policy=configuration:${VPN_POLICY_ID}&mode=demo`,
    );
    renderApp({ provider: new MockProvider({ latency: false }) });
    const region = await screen.findByRole('region', { name: /Änderungen an/ });
    expect(within(region).getAllByTestId('policy-change-row')).toHaveLength(2);
    expect(within(region).getAllByText('Patch DeviceConfiguration')[0]).toHaveAttribute(
      'lang',
      'en',
    );
    const hint = await screen.findByTestId('policy-change-hint');
    expect(hint).toHaveTextContent('nicht belegt');
    expect(hint).toHaveTextContent('Eigener Richtwert');
  });

  it('Richtlinien-Detail: fehlende Berechtigung für das Protokoll bricht die Ansicht nicht', async () => {
    window.history.replaceState(
      {},
      '',
      `/?view=policies&policy=configuration:${VPN_POLICY_ID}&mode=demo`,
    );
    renderApp({
      provider: new MockProvider({
        latency: false,
        tenant: { auditEvents: { status: 'forbidden' } },
      }),
    });
    expect(
      await screen.findByText(
        /Änderungen nicht abrufbar: Es fehlt die Berechtigung DeviceManagementApps\.Read\.All/,
      ),
    ).toBeInTheDocument();
    expect(await screen.findAllByTestId('policy-status-row')).not.toHaveLength(0);
  });
});
