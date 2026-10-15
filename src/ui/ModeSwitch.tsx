import { motion, useReducedMotion } from 'motion/react';
import { useId, useRef, type KeyboardEvent } from 'react';
import type { DataMode } from '../domain/types';
import { de } from '../i18n/de';
import { spring } from './motion';

interface Props {
  mode: DataMode;
  onChange: (mode: DataMode) => void;
  liveAvailable: boolean;
}

const OPTIONS: DataMode[] = ['demo', 'live'];

/** Segmented Control Demo | Live (radiogroup, Pfeiltasten). Live ist ohne Konfiguration aria-disabled. */
export function ModeSwitch({ mode, onChange, liveAvailable }: Props) {
  const reduced = useReducedMotion();
  const groupId = useId();
  const refs = useRef<Partial<Record<DataMode, HTMLButtonElement | null>>>({});
  const hintId = `${groupId}-hint`;

  const disabled = (m: DataMode) => m === 'live' && !liveAvailable;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (index + 1) % OPTIONS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (index - 1 + OPTIONS.length) % OPTIONS.length;
    } else {
      return;
    }
    event.preventDefault();
    const target = OPTIONS[next]!;
    refs.current[target]?.focus();
    if (!disabled(target)) onChange(target);
  };

  return (
    <div
      role="radiogroup"
      aria-label={de.toolbar.modeLabel}
      className="relative inline-flex shrink-0 rounded-full bg-separator p-0.5"
    >
      {OPTIONS.map((option, index) => {
        const selected = option === mode;
        const isDisabled = disabled(option);
        return (
          <button
            key={option}
            ref={(el) => {
              refs.current[option] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={isDisabled || undefined}
            aria-describedby={isDisabled ? hintId : undefined}
            title={isDisabled ? de.mode.liveNotConfigured : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              if (!isDisabled) onChange(option);
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`relative rounded-full px-3 py-1 text-sm font-medium outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] ${
              isDisabled ? 'cursor-not-allowed text-secondary-label opacity-70' : 'text-label'
            }`}
          >
            {selected && (
              <motion.span
                layoutId={`${groupId}-pill`}
                aria-hidden="true"
                transition={reduced ? { duration: 0 } : spring}
                className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.12)]"
              />
            )}
            <span className="relative">{de.mode[option]}</span>
          </button>
        );
      })}
      {!liveAvailable && (
        <span id={hintId} className="sr-only">
          {de.mode.liveNotConfigured}
        </span>
      )}
    </div>
  );
}
