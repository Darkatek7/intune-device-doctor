/**
 * Client-Seite der ZIP-Analyse: startet den Web Worker, leitet Fortschritt weiter und beendet
 * den Worker bei Abbruch oder Ende. Ohne Worker-Unterstützung (jsdom/Tests) läuft die Analyse direkt.
 */
import { de } from '../i18n/de';
import { analyzeDiagnosticsZip, type AnalysisProgress } from './analyze';
import type { WorkerRequest, WorkerResponse } from './protocol';
import type { DiagnosticsReport } from './types';

export interface RunAnalysisOptions {
  onProgress?: (progress: AnalysisProgress) => void;
  signal?: AbortSignal;
}

function abortError(): DOMException {
  return new DOMException(de.diagnostics.aborted, 'AbortError');
}

export function runDiagnosticsAnalysis(
  file: File,
  options: RunAnalysisOptions = {},
): Promise<DiagnosticsReport> {
  const { onProgress, signal } = options;
  if (signal?.aborted) return Promise.reject(abortError());

  if (typeof Worker === 'undefined') {
    const direct = { ...(onProgress ? { onProgress } : {}), ...(signal ? { signal } : {}) };
    return analyzeDiagnosticsZip(file, direct);
  }

  return new Promise<DiagnosticsReport>((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

    const finish = (action: () => void): void => {
      signal?.removeEventListener('abort', onAbort);
      worker.terminate();
      action();
    };
    const onAbort = (): void => finish(() => reject(abortError()));
    signal?.addEventListener('abort', onAbort, { once: true });

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === 'progress') {
        onProgress?.({
          stage: message.stage,
          message: message.message,
          completed: message.completed,
          total: message.total,
        });
      } else if (message.type === 'result') {
        finish(() => resolve(message.report));
      } else {
        finish(() => reject(new Error(message.message)));
      }
    };
    worker.onerror = (event) => {
      finish(() => reject(new Error(event.message || de.diagnostics.workerError)));
    };

    const request: WorkerRequest = { type: 'analyze', file };
    worker.postMessage(request);
  });
}
