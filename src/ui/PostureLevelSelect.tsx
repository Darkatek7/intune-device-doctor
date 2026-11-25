/**
 * Stufenwahl der Ansicht „Empfehlungen“ (M21/S4): Segment-Steuerelement als Radiogruppe. Pfeiltasten
 * wechseln die Stufe und setzen den Fokus mit (roving tabindex); der gewählte Eintrag ist nie nur an der
 * Farbe zu erkennen (`aria-checked`, Hintergrund, kräftigere Schrift).
 */
import { motion, useReducedMotion } from 'motion/react';
import { useRef, type KeyboardEvent } from 'react';
import type { PostureLevel } from '../domain/posture';
import { de } from '../i18n/de';
import { fade, spring } from './motion';

const LEVELS: readonly PostureLevel[] = [1, 2, 3];
const t = de.posture.view.level;

interface Props {
  value: PostureLevel;
  onChange: (level: PostureLevel) => void;
}

export function PostureLevelSelect({ value, onChange }: Props) {
  const reduced = useReducedMotion();
  const refs = useRef<Partial<Record<PostureLevel, HTMLButtonElement | null>>>({});

  const move = (level: PostureLevel) => {
    onChange(level);
    refs.current[level]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const index = LEVELS.indexOf(value);
    let next: PostureLevel | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = LEVELS[(index + 1) % LEVELS.length];
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = LEVELS[(index + LEVELS.length - 1) % LEVELS.length];
    } else if (event.key === 'Home') next = LEVELS[0];
    else if (event.key === 'End') next = LEVELS[LEVELS.length - 1];
    if (next === undefined) return;
    event.preventDefault();
    move(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label={t.label}
      onKeyDown={onKeyDown}
      className="inline-flex w-full max-w-md gap-1 rounded-2xl bg-fill p-1"
    >
      {LEVELS.map((level) => {
        const checked = level === value;
        return (
          <button
            key={level}
            ref={(element) => {
              refs.current[level] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(level)}
            className={`relative flex min-w-0 flex-1 flex-col items-center rounded-xl px-3 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
              checked ? 'font-semibold text-label' : 'font-medium text-secondary-label'
            }`}
          >
            {checked && (
              <motion.span
                layoutId="posture-level-pill"
                aria-hidden="true"
                transition={reduced ? fade : spring}
                className="absolute inset-0 rounded-xl bg-surface shadow-sm ring-1 ring-black/5 dark:ring-white/10"
              />
            )}
            <span className="relative">{de.posture.levelShort(level)}</span>
            <span className="relative text-xs font-normal text-secondary-label">
              {t.options[level]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
