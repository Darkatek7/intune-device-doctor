/** M20/S1: Compliance-Übersicht im GraphProvider (403/404/429, Paging, nur GET). */
import { describe, expect, it, vi } from 'vitest';
import type { SectionResult } from '../../domain/types';
import type { SleepFn } from '../../graph/client';
import { de } from '../../i18n/de';
import { mapManagedDevice } from '../../graph/mappers';
import {
  MAX_APP_REGISTRATION_PAGES,
  MAX_AUDIT_EVENT_PAGES,
  MAX_SETTING_SUMMARY_PAGES,
} from '../../graph/endpoints';
import { createGraphProvider } from './GraphProvider';
import {
  collection,
  createFakeFetch,
  graphError,
  jsonResponse,
  pc001Device,
  PC001_USER_ID,
  type FakeHandler,
} from './fakeGraph';

const SUMMARY = '/v1.0/deviceManagement/deviceCompliancePolicyDeviceStateSummary';
const SETTINGS = '/v1.0/deviceManagement/deviceCompliancePolicySettingStateSummaries';
const CONFIG = '/v1.0/deviceManagement/deviceConfigurationDeviceStateSummaries';

function setup(handler: FakeHandler) {
  const fake = createFakeFetch(handler);
  const sleep = vi.fn<SleepFn>(async () => undefined);
  const provider = createGraphProvider(async () => 'token', {
    fetchImpl: fake.fetchImpl,
    sleep,
    log: vi.fn(),
    now: () => new Date('2026-11-10T12:00:00Z'),
  });
  return { ...fake, sleep, provider };
}

function expectStatus<T, S extends SectionResult<T>['status']>(
  result: SectionResult<T>,
  status: S,
): Extract<SectionResult<T>, { status: S }> {
  expect(result.status).toBe(status);
  return result as Extract<SectionResult<T>, { status: S }>;
}

const summaryBody = {
  id: 's',
  compliantDeviceCount: 4,
  nonCompliantDeviceCount: 7,
  errorDeviceCount: 0,
};
const settingDto = (n: number) => ({
  id: `st${n}`,
  settingName: `s${n}`,
  platformType: 'iOS',
  nonCompliantDeviceCount: n,
});

describe('GraphProvider – Compliance-Übersicht (M20/S1)', () => {
  it('liest die drei Endpunkte ausschließlich per GET; Doku-Form (`value`) und flache Form werden gelesen', async () => {
    const { provider, calls } = setup((call) => {
      const path = call.parsed.pathname;
      if (path === SUMMARY) return jsonResponse({ value: summaryBody });
      if (path === CONFIG) return jsonResponse(summaryBody);
      if (path === SETTINGS) return collection([settingDto(1), settingDto(5)]);
      return graphError(404, 'NotFound');
    });
    const status = await provider.getTenantStatus();
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
    const compliance = expectStatus(status.complianceSummary, 'ok');
    expect(compliance.data.counts.nonCompliantDeviceCount).toBe(7);
    expectStatus(status.configurationSummary, 'ok');
    const settings = expectStatus(status.complianceSettings, 'ok');
    expect(settings.data.settings.map((s) => s.id)).toEqual(['st5', 'st1']);
    expect(settings.data.truncated).toBe(false);
  });

  it('Einstellungen: höchstens MAX_SETTING_SUMMARY_PAGES Seiten, danach truncated', async () => {
    let page = 0;
    const { provider, calls } = setup((call) => {
      if (call.parsed.pathname !== SETTINGS) return jsonResponse(summaryBody);
      page += 1;
      return collection(
        [settingDto(page)],
        `https://graph.microsoft.com${SETTINGS}?$skiptoken=${page}`,
      );
    });
    const status = await provider.getTenantStatus();
    const settings = expectStatus(status.complianceSettings, 'ok');
    expect(settings.data.pagesRead).toBe(MAX_SETTING_SUMMARY_PAGES);
    expect(settings.data.truncated).toBe(true);
    expect(calls.filter((c) => c.parsed.pathname === SETTINGS)).toHaveLength(
      MAX_SETTING_SUMMARY_PAGES,
    );
  });

  it('403 → forbidden mit DeviceManagementConfiguration.Read.All, ohne die anderen Bereiche zu stören', async () => {
    const { provider } = setup((call) =>
      call.parsed.pathname === SUMMARY ? graphError(403, 'Forbidden') : jsonResponse(summaryBody),
    );
    const status = await provider.getTenantStatus();
    const result = expectStatus(status.complianceSummary, 'forbidden');
    expect(result.error).toMatchObject({
      requiredScope: 'DeviceManagementConfiguration.Read.All',
      httpStatus: 403,
    });
    expectStatus(status.configurationSummary, 'ok');
  });

  it('404 → unavailable (kein Abbruch)', async () => {
    const { provider } = setup(() => graphError(404, 'NotFound'));
    const status = await provider.getTenantStatus();
    expectStatus(status.complianceSummary, 'unavailable');
    expectStatus(status.complianceSettings, 'unavailable');
    expectStatus(status.configurationSummary, 'unavailable');
  });

  it('429 mit Retry-After wartet und wiederholt', async () => {
    let first = true;
    const { provider, sleep } = setup((call) => {
      if (call.parsed.pathname === SUMMARY && first) {
        first = false;
        return graphError(429, 'TooManyRequests', { 'Retry-After': '4' });
      }
      return call.parsed.pathname === SETTINGS ? collection([]) : jsonResponse(summaryBody);
    });
    const status = await provider.getTenantStatus();
    expectStatus(status.complianceSummary, 'ok');
    expect(sleep).toHaveBeenCalledWith(4000, undefined);
  });
});

