/**
 * Sammelprüfung (M12/B3): reine Funktionen für Namensliste, Zeilenbildung und CSV-Export.
 * Pro Name gibt es genau eine Anfrage `provider.searchDevices` – kein Snapshot pro Gerät.
 */
import { hoursSince } from '../domain/format';
import type { DeviceSearchResult, Severity } from '../domain/types';
import { THRESHOLDS } from './thresholds';

export const BULK_MAX_NAMES = 50;
/** Eingabegröße für eine Namensliste/CSV in Zeichen (50 Namen sind weit darunter). */
export const BULK_MAX_INPUT_CHARS = 200_000;

export interface ParsedNames {
  /** Eindeutige Namen (ohne Groß-/Kleinschreibung), höchstens BULK_MAX_NAMES */
  names: string[];
  /** Wie viele weitere eindeutige Namen wegen der Obergrenze ignoriert wurden */
  overLimit: number;
}

const HEADER_CELLS = /^(device ?name|name|gerätename|geraetename|computer(name)?|gerät|device)$/i;

/**
 * Liest Namen aus eingefügtem Text oder einer CSV/TXT: eine Zeile pro Gerät; bei CSV zählt die
 * erste Spalte (Trenner ; , oder Tab). Kopfzeile, Anführungszeichen, BOM, Leerzeilen und Doppelte
 * werden entfernt.
 */
export function parseDeviceNames(text: string): ParsedNames {
  const seen = new Set<string>();
  const unique: string[] = [];
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  lines.forEach((line, index) => {
    const first = (line.split(/[;,\t]/)[0] ?? '')
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .trim();
    if (!first) return;
    if (index === 0 && HEADER_CELLS.test(first)) return;
    const key = first.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(first);
  });
  return {
    names: unique.slice(0, BULK_MAX_NAMES),
    overLimit: Math.max(0, unique.length - BULK_MAX_NAMES),
  };
}

export type BulkRowStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled';

export interface BulkRow {
  /** Eingegebener Name */
  name: string;
  status: BulkRowStatus;
  /** Anzahl Treffer (nur bei status done) */
  matchCount: number;
  /** Gerät bei genau einem Treffer */
  device: DeviceSearchResult | null;
  /** Fehlermeldung (status error) */
  errorMessage?: string;
}

export const pendingRows = (names: readonly string[]): BulkRow[] =>
  names.map((name) => ({ name, status: 'pending', matchCount: 0, device: null }));

/**
 * Wertet die Treffer einer Suche aus: genau ein Treffer – oder genau ein Treffer mit exakt
 * gleichem Namen unter mehreren – zählt als eindeutig.
 */
export function rowFromResults(name: string, results: readonly DeviceSearchResult[]): BulkRow {
  const exact = results.filter((r) => r.deviceName.toLowerCase() === name.trim().toLowerCase());
  const chosen = exact.length === 1 ? exact : results;
  return {
    name,
    status: 'done',
    matchCount: chosen.length,
    device: chosen.length === 1 ? (chosen[0] ?? null) : null,
  };
}

/** Bewertung des letzten Check-ins nach den Schwellwerten der Kachel „Letzter Check-in“. */
export function checkInSeverity(lastSyncDateTime: string | null, now: Date): Severity {
  const hours = hoursSince(lastSyncDateTime, now);
  if (hours === null) return 'unknown';
  if (hours > THRESHOLDS.checkInCriticalDays * 24) return 'critical';
  if (hours > THRESHOLDS.checkInWarningDays * 24) return 'warning';
  return 'ok';
}

// ---------- CSV ----------

/** Maskiert Zellen, die Tabellenkalkulationen als Formel lesen würden. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export interface BulkCsvLabels {
  header: readonly string[];
  matchNone: string;
  matchMany: string;
  matchOne: string;
  pending: string;
  error: string;
  cancelled: string;
  /** Compliance-Status → Text */
  compliance: (state: string) => string;
  severity: Record<Severity, string>;
}

/**
 * Tabelle als CSV (Trenner „;“, UTF-8 mit BOM, damit deutsche Excel-Versionen Umlaute lesen).
 * Spalten: Name, Treffer, Gerät, Plattform, Compliance, Letzter Check-in (ISO), Bewertung, Benutzer.
 */
export function bulkRowsToCsv(rows: readonly BulkRow[], now: Date, labels: BulkCsvLabels): string {
  const lines = [labels.header.map(csvCell).join(';')];
  for (const row of rows) {
    const device = row.device;
    const match =
      row.status === 'done'
        ? row.matchCount === 0
          ? labels.matchNone
          : row.matchCount === 1
            ? labels.matchOne
            : `${labels.matchMany} (${row.matchCount})`
        : row.status === 'error'
          ? labels.error
          : row.status === 'cancelled'
            ? labels.cancelled
            : labels.pending;
    lines.push(
      [
        row.name,
        match,
        device?.deviceName ?? '',
        device?.operatingSystem ?? '',
        device ? labels.compliance(device.complianceState) : '',
        device?.lastSyncDateTime ?? '',
        device ? labels.severity[checkInSeverity(device.lastSyncDateTime, now)] : '',
        device?.userDisplayName ?? '',
      ]
        .map(csvCell)
        .join(';'),
    );
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
