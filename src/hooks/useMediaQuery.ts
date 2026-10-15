import { useCallback, useSyncExternalStore } from 'react';

/** Reagiert auf eine CSS-Media-Query; ohne matchMedia (z. B. SSR/Tests) → fallback. */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', callback);
      return () => list.removeEventListener('change', callback);
    },
    [query],
  );
  const getSnapshot = () =>
    typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : fallback;
  return useSyncExternalStore(subscribe, getSnapshot, () => fallback);
}
