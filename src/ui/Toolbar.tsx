import { Landmark, ListChecks, Stethoscope } from 'lucide-react';
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
  /** Öffnet die Ansicht „Mandant“ (M14/S5); fehlt → Schaltfläche entfällt (z. B. Live ohne Anmeldung) */
  onOpenTenant?: () => void;
  /** Die Ansicht „Mandant“ ist gerade offen */
  tenantActive?: boolean;
  /** Öffnet die Ansicht „Richtlinien“ (M15); fehlt → Schaltfläche entfällt */
  onOpenPolicies?: () => void;
  /** Die Ansicht „Richtlinien“ ist gerade offen */
  policiesActive?: boolean;
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
  onOpenTenant,
  tenantActive,
  onOpenPolicies,
  policiesActive,
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
            className="flex shrink-0 items-center gap-2 rounded-lg px-1 text-base font-semibold tracking-[-0.01em] text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
          >
            <span aria-hidden="true" className="squircle app-glyph size-7">
              <Stethoscope size={16} strokeWidth={2.25} />
            </span>
            {de.app.name}
          </button>
          {search && (
            <div className="order-last w-full min-w-0 sm:order-none sm:mx-auto sm:w-auto sm:max-w-xl sm:flex-1">
              {search}
            </div>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            {onOpenTenant && (
              <button
                type="button"
                onClick={onOpenTenant}
                aria-current={tenantActive ? 'page' : undefined}
                title={de.toolbar.tenant}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] ${
                  tenantActive ? 'bg-accent/15 text-accent' : 'bg-fill text-label'
                }`}
              >
                <Landmark aria-hidden="true" size={16} />
                <span className="sr-only sm:not-sr-only">{de.toolbar.tenantShort}</span>
              </button>
            )}
            {onOpenPolicies && (
              <button
                type="button"
                onClick={onOpenPolicies}
                aria-current={policiesActive ? 'page' : undefined}
                title={de.toolbar.policies}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] ${
                  policiesActive ? 'bg-accent/15 text-accent' : 'bg-fill text-label'
                }`}
              >
                <ListChecks aria-hidden="true" size={16} />
                <span className="sr-only sm:not-sr-only">{de.toolbar.policiesShort}</span>
              </button>
            )}
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
