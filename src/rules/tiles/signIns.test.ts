import { describe, expect, it } from 'vitest';
import type { DeviceSnapshot, SectionResult, SignInEntry, SignInsInfo } from '../../domain/types';
import { de } from '../../i18n/de';
import { MockProvider } from '../../providers/mock/MockProvider';
import { signInEntry, signInsInfo } from '../../providers/mock/scenarios/helpers';
import { loadFullSnapshot } from '../../test/snapshot';
import { Docs } from '../knowledge/docs';
import { evaluateSignIns } from './signIns';

const NOW = new Date('2026-10-15T12:00:00Z');
const t = de.rules.signIns;

async function snapshotOf(name: string): Promise<DeviceSnapshot> {
  return loadFullSnapshot(new MockProvider({ latency: false, now: () => NOW }), name);
}

const SOURCE = { kind: 'graph', label: 'GET /auditLogs/signIns?…' } as const;
const ok = (data: SignInsInfo): SectionResult<SignInsInfo> => ({
  status: 'ok',
  data,
  source: SOURCE,
  fetchedAt: NOW.toISOString(),
});

async function withSignIns(
  data: SignInsInfo,
  overrides: Partial<DeviceSnapshot['device']> = {},
): Promise<DeviceSnapshot> {
  const base = await snapshotOf('CONTOSO-PC001');
  return { ...base, device: { ...base.device, ...overrides }, signIns: ok(data) };
}

const failure = (n: number, overrides: Partial<SignInEntry> = {}): SignInEntry =>
  signInEntry(
    NOW,
    n,
    { hours: n },
    {
      appDisplayName: 'Microsoft Teams',
      conditionalAccessStatus: 'failure',
      errorCode: 53000,
      failureReason: 'Device is not compliant.',
      appliedPolicies: [
        {
          id: 'p1',
          displayName: 'Contoso – Kompatibles Gerät erforderlich',
          result: 'failure',
          enforcedGrantControls: ['Require device to be marked as compliant'],
          enforcedSessionControls: [],
        },
      ],
      ...overrides,
    },
  );

