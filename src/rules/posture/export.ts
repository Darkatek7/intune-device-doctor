/**
 * CSV-Export der Einzelprüfungen der Ansicht „Empfehlungen“ – reine Funktion über die (ggf. maskierten)
 * Kacheln, genau das, was angezeigt wird. Excel-kompatibel: `;`, UTF-8 mit BOM, CRLF.
 */
import type { PostureLevel } from '../../domain/posture';
import type { Tile } from '../../domain/types';
import { de } from '../../i18n/de';
import { groupPostureTiles, isPostureTile } from './index';
import type { CheckStatus } from './types';

const t = de.posture.view.export;
const BOM = '\uFEFF';
const SEPARATOR = ';';
const EOL = '\r\n';

const STATUS_TEXT: Record<CheckStatus, string> = {
  met: de.posture.view.overall.met,
  deviating: de.posture.view.overall.deviating,
  notChecked: de.posture.view.overall.notChecked,
};

/**
 * Felder, die ein Tabellenprogramm als Formel deuten würde (`=`, `+`, `-`, `@`, Tab, CR), bekommen ein
 * `'` vorangestellt – Richtliniennamen stammen aus dem Mandanten.
 */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function postureChecksCsv(tiles: readonly Tile[]): string {
  const c = t.columns;
  const rows: string[][] = [
    [
      c.section,
      c.tile,
      c.policy,
      c.setting,
      c.property,
      c.actual,
      c.expected,
      c.level,
      c.status,
      c.note,
      c.counted,
      c.source,
    ],
  ];
  for (const section of groupPostureTiles([...tiles])) {
    for (const tile of section.tiles) {
      if (!isPostureTile(tile)) continue;
      for (const check of tile.checks) {
        rows.push([
          de.posture.sections[section.key],
          tile.title,
          check.subject ?? '',
          check.label,
          check.properties?.join(', ') ?? '',
          check.actual,
          check.expected,
          check.level === null ? '' : de.posture.levelShort(check.level),
          STATUS_TEXT[check.status],
          check.reason ?? '',
          check.counted ? t.yes : t.no,
          check.docsUrl,
        ]);
      }
    }
  }
  return BOM + rows.map((row) => row.map(csvField).join(SEPARATOR)).join(EOL) + EOL;
}

/** `mdm-doctor-empfehlungen-stufe-<n>-<JJJJ-MM-TT>.csv` – ohne Mandanten- oder Personendaten. */
export function postureExportFileName(level: PostureLevel, now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `mdm-doctor-empfehlungen-stufe-${level}-${date}.csv`;
}
