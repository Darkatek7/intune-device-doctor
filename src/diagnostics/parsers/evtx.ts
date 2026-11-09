/**
 * Reiner Parser für Windows-XML-Ereignisprotokolle (.evtx), ohne Abhängigkeit.
 * Läuft ausschließlich im Analyse-Worker; die Daten verlassen den Browser nie.
 *
 * Format (Quellen: [MS-EVEN6] 2.2.12 BinXml — Microsoft Open Specifications, Tokens und Werttypen;
 * der Datei-/Chunk-/Datensatz-Aufbau stammt aus libevtx „Windows XML Event Log (EVTX) format“,
 * https://github.com/libyal/libevtx, da Microsoft ihn nicht dokumentiert):
 *  - Dateikopf 4096 Byte, Signatur `ElfFile\0`.
 *  - Chunks à 65 536 Byte, Signatur `ElfChnk\0`, Kopf 512 Byte. Namen und Template-Definitionen
 *    werden per Offset (relativ zum Chunk-Anfang) referenziert.
 *  - Datensatz: `2A 2A 00 00`, Größe, RecordID, FILETIME, Binary XML, Größe (Kopie).
 *  - Binary XML: Token-Strom (Element, Attribut, Wert, Substitution, TemplateInstance …). Der Inhalt
 *    der meisten Ereignisse ist eine TemplateInstance: Template-Definition (im Chunk, beim ersten
 *    Mal inline) plus Wertetabelle für die Substitutionen. Werte vom Typ BinXml (0x21) enthalten
 *    verschachtelte Fragmente (typisch für EventData klassischer Ereignisse).
 *
 * Defensiv: jeder Offset wird gegen Puffergrenzen geprüft, Rekursion und Knotenzahl sind begrenzt,
 * Fehler werden je Datensatz abgefangen. Prüfsummen werden nicht ausgewertet. Unbekannte Werttypen
 * ergeben leere Werte statt eines Abbruchs.
 */

export const EVTX_CHUNK_SIZE = 0x10000;
const FILE_HEADER_DEFAULT_SIZE = 4096;
const CHUNK_HEADER_SIZE = 512;
const RECORD_MAGIC = 0x00002a2a;
/** Signatur(4) + Größe(4) + RecordID(8) + FILETIME(8) + Größe-Kopie(4) */
const MIN_RECORD_SIZE = 28;
const MAX_DEPTH = 40;
const MAX_NODES_PER_RECORD = 20_000;
const MAX_VALUE_COUNT = 4096;

export const EVTX_DEFAULT_MAX_RECORDS = 20_000;
export const EVTX_DEFAULT_TIME_BUDGET_MS = 20_000;

/** Ein dekodiertes Ereignis (System-Felder plus EventData/UserData als Name → Wert). */
export interface EvtxEvent {
  recordId: number;
  /** System/EventID */
  eventId: number | null;
  /** 0 = LogAlways, 1 = Kritisch, 2 = Fehler, 3 = Warnung, 4 = Information, 5 = Ausführlich */
  level: number | null;
  /** ISO-8601 (UTC); Fallback: Schreibzeitpunkt aus dem Datensatzkopf */
  timeCreated: string | null;
  provider: string | null;
  channel: string | null;
  computer: string | null;
  /** EventData bzw. UserData; unbenannte Data-Elemente heißen Data1, Data2 … */
  data: Record<string, string>;
  dataKind: 'EventData' | 'UserData' | null;
}

export interface EvtxParseStats {
  /** Chunk-Plätze in der Datei (inkl. unvollständigem letzten) */
  chunksTotal: number;
  /** Chunks mit gültiger Signatur, die ausgewertet wurden */
  chunksParsed: number;
  /** Plätze mit falscher Signatur oder zu klein (defekt/gekappt) */
  chunksInvalid: number;
  /** Datensätze mit gültiger Struktur (inkl. Datensätze außerhalb des Zeitfensters) */
  recordsScanned: number;
  recordsDecoded: number;
  /** Strukturell erkannt, aber Binary XML nicht lesbar */
  recordsFailed: number;
  /** Vor `since` geschrieben – nicht dekodiert */
  recordsOutsideWindow: number;
  /** Datei endet innerhalb eines Chunks bzw. Chunk-Anzahl im Kopf übersteigt die Dateigröße */
  truncated: boolean;
  /** `maxRecords`/`maxEvents` erreicht – ältere Ereignisse wurden nicht ausgewertet */
  capped: boolean;
  timedOut: boolean;
}

export interface EvtxParseResult {
  /** Aufsteigend nach RecordID */
  events: EvtxEvent[];
  stats: EvtxParseStats;
}

