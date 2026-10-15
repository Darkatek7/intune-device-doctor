import { beforeAll, describe, expect, it } from 'vitest';
import type {
  BitLockerKeyInfo,
  DataSource,
  DetectedMalware,
  DeviceSnapshot,
  EntraDeviceInfo,
  Finding,
  ManagedDeviceInfo,
  PolicySettingInfo,
  PolicyStateInfo,
  SectionResult,
  Tile,
  WindowsProtectionInfo,
} from '../../domain/types';
import { hexToSignedDecimal } from '../../domain/format';
import { de } from '../../i18n/de';
import { MockProvider } from '../../providers/mock/MockProvider';
import { Docs } from '../knowledge/docs';
import { evaluateBitLocker } from './bitlocker';
import { evaluateCheckIn } from './checkIn';
import { evaluateCompliance } from './compliance';
import { evaluateDefender } from './defender';
import { evaluateDeviceStatus } from './deviceStatus';
import { evaluateOsVersion } from './osVersion';
import { evaluatePolicies } from './policies';

const NOW = new Date('2026-10-15T12:00:00Z');
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const GB = 1024 ** 3;

const hoursAgo = (hours: number): string => new Date(NOW.getTime() - hours * HOUR_MS).toISOString();

/** Lädt das Basis-Szenario CONTOSO-PC001 (alles gesund) vollständig. */
async function loadSnapshot(deviceName: string): Promise<DeviceSnapshot> {
  const provider = new MockProvider({ latency: false, now: () => NOW });
  const [hit] = await provider.searchDevices(deviceName);
  if (!hit) throw new Error(`Szenario ${deviceName} fehlt`);
  const device = await provider.getDevice(hit.id);
  return {
    device,
    protection: await provider.getProtectionState(device),
    compliancePolicies: await provider.getCompliancePolicyStates(device),
    configurationPolicies: await provider.getConfigurationPolicyStates(device),
    entraDevice: await provider.getEntraDevice(device),
    bitlockerKeys: await provider.getBitLockerKeys(device),
  };
}

type Ok<T> = Extract<SectionResult<T>, { status: 'ok' }>;

function okSection<T>(section: SectionResult<T> | undefined): Ok<T> {
  if (!section || section.status !== 'ok') throw new Error('Basis-Section ist nicht ok');
  return section;
}

function withDevice(s: DeviceSnapshot, overrides: Partial<ManagedDeviceInfo>): DeviceSnapshot {
  return { ...s, device: { ...s.device, ...overrides } };
}

function withProtection(
  s: DeviceSnapshot,
  overrides: Partial<WindowsProtectionInfo>,
): DeviceSnapshot {
  const section = okSection(s.protection);
  return { ...s, protection: { ...section, data: { ...section.data, ...overrides } } };
}

function withEntra(
  s: DeviceSnapshot,
  section: SectionResult<EntraDeviceInfo | null>,
): DeviceSnapshot {
  return { ...s, entraDevice: section };
}

function withEntraData(s: DeviceSnapshot, overrides: Partial<EntraDeviceInfo>): DeviceSnapshot {
  const section = okSection(s.entraDevice);
  if (!section.data) throw new Error('Basis-Entra-Objekt fehlt');
  return withEntra(s, { ...section, data: { ...section.data, ...overrides } });
}

function withKeys(s: DeviceSnapshot, section: SectionResult<BitLockerKeyInfo[]>): DeviceSnapshot {
  return { ...s, bitlockerKeys: section };
}

function withCompliance(
  s: DeviceSnapshot,
  section: SectionResult<PolicyStateInfo[]>,
): DeviceSnapshot {
  return { ...s, compliancePolicies: section };
}

function withConfiguration(
  s: DeviceSnapshot,
  section: SectionResult<PolicyStateInfo[]>,
): DeviceSnapshot {
  return { ...s, configurationPolicies: section };
}

function throttled<T>(source: DataSource): SectionResult<T> {
  return {
    status: 'error',
    source,
    error: {
      code: 'throttled',
      httpStatus: 429,
      message: 'Zu viele Anfragen',
      retryAfterSeconds: 30,
    },
  };
}