describe('GraphProvider – Änderungsprotokoll (M20/S2)', () => {
  const AUDIT_PATH = '/v1.0/deviceManagement/auditEvents';
  const audit = (id: string) => ({
    id,
    activity: 'Patch DeviceConfiguration',
    activityDateTime: '2026-11-09T10:00:00Z',
    actor: { userPrincipalName: 'admin@contoso.com', ipAddress: '203.0.113.7' },
    resources: [],
  });

  it('nur GET ohne Query-Optionen, seitenbegrenzt; IP-Adresse verlässt den Provider nie', async () => {
    let page = 0;
    const { provider, calls } = setup((call) => {
      if (call.parsed.pathname === AUDIT_PATH || call.parsed.pathname.endsWith('/auditNext')) {
        page += 1;
        return collection([audit(`a${page}`)], 'https://graph.microsoft.com/v1.0/auditNext');
      }
      return graphError(404, 'NotFound');
    });
    const result = expectStatus(await provider.getAuditEvents(), 'ok');
    expect(calls[0]!.method).toBe('GET');
    expect(calls[0]!.parsed.search).toBe('');
    expect(result.data.pagesRead).toBe(MAX_AUDIT_EVENT_PAGES);
    expect(result.data.truncated).toBe(true);
    expect(JSON.stringify(result)).not.toContain('203.0.113.7');
  });

  it('403 → forbidden mit optionalem Scope; 404 → nicht verfügbar; 429 → Retry-After', async () => {
    const forbidden = setup(() => graphError(403, 'Forbidden'));
    const denied = expectStatus(await forbidden.provider.getAuditEvents(), 'forbidden');
    expect(denied.error.requiredScope).toBe('DeviceManagementApps.Read.All');

    const missing = setup(() => graphError(404, 'NotFound'));
    const gone = expectStatus(await missing.provider.getAuditEvents(), 'unavailable');
    expect(gone.reason).toBe(de.fleet.reasons.auditNotReported);

    let n = 0;
    const throttled = setup(() =>
      ++n === 1 ? graphError(429, 'TooManyRequests', { 'Retry-After': '4' }) : collection([]),
    );
    expectStatus(await throttled.provider.getAuditEvents(), 'ok');
    expect(throttled.sleep).toHaveBeenCalledWith(4000, undefined);
  });

  it('getTenantStatus: fehlende Berechtigung für das Protokoll betrifft nur seine Section', async () => {
    const { provider } = setup((call) =>
      call.parsed.pathname === AUDIT_PATH ? graphError(403, 'Forbidden') : collection([]),
    );
    const status = await provider.getTenantStatus();
    expect(status.auditEvents.status).toBe('forbidden');
    expect(status.enrollmentFailures.status).toBe('ok');
  });
});

