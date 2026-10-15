/**
 * Startet und überwacht die lokale Analyse einer DiagLogs-ZIP. Die Datei verlässt den Browser nie:
 * der Analysepfad (Worker bzw. Fallback) kennt keinen Netzwerkzugriff. Eine neue Datei, cancel(),
 * reset() und Unmount brechen eine laufende Analyse ab.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalysisProgress } from '../diagnostics/analyze';
import type { DiagnosticsReport } from '../diagnostics/types';
import { de } from '../i18n/de';

export type DiagnosticsAnalysisStatus = 'idle' | 'running' | 'done' | 'error';

export interface DiagnosticsAnalysisState {
  status: DiagnosticsAnalysisStatus;
  progress?: AnalysisProgress;
  report?: DiagnosticsReport;
  error?: string;
  fileName?: string;
}

const IDLE: DiagnosticsAnalysisState = { status: 'idle' };

export function isZipFileName(name: string): boolean {
  return name.toLowerCase().endsWith('.zip');
}

export function useDiagnosticsAnalysis() {
  const [state, setState] = useState<DiagnosticsAnalysisState>(IDLE);
  const controller = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
  }, []);

  // Unmount (z. B. Moduswechsel) bricht die Analyse ab.
  useEffect(() => abort, [abort]);

  const analyze = useCallback(
    async (file: File): Promise<void> => {
      abort();
      const fileName = file.name;
      if (!isZipFileName(fileName)) {
        setState({ status: 'error', fileName, error: de.zipView.errors.notZip });
        return;
      }

      const own = new AbortController();
      controller.current = own;
      setState({ status: 'running', fileName });
      try {
        // Lazy: Parser und ZIP-Leser landen nicht im Start-Bundle.
        const { runDiagnosticsAnalysis } = await import('../diagnostics/runAnalysis');
        const report = await runDiagnosticsAnalysis(file, {
          signal: own.signal,
          onProgress: (progress) => {
            if (!own.signal.aborted) setState({ status: 'running', fileName, progress });
          },
        });
        if (own.signal.aborted) return;
        if (report.entries.length === 0) {
          setState({ status: 'error', fileName, error: de.zipView.errors.invalid });
        } else {
          setState({ status: 'done', fileName, report });
        }
      } catch {
        if (own.signal.aborted) return;
        setState({ status: 'error', fileName, error: de.zipView.errors.invalid });
      } finally {
        if (controller.current === own) controller.current = null;
      }
    },
    [abort],
  );

  const reset = useCallback(() => {
    abort();
    setState(IDLE);
  }, [abort]);

  return { state, analyze, cancel: reset, reset };
}
