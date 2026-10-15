import { useEffect, useState, type ReactNode } from 'react';
import type { DataMode } from '../domain/types';
import { de } from '../i18n/de';
import { ModeSwitch } from './ModeSwitch';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  /** Kompaktes Suchfeld (im leeren Zustand null – dort steht das große Suchfeld) */
  search: ReactNode;
  mode: DataMode;
  onModeChange: (mode: DataMode) => void;
  liveAvailable: boolean;
  onHome: () => void;
  /** Slot für das Konto (M4: AuthGate/Account-Menü) */
  account?: ReactNode;
}

/** Sticky, transluzent; statt Trennlinie ein weicher Scroll-Edge-Verlauf, sobald gescrollt wird. */
export function Toolbar({ search, mode, onModeChange, liveAvailable, onHome, account }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <header className="sticky top-0 z-20">
      <div className="glass hc-edge-b bg-surface-raised backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex min-h-14 max-w-[80rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-8">
          <button
            type="button"
            onClick={onHome}
            aria-label={de.toolbar.home}
            className="shrink-0 rounded-lg px-1 text-base font-semibold tracking-tight text-label outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {de.app.name}
          </button>
          {search && (
            <div className="order-last w-full min-w-0 sm:order-none sm:mx-auto sm:w-auto sm:max-w-xl sm:flex-1">
              {search}
            </div>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <ModeSwitch mode={mode} onChange={onModeChange} liveAvailable={liveAvailable} />
            <ThemeToggle />
            {account}
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        data-testid="scroll-edge"
        className={`pointer-events-none absolute inset-x-0 top-full h-6 bg-linear-to-b from-black/[0.08] to-transparent transition-opacity duration-200 dark:from-black/40 ${
          scrolled ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </header>
  );
}
