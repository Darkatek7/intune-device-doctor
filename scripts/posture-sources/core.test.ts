import { describe, expect, it } from 'vitest';
import {
  analyzeHtml,
  compareWithLock,
  fragmentsByPage,
  normalizeText,
  parseReportedDate,
  serializeLock,
  similarIds,
  toEnglishUrl,
  type LockFile,
  type PageFetch,
} from './core';

const BODY = 'Compliance policies are rules and settings that devices must meet. '.repeat(6);

function html(opts: { body?: string; date?: string; footer?: string; nav?: string } = {}): string {
  return `<html><head><meta name="ms.date" content="${opts.date ?? '2026-07-02T00:00:00Z'}"></head><body>
  <nav>${opts.nav ?? 'Table of contents'}</nav>
  <main><div class="content">Kurzfassung</div>
  <div class="content"><h2 id="first-section">First section</h2><p>${opts.body ?? BODY}</p>
  <h3 id="second">Second</h3><p>mehr</p></div>
  <div id="article-metadata-footer" class="page-metadata-container">Last updated on ${opts.footer ?? '2026-07-02'}</div>
  <section id="site-user-feedback-footer">Was this page helpful?</section></main></body></html>`;
}

const PAGE = 'https://learn.microsoft.com/intune/x';

describe('Normalisierung und Hash', () => {
  it('fasst Leerraum und geschützte Leerzeichen zusammen', () => {
    expect(normalizeText('  a \n\t b c  ')).toBe('a b c');
  });

  it('ist unabhängig von Navigation, Fußzeile und Änderungsdatum', () => {
    const a = analyzeHtml(html());
    const b = analyzeHtml(
      html({ footer: '2027-01-01', nav: 'Anderes Menü', date: '2027-01-01T00:00:00Z' }),
    );
    expect(b.sha256).toBe(a.sha256);
    expect(b.reportedDate).toBe('2027-01-01');
  });

  it('ändert sich, sobald der Artikeltext sich ändert', () => {
    expect(analyzeHtml(html({ body: `${BODY} Neuer Wert: 12` })).sha256).not.toBe(
      analyzeHtml(html()).sha256,
    );
  });

  it('sammelt die ids des Artikels und wirft ohne Artikel', () => {
    expect(analyzeHtml(html()).ids).toEqual(['first-section', 'second']);
    expect(() => analyzeHtml('<html><body><main><p>leer</p></main></body></html>')).toThrow(
      /Artikel/,
    );
  });
});

describe('Hilfsfunktionen', () => {
  it('liest nur Datumsangaben', () => {
    expect(parseReportedDate('2026-07-02T00:00:00Z')).toBe('2026-07-02');
    expect(parseReportedDate('gestern')).toBeNull();
    expect(parseReportedDate(null)).toBeNull();
  });

  it('erzwingt die englische Fassung und behält die Query', () => {
    expect(toEnglishUrl('https://learn.microsoft.com/intune/a')).toBe(
      'https://learn.microsoft.com/en-us/intune/a',
    );
    expect(toEnglishUrl('https://learn.microsoft.com/graph/api/x?view=graph-rest-1.0')).toBe(
      'https://learn.microsoft.com/en-us/graph/api/x?view=graph-rest-1.0',
    );
    expect(toEnglishUrl('https://learn.microsoft.com/en-us/intune/a')).toBe(
      'https://learn.microsoft.com/en-us/intune/a',
    );
  });

  it('schlägt ähnliche ids vor', () => {
    expect(
      similarIds('app-protection-policies-for-ios', [
        'target-apps',
        'app-protection-policies-for-iosipados',
      ]),
    ).toEqual(['app-protection-policies-for-iosipados']);
  });

  it('gruppiert Sprungmarken je Seite sortiert', () => {
    const map = fragmentsByPage([
      { page: PAGE, fragment: 'b' },
      { page: PAGE, fragment: 'a' },
      { page: PAGE, fragment: 'a' },
      { page: 'https://learn.microsoft.com/y', fragment: null },
    ]);
    expect(map.get(PAGE)).toEqual(['a', 'b']);
    expect(map.get('https://learn.microsoft.com/y')).toEqual([]);
  });

  it('serialisiert die Sperrdatei sortiert', () => {
    const lock: LockFile = {
      version: 1,
      pages: {
        b: { sha256: '2', reportedDate: null, fragments: ['z', 'a'] },
        a: { sha256: '1', reportedDate: '2026-01-01', fragments: [] },
      },
    };
    const text = serializeLock(lock);
    expect(text.indexOf('"a"')).toBeLessThan(text.indexOf('"b"'));
    expect(text.endsWith('\n')).toBe(true);
    expect(JSON.parse(text).pages.b.fragments).toEqual(['a', 'z']);
  });
});

