import { describe, it, expect, vi, afterEach } from 'vitest';
import type {
  ComplianceState,
  ComplianceStatus,
  WindowsDeviceHealthState,
  WindowsMalwareSeverity,
} from '../../graph/dto';
import type { DeviceSearchResult, ManagedDeviceInfo, SectionResult } from '../../domain/types';
import { de } from '../../i18n/de';
import { ProviderError, type DeviceDataProvider } from '../DeviceDataProvider';
import { MockProvider } from './MockProvider';
import { scenarios } from './scenarios';
import type { MockScenario } from './types';

const NOW = new Date('2026-10-15T12:00:00Z');
const DAY = 24 * 60 * 60_000;

const COMPLIANCE_STATES: ComplianceState[] = [
  'unknown',
  'compliant',
  'noncompliant',
  'conflict',
  'error',
  'inGracePeriod',
  'configManager',
];

const COMPLIANCE_STATUSES: ComplianceStatus[] = [
  'unknown',
  'notApplicable',
  'compliant',
  'remediated',
  'nonCompliant',
  'error',
  'conflict',
  'notAssigned',
];

const DEVICE_HEALTH_STATES: WindowsDeviceHealthState[] = [
  'clean',
  'fullScanPending',
  'rebootPending',
  'manualStepsPending',
  'offlineScanPending',
  'critical',
];

const MALWARE_SEVERITIES: WindowsMalwareSeverity[] = [
  'unknown',
  'low',
  'moderate',
  'high',
  'severe',
];

/** Microsoft Learn: windowsDefenderProductStatus (Flags-Werte). */
const PRODUCT_STATUS_VALUES = new Set([
  'noStatus',
  'serviceNotRunning',
  'serviceStartedWithoutMalwareProtection',
  'pendingFullScanDueToThreatAction',
  'pendingRebootDueToThreatAction',
  'pendingManualStepsDueToThreatAction',
  'avSignaturesOutOfDate',
  'asSignaturesOutOfDate',
  'noQuickScanHappenedForSpecifiedPeriod',
  'noFullScanHappenedForSpecifiedPeriod',
  'systemInitiatedScanInProgress',
  'systemInitiatedCleanInProgress',
  'samplesPendingSubmission',
  'productRunningInEvaluationMode',
  'productRunningInNonGenuineMode',
  'productExpired',
  'offlineScanRequired',
  'serviceShutdownAsPartOfSystemShutdown',
  'threatRemediationFailedCritically',
  'threatRemediationFailedNonCritically',
  'noStatusFlagsSet',
  'platformOutOfDate',
  'platformUpdateInProgress',
  'platformAboutToBeOutdated',
  'signatureOrPlatformEndOfLifeIsPastOrIsImpending',
  'windowsSModeSignaturesInUseOnNonWin10SInstall',
]);

const SCENARIO_NAMES = [
  'CONTOSO-PC001',
  'CONTOSO-PC014',
  'CONTOSO-PC027',
  'CONTOSO-PC033',
  'CONTOSO-PC042',
  'CONTOSO-LT108',
  'CONTOSO-MAC07',
  'CONTOSO-PC050',
];

const instantProvider = () => new MockProvider({ latency: false, now: () => NOW });

/** Liefert die ID eines Szenarios (über build, damit der Test nicht von Such-Logik abhängt). */
function idOf(deviceName: string): string {
  const scenario = scenarios.find((s) => s.deviceName === deviceName);
  if (!scenario) throw new Error(`Szenario ${deviceName} fehlt`);
  return scenario.build(NOW).device.id;
}

