/** M20/S1: Compliance-Übersicht im GraphProvider (403/404/429, Paging, nur GET). */
import { describe, expect, it, vi } from 'vitest';
import type { SectionResult } from '../../domain/types';
import type { SleepFn } from '../../graph/client';
import { MAX_SETTING_SUMMARY_PAGES } from '../../graph/endpoints';
import { createGraphProvider } from './GraphProvider';
import {
  collection,
  createFakeFetch,
  graphError,
  jsonResponse,
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
