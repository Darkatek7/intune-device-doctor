/**
 * Dienststatus für den Hinweis in der Geräteansicht (M18): einmal pro Sitzung und Provider laden und
 * zwischenspeichern. Fehlt der Scope, schlägt der Abruf fehl oder meldet Microsoft keinen offenen
 * Intune-Vorfall, liefert der Hook eine leere Liste – der Hinweis erscheint dann einfach nicht.
 */
import { useEffect, useState } from 'react';
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
