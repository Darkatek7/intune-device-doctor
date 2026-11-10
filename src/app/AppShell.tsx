/**
 * App-Rahmen: Toolbar, Suche, URL-State und Umschaltung zwischen Startseite, Auswahlliste,
 * Leerzuständen und der Geräteansicht.
 */
import { ChevronLeft, CloudOff, FileWarning, SearchX } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { DataMode, DeviceSearchResult } from '../domain/types';
import { useBulkCheck } from '../hooks/useBulkCheck';
import { useDeviceSearch } from '../hooks/useDeviceSearch';
import { useDiagnosticsAnalysis } from '../hooks/useDiagnosticsAnalysis';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useExampleDevices } from '../hooks/useExampleDevices';
import { usePageFileDrop } from '../hooks/usePageFileDrop';
import {
  closePolicyInHistory,
  closeTileInHistory,
  navigateTo,
  parseUrl,
  useUrlState,
} from '../hooks/useUrlState';
import { useRecentDevices } from '../hooks/useRecentDevices';
import { useSearchShortcut } from '../hooks/useSearchShortcut';
import { useZipDeviceMatch } from '../hooks/useZipDeviceMatch';
import { de } from '../i18n/de';
import { AmbientGlow, type AmbientTone } from '../ui/AmbientGlow';
import { BookmarkletDialog } from '../ui/BookmarkletDialog';
import { BulkView } from '../ui/BulkView';
import { DropOverlay } from '../ui/DropOverlay';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { ExampleZipChip } from '../ui/ExampleZipChip';
import { Landing } from '../ui/Landing';
import { LandingTools } from '../ui/LandingTools';
import { OfflineBanner } from '../ui/OfflineBanner';
import { ResultPicker } from '../ui/ResultPicker';
import { SearchField } from '../ui/SearchField';
import { Toolbar } from '../ui/Toolbar';
import { ZipProgress } from '../ui/ZipProgress';
import { ConnectionTestView } from './ConnectionTestView';
import { DeviceView } from './DeviceView';
import { TenantView } from './TenantView';
import { PoliciesView } from './PoliciesView';
import { useProviderContext } from './providerContextValue';
import { ZipView } from './ZipView';
import { EnrollmentFailuresHint } from '../ui/EnrollmentFailuresHint';

interface Props {
  /** Slot für das Konto in der Toolbar (M4: AuthGate/Account-Menü) */
  account?: ReactNode;
  /** Slot für weitere Chips im leeren Zustand (zusätzlich zum Demo-Chip "Beispiel-ZIP analysieren") */
  extraChips?: ReactNode;
}

/** Marker im history.state: Der Eintrag wurde beim Start einer ZIP-Analyse angelegt. */
interface ZipHistoryState {
  zipView?: boolean;
}

const isZipHistoryEntry = () => Boolean((window.history.state as ZipHistoryState | null)?.zipView);

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

