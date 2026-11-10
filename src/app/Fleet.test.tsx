/** M20: neue Inhalte der Ansicht „Mandant“ und der Geräteansicht (Demo-Modus). */
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de';
import { MockProvider } from '../providers/mock/MockProvider';
import { renderApp } from '../test/renderApp';

const tileById = (id: string) =>
  screen.getAllByRole('button').find((b) => b.getAttribute('data-tile-id') === id)!;

describe('Ansicht „Mandant“ – Compliance-Übersicht (M20/S1)', () => {
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
    expect(within(tileById('tenantCompliance')).getByText(de.availability.forbidden)).toBeInTheDocument();
    expect(screen.queryByTestId('share-bar-compliance')).toBeNull();
    expect(screen.getByTestId('share-bar-configuration')).toBeInTheDocument();
  });
});