async function loadDevice(
  provider: DeviceDataProvider,
  deviceName: string,
): Promise<ManagedDeviceInfo> {
  return provider.getDevice(idOf(deviceName));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('MockProvider – Suche', () => {
  const provider = instantProvider();

  it('findet einen exakten Namen mit genau einem Treffer', async () => {
    const hits = await provider.searchDevices('CONTOSO-PC001');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.deviceName).toBe('CONTOSO-PC001');
  });

  it('ignoriert Groß-/Kleinschreibung beim exakten Namen', async () => {
    const hits = await provider.searchDevices('contoso-pc001');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.deviceName).toBe('CONTOSO-PC001');
  });

  it('ignoriert führende und abschließende Leerzeichen', async () => {
    const hits = await provider.searchDevices('   CONTOSO-PC001  ');
    expect(hits.map((h) => h.deviceName)).toEqual(['CONTOSO-PC001']);
  });

  it('liefert bei Teilstring alle passenden Geräte', async () => {
    const hits = await provider.searchDevices('contoso-pc0');
    expect(hits.map((h) => h.deviceName).sort()).toEqual(
      [
        'CONTOSO-PC001',
        'CONTOSO-PC014',
        'CONTOSO-PC027',
        'CONTOSO-PC033',
        'CONTOSO-PC042',
        'CONTOSO-PC050',
      ].sort(),
    );
    expect(hits).toHaveLength(6);
  });

  it('liefert für unbekannten Namen ein leeres Array', async () => {
    await expect(provider.searchDevices('CONTOSO-NIX')).resolves.toEqual([]);
  });

  it('liefert für leere oder nur aus Leerraum bestehende Suche ein leeres Array', async () => {
    await expect(provider.searchDevices('')).resolves.toEqual([]);
    await expect(provider.searchDevices('   ')).resolves.toEqual([]);
  });

  it('liefert die Suchfelder aus dem Gerätedatensatz', async () => {
    const [hit] = await provider.searchDevices('CONTOSO-PC014');
    expect(hit).toEqual({
      id: idOf('CONTOSO-PC014'),
      deviceName: 'CONTOSO-PC014',
      userPrincipalName: 'jonas.weber@contoso.com',
      userDisplayName: 'Jonas Weber',
      operatingSystem: 'Windows',
      osVersion: '10.0.26200.9711',
      model: 'Surface Laptop 6',
      complianceState: 'noncompliant',
      lastSyncDateTime: new Date(NOW.getTime() - 2 * 60 * 60_000).toISOString(),
    } satisfies DeviceSearchResult);
  });

  it('bevorzugt den exakten Treffer vor Teilstring-Treffern', async () => {
    const named = (name: string, id: string): MockScenario => {
      const base = scenarios[0] as MockScenario;
      return {
        ...base,
        deviceName: name,
        build: (now) => {
          const fixture = base.build(now);
          return { ...fixture, device: { ...fixture.device, id, deviceName: name } };
        },
      };
    };
    const custom = new MockProvider({
      latency: false,
      now: () => NOW,
      scenarios: [
        named('CONTOSO-PC1', '00000000-0000-4000-8000-0000000000a1'),
        named('CONTOSO-PC10', '00000000-0000-4000-8000-0000000000a2'),
        named('CONTOSO-PC100', '00000000-0000-4000-8000-0000000000a3'),
      ],
    });
    const exact = await custom.searchDevices('contoso-pc10');
    expect(exact.map((h) => h.deviceName)).toEqual(['CONTOSO-PC10']);

    const partial = await custom.searchDevices('contoso-pc1');
    expect(partial.map((h) => h.deviceName)).toEqual(['CONTOSO-PC1']);

    const substringOnly = await custom.searchDevices('pc100');
    expect(substringOnly.map((h) => h.deviceName)).toEqual(['CONTOSO-PC100']);
  });
});

