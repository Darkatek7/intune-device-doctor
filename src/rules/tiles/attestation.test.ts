import { describe, expect, it } from 'vitest';
import type { DeviceSnapshot, HealthAttestationInfo } from '../../domain/types';
import { de } from '../../i18n/de';
import { MockProvider } from '../../providers/mock/MockProvider';
import { healthAttestationInfo } from '../../providers/mock/scenarios/helpers';
import { loadFullSnapshot } from '../../test/snapshot';
import { evaluateTiles } from '../evaluate';
import { Docs } from '../knowledge/docs';
import { evaluateAttestation } from './attestation';

const NOW = new Date('2026-10-15T12:00:00Z');
const t = de.rules.attestation;

async function snapshotOf(name: string): Promise<DeviceSnapshot> {
  return loadFullSnapshot(new MockProvider({ latency: false, now: () => NOW }), name);
}

const SOURCE = {
  kind: 'graph',
  label: 'GET /deviceManagement/managedDevices/{id}?$select=deviceHealthAttestationState',
} as const;
const withData = async (data: HealthAttestationInfo): Promise<DeviceSnapshot> => ({
  ...(await snapshotOf('CONTOSO-PC001')),
  healthAttestation: { status: 'ok', data, source: SOURCE, fetchedAt: NOW.toISOString() },
});
const EMPTY: HealthAttestationInfo = {
  lastUpdateDateTime: null,
  issuedDateTime: null,
  secureBoot: null,
  bitLockerStatus: null,
  codeIntegrity: null,
  earlyLaunchAntiMalwareDriverProtection: null,
  bootDebugging: null,
  testSigning: null,
  tpmVersion: null,
  healthStatusMismatchInfo: null,
  healthAttestationSupportedStatus: null,
};

describe('Integritätsnachweis (Device Health Attestation)', () => {
  it('lädt, solange die Section fehlt', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const tile = evaluateAttestation({ device: base.device }, NOW);
    expect(tile.state).toBe('loading');
    expect(tile.sections).toEqual(['healthAttestation']);
  });

  it('Rohwerte ohne Abweichung → ok; Werte unverändert als Fakten, mit Hinweis zur Dokumentation', async () => {
    const tile = evaluateAttestation(await snapshotOf('CONTOSO-PC001'), NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(t.valueData);
    expect(tile.findings).toEqual([]);
    expect(tile.facts.find((f) => f.label === t.facts.secureBoot)?.value).toBe('enabled');
    expect(tile.facts.find((f) => f.label === t.facts.tpmVersion)?.value).toBe('2.0');
    expect(tile.facts.find((f) => f.label === t.facts.note)?.value).toBe(t.facts.noteValue);
  });

  it('einzelne Rohwerte wie „disabled“ werden nicht bewertet (kein Befund ohne Quelle)', async () => {
    const tile = evaluateAttestation(
      await withData(healthAttestationInfo(NOW, { secureBoot: 'disabled', codeIntegrity: 'x' })),
      NOW,
    );
    expect(tile.severity).toBe('ok');
    expect(tile.findings).toEqual([]);
  });

  it('healthStatusMismatchInfo gesetzt → warning mit Quelle, Ursache und Schritten (CONTOSO-PC014)', async () => {
    const tile = evaluateAttestation(await snapshotOf('CONTOSO-PC014'), NOW);
    expect(tile.severity).toBe('warning');
    expect(tile.value).toBe(t.valueMismatch);
    const finding = tile.findings[0]!;
    expect(finding.id).toBe('attestation-mismatch');
    expect(finding.docsUrl).toBe(Docs.healthAttestationResource);
    expect(finding.remediation.length).toBeGreaterThanOrEqual(3);
    expect(finding.evidence).toMatchObject({ healthStatusMismatchInfo: expect.any(String) });
  });

  it('keine Werte → nur Hinweis (unknown), Kachel bleibt ok', async () => {
    const tile = evaluateAttestation(await withData(EMPTY), NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(t.valueNone);
    expect(tile.findings.map((f) => [f.id, f.severity])).toEqual([
      ['attestation-noData', 'unknown'],
    ]);
  });

  it('Zeitwert, der kein Datum ist, wird unverändert angezeigt', async () => {
    const tile = evaluateAttestation(
      await withData(healthAttestationInfo(NOW, { lastUpdateDateTime: 'gestern' })),
      NOW,
    );
    expect(tile.facts.find((f) => f.label === t.facts.lastUpdate)?.value).toBe('gestern');
  });

  it('notApplicable (nicht Windows) / unavailable / error werden als Kachelzustand ausgewiesen', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const na = evaluateAttestation(
      {
        ...base,
        healthAttestation: {
          status: 'notApplicable',
          reason: de.reasons.attestationNotWindows,
          source: SOURCE,
        },
      },
      NOW,
    );
    expect(na.availability).toBe('notApplicable');
    const unavailable = evaluateAttestation(
      {
        ...base,
        healthAttestation: {
          status: 'unavailable',
          reason: de.reasons.attestationNotReported,
          source: SOURCE,
        },
      },
      NOW,
    );
    expect(unavailable.availability).toBe('unavailable');
  });

  it('nur für Windows-Geräte in der Kachelliste', async () => {
    const windows = evaluateTiles(await snapshotOf('CONTOSO-PC001'), NOW);
    expect(windows.map((tile) => tile.id)).toContain('attestation');
    const mac = evaluateTiles(await snapshotOf('CONTOSO-MAC07'), NOW);
    expect(mac.map((tile) => tile.id)).not.toContain('attestation');
  });
});
