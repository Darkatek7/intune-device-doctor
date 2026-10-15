/**
 * Microsoft-Graph-Client – READ-ONLY: bietet ausschließlich GET (`get`, `getAllPages`).
 *
 * - URLs kommen ausschließlich aus src/graph/endpoints.ts (Pfad) bzw. aus `@odata.nextLink`
 *   (nur akzeptiert, wenn er auf https://graph.microsoft.com/ zeigt).
 * - Fehler werden als GraphRequestError (mit AppError) geworfen; Abbruch bleibt eine
 *   DOMException 'AbortError'.
 * - 429/503/504 und Netzwerkfehler: max. 3 Versuche, `Retry-After` (Sekunden) wird respektiert,
 *   sonst exponentieller Backoff (1 s, 2 s). https://learn.microsoft.com/en-us/graph/throttling
 */
import type { AppError, AppErrorCode } from '../domain/types';
import { de } from '../i18n/de';
import type { GraphCollection, GraphErrorBody } from './dto';
import { GRAPH_BASE_URL } from './endpoints';

const GRAPH_ORIGIN = 'https://graph.microsoft.com';

/** Insgesamt 3 Versuche (= bis zu 2 Wiederholungen). */
export const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 1000;
/** Längere Retry-After-Wartezeiten blockieren die UI – dann sofort mit throttled-Fehler abbrechen. */
export const MAX_RETRY_WAIT_SECONDS = 30;
export const DEFAULT_MAX_PAGES = 5;

export class GraphRequestError extends Error {
  readonly error: AppError;
  constructor(error: AppError) {
    super(error.message);
    this.name = 'GraphRequestError';
    this.error = error;
  }
}

export type SleepFn = (ms: number, signal?: AbortSignal) => Promise<void>;

export interface GraphClientOptions {
  /** Liefert ein gültiges Access-Token (MSAL) für Microsoft Graph. */
  getToken: () => Promise<string>;
  /** Für Tests; Standard: globales fetch. */
  fetchImpl?: typeof fetch;
  /** Für Tests; Standard: abbrechbarer setTimeout. */
  sleep?: SleepFn;
}

export interface GraphRequestOptions {
  signal?: AbortSignal;
  /** Wird bei 403 als `requiredScope` im Fehler gesetzt. */
  scope?: string;
}

export interface GraphPagingOptions extends GraphRequestOptions {
  maxPages?: number;
}

/** Bewusst nur lesende Methoden – kein post/put/patch/delete. */
export interface GraphClient {
  get<T>(endpointPathOrNextLink: string, options?: GraphRequestOptions): Promise<T>;
  getAllPages<T>(path: string, options?: GraphPagingOptions): Promise<T[]>;
}

