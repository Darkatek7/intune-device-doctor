/**
 * Erzeugt aus dem JSON-Bericht von `check-posture-sources.ts` den Text für Issue bzw. Job-Zusammenfassung.
 * Aufruf: tsx scripts/posture-sources/render-issue.ts <bericht.json> <ausgabe.md>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { Finding } from './core';

interface Report {
  exitCode: number;
  pages: number;
  findings: Finding[];
  unverifiable: Finding[];
}

export function renderIssueBody(report: Report, runUrl: string): string {
  const lines = [
    'Mindestens eine Learn-Quelle der Ansicht „Empfehlungen“ hat sich geändert oder ist nicht mehr auffindbar.',
    'Die Sollwerte werden **nie automatisch** übernommen – bitte von Hand prüfen.',
    '',
    '## Betroffene Quellen',
    '',
  ];
  for (const f of report.findings) {
    lines.push(`- ${f.page}`, `  - ${f.message}`);
    if (f.similarIds?.length)
      lines.push(`  - Ähnliche ids auf der Seite: ${f.similarIds.join(', ')}`);
  }
  lines.push(
    '',
    '## Schritte',
    '',
    '1. Die genannten Seiten öffnen und die Werte gegen `src/rules/posture/catalog/` prüfen.',
    '2. Katalog und Texte bei Abweichungen anpassen (Wert nur mit Quelle); tote Verweise in `src/rules/knowledge/docs.ts` korrigieren.',
    '3. `npm run posture:sources -- --update` ausführen und die Sperrdatei `docs/posture-sources.lock.json` einchecken.',
    '4. `POSTURE_CATALOG_VERIFIED_ON` in `src/rules/posture/sources.ts` auf das Prüfdatum anheben.',
    '',
    `Lauf: ${runUrl}`,
    '',
  );
  return lines.join('\n');
}

const [reportPath, outPath] = process.argv.slice(2);
if (reportPath && outPath) {
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as Report;
  writeFileSync(outPath, renderIssueBody(report, process.env.RUN_URL ?? ''));
}