describe('Anmeldungen (signIns)', () => {
  it('lädt, solange die Section fehlt', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const tile = evaluateSignIns({ device: base.device }, NOW);
    expect(tile.state).toBe('loading');
    expect(tile.sections).toEqual(['signIns']);
  });

  it('nur erfolgreiche Anmeldungen → ok, „Keine CA-Fehler“, Fakten zu Anzahl und Richtliniendetails', async () => {
    const tile = evaluateSignIns(await snapshotOf('CONTOSO-PC001'), NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(t.valueOk);
    expect(tile.findings).toEqual([]);
    expect(tile.facts.map((f) => f.label)).toEqual(
      expect.arrayContaining([t.facts.deviceCount(7), t.facts.failures, t.facts.policyDetails]),
    );
    expect(tile.sources).toHaveLength(1);
  });

  it('conditionalAccessStatus failure → warning mit App, Zeitpunkt, Richtlinie und belegter Deutung des Codes 53000', async () => {
    const tile = evaluateSignIns(await snapshotOf('CONTOSO-PC042'), NOW);
    expect(tile.severity).toBe('warning');
    expect(tile.value).toBe(t.valueFailures(2));
    const finding = tile.findings.find((f) => f.id === 'signIns-failure-1')!;
    expect(finding.severity).toBe('warning');
    expect(finding.title).toBe(t.failureTitle('Microsoft Teams', 2));
    expect(finding.detail).toContain('Microsoft Teams');
    expect(finding.detail).toContain('Contoso – Kompatibles Gerät erforderlich');
    expect(finding.detail).toContain('53000 (DeviceNotCompliant)');
    expect(finding.cause).toContain('konformes Gerät');
    expect(finding.docsUrl).toBe(Docs.entraErrorCodes);
    expect(finding.evidence).toMatchObject({ errorCode: 53000, occurrences: 2 });
    expect(finding.evidence?.correlationId).toEqual(expect.any(String));
    // keine IP-Adresse / kein Standort
    expect(JSON.stringify(finding)).not.toMatch(/ipAddress|location/i);
  });

  it('unbekannter Fehlercode → „Unbekannter Code“, keine Deutung erfunden', async () => {
    const data = signInsInfo([failure(1, { errorCode: 50126, failureReason: null })]);
    const tile = evaluateSignIns(await withSignIns(data), NOW);
    const finding = tile.findings.find((f) => f.id === 'signIns-failure-1')!;
    expect(finding.detail).toContain('Unbekannter Code 50126 (AADSTS50126)');
    expect(finding.cause).toBe(t.failureCause);
    expect(finding.docsUrl).toBe(Docs.conditionalAccessTroubleshoot);
  });

  it('gruppiert nach App und fehlgeschlagenen Richtlinien (höchstens drei Befunde)', async () => {
    const apps = ['A', 'B', 'C', 'D'];
    const data = signInsInfo(
      apps.flatMap((app, i) => [
        failure(i * 2 + 1, { appDisplayName: app }),
        failure(i * 2 + 2, { appDisplayName: app }),
      ]),
    );
    const tile = evaluateSignIns(await withSignIns(data), NOW);
    const failures = tile.findings.filter((f) => f.id.startsWith('signIns-failure-'));
    expect(failures).toHaveLength(3);
    expect(tile.value).toBe(t.valueFailures(8));
  });

  it('Richtliniendetails fehlen (Rolle) → eigener Hinweis, Fakt „nicht sichtbar“, kein Raten', async () => {
    const tile = evaluateSignIns(await snapshotOf('CONTOSO-PC014'), NOW);
    expect(tile.severity).toBe('warning');
    const failureFinding = tile.findings.find((f) => f.id === 'signIns-failure-1')!;
    expect(failureFinding.detail).toContain(t.policiesHiddenShort);
    const hint = tile.findings.find((f) => f.id === 'signIns-policyDetailsHidden')!;
    expect(hint.severity).toBe('unknown');
    expect(hint.title).toBe(t.hiddenTitle);
    expect(hint.remediation.join(' ')).toContain('Conditional Access Administrator');
    expect(tile.facts.find((f) => f.label === t.facts.policyDetails)?.value).toBe(
      t.facts.policyHidden,
    );
  });

  it('Anmeldung „nicht konform“, Intune „konform“ → Hinweis (unknown), Kachel bleibt ok', async () => {
    const tile = evaluateSignIns(await snapshotOf('CONTOSO-PC027'), NOW);
    expect(tile.severity).toBe('ok');
    const hint = tile.findings.find((f) => f.id === 'signIns-complianceMismatch')!;
    expect(hint.severity).toBe('unknown');
    expect(hint.evidence).toMatchObject({
      deviceDetailIsCompliant: false,
      intuneComplianceState: 'compliant',
    });
    expect(hint.docsUrl).toBe(Docs.conditionalAccessTroubleshoot);
  });

  it('kein Widerspruchshinweis, wenn Intune das Gerät ebenfalls nicht als konform meldet', async () => {
    const data = signInsInfo([signInEntry(NOW, 1, { hours: 1 }, { deviceIsCompliant: false })]);
    const tile = evaluateSignIns(await withSignIns(data, { complianceState: 'noncompliant' }), NOW);
    expect(tile.findings.some((f) => f.id === 'signIns-complianceMismatch')).toBe(false);
  });

  it('keine Anmeldungen des Geräts → neutral mit Hinweis auf die Grenzen der Datenquelle', async () => {
    const tile = evaluateSignIns(await snapshotOf('CONTOSO-PC033'), NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(t.valueNone);
    const hint = tile.findings.find((f) => f.id === 'signIns-none')!;
    expect(hint.severity).toBe('unknown');
    expect(hint.cause).toContain('interaktive');
    expect(hint.cause).toContain('registrierte Geräte');
    expect(hint.docsUrl).toBe(Docs.signInList);
  });

  it('weitere Seiten nicht gelesen → steht im Hinweis und in den Fakten', async () => {
    const data = signInsInfo([], { totalForUser: 200, moreAvailable: true });
    const tile = evaluateSignIns(await withSignIns(data), NOW);
    expect(tile.findings.find((f) => f.id === 'signIns-none')?.detail).toContain(
      'weitere Seiten wurden nicht gelesen',
    );
    expect(tile.facts.find((f) => f.label === t.facts.userCount)?.value).toBe(
      t.facts.userCountMore(200),
    );
  });

  it('403 → „Fehlende Berechtigung“ mit Scope AuditLog.Read.All (CONTOSO-PC050)', async () => {
    const tile = evaluateSignIns(await snapshotOf('CONTOSO-PC050'), NOW);
    expect(tile.availability).toBe('forbidden');
    expect(tile.severity).toBe('unknown');
    expect(tile.findings[0]?.id).toBe('signIns-forbidden');
    expect(tile.findings[0]?.cause).toContain('AuditLog.Read.All');
  });

  it('notApplicable / unavailable / error werden als Kachelzustand ausgewiesen', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const cases: Array<[SectionResult<SignInsInfo>, string]> = [
      [{ status: 'notApplicable', reason: 'x', source: SOURCE }, 'notApplicable'],
      [{ status: 'unavailable', reason: 'x', source: SOURCE }, 'unavailable'],
      [
        {
          status: 'error',
          error: { code: 'network', message: 'x' },
          source: SOURCE,
        },
        'error',
      ],
    ];
    for (const [signIns, availability] of cases) {
      const tile = evaluateSignIns({ ...base, signIns }, NOW);
      expect(tile.availability).toBe(availability);
      expect(tile.severity).toBe('unknown');
    }
  });
});
