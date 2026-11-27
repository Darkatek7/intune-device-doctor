/**
 * Demo-Flotte der Ansicht „Flotte“ (M22/S2): deterministisch erzeugte Geräte, die zu den zehn
 * Szenario-Geräten dazukommen. Kein Zufall; das Datum kommt ausschließlich aus `now`.
 *
 * Zählung: Zusammen mit den Szenario-Geräten ergeben die Zustände genau die Zähler aus
 * `defaultComplianceSummary()` (fleet.ts): 212 konform, 31 nicht konform, 6 Karenzzeit, 2 Fehler,
 * 1 Konflikt, 9 unbekannt, 4 nicht anwendbar. `ComplianceState` (graph/dto.ts) kennt aber kein
 * `notApplicable`; die Liste bildet es auf den nächstliegenden Wert `unknown` ab. Die Liste zählt
 * deshalb 13 `unknown` (9 + 4). `remediated` und `configManager` sind in der Zählung 0 und entfallen.
 *
 * Auffälligkeiten (Maßstäbe wie in rules/fleetDevices.ts; Szenario-Geräte zählen mit):
 * nicht konform, nicht verschlüsselt, Jailbreak/Root (nur iOS/Android), Check-in > 30 Tage, Check-in
 * 8–30 Tage, Karenzzeit, ohne Verschlüsselungs- und Check-in-Angabe, ohne Benutzer. Kombinationen
 * liegen an einzelnen Geräten. Alle Werte fiktiv (Contoso, contoso.com, CONTOSO-…, DEMO-…).
 *
 * „Verwaltet von“: Die meisten Geräte meldet die Demo mit `managementAgent: 'mdm'`, Android mit
 * `googleCloudDevicePolicyController`. Sechs Windows-Server (`CONTOSO-SRV…`, Compliance `unknown`, ohne
 * Benutzer) sind nur über Defender for Endpoint eingebunden (`msSense`), drei Windows-Geräte sind
 * co-verwaltet (`configurationManagerClientMdm`). Die Compliance-Zählung ändert sich dadurch nicht.
 */
import type { ComplianceState, PolicyPlatformType } from '../../graph/dto';
import { de } from '../../i18n/de';
import {
  ago,
  demoGuid,
  entraDevice,
  healthyCompliancePolicies,
  healthyConfigurationPolicies,
  healthyProtection,
  inFuture,
  osVolumeKey,
  policy,
  windowsDevice,
  type DeviceBase,
} from './scenarios/helpers';
import type { MockDeviceFixture } from './types';

type Platform = 'windows' | 'macos' | 'ios' | 'android';

/** Zustände in dieser Reihenfolge belegen die lokalen Indizes einer Plattform (siehe `statesOf`). */
type StateCounts = Partial<Record<ComplianceState, number>>;

/** Lokale Indizes innerhalb einer Plattform; Überlappungen sind gewollt (Kombinationen). */
interface Flags {
  /** `isEncrypted: false` */
  notEncrypted?: readonly number[];
  /** `jailBroken: 'True'` */
  jailbroken?: readonly number[];
  /** Letzter Check-in 35–104 Tage zurück (über 30 Tage) */
  overdue?: readonly number[];
  /** Letzter Check-in 9–23 Tage zurück (8–30 Tage) */
  late?: readonly number[];
  /** `isEncrypted: null` und `lastSyncDateTime: null` (keine Aussage) */
  noInfo?: readonly number[];
  /** ohne Benutzer */
  noUser?: readonly number[];
  /** Server, nur über Defender for Endpoint eingebunden (`managementAgent: 'msSense'`), ohne Benutzer */
  mde?: readonly number[];
  /** Co-Management (`managementAgent: 'configurationManagerClientMdm'`) */
  coManaged?: readonly number[];
}

interface PlatformPlan {
  platform: Platform;
  states: StateCounts;
  flags: Flags;
}

/**
 * Zählung der Flotte: die erzeugten Geräte ergeben zusammen mit den zehn Szenarien (7 konform,
 * 2 nicht konform, 1 Karenzzeit) die Zähler aus `defaultComplianceSummary()`.
 * Windows 190, macOS 20, iOS/iPadOS 30, Android 15 = 255 erzeugte Geräte.
 */
