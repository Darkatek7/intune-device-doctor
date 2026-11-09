import { describe, expect, it } from 'vitest';
import type { DiagnosticsReport } from '../diagnostics/types';
import type { DeviceSnapshot } from '../domain/types';
import { MockProvider } from '../providers/mock/MockProvider';
import { loadFullSnapshot } from '../test/snapshot';
import { buildTimeline, isProblemEvent } from './timeline';

const NOW = new Date('2026-10-15T12:00:00Z');

async function snapshotOf(name: string): Promise<DeviceSnapshot> {
  return loadFullSnapshot(new MockProvider({ latency: false, now: () => NOW }), name);
}

function report(overrides: Partial<DiagnosticsReport> = {}): DiagnosticsReport {
  return {
    fileName: 'DiagLogs-CONTOSO-PC042-20261014125356Z.zip',
    deviceNameFromFile: 'CONTOSO-PC042',
    collectedAtUtc: '2026-10-14T12:53:56.000Z',
    entryCount: 0,
    totalUncompressedBytes: 0,
    entries: [],
    collectionFailures: [],
    dsregcmd: null,
    enrollments: [],
    win32Apps: [],
    imeIssues: [],
    certificates: [],
    network: null,
    eventLogs: [],
    analysisNotes: [],
    ...overrides,
  };
}

