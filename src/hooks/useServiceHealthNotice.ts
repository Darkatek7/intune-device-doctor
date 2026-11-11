/**
 * Dienststatus für den Hinweis in der Geräteansicht (M18): einmal pro Sitzung und Provider laden und
 * zwischenspeichern. Fehlt der Scope, schlägt der Abruf fehl oder meldet Microsoft keinen offenen
 * Intune-Vorfall, liefert der Hook eine leere Liste – der Hinweis erscheint dann einfach nicht.
 *
 * Der Hinweis lässt sich für die Sitzung ausblenden. Gemerkt werden nur die Kennungen der Vorfälle
 * (Microsoft-Vorfallsnummern, keine Mandanten- oder Gerätedaten) in `sessionStorage`; meldet Microsoft
 * einen weiteren Vorfall, erscheint der Hinweis wieder.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ServiceHealthIssueInfo } from '../domain/types';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { openIntuneIncidents } from '../rules/service';

const cache = new WeakMap<DeviceDataProvider, Promise<ServiceHealthIssueInfo[]>>();

function load(provider: DeviceDataProvider): Promise<ServiceHealthIssueInfo[]> {
  let promise = cache.get(provider);
  if (!promise) {
    // Bewusst ohne AbortSignal: Das Ergebnis gilt für die ganze Sitzung, auch nach einem Gerätewechsel.
    promise = provider
      .getServiceHealth()
      .then((result) => (result.status === 'ok' ? openIntuneIncidents(result.data) : []))
      .catch(() => []);
    cache.set(provider, promise);
  }
  return promise;
}

const DISMISSED_KEY = 'mdm-doctor.serviceNoticeDismissed';

/** Stabile Kennung der gemeldeten Vorfälle (Reihenfolge unabhängig). */
export const incidentsKey = (incidents: ServiceHealthIssueInfo[]): string =>
  incidents
    .map((incident) => incident.id)
    .sort()
    .join('|');

function readDismissed(): string | null {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function writeDismissed(key: string): void {
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, key);
  } catch {
    // Speicher nicht verfügbar – der Hinweis bleibt bis zum Neuladen ausgeblendet.
  }
}

/** Nur für Tests: Zwischenspeicher eines Providers verwerfen. */
export function resetServiceHealthNotice(provider: DeviceDataProvider): void {
  cache.delete(provider);
}

export function useServiceHealthNotice(provider: DeviceDataProvider): ServiceHealthIssueInfo[] {
  const [settled, setSettled] = useState<{
    provider: DeviceDataProvider;
    incidents: ServiceHealthIssueInfo[];
  } | null>(null);
  useEffect(() => {
    let active = true;
    void load(provider).then((incidents) => {
      if (active) setSettled({ provider, incidents });
    });
    return () => {
      active = false;
    };
  }, [provider]);
  return settled && settled.provider === provider ? settled.incidents : [];
}

/** Ausblenden für die Sitzung: gilt genau für die aktuell gemeldeten Vorfälle. */
export function useNoticeDismissal(incidents: ServiceHealthIssueInfo[]): {
  dismissed: boolean;
  dismiss: () => void;
} {
  const key = incidentsKey(incidents);
  const [dismissedKey, setDismissedKey] = useState(readDismissed);
  const dismiss = useCallback(() => {
    writeDismissed(key);
    setDismissedKey(key);
  }, [key]);
  return { dismissed: key !== '' && dismissedKey === key, dismiss };
}
