import { describe, expect, it, vi } from 'vitest';
import { de } from '../i18n/de';
import { ProviderError } from '../providers/DeviceDataProvider';
import type { ManagedDeviceInfo } from '../domain/types';

const searchDevices = vi.fn(async () => []);
const getBitLockerKeys = vi.fn(async () => ({
  status: 'ok' as const,
  data: [],
  source: { kind: 'graph' as const, label: 'x' },
  fetchedAt: '2026-01-01T00:00:00Z',
}));
const createGraphProvider = vi.fn(() => ({ searchDevices, getBitLockerKeys }));

vi.mock('../providers/graph/GraphProvider', () => ({ createGraphProvider }));
vi.mock('../auth/token', () => ({ getGraphToken: vi.fn(async () => 'token') }));

const { LazyGraphProvider } = await import('./lazyGraphProvider');

describe('LazyGraphProvider', () => {
  it('ist ein Live-Provider, lädt den echten GraphProvider erst beim ersten Aufruf (einmalig)', async () => {
    const provider = new LazyGraphProvider();
    expect(provider.mode).toBe('live');
    expect(createGraphProvider).not.toHaveBeenCalled();

    await provider.searchDevices('contoso');
    await provider.searchDevices('contoso');
    expect(createGraphProvider).toHaveBeenCalledTimes(1);
    expect(searchDevices).toHaveBeenCalledWith('contoso', undefined);

    const result = await provider.getBitLockerKeys({ id: '1' } as ManagedDeviceInfo);
    expect(result.status).toBe('ok');
  });
});

describe('LazyGraphProvider bei Ladefehler', () => {
  it('wirft bei Suche eine ProviderError und liefert bei Sections ein Fehler-Ergebnis', async () => {
    createGraphProvider.mockImplementationOnce(() => {
      throw new Error('chunk load failed');
    });
    const provider = new LazyGraphProvider();
    await expect(provider.searchDevices('x')).rejects.toBeInstanceOf(ProviderError);

    createGraphProvider.mockImplementationOnce(() => {
      throw new Error('chunk load failed');
    });
    const section = await provider.getBitLockerKeys({ id: '1' } as ManagedDeviceInfo);
    expect(section).toMatchObject({ status: 'error', error: { code: 'network' } });
    if (section.status === 'error') expect(section.error.message).toBe(de.errors.network);
  });
});