describe('buildTimeline', () => {
  it('ist ohne Daten leer', () => {
    expect(buildTimeline({ now: NOW })).toEqual([]);
  });

  it('sortiert neueste zuerst und markiert Zukunftstermine als geplant', async () => {
    const events = buildTimeline({ snapshot: await snapshotOf('CONTOSO-PC001'), now: NOW });
    expect(events.length).toBeGreaterThan(5);
    const times = events.map((e) => new Date(e.time).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    for (const event of events) {
      expect(event.planned).toBe(new Date(event.time).getTime() > NOW.getTime());
    }
    expect(events.some((e) => e.planned)).toBe(true);
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  });

  it('enthält nur gesetzte Felder (kein Ereignis ohne Zeitpunkt)', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const snapshot: DeviceSnapshot = {
      device: {
        ...base.device,
        enrolledDateTime: null,
        lastSyncDateTime: null,
        managementCertificateExpirationDate: null,
      },
    };
    expect(buildTimeline({ snapshot, now: NOW })).toEqual([]);
  });

  it('PC033 (41 Tage ohne Check-in): Check-in ist kritisch und LAPS-Sicherung veraltet', async () => {
    const events = buildTimeline({ snapshot: await snapshotOf('CONTOSO-PC033'), now: NOW });
    expect(events.find((e) => e.kind === 'checkIn')).toMatchObject({
      severity: 'critical',
      tileId: 'checkIn',
      planned: false,
    });
    expect(events.find((e) => e.id === 'lapsBackup')?.severity).toBe('warning');
  });

  it('PC014: Conditional-Access-Fehler erscheinen als Warnung mit Fehlercode, verlinkt auf „Anmeldungen“', async () => {
    const events = buildTimeline({ snapshot: await snapshotOf('CONTOSO-PC014'), now: NOW });
    const failed = events.filter((e) => e.kind === 'signIn' && e.severity === 'warning');
    expect(failed.length).toBeGreaterThan(0);
    expect(failed[0]?.tileId).toBe('signIns');
    expect(failed[0]?.detail).toContain('53000');
    expect(failed.every(isProblemEvent)).toBe(true);
  });

  it('läuft das MDM-Zertifikat ab, wird der Ablauf geplant (Warnung) bzw. abgelaufen (kritisch) gemeldet', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const soon = new Date(NOW.getTime() + 10 * 86_400_000).toISOString();
    const past = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();
    const expiring = buildTimeline({
      snapshot: { ...base, device: { ...base.device, managementCertificateExpirationDate: soon } },
      now: NOW,
    }).find((e) => e.id === 'mdmCert');
    expect(expiring).toMatchObject({ severity: 'warning', planned: true });
    const expired = buildTimeline({
      snapshot: { ...base, device: { ...base.device, managementCertificateExpirationDate: past } },
      now: NOW,
    }).find((e) => e.id === 'mdmCert');
    expect(expired).toMatchObject({ severity: 'critical', planned: false });
  });

  it('Schonfrist (PC042): Ende der Schonfrist verweist auf die Compliance-Kachel', async () => {
    const events = buildTimeline({ snapshot: await snapshotOf('CONTOSO-PC042'), now: NOW });
    expect(events.find((e) => e.id === 'graceEnd')).toMatchObject({
      kind: 'compliance',
      tileId: 'compliance',
      severity: 'warning',
    });
  });

  it('nicht ladbare Sections (forbidden) liefern keine Ereignisse', async () => {
    const events = buildTimeline({ snapshot: await snapshotOf('CONTOSO-PC050'), now: NOW });
    expect(events.some((e) => e.kind === 'signIn')).toBe(false);
  });

  it('ZIP: Sammelzeitpunkt, MDM-Ereignisse (gruppiert), IME-Meldungen und Zertifikatsabläufe', () => {
    const events = buildTimeline({
      now: NOW,
      diagnostics: report({
        eventLogs: [
          {
            id: 'mdmAdmin',
            entryName: 'x',
            entryPath: 'x',
            sizeBytes: 1,
            status: 'ok',
            windowStartUtc: null,
            windowEndUtc: null,
            scanned: 3,
            counts: { critical: 0, error: 2, warning: 1 },
            events: [
              {
                recordId: 1,
                eventId: 76,
                level: 2,
                timeUtc: '2026-10-10T08:00:00.000Z',
                provider: null,
                data: {},
              },
              {
                recordId: 2,
                eventId: 76,
                level: 2,
                timeUtc: '2026-10-12T08:00:00.000Z',
                provider: null,
                data: {},
              },
              {
                recordId: 3,
                eventId: 9999,
                level: 3,
                timeUtc: '2026-10-11T08:00:00.000Z',
                provider: null,
                data: {},
              },
            ],
            incomplete: false,
            skippedRecords: 0,
            capped: false,
          },
        ],
        imeIssues: [
          {
            file: 'a.log',
            message: 'Fehler C:\\Users\\max\\x',
            component: 'IME',
            type: 3,
            timestamp: '2026-10-13T10:00:00.000',
            thread: 1,
          },
          {
            file: 'a.log',
            message: 'Warnung',
            component: 'IME',
            type: 2,
            timestamp: '2026-10-13T11:00:00.000',
            thread: 1,
          },
        ],
        certificates: [
          {
            store: null,
            issuer: null,
            subjectMasked: 'CN=ab…',
            serialMasked: null,
            notBefore: null,
            notAfter: '2026-10-01T00:00:00.000Z',
            notAfterRaw: null,
          },
          {
            store: null,
            issuer: null,
            subjectMasked: 'CN=far',
            serialMasked: null,
            notBefore: null,
            notAfter: '2035-01-01T00:00:00.000Z',
            notAfterRaw: null,
          },
        ],
      }),
    });

    expect(events.find((e) => e.id === 'zipCollected')?.tileId).toBe('diagCollection');
    const ev76 = events.find((e) => e.id === 'mdmEvent-mdmAdmin-76');
    expect(ev76).toMatchObject({
      severity: 'warning',
      time: '2026-10-12T08:00:00.000Z',
      tileId: 'mdmEvents',
    });
    expect(ev76?.detail).toContain('2×');
    expect(events.find((e) => e.id === 'mdmEvent-mdmAdmin-9999')?.severity).toBe('unknown');
    // IME Typ 3 nur als Hinweis, Typ 2 als Warnung; Benutzername im Pfad maskiert
    const ime = events.filter((e) => e.kind === 'imeLog');
    expect(ime.map((e) => e.severity).sort()).toEqual(['unknown', 'warning']);
    expect(ime.some((e) => e.title.includes('max'))).toBe(false);
    // nur das abgelaufene Zertifikat, nicht das erst 2035 ablaufende
    const certs = events.filter((e) => e.kind === 'certificate');
    expect(certs).toHaveLength(1);
    expect(certs[0]).toMatchObject({ severity: 'unknown', tileId: 'certsNetwork' });
  });
});
