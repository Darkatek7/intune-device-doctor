/**
 * Reine Logik der Quellenprüfung für die Ansicht „Empfehlungen“ (kein Netzwerk, kein Dateizugriff):
 * Artikeltext extrahieren, normalisieren, hashen, Sprungmarken prüfen, mit der Sperrdatei vergleichen.
 */
import { createHash } from 'node:crypto';
import { JSDOM, type DomDocument, type DomElement } from 'jsdom';

/** Sperrdatei `docs/posture-sources.lock.json` */
export interface LockFile {
  version: 1;
  pages: Record<string, LockPage>;
}

export interface LockPage {
  /** SHA-256 (hex) über den normalisierten Artikeltext */
  sha256: string;
  /** Datum aus dem Metadatum `ms.date` der Seite (YYYY-MM-DD); null, wenn nicht auslesbar */
  reportedDate: string | null;
  /** Geprüfte Sprungmarken (ohne `#`), sortiert */
  fragments: string[];
}

/** Ergebnis der Analyse einer abgerufenen Seite */
export interface PageAnalysis {
  sha256: string;
  reportedDate: string | null;
  /** Alle `id`-Attribute im Artikelinhalt */
  ids: string[];
  /** Länge des normalisierten Texts (Plausibilitätsprüfung) */
  textLength: number;
}

/** Ergebnis eines Abrufs je Seite */
export type PageFetch =
  | { page: string; kind: 'ok'; analysis: PageAnalysis }
  | { page: string; kind: 'gone'; httpStatus: number }
  | { page: string; kind: 'error'; message: string };

export type FindingKind =
  | 'changed'
  | 'missingAnchor'
  | 'gone'
  | 'notInLock'
  | 'extraInLock'
  | 'fragmentsOutdated'
  | 'fetchError';

export interface Finding {
  kind: FindingKind;
  page: string;
  /** Beschreibung auf Deutsch */
  message: string;
  /** Nur bei `missingAnchor` */
  fragment?: string;
  /** Nur bei `missingAnchor`: ähnlich benannte `id`s auf der Seite */
  similarIds?: string[];
}

export interface CheckReport {
  /** Befunde, die eine erneute Prüfung durch einen Menschen verlangen */
  findings: Finding[];
  /** Seiten, die nicht abgerufen werden konnten (kein Befund) */
  unverifiable: Finding[];
  /** 0 = unverändert, 1 = Befund, 2 = nur Abruffehler */
  exitCode: 0 | 1 | 2;
}

/** Bereiche innerhalb des Artikels, die wechseln, aber keinen Inhalt tragen. */
const NOISE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'template',
  'nav',
  'time',
  '.page-metadata-container',
  '#site-user-feedback-footer',
  '[data-bi-name="feedback"]',
  '[data-bi-name="page info"]',
  '.display-none-print',
  '.visually-hidden',
];

/** Text normalisieren: Unicode NFKC, Leerraum (auch geschützte Leerzeichen) zusammenfassen. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** `2026-07-02T00:00:00Z` → `2026-07-02`; alles andere → null */
export function parseReportedDate(value: string | null | undefined): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(value?.trim() ?? '');
  return match ? match[1] : null;
}

/**
 * Artikelinhalt einer Learn-Seite: das größte `div.content` in `main` (der Fließtext; das kleine
 * `div.content` davor ist nur die Kurzfassung für „Summarize“). Ohne Treffer: null.
 */
export function findArticle(doc: DomDocument): DomElement | null {
  const candidates = [...doc.querySelectorAll('main div.content')];
  let best: DomElement | null = null;
  let bestLength = 0;
  for (const el of candidates) {
    const length = el.textContent?.length ?? 0;
    if (length > bestLength) {
      best = el;
      bestLength = length;
    }
  }
  return best;
}

/** HTML einer Learn-Seite → Hash, Änderungsdatum und vorhandene Sprungmarken. Wirft, wenn kein Artikel gefunden wird. */
export function analyzeHtml(html: string): PageAnalysis {
  const doc = new JSDOM(html).window.document;
  const article = findArticle(doc);
  if (!article) throw new Error('Kein Artikelinhalt gefunden (Seitenaufbau geändert?)');

  const ids = [...article.querySelectorAll('[id]')].map((el) => el.id).filter(Boolean);

  const clone = article.cloneNode(true);
  for (const el of clone.querySelectorAll(NOISE_SELECTORS.join(','))) el.remove();
  const text = normalizeText(clone.textContent ?? '');
  if (text.length < 200) throw new Error(`Artikeltext auffällig kurz (${text.length} Zeichen)`);

  const reportedDate = parseReportedDate(
    doc.querySelector('meta[name="ms.date"]')?.getAttribute('content'),
  );
  return {
    sha256: sha256Hex(text),
    reportedDate,
    ids: [...new Set(ids)].sort(),
    textLength: text.length,
  };
}

