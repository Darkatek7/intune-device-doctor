/**
 * URL-State der App: ?device=<id>&mode=demo|live (+ &tile=<tileId> für ein offenes Detail-Sheet).
 * Die Ansicht „Mandant“ (M14/S5) ist ?view=tenant (ohne Gerät; &tile=<tileId> öffnet auch dort ein Sheet).
 * Änderungen laufen über history.pushState/replaceState; Browser-Zurück (popstate) wird mitgeführt.
 */
import { useMemo, useSyncExternalStore } from 'react';
import type { DataMode } from '../domain/types';

export interface UrlState {
  device: string | null;
  tile: string | null;
  mode: DataMode | null;
  /** Ansicht „Mandant“; fehlt/null = Start- bzw. Geräteansicht */
  view?: 'tenant' | null;
}

export function parseUrl(search: string): UrlState {
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  return {
    device: params.get('device') || null,
    tile: params.get('tile') || null,
    mode: mode === 'demo' || mode === 'live' ? mode : null,
    view: params.get('view') === 'tenant' ? 'tenant' : null,
  };
}

export function buildSearch(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.device) params.set('device', state.device);
  else if (state.view === 'tenant') params.set('view', 'tenant');
  if (state.mode) params.set('mode', state.mode);
  if ((state.device || state.view === 'tenant') && state.tile) params.set('tile', state.tile);
  const s = params.toString();
  return s ? `?${s}` : '';
}

const URL_CHANGE = 'mdmdoctor:urlchange';

/** Marker im history.state: Der Eintrag wurde von der App beim Öffnen eines Sheets angelegt. */
interface AppHistoryState {
  tileOpened?: boolean;
}

export function navigateTo(
  state: UrlState,
  options: { replace?: boolean; tileOpened?: boolean } = {},
): void {
  const url = `${window.location.pathname}${buildSearch(state)}`;
  const historyState: AppHistoryState = options.tileOpened ? { tileOpened: true } : {};
  if (options.replace) window.history.replaceState(historyState, '', url);
  else window.history.pushState(historyState, '', url);
  window.dispatchEvent(new Event(URL_CHANGE));
}

/** Schließt das Sheet: zurück, wenn der Eintrag von uns stammt, sonst Tile-Parameter entfernen. */
export function closeTileInHistory(current: UrlState): void {
  const historyState = window.history.state as AppHistoryState | null;
  if (historyState?.tileOpened) window.history.back();
  else navigateTo({ ...current, tile: null }, { replace: true });
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('popstate', callback);
  window.addEventListener(URL_CHANGE, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(URL_CHANGE, callback);
  };
}

const getSearch = () => window.location.search;

export function useUrlState(): UrlState {
  const search = useSyncExternalStore(subscribe, getSearch, () => '');
  return useMemo(() => parseUrl(search), [search]);
}
