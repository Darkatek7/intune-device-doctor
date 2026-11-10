/**
 * Eine „Sicht“ auf die Maskierung: Schalterzustand + Masker + bekannte Werte der aktuellen Ansicht.
 * Reine Funktionen (kein React); `privacyContext.ts` stellt sie den Komponenten bereit.
 */
import { collectKnown } from './collect';
import type { KnownValue, Masker, Scope } from './masker';

export interface PrivacyView {
  readonly enabled: boolean;
  readonly masker: Masker;
  readonly known: readonly KnownValue[];
  readonly scope: Scope | null;
  /** Freitext maskieren (aus: unverändert) */
  text(input: string): string;
  /** Tiefe Transformation eines Anzeige-Modells (aus: dasselbe Objekt) */
  deep<T>(value: T): T;
  /** Gleiche Sicht mit weiteren bekannten Werten (z. B. aus einer geladenen Vergleichsdatei) */
  extend(source: unknown): PrivacyView;
}

export function createView(
  masker: Masker,
  enabled: boolean,
  known: readonly KnownValue[] = [],
): PrivacyView {
  const scope = enabled && known.length > 0 ? masker.scope(known) : null;
  return {
    enabled,
    masker,
    known,
    scope,
    text: (input) => (enabled ? masker.text(input, scope) : input),
    deep: (value) => (enabled ? masker.deep(value, scope) : value),
    extend: (source) => createView(masker, enabled, [...known, ...collectKnown(source)]),
  };
}

/** Sicht für die Ausgabegrenze: aus den Rohdaten einer Ansicht gebaut. */
export function viewFor(masker: Masker, enabled: boolean, source: unknown): PrivacyView {
  return createView(masker, enabled, enabled ? collectKnown(source) : []);
}