describe('MockProvider – Geräte und Szenarien', () => {
  const provider = instantProvider();

  it('enthält genau die 8 Szenarien aus der M1-Tabelle', () => {
    expect(scenarios.map((s) => s.deviceName).sort()).toEqual([...SCENARIO_NAMES].sort());
  });

  it.each(SCENARIO_NAMES)('ruft %s per getDevice ab', async (deviceName) => {
    const device = await loadDevice(provider, deviceName);
    expect(device.source.kind).toBe('mock');
    expect(device.deviceName).toBe(deviceName);
  });

  it.each(SCENARIO_NAMES)('findet %s über die Suche genau einmal', async (deviceName) => {
    const hits = await provider.searchDevices(deviceName);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.id).toBe(idOf(deviceName));
  });

  it('verwendet nur contoso.com als Domain in userPrincipalName', async () => {
    for (const deviceName of SCENARIO_NAMES) {
      const device = await loadDevice(provider, deviceName);
      if (device.userPrincipalName === null) continue;
      expect(device.userPrincipalName.split('@')[1], deviceName).toBe('contoso.com');
    }
  });

  it('wirft für unbekannte ID einen ProviderError mit code notFound', async () => {
    const error = await provider.getDevice('00000000-0000-4000-8000-ffffffffffff').catch((e) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error.error).toMatchObject({ code: 'notFound', httpStatus: 404 });
    expect(error.message).toBe(de.errors.deviceNotFound);
  });

  it('wirft auch für leere ID einen ProviderError mit code notFound', async () => {
    await expect(provider.getDevice('')).rejects.toMatchObject({
      error: { code: 'notFound' },
    });
  });

  it('liefert für unbekannte Geräte-ID in Sections status error mit code notFound', async () => {
    const device = await loadDevice(provider, 'CONTOSO-PC001');
    const ghost = { ...device, id: '00000000-0000-4000-8000-ffffffffffff' };
    const result = await provider.getProtectionState(ghost);
    expect(result).toMatchObject({ status: 'error', error: { code: 'notFound' } });
  });
});

describe('MockProvider – Section-Zustände', () => {
  const provider = instantProvider();

  it('liefert für CONTOSO-PC001 in allen Sections status ok', async () => {
    const device = await loadDevice(provider, 'CONTOSO-PC001');
    const results = await Promise.all([
      provider.getProtectionState(device),
      provider.getCompliancePolicyStates(device),
      provider.getConfigurationPolicyStates(device),
      provider.getEntraDevice(device),
      provider.getBitLockerKeys(device),
    ]);
    for (const result of results) {
      expect(result.status).toBe('ok');
    }
  });

  it('markiert Defender auf macOS (CONTOSO-MAC07) als notApplicable', async () => {
    const device = await loadDevice(provider, 'CONTOSO-MAC07');
    const result = await provider.getProtectionState(device);
    expect(result.status).toBe('notApplicable');
    if (result.status === 'notApplicable') {
      expect(result.reason).toBe(de.reasons.defenderNotWindows);
    }
  });

  it('markiert BitLocker auf macOS (CONTOSO-MAC07) als notApplicable', async () => {
    const device = await loadDevice(provider, 'CONTOSO-MAC07');
    const result = await provider.getBitLockerKeys(device);
    expect(result.status).toBe('notApplicable');
    if (result.status === 'notApplicable') {
      expect(result.reason).toBe(de.reasons.bitlockerNotWindows);
    }
  });

  it('liefert für CONTOSO-MAC07 FileVault als aktiviert (isEncrypted true)', async () => {
    const device = await loadDevice(provider, 'CONTOSO-MAC07');
    expect(device.operatingSystem).toBe('macOS');
    expect(device.isEncrypted).toBe(true);
  });

  it('liefert für CONTOSO-PC050 configurationPolicies als forbidden mit Scope', async () => {
    const device = await loadDevice(provider, 'CONTOSO-PC050');
    const result = await provider.getConfigurationPolicyStates(device);
    expect(result.status).toBe('forbidden');
    if (result.status === 'forbidden') {
      expect(result.error).toMatchObject({
        code: 'forbidden',
        httpStatus: 403,
        requiredScope: 'DeviceManagementConfiguration.Read.All',
      });
    }
  });

  it('liefert für CONTOSO-PC050 bitlockerKeys als forbidden mit Scope', async () => {
    const device = await loadDevice(provider, 'CONTOSO-PC050');
    const result = await provider.getBitLockerKeys(device);
    expect(result.status).toBe('forbidden');
    if (result.status === 'forbidden') {
      expect(result.error).toMatchObject({
        code: 'forbidden',
        requiredScope: 'BitlockerKey.ReadBasic.All',
      });
    }
  });

  it('liefert für CONTOSO-PC014 leere Recovery-Keys (status ok) und isEncrypted false', async () => {
    const device = await loadDevice(provider, 'CONTOSO-PC014');
    expect(device.isEncrypted).toBe(false);
    const result = await provider.getBitLockerKeys(device);
    expect(result).toMatchObject({ status: 'ok', data: [] });
  });

  it('enthält für CONTOSO-PC042 eine Richtlinie mit state conflict und einen Fehler mit errorCode -2016281112', async () => {
    const device = await loadDevice(provider, 'CONTOSO-PC042');
    const result = await provider.getConfigurationPolicyStates(device);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const policies = result.data;
    expect(policies.some((p) => p.state === 'conflict')).toBe(true);
    expect(policies.some((p) => p.state === 'error')).toBe(true);
    const errorSettings = policies.flatMap((p) => p.settings).filter((s) => s.state === 'error');
    expect(errorSettings).toEqual([
      expect.objectContaining({ errorCode: -2016281112, errorDescription: expect.any(String) }),
    ]);
  });

  it('liefert für CONTOSO-PC033 einen letzten Check-in genau 41 Tage vor NOW', async () => {
    const device = await loadDevice(provider, 'CONTOSO-PC033');
    expect(device.lastSyncDateTime).not.toBeNull();
    const lastSync = new Date(device.lastSyncDateTime ?? '').getTime();
    expect(NOW.getTime() - lastSync).toBe(41 * DAY);
    expect(device.complianceState).toBe('noncompliant');
  });

  it('setzt für CONTOSO-PC042 den Compliance-Status auf inGracePeriod', async () => {
    const device = await loadDevice(provider, 'CONTOSO-PC042');
    expect(device.complianceState).toBe('inGracePeriod');
    expect(device.complianceGracePeriodExpirationDateTime).not.toBeNull();
  });

  it('liefert bei ok-Sections den Zeitpunkt fetchedAt = NOW', async () => {
    const device = await loadDevice(provider, 'CONTOSO-PC001');
    const result = await provider.getProtectionState(device);
    expect(result).toMatchObject({ status: 'ok', fetchedAt: NOW.toISOString() });
  });
});