export interface EvtxParseOptions {
  /** Max. dekodierte Datensätze (Standard 20 000, jüngste Chunks zuerst) */
  maxRecords?: number;
  /** Max. zurückgegebene Ereignisse (Standard: wie maxRecords) */
  maxEvents?: number;
  /** Datensätze vor diesem Zeitpunkt (Schreibzeit) werden übersprungen, ohne Binary XML zu lesen */
  since?: Date | number;
  /** Wird für jedes dekodierte Ereignis aufgerufen; `false` verwirft es (spart Speicher) */
  filter?: (event: EvtxEvent) => boolean;
  /** Zeitbudget in ms (Standard 20 s); danach wird mit dem bisherigen Ergebnis beendet */
  timeBudgetMs?: number;
}

/** Datei ist keine (erkennbare) EVTX-Datei. */
export class EvtxFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvtxFormatError';
  }
}

/** Fehler in einem einzelnen Datensatz (wird intern abgefangen). */
class EvtxRecordError extends Error {}

// ---------------------------------------------------------------------------
// Typen des Binary-XML-Baums
// ---------------------------------------------------------------------------

interface ValueSlot {
  type: number;
  off: number;
  size: number;
}

interface TemplateDef {
  nodes: TNode[];
}

type TNode =
  | { t: 'el'; name: string; attrs: Array<{ name: string; parts: TNode[] }>; children: TNode[] }
  | { t: 'text'; text: string }
  | { t: 'sub'; id: number; optional: boolean }
  | { t: 'inst'; def: TemplateDef; values: ValueSlot[] };

/** Instanziiertes Element (Substitutionen aufgelöst). */
interface XEl {
  name: string;
  attrs: Record<string, string>;
  children: XEl[];
  text: string;
}

interface ChunkCtx {
  dv: DataView;
  buf: Uint8Array;
  len: number;
  names: Map<number, { name: string; size: number }>;
  templates: Map<number, TemplateDef>;
  nodeBudget: number;
}

const utf16 = new TextDecoder('utf-16le');
const windows1252 = new TextDecoder('windows-1252');

class Cursor {
  constructor(
    readonly ctx: ChunkCtx,
    public pos: number,
    readonly end: number,
  ) {
    if (pos < 0 || end > ctx.len || pos > end)
      throw new EvtxRecordError('Offset außerhalb des Chunks');
  }

  private need(n: number): void {
    if (this.pos + n > this.end) throw new EvtxRecordError('Unerwartetes Ende des Binary XML');
  }
  u8(): number {
    this.need(1);
    return this.ctx.dv.getUint8(this.pos++);
  }
  u16(): number {
    this.need(2);
    const v = this.ctx.dv.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }
  u32(): number {
    this.need(4);
    const v = this.ctx.dv.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }
  peek(): number {
    return this.pos < this.end ? this.ctx.dv.getUint8(this.pos) : -1;
  }
  skip(n: number): void {
    this.need(n);
    this.pos += n;
  }
}

// ---------------------------------------------------------------------------
// Namen, Templates
// ---------------------------------------------------------------------------

function nameAt(ctx: ChunkCtx, off: number): { name: string; size: number } {
  const cached = ctx.names.get(off);
  if (cached) return cached;
  if (off < CHUNK_HEADER_SIZE || off + 8 > ctx.len)
    throw new EvtxRecordError('Namensoffset ungültig');
  const chars = ctx.dv.getUint16(off + 6, true);
  const size = 8 + chars * 2 + 2;
  if (off + size > ctx.len) throw new EvtxRecordError('Name überschreitet den Chunk');
  const info = { name: utf16.decode(ctx.buf.subarray(off + 8, off + 8 + chars * 2)), size };
  ctx.names.set(off, info);
  return info;
}

/** Liest einen Namens-Verweis (u32 Offset). Steht der Name direkt dahinter („inline“), wird er übersprungen. */
function readNameRef(cur: Cursor): string {
  const off = cur.u32();
  const info = nameAt(cur.ctx, off);
  if (off === cur.pos) cur.skip(info.size);
  return info.name;
}

const TEMPLATE_HEADER_SIZE = 24; // next(4) + GUID(16) + Datengröße(4)