const PLAN: readonly PlatformPlan[] = [
  {
    platform: 'windows',
    states: {
      noncompliant: 22,
      inGracePeriod: 4,
      error: 2,
      conflict: 1,
      unknown: 11,
      compliant: 150,
    },
    flags: {
      notEncrypted: [5, 24, 45, 90, 130, 170],
      overdue: [2, 26, 150],
      late: [30, 77, 133],
      noInfo: [100, 101],
      noUser: [185, 186, 187, 188, 189],
      // Indizes 29–39 sind die Geräte mit Compliance `unknown` (Intune bewertet MDE-Geräte nicht).
      mde: [29, 30, 31, 32, 33, 34],
      coManaged: [60, 61, 62],
    },
  },
  {
    platform: 'macos',
    states: { noncompliant: 3, inGracePeriod: 1, unknown: 2, compliant: 14 },
    flags: {
      notEncrypted: [2, 10],
      overdue: [0, 15],
      late: [6],
      noInfo: [12],
    },
  },
  {
    platform: 'ios',
    states: { noncompliant: 2, compliant: 28 },
    flags: {
      jailbroken: [0, 9, 14],
      overdue: [0, 1, 21],
      late: [16, 25],
      noInfo: [20],
    },
  },
  {
    platform: 'android',
    states: { noncompliant: 2, compliant: 13 },
    flags: {
      jailbroken: [1, 7],
      notEncrypted: [3],
      late: [5, 11],
      noUser: [12, 13, 14],
    },
  },
];

/** Reihenfolge, in der die Zustände den lokalen Indizes zugeordnet werden. */
const STATE_ORDER: readonly ComplianceState[] = [
  'noncompliant',
  'inGracePeriod',
  'error',
  'conflict',
  'unknown',
  'compliant',
];

/** Präfix und Startnummer der Gerätenamen (ohne Kollision mit CONTOSO-PC001 … AND21). */
const NAMING: Record<Platform, { prefix: string; first: number }> = {
  windows: { prefix: 'PC', first: 201 },
  macos: { prefix: 'MB', first: 101 },
  ios: { prefix: 'IP', first: 101 },
  android: { prefix: 'AND', first: 101 },
};

const FIRST_NAMES = [
  'Clara',
  'Tobias',
  'Nina',
  'Paul',
  'Mira',
  'Ben',
  'Hanna',
  'Elias',
  'Ida',
  'Jan',
  'Greta',
  'Leon',
  'Mia',
  'Karim',
  'Pia',
  'Oskar',
  'Yara',
  'Emil',
  'Carla',
  'Julian',
];
const LAST_NAMES = [
  'Keller',
  'Brandt',
  'Lorenz',
  'Vogt',
  'Pohl',
  'Engel',
  'Sander',
  'Krause',
  'Albrecht',
  'Hofmann',
  'Richter',
  'Maier',
  'Stark',
  'Winter',
  'Berger',
  'Schulz',
  'Jansen',
  'Kraft',
  'Seidel',
  'Hahn',
];

const GB = 1024 ** 3;

const WINDOWS_MODELS = ['Contoso Book 5', 'Contoso Book 5 Pro', 'Contoso Desk 3'];
const WINDOWS_OS = ['10.0.26200.9711', '10.0.26100.7171', '10.0.22631.4317', '10.0.19045.6456'];
const SERVER_OS = ['10.0.26100.7171', '10.0.20348.4405'];
const MAC_MODELS = ['MacBook Air 13 (M2)', 'MacBook Pro 14 (M3)', 'iMac 24 (M3)'];
const MAC_OS = ['15.6.1', '15.5', '14.7.8', '26.1'];
const IOS_MODELS = ['iPhone 15', 'iPhone 14', 'iPad (10. Gen.)'];
const IOS_OS = ['18.6.2', '18.5', '17.7.2', '26.0.1'];
const ANDROID_MODELS = ['Pixel 8', 'Pixel 7a', 'Contoso Phone 4'];
const ANDROID_OS = ['16', '15', '14', '13'];

/** Richtlinien der Nicht-Windows-Geräte (IDs fiktiv, nur für die Geräteansicht). */
const OTHER_POLICIES: Record<
  Exclude<Platform, 'windows'>,
  {
    platformType: PolicyPlatformType;
    compliance: string;
    configuration: string;
    ids: [number, number];
  }
