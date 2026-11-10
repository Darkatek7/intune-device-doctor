/**
 * URL-State der App: ?device=<id>&mode=demo|live (+ &tile=<tileId> für ein offenes Detail-Sheet).
 * Die Ansicht „Mandant“ (M14/S5) ist ?view=tenant (ohne Gerät; &tile=<tileId> öffnet auch dort ein Sheet).
 * Der Verbindungstest (M14/S6, nur Live) ist ?view=connection-test&device=<id> (ohne Kachel-Sheet).
 * Die Ansicht „Richtlinien“ (M15) ist ?view=policies (+ &policy=<kind>:<id> für den Gerätestatus einer Richtlinie).
 * Änderungen laufen über history.pushState/replaceState; Browser-Zurück (popstate) wird mitgeführt.
 */
import { useMemo, useSyncExternalStore } from 'react';
import type { DataMode } from '../domain/types';

export interface UrlState {
  device: string | null;
  tile: string | null;
  mode: DataMode | null;
  /** Ansicht „Mandant“ bzw. „Verbindungstest“; fehlt/null = Start- bzw. Geräteansicht */
  view?: 'tenant' | 'connectionTest' | 'policies' | null;
  /** Nur in der Ansicht „Richtlinien“: geöffnete Richtlinie als `configuration:<id>` bzw. `compliance:<id>` */
  policy?: string | null;
}

function parseView(value: string | null): UrlState['view'] {
  if (value === 'tenant') return 'tenant';
  if (value === 'connection-test') return 'connectionTest';
  if (value === 'policies') return 'policies';
  return null;
}

export function parseUrl(search: string): UrlState {
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  return {
    device: params.get('device') || null,
    tile: params.get('tile') || null,
    mode: mode === 'demo' || mode === 'live' ? mode : null,
    view: parseView(params.get('view')),
    policy: params.get('policy') || null,
  };
}

export function buildSearch(state: UrlState): string {
  const params = new URLSearchParams();
  const connectionTest = Boolean(state.device) && state.view === 'connectionTest';
  if (state.device) params.set('device', state.device);
  else if (state.view === 'tenant') params.set('view', 'tenant');
  else if (state.view === 'policies') params.set('view', 'policies');
  if (connectionTest) params.set('view', 'connection-test');
  if (!state.device && state.view === 'policies' && state.policy) {
    params.set('policy', state.policy);
  }
  if (state.mode) params.set('mode', state.mode);
  // Kachel-Sheets gibt es nur in der Geräte- und der Mandanten-Ansicht
  if (!connectionTest && (state.device || state.view === 'tenant') && state.tile) {
    params.set('tile', state.tile);
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

const URL_CHANGE = 'mdmdoctor:urlchange';

/** Marker im history.state: Der Eintrag wurde von der App beim Öffnen eines Sheets angelegt. */
interface AppHistoryState {
  tileOpened?: boolean;
  /** Ansicht „Richtlinien“: Eintrag beim Öffnen einer Richtlinie angelegt */
  policyOpened?: boolean;
}

export function navigateTo(
  state: UrlState,
  options: { replace?: boolean; tileOpened?: boolean; policyOpened?: boolean } = {},
): void {
  const url = `${window.location.pathname}${buildSearch(state)}`;
  const historyState: AppHistoryState = {
    ...(options.tileOpened ? { tileOpened: true } : {}),
    ...(options.policyOpened ? { policyOpened: true } : {}),
  };
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

/** Zurück zur Richtlinienliste: zurück, wenn der Eintrag von uns stammt, sonst Parameter entfernen. */
export function closePolicyInHistory(current: UrlState): void {
  const historyState = window.history.state as AppHistoryState | null;
  if (historyState?.policyOpened) window.history.back();
  else navigateTo({ ...current, policy: null }, { replace: true });
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
