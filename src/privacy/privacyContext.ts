import { createContext, useContext, useMemo } from 'react';
import { createMasker, type Masker } from './masker';
import { createView, viewFor, type PrivacyView } from './view';

export interface PrivacyContextValue {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  toggle: () => void;
  masker: Masker;
}

/** Ohne Provider (z. B. Komponententests): Modus aus, fester Salt. */
const FALLBACK: PrivacyContextValue = {
  enabled: false,
  setEnabled: () => {},
  toggle: () => {},
  masker: createMasker('fallback'),
};

export const PrivacyContext = createContext<PrivacyContextValue>(FALLBACK);

/** Schalterzustand und Masker (für Listen und Köpfe, die Pseudonyme je Feld ausgeben). */
export function usePrivacy(): PrivacyContextValue {
  return useContext(PrivacyContext);
}

/**
 * Sicht der nächsten Ansicht (DeviceView, ZipView …) mit deren bekannten Werten. Außerhalb einer Ansicht:
 * nur Sicherheitsnetz, keine bekannten Werte.
 */
export const PrivacyViewContext = createContext<PrivacyView | null>(null);

export function usePrivacyView(): PrivacyView {
  const view = useContext(PrivacyViewContext);
  const { enabled, masker } = usePrivacy();
  return useMemo(() => view ?? createView(masker, enabled), [view, masker, enabled]);
}

/**
 * Baut die Sicht einer Ansicht aus ihren Rohdaten (`source` muss stabil sein, z. B. der Snapshot). Aus:
 * kein Aufwand.
 */
export function useBuildPrivacyView(source: unknown): PrivacyView {
  const { enabled, masker } = usePrivacy();
  return useMemo(() => viewFor(masker, enabled, source), [masker, enabled, source]);
}