function abortError(): DOMException {
  return new DOMException(de.errors.aborted, 'AbortError');
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

const defaultSleep: SleepFn = (ms, signal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

function newRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  // Fallback für sehr alte Umgebungen – nur zur Korrelation in Graph-Logs.
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

/** Pfad (beginnt mit "/") oder absoluter nextLink → vollständige, geprüfte Graph-URL. */
export function resolveGraphUrl(pathOrNextLink: string): string {
  if (pathOrNextLink.startsWith('/')) return `${GRAPH_BASE_URL}${pathOrNextLink}`;
  if (pathOrNextLink.startsWith(`${GRAPH_ORIGIN}/`)) {
    try {
      const url = new URL(pathOrNextLink);
      if (url.origin === GRAPH_ORIGIN && !url.username && !url.password) return url.toString();
    } catch {
      // fällt in den Fehlerzweig
    }
  }
  throw new GraphRequestError({ code: 'graph', message: de.errors.invalidNextLink });
}

/** Retry-After in Sekunden (numerischer Wert); HTTP-Datumsformat wird in Sekunden umgerechnet. */
function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  return undefined;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 504;
}

async function readErrorBody(response: Response): Promise<GraphErrorBody['error'] | undefined> {
  try {
    const body = (await response.json()) as Partial<GraphErrorBody> | null;
    return body?.error;
  } catch {
    return undefined;
  }
}

async function toAppError(response: Response, scope: string | undefined): Promise<AppError> {
  const body = await readErrorBody(response);
  const status = response.status;
  let code: AppErrorCode;
  let message: string;
  switch (status) {
    case 401:
      code = 'unauthenticated';
      message = de.errors.unauthenticated;
      break;
    case 403:
      code = 'forbidden';
      message = de.errors.forbidden;
      break;
    case 404:
      code = 'notFound';
      message = de.errors.notFound;
      break;
    case 429:
    case 503:
      code = 'throttled';
      message = de.errors.throttled;
      break;
    default:
      code = 'graph';
      message = de.errors.graph;
  }
  const error: AppError = { code, message, httpStatus: status };
  if (body?.code) error.graphCode = body.code;
  const requestId = body?.innerError?.['request-id'] ?? response.headers.get('request-id');
  if (requestId) error.requestId = requestId;
  if (code === 'throttled') {
    const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
    if (retryAfter !== undefined) error.retryAfterSeconds = retryAfter;
  }
  if (code === 'forbidden' && scope) error.requiredScope = scope;
  return error;
}

export function createGraphClient(options: GraphClientOptions): GraphClient {
  const { getToken } = options;
  const sleep = options.sleep ?? defaultSleep;
  const doFetch = (input: string, init: RequestInit) =>
    (options.fetchImpl ?? globalThis.fetch)(input, init);

  async function get<T>(
    endpointPathOrNextLink: string,
    { signal, scope }: GraphRequestOptions = {},
  ): Promise<T> {
    const url = resolveGraphUrl(endpointPathOrNextLink);

    for (let attempt = 1; ; attempt++) {
      if (signal?.aborted) throw abortError();
      const canRetry = attempt < MAX_ATTEMPTS;
      const backoffMs = BACKOFF_BASE_MS * 2 ** (attempt - 1);

      let token: string;
      try {
        token = await getToken();
      } catch (error) {
        if (isAbortError(error) || error instanceof GraphRequestError) throw error;
        throw new GraphRequestError({
          code: 'unauthenticated',
          message: de.errors.unauthenticated,
        });
      }
      if (signal?.aborted) throw abortError();

      let response: Response;
      try {
        response = await doFetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'client-request-id': newRequestId(),
            Accept: 'application/json',
          },
          signal,
        });
      } catch (error) {
        if (isAbortError(error) || signal?.aborted) throw abortError();
        if (canRetry) {
          await sleep(backoffMs, signal);
          continue;
        }
        throw new GraphRequestError({ code: 'network', message: de.errors.network });
      }

      if (response.ok) {
        if (response.status === 204) return undefined as T;
        try {
          return (await response.json()) as T;
        } catch (error) {
          if (isAbortError(error) || signal?.aborted) throw abortError();
          throw new GraphRequestError({
            code: 'parse',
            message: de.errors.parse,
            httpStatus: response.status,
          });
        }
      }

      if (isRetryableStatus(response.status) && canRetry) {
        const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
        if (retryAfter === undefined || retryAfter <= MAX_RETRY_WAIT_SECONDS) {
          await sleep(retryAfter !== undefined ? retryAfter * 1000 : backoffMs, signal);
          continue;
        }
      }

      throw new GraphRequestError(await toAppError(response, scope));
    }
  }

  async function getAllPages<T>(
    path: string,
    { maxPages = DEFAULT_MAX_PAGES, signal, scope }: GraphPagingOptions = {},
  ): Promise<T[]> {
    const items: T[] = [];
    let next: string | undefined = path;
    for (let page = 0; next && page < maxPages; page++) {
      const collection: GraphCollection<T> = await get<GraphCollection<T>>(next, { signal, scope });
      if (Array.isArray(collection?.value)) items.push(...collection.value);
      next = collection?.['@odata.nextLink'];
    }
    return items;
  }

  return { get, getAllPages };
}
