/** M18: Dienststatus und Registrierungsfehler im GraphProvider (403/404/429, Paging, Filter). */
import { describe, expect, it, vi } from 'vitest';
import type { ManagedDeviceInfo, SectionResult } from '../../domain/types';
import type { SleepFn } from '../../graph/client';
import { Endpoints, MAX_TROUBLESHOOTING_EVENT_PAGES } from '../../graph/endpoints';
import { de } from '../../i18n/de';
import { createGraphProvider } from './GraphProvider';
import { collection, createFakeFetch, graphError, type FakeHandler } from './fakeGraph';

const HEALTH_PATH = '/v1.0/admin/serviceAnnouncement/healthOverviews';
const EVENTS_PATH = '/v1.0/deviceManagement/troubleshootingEvents';
const USER = '00000000-0000-4000-d000-000000000001';
const OTHER = '00000000-0000-4000-d000-000000000002';

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

const device = (userId: string | null) =>
  ({ id: 'dev-1', deviceName: 'CONTOSO-PC001', osFamily: 'windows', userId }) as ManagedDeviceInfo;

const healthDto = {
  id: 'Intune',
  service: 'Microsoft Intune',
  status: 'ServiceDegradation',
  issues: [
    {
      id: 'IT1',
      title: 'Enrollment issue',
      classification: 'Incident',
      status: 'ServiceDegradation',
      isResolved: false,
      startDateTime: '2026-11-10T09:00:00Z',
      lastModifiedDateTime: '2026-11-10T11:00:00Z',
      impactDescription: 'Users may be unable to enroll.',
      posts: [{ description: { content: 'nie gelesen' } }],
    },
    {
      id: 'IT0',
      title: 'Old',
      classification: 'Advisory',
      status: 'ServiceRestored',
      isResolved: true,
    },
  ],
};

const event = (
  n: number,
  userId: string,
  hoursAgo: number,
  extra: Record<string, unknown> = {},
) => ({
  '@odata.type': '#microsoft.graph.enrollmentTroubleshootingEvent',
  id: `e${n}`,
  eventDateTime: new Date(Date.parse('2026-11-10T12:00:00Z') - hoursAgo * 3_600_000).toISOString(),
  correlationId: `c${n}`,
  operatingSystem: 'Windows',
  osVersion: '10.0.26100',
  userId,
  enrollmentType: 'windowsAzureADJoin',
  failureCategory: 'authentication',
  failureReason: 'AuthenticationRequirementNotMet',
  managedDeviceIdentifier: 'nie gelesen',
  ...extra,
});

describe('GraphProvider – Dienststatus (M18)', () => {
  it('liest healthOverviews mit $expand=issues per GET; nur offene Einträge, Enum unabhängig von der Schreibweise', async () => {
    const { provider, calls } = setup(() => collection([healthDto]));
    const result = expectStatus(await provider.getServiceHealth(), 'ok');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('GET');
    expect(calls[0]!.parsed.pathname).toBe(HEALTH_PATH);
    expect(calls[0]!.parsed.searchParams.get('$expand')).toBe('issues');
    const [intune] = result.data.services;
    expect(intune).toMatchObject({
      kind: 'intune',
      status: 'serviceDegradation',
      resolvedCount: 1,
    });
    expect(intune!.openIssues.map((i) => [i.id, i.classification, i.status])).toEqual([
      ['IT1', 'incident', 'serviceDegradation'],
    ]);
    expect(JSON.stringify(result.data)).not.toContain('nie gelesen');
    expect(result.source.label).toBe(Endpoints.serviceHealthOverviews.display);
  });

  it('403 → forbidden mit ServiceHealth.Read.All', async () => {
    const { provider } = setup(() => graphError(403, 'Forbidden'));
    const result = expectStatus(await provider.getServiceHealth(), 'forbidden');
    expect(result.error).toMatchObject({
      requiredScope: 'ServiceHealth.Read.All',
      httpStatus: 403,
    });
  });

  it('404 → unavailable (kein Abbruch)', async () => {
    const { provider } = setup(() => graphError(404, 'NotFound'));
    const result = expectStatus(await provider.getServiceHealth(), 'unavailable');
    expect(result.reason).toBe(de.service.reasons.serviceHealthNotReported);
  });

  it('429 mit Retry-After wartet und wiederholt', async () => {
    let n = 0;
    const { provider, sleep, calls } = setup(() =>
      ++n === 1 ? graphError(429, 'TooManyRequests', { 'Retry-After': '3' }) : collection([]),
    );
    expectStatus(await provider.getServiceHealth(), 'ok');
    expect(sleep).toHaveBeenCalledWith(3000, undefined);
    expect(calls).toHaveLength(2);
  });

  it('getTenantStatus: ein Fehler des Dienststatus betrifft nur seine Section', async () => {
    const { provider } = setup((call) =>
      call.parsed.pathname === HEALTH_PATH ? graphError(403, 'Forbidden') : collection([]),
    );
    const status = await provider.getTenantStatus();
    expect(status.serviceHealth.status).toBe('forbidden');
    expect(status.enrollmentFailures.status).toBe('ok');
  });
});

