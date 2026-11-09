/**
 * Zustand der Sammelprüfung (M12/B3). Lebt in der App-Shell, damit die Tabelle erhalten bleibt, wenn
 * ein Gerät geöffnet wird und man mit „Zurück“ wiederkommt. Nichts wird gespeichert.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { pendingRows, type BulkRow } from '../rules/bulkCheck';
import { runBulkCheck } from './bulkRunner';

export type BulkStatus = 'idle' | 'running' | 'done' | 'cancelled';

export interface BulkState {
  status: BulkStatus;
  rows: BulkRow[];
  /** Zeitpunkt der Prüfung (für relative Zeiten und Bewertung) */
  checkedAt: Date;
  /** Sekunden bis zum nächsten Versuch, solange gedrosselt */
  throttleSeconds: number | null;
}

export function useBulkCheck(provider: DeviceDataProvider | null) {
  const [state, setState] = useState<BulkState>(() => ({
    status: 'idle',
    rows: [],
    checkedAt: new Date(),
    throttleSeconds: null,
  }));
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const start = useCallback(
    async (names: string[]) => {
      if (!provider || names.length === 0) return;
      controller.current?.abort();
      const own = new AbortController();
      controller.current = own;
      setState({
        status: 'running',
        rows: pendingRows(names),
        checkedAt: new Date(),
        throttleSeconds: null,
      });
      await runBulkCheck({
        names,
        provider,
        signal: own.signal,
        onRow: (index, row) => {
          if (own.signal.aborted) return;
          setState((prev) => ({ ...prev, rows: prev.rows.map((r, i) => (i === index ? row : r)) }));
        },
        onThrottle: (seconds) => {
          if (!own.signal.aborted) setState((prev) => ({ ...prev, throttleSeconds: seconds }));
        },
      });
      if (controller.current !== own) return;
      controller.current = null;
      setState((prev) => ({
        ...prev,
        status: own.signal.aborted ? 'cancelled' : 'done',
        throttleSeconds: null,
        rows: prev.rows.map((r) =>
          r.status === 'pending' || r.status === 'running' ? { ...r, status: 'cancelled' } : r,
        ),
      }));
    },
    [provider],
  );

  const cancel = useCallback(() => {
    const own = controller.current;
    if (!own) return;
    own.abort();
    controller.current = null;
    setState((prev) => ({
      ...prev,
      status: 'cancelled',
      throttleSeconds: null,
      rows: prev.rows.map((r) =>
        r.status === 'pending' || r.status === 'running' ? { ...r, status: 'cancelled' } : r,
      ),
    }));
  }, []);

  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState({ status: 'idle', rows: [], checkedAt: new Date(), throttleSeconds: null });
  }, []);

  return { state, start, cancel, reset };
}
