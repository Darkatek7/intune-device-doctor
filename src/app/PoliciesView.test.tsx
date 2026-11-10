import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de';
import { MockProvider } from '../providers/mock/MockProvider';
import { renderApp } from '../test/renderApp';

const t = de.policies;
const rows = () => screen.queryAllByTestId('policy-row');
const rowNamed = (name: string) => rows().find((row) => row.textContent?.includes(name))!;

async function openPolicies(user: ReturnType<typeof userEvent.setup>) {
  // Vorlesename = sichtbarer Text (WCAG 2.5.3)
  await user.click(screen.getByRole('button', { name: de.toolbar.policiesShort }));
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
}

describe('Ansicht „Richtlinien“ (M15)', () => {
  it('ist über die Toolbar erreichbar, schreibt ?view=policies und sortiert nach Problemen', async () => {
    const user = userEvent.setup();
    renderApp();
    await openPolicies(user);
    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeInTheDocument();
    expect(window.location.search).toContain('view=policies');
    expect(screen.getByRole('button', { name: de.toolbar.policiesShort })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const rank = { critical: 0, warning: 1, unknown: 2, ok: 3 } as Record<string, number>;
    const ranks = rows().map((row) => rank[row.getAttribute('data-severity')!]!);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(ranks[0]).toBe(0);
    expect(
      within(rowNamed('Contoso – VPN Always On')).getByText(t.countChip.error(1)),
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(t.notes.betaTitle))).toBeInTheDocument();
  });

  it('Namensfilter schränkt die Liste ein und meldet leere Treffer', async () => {
    const user = userEvent.setup();
    renderApp();
    await openPolicies(user);
    const filter = screen.getByRole('searchbox', { name: t.filterLabel });
    await user.type(filter, 'vpn');
    expect(rows()).toHaveLength(1);
    await user.clear(filter);
    await user.type(filter, 'gibtsnicht');
    expect(rows()).toHaveLength(0);
    expect(screen.getByText(t.emptyFilter('gibtsnicht'))).toBeInTheDocument();
  });

  it('Klick öffnet den Gerätestatus (nur Probleme), „Alle Geräte“ zeigt alle; Zurück fokussiert die Zeile', async () => {
    const user = userEvent.setup();
    renderApp();
    await openPolicies(user);
    await user.click(rowNamed('Contoso – Windows 11 Basis-Compliance'));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Contoso – Windows 11 Basis-Compliance',
      }),
    ).toBeInTheDocument();
    expect(window.location.search).toMatch(/policy=compliance%3A/);
    await waitFor(() => expect(screen.getAllByTestId('policy-status-row')).toHaveLength(1));
    const row = screen.getByTestId('policy-status-row');
    expect(row).toHaveAttribute('data-status', 'nonCompliant');
    expect(within(row).getByText(t.status.nonCompliant)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.detail.filterProblems })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Hinweis zur Abkündigung gilt nur für Konfigurationsprofile
    expect(screen.queryByText(t.detail.deprecation)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.detail.filterAll }));
    expect(screen.getAllByTestId('policy-status-row').length).toBeGreaterThan(1);

    await user.click(screen.getByRole('button', { name: t.detail.back }));
    await waitFor(() =>
      expect(document.activeElement).toBe(rowNamed('Contoso – Windows 11 Basis-Compliance')),
    );
    expect(window.location.search).not.toContain('policy=');
  });

  it('Gerätename öffnet die Geräteansicht über die Suche', async () => {
    const user = userEvent.setup();
    renderApp();
    await openPolicies(user);
    await user.click(rowNamed('Contoso – VPN Always On'));
    const button = await screen.findByRole('button', { name: 'CONTOSO-PC042' });
    expect(screen.getByText(t.detail.deprecation)).toBeInTheDocument();
    await user.click(button);
    await waitFor(() => expect(window.location.search).toContain('device='));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'CONTOSO-PC042' }),
    ).toBeInTheDocument();
  });

  it('fehlende Berechtigung betrifft nur die betroffene Liste; nicht abgefragte Zähler sind ausgewiesen', async () => {
    const provider = new MockProvider({
      latency: false,
      tenant: { compliancePolicies: { status: 'forbidden' }, policyOverviewLimit: 2 },
    });
    const user = userEvent.setup();
    renderApp({ provider });
    await openPolicies(user);
    const alert = screen.getByTestId('policies-compliance-forbidden');
    expect(within(alert).getByText('DeviceManagementConfiguration.Read.All')).toBeInTheDocument();
    expect(rows().every((row) => !row.textContent?.includes(t.kind.compliance))).toBe(true);
    expect(screen.getAllByText(t.overview.notRequested).length).toBeGreaterThan(0);
    expect(screen.getByText(/höchstens für 2 Richtlinien/)).toBeInTheDocument();
  });

  it('Gerätestatus: fehlende Berechtigung zeigt den Scope', async () => {
    const vpnKey = 'configuration:00000000-0000-4000-b000-000000000017';
    const forbidding = new MockProvider({
      latency: false,
      tenant: { policyStatuses: { [vpnKey]: { status: 'forbidden' } } },
    });
    window.history.replaceState({}, '', `/?view=policies&policy=${encodeURIComponent(vpnKey)}`);
    renderApp({ provider: forbidding });
    const alert = await screen.findByTestId('policy-statuses-forbidden');
    expect(within(alert).getByText('DeviceManagementConfiguration.Read.All')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Contoso – VPN Always On' }),
    ).toBeInTheDocument();
  });
});
