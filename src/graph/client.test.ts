import { describe, expect, it, vi } from 'vitest';
import {
  collection,
  createFakeFetch,
  graphError,
  jsonResponse,
} from '../providers/graph/fakeGraph';
import { createGraphClient, GraphRequestError, MAX_ATTEMPTS, type SleepFn } from './client';

function setup(handler: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(handler);
  const sleep = vi.fn<SleepFn>(async () => undefined);
  const getToken = vi.fn(async () => 'token-123');
  const client = createGraphClient({ getToken, fetchImpl: fake.fetchImpl, sleep });
  return { ...fake, sleep, getToken, client };
}

async function expectError(promise: Promise<unknown>): Promise<GraphRequestError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(GraphRequestError);
    return error as GraphRequestError;
  }
  throw new Error('Fehler erwartet');
}

describe('createGraphClient', () => {
  it('bietet ausschließlich lesende Methoden', () => {
    const { client } = setup(() => jsonResponse({}));
    expect(Object.keys(client).sort()).toEqual(['get', 'getAllPages']);
  });

  it('sendet GET mit Bearer-Token, client-request-id und Accept auf die v1.0-Basis-URL', async () => {
    const { client, calls } = setup(() => jsonResponse({ ok: true }));
    await expect(client.get('/deviceManagement/managedDevices/abc')).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.method).toBe('GET');
    expect(call?.url).toBe('https://graph.microsoft.com/v1.0/deviceManagement/managedDevices/abc');
    expect(call?.headers['authorization']).toBe('Bearer token-123');
    expect(call?.headers['accept']).toBe('application/json');
    expect(call?.headers['client-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('akzeptiert nextLink nur auf https://graph.microsoft.com/', async () => {
    const { client, calls } = setup(() => jsonResponse({}));
    for (const bad of [
      'https://evil.example.com/v1.0/x',
      'http://graph.microsoft.com/v1.0/x',
      'https://graph.microsoft.com.evil.example.com/v1.0/x',
      'https://graph.microsoft.com@evil.example.com/v1.0/x',
      'relative/path',
    ]) {
      const error = await expectError(client.get(bad));
      expect(error.error.code).toBe('graph');
    }
    expect(calls).toHaveLength(0);
    await client.get('https://graph.microsoft.com/v1.0/devices?$skiptoken=abc');
    expect(calls).toHaveLength(1);
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'notFound'],
    [400, 'graph'],
    [500, 'graph'],
  ] as const)('mappt HTTP %i auf %s ohne Wiederholung', async (status, code) => {
    const { client, calls, sleep } = setup(() => graphError(status, 'Some_Code'));
    const error = await expectError(client.get('/x'));
    expect(error.error).toMatchObject({
      code,
      httpStatus: status,
      graphCode: 'Some_Code',
      requestId: 'req-1234',
    });
    expect(error.message).toBe(error.error.message);
    expect(calls).toHaveLength(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('setzt bei 403 requiredScope, falls ein Scope übergeben wurde', async () => {
    const { client } = setup(() => graphError(403, 'Authorization_RequestDenied'));
    const withScope = await expectError(client.get('/x', { scope: 'Device.Read.All' }));
    expect(withScope.error.requiredScope).toBe('Device.Read.All');
    const without = await expectError(client.get('/x'));
    expect(without.error.requiredScope).toBeUndefined();
  });

  it('übernimmt die request-id aus dem Header, wenn der Body keine liefert', async () => {
    const { client } = setup(() =>
      jsonResponse({ nope: true }, { status: 404, headers: { 'request-id': 'hdr-1' } }),
    );
    const error = await expectError(client.get('/x'));
    expect(error.error.requestId).toBe('hdr-1');
  });

  it('respektiert Retry-After: 2 bei 429 (wartet 2 s) und wiederholt', async () => {
    let n = 0;
    const { client, sleep, calls } = setup(() =>
      ++n === 1
        ? graphError(429, 'TooManyRequests', { 'Retry-After': '2' })
        : jsonResponse({ ok: 1 }),
    );
    await expect(client.get('/x')).resolves.toEqual({ ok: 1 });
    expect(calls).toHaveLength(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(2000, undefined);
  });

  it('nutzt bei 503 ohne Retry-After exponentiellen Backoff (1 s, 2 s) und gibt nach 3 Versuchen throttled zurück', async () => {
    const { client, sleep, calls } = setup(() => graphError(503, 'ServiceNotAvailable'));
    const error = await expectError(client.get('/x'));
    expect(calls).toHaveLength(MAX_ATTEMPTS);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
    expect(error.error).toMatchObject({ code: 'throttled', httpStatus: 503 });
  });

  it('meldet retryAfterSeconds im throttled-Fehler und wartet nicht bei zu langem Retry-After', async () => {
    const { client, sleep, calls } = setup(() =>
      graphError(429, 'TooManyRequests', { 'Retry-After': '120' }),
    );
    const error = await expectError(client.get('/x'));
    expect(error.error).toMatchObject({ code: 'throttled', retryAfterSeconds: 120 });
    expect(calls).toHaveLength(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('wiederholt Netzwerkfehler und meldet danach network', async () => {
    const calls: number[] = [];
    const sleep = vi.fn<SleepFn>(async () => undefined);
    const client = createGraphClient({
      getToken: async () => 't',
      sleep,
      fetchImpl: (async () => {
        calls.push(1);
        throw new TypeError('Failed to fetch');
      }) as typeof fetch,
    });
    const error = await expectError(client.get('/x'));
    expect(error.error.code).toBe('network');
    expect(calls).toHaveLength(MAX_ATTEMPTS);
    expect(sleep).toHaveBeenCalledTimes(MAX_ATTEMPTS - 1);
  });

  it('reicht Abort als AbortError durch und wiederholt nicht', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      controller.abort();
      throw new DOMException('aborted', 'AbortError');
    }) as unknown as typeof fetch;
    const client = createGraphClient({ getToken: async () => 't', fetchImpl });
    await expect(client.get('/x', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('wandelt Fehler beim Token-Abruf in unauthenticated um', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const client = createGraphClient({
      getToken: async () => {
        throw new Error('boom');
      },
      fetchImpl,
    });
    const error = await expectError(client.get('/x'));
    expect(error.error.code).toBe('unauthenticated');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('meldet parse bei ungültigem JSON', async () => {
    const { client } = setup(() => new Response('<html>', { status: 200 }));
    const error = await expectError(client.get('/x'));
    expect(error.error.code).toBe('parse');
  });
});

describe('getAllPages', () => {
  const next = (n: number) => `https://graph.microsoft.com/v1.0/things?$skiptoken=${n}`;

  it('folgt @odata.nextLink und sammelt alle Werte', async () => {
    const { client, calls } = setup((call) => {
      const token = call.parsed.searchParams.get('$skiptoken');
      if (!token) return collection([1, 2], next(2));
      if (token === '2') return collection([3], next(3));
      return collection([4]);
    });
    await expect(client.getAllPages<number>('/things')).resolves.toEqual([1, 2, 3, 4]);
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('bricht nach maxPages ab (Standard 5)', async () => {
    const { client, calls } = setup(() => collection([1], next(1)));
    await expect(client.getAllPages<number>('/things')).resolves.toHaveLength(5);
    expect(calls).toHaveLength(5);
    await expect(client.getAllPages<number>('/things', { maxPages: 2 })).resolves.toHaveLength(2);
    expect(calls).toHaveLength(7);
  });

  it('lehnt einen nextLink auf fremden Host ab, ohne ihn abzurufen', async () => {
    const { client, calls } = setup(() => collection([1], 'https://evil.example.com/v1.0/things'));
    const error = await expectError(client.getAllPages<number>('/things'));
    expect(error.error.code).toBe('graph');
    expect(calls).toHaveLength(1);
    expect(calls.every((c) => c.parsed.host === 'graph.microsoft.com')).toBe(true);
  });
});
