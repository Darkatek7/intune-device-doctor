import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom kennt matchMedia nicht. Tests laufen deterministisch mit "reduced motion"
// (nur kurze Opacity-Crossfades), alle übrigen Queries liefern false.
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query: string): MediaQueryList => {
      const listeners = new Set<EventListenerOrEventListenerObject>();
      return {
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) =>
          listeners.add(listener),
        removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) =>
          listeners.delete(listener),
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      } as MediaQueryList;
    };
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
  document.documentElement.style.overflow = '';
});
