/**
 * App-Rahmen: Toolbar, Suche, URL-State und Umschaltung zwischen Startseite, Auswahlliste,
 * Leerzuständen und der Geräteansicht.
 */
import { CloudOff, SearchX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { DataMode, DeviceSearchResult } from '../domain/types';
import { useDeviceSearch } from '../hooks/useDeviceSearch';
import { useExampleDevices } from '../hooks/useExampleDevices';
import { closeTileInHistory, navigateTo, parseUrl, useUrlState } from '../hooks/useUrlState';
import { de } from '../i18n/de';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Landing } from '../ui/Landing';
import { ResultPicker } from '../ui/ResultPicker';
import { SearchField } from '../ui/SearchField';
import { Toolbar } from '../ui/Toolbar';
import { DeviceView } from './DeviceView';
import { useProviderContext } from './providerContextValue';

interface Props {
  /** Slot für das Konto in der Toolbar (M4: AuthGate/Account-Menü) */
  account?: ReactNode;
  /** Slot für weitere Chips im leeren Zustand (M5: "Beispiel-ZIP analysieren") */
  extraChips?: ReactNode;
  /** M5: Handler für eine abgelegte/gewählte DiagLogs-ZIP */
  onFile?: (file: File) => void;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function AppShell(props: Props) {
  const { mode, setMode } = useProviderContext();
  const url = useUrlState();

  // Browser-Zurück/Teilen-Link kann einen anderen Modus mitbringen.
  useEffect(() => {
    if (url.mode && url.mode !== mode) setMode(url.mode);
  }, [url.mode, mode, setMode]);

  // Beim Moduswechsel wird der gesamte Zustand (Suche, Geräte) verworfen.
  return <Shell key={mode} {...props} />;
}

function Shell({ account, extraChips, onFile }: Props) {
  const { mode, setMode, provider, liveAvailable } = useProviderContext();
  const url = useUrlState();
  const examples = useExampleDevices(mode);
  const { state, suggestions, search, suggest, clearSuggestions, reset } =
    useDeviceSearch(provider);
  const [query, setQuery] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchedAt, setSearchedAt] = useState(() => new Date());

  const openDevice = useCallback(
    (result: Pick<DeviceSearchResult, 'id' | 'deviceName'>) => {
      clearSuggestions();
      setQuery(result.deviceName);
      navigateTo({ device: result.id, tile: null, mode });
    },
    [clearSuggestions, mode],
  );

  const submit = useCallback(
    async (value: string) => {
      const results = await search(value);
      setSearchedAt(new Date());
      if (results?.length === 1) openDevice(results[0]!);
    },
    [search, openDevice],
  );

  const goHome = () => {
    reset();
    setQuery('');
    navigateTo({ device: null, tile: null, mode });
  };

  const changeMode = (next: DataMode) => {
    if (next === mode) return;
    setMode(next);
    navigateTo({ device: null, tile: null, mode: next });
  };

  // Tastaturkürzel: ⌘K / Strg+K und "/" fokussieren die Suche.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isK = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey);
      const isSlash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (!isK && !(isSlash && !isEditable(event.target))) return;
      const input = inputRef.current;
      if (!input || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      input.focus();
      input.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const field = (size: 'large' | 'compact') => (
    <SearchField
      size={size}
      value={query}
      onChange={(value) => {
        setQuery(value);
        suggest(value);
      }}
      onSubmit={(value) => void submit(value)}
      suggestions={suggestions}
      onSelectSuggestion={openDevice}
      busy={state.loading}
      inputRef={inputRef}
    />
  );

  const liveWithoutProvider = !provider;
  const showDevice = Boolean(provider && url.device);
  const showPicker = !showDevice && state.status === 'done' && state.results.length > 1;
  const showNotFound = !showDevice && state.status === 'done' && state.results.length === 0;
  const showSearchError = !showDevice && state.status === 'error' && state.error;
  const showHero =
    !liveWithoutProvider && !showDevice && !showPicker && !showNotFound && !showSearchError;

  let content: ReactNode;
  if (liveWithoutProvider) {
    content = (
      <EmptyState
        icon={CloudOff}
        title={de.empty.liveUnavailableTitle}
        description={de.empty.liveUnavailableBody}
        action={
          <button
            type="button"
            onClick={() => changeMode('demo')}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white outline-none transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent active:scale-[0.97]"
          >
            {de.empty.switchToDemo}
          </button>
        }
      />
    );
  } else if (showDevice && provider && url.device) {
    content = (
      <DeviceView
        key={`${url.device}:${retryKey}`}
        provider={provider}
        deviceId={url.device}
        openTileId={url.tile}
        onOpenTile={(tileId) =>
          navigateTo({ device: url.device, tile: tileId, mode }, { tileOpened: true })
        }
        onCloseTile={() => {
          const current = parseUrl(window.location.search);
          if (current.tile) closeTileInHistory(current);
        }}
        onRetryDevice={() => setRetryKey((k) => k + 1)}
      />
    );
  } else if (showPicker) {
    content = (
      <ResultPicker
        results={state.results}
        query={state.query}
        now={searchedAt}
        onSelect={openDevice}
      />
    );
  } else if (showNotFound) {
    content = (
      <EmptyState
        icon={SearchX}
        title={de.empty.notFoundTitle}
        description={de.empty.notFoundBody(state.query)}
      />
    );
  } else if (showSearchError && state.error) {
    content = (
      <ErrorState
        error={state.error}
        title={de.empty.searchFailedTitle}
        onRetry={() => void submit(state.query)}
      />
    );
  } else {
    content = (
      <Landing
        search={field('large')}
        examples={examples}
        onPickExample={(name) => {
          setQuery(name);
          void submit(name);
        }}
        extraChips={extraChips}
        onFile={onFile}
      />
    );
  }

  const liveStatus = state.loading
    ? de.a11y.searching
    : showPicker
      ? de.a11y.resultsFound(state.results.length)
      : showNotFound
        ? de.a11y.noResults
        : '';

  return (
    <div className="min-h-dvh bg-canvas text-label">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:ring-2 focus:ring-accent"
      >
        {de.toolbar.skipToContent}
      </a>
      <Toolbar
        search={showHero || liveWithoutProvider ? null : field('compact')}
        mode={mode}
        onModeChange={changeMode}
        liveAvailable={liveAvailable}
        onHome={goHome}
        account={account}
      />
      <main id="main" className="mx-auto max-w-[80rem] px-4 py-6 sm:px-8 sm:py-8">
        <p className="sr-only" role="status" aria-live="polite">
          {liveStatus}
        </p>
        {content}
      </main>
    </div>
  );
}