function malware(overrides: Partial<DetectedMalware>): DetectedMalware {
  return {
    id: 'test-malware-1',
    displayName: 'Trojan:Win32/Contoso-Test',
    severity: 'high',
    state: 'detected',
    threatState: 'active',
    category: 'trojan',
    initialDetectionDateTime: hoursAgo(3),
    lastStateChangeDateTime: hoursAgo(1),
    detectionCount: 1,
    additionalInformationUrl: null,
    ...overrides,
  };
}

function findingWithId(tile: Tile, id: string): Finding {
  const finding = tile.findings.find((f) => f.id === id);
  if (!finding)
    throw new Error(`Befund ${id} fehlt (vorhanden: ${tile.findings.map((f) => f.id)})`);
  return finding;
}

let base: DeviceSnapshot;

beforeAll(async () => {
  base = await loadSnapshot('CONTOSO-PC001');
});

describe('Check-in (checkIn)', () => {
  it.each([
    [23, 'ok'],
    [24, 'ok'],
    [25, 'warning'],
    [168, 'warning'],
    [169, 'critical'],
  ] as const)('%s h seit letztem Check-in → %s', (hours, severity) => {
    const tile = evaluateCheckIn(withDevice(base, { lastSyncDateTime: hoursAgo(hours) }), NOW);
    expect(tile.severity).toBe(severity);
  });

  it('7 Tage + 1 h ist critical mit Befund checkIn-stale', () => {
    const tile = evaluateCheckIn(withDevice(base, { lastSyncDateTime: hoursAgo(7 * 24 + 1) }), NOW);
    expect(findingWithId(tile, 'checkIn-stale').severity).toBe('critical');
  });

  it('kein Check-in (null) ist unknown mit Befund checkIn-never', () => {
    const tile = evaluateCheckIn(withDevice(base, { lastSyncDateTime: null }), NOW);
    expect(tile.severity).toBe('unknown');
    expect(tile.value).toBe(de.rules.checkIn.valueNever);
    expect(findingWithId(tile, 'checkIn-never').docsUrl).toBe(Docs.deviceSync);
  });

  it('ungültiges Datum wird wie kein Check-in behandelt', () => {
    const tile = evaluateCheckIn(withDevice(base, { lastSyncDateTime: 'kein-datum' }), NOW);
    expect(tile.severity).toBe('unknown');
  });
});

describe('Compliance (compliance)', () => {
  it.each([
    ['unknown', 'unknown', 'compliance-state-unknown', Docs.complianceMonitor],
    ['configManager', 'unknown', 'compliance-state-configManager', Docs.coManagement],
    ['error', 'critical', 'compliance-state-error', Docs.complianceErrorState],
    ['conflict', 'critical', 'compliance-state-conflict', Docs.complianceStateEnum],
  ] as const)('Gerätezustand %s → %s (Befund %s)', (state, severity, findingId, docsUrl) => {
    const tile = evaluateCompliance(withDevice(base, { complianceState: state }), NOW);
    expect(tile.severity).toBe(severity);
    expect(tile.value).toBe(de.rules.compliance.value[state]);
    expect(findingWithId(tile, findingId).docsUrl).toBe(docsUrl);
  });

  it('Richtlinien-Abruf mit 429 ist Befund unknown, die Severity folgt dem Gerätezustand', () => {
    const snapshot = withCompliance(base, throttled(base.device.source));
    const tile = evaluateCompliance(snapshot, NOW);
    expect(tile.availability).toBe('error');
    expect(tile.severity).toBe('ok');
    expect(findingWithId(tile, 'compliance-policies-error').title).toBe(
      de.rules.common.throttledTitle,
    );
  });

  it('fehlende Berechtigung für Richtlinien bricht die Kachel nicht', () => {
    const snapshot = withDevice(
      withCompliance(base, {
        status: 'forbidden',
        source: base.device.source,
        error: { code: 'forbidden', message: 'x' },
      }),
      { complianceState: 'noncompliant' },
    );
    const tile = evaluateCompliance(snapshot, NOW);
    expect(tile.severity).toBe('critical');
    expect(tile.availability).toBe('forbidden');
    expect(findingWithId(tile, 'compliance-policies-forbidden').severity).toBe('unknown');
  });
});

