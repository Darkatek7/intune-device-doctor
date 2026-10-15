import { Search, X } from 'lucide-react';
import { useId, useState, type KeyboardEvent, type Ref } from 'react';
import type { DeviceSearchResult } from '../domain/types';
import { de } from '../i18n/de';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Enter ohne ausgewählten Vorschlag: sofort suchen */
  onSubmit: (value: string) => void;
  suggestions?: DeviceSearchResult[];
  onSelectSuggestion?: (suggestion: DeviceSearchResult) => void;
  busy?: boolean;
  size?: 'large' | 'compact';
  inputRef?: Ref<HTMLInputElement>;
  autoFocus?: boolean;
}

export function SearchField({
  value,
  onChange,
  onSubmit,
  suggestions = [],
  onSelectSuggestion,
  busy = false,
  size = 'compact',
  inputRef,
  autoFocus,
}: Props) {
  const listId = useId();
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const large = size === 'large';
  const open = focused && !dismissed && suggestions.length > 0;
  const activeId = open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined;

  const select = (suggestion: DeviceSearchResult) => {
    setDismissed(true);
    setActiveIndex(-1);
    onSelectSuggestion?.(suggestion);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setDismissed(false);
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault();
      setDismissed(false);
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setDismissed(true);
      setActiveIndex(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const picked = open && activeIndex >= 0 ? suggestions[activeIndex] : undefined;
      if (picked) select(picked);
      else {
        setDismissed(true);
        onSubmit(value);
      }
    }
  };

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(event) => {
        event.preventDefault();
        setDismissed(true);
        onSubmit(value);
      }}
    >
      <div
        className={`flex items-center gap-2 rounded-full bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_rgb(0_0_0/0.04)] ring-1 ring-separator transition-shadow focus-within:ring-2 focus-within:ring-accent ${
          large ? 'h-14 pl-5 pr-2 text-lg' : 'h-10 pl-3.5 pr-2 text-sm'
        }`}
      >
        <Search
          aria-hidden="true"
          size={large ? 22 : 18}
          className="shrink-0 text-secondary-label"
        />
        <input
          ref={inputRef}
          type="text"
          data-search-input=""
          role="combobox"
          aria-label={de.field.label}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-keyshortcuts="Meta+K Control+K /"
          title={de.field.shortcutHint}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder={de.search.placeholder}
          value={value}
          onChange={(event) => {
            setDismissed(false);
            setActiveIndex(-1);
            onChange(event.target.value);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-label outline-none placeholder:text-secondary-label"
        />
        {busy && (
          <span className="shrink-0 text-xs text-secondary-label" role="status">
            {de.field.searching}
          </span>
        )}
        {value && (
          <button
            type="button"
            aria-label={de.field.clear}
            onClick={() => {
              onChange('');
              setActiveIndex(-1);
              const input = document.querySelector<HTMLInputElement>('[data-search-input]');
              input?.focus();
            }}
            className="grid size-7 shrink-0 place-items-center rounded-full text-secondary-label outline-none transition-transform hover:bg-separator focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
          >
            <X aria-hidden="true" size={16} />
          </button>
        )}
        {!value && !large && (
          <kbd
            aria-hidden="true"
            className="hidden shrink-0 rounded-md bg-canvas px-1.5 py-0.5 font-sans text-xs text-secondary-label sm:block"
          >
            {de.field.shortcut}
          </kbd>
        )}
        {large && (
          <button
            type="submit"
            className="h-10 shrink-0 rounded-full bg-accent px-5 text-base font-medium text-white outline-none transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent active:scale-[0.97]"
          >
            {de.search.button}
          </button>
        )}
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label={de.field.suggestions}
        hidden={!open}
        className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-surface p-1 shadow-[0_8px_32px_rgb(0_0_0/0.16)] ring-1 ring-separator"
      >
        {open &&
          suggestions.map((s, index) => (
            <li
              key={s.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(s)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-xl px-3 py-2 text-sm ${
                index === activeIndex ? 'bg-accent text-white' : 'text-label'
              }`}
            >
              <span className="truncate font-medium">{s.deviceName}</span>
              <span
                className={`truncate text-xs ${index === activeIndex ? 'text-white/85' : 'text-secondary-label'}`}
              >
                {s.userDisplayName ?? s.userPrincipalName ?? de.picker.noUser}
              </span>
            </li>
          ))}
      </ul>
    </form>
  );
}
