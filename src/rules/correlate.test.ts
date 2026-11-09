import { describe, expect, it } from 'vitest';
import type { Finding, Tile, TileId } from '../domain/types';
import { MockProvider } from '../providers/mock/MockProvider';
import { loadFullSnapshot } from '../test/snapshot';
import { makeFinding, makeTile } from '../test/fixtures';
import { correlate, MAX_INSIGHTS } from './correlate';
import { evaluateTiles } from './evaluate';

const NOW = new Date('2026-10-15T12:00:00Z');
const LEARN = /^https:\/\/learn\.microsoft\.com\//;

const tile = (id: TileId, findings: Finding[], overrides: Partial<Tile> = {}): Tile =>
  makeTile({
    id,
    findings,
    severity: findings.some((f) => f.severity === 'critical') ? 'critical' : 'warning',
    ...overrides,
  });
const finding = (id: string, overrides: Partial<Finding> = {}): Finding =>
  makeFinding({ id, severity: 'warning', ...overrides });

const caFailure = (errorCode = 53000): Finding =>
  finding('signIns-failure-1', { evidence: { errorCode } });

describe('correlate', () => {
  it('liefert ohne Muster nichts', () => {
    expect(correlate([])).toEqual([]);
    expect(correlate([tile('signIns', [caFailure()])])).toEqual([]);
  });

  it('PRT-/Entra-Join-Problem (ZIP) + CA-Fehler → zuerst Entra-Join/PRT', () => {
    const insights = correlate([
      tile('entraJoin', [finding('entraJoin-prt', { severity: 'critical', title: 'Kein PRT' })]),
      tile('signIns', [caFailure(53003)]),
    ]);
    expect(insights.map((i) => i.id)).toEqual(['prtMissing']);
    expect(insights[0]?.relatedTiles).toEqual(['entraJoin', 'signIns']);
    expect(insights[0]?.why).toContain('Kein PRT');
  });

  it('nicht konform + AADSTS53000 → Compliance zuerst; kein Treffer bei anderem Fehlercode', () => {
    const compliance = tile('compliance', [
      finding('compliance-state-noncompliant', { severity: 'critical' }),
    ]);
    expect(correlate([compliance, tile('signIns', [caFailure(53000)])]).map((i) => i.id)).toEqual([
      'complianceBlocked',
    ]);
    expect(correlate([compliance, tile('signIns', [caFailure(53003)])])).toEqual([]);
  });

  it('in der Schonfrist keine Compliance-Insight (Zugriff bleibt laut Microsoft erhalten)', () => {
    const compliance = tile('compliance', [finding('compliance-state-inGracePeriod')]);
    expect(correlate([compliance, tile('signIns', [caFailure(53000)])])).toEqual([]);
  });

  it('alter Check-in + Befunde bei Richtlinien/Apps → Befunde evtl. veraltet', () => {
    const insights = correlate([
      tile('checkIn', [finding('checkIn-stale', { severity: 'critical', title: 'vor 41 Tagen' })]),
      tile('policies', [finding('policies-x')]),
      tile('apps', [finding('apps-x')]),
      tile('bitlocker', [finding('bitlocker-x')]),
    ]);
    expect(insights).toHaveLength(1);
    expect(insights[0]).toMatchObject({ id: 'staleCheckIn' });
    expect(insights[0]?.relatedTiles).toEqual(['checkIn', 'policies', 'apps']);
  });

  it('Check-in alt, aber alle anderen Kacheln gesund → keine Insight', () => {
    expect(
      correlate([
        tile('checkIn', [finding('checkIn-delayed')]),
        tile('policies', [], { severity: 'ok' }),
      ]),
    ).toEqual([]);
  });

  it('Entra-Gerät deaktiviert + CA-Fehler → deaktiviertes Gerät als Ursache', () => {
    const insights = correlate([
      tile('deviceStatus', [finding('deviceStatus-disabled', { severity: 'critical' })]),
      tile('signIns', [caFailure(50155)]),
    ]);
    expect(insights.map((i) => i.id)).toEqual(['deviceDisabled']);
  });

  it('MDM-Ereignis 76 (ZIP) + Enrollment-Befund → automatische Registrierung prüfen', () => {
    const insights = correlate([
      tile('mdmEvents', [finding('mdmEvents-mdmAdmin-76')]),
      tile('enrollment', [finding('enrollment-missing', { severity: 'critical' })]),
    ]);
    expect(insights.map((i) => i.id)).toEqual(['autoEnrollment']);
    expect(correlate([tile('mdmEvents', [finding('mdmEvents-mdmAdmin-76')])])).toEqual([]);
  });

  it('keine Schlüsse aus forbidden/error/unavailable-Bereichen oder ladenden Kacheln', () => {
    const compliance = tile('compliance', [finding('compliance-state-noncompliant')]);
    for (const availability of ['forbidden', 'error', 'unavailable', 'notApplicable'] as const) {
      expect(
        correlate([compliance, tile('signIns', [caFailure()], { availability })]),
        availability,
      ).toEqual([]);
      expect(
        correlate([
          tile('compliance', compliance.findings, { availability }),
          tile('signIns', [caFailure()]),
        ]),
        availability,
      ).toEqual([]);
    }
    expect(correlate([compliance, tile('signIns', [caFailure()], { state: 'loading' })])).toEqual(
      [],
    );
  });

  it('höchstens drei Insights, nach Priorität (Ursache vor Folge)', () => {
    const insights = correlate([
      tile('deviceStatus', [finding('deviceStatus-disabled')]),
      tile('entraJoin', [finding('entraJoin-prt')]),
      tile('compliance', [finding('compliance-state-noncompliant')]),
      tile('mdmEvents', [finding('mdmEvents-mdmAdmin-76')]),
      tile('enrollment', [finding('enrollment-missing')]),
      tile('signIns', [caFailure(53000)]),
    ]);
    expect(insights).toHaveLength(MAX_INSIGHTS);
    expect(insights.map((i) => i.id)).toEqual(['deviceDisabled', 'prtMissing', 'autoEnrollment']);
  });

  it('jede Insight hat Titel, Erklärung, Schritte, Kacheln und eine Microsoft-Learn-Quelle', () => {
    const patterns: Tile[][] = [
      [tile('deviceStatus', [finding('deviceStatus-disabled')]), tile('signIns', [caFailure()])],
      [tile('entraJoin', [finding('entraJoin-prt')]), tile('signIns', [caFailure()])],
      [
        tile('mdmEvents', [finding('mdmEvents-mdmAdmin-76')]),
        tile('enrollment', [finding('enrollment-missing')]),
      ],
      [tile('checkIn', [finding('checkIn-stale')]), tile('policies', [finding('p')])],
      [
        tile('compliance', [finding('compliance-state-noncompliant')]),
        tile('signIns', [caFailure(53000)]),
      ],
    ];
    const ids = patterns.map((tiles) => {
      const [insight] = correlate(tiles);
      expect(insight).toBeDefined();
      expect(insight!.title).not.toBe('');
      expect(insight!.explanation).not.toBe('');
      expect(insight!.steps.length).toBeGreaterThan(0);
      expect(insight!.relatedTiles.length).toBeGreaterThan(1);
      expect(insight!.docsUrl).toMatch(LEARN);
      return insight!.id;
    });
    expect(new Set(ids).size).toBe(5);
  });

  describe('mit Demo-Szenarien', () => {
    async function insightsOf(name: string) {
      const snapshot = await loadFullSnapshot(
        new MockProvider({ latency: false, now: () => NOW }),
        name,
      );
      return correlate(evaluateTiles(snapshot, NOW));
    }

    it('PC014 (nicht konform, CA 53000) → Compliance zuerst', async () => {
      expect((await insightsOf('CONTOSO-PC014')).map((i) => i.id)).toContain('complianceBlocked');
    });

    it('PC042 (nur Schonfrist, CA 53000) → keine Compliance-Insight', async () => {
      expect((await insightsOf('CONTOSO-PC042')).map((i) => i.id)).not.toContain(
        'complianceBlocked',
      );
    });

    it('PC033 (41 Tage ohne Check-in) → Befunde evtl. veraltet', async () => {
      expect((await insightsOf('CONTOSO-PC033')).map((i) => i.id)).toContain('staleCheckIn');
    });

    it('PC001 (gesund) und PC050 (forbidden) → keine Insight', async () => {
      expect(await insightsOf('CONTOSO-PC001')).toEqual([]);
      expect(await insightsOf('CONTOSO-PC050')).toEqual([]);
    });
  });
});
