import { Landmark, Laptop, ListChecks, type LucideIcon } from 'lucide-react';
import { de } from '../i18n/de';

/**
 * Hauptnavigation (Toolbar). Eine neue Ansicht = ein Eintrag hier plus ein Handler in
 * `AppShell` (der Typ `NavId` erzwingt ihn). `view` ist der URL-Wert `?view=…`; `null` = Startansicht
 * (Suche und Geräte).
 */
export const NAV_ITEMS = [
  { id: 'devices', label: de.nav.devices, icon: Laptop, view: null },
  { id: 'policies', label: de.nav.policies, icon: ListChecks, view: 'policies' },
  { id: 'tenant', label: de.nav.tenant, icon: Landmark, view: 'tenant' },
] as const satisfies readonly {
  id: string;
  label: string;
  icon: LucideIcon;
  view: string | null;
}[];

export type NavId = (typeof NAV_ITEMS)[number]['id'];

/** Eintrag, wie ihn die Toolbar rendert */
export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onSelect: () => void;
}