function Shell({ account, extraChips }: Props) {
  const { mode, setMode, provider, liveAvailable } = useProviderContext();
  const url = useUrlState();
  const examples = useExampleDevices(mode);
  const recentDevices = useRecentDevices(mode);
  const online = useOnlineStatus();
  const { state, suggestions, search, suggest, clearSuggestions, reset } =
    useDeviceSearch(provider);
  const [query, setQuery] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchedAt, setSearchedAt] = useState(() => new Date());
  const [deviceTone, setDeviceTone] = useState<AmbientTone>('accent');

  // Sammelprüfung (M12/B3) und Lesezeichen (M12/B4)
  const bulk = useBulkCheck(provider);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bookmarkletOpen, setBookmarkletOpen] = useState(false);
  const bookmarkletButton = useRef<HTMLButtonElement>(null);

  // DiagLogs-ZIP: Analyse, Ansicht und optionale Zusammenführung mit einem Gerät.
  const { state: zip, analyze, reset: resetZip } = useDiagnosticsAnalysis();
  const [zipRun, setZipRun] = useState(0);
  const [mergedDeviceId, setMergedDeviceId] = useState<string | null>(null);

  const discardZip = useCallback(() => {
    resetZip();
    setMergedDeviceId(null);
  }, [resetZip]);

  const startAnalysis = useCallback(
    (file: File) => {
      // Eigener History-Eintrag: Browser-Zurück führt aus der ZIP-Ansicht zur Startseite.
      window.history.pushState(
        { zipView: true } satisfies ZipHistoryState,
        '',
        window.location.href,
      );
      setMergedDeviceId(null);
      setZipRun((run) => run + 1);
      void analyze(file);
    },
    [analyze],
  );

  /** Verlässt Fortschritts-/Fehler-/ZIP-Ansicht und kehrt zur Startseite zurück. */
  const leaveZip = useCallback(() => {
    discardZip();
    if (isZipHistoryEntry()) window.history.back();
  }, [discardZip]);

  // Browser-Zurück aus der ZIP-Ansicht (bzw. vor den ZIP-Eintrag) verwirft die Analyse.
  useEffect(() => {
    const onPopState = () => {
      if (isZipHistoryEntry() || parseUrl(window.location.search).device) return;
      discardZip();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [discardZip]);

  const analyzeExample = useCallback(async () => {
    const { buildFixtureZip, FIXTURE_FILE_NAME } = await import('../diagnostics/fixture');
    const bytes = new Uint8Array(buildFixtureZip());
    startAnalysis(new File([bytes], FIXTURE_FILE_NAME, { type: 'application/zip' }));
  }, [startAnalysis]);

  const zipReport = zip.status === 'done' ? zip.report : undefined;
  const zipMatch = useZipDeviceMatch(provider, zipReport?.deviceNameFromFile ?? null);

  const openDevice = useCallback(
    (result: Pick<DeviceSearchResult, 'id' | 'deviceName'>) => {
      clearSuggestions();
      setQuery(result.deviceName);
      // Ein anderes Gerät öffnen verwirft die ZIP-Befunde.
      discardZip();
      navigateTo({ device: result.id, tile: null, mode });
    },
    [clearSuggestions, discardZip, mode],
  );

  const mergeZip = () => {
    if (!zipMatch) return;
    clearSuggestions();
    setQuery(zipMatch.deviceName);
    setMergedDeviceId(zipMatch.id);
    navigateTo({ device: zipMatch.id, tile: null, mode });
  };

  const removeMergedZip = () => {
    discardZip();
    const current = parseUrl(window.location.search);
    if (current.tile) navigateTo({ ...current, tile: null }, { replace: true });
  };

  const submit = useCallback(
    async (value: string) => {
      if (zip.status !== 'idle') discardZip();
      setBulkOpen(false);
      // Eine Suche verlässt die Ansicht „Mandant“ bzw. den Verbindungstest, damit die Trefferliste sichtbar wird.
      if (url.view === 'tenant' || url.view === 'connectionTest' || url.view === 'policies') {
        navigateTo({ device: null, tile: null, mode });
      }
      const results = await search(value);
      setSearchedAt(new Date());
      if (results?.length === 1) openDevice(results[0]!);
    },
    [search, openDevice, zip.status, discardZip, url.view, mode],
  );

  const openBulk = () => {
    discardZip();
    reset();
    setQuery('');
    // Die Sammelprüfung verlässt eine geöffnete Mandanten-Ansicht bzw. ein geöffnetes Gerät.
    if (url.device || url.view) navigateTo({ device: null, tile: null, mode });
    setBulkOpen(true);
  };

  const openTenant = () => {
    setBulkOpen(false);
    discardZip();
    reset();
    setQuery('');
    navigateTo({ device: null, tile: null, mode, view: 'tenant' });
  };

  /** Öffnet eine Kachel der Ansicht „Mandant“ direkt (M18: Dienststatus, Registrierungsfehler). */
  const openTenantTile = (tileId: 'tenantServiceHealth' | 'tenantEnrollmentFailures') => {
    openTenant();
    navigateTo({ device: null, tile: tileId, mode, view: 'tenant' }, { tileOpened: true });
  };

  const openPolicies = () => {
    setBulkOpen(false);
    discardZip();
    reset();
    setQuery('');
    navigateTo({ device: null, tile: null, mode, view: 'policies' });
  };

  /**
   * Gerät aus dem Gerätestatus einer Richtlinie öffnen (M15): Der Status trägt keine dokumentierte
   * Geräte-ID, deshalb über die normale Suche nach dem Namen. Genau ein Treffer (bzw. genau ein exakter
   * Name) → Gerät öffnen; sonst Startansicht mit Trefferauswahl bzw. „nicht gefunden“.
   */
  const openDeviceByName = useCallback(
    async (name: string) => {
      setQuery(name);
      const results = await search(name);
      setSearchedAt(new Date());
      if (!results) return;
      const exact = results.filter(
        (result) => result.deviceName.toLowerCase() === name.trim().toLowerCase(),
      );
      const single = results.length === 1 ? results[0] : exact.length === 1 ? exact[0] : undefined;
      if (single) openDevice(single);
      else navigateTo({ device: null, tile: null, mode });
    },
    [search, openDevice, mode],
  );

  const goHome = () => {
    setBulkOpen(false);
    discardZip();
    reset();
    setQuery('');
    navigateTo({ device: null, tile: null, mode });
  };

  const changeMode = (next: DataMode) => {
    if (next === mode) return;
    setMode(next);
    navigateTo({ device: null, tile: null, mode: next });
  };

  useSearchShortcut(inputRef);

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
  // Verbindungstest (M14/S6): nur Live, d. h. wenn der Provider ihn anbietet; sonst die normale Geräteansicht.
  const canTestConnection = Boolean(provider && typeof provider.testConnection === 'function');
  const showConnectionTest = Boolean(
    provider && url.device && url.view === 'connectionTest' && canTestConnection,
  );
  const showDevice = Boolean(provider && url.device) && !showConnectionTest;
  /** Geräteansicht oder Verbindungstest: beide gehören zu einem geöffneten Gerät */
  const showDeviceArea = showDevice || showConnectionTest;
  const showTenant = Boolean(provider && !url.device && url.view === 'tenant');
  // Ansicht „Richtlinien“ (M15) teilt sich mit „Mandant“ die Ausschlüsse der übrigen Ansichten.
  const showPolicies = Boolean(provider && !url.device && url.view === 'policies');
  const showTenantLike = showTenant || showPolicies;
  const showZip =
    !showDeviceArea && !showTenantLike && !liveWithoutProvider && zip.status !== 'idle';
  const showBulk =
    bulkOpen && !showDeviceArea && !showTenantLike && !showZip && !liveWithoutProvider;
  const showPicker =
    !showDeviceArea &&
    !showTenantLike &&
    !showZip &&
    !showBulk &&
    state.status === 'done' &&
    state.results.length > 1;
  const showNotFound =
    !showDeviceArea &&
    !showTenantLike &&
    !showZip &&
    !showBulk &&
    state.status === 'done' &&
    state.results.length === 0;
  const showSearchError =
    !showDeviceArea &&
    !showTenantLike &&
    !showZip &&
    !showBulk &&
    state.status === 'error' &&
    state.error;
  const showHero =
    !liveWithoutProvider &&
    !showDeviceArea &&
    !showTenantLike &&
    !showZip &&
    !showBulk &&
    !showPicker &&
    !showNotFound &&
    !showSearchError;

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
            className="rounded-full bg-accent-fill px-4 py-2 text-sm font-medium text-white outline-none transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent active:scale-[0.97]"
          >
            {de.empty.switchToDemo}
          </button>
        }
      />
    );
  } else if (showConnectionTest && provider && url.device) {
    const deviceId = url.device;
    content = (
      <ConnectionTestView
        key={deviceId}
        provider={provider}
        deviceId={deviceId}
        onBack={() => navigateTo({ device: deviceId, tile: null, mode })}
        onToneChange={setDeviceTone}
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
        onToneChange={setDeviceTone}
        onDeviceLoaded={recentDevices.remember}
        onOpenDevice={openDevice}
        onOpenServiceHealth={() => openTenantTile('tenantServiceHealth')}
        {...(canTestConnection
          ? {
              onOpenConnectionTest: () =>
                navigateTo({ device: url.device, tile: null, mode, view: 'connectionTest' }),
            }
          : {})}
        {...(zipReport && mergedDeviceId === url.device
          ? { diagnostics: zipReport, onRemoveDiagnostics: removeMergedZip }
          : {})}
      />
    );
  } else if (showTenant && provider) {
    content = (
      <TenantView
        provider={provider}
        openTileId={url.tile}
        onOpenTile={(tileId) =>
          navigateTo({ device: null, tile: tileId, mode, view: 'tenant' }, { tileOpened: true })
        }
        onCloseTile={() => {
          const current = parseUrl(window.location.search);
          if (current.tile) closeTileInHistory(current);
        }}
        onBack={goHome}
        onToneChange={setDeviceTone}
      />
    );
  } else if (showPolicies && provider) {
    content = (
      <PoliciesView
        provider={provider}
        openPolicyKey={url.policy ?? null}
        onOpenPolicy={(key) =>
          navigateTo(
            { device: null, tile: null, mode, view: 'policies', policy: key },
            { policyOpened: true },
          )
        }
        onClosePolicy={() => {
          const current = parseUrl(window.location.search);
          if (current.policy) closePolicyInHistory(current);
        }}
        onBack={goHome}
        onOpenDeviceByName={(name) => void openDeviceByName(name)}
        onToneChange={setDeviceTone}
      />
    );
  } else if (showZip) {
    if (zip.status === 'running') {
      content = (
        <ZipProgress fileName={zip.fileName ?? ''} progress={zip.progress} onCancel={leaveZip} />
      );
    } else if (zip.status === 'error') {
      content = (
        <div role="alert">
          <EmptyState
            icon={FileWarning}
            title={zip.error ?? de.zipView.errors.invalid}
            {...(zip.error === de.zipView.errors.invalid
              ? { description: de.zipView.errors.invalidHint }
              : {})}
            action={
              <button
                type="button"
                onClick={leaveZip}
                className="inline-flex items-center gap-0.5 rounded-full bg-accent-fill py-2 pr-4 pl-3 text-sm font-medium text-white outline-none transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent active:scale-[0.97]"
              >
                <ChevronLeft aria-hidden="true" size={18} />
                {de.zipView.back}
              </button>
            }
          />
        </div>
      );
    } else if (zipReport) {
      content = (
        <ZipView
          key={zipRun}
          report={zipReport}
          offer={zipMatch ? { deviceName: zipMatch.deviceName } : null}
          onMerge={mergeZip}
          onBack={leaveZip}
          onToneChange={setDeviceTone}
        />
      );
    }
  } else if (showBulk) {
    content = (
      <BulkView
        state={bulk.state}
        onStart={(names) => void bulk.start(names)}
        onCancel={bulk.cancel}
        onReset={bulk.reset}
        onBack={() => setBulkOpen(false)}
        onOpenDevice={openDevice}
        onSearchName={(name) => {
          setQuery(name);
          void submit(name);
        }}
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
        action={
          <EnrollmentFailuresHint onOpen={() => openTenantTile('tenantEnrollmentFailures')} />
        }
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
        extraChips={
          <>
            {mode === 'demo' && <ExampleZipChip onClick={() => void analyzeExample()} />}
            {extraChips}
          </>
        }
        onFile={startAnalysis}
        tools={
          <LandingTools
            ref={bookmarkletButton}
            onOpenBulk={openBulk}
            onOpenBookmarklet={() => setBookmarkletOpen(true)}
          />
        }
        recent={recentDevices.recent}
        mode={mode}
        onOpenRecent={openDevice}
        onClearRecent={recentDevices.clear}
      />
    );
  }

  const dragging = usePageFileDrop(showHero, startAnalysis);

  const liveStatus = state.loading
    ? de.a11y.searching
    : showPicker
      ? de.a11y.resultsFound(state.results.length)
      : showNotFound
        ? de.a11y.noResults
        : '';

  return (
    <div className="min-h-dvh bg-canvas text-label">
      <AmbientGlow
        tone={
          showDevice || showConnectionTest || showTenantLike || (showZip && zipReport)
            ? deviceTone
            : 'accent'
        }
      />
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
        {...(liveWithoutProvider
          ? {}
          : {
              onOpenTenant: openTenant,
              tenantActive: showTenant,
              onOpenPolicies: openPolicies,
              policiesActive: showPolicies,
            })}
        account={account}
      />
      {mode === 'live' && provider && !online && <OfflineBanner />}
      <main id="main" className="relative mx-auto max-w-[80rem] px-4 py-6 sm:px-8 sm:py-8">
        <p className="sr-only" role="status" aria-live="polite">
          {liveStatus}
        </p>
        {content}
      </main>
      <AnimatePresence>
        {bookmarkletOpen && (
          <BookmarkletDialog
            key="bookmarklet-dialog"
            onClose={() => {
              setBookmarkletOpen(false);
              bookmarkletButton.current?.focus();
            }}
          />
        )}
      </AnimatePresence>
      <DropOverlay visible={dragging} />
    </div>
  );
}
