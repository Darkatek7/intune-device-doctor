/**
 * Erscheinungsbild: Dunkel ist Standard, Hell per Schalter in der Toolbar. Die Wahl wird lokal
 * gespeichert (localStorage) und als data-theme am <html>-Element gesetzt. index.html setzt das
 * Attribut bereits vor dem ersten Rendern, damit nichts hell aufblitzt.
 */
import { useCallback, useState } from 'react';

export type Theme = 'dark' | 'light';
export const THEME_STORAGE_KEY = 'mdm-doctor.theme';
export const DEFAULT_THEME: Theme = 'dark';

export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => {
    const initial = readStoredTheme();
    applyTheme(initial);
    return initial;
  });

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Privater Modus o. ä.: Wahl gilt dann nur für diese Sitzung.
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
