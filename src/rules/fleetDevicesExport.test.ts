import { describe, expect, it } from 'vitest';
import type { FleetDevice } from '../domain/fleetDevices';
import { evaluateFleet } from './fleetDevices';
import { fleetDevicesCsv, fleetExportFileName } from './fleetDevicesExport';

const NOW = new Date('2026-11-25T12:00:00Z');

function device(overrides: Partial<FleetDevice>): FleetDevice {
  return {
    id: 'id-1',
    deviceName: 'CONTOSO-PC001',
    userPrincipalName: 'anna.beispiel@contoso.com',
    userDisplayName: 'Anna Beispiel',
    operatingSystem: 'Windows',
    osVersion: '10.0.22631.4460',
    model: 'Contoso Book 14',
    manufacturer: 'Contoso',
    serialNumber: 'CS-0001',
    complianceState: 'compliant',
    lastSyncDateTime: '2026-11-25T08:00:00Z',
    enrolledDateTime: null,
    isEncrypted: true,
    jailBroken: null,
    managementAgent: 'mdm',
    ...overrides,
  };
}

describe('fleetDevicesCsv', () => {
  const rows = evaluateFleet(
    {
      devices: [
        device({}),
        device({
          id: 'id-2',
          deviceName: '=cmd|calc',
          complianceState: 'noncompliant',
          isEncrypted: false,
          lastSyncDateTime: '2026-09-25T08:00:00Z',
          userPrincipalName: null,
          userDisplayName: null,
        }),
      ],
      truncated: false,
      pagesRead: 1,
    },
    NOW,
  ).rows;

  it('schreibt Kopfzeile, BOM, CRLF und eine Zeile je Gerät (auffällige zuerst)', () => {
    const csv = fleetDevicesCsv(rows);
    expect(csv.startsWith('﻿"Gerät";"Benutzer";"UPN"')).toBe(true);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('Nicht konform, Nicht verschlüsselt, Check-in seit über 30 Tagen');
    expect(lines[2]).toContain('"anna.beispiel@contoso.com"');
    expect(lines[2]).toContain('"Verschlüsselt"');
    expect(lines[2]).toContain('"0"');
  });

  it('nennt „Verwaltet von“ und den Rohwert von managementAgent', () => {
    const managed = evaluateFleet(
      {
        devices: [
          device({ id: 'a', deviceName: 'CONTOSO-SRV001', managementAgent: 'msSense' }),
          device({ id: 'b', deviceName: 'CONTOSO-PC002', managementAgent: 'somethingNew' }),
          device({ id: 'c', deviceName: 'CONTOSO-PC003', managementAgent: null }),
        ],
        truncated: false,
        pagesRead: 1,
      },
      NOW,
    ).rows;
    const lines = fleetDevicesCsv(managed).trimEnd().split('\r\n');
    expect(lines[0]).toContain('"Plattform";"Verwaltet von";"managementAgent (Rohwert)";"Version"');
    const line = (name: string) => lines.find((entry) => entry.includes(name))!;
    expect(line('CONTOSO-SRV001')).toContain('"Defender for Endpoint (MDE)";"msSense"');
    expect(line('CONTOSO-PC002')).toContain('"Sonstige (somethingNew)";"somethingNew"');
    expect(line('CONTOSO-PC003')).toContain('"Verwaltung nicht gemeldet";""');
  });

  it('schützt vor Formel-Injektion', () => {
    expect(fleetDevicesCsv(rows)).toContain(`"'=cmd|calc"`);
  });

  it('benennt die Datei nach dem Tag', () => {
    expect(fleetExportFileName(new Date(2026, 10, 5))).toBe('mdm-doctor-flotte-2026-11-05.csv');
  });
});
