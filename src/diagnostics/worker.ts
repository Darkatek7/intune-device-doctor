/**
 * Web Worker: analysiert das ZIP abseits des UI-Threads. Das ZIP verlässt den Browser nie.
 */
import { analyzeDiagnosticsZip } from './analyze';
import type { WorkerRequest, WorkerResponse } from './protocol';

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
};

ctx.onmessage = async (event) => {
  const request = event.data;
  if (request.type !== 'analyze') return;
  try {
    const report = await analyzeDiagnosticsZip(request.file, {
      onProgress: (progress) => ctx.postMessage({ type: 'progress', ...progress }),
    });
    ctx.postMessage({ type: 'result', report });
  } catch (error) {
    ctx.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
