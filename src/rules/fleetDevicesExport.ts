/**
 * CSV-Export der Geräteliste der Ansicht „Flotte“ (M22) – reine Funktion über die (ggf. maskierten,
 * gefilterten) Zeilen, genau das, was angezeigt wird. Format wie der Export der Empfehlungen:
 * `;`, UTF-8 mit BOM, CRLF, Injektionsschutz über `csvField`.
 */
import { de } from '../i18n/de';
import type { FleetRow } from './fleetDevices';
import { csvField } from './posture/export';

const t = de.fleetDevices;
const BOM = '﻿';
const SEPARATOR = ';';
const EOL = '\r\n';

function encryptionText(value: boolean | null): string {
  if (value === null) return t.list.encryption.unknown;
  return value ? t.list.encryption.yes : t.list.encryption.no;
}

export function fleetDevicesCsv(rows: readonly FleetRow[]): string {
  const c = t.export.columns;
  const lines: string[][] = [
    [
      c.device,
      c.user,
      c.upn,
      c.platform,
      c.osVersion,
      c.model,
      c.serial,
      c.compliance,
      c.encryption,
      c.lastCheckIn,
      c.daysSinceCheckIn,
      c.issues,
    ],
  ];
  for (const { device, platform, issues, daysSinceCheckIn } of rows) {
    lines.push([
      device.deviceName,
      device.userDisplayName ?? '',
      device.userPrincipalName ?? '',
      t.platform.names[platform],
      device.osVersion ?? '',
      device.model ?? '',
      device.serialNumber ?? '',
      de.picker.compliance[device.complianceState],
      encryptionText(device.isEncrypted),
      device.lastSyncDateTime ?? '',
      daysSinceCheckIn === null ? '' : String(daysSinceCheckIn),
      issues.map((issue) => t.issues.names[issue]).join(', '),
    ]);
  }
  return BOM + lines.map((line) => line.map(csvField).join(SEPARATOR)).join(EOL) + EOL;
}

/** `mdm-doctor-flotte-<JJJJ-MM-TT>.csv` – ohne Mandanten- oder Personendaten. */
export function fleetExportFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `mdm-doctor-flotte-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`;
}
