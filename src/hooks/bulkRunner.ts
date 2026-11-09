/**
 * Läuft die Sammelprüfung ab (M12/B3): pro Name genau eine Anfrage `provider.searchDevices`,
 * höchstens `concurrency` (Standard 2) gleichzeitig, `Retry-After` bei 429 für ALLE Worker
 * respektiert, jederzeit abbrechbar.
 */
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { rowFromResults, type BulkRow } from '../rules/bulkCheck';
import { isAbort, toAppError } from './useDeviceSearch';

export const BULK_CONCURRENCY = 2;
const MAX_RETRIES = 3;
const DEFAULT_RETRY_SECONDS = 5;
const MAX_RETRY_SECONDS = 120;

export interface BulkRunOptions {
  names: readonly string[];
  provider: DeviceDataProvider;
  signal: AbortSignal;
  /** Zeile i hat einen neuen Stand */
  onRow: (index: number, row: BulkRow) => void;
  /** Gedrosselt: Wartezeit in Sekunden (null = Drosselung vorbei) */
  onThrottle?: (seconds: number | null) => void;
  concurrency?: number;
  /** Testnaht */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
}

export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });
}

export async function runBulkCheck(options: BulkRunOptions): Promise<void> {
  const {
    names,
    provider,
    signal,
    onRow,
    onThrottle,
    concurrency = BULK_CONCURRENCY,
    sleep = abortableSleep,
    now = Date.now,
  } = options;
  let next = 0;
  let pauseUntil = 0;

  const waitForPause = async () => {
    while (!signal.aborted && now() < pauseUntil) {
      onThrottle?.(Math.ceil((pauseUntil - now()) / 1000));
      await sleep(Math.min(pauseUntil - now(), 1000), signal);
    }
    if (!signal.aborted) onThrottle?.(null);
  };

  const check = async (index: number) => {
    const name = names[index]!;
    onRow(index, { name, status: 'running', matchCount: 0, device: null });
    for (let attempt = 0; ; attempt++) {
      await waitForPause();
      if (signal.aborted) return;
      try {
        const results = await provider.searchDevices(name, { signal });
        if (signal.aborted) return;
        onRow(index, rowFromResults(name, results));
        return;
      } catch (error) {
        if (signal.aborted || isAbort(error)) return;
        const appError = toAppError(error);
        if (appError.code === 'throttled' && attempt < MAX_RETRIES) {
          const seconds = Math.min(
            Math.max(appError.retryAfterSeconds ?? DEFAULT_RETRY_SECONDS, 1),
            MAX_RETRY_SECONDS,
          );
          pauseUntil = Math.max(pauseUntil, now() + seconds * 1000);
          continue;
        }
        onRow(index, {
          name,
          status: 'error',
          matchCount: 0,
          device: null,
          errorMessage: appError.message,
        });
        return;
      }
    }
  };

  const worker = async () => {
    while (!signal.aborted && next < names.length) {
      const index = next++;
      await check(index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, names.length) }, worker));
}
