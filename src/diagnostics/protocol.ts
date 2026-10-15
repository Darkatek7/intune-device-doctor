/** Nachrichten zwischen Hauptthread und Analyse-Worker (nur Typen, keine Laufzeit-Abhängigkeiten). */
import type { AnalysisProgress } from './analyze';
import type { DiagnosticsReport } from './types';

export type WorkerRequest = { type: 'analyze'; file: File };

export type WorkerResponse =
  | ({ type: 'progress' } & AnalysisProgress)
  | { type: 'result'; report: DiagnosticsReport }
  | { type: 'error'; message: string };
