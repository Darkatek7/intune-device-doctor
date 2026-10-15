import type { AmbientTone } from './AmbientGlow';

/** Getönter Squircle-Hintergrund + Glyphenfarbe je Gesamtzustand (Header-Icons). */
export const TONE_CLASS: Record<AmbientTone, string> = {
  accent: 'bg-accent/15 text-accent',
  ok: 'bg-ok/15 text-ok',
  warning: 'bg-warning/15 text-warning',
  critical: 'bg-critical/15 text-critical',
  unknown: 'bg-unknown/15 text-unknown',
};
