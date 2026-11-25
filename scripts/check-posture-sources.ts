/**
 * CLI: prüft, ob sich die Learn-Seiten hinter den Sollwerten der Ansicht „Empfehlungen“ geändert haben.
 *
 *   npm run posture:sources                      prüfen gegen docs/posture-sources.lock.json
 *   npm run posture:sources -- --update          Sperrdatei neu schreiben (nach erneuter Prüfung der Werte!)
 *   npm run posture:sources -- --json out.json   zusätzlich maschinenlesbarer Bericht
 *   npm run posture:sources -- --lock andere.json  andere Sperrdatei verwenden (Tests)
 *
 * Exit-Codes: 0 unverändert · 1 Befund (Inhalt geändert, Anker fehlt, Seite weg, Sperrdatei unvollständig)
 *             · 2 nur Abruffehler (nicht prüfbar).
 * Es werden nur GET-Anfragen gesendet; Werte werden nie automatisch übernommen.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { postureSourceLinks, postureSourcePages } from '../src/rules/posture/sources';
import {
  analyzeHtml,
  buildLock,
  compareWithLock,
  formatReport,
  fragmentsByPage,
  serializeLock,
  toEnglishUrl,
  type LockFile,
  type PageFetch,
} from './posture-sources/core';

const USER_AGENT = 'posture-source-check/1.0';
const ATTEMPTS = 3;
const TIMEOUT_MS = 30_000;
const CONCURRENCY = 3;
const DEFAULT_LOCK = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'docs',
  'posture-sources.lock.json',
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function retryDelayMs(attempt: number, retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  if (retryAfter && Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds, 60) * 1000;
  return 2000 * attempt;
}

async function fetchPage(page: string): Promise<PageFetch> {
  const url = toEnglishUrl(page);
  let lastError = 'unbekannter Fehler';
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    let retryAfter: string | null = null;
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 404 || res.status === 410)
        return { page, kind: 'gone', httpStatus: res.status };
      if (res.ok) {
        try {
          return { page, kind: 'ok', analysis: analyzeHtml(await res.text()) };
        } catch (e) {
          // Kein Artikel erkennbar: kein Inhaltsbefund, sondern „nicht prüfbar“ (Seitenaufbau).
          return { page, kind: 'error', message: e instanceof Error ? e.message : String(e) };
        }
      }
      lastError = `HTTP ${res.status}`;
      retryAfter = res.headers.get('Retry-After');
      if (res.status < 500 && res.status !== 429)
        return { page, kind: 'error', message: lastError };
    } catch (e) {
      lastError =
        e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
          ? `Zeitüberschreitung nach ${TIMEOUT_MS / 1000} s`
          : `Netzwerkfehler (${e instanceof Error ? e.message : String(e)})`;
    }
    if (attempt < ATTEMPTS) await sleep(retryDelayMs(attempt, retryAfter));
  }
  return { page, kind: 'error', message: `${lastError} nach ${ATTEMPTS} Versuchen` };
}

async function fetchAll(pages: string[]): Promise<PageFetch[]> {
  const results: PageFetch[] = new Array(pages.length);
  let next = 0;
  const worker = async () => {
    while (next < pages.length) {
      const i = next++;
      results[i] = await fetchPage(pages[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pages.length) }, worker));
  return results;
}

function readLock(path: string): LockFile {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as LockFile;
    if (parsed.version === 1 && parsed.pages) return parsed;
  } catch {
    // fehlend/defekt: leere Sperrdatei, alle Seiten erscheinen als „fehlt in der Sperrdatei“
  }
  return { version: 1, pages: {} };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main(): Promise<number> {
  const update = process.argv.includes('--update');
  const jsonPath = arg('--json');
  const lockPath = resolve(arg('--lock') ?? DEFAULT_LOCK);

  const pages = postureSourcePages();
  const expected = fragmentsByPage(postureSourceLinks());
  console.log(`Rufe ${pages.length} Learn-Seiten ab …`);
  const fetches = await fetchAll(pages);

  let lock = readLock(lockPath);
  if (update) {
    const failed = fetches.filter((f) => f.kind !== 'ok');
    if (failed.length > 0) {
      for (const f of failed) {
        console.error(`${f.page}: ${f.kind === 'error' ? f.message : `HTTP ${f.httpStatus}`}`);
      }
      console.error('Sperrdatei NICHT geschrieben: nicht alle Seiten konnten gelesen werden.');
      return failed.some((f) => f.kind === 'gone') ? 1 : 2;
    }
    lock = buildLock(fetches, expected);
    mkdirSync(dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, serializeLock(lock));
    console.log(`Sperrdatei geschrieben: ${lockPath}`);
  }

  const report = compareWithLock(lock, fetches, expected);
  console.log(formatReport(report, pages.length));
  if (jsonPath) {
    writeFileSync(
      jsonPath,
      `${JSON.stringify({ exitCode: report.exitCode, pages: pages.length, findings: report.findings, unverifiable: report.unverifiable }, null, 2)}\n`,
    );
  }
  return report.exitCode;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(2);
  },
);
