import { describe, expect, it } from 'vitest';
import type { FleetDevice } from '../domain/fleetDevices';
import {
  compareOsVersions,
  EMPTY_FLEET_FILTER,
  evaluateFleet,
  filterFleetRows,
  FLEET_ISSUES,
  fleetIssuesOf,
  isFleetIssue,
} from './fleetDevices';

const NOW = new Date('2026-11-25T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

function device(name: string, extra: Partial<FleetDevice> = {}): FleetDevice {
  return {
    id: `id-${name}`,
    deviceName: name,
    userPrincipalName: `${name.toLowerCase()}@contoso.com`,
    userDisplayName: `Benutzer ${name}`,
    operatingSystem: 'Windows',
    osVersion: '10.0.22631.4460',
    model: 'Contoso Book 5',
    manufacturer: 'Contoso',
    serialNumber: `SN-${name}`,
    complianceState: 'compliant',
    lastSyncDateTime: daysAgo(1),
    enrolledDateTime: daysAgo(200),
    isEncrypted: true,
    jailBroken: 'False',
    ...extra,
  };
}

describe('fleetIssuesOf', () => {
  it('meldet nichts für ein unauffälliges Gerät', () => {
    expect(fleetIssuesOf(device('PC001'), NOW)).toEqual([]);
  });

  it('bewertet Compliance wie die Geräteansicht', () => {
    for (const state of ['noncompliant', 'error', 'conflict'] as const) {
      expect(fleetIssuesOf(device('PC', { complianceState: state }), NOW)).toEqual([
        'nonCompliant',
      ]);
    }
    expect(fleetIssuesOf(device('PC', { complianceState: 'inGracePeriod' }), NOW)).toEqual([
      'gracePeriod',
    ]);
    for (const state of ['unknown', 'configManager'] as const) {
      expect(fleetIssuesOf(device('PC', { complianceState: state }), NOW)).toEqual([]);
    }
  });

  it('nur ausdrücklich „nicht verschlüsselt“ und „True“ sind Auffälligkeiten', () => {
    expect(fleetIssuesOf(device('PC', { isEncrypted: false }), NOW)).toEqual(['notEncrypted']);
    expect(fleetIssuesOf(device('PC', { isEncrypted: null }), NOW)).toEqual([]);
    expect(fleetIssuesOf(device('IP', { jailBroken: 'True' }), NOW)).toEqual(['jailbroken']);
    expect(fleetIssuesOf(device('IP', { jailBroken: 'Unknown' }), NOW)).toEqual([]);
    expect(fleetIssuesOf(device('IP', { jailBroken: null }), NOW)).toEqual([]);
  });

  it('nutzt die Check-in-Schwellen 7 und 30 Tage; ohne Zeitpunkt keine Aussage', () => {
    expect(fleetIssuesOf(device('PC', { lastSyncDateTime: daysAgo(7) }), NOW)).toEqual([]);
    expect(fleetIssuesOf(device('PC', { lastSyncDateTime: daysAgo(8) }), NOW)).toEqual([
      'checkInLate',
    ]);
    expect(fleetIssuesOf(device('PC', { lastSyncDateTime: daysAgo(30) }), NOW)).toEqual([
      'checkInLate',
    ]);
    expect(fleetIssuesOf(device('PC', { lastSyncDateTime: daysAgo(31) }), NOW)).toEqual([
      'checkInOverdue',
    ]);
    expect(fleetIssuesOf(device('PC', { lastSyncDateTime: null }), NOW)).toEqual([]);
  });

  it('liefert mehrere Auffälligkeiten in fester Reihenfolge', () => {
    const issues = fleetIssuesOf(
      device('PC', {
        lastSyncDateTime: daysAgo(90),
        isEncrypted: false,
        complianceState: 'noncompliant',
      }),
      NOW,
    );
    expect(issues).toEqual(['nonCompliant', 'notEncrypted', 'checkInOverdue']);
  });
});

describe('evaluateFleet', () => {
  const info = {
    devices: [
      device('PC003'),
      device('PC010', { complianceState: 'inGracePeriod' }),
      device('PC002', { isEncrypted: false }),
      device('PC001', { isEncrypted: false, complianceState: 'noncompliant' }),
      device('MB001', { operatingSystem: 'macOS', osVersion: '15.1' }),
      device('MB002', { operatingSystem: 'macOS', osVersion: '14.7.1' }),
      device('MB003', { operatingSystem: 'macOS', osVersion: null }),
      device('IP001', { operatingSystem: 'iOS', osVersion: '18.1', jailBroken: 'True' }),
    ],
    truncated: true,
    pagesRead: 10,
  };
  const overview = evaluateFleet(info, NOW);

  it('zählt Geräte, Auffällige und Schweregrade', () => {
    expect(overview.total).toBe(8);
    expect(overview.withIssues).toBe(4);
    expect(overview.critical).toBe(3);
    expect(overview.warning).toBe(1);
    expect(overview.truncated).toBe(true);
  });

  it('sortiert kritisch vor Warnung vor unauffällig, dann nach Anzahl und Name', () => {
    expect(overview.rows.map((row) => row.device.deviceName)).toEqual([
      'PC001',
      'IP001',
      'PC002',
      'PC010',
      'MB001',
      'MB002',
      'MB003',
      'PC003',
    ]);
    expect(overview.rows[0]?.severity).toBe('critical');
    expect(overview.rows[3]?.severity).toBe('warning');
    expect(overview.rows[4]?.severity).toBe('ok');
    expect(overview.rows[0]?.daysSinceCheckIn).toBe(1);
  });

  it('führt jede Auffälligkeit, auch ohne Treffer', () => {
    expect(overview.groups.map((group) => group.issue)).toEqual([...FLEET_ISSUES]);
    const count = (issue: string) => overview.groups.find((g) => g.issue === issue)?.count;
    expect(count('nonCompliant')).toBe(1);
    expect(count('notEncrypted')).toBe(2);
    expect(count('jailbroken')).toBe(1);
    expect(count('gracePeriod')).toBe(1);
    expect(count('checkInOverdue')).toBe(0);
  });

  it('zählt je Plattform und verteilt die Versionen, neueste zuerst, ohne Version am Ende', () => {
    expect(overview.platforms).toEqual([
      { platform: 'windows', count: 4, withIssues: 3 },
      { platform: 'macos', count: 3, withIssues: 0 },
      { platform: 'ios', count: 1, withIssues: 1 },
    ]);
    const mac = overview.osVersions.find((entry) => entry.platform === 'macos');
    expect(mac?.versions).toEqual([
      { version: '15.1', count: 1 },
      { version: '14.7.1', count: 1 },
      { version: null, count: 1 },
    ]);
    expect(overview.osVersions.find((entry) => entry.platform === 'windows')?.versions).toEqual([
      { version: '10.0.22631.4460', count: 4 },
    ]);
  });

  it('kommt mit einer leeren Liste zurecht', () => {
    const empty = evaluateFleet({ devices: [], truncated: false, pagesRead: 1 }, NOW);
    expect(empty.total).toBe(0);
    expect(empty.rows).toEqual([]);
    expect(empty.platforms).toEqual([]);
    expect(empty.groups.every((group) => group.count === 0)).toBe(true);
  });

  describe('filterFleetRows', () => {
    const names = (filter: Parameters<typeof filterFleetRows>[1]) =>
      filterFleetRows(overview.rows, filter).map((row) => row.device.deviceName);

    it('ohne Filter bleiben alle Zeilen in ihrer Reihenfolge', () => {
      expect(names(EMPTY_FLEET_FILTER)).toHaveLength(8);
    });
    it('filtert nach Auffälligkeit, „irgendeine“ und Plattform', () => {
      expect(names({ ...EMPTY_FLEET_FILTER, issue: 'notEncrypted' })).toEqual(['PC001', 'PC002']);
      expect(names({ ...EMPTY_FLEET_FILTER, issue: 'any' })).toEqual([
        'PC001',
        'IP001',
        'PC002',
        'PC010',
      ]);
      expect(names({ ...EMPTY_FLEET_FILTER, platform: 'macos' })).toEqual([
        'MB001',
        'MB002',
        'MB003',
      ]);
      expect(names({ issue: 'any', platform: 'ios', query: '' })).toEqual(['IP001']);
    });
    it('sucht ohne Groß-/Kleinschreibung in Name, Benutzer, Seriennummer und Version', () => {
      expect(names({ ...EMPTY_FLEET_FILTER, query: ' pc00 ' })).toEqual([
        'PC001',
        'PC002',
        'PC003',
      ]);
      expect(names({ ...EMPTY_FLEET_FILTER, query: 'mb002@CONTOSO' })).toEqual(['MB002']);
      expect(names({ ...EMPTY_FLEET_FILTER, query: 'sn-ip001' })).toEqual(['IP001']);
      expect(names({ ...EMPTY_FLEET_FILTER, query: '14.7' })).toEqual(['MB002']);
      expect(names({ ...EMPTY_FLEET_FILTER, query: 'gibt-es-nicht' })).toEqual([]);
    });
  });
});

describe('compareOsVersions', () => {
  it('vergleicht Zahlenfolgen numerisch', () => {
    expect(compareOsVersions('10.0.22631.4460', '10.0.19045.5131')).toBeGreaterThan(0);
    expect(compareOsVersions('14.7.1', '15.1')).toBeLessThan(0);
    expect(compareOsVersions('15.1', '15.1')).toBe(0);
    expect(compareOsVersions('9', '10')).toBeLessThan(0);
  });
});

describe('isFleetIssue', () => {
  it('erkennt nur bekannte Werte', () => {
    expect(isFleetIssue('notEncrypted')).toBe(true);
    expect(isFleetIssue('any')).toBe(false);
    expect(isFleetIssue(null)).toBe(false);
  });
});
