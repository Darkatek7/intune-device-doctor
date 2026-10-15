import { describe, expect, it } from 'vitest';
import { MockProvider } from '../providers/mock/MockProvider';
import { evaluateTiles } from './evaluate';
import { buildTicketNote } from './ticketNote';

const NOW = new Date('2026-10-15T12:00:00Z');

async function tilesFor(name: string) {
  const provider = new MockProvider({ latency: false, now: () => NOW });
  const [hit] = await provider.searchDevices(name);
  const device = await provider.getDevice(hit!.id);
  const snapshot = {
    device,
    protection: await provider.getProtectionState(device),
    compliancePolicies: await provider.getCompliancePolicyStates(device),
    configurationPolicies: await provider.getConfigurationPolicyStates(device),
    entraDevice: await provider.getEntraDevice(device),
    bitlockerKeys: await provider.getBitLockerKeys(device),
  };
  return evaluateTiles(snapshot, NOW);
}

describe('buildTicketNote', () => {
  it('listet Status und nur handlungsrelevante Befunde mit Ursache, Lösung, Quelle', async () => {
    const note = buildTicketNote({
      title: 'CONTOSO-PC042',
      details: ['Surface Laptop 6'],
      mode: 'demo',
      tiles: await tilesFor('CONTOSO-PC042'),
      now: NOW,
    });
    expect(note).toContain('## MDM Doctor – Befunde für CONTOSO-PC042');
    expect(note).toContain('Demo-Daten (fiktiv)');
    expect(note).toContain('Konfigurationsprofil „Contoso – VPN Always On“: Fehler');
    expect(note).toContain('**Ursache:**');
    expect(note).toContain('1. ');
    expect(note).toContain(
      'Quelle: `GET /deviceManagement/managedDevices/{id}/deviceConfigurationStates`',
    );
    // Hinweise (unknown) wie der Settings-Catalog-Hinweis gehören nicht ins Ticket
    expect(note).not.toContain('Settings-Catalog-Profile nicht enthalten');
    // Problem-Kachel steht vor OK-Kacheln
    expect(note.indexOf('**Richtlinien**')).toBeLessThan(note.indexOf('**BitLocker**'));
  });

  it('gesundes Gerät: "Keine Probleme gefunden."', async () => {
    const note = buildTicketNote({
      title: 'CONTOSO-PC001',
      details: [],
      mode: 'live',
      tiles: await tilesFor('CONTOSO-PC001'),
      now: NOW,
    });
    expect(note).toContain('Keine Probleme gefunden.');
    expect(note).toContain('Microsoft Graph (live, read-only)');
  });
});