function templateAt(ctx: ChunkCtx, off: number, depth: number): TemplateDef {
  const cached = ctx.templates.get(off);
  if (cached) return cached;
  if (off < CHUNK_HEADER_SIZE || off + TEMPLATE_HEADER_SIZE > ctx.len)
    throw new EvtxRecordError('Template-Offset ungültig');
  const dataSize = ctx.dv.getUint32(off + 20, true);
  const bodyStart = off + TEMPLATE_HEADER_SIZE;
  if (bodyStart + dataSize > ctx.len) throw new EvtxRecordError('Template überschreitet den Chunk');
  const def: TemplateDef = { nodes: [] };
  // Vor dem Parsen eintragen, damit (fehlerhafte) Selbstreferenzen nicht endlos rekursieren.
  ctx.templates.set(off, def);
  try {
    def.nodes = parseFragment(new Cursor(ctx, bodyStart, bodyStart + dataSize), depth + 1);
  } catch (error) {
    ctx.templates.delete(off);
    throw error;
  }
  return def;
}

// ---------------------------------------------------------------------------
// Werte
// ---------------------------------------------------------------------------

const FIXED_SIZES: Record<number, number> = {
  0x03: 1,
  0x04: 1,
  0x05: 2,
  0x06: 2,
  0x07: 4,
  0x08: 4,
  0x09: 8,
  0x0a: 8,
  0x0b: 4,
  0x0c: 8,
  0x0d: 4,
  0x0f: 16,
  0x11: 8,
  0x12: 16,
  0x14: 4,
  0x15: 8,
};

const hex2 = (n: number): string => n.toString(16).toUpperCase().padStart(2, '0');

function filetimeToIso(dv: DataView, off: number): string {
  const ft = dv.getUint32(off + 4, true) * 4294967296 + dv.getUint32(off, true);
  if (ft === 0) return '';
  const ms = ft / 10000 - 11644473600000;
  return Number.isFinite(ms) && Math.abs(ms) <= 8.64e15 ? new Date(ms).toISOString() : '';
}

function guidAt(dv: DataView, off: number): string {
  const p = (o: number, n: number) => {
    let s = '';
    for (let i = 0; i < n; i++) s += hex2(dv.getUint8(off + o + i));
    return s;
  };
  const d1 = dv.getUint32(off, true).toString(16).toUpperCase().padStart(8, '0');
  const d2 = dv
    .getUint16(off + 4, true)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  const d3 = dv
    .getUint16(off + 6, true)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  return `{${d1}-${d2}-${d3}-${p(8, 2)}-${p(10, 6)}}`;
}

function sidAt(dv: DataView, off: number, size: number): string {
  if (size < 8) return '';
  const subCount = dv.getUint8(off + 1);
  if (8 + subCount * 4 > size) return '';
  let authority = 0;
  for (let i = 2; i < 8; i++) authority = authority * 256 + dv.getUint8(off + i);
  let sid = `S-${dv.getUint8(off)}-${authority}`;
  for (let i = 0; i < subCount; i++) sid += `-${dv.getUint32(off + 8 + i * 4, true)}`;
  return sid;
}

function stripNul(text: string): string {
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 0) end--;
  return text.slice(0, end);
}

/** Dekodiert einen skalaren Wert (kein Array, kein BinXml) in seine Textform. */
function scalarText(ctx: ChunkCtx, off: number, size: number, type: number): string {
  const dv = ctx.dv;
  switch (type) {
    case 0x01:
      return stripNul(utf16.decode(ctx.buf.subarray(off, off + (size & ~1))));
    case 0x02:
      return stripNul(windows1252.decode(ctx.buf.subarray(off, off + size)));
    case 0x03:
      return size >= 1 ? String(dv.getInt8(off)) : '';
    case 0x04:
      return size >= 1 ? String(dv.getUint8(off)) : '';
    case 0x05:
      return size >= 2 ? String(dv.getInt16(off, true)) : '';
    case 0x06:
      return size >= 2 ? String(dv.getUint16(off, true)) : '';
    case 0x07:
      return size >= 4 ? String(dv.getInt32(off, true)) : '';
    case 0x08:
      return size >= 4 ? String(dv.getUint32(off, true)) : '';
    case 0x09:
      return size >= 8 ? dv.getBigInt64(off, true).toString() : '';
    case 0x0a:
      return size >= 8 ? dv.getBigUint64(off, true).toString() : '';
    case 0x0b:
      return size >= 4 ? String(dv.getFloat32(off, true)) : '';
    case 0x0c:
      return size >= 8 ? String(dv.getFloat64(off, true)) : '';
    case 0x0d:
      if (size >= 4) return dv.getUint32(off, true) !== 0 ? 'true' : 'false';
      return size >= 1 ? (dv.getUint8(off) !== 0 ? 'true' : 'false') : '';
    case 0x0e: {
      let s = '';
      for (let i = 0; i < size; i++) s += hex2(dv.getUint8(off + i));
      return s;
    }
    case 0x0f:
      return size >= 16 ? guidAt(dv, off) : '';
    case 0x10:
      if (size >= 8) return `0x${dv.getBigUint64(off, true).toString(16).padStart(16, '0')}`;
      return size >= 4 ? `0x${dv.getUint32(off, true).toString(16).padStart(8, '0')}` : '';
    case 0x11:
      return size >= 8 ? filetimeToIso(dv, off) : '';
    case 0x12: {
      if (size < 16) return '';
      const ms = Date.UTC(
        dv.getUint16(off, true),
        dv.getUint16(off + 2, true) - 1,
        dv.getUint16(off + 6, true),
        dv.getUint16(off + 8, true),
        dv.getUint16(off + 10, true),
        dv.getUint16(off + 12, true),
        dv.getUint16(off + 14, true),
      );
      return Number.isFinite(ms) ? new Date(ms).toISOString() : '';
    }
    case 0x13:
      return sidAt(dv, off, size);
    case 0x14:
      return size >= 4 ? `0x${dv.getUint32(off, true).toString(16).padStart(8, '0')}` : '';
    case 0x15:
      return size >= 8 ? `0x${dv.getBigUint64(off, true).toString(16).padStart(16, '0')}` : '';
    default:
      // BinXml (0x21), EvtHandle (0x20), EvtXml (0x23), unbekannt: kein Text.
      return '';
  }
}

