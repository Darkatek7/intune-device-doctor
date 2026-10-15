/**
 * Lädt nach der ZIP-Analyse die Namen der auffälligen Win32-Apps (Failed / Neustart ausstehend) über
 * den aktiven Provider nach – Graph im Live-Modus, Mock-Katalog im Demo-Modus – und hängt sie als
 * `resolvedApps` an den Report. Schlägt das fehl (z. B. fehlende Berechtigung), bleiben die IDs sichtbar.
 */
import { useEffect, useMemo, useState } from 'react';
import type { DiagnosticsReport } from '../diagnostics/types';
import type { AppInfo } from '../domain/types';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';

const NOTABLE = new Set(['failed', 'installedpendingreboot']);

export function notableAppIds(report: DiagnosticsReport): string[] {
  return report.win32Apps
    .filter((app) => NOTABLE.has(app.status?.toLowerCase() ?? ''))
    .map((app) => app.appId);
}

export function useResolvedApps<T extends DiagnosticsReport | undefined | null>(
  provider: DeviceDataProvider | null,
  report: T,
): T {
  const [resolved, setResolved] = useState<{
    report: DiagnosticsReport;
    provider: DeviceDataProvider;
    apps: Record<string, AppInfo>;
  } | null>(null);

  useEffect(() => {
    if (!report || !provider) return;
    const ids = notableAppIds(report);
    if (ids.length === 0) return;
    const controller = new AbortController();
    provider
      .getMobileApps(ids, { signal: controller.signal })
      .then((result) => {
        if (result.status !== 'ok') return;
        const apps = Object.fromEntries(result.data.map((app) => [app.id.toLowerCase(), app]));
        setResolved({ report, provider, apps });
      })
      .catch(() => {
        // Abbruch oder Fehler: Anzeige bleibt bei den App-IDs.
      });
    return () => controller.abort();
  }, [report, provider]);

  return useMemo(() => {
    if (!report || !resolved || resolved.report !== report || resolved.provider !== provider) {
      return report;
    }
    return { ...report, resolvedApps: resolved.apps } as T;
  }, [report, provider, resolved]);
}
