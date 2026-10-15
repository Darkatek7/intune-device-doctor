/**
 * results.xml der Diagnose-Sammlung. Regex-basiert (kein DOMParser), damit es im Web Worker läuft.
 * HRESULT-Bedeutung ist typabhängig (docs/diaglogs-format.md).
 */
import { de } from '../../i18n/de';
import { hresultToHex } from '../../domain/format';
import type { DiagEntryKind } from '../types';

export type CollectionKind = Exclude<DiagEntryKind, 'results'>;

export interface ResultsXmlItem {
  kind: CollectionKind;
  /** Quellpfad bzw. Befehl, XML-Entities aufgelöst */
  target: string;
  hresultDecimal: number;
  hresultHex: string;
}

export interface HresultInterpretation {
  /** false = Sammlung fehlgeschlagen */
  ok: boolean;
  /** Kurzinfo, nur für dokumentierte Kombinationen aus Typ und Code */
  meaning?: string;
}

const ITEM_RE =
  /<(RegistryKey|Command|Events|FoldersFiles)\s+HRESULT="(-?\d+)"\s*>([\s\S]*?)<\/\1>/g;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return String.fromCodePoint(parseInt(body.slice(2), 16));
    }
    if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10));
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

export function parseResultsXml(xml: string): ResultsXmlItem[] {
  const items: ResultsXmlItem[] = [];
  for (const match of xml.matchAll(ITEM_RE)) {
    const [, kind, decimalText, body] = match;
    if (kind === undefined || decimalText === undefined || body === undefined) continue;
    const hresultDecimal = Number(decimalText);
    items.push({
      kind: kind as CollectionKind,
      target: decodeEntities(body.trim()),
      hresultDecimal,
      hresultHex: hresultToHex(hresultDecimal),
    });
  }
  return items;
}

const HEX_NOT_FOUND_PATH = 0x80070003;
const HEX_NOT_FOUND_FILE = 0x80070002;
const HEX_KEY_MISSING = 0x80070001;
const HEX_COMMAND_FAILED = 0x8000ffff;

/**
 * Typabhängige Deutung eines HRESULT aus results.xml bzw. aus "No Results - Error"-Einträgen.
 * RegistryKey -2147024893 (0x80070003) tritt bei erfolgreichen Exporten auf – kein Fehler.
 */
export function interpretHresult(
  kind: CollectionKind,
  hresultDecimal: number,
): HresultInterpretation {
  const code = hresultDecimal >>> 0;
  const m = de.diagnostics.meaning;
  if (code === 0) return { ok: true };

  switch (kind) {
    case 'RegistryKey':
      if (code === HEX_NOT_FOUND_PATH) return { ok: true, meaning: m.registryExportOk };
      if (code === HEX_KEY_MISSING) return { ok: false, meaning: m.registryKeyMissing };
      return { ok: false };
    case 'FoldersFiles':
      if (code === HEX_NOT_FOUND_PATH) return { ok: false, meaning: m.pathNotFound };
      if (code === HEX_NOT_FOUND_FILE) return { ok: false, meaning: m.fileNotFound };
      return { ok: false };
    case 'Command':
      if (code === HEX_COMMAND_FAILED) return { ok: false, meaning: m.commandFailed };
      return { ok: false };
    case 'Events':
      return { ok: false };
  }
}
