/** M22/S1: Flottenliste im GraphProvider (Seiten, Seitenlimit, 403, 429, Abbruch, nur GET + $select). */
import { describe, expect, it, vi } from 'vitest';
import type { SleepFn } from '../../graph/client';
import { FLEET_DEVICE_SELECT } from '../../graph/dto';
import { MAX_FLEET_PAGES } from '../../graph/endpoints';
import { createGraphProvider } from './GraphProvider';
import {
  collection,
  createFakeFetch,
  graphError,
  type FakeCall,
  type FakeHandler,
} from './fakeGraph';

const LIST_PATH = '/v1.0/deviceManagement/managedDevices';
const nextUrl = (n: number) =>
  `https://graph.microsoft.com${LIST_PATH}?$select=id&$skiptoken=page${n}`;

const device = (n: number) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  deviceName: `CONTOSO-PC${String(n).padStart(3, '0')}`,
  userPrincipalName: `user${n}@contoso.com`,
  operatingSystem: 'Windows',
  osVersion: '10.0.26100.1',
  complianceState: 'compliant',
  lastSyncDateTime: '2026-11-24T08:00:00Z',
  enrolledDateTime: '2026-01-10T08:00:00Z',
  isEncrypted: true,
  jailBroken: 'False',
});

function setup(handler: FakeHandler) {
  const fake = createFakeFetch(handler);
  const sleep = vi.fn<SleepFn>(async () => undefined);
  const provider = createGraphProvider(async () => 'token', {
    fetchImpl: fake.fetchImpl,
    sleep,
    log: vi.fn(),
    now: () => new Date('2026-11-25T12:00:00Z'),
  });
  return { ...fake, sleep, provider };
}

/** Liefert Seite n (1-basiert); `pages` Seiten insgesamt, jede mit zwei Geräten. */
const paged =
  (pages: number): FakeHandler =>
  (call: FakeCall) => {
    const token = call.parsed.searchParams.get('$skiptoken');
    const page = token ? Number(token.replace('page', '')) : 1;
    const items = [device(page * 2 - 1), device(page * 2)];
    return collection(items, page < pages ? nextUrl(page + 1) : undefined);
  };

describe('GraphProvider.getFleetDevices', () => {
  it('liest mehrere Seiten, nur GET, erste URL mit genau den $select-Feldern', async () => {
    const { provider, calls } = setup(paged(3));
    const result = await provider.getFleetDevices();
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.devices).toHaveLength(6);
    expect(result.data.pagesRead).toBe(3);
    expect(result.data.truncated).toBe(false);
    expect(result.data.devices[0]).toMatchObject({
      deviceName: 'CONTOSO-PC001',
      isEncrypted: true,
      jailBroken: 'False',
    });
    expect(calls.every((c) => (c.method ?? 'GET') === 'GET')).toBe(true);
    const first = calls[0]!.parsed;
    expect(first.pathname).toBe(LIST_PATH);
    expect([...first.searchParams.keys()]).toEqual(['$select']);
    expect(first.searchParams.get('$select')).toBe(FLEET_DEVICE_SELECT.join(','));
  });

  it('setzt truncated beim Seitenlimit', async () => {
    const { provider, calls } = setup(paged(MAX_FLEET_PAGES + 5));
    const result = await provider.getFleetDevices();
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.pagesRead).toBe(MAX_FLEET_PAGES);
    expect(result.data.truncated).toBe(true);
    expect(result.data.devices).toHaveLength(MAX_FLEET_PAGES * 2);
    expect(calls).toHaveLength(MAX_FLEET_PAGES);
  });

  it('nicht abgeschnitten, wenn die letzte erlaubte Seite keinen nextLink hat', async () => {
    const { provider } = setup(paged(MAX_FLEET_PAGES));
    const result = await provider.getFleetDevices();
    expect(result.status === 'ok' && result.data.truncated).toBe(false);
  });

  it('leere Liste → ok mit 0 Geräten', async () => {
    const { provider } = setup(() => collection([]));
    const result = await provider.getFleetDevices();
    expect(result.status).toBe('ok');
    if (result.status === 'ok')
      expect(result.data).toMatchObject({ devices: [], truncated: false });
  });

  it('403 → forbidden mit requiredScope', async () => {
    const { provider } = setup(() => graphError(403, 'Forbidden'));
    const result = await provider.getFleetDevices();
    expect(result.status).toBe('forbidden');
    if (result.status === 'forbidden') {
      expect(result.error.requiredScope).toBe('DeviceManagementManagedDevices.Read.All');
    }
  });

  it('429 respektiert Retry-After', async () => {
    let hit = false;
    const { provider, sleep } = setup((call) => {
      if (!hit) {
        hit = true;
        return graphError(429, 'TooManyRequests', { 'Retry-After': '4' });
      }
      return paged(1)(call);
    });
    const result = await provider.getFleetDevices();
    expect(result.status).toBe('ok');
    expect(sleep).toHaveBeenCalledWith(4000, undefined);
  });

  it('nextLink auf fremden Host → error, kein Abruf', async () => {
    const { provider, calls } = setup(() =>
      collection([device(1)], 'https://evil.example.com/v1.0/deviceManagement/managedDevices'),
    );
    const result = await provider.getFleetDevices();
    expect(result.status).toBe('error');
    expect(calls).toHaveLength(1);
  });

  it('Abbruch per signal wirft', async () => {
    const controller = new AbortController();
    const { provider } = setup(() => {
      controller.abort();
      throw new DOMException('aborted', 'AbortError');
    });
    await expect(provider.getFleetDevices({ signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
