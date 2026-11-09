/**
 * Markdown-Bericht des Verbindungstests (M14/S6) – zum Einfügen in docs/live-verification.md.
 *
 * Enthält bewusst NUR: Datum, Plattform des Testgeräts (z. B. „windows“) und je Endpunkt die
 * Platzhalter-Schreibweise (`display`, ohne Werte), Version, Scope, Ergebnis, Dauer, Anzahl der Einträge
 * und Feldnamen. Keine Geräte-/Benutzernamen, keine IDs, keine Antwortwerte.
 */
import { de } from '../i18n/de';
import type { EndpointProbeResult, OsFamily, ProbeOutcome } from './types';

const t = de.connectionTest;

/** Zelleninhalt für eine Markdown-Tabelle: Zeilenumbrüche entfernen, senkrechte Striche escapen. */
function cell(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

function code(value: string): string {
  return `\`${cell(value).replace(/`/g, "'")}\``;
}

function resultCell(result: EndpointProbeResult): string {
  if (result.outcome === 'skipped') return cell(`skipped – ${result.skipReason ?? ''}`.trim());
  return result.httpStatus !== null ? `${result.outcome} (${result.httpStatus})` : result.outcome;
}

function versionCell(result: EndpointProbeResult): string {
  return result.version === 'beta' ? t.report.betaMark : result.version;
}

export interface ReportOptions {
  /** Plattform des Testgeräts – nur die Familie, nie Name oder ID. */
  osFamily: OsFamily;
  /** Datum des Tests (lokal angezeigt als YYYY-MM-DD). */
  date: Date;
  /** false = abgebrochen, Ergebnisse unvollständig. */
  complete: boolean;
}

/** Anzahl je Ergebnis (für Zusammenfassung und Bericht). */
export function countOutcomes(results: EndpointProbeResult[]): Record<ProbeOutcome, number> {
  const counts: Record<ProbeOutcome, number> = {
    ok: 0,
    forbidden: 0,
    notFound: 0,
    badRequest: 0,
    error: 0,
    skipped: 0,
  };
  for (const result of results) counts[result.outcome] += 1;
  return counts;
}

function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildConnectionTestReport(
  results: EndpointProbeResult[],
  options: ReportOptions,
): string {
  const counts = countOutcomes(results);
  const summary = t.summary(counts) || t.report.none;
  const lines = [
    `## ${t.report.title}`,
    '',
    `- ${t.report.date}: ${isoDate(options.date)}`,
    `- ${t.report.platform}: ${options.osFamily} (${t.report.platformNote})`,
    `- ${t.report.result}: ${summary}${options.complete ? '' : ` (${t.report.partial})`}`,
    '',
    t.report.note,
    '',
    `| ${t.columns.endpoint} | ${t.columns.version} | ${t.columns.scope} | ${t.columns.result} | ${t.columns.duration} | ${t.columns.entries} | ${t.columns.fields} |`,
    '| --- | --- | --- | --- | ---: | ---: | --- |',
  ];
  for (const result of results) {
    const duration = result.durationMs !== null ? `${result.durationMs} ms` : t.report.none;
    const entries = result.entryCount !== null ? String(result.entryCount) : t.report.none;
    const fields = result.fieldNames.length
      ? result.fieldNames.map((name) => code(name)).join(', ')
      : t.report.none;
    lines.push(
      `| ${code(result.display)} | ${versionCell(result)} | ${code(result.scope)} | ${resultCell(result)} | ${duration} | ${entries} | ${fields} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}
