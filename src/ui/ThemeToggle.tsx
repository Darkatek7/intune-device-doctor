import { Moon, Sun } from 'lucide-react';
import { de } from '../i18n/de';
import { useTheme } from '../theme';

/** Schalter Dunkel ↔ Hell (Standard: Dunkel). Beschriftet die Aktion, nicht den Zustand. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? de.theme.toLight : de.theme.toDark;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
      className="grid size-9 shrink-0 place-items-center rounded-full bg-control text-label outline-none transition-transform hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.94]"
    >
      {theme === 'dark' ? (
        <Sun aria-hidden="true" size={18} />
      ) : (
        <Moon aria-hidden="true" size={18} />
      )}
    </button>
  );
}
