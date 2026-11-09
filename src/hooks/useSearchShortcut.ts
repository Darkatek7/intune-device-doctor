/**
 * Tastaturkürzel für die Suche: ⌘K (macOS) / Strg+K überall, "/" außerhalb von Eingabefeldern.
 * Fokussiert das Suchfeld und markiert den Inhalt. Bei einem offenen modalen Dialog
 * (Detail-Sheet, Ticket-Notiz) passiert nichts – dessen Fokus-Falle gilt.
 */
import { useEffect, type RefObject } from 'react';
import { de } from '../i18n/de';

interface NavigatorWithUaData extends Navigator {
  userAgentData?: { platform?: string };
}

/** macOS/iOS-Erkennung für die Beschriftung des Hinweis-Chips (`userAgentData` vor `platform`). */
export function isApplePlatform(nav: Navigator = navigator): boolean {
  const platform = (nav as NavigatorWithUaData).userAgentData?.platform || nav.platform || '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** "⌘K" bzw. "Strg K" je nach Plattform. */
export function shortcutLabel(nav: Navigator = navigator): string {
  return isApplePlatform(nav) ? de.comfort.shortcutApple : de.comfort.shortcutOther;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function useSearchShortcut(inputRef: RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isK = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey);
      const isSlash =
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isEditable(event.target);
      if (!isK && !isSlash) return;
      const input = inputRef.current;
      if (!input || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      input.focus();
      input.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inputRef]);
}
