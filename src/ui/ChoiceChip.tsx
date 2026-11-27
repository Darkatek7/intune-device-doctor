/**
 * Auswahl-Chip für Filterleisten (Flotte, Richtlinien): Umschalter mit `aria-pressed`. Der gewählte
 * Zustand zeigt Haken und Rahmen, nie nur Farbe.
 */
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

const BASE =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent';

export function ChoiceChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`${BASE} ${
        pressed
          ? 'bg-accent/15 text-label ring-1 ring-accent'
          : 'bg-fill text-secondary-label hover:text-label'
      }`}
    >
      {pressed && <Check aria-hidden="true" size={14} className="text-accent" />}
      {children}
    </button>
  );
}