function decodeValue(ctx: ChunkCtx, slot: ValueSlot): string {
  const base = slot.type & 0x7f;
  if (slot.size === 0 || base === 0x00 || base === 0x21) return '';
  if ((slot.type & 0x80) === 0) return scalarText(ctx, slot.off, slot.size, base);

  // Arrays: Strings sind NUL-getrennt, übrige Typen haben eine feste Elementgröße.
  if (base === 0x01) {
    const parts = utf16.decode(ctx.buf.subarray(slot.off, slot.off + (slot.size & ~1))).split('\0');
    while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
    return parts.join(', ');
  }
  if (base === 0x02) {
    const parts = windows1252.decode(ctx.buf.subarray(slot.off, slot.off + slot.size)).split('\0');
    while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
    return parts.join(', ');
  }
  const elementSize = base === 0x10 ? 4 : (FIXED_SIZES[base] ?? 0);
  if (elementSize === 0) return '';
  const out: string[] = [];
  for (let i = 0; i + elementSize <= slot.size && out.length < 256; i += elementSize)
    out.push(scalarText(ctx, slot.off + i, elementSize, base));
  return out.join(', ');
}

/** Wert inline im Template-Text (Token 0x05): Typ ist bereits gelesen. */
function readInlineValue(cur: Cursor, type: number): string {
  const ctx = cur.ctx;
  const base = type & 0x7f;
  if (base === 0x01 || base === 0x02) {
    const count = cur.u16();
    const bytes = base === 0x01 ? count * 2 : count;
    const off = cur.pos;
    cur.skip(bytes);
    return base === 0x01
      ? utf16.decode(ctx.buf.subarray(off, off + bytes))
      : windows1252.decode(ctx.buf.subarray(off, off + bytes));
  }
  if (base === 0x0e) {
    const count = cur.u16();
    const off = cur.pos;
    cur.skip(count);
    return scalarText(ctx, off, count, 0x0e);
  }
  if (base === 0x13) {
    const off = cur.pos;
    cur.skip(2);
    const subCount = ctx.dv.getUint8(off + 1);
    cur.skip(6 + subCount * 4);
    return sidAt(ctx.dv, off, 8 + subCount * 4);
  }
  const size = FIXED_SIZES[base] ?? (base === 0x10 ? 4 : 0);
  if (size === 0) throw new EvtxRecordError(`Unbekannter Inline-Werttyp 0x${type.toString(16)}`);
  const off = cur.pos;
  cur.skip(size);
  return scalarText(ctx, off, size, base);
}

// ---------------------------------------------------------------------------
// Binary-XML-Parser (Token-Strom → Baum mit Substitutionen)
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function spend(ctx: ChunkCtx): void {
  if (--ctx.nodeBudget < 0) throw new EvtxRecordError('Zu viele Knoten im Datensatz');
}

