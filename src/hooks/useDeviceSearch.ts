/**
 * Gerätesuche gegen den aktuellen Provider.
 * - search(query): sofort (Enter), bricht die vorherige Suche ab.
 * - suggest(query): debounced (nur für Vorschläge während der Eingabe).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppError, DeviceSearchResult } from '../domain/types';
import { ProviderError, type DeviceDataProvider } from '../providers/DeviceDataProvider';

export const SUGGEST_DEBOUNCE_MS = 250;
const SUGGEST_MIN_CHARS = 2;
const SUGGEST_MAX = 6;

/** Status der zuletzt abgeschlossenen Suche; ein laufender Request steht separat in `loading`. */
export type SearchStatus = 'idle' | 'done' | 'error';

export interface SearchState {
  status: SearchStatus;
  /** Läuft gerade eine Suche? (Ergebnisse der vorherigen bleiben bis zur Antwort sichtbar) */
  loading: boolean;
  /** Eingabe der zuletzt abgeschlossenen Suche */
  query: string;
  results: DeviceSearchResult[];
  error: AppError | null;
}

const IDLE: SearchState = { status: 'idle', loading: false, query: '', results: [], error: null };

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function toAppError(error: unknown): AppError {
  if (error instanceof ProviderError) return error.error;
  return { code: 'unknown', message: error instanceof Error ? error.message : String(error) };
}

export function useDeviceSearch(provider: DeviceDataProvider | null) {
  const [state, setState] = useState<SearchState>(IDLE);
  const [suggestions, setSuggestions] = useState<DeviceSearchResult[]>([]);
  const searchAbort = useRef<AbortController | null>(null);
  const suggestAbort = useRef<AbortController | null>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelSuggest = useCallback(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = null;
    suggestAbort.current?.abort();
    suggestAbort.current = null;
  }, []);

  useEffect(
    () => () => {
      searchAbort.current?.abort();
      cancelSuggest();
    },
    [cancelSuggest],
  );

  /** Sucht sofort und liefert die Treffer (null bei Abbruch/Fehler/ohne Provider). */
  const search = useCallback(
    async (rawQuery: string): Promise<DeviceSearchResult[] | null> => {
      const query = rawQuery.trim();
      cancelSuggest();
      setSuggestions([]);
      searchAbort.current?.abort();
      if (!query || !provider) {
        searchAbort.current = null;
        setState(IDLE);
        return null;
      }
      const controller = new AbortController();
      searchAbort.current = controller;
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const results = await provider.searchDevices(query, { signal: controller.signal });
        if (controller.signal.aborted) return null;
        setState({ status: 'done', loading: false, query, results, error: null });
        return results;
      } catch (error) {
        if (controller.signal.aborted || isAbort(error)) return null;
        setState({
          status: 'error',
          loading: false,
          query,
          results: [],
          error: toAppError(error),
        });
        return null;
      }
    },
    [provider, cancelSuggest],
  );

  const suggest = useCallback(
    (rawQuery: string) => {
      cancelSuggest();
      const query = rawQuery.trim();
      if (!provider || query.length < SUGGEST_MIN_CHARS) {
        setSuggestions([]);
        return;
      }
      suggestTimer.current = setTimeout(async () => {
        const controller = new AbortController();
        suggestAbort.current = controller;
        try {
          const results = await provider.searchDevices(query, { signal: controller.signal });
          if (!controller.signal.aborted) setSuggestions(results.slice(0, SUGGEST_MAX));
        } catch {
          if (!controller.signal.aborted) setSuggestions([]);
        }
      }, SUGGEST_DEBOUNCE_MS);
    },
    [provider, cancelSuggest],
  );

  const clearSuggestions = useCallback(() => {
    cancelSuggest();
    setSuggestions([]);
  }, [cancelSuggest]);

  const reset = useCallback(() => {
    searchAbort.current?.abort();
    searchAbort.current = null;
    cancelSuggest();
    setSuggestions([]);
    setState(IDLE);
  }, [cancelSuggest]);

  return { state, suggestions, search, suggest, clearSuggestions, reset };
}
