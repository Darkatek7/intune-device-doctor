/**
 * ZIP-Zugriff mit @zip.js/zip.js: nur das Central Directory wird gelesen, Text-Einträge werden
 * bei Bedarf entpackt (mit Größenlimit), Binärdateien nie. Alles lokal – kein Netzwerkzugriff.
 */
import type { Entry } from '@zip.js/zip.js';
import { decodeText, type DetectedEncoding } from '../parsers/encoding';
import { parseEntryName } from '../parsers/entryName';
import type { DiagEntry } from '../types';

export const DEFAULT_MAX_TEXT_BYTES = 8 * 1024 * 1024;

/** Endungen, die nie entpackt werden (im MVP nicht ausgewertet). */
const BINARY_RE = /\.(evtx|etl|cab|zip|dmp)$/i;

export function isBinaryEntry(pathOrName: string): boolean {
  return BINARY_RE.test(pathOrName);
}

/** Endung inkl. Punkt in Kleinschreibung, z. B. ".evtx" (leer, wenn keine). */
export function extensionOf(path: string): string {
  const m = /(\.[A-Za-z0-9]{1,8})$/.exec(path);
  return m?.[1]?.toLowerCase() ?? '';
}

export type ReadTextResult =
  | { ok: true; text: string; encoding: DetectedEncoding }
  | { ok: false; reason: 'binary' | 'tooLarge' | 'directory' | 'empty' | 'error' };

export interface OpenedZip {
  /** Alle Einträge, deren Name dem bekannten Schema entspricht */
  entries: DiagEntry[];
  /** Pfade von Einträgen mit unbekanntem Namensschema */
  unrecognizedPaths: string[];
  readText(entry: DiagEntry, maxBytes?: number): Promise<ReadTextResult>;
  close(): Promise<void>;
}

/** Öffnet ein ZIP aus einem Blob/File (im Browser) oder Uint8Array (Tests). */
export async function openZip(source: Blob | Uint8Array): Promise<OpenedZip> {
  const zip = await import('@zip.js/zip.js');
  // Wir laufen bereits im eigenen Worker (bzw. in Tests): keine verschachtelten Worker starten.
  zip.configure({ useWebWorkers: false });

  const reader = new zip.ZipReader(
    source instanceof Uint8Array ? new zip.Uint8ArrayReader(source) : new zip.BlobReader(source),
  );
  const rawEntries = await reader.getEntries();

  const byPath = new Map<string, Entry>();
  const entries: DiagEntry[] = [];
  const unrecognizedPaths: string[] = [];
  for (const raw of rawEntries) {
    const parsed = parseEntryName(raw.filename, raw.uncompressedSize, raw.directory);
    if (parsed) {
      entries.push(parsed);
      byPath.set(parsed.path, raw);
    } else {
      unrecognizedPaths.push(raw.filename);
    }
  }

  return {
    entries,
    unrecognizedPaths,
    async readText(entry, maxBytes = DEFAULT_MAX_TEXT_BYTES) {
      if (entry.isDirectory) return { ok: false, reason: 'directory' };
      if (isBinaryEntry(entry.path)) return { ok: false, reason: 'binary' };
      if (entry.uncompressedSize === 0) return { ok: false, reason: 'empty' };
      if (entry.uncompressedSize > maxBytes) return { ok: false, reason: 'tooLarge' };
      const raw = byPath.get(entry.path);
      if (!raw || raw.directory) return { ok: false, reason: 'error' };
      try {
        const bytes = await raw.getData(new zip.Uint8ArrayWriter());
        const decoded = decodeText(bytes);
        return { ok: true, text: decoded.text, encoding: decoded.encoding };
      } catch {
        return { ok: false, reason: 'error' };
      }
    },
    close: () => reader.close(),
  };
}