describe('MockProvider – Quellenangaben', () => {
  const provider = instantProvider();

  it.each(SCENARIO_NAMES)(
    '%s: jede Section-Antwort hat ein source.label, das mit "GET " beginnt',
    async (deviceName) => {
      const device = await loadDevice(provider, deviceName);
      const results: SectionResult<unknown>[] = await Promise.all([
        provider.getProtectionState(device),
        provider.getCompliancePolicyStates(device),
        provider.getConfigurationPolicyStates(device),
        provider.getEntraDevice(device),
        provider.getBitLockerKeys(device),
      ]);
      for (const result of results) {
        expect(result.source.label.startsWith('GET ')).toBe(true);
        expect(result.source.kind).toBe('mock');
      }
    },
  );
});

describe('MockProvider – Enum-Konformität', () => {
  const provider = instantProvider();

  it.each(SCENARIO_NAMES)('%s: Enum-Werte entsprechen den Graph-Enums', async (deviceName) => {
    const device = await loadDevice(provider, deviceName);
    expect(COMPLIANCE_STATES).toContain(device.complianceState);

    const [protection, compliance, configuration] = await Promise.all([
      provider.getProtectionState(device),
      provider.getCompliancePolicyStates(device),
      provider.getConfigurationPolicyStates(device),
    ]);

    if (protection.status === 'ok') {
      const data = protection.data;
      if (data.deviceState !== null) {
        expect(DEVICE_HEALTH_STATES).toContain(data.deviceState);
      }
      for (const flag of data.productStatus) {
        expect(PRODUCT_STATUS_VALUES.has(flag), `productStatus ${flag}`).toBe(true);
      }
      for (const malware of data.detectedMalware) {
        expect(MALWARE_SEVERITIES).toContain(malware.severity);
      }
    }

    for (const result of [compliance, configuration]) {
      if (result.status !== 'ok') continue;
      for (const policy of result.data) {
        expect(COMPLIANCE_STATUSES).toContain(policy.state);
        for (const setting of policy.settings) {
          expect(COMPLIANCE_STATUSES).toContain(setting.state);
        }
      }
    }
  });
});

