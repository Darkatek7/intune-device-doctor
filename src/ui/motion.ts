/** Gemeinsame Motion-Konstanten (docs/ui-guidelines.md): kritisch gedämpfte Standard-Spring. */
import type { Transition } from 'motion/react';

export const spring: Transition = { type: 'spring', bounce: 0, duration: 0.35 };
/** Reduced Motion: nur kurze Opacity-Crossfades */
export const fade: Transition = { type: 'tween', ease: 'easeOut', duration: 0.18 };
/** Versatz zwischen gestaffelt eingeblendeten Kacheln in Sekunden */
export const STAGGER = 0.025;
