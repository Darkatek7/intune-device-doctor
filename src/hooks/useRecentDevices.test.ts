import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_RECENT_DEVICES,
  readRecentDevices,
  recentStorageKey,
  useRecentDevices,
} from './useRecentDevices';

const device = (n: number) => ({
  id: `id-${n}`,
  deviceName: `CONTOSO-PC${String(n).padStart(3, '0')}`,
  osFamily: 'windows' as const,
});

afterEach(() => vi.restoreAllMocks());

describe('useRecentDevices', () => {
  it('startet leer, wenn nichts gespeichert ist', () => {
    const { result } = renderHook(() => useRecentDevices('demo'));
    expect(result.current.recent).toEqual([]);
  });

  it('merkt Geräte mit den vier erlaubten Feldern, neuestes zuerst, ohne Duplikate', () => {
    const { result } = renderHook(() => useRecentDevices('demo'));
    act(() => result.current.remember(device(1), new Date('2026-11-01T10:00:00Z')));
    act(() => result.current.remember(device(2), new Date('2026-11-01T11:00:00Z')));
    act(() => result.current.remember(device(1), new Date('2026-11-01T12:00:00Z')));

    expect(result.current.recent.map((d) => d.id)).toEqual(['id-1', 'id-2']);
    expect(result.current.recent[0]).toEqual({
      id: 'id-1',
      deviceName: 'CONTOSO-PC001',
      osFamily: 'windows',
      openedAt: '2026-11-01T12:00:00.000Z',
    });
    // Überschuss-Felder (z. B. UPN, Seriennummer) werden nie gespeichert.
    act(() =>
      result.current.remember({
        ...device(3),
        userPrincipalName: 'anna@contoso.com',
        serialNumber: 'SN123',
      } as ReturnType<typeof device>),
    );
    const raw = window.localStorage.getItem(recentStorageKey('demo')) ?? '';
    expect(raw).not.toMatch(/contoso\.com|SN123|userPrincipalName|serialNumber/);
  });

  it('begrenzt die Liste auf 8 Einträge und verwirft die ältesten', () => {
    const { result } = renderHook(() => useRecentDevices('demo'));
    for (let n = 1; n <= 10; n++) act(() => result.current.remember(device(n)));
    expect(result.current.recent).toHaveLength(MAX_RECENT_DEVICES);
    expect(result.current.recent[0]?.id).toBe('id-10');
    expect(result.current.recent.at(-1)?.id).toBe('id-3');
    expect(readRecentDevices('demo')).toHaveLength(MAX_RECENT_DEVICES);
  });

  it('hält demo und live getrennt', () => {
    const demo = renderHook(() => useRecentDevices('demo'));
    act(() => demo.result.current.remember(device(1)));
    const live = renderHook(() => useRecentDevices('live'));
    expect(live.result.current.recent).toEqual([]);
    act(() => live.result.current.remember(device(2)));
    expect(readRecentDevices('demo').map((d) => d.id)).toEqual(['id-1']);
    expect(readRecentDevices('live').map((d) => d.id)).toEqual(['id-2']);
  });

  it('liest beim Moduswechsel die Liste des neuen Modus', () => {
    window.localStorage.setItem(
      recentStorageKey('live'),
      JSON.stringify([{ ...device(7), openedAt: '2026-11-01T10:00:00Z' }]),
    );
    const { result, rerender } = renderHook(({ mode }) => useRecentDevices(mode), {
      initialProps: { mode: 'demo' as 'demo' | 'live' },
    });
    expect(result.current.recent).toEqual([]);
    rerender({ mode: 'live' });
    // Die App erzeugt die Shell pro Modus neu (key={mode}); ein frischer Hook liest den Modus.
    const fresh = renderHook(() => useRecentDevices('live'));
    expect(fresh.result.current.recent.map((d) => d.id)).toEqual(['id-7']);
  });

  it('„Verlauf löschen“ leert Liste und Speicher', () => {
    const { result } = renderHook(() => useRecentDevices('demo'));
    act(() => result.current.remember(device(1)));
    act(() => result.current.clear());
    expect(result.current.recent).toEqual([]);
    expect(window.localStorage.getItem(recentStorageKey('demo'))).toBeNull();
  });

  it('toleriert kaputtes JSON, falsche Formen und ungültige Einträge', () => {
    const key = recentStorageKey('demo');
    window.localStorage.setItem(key, '{kaputt');
    expect(readRecentDevices('demo')).toEqual([]);
    window.localStorage.setItem(key, '{"a":1}');
    expect(readRecentDevices('demo')).toEqual([]);
    window.localStorage.setItem(
      key,
      JSON.stringify([
        null,
        { id: 1 },
        { ...device(1), osFamily: 'beos', openedAt: 'x' },
        { ...device(2), openedAt: '2026-11-01T10:00:00Z', extra: 'wird verworfen' },
      ]),
    );
    expect(readRecentDevices('demo')).toEqual([{ ...device(2), openedAt: '2026-11-01T10:00:00Z' }]);
  });

  it('wirft nicht, wenn localStorage nicht verfügbar ist (Privatmodus), und hält die Liste im Speicher', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const { result } = renderHook(() => useRecentDevices('demo'));
    expect(result.current.recent).toEqual([]);
    act(() => result.current.remember(device(1)));
    act(() => result.current.remember(device(2)));
    expect(result.current.recent.map((d) => d.id)).toEqual(['id-2', 'id-1']);
    expect(() => act(() => result.current.clear())).not.toThrow();
    expect(result.current.recent).toEqual([]);
  });
});