/** Wert-Token (Text, Substitution, Referenzen); gibt `null` zurück, wenn das Token keines davon ist. */
function parseValueToken(cur: Cursor, token: number): TNode | null {
  switch (token) {
    case 0x05:
    case 0x45: {
      cur.skip(1);
      const type = cur.u8();
      return { t: 'text', text: readInlineValue(cur, type) };
    }
    case 0x0d:
    case 0x0e: {
      cur.skip(1);
      const id = cur.u16();
      cur.u8(); // deklarierter Typ – maßgeblich ist der Typ in der Wertetabelle
      return { t: 'sub', id, optional: token === 0x0e };
    }
    case 0x08:
    case 0x48:
      cur.skip(1);
      return { t: 'text', text: String.fromCharCode(cur.u16()) };
    case 0x09:
    case 0x49: {
      cur.skip(1);
      const name = readNameRef(cur);
      return { t: 'text', text: ENTITIES[name] ?? `&${name};` };
    }
    case 0x07:
    case 0x47: {
      cur.skip(1);
      const count = cur.u16();
      const off = cur.pos;
      cur.skip(count * 2);
      return { t: 'text', text: utf16.decode(cur.ctx.buf.subarray(off, off + count * 2)) };
    }
    default:
      return null;
  }
}

function parseValueParts(cur: Cursor): TNode[] {
  const parts: TNode[] = [];
  for (;;) {
    const token = cur.peek();
    const node = token < 0 ? null : parseValueToken(cur, token);
    if (!node) return parts;
    spend(cur.ctx);
    parts.push(node);
  }
}

function parseElement(cur: Cursor, token: number, depth: number): TNode {
  if (depth > MAX_DEPTH) throw new EvtxRecordError('Verschachtelung zu tief');
  spend(cur.ctx);
  cur.skip(2); // Dependency-ID
  cur.u32(); // Datengröße – wird nicht benötigt, Grenzen ergeben sich aus den Tokens
  const name = readNameRef(cur);
  if ((token & 0x40) !== 0) cur.u32(); // Größe der Attributliste

  const attrs: Array<{ name: string; parts: TNode[] }> = [];
  for (;;) {
    const next = cur.peek();
    if (next !== 0x06 && next !== 0x46) break;
    cur.skip(1);
    const attrName = readNameRef(cur);
    attrs.push({ name: attrName, parts: parseValueParts(cur) });
  }

  const close = cur.u8();
  const children: TNode[] = [];
  if (close === 0x03) return { t: 'el', name, attrs, children };
  if (close !== 0x02)
    throw new EvtxRecordError(`Unerwartetes Token 0x${close.toString(16)} nach Attributen`);

  for (;;) {
    const next = cur.peek();
    if (next < 0) throw new EvtxRecordError('Element nicht abgeschlossen');
    if (next === 0x04) {
      cur.skip(1);
      return { t: 'el', name, attrs, children };
    }
    if (next === 0x01 || next === 0x41) {
      cur.skip(1);
      children.push(parseElement(cur, next, depth + 1));
    } else if (next === 0x0c) {
      cur.skip(1);
      children.push(parseTemplateInstance(cur, depth + 1));
    } else if (next === 0x0a) {
      cur.skip(1); // Processing-Instruction-Ziel: wird ignoriert
      readNameRef(cur);
    } else if (next === 0x0b) {
      cur.skip(1);
      cur.skip(cur.u16() * 2);
    } else if (next === 0x0f) {
      cur.skip(4);
    } else {
      const node = parseValueToken(cur, next);
      if (!node) throw new EvtxRecordError(`Unbekanntes Token 0x${next.toString(16)}`);
      spend(cur.ctx);
      children.push(node);
    }
  }
}

function parseTemplateInstance(cur: Cursor, depth: number): TNode {
  if (depth > MAX_DEPTH) throw new EvtxRecordError('Verschachtelung zu tief');
  const ctx = cur.ctx;
  cur.u8(); // unbekannt (meist 0x01)
  cur.u32(); // Template-ID (erste 4 Byte der GUID)
  const defOffset = cur.u32();
  let def: TemplateDef;
  if (defOffset === cur.pos) {
    // Definition steht direkt hinter dem Token (erste Verwendung im Chunk)
    def = templateAt(ctx, defOffset, depth);
    const size = ctx.dv.getUint32(defOffset + 20, true);
    cur.skip(TEMPLATE_HEADER_SIZE + size);
  } else {
    def = templateAt(ctx, defOffset, depth);
  }

  const count = cur.u32();
  if (count > MAX_VALUE_COUNT || count * 4 > cur.end - cur.pos)
    throw new EvtxRecordError('Ungültige Anzahl an Substitutionswerten');
  const sizes: number[] = [];
  const types: number[] = [];
  for (let i = 0; i < count; i++) {
    sizes.push(cur.u16());
    types.push(cur.u8());
    cur.u8();
  }
  const values: ValueSlot[] = [];
  for (let i = 0; i < count; i++) {
    const size = sizes[i] ?? 0;
    values.push({ type: types[i] ?? 0, off: cur.pos, size });
    cur.skip(size);
  }
  return { t: 'inst', def, values };
}