describe('GraphProvider – App-Schutz (M20/S3)', () => {
  const MAM_PATH = '/v1.0/deviceAppManagement/managedAppRegistrations';
  const android = mapManagedDevice(
    pc001Device({ deviceName: 'CONTOSO-AND21', operatingSystem: 'Android', osVersion: '15' }),
  );
  const windows = mapManagedDevice(pc001Device());

  it('Windows → notApplicable (Windows-MAM nur beta) ohne Abruf; ohne Benutzer → notApplicable', async () => {
    const { provider, calls } = setup(() => collection([]));
    const win = expectStatus(await provider.getAppProtection(windows), 'notApplicable');
    expect(win.reason).toBe(de.fleet.reasons.appProtectionPlatform);
    const noUser = expectStatus(
      await provider.getAppProtection({ ...android, userId: null }),
      'notApplicable',
    );
    expect(noUser.reason).toBe(de.fleet.reasons.appProtectionNoUser);
    expect(calls).toHaveLength(0);
  });

  it('nur GET ohne Query-Optionen, seitenbegrenzt, Benutzer und Gerät clientseitig', async () => {
    let page = 0;
    const { provider, calls } = setup((call) => {
      if (call.parsed.pathname === MAM_PATH || call.parsed.pathname.endsWith('/mamNext')) {
        page += 1;
        return collection(
          [{ id: `r${page}`, userId: PC001_USER_ID, deviceName: 'CONTOSO-AND21' }],
          'https://graph.microsoft.com/v1.0/mamNext',
        );
      }
      return graphError(404, 'NotFound');
    });
    const result = expectStatus(await provider.getAppProtection(android), 'ok');
    expect(new Set(calls.map((c) => c.method))).toEqual(new Set(['GET']));
    expect(calls[0]!.parsed.search).toBe('');
    expect(result.data).toMatchObject({
      pagesRead: MAX_APP_REGISTRATION_PAGES,
      truncated: true,
      matchedBy: 'deviceName',
    });
    expect(result.data.registrations).toHaveLength(MAX_APP_REGISTRATION_PAGES);
  });

  it('403 → forbidden mit optionalem Scope; 404 → nicht verfügbar; 429 → Retry-After', async () => {
    const forbidden = setup(() => graphError(403, 'Forbidden'));
    const denied = expectStatus(await forbidden.provider.getAppProtection(android), 'forbidden');
    expect(denied.error.requiredScope).toBe('DeviceManagementApps.Read.All');

    const missing = setup(() => graphError(404, 'NotFound'));
    const gone = expectStatus(await missing.provider.getAppProtection(android), 'unavailable');
    expect(gone.reason).toBe(de.fleet.reasons.appProtectionNotReported);

    let n = 0;
    const throttled = setup(() =>
      ++n === 1 ? graphError(429, 'TooManyRequests', { 'Retry-After': '3' }) : collection([]),
    );
    expectStatus(await throttled.provider.getAppProtection(android), 'ok');
    expect(throttled.sleep).toHaveBeenCalledWith(3000, undefined);
  });
});

describe('GraphProvider – Remote-Aktionen (M20/S4)', () => {
  it('liest deviceActionResults aus dem bestehenden managedDevice-GET (kein zusätzlicher Abruf)', async () => {
    const { provider, calls } = setup((call) =>
      call.parsed.pathname.startsWith('/v1.0/deviceManagement/managedDevices/')
        ? jsonResponse(
            pc001Device({
              deviceActionResults: [
                {
                  actionName: 'rebootNow',
                  actionState: 'failed',
                  startDateTime: '2026-11-08T09:00:00Z',
                  lastUpdatedDateTime: '2026-11-08T10:00:00Z',
                },
              ],
            }),
          )
        : graphError(404, 'NotFound'),
    );
    const device = await provider.getDevice('00000000-0000-4000-8000-000000000001');
    expect(device.actionResults).toEqual([
      {
        actionName: 'rebootNow',
        actionState: 'failed',
        actionStateRaw: 'failed',
        startDateTime: '2026-11-08T09:00:00Z',
        lastUpdatedDateTime: '2026-11-08T10:00:00Z',
      },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('GET');
    expect(calls[0]!.parsed.search).toBe('');
  });
});
