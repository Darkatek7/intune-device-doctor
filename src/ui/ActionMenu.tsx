import { ChevronDown, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import {
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from 'react';
import { de } from '../i18n/de';
import { fade, spring } from './motion';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Erklärung als Tooltip (nicht Teil des zugänglichen Namens) */
  hint?: string;
  disabled?: boolean;
  onSelect: () => void;
}

interface Props {
  items: readonly ActionMenuItem[];
  /** Sichtbare Beschriftung der Schaltfläche (Standard: „Mehr“) */
  label?: string;
  triggerRef?: Ref<HTMLButtonElement>;
}

export const MENU_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-control px-3.5 py-1.5 text-sm font-medium text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60';

const VIEWPORT_MARGIN = 8;

/**
 * Menü-Schaltfläche („Mehr“) nach dem WAI-ARIA-Menübutton-Muster: `aria-haspopup="menu"`,
 * Pfeiltasten/Home/End, Escape schließt und gibt den Fokus zurück, Klick außerhalb und Tab schließen.
 * Die Aktionen selbst (Dialoge, Dateiauswahl) liegen beim Aufrufer – das Menü löst sie nur aus.
 */
export function ActionMenu({ items, label = de.actions.more, triggerRef }: Props) {
  const reduced = useReducedMotion();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const ownTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  /** Welcher Eintrag beim Öffnen den Fokus bekommt */
  const initialFocus = useRef<'first' | 'last'>('first');

  useImperativeHandle(triggerRef, () => ownTriggerRef.current as HTMLButtonElement);

  // Gesperrte Einträge bleiben fokussierbar (WAI-ARIA-Menümuster), lassen sich aber nicht auslösen.
  const focusIndexes = items.map((_, index) => index);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) ownTriggerRef.current?.focus();
  };

  const openMenu = (where: 'first' | 'last') => {
    initialFocus.current = where;
    setOpen(true);
  };

  // Beim Öffnen: Eintrag fokussieren und das Menü bei Bedarf in den sichtbaren Bereich schieben.
  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const rect = menu?.getBoundingClientRect();
    // Schmale Displays: Menü nicht über den linken Rand hinausragen lassen.
    if (menu && rect && rect.left < VIEWPORT_MARGIN) {
      menu.style.right = `${-(VIEWPORT_MARGIN - rect.left)}px`;
    }
    const target = initialFocus.current === 'last' ? focusIndexes.at(-1) : focusIndexes[0];
    if (target !== undefined) itemRefs.current[target]?.focus();
    // focusIndexes ändert sich nur mit `items`; das Fokussieren soll nur beim Öffnen passieren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Klick/Tippen außerhalb schließt (ohne den Fokus zu verschieben).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    // Escape schließt auch, solange der Fokus noch auf der Schaltfläche liegt (z. B. alle Einträge gesperrt).
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      openMenu('first');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu('last');
    }
  };

  const moveFocus = (delta: 1 | -1) => {
    if (focusIndexes.length === 0) return;
    const current = itemRefs.current.findIndex((node) => node === document.activeElement);
    const position = focusIndexes.indexOf(current);
    const next =
      position === -1
        ? delta === 1
          ? 0
          : focusIndexes.length - 1
        : (position + delta + focusIndexes.length) % focusIndexes.length;
    itemRefs.current[focusIndexes[next]!]?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(-1);
        break;
      case 'Home':
        event.preventDefault();
        itemRefs.current[focusIndexes[0] ?? 0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        itemRefs.current[focusIndexes.at(-1) ?? 0]?.focus();
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case 'Tab':
        // Der Fokus wandert weiter; das Menü schließt sich dabei.
        setOpen(false);
        break;
    }
  };

  const select = (item: ActionMenuItem) => {
    if (item.disabled) return;
    close(true);
    item.onSelect();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={ownTriggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={de.actions.moreHint}
        onClick={() => (open ? close(false) : openMenu('first'))}
        onKeyDown={onTriggerKeyDown}
        className={MENU_BUTTON_CLASS}
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          size={16}
          className={`transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <motion.div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={reduced ? fade : spring}
          style={{ transformOrigin: 'top right' }}
          className="material-card hc-edge absolute top-full right-0 z-30 mt-2 flex min-w-60 flex-col gap-0.5 rounded-2xl p-1.5"
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={item.disabled || undefined}
                title={item.hint}
                onClick={() => select(item)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium whitespace-nowrap text-label outline-none hover:bg-fill focus-visible:bg-fill focus-visible:ring-2 focus-visible:ring-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              >
                <Icon aria-hidden="true" size={16} className="shrink-0 text-secondary-label" />
                {item.label}
              </button>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
