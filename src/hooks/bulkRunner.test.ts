import { describe, expect, it } from 'vitest';
import type { DeviceSearchResult } from '../domain/types';
import { ProviderError, type DeviceDataProvider } from '../providers/DeviceDataProvider';
import type { BulkRow } from '../rules/bulkCheck';
import { runBulkCheck } from './bulkRunner';

const result = (name: string): DeviceSearchResult => ({
  id: name,
  deviceName: name,
  userPrincipalName: null,
  userDisplayName: null,
  operatingSystem: 'Windows',
  osVersion: null,
  model: null,
  serialNumber: null,
  complianceState: 'compliant',
  lastSyncDateTime: null,
});

function fakeProvider(
  handler: (query: string, call: number) => Promise<DeviceSearchResult[]>,
): DeviceDataProvider & { calls: string[]; maxParallel: number } {
  let running = 0;
  const state = { calls: [] as string[], maxParallel: 0 };
  const provider = {
    mode: 'demo',
    calls: state.calls,
    get maxParallel() {
      return state.maxParallel;
    },
    async searchDevices(query: string) {
      state.calls.push(query);
      running += 1;
      state.maxParallel = Math.max(state.maxParallel, running);
      try {
        return await handler(query, state.calls.length);
      } finally {
        running -= 1;
      }
    },
  };
  return provider as unknown as DeviceDataProvider & { calls: string[]; maxParallel: number };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const noSleep = () => Promise.resolve();

function collect() {
  const rows = new Map<number, BulkRow>();
  return { rows, onRow: (i: number, row: BulkRow) => void rows.set(i, row) };
}

describe('runBulkCheck', () => {
  it('stellt pro Name genau eine Anfrage, höchstens 2 parallel', async () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F'];
    const provider = fakeProvider(async (q) => {
      await tick();
      return [result(q)];
    });
    const { rows, onRow } = collect();
    await runBulkCheck({ names, provider, signal: new AbortController().signal, onRow });
    expect(provider.calls.sort()).toEqual(names);
    expect(provider.maxParallel).toBe(2);
    expect([...rows.values()].every((r) => r.status === 'done' && r.matchCount === 1)).toBe(true);
  });

  it('wartet bei 429 die Retry-After-Zeit ab und versucht es erneut', async () => {
    let attempts = 0;
    const provider = fakeProvider(async (q) => {
      attempts += 1;
      if (attempts === 1) {
        throw new ProviderError({ code: 'throttled', message: 'zu viele', retryAfterSeconds: 7 });
      }
      return [result(q)];
    });
    let clock = 0;
    const sleeps: number[] = [];
    const { rows, onRow } = collect();
    await runBulkCheck({
      names: ['A'],
      provider,
      signal: new AbortController().signal,
      onRow,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    });
    expect(provider.calls).toEqual(['A', 'A']);
    expect(sleeps.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(7000);
    expect(rows.get(0)).toMatchObject({ status: 'done', matchCount: 1 });
  });

  it('meldet andere Fehler als Zeilenfehler, ohne die übrigen Namen zu stoppen', async () => {
    const provider = fakeProvider(async (q) => {
      if (q === 'B') throw new ProviderError({ code: 'forbidden', message: 'kein Zugriff' });
      return [];
    });
    const { rows, onRow } = collect();
    await runBulkCheck({
      names: ['A', 'B', 'C'],
      provider,
      signal: new AbortController().signal,
      onRow,
      sleep: noSleep,
    });
    expect(rows.get(1)).toMatchObject({ status: 'error', errorMessage: 'kein Zugriff' });
    expect(rows.get(0)?.status).toBe('done');
    expect(rows.get(2)?.status).toBe('done');
  });

  it('gibt nach 3 Wiederholungen bei Dauerdrosselung auf', async () => {
    const provider = fakeProvider(async () => {
      throw new ProviderError({ code: 'throttled', message: 'gedrosselt', retryAfterSeconds: 1 });
    });
    let clock = 0;
    const { rows, onRow } = collect();
    await runBulkCheck({
      names: ['A'],
      provider,
      signal: new AbortController().signal,
      onRow,
      now: () => clock,
      sleep: async (ms) => void (clock += ms),
    });
    expect(provider.calls).toHaveLength(4);
    expect(rows.get(0)?.status).toBe('error');
  });

  it('stoppt nach Abbruch: keine weiteren Anfragen', async () => {
    const controller = new AbortController();
    const provider = fakeProvider(async (q) => {
      await tick();
      if (q === 'A') controller.abort();
      return [];
    });
    const { rows, onRow } = collect();
    await runBulkCheck({
      names: ['A', 'B', 'C', 'D', 'E', 'F'],
      provider,
      signal: controller.signal,
      onRow,
    });
    expect(provider.calls.length).toBeLessThanOrEqual(2);
    expect(rows.get(5)).toBeUndefined();
  });
});
