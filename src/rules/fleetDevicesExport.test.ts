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

  it('schützt vor Formel-Injektion', () => {
    expect(fleetDevicesCsv(rows)).toContain(`"'=cmd|calc"`);
  });

  it('benennt die Datei nach dem Tag', () => {
    expect(fleetExportFileName(new Date(2026, 10, 5))).toBe('mdm-doctor-flotte-2026-11-05.csv');
  });
});