/** Learn-URL auf die englische Fassung festlegen (`/en-us/` nach dem Host), Rest unverändert. */
export function toEnglishUrl(url: string): string {
  const u = new URL(url);
  if (!/^\/[a-z]{2}-[a-z]{2}\//i.test(u.pathname)) u.pathname = `/en-us${u.pathname}`;
  return u.toString();
}

/** Ähnlich benannte `id`s: gemeinsame Wörter mit der gesuchten Sprungmarke, beste zuerst (höchstens 5). */
export function similarIds(fragment: string, ids: string[]): string[] {
  const words = new Set(fragment.split('-').filter((w) => w.length > 2));
  return ids
    .map((id) => ({ id, score: id.split('-').filter((w) => words.has(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map((x) => x.id);
}

/** Erwartete Sprungmarken je Seite (sortiert, ohne Duplikate). */
export function fragmentsByPage(
  links: { page: string; fragment: string | null }[],
): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const { page, fragment } of links) {
    const set = map.get(page) ?? new Set<string>();
    if (fragment) set.add(fragment);
    map.set(page, set);
  }
  return new Map([...map.entries()].map(([page, set]) => [page, [...set].sort()]));
}

/** Sperrdatei aus Abrufergebnissen erzeugen (nur Seiten mit Status `ok`); Schlüssel sortiert. */
export function buildLock(fetches: PageFetch[], expected: Map<string, string[]>): LockFile {
  const pages: Record<string, LockPage> = {};
  for (const page of [...expected.keys()].sort()) {
    const f = fetches.find((x) => x.page === page);
    if (f?.kind !== 'ok') continue;
    pages[page] = {
      sha256: f.analysis.sha256,
      reportedDate: f.analysis.reportedDate,
      fragments: expected.get(page) ?? [],
    };
  }
  return { version: 1, pages };
}

/** Stabile Serialisierung der Sperrdatei (sortierte Schlüssel, 2 Leerzeichen, Zeilenumbruch am Ende). */
export function serializeLock(lock: LockFile): string {
  const pages: Record<string, LockPage> = {};
  for (const page of Object.keys(lock.pages).sort()) {
    const p = lock.pages[page];
    pages[page] = {
      sha256: p.sha256,
      reportedDate: p.reportedDate,
      fragments: [...p.fragments].sort(),
    };
  }
  return `${JSON.stringify({ version: 1, pages }, null, 2)}\n`;
}

/** Vergleich der Abrufe mit der Sperrdatei und den erwarteten Sprungmarken. */
export function compareWithLock(
  lock: LockFile,
  fetches: PageFetch[],
  expected: Map<string, string[]>,
): CheckReport {
  const findings: Finding[] = [];
  const unverifiable: Finding[] = [];

  for (const page of Object.keys(lock.pages)) {
    if (!expected.has(page)) {
      findings.push({
        kind: 'extraInLock',
        page,
        message: 'In der Sperrdatei, aber von keinem Verweis mehr genutzt – Sperrdatei erneuern.',
      });
    }
  }

  for (const [page, fragments] of expected) {
    const locked = lock.pages[page];
    if (!locked) {
      findings.push({
        kind: 'notInLock',
        page,
        message: 'Seite fehlt in der Sperrdatei – erst prüfen, dann Sperrdatei erneuern.',
      });
    } else if (JSON.stringify(locked.fragments) !== JSON.stringify(fragments)) {
      findings.push({
        kind: 'fragmentsOutdated',
        page,
        message:
          'Die Sprungmarken der Verweise weichen von der Sperrdatei ab – Sperrdatei erneuern.',
      });
    }

    const f = fetches.find((x) => x.page === page);
    if (!f) continue;
    if (f.kind === 'error') {
      unverifiable.push({ kind: 'fetchError', page, message: `Nicht prüfbar: ${f.message}` });
    } else if (f.kind === 'gone') {
      findings.push({
        kind: 'gone',
        page,
        message: `Seite nicht mehr vorhanden (HTTP ${f.httpStatus}) – verschoben oder gelöscht.`,
      });
    } else {
      if (locked && locked.sha256 !== f.analysis.sha256) {
        const date =
          f.analysis.reportedDate && f.analysis.reportedDate !== locked.reportedDate
            ? ` (Änderungsdatum der Seite: ${locked.reportedDate ?? 'unbekannt'} → ${f.analysis.reportedDate})`
            : '';
        findings.push({
          kind: 'changed',
          page,
          message: `Inhalt hat sich geändert${date}.`,
        });
      }
      for (const fragment of fragments) {
        if (!f.analysis.ids.includes(fragment)) {
          findings.push({
            kind: 'missingAnchor',
            page,
            fragment,
            similarIds: similarIds(fragment, f.analysis.ids),
            message: `Sprungmarke „#${fragment}“ fehlt auf der Seite.`,
          });
        }
      }
    }
  }

  const exitCode = findings.length > 0 ? 1 : unverifiable.length > 0 ? 2 : 0;
  return { findings, unverifiable, exitCode };
}

/** Lesbare deutsche Ausgabe. */
export function formatReport(report: CheckReport, pageCount: number): string {
  const lines: string[] = [];
  if (report.findings.length === 0 && report.unverifiable.length === 0) {
    lines.push(`Alle ${pageCount} Quellseiten unverändert, alle Sprungmarken vorhanden.`);
    return lines.join('\n');
  }
  if (report.findings.length > 0) {
    lines.push(`Befunde (${report.findings.length}) – Werte erneut gegen die Seite prüfen:`);
    for (const f of report.findings) {
      lines.push(`  - ${f.page}`, `      ${f.message}`);
      if (f.similarIds?.length) lines.push(`      Ähnliche ids: ${f.similarIds.join(', ')}`);
    }
  }
  if (report.unverifiable.length > 0) {
    lines.push(
      `Nicht prüfbar (${report.unverifiable.length}) – kein Befund, später erneut versuchen:`,
    );
    for (const f of report.unverifiable) lines.push(`  - ${f.page}`, `      ${f.message}`);
  }
  return lines.join('\n');
}
