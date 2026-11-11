import { Stethoscope } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { DataMode } from '../domain/types';
import { de } from '../i18n/de';
import { ModeSwitch } from './ModeSwitch';
import type { NavItem } from './navItems';
import { PrivacyNotice, PrivacyToggle } from './PrivacyToggle';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  /** Kompaktes Suchfeld (im leeren Zustand null – dort steht das große Suchfeld) */
  search: ReactNode;
  mode: DataMode;
  onModeChange: (mode: DataMode) => void;
  liveAvailable: boolean;
  onHome: () => void;
  /** Hauptnavigation (Geräte, Richtlinien, Mandant …); leer/fehlend → keine Navigation */
  navItems?: readonly NavItem[];
  /** Slot für das Konto (M4: AuthGate/Account-Menü) */
  account?: ReactNode;
}

/** Sticky, transluzent; statt Trennlinie ein weicher Scroll-Edge-Verlauf, sobald gescrollt wird. */
export function Toolbar({
  search,
  mode,
  onModeChange,
  liveAvailable,
  onHome,
  navItems,
  account,
}: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <header className="sticky top-0 z-20">
      <div className="glass hc-edge-b bg-(--c-glass) backdrop-blur-2xl backdrop-saturate-[1.8]">
        <div className="mx-auto flex min-h-14 max-w-[80rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-8">
          <button
            type="button"
            onClick={onHome}
            aria-label={de.toolbar.home}
            className="order-1 flex shrink-0 items-center gap-2 rounded-lg px-1 text-base lg:order-none font-semibold tracking-[-0.01em] text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
          >
            <span aria-hidden="true" className="squircle app-glyph size-7">
              <Stethoscope size={16} strokeWidth={2.25} />
            </span>
            {/* Sehr schmale Displays: nur die Glyphe, damit Mandant/Richtlinien/Modus in eine Zeile passen */}
            <span className="max-[419px]:sr-only">{de.app.name}</span>
          </button>
          {navItems && navItems.length > 0 && (
            <nav
              aria-label={de.nav.label}
              className="order-4 flex w-full min-w-0 gap-1 lg:order-none lg:w-auto"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onSelect}
                    aria-current={item.active ? 'page' : undefined}
                    className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-medium outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] sm:flex-none ${
                      item.active
                        ? 'bg-accent/15 text-accent'
                        : 'text-secondary-label hover:bg-fill hover:text-label'
                    }`}
                  >
                    <Icon aria-hidden="true" size={16} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          )}
          {search && (
            <div className="order-3 w-full min-w-0 sm:order-2 sm:mx-auto sm:w-auto sm:max-w-xl sm:flex-1 lg:order-none">
              {search}
            </div>
          )}
          <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-3 sm:gap-3 lg:order-none">
            <ModeSwitch mode={mode} onChange={onModeChange} liveAvailable={liveAvailable} />
            <PrivacyToggle />
            <ThemeToggle />
            {account}
          </div>
        </div>
        <PrivacyNotice />
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
