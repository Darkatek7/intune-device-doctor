/**
 * Vorher/Nachher-Vergleich (M12/B1, B2): reine Funktionen.
 * - `buildSnapshotFile` macht aus ausgewerteten Kacheln eine schlanke Exportdatei (nur Severity, Wert,
 *   Befund-IDs/-Titel – keine Rohdaten, keine UPNs/Seriennummern).
 * - `parseSnapshotFile` validiert eine gewählte Datei streng und lehnt fremde Dateien ab.
 * - `compareSnapshots` vergleicht zwei Stände pro Kachel und listet neue/behobene Befunde.
 */
import type { Severity, Tile } from '../domain/types';

export const SNAPSHOT_SCHEMA = 'mdm-doctor/stand';
export const SNAPSHOT_VERSION = 1;
/** Größte akzeptierte Datei (Zeichen) – eine Exportdatei ist wenige KB groß. */
export const SNAPSHOT_MAX_CHARS = 1_000_000;

const MAX_TILES = 64;
const MAX_FINDINGS = 200;
const MAX_TEXT = 300;

export type SnapshotMode = 'demo' | 'live' | 'zip';

export interface SnapshotFinding {
  id: string;
  severity: Severity;
  title: string;
}

export interface SnapshotTile {
  id: string;
  title: string;
  severity: Severity;
  value: string;
  findings: SnapshotFinding[];
}

export interface SnapshotFile {
  schema: typeof SNAPSHOT_SCHEMA;
  version: typeof SNAPSHOT_VERSION;
  /** ISO-Zeitpunkt des Exports bzw. der Auswertung */
  exportedAt: string;
  mode: SnapshotMode;
  /** Gerätename (Intune bzw. aus dem ZIP-Dateinamen); null, wenn unbekannt */
  deviceName: string | null;
  /** Sammelzeitpunkt (nur ZIP) */
  collectedAt: string | null;
  tiles: SnapshotTile[];
}

export type ParseSnapshotResult =
  | { ok: true; snapshot: SnapshotFile }
  | { ok: false; reason: 'tooLarge' | 'notJson' | 'wrongSchema' | 'wrongVersion' | 'invalid' };

const SEVERITIES: readonly Severity[] = ['ok', 'warning', 'critical', 'unknown'];

export function buildSnapshotFile(input: {
  tiles: readonly Tile[];
  mode: SnapshotMode;
  deviceName: string | null;
  collectedAt?: string | null;
  now: Date;
}): SnapshotFile {
  return {
    schema: SNAPSHOT_SCHEMA,
    version: SNAPSHOT_VERSION,
    exportedAt: input.now.toISOString(),
    mode: input.mode,
    deviceName: input.deviceName,
    collectedAt: input.collectedAt ?? null,
    tiles: input.tiles
      .filter((tile) => tile.state === 'ready')
      .map((tile) => ({
        id: tile.id,
        title: tile.title,
        severity: tile.severity,
        value: tile.value,
        findings: tile.findings.map((finding) => ({
          id: finding.id,
          severity: finding.severity,
          title: finding.title,
        })),
      })),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSeverity = (value: unknown): value is Severity =>
  typeof value === 'string' && (SEVERITIES as readonly string[]).includes(value);

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_TEXT;

const isIso = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));

/** Liest nur die bekannten Felder – unbekannte Felder der Datei werden verworfen. */
export function parseSnapshotFile(text: string): ParseSnapshotResult {
  if (text.length > SNAPSHOT_MAX_CHARS) return { ok: false, reason: 'tooLarge' };
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return { ok: false, reason: 'notJson' };
  }
  if (!isRecord(raw) || raw.schema !== SNAPSHOT_SCHEMA) return { ok: false, reason: 'wrongSchema' };
  if (raw.version !== SNAPSHOT_VERSION) return { ok: false, reason: 'wrongVersion' };

  const { exportedAt, mode, deviceName, collectedAt, tiles } = raw;
  if (
    !isIso(exportedAt) ||
    (mode !== 'demo' && mode !== 'live' && mode !== 'zip') ||
    !(deviceName === null || isText(deviceName)) ||
    !(collectedAt === null || isIso(collectedAt)) ||
    !Array.isArray(tiles) ||
    tiles.length > MAX_TILES
  ) {
    return { ok: false, reason: 'invalid' };
  }

  const parsedTiles: SnapshotTile[] = [];
  const seenIds = new Set<string>();
  for (const entry of tiles) {
    if (!isRecord(entry)) return { ok: false, reason: 'invalid' };
    const { id, title, severity, value, findings } = entry;
    if (
      !isText(id) ||
      id === '' ||
      seenIds.has(id) ||
      !isText(title) ||
      !isSeverity(severity) ||
      !isText(value) ||
      !Array.isArray(findings) ||
      findings.length > MAX_FINDINGS
    ) {
      return { ok: false, reason: 'invalid' };
    }
    seenIds.add(id);
    const parsedFindings: SnapshotFinding[] = [];
    for (const finding of findings) {
      if (
        !isRecord(finding) ||
        !isText(finding.id) ||
        !isSeverity(finding.severity) ||
        !isText(finding.title)
      ) {
        return { ok: false, reason: 'invalid' };
      }
      parsedFindings.push({ id: finding.id, severity: finding.severity, title: finding.title });
    }
    parsedTiles.push({ id, title, severity, value, findings: parsedFindings });
  }

  return {
    ok: true,
    snapshot: {
      schema: SNAPSHOT_SCHEMA,
      version: SNAPSHOT_VERSION,
      exportedAt,
      mode,
      deviceName,
      collectedAt,
      tiles: parsedTiles,
    },
  };
}

