/**
 * "Ticket-Notiz kopieren": Befunde eines Geräts als Markdown – rein lokal, nichts wird gesendet.
 * Sensible Werte sind bereits in den Befunden maskiert (ZIP) bzw. stammen aus der Admin-Ansicht.
 */
import { formatDateTime } from '../domain/format';
import type { Severity, Tile } from '../domain/types';
import { de } from '../i18n/de';
import { sortTiles } from './evaluate';

const t = de.rules.ticket;

const ICON: Record<Severity, string> = { critical: '🔴', warning: '🟠', unknown: '⚪', ok: '🟢' };

export interface TicketNoteInput {
  title: string;
  /** z. B. Modell, Nutzer, OS */
  details: string[];
  mode: 'demo' | 'live' | 'zip';
  tiles: Tile[];
  now: Date;
}

export function buildTicketNote({ title, details, mode, tiles, now }: TicketNoteInput): string {
  const ready = sortTiles(tiles.filter((tile) => tile.state === 'ready'));
  const modeText = mode === 'demo' ? t.modeDemo : mode === 'live' ? t.modeLive : t.modeZip;
  const lines: string[] = [`## ${t.heading(title)}`, ''];
  if (details.length) lines.push(t.device(details), '');
  lines.push(
    `_${t.generated(formatDateTime(now.toISOString()), modeText)}_`,
    '',
    `### ${t.tilesHeading}`,
    '',
  );
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
  return `${lines.join('\n').trim()}\n`;
}
