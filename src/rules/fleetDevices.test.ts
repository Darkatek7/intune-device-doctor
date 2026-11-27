import { describe, expect, it } from 'vitest';
import type { FleetDevice } from '../domain/fleetDevices';
import {
  compareOsVersions,
  EMPTY_FLEET_FILTER,
  evaluateFleet,
  filterFleetRows,
  FLEET_ISSUES,
  fleetFacets,
  fleetIssuesOf,
  fleetManagementOf,
  isFleetIssue,
  isFleetManagement,
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
    managementAgent: 'mdm',
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
      expect(names({ ...EMPTY_FLEET_FILTER, issue: 'any', platform: 'ios' })).toEqual(['IP001']);
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

describe('fleetManagementOf', () => {
  it('ordnet die dokumentierten Werte von managementAgent den Gruppen zu', () => {
    expect(fleetManagementOf('mdm')).toBe('intune');
    expect(fleetManagementOf('easMdm')).toBe('intune');
    expect(fleetManagementOf('intuneClient')).toBe('intune');
    expect(fleetManagementOf('microsoft365ManagedMdm')).toBe('intune');
    expect(fleetManagementOf('intuneAosp')).toBe('intune');
    expect(fleetManagementOf('googleCloudDevicePolicyController')).toBe('intune');
    expect(fleetManagementOf('configurationManagerClientMdm')).toBe('coManaged');
    expect(fleetManagementOf('configurationManagerClientMdmEas')).toBe('coManaged');
    expect(fleetManagementOf('configurationManagerClient')).toBe('configMgr');
    expect(fleetManagementOf('msSense')).toBe('mde');
    expect(fleetManagementOf('eas')).toBe('eas');
    expect(fleetManagementOf('jamf')).toBe('jamf');
  });
  it('rät nicht: unbekannte, künftige und fehlende Werte landen unter „Sonstige“', () => {
    expect(fleetManagementOf('unknown')).toBe('other');
    expect(fleetManagementOf('google')).toBe('other');
    expect(fleetManagementOf('unknownFutureValue')).toBe('other');
    expect(fleetManagementOf('MsSense')).toBe('other');
    expect(fleetManagementOf('toString')).toBe('other');
    expect(fleetManagementOf('')).toBe('other');
    expect(fleetManagementOf(null)).toBe('other');
  });
  it('isFleetManagement erkennt nur die Gruppennamen', () => {
    expect(isFleetManagement('mde')).toBe(true);
    expect(isFleetManagement('msSense')).toBe(false);
    expect(isFleetManagement(null)).toBe(false);
  });
});

describe('Verwaltet von: Zählung, Filter und Zahlen zur Auswahl', () => {
  const overview = evaluateFleet(
    {
      devices: [
        device('PC001', { complianceState: 'noncompliant' }),
        device('PC002'),
        device('PC003', { managementAgent: 'configurationManagerClientMdm' }),
        device('SRV001', {
          managementAgent: 'msSense',
          complianceState: 'unknown',
          isEncrypted: false,
        }),
        device('SRV002', { managementAgent: 'msSense', complianceState: 'unknown' }),
        device('MB001', { operatingSystem: 'macOS', osVersion: '15.1', isEncrypted: false }),
        device('AND001', {
          operatingSystem: 'Android',
          osVersion: '15',
          managementAgent: 'googleCloudDevicePolicyController',
        }),
        device('X001', { managementAgent: 'somethingNew' }),
        device('X002', { managementAgent: null }),
      ],
      truncated: false,
      pagesRead: 1,
    },
    NOW,
  );
  const names = (rows: ReturnType<typeof filterFleetRows>) =>
    rows.map((row) => row.device.deviceName).sort();

  it('zählt je Gruppe und lässt Gruppen ohne Geräte weg', () => {
    expect(overview.managements).toEqual([
      { management: 'intune', count: 4 },
      { management: 'coManaged', count: 1 },
      { management: 'mde', count: 2 },
      { management: 'other', count: 2 },
    ]);
    expect(overview.rows.find((row) => row.device.deviceName === 'SRV001')?.management).toBe('mde');
  });

  it('filtert auf eine oder mehrere Gruppen; leer = alle', () => {
    expect(filterFleetRows(overview.rows, EMPTY_FLEET_FILTER)).toHaveLength(9);
    expect(
      names(filterFleetRows(overview.rows, { ...EMPTY_FLEET_FILTER, managements: ['mde'] })),
    ).toEqual(['SRV001', 'SRV002']);
    expect(
      names(
        filterFleetRows(overview.rows, { ...EMPTY_FLEET_FILTER, managements: ['intune', 'mde'] }),
      ),
    ).toEqual(['AND001', 'MB001', 'PC001', 'PC002', 'SRV001', 'SRV002']);
    expect(
      names(
        filterFleetRows(overview.rows, {
          ...EMPTY_FLEET_FILTER,
          managements: ['intune'],
          issue: 'notEncrypted',
        }),
      ),
    ).toEqual(['MB001']);
  });

  it('ohne Filter entsprechen die Zahlen der ganzen Flotte', () => {
    const facets = fleetFacets(overview.rows, EMPTY_FLEET_FILTER);
    expect(facets.rows).toHaveLength(9);
    expect(facets.counts.total).toBe(overview.total);
    expect(facets.counts.withIssues).toBe(overview.withIssues);
    expect(facets.issues.notEncrypted).toBe(2);
    expect(facets.platforms.windows).toBe(7);
    expect(facets.managements).toMatchObject({
      intune: 4,
      coManaged: 1,
      mde: 2,
      other: 2,
      jamf: 0,
    });
  });

  it('Gesamtbild und Versionen zählen genau die gefilterten Zeilen', () => {
    const facets = fleetFacets(overview.rows, { ...EMPTY_FLEET_FILTER, managements: ['intune'] });
    expect(facets.counts.total).toBe(4);
    expect(facets.counts.withIssues).toBe(2);
    expect(facets.counts.critical).toBe(2);
    expect(facets.counts.osVersions.map((entry) => [entry.platform, entry.total])).toEqual([
      ['windows', 2],
      ['macos', 1],
      ['android', 1],
    ]);
  });

  it('jede Filterleiste zählt mit den anderen Filtern, nicht mit dem eigenen', () => {
    const facets = fleetFacets(overview.rows, {
      ...EMPTY_FLEET_FILTER,
      issue: 'notEncrypted',
      managements: ['intune'],
    });
    // Liste: nur das unverschlüsselte Intune-Gerät
    expect(names(facets.rows)).toEqual(['MB001']);
    // Auffälligkeiten: innerhalb von Intune, ohne den Auffälligkeiten-Filter
    expect(facets.issues).toMatchObject({ notEncrypted: 1, nonCompliant: 1 });
    // Verwaltet von: innerhalb von „nicht verschlüsselt“, ohne den eigenen Filter
    expect(facets.managements).toMatchObject({ intune: 1, mde: 1, coManaged: 0 });
    // Plattformen: mit beiden anderen Filtern
    expect(facets.platforms).toMatchObject({ macos: 1, windows: 0, android: 0 });
  });

  it('die Suche wirkt auf alle Zahlen', () => {
    const facets = fleetFacets(overview.rows, { ...EMPTY_FLEET_FILTER, query: 'srv' });
    expect(facets.counts.total).toBe(2);
    expect(facets.managements).toMatchObject({ mde: 2, intune: 0 });
    expect(facets.issues.notEncrypted).toBe(1);
  });
});
