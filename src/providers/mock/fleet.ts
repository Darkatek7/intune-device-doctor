/**
 * Demo-Daten für M20 (fiktiv, Contoso). Zeitwerte relativ zu `now`.
 *
 * S1 – Compliance-Übersicht: ein Mandant mit 265 gemeldeten Geräten, davon 31 nicht konform (≈ 11,7 % –
 * über dem eigenen Richtwert von 10 %), zwei mit Fehler, eines mit Konflikt. Die Einstellungsnamen folgen
 * dem dokumentierten Muster „Klassenname.Eigenschaft“ (`setting`) bzw. dem Eigenschaftsnamen
 * (`settingName`); die Zahlen sind erfunden.
 */
import type {
  ComplianceSettingSummariesInfo,
  ComplianceSettingSummaryInfo,
  DeviceStateSummaryInfo,
} from '../../domain/types';
import type { SettingSummaryPlatformType } from '../../graph/dto';

// ---------- S1: Compliance-Übersicht ----------

export function defaultComplianceSummary(): DeviceStateSummaryInfo {
  return {
    kind: 'compliance',
    counts: {
      compliantDeviceCount: 212,
      nonCompliantDeviceCount: 31,
      inGracePeriodCount: 6,
      errorDeviceCount: 2,
      conflictDeviceCount: 1,
      unknownDeviceCount: 9,
      notApplicableDeviceCount: 4,
      remediatedDeviceCount: 0,
      configManagerCount: 0,
    },
  };
}

export function defaultConfigurationSummary(): DeviceStateSummaryInfo {
  return {
    kind: 'configuration',
    counts: {
      compliantDeviceCount: 540,
      nonCompliantDeviceCount: 12,
      errorDeviceCount: 3,
      conflictDeviceCount: 2,
      unknownDeviceCount: 20,
      notApplicableDeviceCount: 30,
      remediatedDeviceCount: 0,
    },
  };
}

function setting(
  n: number,
  className: string,
  settingName: string,
  platform: SettingSummaryPlatformType,
  counts: { nonCompliant: number; error?: number; conflict?: number; compliant: number },
): ComplianceSettingSummaryInfo {
  return {
    id: `00000000-0000-4000-c000-${n.toString().padStart(12, '0')}`,
    name: settingName,
    setting: `${className}.${settingName}`,
    platform,
    platformRaw: platform,
    nonCompliantDeviceCount: counts.nonCompliant,
    errorDeviceCount: counts.error ?? 0,
    conflictDeviceCount: counts.conflict ?? 0,
    compliantDeviceCount: counts.compliant,
  };
}

export function defaultComplianceSettings(): ComplianceSettingSummariesInfo {
  const win = 'Windows10CompliancePolicy';
  const ios = 'IosCompliancePolicy';
  const android = 'AndroidWorkProfileCompliancePolicy';
  return {
    pagesRead: 1,
    truncated: false,
    settings: [
      setting(1, win, 'osMinimumVersion', 'windows10AndLater', {
        nonCompliant: 14,
        compliant: 160,
      }),
      setting(2, win, 'bitLockerEnabled', 'windows10AndLater', {
        nonCompliant: 9,
        error: 2,
        compliant: 165,
      }),
      setting(3, ios, 'passcodeRequired', 'iOS', { nonCompliant: 4, compliant: 38 }),
      setting(4, win, 'defenderEnabled', 'windows10AndLater', {
        nonCompliant: 3,
        conflict: 1,
        compliant: 171,
      }),
      setting(
        5,
        android,
        'securityRequireSafetyNetAttestationBasicIntegrity',
        'androidWorkProfile',
        {
          nonCompliant: 1,
          compliant: 21,
        },
      ),
      setting(6, win, 'passwordRequired', 'windows10AndLater', { nonCompliant: 0, compliant: 174 }),
    ],
  };
}