describe('GraphProvider – Registrierungsfehler (M18)', () => {
  it('Mandant: liest höchstens MAX_TROUBLESHOOTING_EVENT_PAGES Seiten, sortiert neueste zuerst, nur Registrierungsfehler', async () => {
    let page = 0;
    const { provider, calls } = setup((call) => {
      if (call.parsed.pathname !== EVENTS_PATH) return collection([]);
      page += 1;
      return collection(
        [
          event(page * 10, USER, page),
          {
            '@odata.type': '#microsoft.graph.deviceManagementTroubleshootingEvent',
            id: `b${page}`,
          },
        ],
        `https://graph.microsoft.com/v1.0/deviceManagement/troubleshootingEvents?$skiptoken=${page}`,
      );
    });
    const status = await provider.getTenantStatus();
    const result = expectStatus(status.enrollmentFailures, 'ok');
    const eventCalls = calls.filter((c) => c.parsed.pathname === EVENTS_PATH);
    expect(eventCalls).toHaveLength(MAX_TROUBLESHOOTING_EVENT_PAGES);
    expect(eventCalls.every((c) => c.method === 'GET')).toBe(true);
    expect(eventCalls[0]!.parsed.search).toBe('');
    expect(result.data.truncated).toBe(true);
    expect(result.data.pagesRead).toBe(MAX_TROUBLESHOOTING_EVENT_PAGES);
    expect(result.data.events.map((e) => e.id)).toEqual(['e10', 'e20', 'e30']);
    expect(result.data.filteredUserId).toBeNull();
    expect(JSON.stringify(result.data)).not.toContain('nie gelesen');
  });

  it('Gerät: filtert clientseitig auf die userId des primären Benutzers', async () => {
    const { provider } = setup(() =>
      collection([event(1, USER, 2), event(2, OTHER, 1), event(3, USER.toUpperCase(), 5)]),
    );
    const result = expectStatus(await provider.getEnrollmentFailures(device(USER)), 'ok');
    expect(result.data.events.map((e) => e.id)).toEqual(['e1', 'e3']);
    expect(result.data.truncated).toBe(false);
    expect(result.data.filteredUserId).toBe(USER);
  });

  it('Gerät ohne primären Benutzer → notApplicable ohne Aufruf', async () => {
    const { provider, calls } = setup(() => collection([]));
    const result = expectStatus(
      await provider.getEnrollmentFailures(device(null)),
      'notApplicable',
    );
    expect(result.reason).toBe(de.service.reasons.enrollmentFailuresNoUser);
    expect(calls).toHaveLength(0);
  });

  it('403 → forbidden mit DeviceManagementManagedDevices.Read.All; 404 → unavailable', async () => {
    const forbidden = setup(() => graphError(403, 'Forbidden')).provider;
    const f = expectStatus(await forbidden.getEnrollmentFailures(device(USER)), 'forbidden');
    expect(f.error.requiredScope).toBe('DeviceManagementManagedDevices.Read.All');
    const missing = setup(() => graphError(404, 'NotFound')).provider;
    const u = expectStatus(await missing.getEnrollmentFailures(device(USER)), 'unavailable');
    expect(u.reason).toBe(de.service.reasons.troubleshootingNotReported);
  });

  it('429 mit Retry-After wartet und wiederholt', async () => {
    let n = 0;
    const { provider, sleep } = setup(() =>
      ++n === 1 ? graphError(429, 'TooManyRequests', { 'Retry-After': '1' }) : collection([]),
    );
    expectStatus(await provider.getEnrollmentFailures(device(USER)), 'ok');
    expect(sleep).toHaveBeenCalledWith(1000, undefined);
  });
});
