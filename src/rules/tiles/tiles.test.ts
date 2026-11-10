import { beforeAll, describe, expect, it } from 'vitest';
import type {
  AppInstallStateInfo,
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
import { formatDate, formatRelativeTime, hexToSignedDecimal } from '../../domain/format';
import { de } from '../../i18n/de';
import { MockProvider } from '../../providers/mock/MockProvider';
import { Docs } from '../knowledge/docs';
import { evaluateBitLocker } from './bitlocker';
import { evaluateCheckIn } from './checkIn';
import { evaluateApps } from './apps';
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
    duplicateDevices: await provider.getDuplicateDevices(device),
    bitlockerKeys: await provider.getBitLockerKeys(device),
    applePushCertificate: await provider.getApplePushCertificate(device),
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
    [25, 'ok'],
    [168, 'ok'],
    [169, 'warning'],
    [720, 'warning'],
    [721, 'critical'],
  ] as const)('%s h seit letztem Check-in → %s', (hours, severity) => {
    const tile = evaluateCheckIn(withDevice(base, { lastSyncDateTime: hoursAgo(hours) }), NOW);
    expect(tile.severity).toBe(severity);
  });

  it('7 Tage + 1 h ist warning mit Befund checkIn-delayed', () => {
    const tile = evaluateCheckIn(withDevice(base, { lastSyncDateTime: hoursAgo(7 * 24 + 1) }), NOW);
    expect(findingWithId(tile, 'checkIn-delayed').severity).toBe('warning');
  });

  it('30 Tage + 1 h ist critical mit Befund checkIn-stale', () => {
    const tile = evaluateCheckIn(
      withDevice(base, { lastSyncDateTime: hoursAgo(30 * 24 + 1) }),
      NOW,
    );
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

  it('Malware-Liste nicht abrufbar → Hinweis-Befund, keine falsche Entwarnung', () => {
    const tile = evaluateDefender(
      withProtection(base, {
        detectedMalwareError: {
          code: 'forbidden',
          message: 'Zugriff verweigert (HTTP 403).',
          httpStatus: 403,
        },
      }),
      NOW,
    );
    expect(findingWithId(tile, 'defender-malwareListError').severity).toBe('unknown');
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
  describe('Apple-MDM-Push-Zertifikat (Mandant)', () => {
    const apnsSource: DataSource = {
      kind: 'graph',
      label: 'GET /deviceManagement/applePushNotificationCertificate',
    };
    const ios = (apns: DeviceSnapshot['applePushCertificate']): DeviceSnapshot => ({
      ...withDevice(base, { osFamily: 'ios', operatingSystem: 'iOS' }),
      applePushCertificate: apns,
    });
    const okApns = (days: number): DeviceSnapshot['applePushCertificate'] => ({
      status: 'ok',
      data: {
        expirationDateTime: new Date(NOW.getTime() + days * DAY_MS).toISOString(),
        lastModifiedDateTime: null,
      },
      source: apnsSource,
      fetchedAt: NOW.toISOString(),
    });

    it('Apple-Gerät wartet auf die Section (lädt), Windows nicht', () => {
      expect(evaluateDeviceStatus(ios(undefined), NOW).state).toBe('loading');
      expect(evaluateDeviceStatus({ ...base, applePushCertificate: undefined }, NOW).state).toBe(
        'ready',
      );
    });

    it('läuft in mehr als 30 Tagen ab → nur Fact, kein Befund', () => {
      const tile = evaluateDeviceStatus(ios(okApns(200)), NOW);
      expect(tile.findings.some((f) => f.id.startsWith('deviceStatus-apns'))).toBe(false);
      expect(tile.facts.some((f) => f.label === de.rules.facts.apnsCertificate)).toBe(true);
    });

    it('läuft in ≤ 30 Tagen ab → warning mit Quelle', () => {
      const tile = evaluateDeviceStatus(ios(okApns(20)), NOW);
      const finding = tile.findings.find((f) => f.id === 'deviceStatus-apnsExpiring');
      expect(finding?.severity).toBe('warning');
      expect(finding?.docsUrl).toBe(Docs.appleMdmPushCertificate);
      expect(tile.severity).toBe('warning');
      expect(tile.value).toBe(de.rules.deviceStatus.valueApnsExpiring);
      expect(tile.sources).toContainEqual(apnsSource);
    });

    it('abgelaufen → critical', () => {
      const tile = evaluateDeviceStatus(ios(okApns(-3)), NOW);
      expect(tile.findings.find((f) => f.id === 'deviceStatus-apnsExpired')?.severity).toBe(
        'critical',
      );
      expect(tile.severity).toBe('critical');
    });

    it('403 → Hinweis „Fehlende Berechtigung“ mit Scope, Kachel bleibt ok', () => {
      const tile = evaluateDeviceStatus(
        ios({
          status: 'forbidden',
          error: {
            code: 'forbidden',
            message: 'Forbidden',
            httpStatus: 403,
            requiredScope: 'DeviceManagementServiceConfig.Read.All',
          },
          source: apnsSource,
        }),
        NOW,
      );
      const finding = tile.findings.find((f) => f.id === 'deviceStatus-apns-forbidden');
      expect(finding?.severity).toBe('unknown');
      expect(finding?.evidence?.requiredScope).toBe('DeviceManagementServiceConfig.Read.All');
      expect(tile.severity).toBe('ok');
    });

    it('notApplicable → kein Befund', () => {
      const tile = evaluateDeviceStatus(
        ios({ status: 'notApplicable', reason: 'x', source: apnsSource }),
        NOW,
      );
      expect(tile.findings.some((f) => f.id.startsWith('deviceStatus-apns'))).toBe(false);
    });
  });

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

  describe('MDM-Zertifikat, Beaufsichtigung und Enrollment-Profil', () => {
    /** Zeitpunkt relativ zu NOW (negativ = Vergangenheit). */
    const at = (ms: number): string => new Date(NOW.getTime() + ms).toISOString();
    const inDays = (days: number): string => at(days * DAY_MS);
    /** Zertifikat weit in der Zukunft – macht die Basis unabhängig vom Mock-Szenario. */
    const withCert = (s: DeviceSnapshot, expiry: string | null): DeviceSnapshot =>
      withDevice(s, { managementCertificateExpirationDate: expiry });
    const certFindings = (tile: Tile): string[] =>
      tile.findings.map((f) => f.id).filter((id) => id.startsWith('deviceStatus-cert'));

    it('Zertifikat läuft in genau 30 Tagen ab → warning mit deviceStatus-certExpiring', () => {
      const expiry = inDays(30);
      const tile = evaluateDeviceStatus(withCert(base, expiry), NOW);
      expect(tile.severity).toBe('warning');
      expect(tile.value).toBe(de.rules.deviceStatus.valueCertExpiring);
      const finding = findingWithId(tile, 'deviceStatus-certExpiring');
      expect(finding.severity).toBe('warning');
      expect(finding.title).toBe(
        de.rules.deviceStatus.certExpiringTitle(formatRelativeTime(expiry, NOW)),
      );
      expect(finding.docsUrl).toBe(Docs.mdmCertificateLifetime);
      expect(finding.evidence).toMatchObject({ managementCertificateExpirationDate: expiry });
    });

    it('Zertifikat läuft in 30 Tagen und 1 Minute ab → noch kein Befund, nur Fact', () => {
      const expiry = at(30 * DAY_MS + 60_000);
      const tile = evaluateDeviceStatus(withCert(base, expiry), NOW);
      expect(certFindings(tile)).toEqual([]);
      expect(tile.severity).toBe('ok');
      expect(tile.facts).toContainEqual({
        label: de.rules.facts.mdmCertificate,
        value: formatDate(expiry),
      });
    });

    it('Zertifikat läuft in 31 Tagen ab → kein Befund', () => {
      const tile = evaluateDeviceStatus(withCert(base, inDays(31)), NOW);
      expect(certFindings(tile)).toEqual([]);
      expect(tile.severity).toBe('ok');
    });

    it('Zertifikat läuft in 1 Stunde ab → warning, noch nicht abgelaufen', () => {
      const tile = evaluateDeviceStatus(withCert(base, at(HOUR_MS)), NOW);
      expect(tile.severity).toBe('warning');
      expect(findingWithId(tile, 'deviceStatus-certExpiring').severity).toBe('warning');
      expect(certFindings(tile)).not.toContain('deviceStatus-certExpired');
    });

    it('Zertifikat läuft genau jetzt ab (0 Tage) → critical mit deviceStatus-certExpired', () => {
      const tile = evaluateDeviceStatus(withCert(base, NOW.toISOString()), NOW);
      expect(tile.severity).toBe('critical');
      expect(tile.value).toBe(de.rules.deviceStatus.valueCertExpired);
      const finding = findingWithId(tile, 'deviceStatus-certExpired');
      expect(finding.severity).toBe('critical');
      expect(finding.title).toBe(de.rules.deviceStatus.certExpiredTitle);
      expect(finding.docsUrl).toBe(Docs.mdmCertificateLifetime);
    });

    it('Zertifikat seit 1 Tag abgelaufen → critical, kein certExpiring-Befund', () => {
      const tile = evaluateDeviceStatus(withCert(base, inDays(-1)), NOW);
      expect(tile.severity).toBe('critical');
      expect(certFindings(tile)).toEqual(['deviceStatus-certExpired']);
    });

    it('Zertifikat-Datum fehlt (null) → kein Befund und kein Fact', () => {
      const tile = evaluateDeviceStatus(withCert(base, null), NOW);
      expect(certFindings(tile)).toEqual([]);
      expect(tile.facts.some((f) => f.label === de.rules.facts.mdmCertificate)).toBe(false);
    });

    it('ungültiges Zertifikat-Datum wird wie fehlend behandelt (kein Befund)', () => {
      const tile = evaluateDeviceStatus(withCert(base, 'kein-datum'), NOW);
      expect(certFindings(tile)).toEqual([]);
      expect(tile.severity).toBe('ok');
    });

    it('iOS nicht beaufsichtigt (isSupervised false) → Hinweis deviceStatus-notSupervised, Kachel bleibt ok', () => {
      const tile = evaluateDeviceStatus(
        withCert(
          withDevice(base, { osFamily: 'ios', operatingSystem: 'iOS', isSupervised: false }),
          inDays(200),
        ),
        NOW,
      );
      expect(tile.severity).toBe('ok');
      const finding = findingWithId(tile, 'deviceStatus-notSupervised');
      expect(finding.severity).toBe('unknown');
      expect(finding.docsUrl).toBe(Docs.appleSupervisedMode);
      expect(finding.evidence).toMatchObject({ isSupervised: false });
      expect(tile.facts).toContainEqual({
        label: de.rules.facts.supervised,
        value: de.rules.facts.no,
      });
    });

    it('iOS beaufsichtigt (isSupervised true) → kein Befund, Fact „Ja“', () => {
      const tile = evaluateDeviceStatus(
        withCert(
          withDevice(base, { osFamily: 'ios', operatingSystem: 'iOS', isSupervised: true }),
          inDays(200),
        ),
        NOW,
      );
      expect(tile.findings.some((f) => f.id === 'deviceStatus-notSupervised')).toBe(false);
      expect(tile.facts).toContainEqual({
        label: de.rules.facts.supervised,
        value: de.rules.facts.yes,
      });
    });

    it('iOS ohne Angabe (isSupervised null) → weder Befund noch Fact', () => {
      const tile = evaluateDeviceStatus(
        withCert(
          withDevice(base, { osFamily: 'ios', operatingSystem: 'iOS', isSupervised: null }),
          inDays(200),
        ),
        NOW,
      );
      expect(tile.findings.some((f) => f.id === 'deviceStatus-notSupervised')).toBe(false);
      expect(tile.facts.some((f) => f.label === de.rules.facts.supervised)).toBe(false);
    });

    it.each([
      ['Windows', 'windows', 'Windows'],
      ['macOS', 'macos', 'macOS'],
      ['Android', 'android', 'Android'],
    ] as const)(
      '%s mit isSupervised false → nie ein Beaufsichtigungs-Befund (nur iOS)',
      (_label, osFamily, operatingSystem) => {
        const tile = evaluateDeviceStatus(
          withCert(
            withDevice(base, { osFamily, operatingSystem, isSupervised: false }),
            inDays(200),
          ),
          NOW,
        );
        expect(tile.findings.some((f) => f.id === 'deviceStatus-notSupervised')).toBe(false);
        expect(tile.facts.some((f) => f.label === de.rules.facts.supervised)).toBe(false);
      },
    );

    it('Befunde sind nach Schwere sortiert: Zertifikatswarnung vor Beaufsichtigungs-Hinweis', () => {
      const tile = evaluateDeviceStatus(
        withCert(
          withDevice(base, { osFamily: 'ios', operatingSystem: 'iOS', isSupervised: false }),
          inDays(10),
        ),
        NOW,
      );
      expect(tile.findings.map((f) => f.id)).toEqual([
        'deviceStatus-certExpiring',
        'deviceStatus-notSupervised',
      ]);
      expect(tile.severity).toBe('warning');
    });

    it('Enrollment-Profil wird als Fact angezeigt, bei null fehlt der Fact', () => {
      const withProfile = evaluateDeviceStatus(
        withCert(
          withDevice(base, { enrollmentProfileName: 'Contoso Autopilot Standard' }),
          inDays(200),
        ),
        NOW,
      );
      expect(withProfile.facts).toContainEqual({
        label: de.rules.facts.enrollmentProfile,
        value: 'Contoso Autopilot Standard',
      });

      const withoutProfile = evaluateDeviceStatus(
        withCert(withDevice(base, { enrollmentProfileName: null }), inDays(200)),
        NOW,
      );
      expect(withoutProfile.facts.some((f) => f.label === de.rules.facts.enrollmentProfile)).toBe(
        false,
      );
    });
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

  it('Wissensbasis-Treffer (0x801C03F3) → Titel, Ursache, Lösung und Learn-Link aus der Wissensbasis', () => {
    const errorCode = hexToSignedDecimal('0x801C03F3') ?? 0;
    const snapshot = withConfiguration(
      base,
      okOf([configPolicy('error', [setting({ settingName: 'Contoso-Einstellung', errorCode })])]),
    );
    const finding = findingWithId(
      evaluatePolicies(snapshot, NOW),
      'policies-configuration-test-policy-1',
    );
    expect(finding.detail).toContain('Entra-Geräteobjekt nicht gefunden');
    expect(finding.cause).toContain('Geräteobjekt');
    expect(finding.remediation[0]).toContain('erneut bei Windows Autopilot registrieren');
    expect(finding.docsUrl).toBe(
      'https://learn.microsoft.com/autopilot/known-issues#pre-provisioning-gives-an-error-screen-and-the-microsoft-windows-user-device-registrationadmin-event-log-displays-hresult-error-code-0x801c03f3',
    );
  });

  it('kontextgebundener App-Code (0x8000FFFF) wird bei Richtlinien nicht gedeutet', () => {
    const errorCode = hexToSignedDecimal('0x8000FFFF') ?? 0;
    const snapshot = withConfiguration(
      base,
      okOf([configPolicy('error', [setting({ settingName: 'Contoso-Einstellung', errorCode })])]),
    );
    const finding = findingWithId(
      evaluatePolicies(snapshot, NOW),
      'policies-configuration-test-policy-1',
    );
    expect(finding.detail).toContain('Unbekannter Code 0x8000FFFF (-2147418113)');
    expect(finding.cause).toBe(de.rules.policies.errorCause);
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

  const compliancePolicy = (state: PolicyStateInfo['state']): PolicyStateInfo => ({
    ...configPolicy(state),
    id: 'test-compliance-1',
    kind: 'compliance',
    displayName: 'Contoso – Compliance',
  });

  it('Compliance-Richtlinie error, Gerät aber konform → nur Hinweis „Status weicht ab“, Kachel ok', () => {
    const snapshot = withConfiguration(
      withCompliance(
        withDevice(base, { complianceState: 'compliant' }),
        okOf([compliancePolicy('error')]),
      ),
      okOf([]),
    );
    const tile = evaluatePolicies(snapshot, NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(de.rules.policies.valueOk);
    const finding = findingWithId(tile, 'policies-compliance-test-compliance-1');
    expect(finding.severity).toBe('unknown');
    expect(finding.title).toBe(
      de.rules.policies.staleTitle(de.rules.policies.kindCompliance, 'Contoso – Compliance'),
    );

    const compliance = evaluateCompliance(snapshot, NOW);
    expect(compliance.severity).toBe('ok');
    expect(compliance.summary).toBe(de.rules.compliance.summaryPolicies(1, 1, true));
    expect(findingWithId(compliance, 'compliance-policy-test-compliance-1').severity).toBe(
      'unknown',
    );
  });

  it('Compliance-Richtlinie error bei nicht konformem Gerät → critical mit Compliance-Texten', () => {
    const snapshot = withConfiguration(
      withCompliance(
        withDevice(base, { complianceState: 'error' }),
        okOf([compliancePolicy('error')]),
      ),
      okOf([]),
    );
    const tile = evaluatePolicies(snapshot, NOW);
    expect(tile.severity).toBe('critical');
    const finding = findingWithId(tile, 'policies-compliance-test-compliance-1');
    expect(finding.cause).toBe(de.rules.policies.errorCauseCompliance);
    expect(finding.remediation[0]).toBe(de.rules.policies.errorRemediationCompliance[0]);
    expect(finding.docsUrl).toBe(Docs.complianceErrorState);
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

describe('Apps (apps)', () => {
  const app = (overrides: Partial<AppInstallStateInfo>): AppInstallStateInfo => ({
    appId: 'app-1',
    displayName: 'Contoso App',
    version: '1.0',
    intent: 'requiredInstall',
    installState: 'installed',
    ...overrides,
  });
  const withApps = (section: SectionResult<AppInstallStateInfo[]>): DeviceSnapshot => ({
    ...base,
    appInstallStates: section,
  });
  const okApps = (data: AppInstallStateInfo[]): SectionResult<AppInstallStateInfo[]> => ({
    status: 'ok',
    data,
    source: base.device.source,
    fetchedAt: NOW.toISOString(),
  });

  it('ohne Section → loading', () => {
    expect(evaluateApps({ device: base.device }, NOW).state).toBe('loading');
  });

  it('alles installiert → ok, nur Beta-Hinweis', () => {
    const tile = evaluateApps(
      withApps(
        okApps([app({}), app({ appId: 'b', intent: 'available', installState: 'notInstalled' })]),
      ),
      NOW,
    );
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(de.rules.apps.valueOk);
    expect(tile.summary).toBe(de.rules.apps.summary(1, 1, 1));
    expect(tile.findings.map((f) => f.id)).toEqual(['apps-beta']);
    expect(findingWithId(tile, 'apps-beta').docsUrl).toBe(Docs.appIntentAndStatesBeta);
  });

  it('fehlgeschlagen → critical mit Link zur App; Pflicht-App fehlt → warning; ausstehend → Hinweis', () => {
    const tile = evaluateApps(
      withApps(
        okApps([
          app({ appId: 'f', displayName: 'Contoso VPN', installState: 'failed' }),
          app({ appId: 'm', installState: 'notInstalled' }),
          app({ appId: 'p', installState: 'pendingInstall' }),
        ]),
      ),
      NOW,
    );
    expect(tile.severity).toBe('critical');
    expect(tile.value).toBe(de.rules.apps.valueFailed(1));
    const failed = findingWithId(tile, 'apps-failed-f');
    expect(failed.title).toBe(de.rules.apps.failedTitle('Contoso VPN'));
    expect(failed.docsUrl).toBe(Docs.appInstallTroubleshoot);
    expect(failed.links?.[0]?.url).toContain('/appId/f');
    expect(findingWithId(tile, 'apps-missing-m').severity).toBe('warning');
    expect(findingWithId(tile, 'apps-pending-p').severity).toBe('unknown');
  });

  it('ohne primären Benutzer → notApplicable-Kachel (unknown)', () => {
    const tile = evaluateApps(
      withApps({
        status: 'notApplicable',
        reason: de.reasons.appsNoPrimaryUser,
        source: base.device.source,
      }),
      NOW,
    );
    expect(tile.severity).toBe('unknown');
    expect(tile.availability).toBe('notApplicable');
    expect(tile.summary).toBe(de.reasons.appsNoPrimaryUser);
  });
});

describe('Betriebssystem (osVersion)', () => {
  const withOs = (osVersion: string | null) => withDevice(base, { osVersion });

  it('10.0.26100.1 → Windows 11 24H2, ok + Hinweis zum Home/Pro-Ende (Stand 2026-10-15)', () => {
    const tile = evaluateOsVersion(withOs('10.0.26100.1'), NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe('Windows 11 24H2');
    expect(tile.findings.map((f) => [f.id, f.severity])).toEqual([
      ['osVersion-homePro', 'unknown'],
    ]);
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

  describe('Android-Sicherheitspatch', () => {
    const MIDNIGHT = new Date('2026-10-15T00:00:00Z');
    /** Patchdatum (YYYY-MM-DD, UTC) genau `days` Tage vor NOW. */
    const patchDaysAgo = (days: number): string =>
      new Date(NOW.getTime() - days * DAY_MS).toISOString().slice(0, 10);
    const android = (patch: string | null) =>
      withDevice(base, {
        osFamily: 'android',
        operatingSystem: 'Android',
        osVersion: '14',
        androidSecurityPatchLevel: patch,
      });

    it('Patch 89 Tage alt → unknown ohne Befund, Summary nennt das Patchdatum', () => {
      const patch = patchDaysAgo(89);
      const tile = evaluateOsVersion(android(patch), NOW);
      expect(tile.severity).toBe('unknown');
      expect(tile.findings).toEqual([]);
      expect(tile.value).toBe('Android 14');
      expect(tile.summary).toBe(de.rules.osVersion.summaryPatch(formatDate(patch, 'UTC')));
      expect(tile.facts).toContainEqual({
        label: de.rules.facts.securityPatch,
        value: formatDate(patch, 'UTC'),
      });
    });

    it('Patch 91 Tage alt → warning mit osVersion-androidPatchOld', () => {
      const patch = patchDaysAgo(91);
      const tile = evaluateOsVersion(android(patch), NOW);
      expect(tile.severity).toBe('warning');
      const finding = findingWithId(tile, 'osVersion-androidPatchOld');
      expect(finding.severity).toBe('warning');
      expect(finding.title).toBe(de.rules.osVersion.patchOldTitle(91));
      expect(finding.docsUrl).toBe(Docs.androidPatchLevel);
      expect(finding.evidence).toMatchObject({ androidSecurityPatchLevel: patch });
    });

    it('Grenze (Mitternacht): genau 90 Tage alt ist noch ok, 91 Tage ist warning', () => {
      // 2026-07-17 → 2026-10-15 = 90 Tage; "älter als 90 Tage" ist strikt.
      const at90 = evaluateOsVersion(android('2026-07-17'), MIDNIGHT);
      expect(at90.severity).toBe('unknown');
      expect(at90.findings).toEqual([]);

      const at91 = evaluateOsVersion(android('2026-07-16'), MIDNIGHT);
      expect(at91.severity).toBe('warning');
      expect(findingWithId(at91, 'osVersion-androidPatchOld').title).toBe(
        de.rules.osVersion.patchOldTitle(91),
      );
    });

    it('Patchdatum in der Zukunft → kein Warnbefund', () => {
      const tile = evaluateOsVersion(android(patchDaysAgo(-10)), NOW);
      expect(tile.severity).toBe('unknown');
      expect(tile.findings).toEqual([]);
    });

    it.each([
      ['ungültiger Text', 'kein-datum'],
      ['leerer String', ''],
      ['null', null],
    ] as const)(
      'Patch %s → kein Befund, kein Patch-Fact, Summary „nur Windows“',
      (_label, patch) => {
        const tile = evaluateOsVersion(android(patch), NOW);
        expect(tile.severity).toBe('unknown');
        expect(tile.findings).toEqual([]);
        expect(tile.summary).toBe(de.rules.osVersion.summaryNotEvaluated);
        expect(tile.facts.some((f) => f.label === de.rules.facts.securityPatch)).toBe(false);
      },
    );

    it('iOS mit gesetztem Patchdatum → Patch wird nicht bewertet (nur Android)', () => {
      const tile = evaluateOsVersion(
        withDevice(base, {
          osFamily: 'ios',
          operatingSystem: 'iOS',
          osVersion: '18.6',
          androidSecurityPatchLevel: patchDaysAgo(200),
        }),
        NOW,
      );
      expect(tile.severity).toBe('unknown');
      expect(tile.findings).toEqual([]);
      expect(tile.summary).toBe(de.rules.osVersion.summaryNotEvaluated);
    });

    it('Patchdatum "2026-07-17" wird zeitzonenunabhängig als 17.07.2026 angezeigt', () => {
      const tile = evaluateOsVersion(
        withDevice(base, {
          osFamily: 'android',
          operatingSystem: 'Android',
          osVersion: '15',
          androidSecurityPatchLevel: '2026-07-17',
        }),
        NOW,
      );
      expect(tile.facts.find((x) => x.label === de.rules.facts.securityPatch)?.value).toBe(
        '17.07.2026',
      );
    });
  });
});