function parseFragment(cur: Cursor, depth: number): TNode[] {
  if (depth > MAX_DEPTH) throw new EvtxRecordError('Verschachtelung zu tief');
  const nodes: TNode[] = [];
  while (cur.pos < cur.end) {
    const token = cur.u8();
    if (token === 0x00) return nodes;
    if (token === 0x0f) cur.skip(3);
    else if (token === 0x01 || token === 0x41) nodes.push(parseElement(cur, token, depth));
    else if (token === 0x0c) nodes.push(parseTemplateInstance(cur, depth));
    else throw new EvtxRecordError(`Unerwartetes Token 0x${token.toString(16)}`);
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Instanziierung (Substitutionen auflösen)
// ---------------------------------------------------------------------------

function isEmptySlot(slot: ValueSlot | undefined): boolean {
  return !slot || slot.type === 0 || slot.size === 0;
}

function attrValue(ctx: ChunkCtx, parts: TNode[], vals: ValueSlot[] | null): string | null {
  let out = '';
  let omitted = parts.length > 0;
  for (const part of parts) {
    if (part.t === 'text') {
      out += part.text;
      omitted = false;
    } else if (part.t === 'sub') {
      const slot = vals?.[part.id];
      if (part.optional && isEmptySlot(slot)) continue;
      omitted = false;
      if (slot) out += decodeValue(ctx, slot);
    }
  }
  return omitted ? null : out;
}

function build(
  ctx: ChunkCtx,
  nodes: TNode[],
  vals: ValueSlot[] | null,
  parent: XEl,
  depth: number,
): void {
  if (depth > MAX_DEPTH) throw new EvtxRecordError('Verschachtelung zu tief');
  for (const node of nodes) {
    spend(ctx); // auch die Expansion von Templates zählt (Schutz vor „Billion-Laughs“-Datensätzen)
    if (node.t === 'text') {
      parent.text += node.text;
    } else if (node.t === 'el') {
      const el: XEl = { name: node.name, attrs: {}, children: [], text: '' };
      for (const attr of node.attrs) {
        const value = attrValue(ctx, attr.parts, vals);
        if (value !== null) el.attrs[attr.name] = value;
      }
      build(ctx, node.children, vals, el, depth + 1);
      parent.children.push(el);
    } else if (node.t === 'sub') {
      const slot = vals?.[node.id];
      if (!slot || isEmptySlot(slot)) continue;
      if ((slot.type & 0x7f) === 0x21) {
        const nested = parseFragment(new Cursor(ctx, slot.off, slot.off + slot.size), depth + 1);
        build(ctx, nested, null, parent, depth + 1);
      } else {
        parent.text += decodeValue(ctx, slot);
      }
    } else {
      build(ctx, node.def.nodes, node.values, parent, depth + 1);
    }
  }
}

// ---------------------------------------------------------------------------
// XML-Baum → Ereignis
// ---------------------------------------------------------------------------

function child(el: XEl | undefined, name: string): XEl | undefined {
  return el?.children.find((c) => c.name === name);
}

function textOf(el: XEl): string {
  if (el.children.length === 0) return el.text.trim();
  return [el.text, ...el.children.map(textOf)].join(' ').replace(/\s+/g, ' ').trim();
}

function toInt(text: string | undefined): number | null {
  if (text === undefined || text.trim() === '') return null;
  const n = Number(text.trim());
  return Number.isFinite(n) ? n : null;
}

function addUnique(target: Record<string, string>, key: string, value: string): void {
  let name = key;
  for (let i = 2; Object.prototype.hasOwnProperty.call(target, name); i++) name = `${key}_${i}`;
  target[name] = value;
}

function extractData(event: XEl): Pick<EvtxEvent, 'data' | 'dataKind'> {
  const data: Record<string, string> = {};
  const eventData = child(event, 'EventData');
  if (eventData) {
    let unnamed = 0;
    for (const entry of eventData.children) {
      if (entry.name === 'Data') {
        const name = entry.attrs['Name'];
        addUnique(data, name ? name : `Data${++unnamed}`, textOf(entry));
      } else {
        addUnique(data, entry.name, textOf(entry));
      }
    }
    // Text direkt unter EventData ohne Data-Elemente
    if (eventData.children.length === 0 && eventData.text.trim() !== '')
      data['Data1'] = eventData.text.trim();
    return { data, dataKind: 'EventData' };
  }
  const userData = child(event, 'UserData');
  if (userData) {
    const root = userData.children[0];
    if (root) {
      if (root.children.length === 0) {
        if (root.text.trim() !== '') addUnique(data, root.name, root.text.trim());
      } else {
        for (const entry of root.children) addUnique(data, entry.name, textOf(entry));
      }
    }
    return { data, dataKind: 'UserData' };
  }
  return { data, dataKind: null };
}

function toEvent(roots: XEl[], recordId: number, writtenIso: string | null): EvtxEvent | null {
  const event = roots.find((el) => el.name === 'Event');
  if (!event) return null;
  const system = child(event, 'System');
  const level = toInt(child(system, 'Level')?.text);
  const sysTime = child(system, 'TimeCreated')?.attrs['SystemTime'];
  return {
    recordId,
    eventId: toInt(child(system, 'EventID')?.text),
    level,
    timeCreated: sysTime ? sysTime : writtenIso,
    provider: child(system, 'Provider')?.attrs['Name'] ?? null,
    channel: child(system, 'Channel')?.text.trim() || null,
    computer: child(system, 'Computer')?.text.trim() || null,
    ...extractData(event),
  };
}

// ---------------------------------------------------------------------------
// Datei, Chunks, Datensätze
// ---------------------------------------------------------------------------

function hasAscii(bytes: Uint8Array, at: number, text: string): boolean {
  if (at + text.length > bytes.length) return false;
  for (let i = 0; i < text.length; i++) if (bytes[at + i] !== text.charCodeAt(i)) return false;
  return true;
}

function isAllZero(bytes: Uint8Array, from: number, to: number): boolean {
  for (let i = from; i < to; i++) if (bytes[i] !== 0) return false;
  return true;
}

function u64(dv: DataView, off: number): number {
  return dv.getUint32(off + 4, true) * 4294967296 + dv.getUint32(off, true);
}

function msFromFiletime(dv: DataView, off: number): number {
  return u64(dv, off) / 10000 - 11644473600000;
}

function recordValid(dv: DataView, off: number, limit: number): number {
  if (off + MIN_RECORD_SIZE > limit || dv.getUint32(off, true) !== RECORD_MAGIC) return 0;
  const size = dv.getUint32(off + 4, true);
  if (size < MIN_RECORD_SIZE || off + size > limit) return 0;
  return dv.getUint32(off + size - 4, true) === size ? size : 0;
}

interface ParseState {
  stats: EvtxParseStats;
  events: EvtxEvent[];
  decoded: number;
  maxRecords: number;
  maxEvents: number;
  sinceMs: number | null;
  filter: ((event: EvtxEvent) => boolean) | undefined;
  deadline: number;
}

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

function parseChunk(buf: Uint8Array, state: ParseState): void {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const len = buf.length;
  const freeOffset = dv.getUint32(48, true);
  const limit = freeOffset >= CHUNK_HEADER_SIZE && freeOffset <= len ? freeOffset : len;
  const ctx: ChunkCtx = {
    dv,
    buf,
    len,
    names: new Map(),
    templates: new Map(),
    nodeBudget: 0,
  };
  const { stats } = state;

  let off = CHUNK_HEADER_SIZE;
  let sinceCheck = 0;
  while (off + MIN_RECORD_SIZE <= limit) {
    let size = recordValid(dv, off, limit);
    if (size === 0) {
      // Beschädigter Bereich: bis zum nächsten plausiblen Datensatz weitersuchen
      let next = off + 4;
      while (next + MIN_RECORD_SIZE <= limit && recordValid(dv, next, limit) === 0) next += 4;
      if (next + MIN_RECORD_SIZE > limit) {
        // Nur Leerraum (nicht beschriebener Rest des Chunks) ist kein Fehler
        if (!isAllZero(buf, off, limit)) stats.recordsFailed++;
        return;
      }
      stats.recordsFailed++;
      off = next;
      size = recordValid(dv, off, limit);
    }

    stats.recordsScanned++;
    if ((++sinceCheck & 0x1ff) === 0 && now() > state.deadline) {
      stats.timedOut = true;
      return;
    }

    const writtenMs = msFromFiletime(dv, off + 16);
    if (state.sinceMs !== null && writtenMs < state.sinceMs) {
      stats.recordsOutsideWindow++;
      off += size;
      continue;
    }
    if (state.decoded >= state.maxRecords) {
      stats.capped = true;
      return;
    }

    ctx.nodeBudget = MAX_NODES_PER_RECORD;
    try {
      const recordId = u64(dv, off + 8);
      const cursor = new Cursor(ctx, off + 24, off + size - 4);
      const nodes = parseFragment(cursor, 0);
      const root: XEl = { name: '#root', attrs: {}, children: [], text: '' };
      build(ctx, nodes, null, root, 0);
      const writtenIso =
        Number.isFinite(writtenMs) && Math.abs(writtenMs) <= 8.64e15
          ? new Date(writtenMs).toISOString()
          : null;
      const event = toEvent(root.children, recordId, writtenIso);
      if (event) {
        state.decoded++;
        stats.recordsDecoded++;
        if (!state.filter || state.filter(event)) state.events.push(event);
      } else {
        stats.recordsFailed++;
      }
    } catch {
      stats.recordsFailed++;
    }
    off += size;
  }
}

/**
 * Liest ein EVTX-Protokoll. Wirft `EvtxFormatError`, wenn die Datei nicht mit `ElfFile\0`
 * beginnt; alles Weitere (defekte Chunks/Datensätze, gekappte Datei) wird übersprungen und in
 * `stats` ausgewiesen.
 */
export function parseEvtx(bytes: Uint8Array, options: EvtxParseOptions = {}): EvtxParseResult {
  if (!hasAscii(bytes, 0, 'ElfFile\0'))
    throw new EvtxFormatError('Keine EVTX-Datei (Signatur fehlt)');

  const maxRecords = options.maxRecords ?? EVTX_DEFAULT_MAX_RECORDS;
  const maxEvents = options.maxEvents ?? maxRecords;
  const sinceMs =
    options.since === undefined
      ? null
      : options.since instanceof Date
        ? options.since.getTime()
        : options.since;
  const stats: EvtxParseStats = {
    chunksTotal: 0,
    chunksParsed: 0,
    chunksInvalid: 0,
    recordsScanned: 0,
    recordsDecoded: 0,
    recordsFailed: 0,
    recordsOutsideWindow: 0,
    truncated: false,
    capped: false,
    timedOut: false,
  };
  const state: ParseState = {
    stats,
    events: [],
    decoded: 0,
    maxRecords,
    maxEvents,
    sinceMs: sinceMs !== null && Number.isFinite(sinceMs) ? sinceMs : null,
    filter: options.filter,
    deadline: now() + (options.timeBudgetMs ?? EVTX_DEFAULT_TIME_BUDGET_MS),
  };

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let headerSize = bytes.length >= 42 ? view.getUint16(40, true) : FILE_HEADER_DEFAULT_SIZE;
  if (headerSize < 128 || headerSize > EVTX_CHUNK_SIZE) headerSize = FILE_HEADER_DEFAULT_SIZE;
  const declaredChunks = bytes.length >= 44 ? view.getUint16(42, true) : 0;

  // Chunk-Plätze einsammeln
  const chunks: Array<{ base: number; length: number; lastId: number }> = [];
  for (let base = headerSize; base < bytes.length; base += EVTX_CHUNK_SIZE) {
    const length = Math.min(EVTX_CHUNK_SIZE, bytes.length - base);
    stats.chunksTotal++;
    if (length < CHUNK_HEADER_SIZE) {
      stats.chunksInvalid++;
      stats.truncated = true;
      continue;
    }
    if (length < EVTX_CHUNK_SIZE) stats.truncated = true;
    if (!hasAscii(bytes, base, 'ElfChnk\0')) {
      // Nicht beschriebener (genullter) Platz ist kein Fehler
      if (!isAllZero(bytes, base, base + Math.min(length, 64))) stats.chunksInvalid++;
      continue;
    }
    const chunkView = new DataView(bytes.buffer, bytes.byteOffset + base, length);
    chunks.push({ base, length, lastId: u64(chunkView, 32) });
  }
  if (declaredChunks > stats.chunksTotal) stats.truncated = true;

  // Jüngste Chunks zuerst, damit bei Begrenzung die neuesten Ereignisse bleiben
  chunks.sort((a, b) => b.lastId - a.lastId || b.base - a.base);
  for (const chunk of chunks) {
    if (stats.timedOut || stats.capped) break;
    if (state.events.length >= state.maxEvents) {
      stats.capped = true;
      break;
    }
    if (now() > state.deadline) {
      stats.timedOut = true;
      break;
    }
    try {
      parseChunk(bytes.subarray(chunk.base, chunk.base + chunk.length), state);
      stats.chunksParsed++;
    } catch {
      stats.chunksInvalid++;
    }
  }

  const events = state.events.sort((a, b) => a.recordId - b.recordId);
  if (events.length > state.maxEvents) {
    events.splice(0, events.length - state.maxEvents);
    stats.capped = true;
  }
  return { events, stats };
}