describe('Vergleich mit der Sperrdatei', () => {
  const ok = analyzeHtml(html());
  const expected = new Map([[PAGE, ['first-section']]]);
  const lock: LockFile = {
    version: 1,
    pages: {
      [PAGE]: { sha256: ok.sha256, reportedDate: '2026-07-02', fragments: ['first-section'] },
    },
  };
  const okFetch: PageFetch = { page: PAGE, kind: 'ok', analysis: ok };

  it('Exit 0 bei unveränderter Seite', () => {
    const r = compareWithLock(lock, [okFetch], expected);
    expect(r.exitCode).toBe(0);
    expect(r.findings).toEqual([]);
  });

  it('Exit 1 bei geändertem Inhalt, mit Datum', () => {
    const changed = analyzeHtml(html({ body: `${BODY} neu`, date: '2026-12-01T00:00:00Z' }));
    const r = compareWithLock(lock, [{ page: PAGE, kind: 'ok', analysis: changed }], expected);
    expect(r.exitCode).toBe(1);
    expect(r.findings[0].kind).toBe('changed');
    expect(r.findings[0].message).toContain('2026-12-01');
  });

  it('Exit 1 bei fehlender Sprungmarke', () => {
    const r = compareWithLock(
      lock,
      [okFetch],
      new Map([[PAGE, ['first-section', 'first-sectio']]]),
    );
    const kinds = r.findings.map((f) => f.kind);
    expect(kinds).toContain('missingAnchor');
    expect(kinds).toContain('fragmentsOutdated');
    expect(r.findings.find((f) => f.kind === 'missingAnchor')?.similarIds).toContain(
      'first-section',
    );
    expect(r.exitCode).toBe(1);
  });

  it('Exit 1 bei 404/410', () => {
    for (const httpStatus of [404, 410]) {
      const r = compareWithLock(lock, [{ page: PAGE, kind: 'gone', httpStatus }], expected);
      expect(r.exitCode).toBe(1);
      expect(r.findings[0].kind).toBe('gone');
    }
  });

  it('Exit 1 bei Seite fehlt in der Sperrdatei oder überzählig', () => {
    const missing = compareWithLock({ version: 1, pages: {} }, [okFetch], expected);
    expect(missing.findings.map((f) => f.kind)).toContain('notInLock');
    expect(missing.exitCode).toBe(1);
    const extra = compareWithLock(lock, [okFetch], new Map());
    expect(extra.findings.map((f) => f.kind)).toEqual(['extraInLock']);
    expect(extra.exitCode).toBe(1);
  });

  it('Exit 2 nur bei Abruffehlern; ein Befund überwiegt', () => {
    const err: PageFetch = { page: PAGE, kind: 'error', message: 'HTTP 503 nach 3 Versuchen' };
    const r = compareWithLock(lock, [err], expected);
    expect(r.exitCode).toBe(2);
    expect(r.findings).toEqual([]);
    expect(r.unverifiable[0].message).toContain('503');
    const both = compareWithLock({ version: 1, pages: {} }, [err], expected);
    expect(both.exitCode).toBe(1);
  });
});