describe('MockProvider – Latenz und Determinismus', () => {
  it('zwei Provider mit gleichem Seed liefern identische Ergebnisse', async () => {
    vi.useFakeTimers();
    const a = new MockProvider({ now: () => NOW, seed: 7 });
    const b = new MockProvider({ now: () => NOW, seed: 7 });

    const searchA = a.searchDevices('contoso-pc0');
    const searchB = b.searchDevices('contoso-pc0');
    await vi.runAllTimersAsync();
    expect(await searchA).toEqual(await searchB);

    const plain = instantProvider();
    const device = await loadDevice(plain, 'CONTOSO-PC042');
    const sectionA = a.getConfigurationPolicyStates(device);
    const sectionB = b.getConfigurationPolicyStates(device);
    await vi.runAllTimersAsync();
    expect(await sectionA).toEqual(await sectionB);
  });

  it('wartet im konfigurierten Latenzbereich und bei gleichem Seed gleich lang', async () => {
    vi.useFakeTimers();
    const settleTime = async (p: Promise<unknown>, maxMs: number): Promise<number> => {
      let settled = false;
      p.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      for (let ms = 1; ms <= maxMs; ms++) {
        await vi.advanceTimersByTimeAsync(1);
        if (settled) return ms;
      }
      return -1;
    };

    const latency = { min: 120, max: 600 };
    const a = new MockProvider({ now: () => NOW, seed: 99, latency });
    const b = new MockProvider({ now: () => NOW, seed: 99, latency });

    const timeA = await settleTime(a.searchDevices('contoso-pc001'), 700);
    const timeB = await settleTime(b.searchDevices('contoso-pc001'), 700);

    expect(timeA).toBeGreaterThanOrEqual(latency.min);
    expect(timeA).toBeLessThanOrEqual(latency.max);
    expect(timeB).toBe(timeA);
  });
});

describe('MockProvider – AbortSignal', () => {
  const slow = () => new MockProvider({ now: () => NOW, latency: { min: 50, max: 50 } });

  it('bricht searchDevices sofort ab, wenn das Signal direkt nach dem Aufruf abgebrochen wird', async () => {
    const controller = new AbortController();
    const promise = slow().searchDevices('contoso-pc001', { signal: controller.signal });
    controller.abort();
    const error = await promise.catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'AbortError' });
  });

  it('bricht searchDevices ab, wenn das Signal kurz nach dem Start abgebrochen wird', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let rejected: unknown = null;
    const promise = slow()
      .searchDevices('contoso-pc001', { signal: controller.signal })
      .catch((e: unknown) => {
        rejected = e;
      });
    await vi.advanceTimersByTimeAsync(10);
    controller.abort();
    await promise;
    expect(rejected).toMatchObject({ name: 'AbortError' });
  });

  it('bricht eine Section-Methode (getBitLockerKeys) bei Abbruch mit AbortError ab', async () => {
    const plain = instantProvider();
    const device = await loadDevice(plain, 'CONTOSO-PC001');
    vi.useFakeTimers();
    const controller = new AbortController();
    let rejected: unknown = null;
    const promise = slow()
      .getBitLockerKeys(device, { signal: controller.signal })
      .catch((e: unknown) => {
        rejected = e;
      });
    await vi.advanceTimersByTimeAsync(20);
    controller.abort();
    await promise;
    expect(rejected).toMatchObject({ name: 'AbortError' });
  });

  it('liefert AbortError für eine Section, wenn das Signal bereits abgebrochen ist', async () => {
    const plain = instantProvider();
    const device = await loadDevice(plain, 'CONTOSO-PC001');
    const controller = new AbortController();
    controller.abort();
    await expect(
      slow().getProtectionState(device, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('liefert AbortError bei bereits abgebrochenem Signal auch ohne Latenz', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      instantProvider().searchDevices('contoso-pc001', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
