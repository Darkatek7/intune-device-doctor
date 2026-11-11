import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { randomSalt, createMasker } from './masker';
import { PrivacyContext, PrivacyViewContext, type PrivacyContextValue } from './privacyContext';
import { readStoredPrivacy, writeStoredPrivacy } from './storage';
import type { PrivacyView } from './view';

interface Props {
  children: ReactNode;
  /** Nur für Tests: Startzustand statt localStorage */
  initialEnabled?: boolean;
  /** Nur für Tests: fester Salt */
  salt?: string;
}

/** Schalterzustand (localStorage) und Sitzungs-Masker mit zufälligem Salt (nur Arbeitsspeicher). */
export function PrivacyProvider({ children, initialEnabled, salt }: Props) {
  const [enabled, setEnabledState] = useState<boolean>(() => initialEnabled ?? readStoredPrivacy());
  const [masker] = useState(() => createMasker(salt ?? randomSalt()));

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    writeStoredPrivacy(next);
  }, []);
  const toggle = useCallback(() => setEnabled(!enabled), [enabled, setEnabled]);

  const value = useMemo<PrivacyContextValue>(
    () => ({ enabled, setEnabled, toggle, masker }),
    [enabled, setEnabled, toggle, masker],
  );
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

/** Stellt die Sicht einer Ansicht allen Nachfahren (auch Portalen) bereit. */
export function PrivacyViewProvider({
  view,
  children,
}: {
  view: PrivacyView;
  children: ReactNode;
}) {
  return <PrivacyViewContext.Provider value={view}>{children}</PrivacyViewContext.Provider>;
}