> = {
  macos: {
    platformType: 'macOS',
    compliance: 'Contoso – macOS Compliance',
    configuration: 'Contoso – macOS WLAN',
    ids: [90, 91],
  },
  ios: {
    platformType: 'iOS',
    compliance: 'Contoso – iOS Compliance',
    configuration: 'Contoso – iOS WLAN',
    ids: [92, 93],
  },
  android: {
    platformType: 'android',
    compliance: 'Contoso – Android Compliance',
    configuration: 'Contoso – Android WLAN',
    ids: [94, 95],
  },
};

const at = <T>(list: readonly T[], i: number): T => list[i % list.length] as T;

function statesOf(counts: StateCounts): ComplianceState[] {
  return STATE_ORDER.flatMap((state) => Array.from({ length: counts[state] ?? 0 }, () => state));
}

/** Fiktiver Benutzer; 20 × 20 Kombinationen, die Zuordnung je Gerät ist eindeutig (37 teilerfremd zu 400). */
function userOf(i: number): { upn: string; displayName: string } {
  const slot = (i * 37) % (FIRST_NAMES.length * LAST_NAMES.length);
  const first = at(FIRST_NAMES, slot);
  const last = at(LAST_NAMES, Math.floor(slot / FIRST_NAMES.length));
  return {
    upn: `${first.toLowerCase()}.${last.toLowerCase()}@contoso.com`,
    displayName: `${first} ${last}`,
  };
}

function platformFields(
  platform: Platform,
  local: number,
  i: number,
  now: Date,
  jailbroken: boolean,
): Partial<DeviceBase> {
  const storage = {
    totalStorageSpaceInBytes: at([128, 256, 512], i) * GB,
    freeStorageSpaceInBytes: Math.floor(
      (at([128, 256, 512], i) * GB * (10 + ((i * 13) % 70))) / 100,
    ),
  };
  switch (platform) {
    case 'windows':
      return {
        ...storage,
        osFamily: 'windows',
        operatingSystem: 'Windows',
        osVersion: at(WINDOWS_OS, local),
        model: at(WINDOWS_MODELS, local),
        manufacturer: 'Contoso Computing',
        deviceEnrollmentType: 'windowsAzureADJoin',
        jailBroken: 'Unknown',
      };
    case 'macos':
      return {
        ...storage,
        osFamily: 'macos',
        operatingSystem: 'macOS',
        osVersion: at(MAC_OS, local),
        model: at(MAC_MODELS, local),
        manufacturer: 'Apple',
        deviceEnrollmentType: 'appleBulkWithUser',
        jailBroken: 'False',
      };
    case 'ios': {
      const isPad = local % 3 === 2;
      return {
        ...storage,
        osFamily: 'ios',
        operatingSystem: isPad ? 'iPadOS' : 'iOS',
        osVersion: at(IOS_OS, local),
        model: at(IOS_MODELS, local),
        manufacturer: 'Apple',
        deviceEnrollmentType: 'appleUserEnrollment',
        isSupervised: false,
        jailBroken: jailbroken ? 'True' : 'False',
      };
    }
    case 'android':
      return {
        ...storage,
        osFamily: 'android',
        operatingSystem: 'Android',
        osVersion: at(ANDROID_OS, local),
        model: at(ANDROID_MODELS, local),
        manufacturer: at(ANDROID_MODELS, local).startsWith('Pixel') ? 'Google' : 'Contoso Mobile',
        deviceEnrollmentType: 'unknown',
        managementAgent: 'googleCloudDevicePolicyController',
        androidSecurityPatchLevel: ago(now, { days: 20 + ((i * 11) % 260) }).slice(0, 10),
        enrollmentProfileName: 'Contoso – Android Enterprise vollständig verwaltet',
        jailBroken: jailbroken ? 'True' : 'False',
      };
  }
}

