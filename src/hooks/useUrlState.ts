/**
 * URL-State der App: ?device=<id>&mode=demo|live (+ &tile=<tileId> für ein offenes Detail-Sheet).
 * Die Ansicht „Mandant“ (M14/S5) ist ?view=tenant (ohne Gerät; &tile=<tileId> öffnet auch dort ein Sheet).
 * Der Verbindungstest (M14/S6, nur Live) ist ?view=connection-test&device=<id> (ohne Kachel-Sheet).
 * Die Ansicht „Richtlinien“ (M15) ist ?view=policies (+ &policy=<kind>:<id> für den Gerätestatus einer Richtlinie).
 * Die Ansicht „Empfehlungen“ (M21) ist ?view=recommendations (+ &level=1|2|3, nur wenn ≠ Standard; &tile=<tileId>).
 * Die Ansicht „Flotte“ (M22) ist ?view=fleet (+ &issue=<FleetIssue|any>, &platform=<OsFamily>,
 * &managed=<FleetManagement>[,<FleetManagement>…]; ungültige Werte entfallen).
 * Änderungen laufen über history.pushState/replaceState; Browser-Zurück (popstate) wird mitgeführt.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { DEFAULT_POSTURE_LEVEL, type PostureLevel } from '../domain/posture';
import type { DataMode, OsFamily } from '../domain/types';
import {
  FLEET_MANAGEMENTS,
  FLEET_PLATFORMS,
  isFleetIssue,
  type FleetIssue,
  type FleetManagement,
} from '../rules/fleetDevices';

export interface UrlState {
  device: string | null;
  tile: string | null;
  mode: DataMode | null;
  /** Ansicht „Mandant“ bzw. „Verbindungstest“; fehlt/null = Start- bzw. Geräteansicht */
  view?: 'tenant' | 'connectionTest' | 'policies' | 'recommendations' | 'fleet' | null;
  /** Nur in der Ansicht „Richtlinien“: geöffnete Richtlinie als `configuration:<id>` bzw. `compliance:<id>` */
  policy?: string | null;
  /** Nur in der Ansicht „Empfehlungen“: gewählte Stufe; fehlt/null = Standard */
  level?: PostureLevel | null;
  /** Nur in der Ansicht „Flotte“: Auffälligkeit (`any` = nur auffällige); fehlt/null = alle Geräte */
  issue?: FleetIssue | 'any' | null;
  /** Nur in der Ansicht „Flotte“: Plattformfilter; fehlt/null = alle */
  platform?: OsFamily | null;
  /** Nur in der Ansicht „Flotte“: „Verwaltet von“ (Mehrfachauswahl); fehlt/null/leer = alle */
  managed?: readonly FleetManagement[] | null;
}

function parseView(value: string | null): UrlState['view'] {
  if (value === 'tenant') return 'tenant';
  if (value === 'connection-test') return 'connectionTest';
  if (value === 'policies') return 'policies';
  if (value === 'recommendations') return 'recommendations';
  if (value === 'fleet') return 'fleet';
  return null;
}

function parseLevel(value: string | null): PostureLevel | null {
  return value === '1' ? 1 : value === '2' ? 2 : value === '3' ? 3 : null;
}

function parseIssue(value: string | null): FleetIssue | 'any' | null {
  if (value === 'any') return 'any';
  return isFleetIssue(value) ? value : null;
}

function parsePlatform(value: string | null): OsFamily | null {
  return FLEET_PLATFORMS.find((platform) => platform === value) ?? null;
}

/** Kommagetrennte Liste; ungültige und doppelte Werte entfallen, Reihenfolge wie `FLEET_MANAGEMENTS`. */
function parseManaged(value: string | null): FleetManagement[] | null {
  if (!value) return null;
  const wanted = new Set(value.split(','));
  const valid = FLEET_MANAGEMENTS.filter((management) => wanted.has(management));
  return valid.length > 0 ? valid : null;
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
    level: parseLevel(params.get('level')),
    issue: parseIssue(params.get('issue')),
    platform: parsePlatform(params.get('platform')),
    managed: parseManaged(params.get('managed')),
  };
}

export function buildSearch(state: UrlState): string {
  const params = new URLSearchParams();
  const connectionTest = Boolean(state.device) && state.view === 'connectionTest';
  if (state.device) params.set('device', state.device);
  else if (state.view === 'tenant') params.set('view', 'tenant');
  else if (state.view === 'policies') params.set('view', 'policies');
  else if (state.view === 'recommendations') params.set('view', 'recommendations');
  else if (state.view === 'fleet') params.set('view', 'fleet');
  if (connectionTest) params.set('view', 'connection-test');
  if (!state.device && state.view === 'policies' && state.policy) {
    params.set('policy', state.policy);
  }
  if (
    !state.device &&
    state.view === 'recommendations' &&
    state.level &&
    state.level !== DEFAULT_POSTURE_LEVEL
  ) {
    params.set('level', String(state.level));
  }
  if (!state.device && state.view === 'fleet') {
    if (state.issue) params.set('issue', state.issue);
    if (state.platform) params.set('platform', state.platform);
    if (state.managed && state.managed.length > 0) params.set('managed', state.managed.join(','));
  }
  if (state.mode) params.set('mode', state.mode);
  // Kachel-Sheets gibt es nur in der Geräte-, der Mandanten- und der Empfehlungen-Ansicht
  if (
    !connectionTest &&
    (state.device || state.view === 'tenant' || state.view === 'recommendations') &&
    state.tile
  ) {
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