describe('BitLocker (bitlocker)', () => {
  it('isEncrypted null → unknown mit Befund bitlocker-unknown', () => {
    const tile = evaluateBitLocker(withDevice(base, { isEncrypted: null }), NOW);
    expect(tile.severity).toBe('unknown');
    expect(tile.value).toBe(de.rules.bitlocker.valueUnknown);
    expect(findingWithId(tile, 'bitlocker-unknown').severity).toBe('unknown');
  });

  it.each([
    ['keine Schlüssel', []],
    [
      'nur Wechseldatenträger-Schlüssel',
      [
        {
          id: 'k-removable',
          createdDateTime: hoursAgo(10),
          volumeType: 'removableDataVolume' as const,
        },
      ],
    ],
  ])('verschlüsselt, %s → warning (Schlüssel nicht in Entra)', (_label, keys) => {
    const snapshot = withKeys(base, {
      status: 'ok',
      source: base.device.source,
      fetchedAt: NOW.toISOString(),
      data: keys,
    });
    const tile = evaluateBitLocker(snapshot, NOW);
    expect(tile.severity).toBe('warning');
    expect(findingWithId(tile, 'bitlocker-noKey').docsUrl).toBe(Docs.viewRecoveryKeys);
  });

  it('verschlüsselt mit Betriebssystem-Schlüssel → ok ohne Befunde', () => {
    const tile = evaluateBitLocker(base, NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.findings).toEqual([]);
    expect(tile.summary).toBe(de.rules.bitlocker.summaryKeyEscrowed);
  });

  it('Schlüssel-Abruf mit 429 → availability error, Severity folgt isEncrypted', () => {
    const snapshot = withKeys(base, throttled(base.device.source));
    const tile = evaluateBitLocker(snapshot, NOW);
    expect(tile.availability).toBe('error');
    expect(tile.severity).toBe('ok');
    expect(findingWithId(tile, 'bitlocker-keys-error').title).toBe(de.rules.common.throttledTitle);
  });

  it('Windows nicht verschlüsselt → critical, Titel nennt BitLocker', () => {
    const tile = evaluateBitLocker(withDevice(base, { isEncrypted: false }), NOW);
    expect(tile.severity).toBe('critical');
    expect(findingWithId(tile, 'bitlocker-notEncrypted').title).toContain('BitLocker');
  });

  it('macOS nicht verschlüsselt → critical, Titel FileVault, FileVault-Doku', () => {
    const snapshot = withDevice(base, {
      osFamily: 'macos',
      operatingSystem: 'macOS',
      isEncrypted: false,
    });
    const tile = evaluateBitLocker(snapshot, NOW);
    expect(tile.title).toBe('FileVault');
    expect(tile.severity).toBe('critical');
    expect(findingWithId(tile, 'bitlocker-notEncrypted').docsUrl).toBe(Docs.fileVault);
  });
});