function buildFixture(
  now: Date,
  platform: Platform,
  local: number,
  i: number,
  state: ComplianceState,
  flags: Flags,
): MockDeviceFixture {
  const { prefix, first } = NAMING[platform];
  const num = first + local;
  const n = 1000 + i;
  const has = (list?: readonly number[]) => list?.includes(local) ?? false;
  const noInfo = has(flags.noInfo);
  const mde = has(flags.mde);
  const noUser = has(flags.noUser) || mde;
  const user = userOf(i);
  const jailbroken = has(flags.jailbroken);
  const isWindows = platform === 'windows';

  let lastSyncDateTime: string | null;
  if (noInfo) lastSyncDateTime = null;
  else if (has(flags.overdue)) lastSyncDateTime = ago(now, { days: 35 + (i % 70) });
  else if (has(flags.late)) lastSyncDateTime = ago(now, { days: 9 + (i % 15) });
  else lastSyncDateTime = ago(now, { hours: 1 + (i % 48) });

  const device: DeviceBase = windowsDevice(now, n, {
    ...platformFields(platform, local, i, now, jailbroken),
    ...(mde
      ? {
          managementAgent: 'msSense' as const,
          model: 'Contoso Server 2',
          osVersion: at(SERVER_OS, local),
          deviceEnrollmentType: 'unknown' as const,
        }
      : has(flags.coManaged)
        ? {
            managementAgent: 'configurationManagerClientMdm' as const,
            deviceEnrollmentType: 'windowsCoManagement' as const,
          }
        : {}),
    deviceName: mde ? `CONTOSO-SRV${String(num).padStart(3, '0')}` : `CONTOSO-${prefix}${num}`,
    serialNumber: `DEMO-${mde ? 'SRV' : prefix}${String(num).padStart(4, '0')}`,
    complianceState: state,
    complianceGracePeriodExpirationDateTime:
      state === 'inGracePeriod' ? inFuture(now, { days: 2 + (i % 3) }) : null,
    lastSyncDateTime,
    enrolledDateTime: ago(now, { days: 120 + ((i * 17) % 500) }),
    isEncrypted: noInfo ? null : !has(flags.notEncrypted),
    userId: noUser ? null : demoGuid('user', n),
    userPrincipalName: noUser ? null : user.upn,
    userDisplayName: noUser ? null : user.displayName,
    azureADDeviceId: demoGuid('entra', n),
  });

  const other = isWindows ? null : OTHER_POLICIES[platform];
  return {
    device,
    protection: isWindows
      ? { status: 'ok', data: healthyProtection(now) }
      : { status: 'notApplicable', reason: de.reasons.defenderNotWindows },
    compliancePolicies: {
      status: 'ok',
      data: other
        ? [
            policy('compliance', other.ids[0], other.compliance, {
              platformType: other.platformType,
              settingCount: 3,
            }),
          ]
        : healthyCompliancePolicies(),
    },
    configurationPolicies: {
      status: 'ok',
      data: other
        ? [
            policy('configuration', other.ids[1], other.configuration, {
              platformType: other.platformType,
              settingCount: 2,
            }),
          ]
        : healthyConfigurationPolicies(),
    },
    entraDevice: {
      status: 'ok',
      data: entraDevice(now, device, isWindows ? {} : { trustType: 'Workplace' }),
    },
    bitlockerKeys: isWindows
      ? {
          status: 'ok',
          data: device.isEncrypted ? [osVolumeKey(now, n, 150 + (i % 90))] : [],
        }
      : { status: 'notApplicable', reason: de.reasons.bitlockerNotWindows },
  };
}

/** Anzahl der erzeugten Geräte (ohne die zehn Szenarien). */
export const GENERATED_FLEET_SIZE = PLAN.reduce(
  (sum, plan) => sum + statesOf(plan.states).length,
  0,
);

/**
 * Erzeugte Demo-Geräte der Flotte. Gleiche Eingabe → gleiche Geräte (keine Zufallszahlen); `now`
 * bestimmt nur die relativen Zeitwerte. Die IDs liegen im Bereich 1000 ff. der Demo-GUIDs und
 * kollidieren nicht mit den Szenarien.
 */
export function generatedFleetFixtures(now: Date): MockDeviceFixture[] {
  const fixtures: MockDeviceFixture[] = [];
  let i = 0;
  for (const plan of PLAN) {
    statesOf(plan.states).forEach((state, local) => {
      fixtures.push(buildFixture(now, plan.platform, local, i, state, plan.flags));
      i += 1;
    });
  }
  return fixtures;
}
