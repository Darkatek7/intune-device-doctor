import { describe, expect, it } from 'vitest';
import { MockProvider } from '../providers/mock/MockProvider';
import { loadFullSnapshot } from '../test/snapshot';
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

  it('enthält die Kachel „Anmeldungen“ samt Conditional-Access-Befund', async () => {
    const provider = new MockProvider({ latency: false, now: () => NOW });
    const snapshot = await loadFullSnapshot(provider, 'CONTOSO-PC042');
    const note = buildTicketNote({
      title: 'CONTOSO-PC042',
      details: [],
      mode: 'demo',
      tiles: evaluateTiles(snapshot, NOW),
      now: NOW,
    });
    expect(note).toContain('**Anmeldungen**');
    expect(note).toContain('Anmeldungen: 2× Conditional-Access-Fehler bei „Microsoft Teams“');
    expect(note).toContain('GET /auditLogs/signIns');
  });

  it('enthält LAPS (PC033) und Integritätsnachweis (PC014) mit Quelle – ohne Kennwort', async () => {
    const provider = new MockProvider({ latency: false, now: () => NOW });
    const note = async (name: string) =>
      buildTicketNote({
        title: name,
        details: [],
        mode: 'demo',
        tiles: evaluateTiles(await loadFullSnapshot(provider, name), NOW),
        now: NOW,
      });
    const laps = await note('CONTOSO-PC033');
    expect(laps).toContain('**Lokaler Administrator (LAPS)**');
    expect(laps).toContain('GET /directory/deviceLocalCredentials/');
    const attestation = await note('CONTOSO-PC014');
    expect(attestation).toContain('**Integritätsnachweis**');
    expect(attestation).toContain('healthStatusMismatchInfo');
    expect(attestation).toContain('deviceHealthAttestationState');
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

  it('hängt „Wahrscheinlichste Ursache“ oben und die letzten Problem-Ereignisse unten an (max. 10)', async () => {
    const note = buildTicketNote({
      title: 'CONTOSO-PC014',
      details: [],
      mode: 'demo',
      tiles: await tilesFor('CONTOSO-PC014'),
      now: NOW,
      insights: [
        {
          id: 'x',
          title: 'Zuerst die Compliance herstellen',
          explanation: 'Erklärung.',
          steps: ['Schritt eins'],
          relatedTiles: ['compliance'],
          why: 'weil',
          docsUrl: 'https://learn.microsoft.com/intune/',
        },
      ],
      timeline: Array.from({ length: 12 }, (_, i) => ({
        id: `e${i}`,
        time: new Date(NOW.getTime() - i * 3_600_000).toISOString(),
        kind: 'signIn' as const,
        severity: 'warning' as const,
        title: `Ereignis ${i}`,
        detail: null,
        tileId: 'signIns' as const,
        source: 'entra' as const,
        planned: false,
      })),
    });
    expect(note).toContain('### Wahrscheinlichste Ursache');
    expect(note.indexOf('Wahrscheinlichste Ursache')).toBeLessThan(note.indexOf('### Status'));
    expect(note).toContain('Zuerst die Compliance herstellen');
    expect(note).toContain('### Zeitachse (letzte Probleme)');
    expect(note).toContain('Ereignis 9');
    expect(note).not.toContain('Ereignis 10');
  });

  it('ohne Insights und Zeitachse bleibt die Notiz unverändert', async () => {
    const tiles = await tilesFor('CONTOSO-PC001');
    const base = { title: 'X', details: [], mode: 'demo' as const, tiles, now: NOW };
    expect(buildTicketNote({ ...base, insights: [], timeline: [] })).toBe(buildTicketNote(base));
    expect(buildTicketNote(base)).not.toContain('Wahrscheinlichste Ursache');
  });
});