describe('Defender (defender)', () => {
  it('aktive Malware → critical mit Wert „Bedrohung aktiv“', () => {
    const tile = evaluateDefender(withProtection(base, { detectedMalware: [malware({})] }), NOW);
    expect(tile.severity).toBe('critical');
    expect(tile.value).toBe(de.rules.defender.valueThreat);
    expect(tile.findings[0]?.title).toContain('Aktive Bedrohung');
  });

  it('threatState actionFailed ist ebenfalls critical', () => {
    const tile = evaluateDefender(
      withProtection(base, { detectedMalware: [malware({ threatState: 'actionFailed' })] }),
      NOW,
    );
    expect(tile.severity).toBe('critical');
  });

  it('Echtzeitschutz aus → critical (defender-rtpOff)', () => {
    const tile = evaluateDefender(withProtection(base, { realTimeProtectionEnabled: false }), NOW);
    expect(tile.severity).toBe('critical');
    expect(findingWithId(tile, 'defender-rtpOff').severity).toBe('critical');
  });

  it('Virenschutz insgesamt aus → critical (defender-protectionOff)', () => {
    const tile = evaluateDefender(withProtection(base, { malwareProtectionEnabled: false }), NOW);
    expect(tile.severity).toBe('critical');
    expect(findingWithId(tile, 'defender-protectionOff').severity).toBe('critical');
  });

  it('Manipulationsschutz aus → warning', () => {
    const tile = evaluateDefender(withProtection(base, { tamperProtectionEnabled: false }), NOW);
    expect(tile.severity).toBe('warning');
    expect(findingWithId(tile, 'defender-tamper').docsUrl).toBe(Docs.tamperProtection);
  });

  it('deviceState critical → critical', () => {
    const tile = evaluateDefender(withProtection(base, { deviceState: 'critical' }), NOW);
    expect(tile.severity).toBe('critical');
    expect(tile.value).toBe(de.rules.defender.valueCritical);
  });

  it('productStatus serviceNotRunning → critical (defender-productStatus)', () => {
    const tile = evaluateDefender(
      withProtection(base, { productStatus: ['serviceNotRunning'] }),
      NOW,
    );
    expect(tile.severity).toBe('critical');
    expect(findingWithId(tile, 'defender-productStatus').detail).toContain(
      de.rules.defender.productStatus.serviceNotRunning,
    );
  });

  it('productStatus systemInitiatedScanInProgress ist nur informativ, keine Warnung', () => {
    const tile = evaluateDefender(
      withProtection(base, { productStatus: ['systemInitiatedScanInProgress'] }),
      NOW,
    );
    expect(tile.severity).toBe('ok');
    expect(tile.findings.some((f) => f.severity === 'warning' || f.severity === 'critical')).toBe(
      false,
    );
  });

  it('Schutzstatus-Abruf mit 429 → availability error, Befund mit Drosselungs-Titel', () => {
    const tile = evaluateDefender({ ...base, protection: throttled(base.device.source) }, NOW);
    expect(tile.availability).toBe('error');
    expect(tile.severity).toBe('unknown');
    expect(findingWithId(tile, 'defender-error').title).toBe(de.rules.common.throttledTitle);
  });

  /** Nicht über Booleans abgedeckte productStatus-Flags landen im Sammelbefund (Warnung). */
  const COLLECTED_FLAGS = [
    'asSignaturesOutOfDate',
    'pendingFullScanDueToThreatAction',
    'pendingManualStepsDueToThreatAction',
    'noQuickScanHappenedForSpecifiedPeriod',
  ];
  for (const flag of COLLECTED_FLAGS) {
    it(`productStatus "${flag}" wird als Warnung gemeldet`, () => {
      const tile = evaluateDefender(withProtection(base, { productStatus: [flag] }), NOW);
      expect(tile.severity).toBe('warning');
    });
  }
});

describe('Gerätestatus (deviceStatus)', () => {
  it.each([
    ['highSeverity', 'critical'],
    ['compromised', 'critical'],
    ['mediumSeverity', 'warning'],
    ['secured', 'ok'],
  ] as const)('partnerReportedThreatState %s → %s', (threat, severity) => {
    const tile = evaluateDeviceStatus(
      withDevice(base, { partnerReportedThreatState: threat }),
      NOW,
    );
    expect(tile.severity).toBe(severity);
  });

  it('partnerReportedThreatState highSeverity → Wert „Bedrohung gemeldet“', () => {
    const tile = evaluateDeviceStatus(
      withDevice(base, { partnerReportedThreatState: 'highSeverity' }),
      NOW,
    );
    expect(tile.value).toBe(de.rules.deviceStatus.valueThreat);
  });

  it('jailBroken "True" → critical, "False" → ok', () => {
    expect(evaluateDeviceStatus(withDevice(base, { jailBroken: 'True' }), NOW).severity).toBe(
      'critical',
    );
    expect(evaluateDeviceStatus(withDevice(base, { jailBroken: 'False' }), NOW).severity).toBe(
      'ok',
    );
  });

  it('5 % freier Speicher → warning, 20 % → ok', () => {
    const total = 476 * GB;
    const low = evaluateDeviceStatus(
      withDevice(base, {
        freeStorageSpaceInBytes: Math.round(total * 0.05),
        totalStorageSpaceInBytes: total,
      }),
      NOW,
    );
    expect(low.severity).toBe('warning');
    expect(findingWithId(low, 'deviceStatus-storage').severity).toBe('warning');

    const ok = evaluateDeviceStatus(
      withDevice(base, {
        freeStorageSpaceInBytes: Math.round(total * 0.2),
        totalStorageSpaceInBytes: total,
      }),
      NOW,
    );
    expect(ok.severity).toBe('ok');
  });

  it('ohne Gesamtspeicher gibt es keine Speicher-Bewertung', () => {
    const tile = evaluateDeviceStatus(
      withDevice(base, { freeStorageSpaceInBytes: 1 * GB, totalStorageSpaceInBytes: null }),
      NOW,
    );
    expect(tile.severity).toBe('ok');
    expect(tile.findings.some((f) => f.id === 'deviceStatus-storage')).toBe(false);
  });

  it('Entra-Objekt fehlt (data null) → warning mit deviceStatus-noEntra', () => {
    const tile = evaluateDeviceStatus(
      withEntra(base, {
        status: 'ok',
        source: base.device.source,
        fetchedAt: NOW.toISOString(),
        data: null,
      }),
      NOW,
    );
    expect(tile.severity).toBe('warning');
    expect(tile.value).toBe(de.rules.deviceStatus.valueNoEntra);
    expect(findingWithId(tile, 'deviceStatus-noEntra').severity).toBe('warning');
  });

  it('Entra-Konto deaktiviert → critical', () => {
    const tile = evaluateDeviceStatus(withEntraData(base, { accountEnabled: false }), NOW);
    expect(tile.severity).toBe('critical');
    expect(tile.value).toBe(de.rules.deviceStatus.valueDisabled);
  });

  it('Entra-Abruf mit 429 → Befund „Anfragen werden gedrosselt“, availability error', () => {
    const tile = evaluateDeviceStatus(withEntra(base, throttled(base.device.source)), NOW);
    expect(tile.availability).toBe('error');
    expect(tile.severity).toBe('unknown');
    expect(findingWithId(tile, 'deviceStatus-entra-error').title).toBe(
      'Anfragen werden gedrosselt',
    );
  });
});

