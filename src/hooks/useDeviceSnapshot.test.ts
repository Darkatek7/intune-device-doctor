import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MockProvider } from '../providers/mock/MockProvider';
import { useDeviceSearch } from './useDeviceSearch';
import { useDeviceSnapshot } from './useDeviceSnapshot';

const provider = new MockProvider({ latency: false });

async function idOf(name: string): Promise<string> {
  const [hit] = await provider.searchDevices(name);
  return hit!.id;
}

describe('useDeviceSnapshot', () => {
  it('lädt Gerät und alle Sections', async () => {
    const id = await idOf('CONTOSO-PC001');
    const { result } = renderHook(() => useDeviceSnapshot(provider, id));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.snapshot?.bitlockerKeys).toBeDefined());
    const s = result.current.snapshot!;
    expect(s.device.deviceName).toBe('CONTOSO-PC001');
    for (const key of [
      'protection',
      'compliancePolicies',
      'configurationPolicies',
      'entraDevice',
      'bitlockerKeys',
    ] as const) {
      expect(s[key]).toBeDefined();
    }
  });

  it('retrySection setzt die Section zurück und lädt sie neu', async () => {
    const id = await idOf('CONTOSO-PC050');
    const { result } = renderHook(() => useDeviceSnapshot(provider, id));
    await waitFor(() => expect(result.current.snapshot?.configurationPolicies).toBeDefined());
    expect(result.current.snapshot?.configurationPolicies?.status).toBe('forbidden');

    act(() => result.current.retrySection('configurationPolicies'));
    await waitFor(() =>
      expect(result.current.snapshot?.configurationPolicies?.status).toBe('forbidden'),
    );
  });

  it('meldet unbekannte Geräte als Fehlerzustand', async () => {
    const { result } = renderHook(() => useDeviceSnapshot(provider, 'gibt-es-nicht'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.code).toBe('notFound');
  });
});

describe('useDeviceSearch', () => {
  it('sucht sofort und liefert Treffer', async () => {
    const { result } = renderHook(() => useDeviceSearch(provider));
    let hits: unknown[] | null = null;
    await act(async () => {
      hits = await result.current.search('contoso-pc0');
    });
    expect(hits!.length).toBeGreaterThan(1);
    expect(result.current.state.status).toBe('done');
    expect(result.current.state.loading).toBe(false);
  });
});
