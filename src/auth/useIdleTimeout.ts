/**
 * Inaktivitäts-Timer (M16/S2). Zeitbasiert über `Date.now()` im Sekundentakt: Ein schlafender
 * Rechner oder ein gedrosselter Hintergrund-Tab führt beim nächsten Tick bzw. Ereignis sofort zur
 * Abmeldung – eine überfällige Sitzung wird durch Aktivität nie „wiederbelebt“.
 *
 * Aktivität: Zeiger, Tastatur, Scrollen, Rückkehr in den Tab (passiv, auf eine Aktualisierung pro
 * Sekunde gedrosselt). Während der Vorwarnung zählen nur bewusste Eingaben (Klick, Taste, Rad,
 * Touch) als „noch da“ – Mausrauschen und Scrollen nicht.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export const IDLE_WARNING_MS = 60_000;
const TICK_MS = 1000;
const ACTIVITY_THROTTLE_MS = 1000;

export interface IdleTimeoutState {
  warning: boolean;
  /** Verbleibende Sekunden, solange `warning` gilt */
  secondsLeft: number;
}

const QUIET: IdleTimeoutState = { warning: false, secondsLeft: 0 };

interface Options {
  /** Dauer bis zur Abmeldung; ≤ 0 schaltet den Timer ab */
  timeoutMs: number;
  onExpire: () => void;
}

export function useIdleTimeout({ timeoutMs, onExpire }: Options): IdleTimeoutState & {
  stayActive: () => void;
} {
  const [state, setState] = useState<IdleTimeoutState>(QUIET);
  const lastActivity = useRef(0);
  const evaluateRef = useRef<() => void>(() => {});
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (timeoutMs <= 0) return;
    const warnMs = Math.min(IDLE_WARNING_MS, timeoutMs / 2);
    let expired = false;
    lastActivity.current = Date.now();

    /** Liefert `true`, wenn abgelaufen (dann wurde `onExpire` genau einmal aufgerufen). */
    const evaluate = (): boolean => {
      if (expired) return true;
      const left = timeoutMs - (Date.now() - lastActivity.current);
      if (left <= 0) {
        expired = true;
        setState(QUIET);
        onExpireRef.current();
        return true;
      }
      if (left <= warnMs) {
        const secondsLeft = Math.ceil(left / 1000);
        setState((s) =>
          s.warning && s.secondsLeft === secondsLeft ? s : { warning: true, secondsLeft },
        );
      } else {
        setState((s) => (s.warning ? QUIET : s));
      }
      return false;
    };
    evaluateRef.current = () => {
      evaluate();
    };

    const onActivity = (deliberate: boolean) => {
      if (evaluate()) return;
      const now = Date.now();
      const inWarning = timeoutMs - (now - lastActivity.current) <= warnMs;
      if (inWarning && !deliberate) return;
      if (!inWarning && now - lastActivity.current < ACTIVITY_THROTTLE_MS) return;
      lastActivity.current = now;
      evaluate();
    };

    const passive = { passive: true, capture: true } as const;
    const deliberateEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    const weakEvents = ['pointermove', 'scroll'] as const;
    const onDeliberate = () => onActivity(true);
    const onWeak = () => onActivity(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') onActivity(false);
    };

    for (const type of deliberateEvents) window.addEventListener(type, onDeliberate, passive);
    for (const type of weakEvents) window.addEventListener(type, onWeak, passive);
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(evaluate, TICK_MS);

    return () => {
      for (const type of deliberateEvents) window.removeEventListener(type, onDeliberate, passive);
      for (const type of weakEvents) window.removeEventListener(type, onWeak, passive);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
      evaluateRef.current = () => {};
      setState(QUIET);
    };
  }, [timeoutMs]);

  const stayActive = useCallback(() => {
    lastActivity.current = Date.now();
    evaluateRef.current();
  }, []);

  return { ...state, stayActive };
}
