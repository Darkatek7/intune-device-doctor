/**
 * "Ticket-Notiz kopieren": Befunde eines Geräts als Markdown – rein lokal, nichts wird gesendet.
 * Sensible Werte sind bereits in den Befunden maskiert (ZIP) bzw. stammen aus der Admin-Ansicht.
 */
import { formatDateTime } from '../domain/format';
import type { Severity, Tile } from '../domain/types';
import { de } from '../i18n/de';
import type { Insight } from './correlate';
import { sortTiles } from './evaluate';
import { isProblemEvent, type TimelineEvent } from './timeline';

const t = de.rules.ticket;

const ICON: Record<Severity, string> = { critical: '🔴', warning: '🟠', unknown: '⚪', ok: '🟢' };

export interface TicketNoteInput {
  title: string;
  /** z. B. Modell, Nutzer, OS */
  details: string[];
  mode: 'demo' | 'live' | 'zip';
  tiles: Tile[];
  now: Date;
  /** „Wahrscheinlichste Ursache“ – steht oben in der Notiz */
  insights?: Insight[];
  /** Zeitachse; angehängt werden die letzten Problem-Ereignisse */
  timeline?: TimelineEvent[];
}

/** Höchstzahl der Problem-Ereignisse, die an die Notiz angehängt werden. */
const MAX_TIMELINE_PROBLEMS = 10;

export function buildTicketNote({
  title,
  details,
  mode,
  tiles,
  now,
  insights = [],
  timeline = [],
}: TicketNoteInput): string {
  const ready = sortTiles(tiles.filter((tile) => tile.state === 'ready'));
  const modeText = mode === 'demo' ? t.modeDemo : mode === 'live' ? t.modeLive : t.modeZip;
  const lines: string[] = [`## ${t.heading(title)}`, ''];
  if (details.length) lines.push(t.device(details), '');
  lines.push(`_${t.generated(formatDateTime(now.toISOString()), modeText)}_`, '');
  if (insights.length > 0) {
    const a = de.analysis.insight;
    lines.push(`### ${a.ticketHeading}`, '', `_${a.note}_`, '');
    insights.forEach((insight, index) => {
      lines.push(`${index + 1}. **${insight.title}** – ${insight.explanation}`);
      insight.steps.forEach((step) => lines.push(`   - ${step}`));
      lines.push(`   - ${t.docs}: ${insight.docsUrl}`);
    });
    lines.push('');
  }
  lines.push(`### ${t.tilesHeading}`, '');
  for (const tile of ready) {
    lines.push(
      `- ${ICON[tile.severity]} **${tile.title}** – ${t.severity[tile.severity]}: ${tile.value}${tile.summary ? ` (${tile.summary})` : ''}`,
    );
  }
  const findings = ready.flatMap((tile) =>
    tile.findings
      .filter((f) => f.severity === 'critical' || f.severity === 'warning')
      .map((f) => ({ tile, f })),
  );
  lines.push('', `### ${t.findingsHeading}`, '');
  if (findings.length === 0) lines.push(t.noFindings);
  for (const { tile, f } of findings) {
    lines.push(
      `#### ${ICON[f.severity]} ${tile.title}: ${f.title}`,
      '',
      f.detail,
      '',
      `**${t.cause}:** ${f.cause}`,
      '',
      `**${t.remediation}:**`,
    );
    f.remediation.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
    lines.push('', `${t.source}: \`${f.source.label}\``);
    const docs = f.docsUrl ?? f.source.docsUrl;
    if (docs) lines.push(`${t.docs}: ${docs}`);
    lines.push('');
  }
  // Zeitachse: die letzten Problem-Ereignisse (bereits neueste zuerst; geplante Termine stehen oben)
  const problems = timeline.filter(isProblemEvent).slice(0, MAX_TIMELINE_PROBLEMS);
  if (problems.length > 0) {
    lines.push(`### ${de.analysis.insight.ticketTimelineHeading}`, '');
    for (const event of problems) {
      const planned = event.planned ? ` (${de.analysis.timeline.planned})` : '';
      lines.push(
        `- ${formatDateTime(event.time)}${planned} – ${ICON[event.severity]} ${event.title}${event.detail ? ` – ${event.detail}` : ''}`,
      );
    }
    lines.push('');
  }
  return `${lines.join('\n').trim()}\n`;
}