describe('Richtlinien (policies)', () => {
  const configPolicy = (
    state: PolicyStateInfo['state'],
    settings: PolicySettingInfo[] = [],
  ): PolicyStateInfo => ({
    id: 'test-policy-1',
    kind: 'configuration',
    displayName: 'Contoso – Testprofil',
    state,
    platformType: 'windows10AndLater',
    version: 1,
    settingCount: settings.length,
    settings,
  });

  const setting = (overrides: Partial<PolicySettingInfo>): PolicySettingInfo => ({
    setting: null,
    settingName: 'TestEinstellung',
    instanceDisplayName: null,
    state: 'error',
    errorCode: null,
    errorDescription: null,
    currentValue: null,
    sources: [],
    ...overrides,
  });

  const okOf = (data: PolicyStateInfo[]): SectionResult<PolicyStateInfo[]> => ({
    status: 'ok',
    data,
    source: base.device.source,
    fetchedAt: NOW.toISOString(),
  });

  it('keine Richtlinien → Wert „Keine gemeldet“, ok, nur der Settings-Catalog-Hinweis', () => {
    const snapshot = withConfiguration(withCompliance(base, okOf([])), okOf([]));
    const tile = evaluatePolicies(snapshot, NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(de.rules.policies.valueNone);
    expect(tile.findings.map((f) => f.id)).toEqual(['policies-settingsCatalog']);
  });

  it('Profil im Status error → critical, Befund nennt Einstellung und unbekannten Code', () => {
    const errorCode = hexToSignedDecimal('0x87D30065') ?? 0;
    const snapshot = withConfiguration(
      base,
      okOf([configPolicy('error', [setting({ settingName: 'Contoso-Einstellung', errorCode })])]),
    );
    const tile = evaluatePolicies(snapshot, NOW);
    expect(tile.severity).toBe('critical');
    const finding = findingWithId(tile, 'policies-configuration-test-policy-1');
    expect(finding.detail).toContain('Contoso-Einstellung');
    expect(finding.detail).toContain('Unbekannter Code 0x87D30065');
    expect(finding.docsUrl).toMatch(/^https:\/\/learn\.microsoft\.com\//);
  });

  it('Profil im Status conflict → critical mit Konfliktlink und beteiligten Richtlinien', () => {
    const snapshot = withConfiguration(
      base,
      okOf([
        configPolicy('conflict', [
          setting({
            settingName: 'SmartScreen',
            state: 'conflict',
            sources: [
              { id: 'a', displayName: 'Profil Alpha' },
              { id: 'b', displayName: 'Profil Beta' },
            ],
          }),
        ]),
      ]),
    );
    const tile = evaluatePolicies(snapshot, NOW);
    const finding = findingWithId(tile, 'policies-configuration-test-policy-1');
    expect(tile.severity).toBe('critical');
    expect(finding.docsUrl).toBe(Docs.policyConflicts);
    expect(finding.cause).toContain('Profil Alpha');
    expect(finding.cause).toContain('Profil Beta');
  });

  it('Profil nicht konform (nonCompliant) → warning mit Anzahl', () => {
    const snapshot = withConfiguration(
      base,
      okOf([
        configPolicy('nonCompliant', [setting({ state: 'nonCompliant', currentValue: 'false' })]),
      ]),
    );
    const tile = evaluatePolicies(snapshot, NOW);
    expect(tile.severity).toBe('warning');
    expect(tile.value).toBe(de.rules.policies.valueWarnings(1));
  });

  it('Profil-Abruf mit 429 → availability error, unknown, Drosselungs-Befund', () => {
    const tile = evaluatePolicies(withConfiguration(base, throttled(base.device.source)), NOW);
    expect(tile.availability).toBe('error');
    expect(tile.severity).toBe('unknown');
    expect(findingWithId(tile, 'policies-configuration-error').title).toBe(
      de.rules.common.throttledTitle,
    );
  });
});

describe('Betriebssystem (osVersion)', () => {
  const withOs = (osVersion: string | null) => withDevice(base, { osVersion });

  it('10.0.26100.1 → Windows 11 24H2, ok + Hinweis zum Home/Pro-Ende (Stand 2026-10-15)', () => {
    const tile = evaluateOsVersion(withOs('10.0.26100.1'), NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe('Windows 11 24H2');
    expect(tile.findings.map((f) => [f.id, f.severity])).toEqual([['osVersion-homePro', 'unknown']]);
  });

  it('Build ohne Revision (10.0.26100) wird trotzdem erkannt', () => {
    const tile = evaluateOsVersion(withOs('10.0.26100'), NOW);
    expect(tile.value).toBe('Windows 11 24H2');
    expect(tile.severity).toBe('ok');
  });

  it('10.0.99999.1 → unknown mit Befund „nicht in der Release-Tabelle“', () => {
    const tile = evaluateOsVersion(withOs('10.0.99999.1'), NOW);
    expect(tile.severity).toBe('unknown');
    expect(findingWithId(tile, 'osVersion-unknownBuild').title).toBe(
      'Windows-Build nicht in der Release-Tabelle',
    );
  });

  it('ungültige Version "abc" → unknown, nichts geraten', () => {
    const tile = evaluateOsVersion(withOs('abc'), NOW);
    expect(tile.severity).toBe('unknown');
    expect(findingWithId(tile, 'osVersion-unknownBuild').severity).toBe('unknown');
  });

  it('fehlende Version (null) → unknown', () => {
    expect(evaluateOsVersion(withOs(null), NOW).severity).toBe('unknown');
  });

  it('23H2 bei 61 Tagen Restlaufzeit ist ok, bei 60 Tagen warning (Grenze osEndOfUpdatesWarningDays)', () => {
    const at61 = new Date('2026-09-10T23:59:59Z');
    const at60 = new Date('2026-09-11T23:59:59Z');
    const os23h2 = withOs('10.0.22631.4317');
    expect(evaluateOsVersion(os23h2, at61).severity).toBe('ok');
    const tile = evaluateOsVersion(os23h2, at60);
    expect(tile.severity).toBe('warning');
    expect(findingWithId(tile, 'osVersion-ending').title).toContain('60 Tagen');
  });

  it('nach Ende der Updates (Enterprise) → warning mit osVersion-ended', () => {
    const afterEnd = new Date(Date.parse('2026-11-10T23:59:59Z') + DAY_MS);
    const tile = evaluateOsVersion(withOs('10.0.22631.4317'), afterEnd);
    expect(tile.severity).toBe('warning');
    expect(tile.summary).toBe(de.rules.osVersion.summaryEnded);
    expect(findingWithId(tile, 'osVersion-ended').severity).toBe('warning');
  });

  it('Windows 10 ist immer warning (Supportende), unabhängig vom Datum', () => {
    const tile = evaluateOsVersion(withOs('10.0.19045.6456'), NOW);
    expect(tile.severity).toBe('warning');
    expect(tile.value).toBe('Windows 10 22H2');
  });
});