// ---------- Vergleich ----------

export type Trend = 'worse' | 'better' | 'added' | 'removed' | 'same';

export interface TileState {
  severity: Severity;
  value: string;
}

export interface TileChange {
  id: string;
  title: string;
  trend: Trend;
  before: TileState | null;
  after: TileState | null;
  /** Gleiche Severity, aber anderer Hauptwert */
  valueChanged: boolean;
}

export interface FindingChange {
  tileId: string;
  tileTitle: string;
  finding: SnapshotFinding;
}

export interface SnapshotComparison {
  tiles: TileChange[];
  counts: Record<Trend, number>;
  /** Befunde (ohne „ok“), die nur im neuen Stand vorkommen */
  newFindings: FindingChange[];
  /** Befunde (ohne „ok“), die nur im alten Stand vorkommen */
  resolvedFindings: FindingChange[];
  /** Beide Stände nennen einen Gerätenamen, und die Namen unterscheiden sich */
  deviceNameMismatch: boolean;
}

/** Größer = schlechter. „Unbekannt“ liegt zwischen „in Ordnung“ und „Prüfen“. */
const BADNESS: Record<Severity, number> = { ok: 0, unknown: 1, warning: 2, critical: 3 };

const TREND_ORDER: Record<Trend, number> = { worse: 0, better: 1, added: 2, removed: 3, same: 4 };

const normalizeName = (name: string | null): string => (name ?? '').trim().toLowerCase();

function findingsOf(snapshot: SnapshotFile): Map<string, FindingChange> {
  const map = new Map<string, FindingChange>();
  for (const tile of snapshot.tiles) {
    for (const finding of tile.findings) {
      if (finding.severity === 'ok') continue;
      map.set(`${tile.id}\u0000${finding.id}`, {
        tileId: tile.id,
        tileTitle: tile.title,
        finding,
      });
    }
  }
  return map;
}

export function compareSnapshots(before: SnapshotFile, after: SnapshotFile): SnapshotComparison {
  const beforeById = new Map(before.tiles.map((tile) => [tile.id, tile]));
  const afterIds = new Set(after.tiles.map((tile) => tile.id));
  const changes: TileChange[] = [];

  for (const tile of after.tiles) {
    const old = beforeById.get(tile.id);
    const now: TileState = { severity: tile.severity, value: tile.value };
    if (!old) {
      changes.push({
        id: tile.id,
        title: tile.title,
        trend: 'added',
        before: null,
        after: now,
        valueChanged: false,
      });
      continue;
    }
    const diff = BADNESS[tile.severity] - BADNESS[old.severity];
    changes.push({
      id: tile.id,
      title: tile.title,
      trend: diff > 0 ? 'worse' : diff < 0 ? 'better' : 'same',
      before: { severity: old.severity, value: old.value },
      after: now,
      valueChanged: diff === 0 && old.value !== tile.value,
    });
  }
  for (const tile of before.tiles) {
    if (afterIds.has(tile.id)) continue;
    changes.push({
      id: tile.id,
      title: tile.title,
      trend: 'removed',
      before: { severity: tile.severity, value: tile.value },
      after: null,
      valueChanged: false,
    });
  }

  // Stabil: Änderungen zuerst (schlechter, besser, neu, entfallen), unveränderte am Ende.
  const sorted = changes
    .map((change, index) => ({ change, index }))
    .sort((a, b) => TREND_ORDER[a.change.trend] - TREND_ORDER[b.change.trend] || a.index - b.index)
    .map(({ change }) => change);

  const counts: Record<Trend, number> = { worse: 0, better: 0, added: 0, removed: 0, same: 0 };
  for (const change of sorted) counts[change.trend] += 1;

  const oldFindings = findingsOf(before);
  const newFindingsMap = findingsOf(after);
  const newFindings = [...newFindingsMap]
    .filter(([key]) => !oldFindings.has(key))
    .map(([, v]) => v);
  const resolvedFindings = [...oldFindings]
    .filter(([key]) => !newFindingsMap.has(key))
    .map(([, v]) => v);

  const nameA = normalizeName(before.deviceName);
  const nameB = normalizeName(after.deviceName);

  return {
    tiles: sorted,
    counts,
    newFindings,
    resolvedFindings,
    deviceNameMismatch: nameA !== '' && nameB !== '' && nameA !== nameB,
  };
}

/** Dateiname für den Download: mdm-doctor-stand-<gerät>-<JJJJMMTT-HHMM>.json (nur sichere Zeichen). */
export function snapshotFileName(snapshot: SnapshotFile): string {
  const safe = (snapshot.deviceName ?? 'gerät')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const stamp = snapshot.exportedAt.replace(/\D/g, '').slice(0, 12);
  const date = `${stamp.slice(0, 8)}-${stamp.slice(8, 12)}`;
  return `mdm-doctor-stand-${safe || 'geraet'}-${date}.json`;
}
