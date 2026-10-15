import type { CSSProperties } from 'react';
import type { Severity } from '../domain/types';

export type AmbientTone = Severity | 'accent';

const TONE_COLOR: Record<AmbientTone, string> = {
  accent: 'var(--c-accent)',
  ok: 'var(--c-ok)',
  warning: 'var(--c-warning)',
  critical: 'var(--c-critical)',
  unknown: 'var(--c-unknown)',
};

/** Statischer, weicher Schein am oberen Rand in der Farbe des Gesamtzustands (rein dekorativ). */
export function AmbientGlow({ tone }: { tone: AmbientTone }) {
  return (
    <div
      aria-hidden="true"
      data-testid="ambient-glow"
      className="ambient"
      style={{ '--ambient': TONE_COLOR[tone] } as CSSProperties}
    />
  );
}
