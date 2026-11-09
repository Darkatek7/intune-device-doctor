/**
 * Minimaler EVTX-/Binary-XML-Encoder für Fixture und Tests (Gegenstück zu parsers/evtx.ts).
 * Erzeugt gültig aufgebaute Dateien: Dateikopf, 64-KiB-Chunks, Datensätze mit TemplateInstance
 * (Definition beim ersten Mal inline, danach per Offset), Substitutionen, optionale Substitutionen
 * und verschachteltes BinXml für EventData. Prüfsummen und Hash-Tabellen werden nicht geschrieben
 * (der Parser wertet sie nicht aus); die Dateien sind nicht für die Windows-Ereignisanzeige gedacht.
 *
 * Ausschließlich fiktive Daten (Contoso, Null-GUIDs). Browser- und Node-tauglich.
 */

const CHUNK_SIZE = 0x10000;
const FILE_HEADER_SIZE = 4096;
const CHUNK_HEADER_SIZE = 512;

// ---------------------------------------------------------------------------
// Byte-Schreiber
// ---------------------------------------------------------------------------

/** Wächst nach hinten; `pos` ist der Offset relativ zum Chunk-Anfang (wie in Binary XML). */
export class Out {
  readonly bytes: number[] = [];
  constructor(readonly base: number) {}
  get pos(): number {
    return this.base + this.bytes.length;
  }
  u8(v: number): void {
    this.bytes.push(v & 0xff);
  }
  u16(v: number): void {
    this.bytes.push(v & 0xff, (v >>> 8) & 0xff);
  }
  u32(v: number): void {
    this.bytes.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  }
  u64(v: number | bigint): void {
    let n = BigInt(v);
    for (let i = 0; i < 8; i++) {
      this.bytes.push(Number(n & 0xffn));
      n >>= 8n;
    }
  }
  raw(data: ArrayLike<number>): void {
    for (let i = 0; i < data.length; i++) this.bytes.push(data[i] ?? 0);
  }
  utf16(text: string): void {
    for (let i = 0; i < text.length; i++) this.u16(text.charCodeAt(i));
  }
  patch32(index: number, v: number): void {
    this.bytes[index] = v & 0xff;
    this.bytes[index + 1] = (v >>> 8) & 0xff;
    this.bytes[index + 2] = (v >>> 16) & 0xff;
    this.bytes[index + 3] = (v >>> 24) & 0xff;
  }
  patch16(index: number, v: number): void {
    this.bytes[index] = v & 0xff;
    this.bytes[index + 1] = (v >>> 8) & 0xff;
  }
}

/** Namen und Template-Definitionen eines Chunks (Offsets relativ zum Chunk). */
export interface ChunkState {
  names: Map<string, number>;
  templates: Map<string, number>;
}

const cloneState = (s: ChunkState): ChunkState => ({
  names: new Map(s.names),
  templates: new Map(s.templates),
});

// ---------------------------------------------------------------------------
// Template-Beschreibung und Werte
// ---------------------------------------------------------------------------

export type ValueRef = { sub: number; optional?: boolean } | { text: string };

export type TemplateNode =
  | { el: string; attrs?: Array<[string, ValueRef]>; children?: TemplateNode[] }
  | { text: string }
  | { sub: number; optional?: boolean };

export interface TemplateSpec {
  /** Eindeutiger Schlüssel (bestimmt Template-ID/GUID und die Wiederverwendung im Chunk) */
  key: string;
  root: TemplateNode;
}

/** Wert für die Substitutionstabelle; `write` schreibt die Nutzdaten. */
export interface EvtxValue {
  type: number;
  write: (w: Out, state: ChunkState) => void;
}

export const V = {
  /** NUL-terminierter UTF-16LE-String (String, 0x01) */
  string: (s: string): EvtxValue => ({
    type: 0x01,
    write: (w) => {
      w.utf16(s);
      w.u16(0);
    },
  }),
  ansi: (s: string): EvtxValue => ({
    type: 0x02,
    write: (w) => {
      for (let i = 0; i < s.length; i++) w.u8(s.charCodeAt(i));
      w.u8(0);
    },
  }),
  int8: (n: number): EvtxValue => ({ type: 0x03, write: (w) => w.u8(n) }),
  uint8: (n: number): EvtxValue => ({ type: 0x04, write: (w) => w.u8(n) }),
  int16: (n: number): EvtxValue => ({ type: 0x05, write: (w) => w.u16(n) }),
  uint16: (n: number): EvtxValue => ({ type: 0x06, write: (w) => w.u16(n) }),
  int32: (n: number): EvtxValue => ({ type: 0x07, write: (w) => w.u32(n) }),
  uint32: (n: number): EvtxValue => ({ type: 0x08, write: (w) => w.u32(n) }),
  int64: (n: bigint | number): EvtxValue => ({
    type: 0x09,
    write: (w) => w.u64(BigInt.asUintN(64, BigInt(n))),
  }),
  uint64: (n: bigint | number): EvtxValue => ({ type: 0x0a, write: (w) => w.u64(n) }),
  float32: (n: number): EvtxValue => ({
    type: 0x0b,
    write: (w) => {
      const b = new DataView(new ArrayBuffer(4));
      b.setFloat32(0, n, true);
      w.raw(new Uint8Array(b.buffer));
    },
  }),
  float64: (n: number): EvtxValue => ({
    type: 0x0c,
    write: (w) => {
      const b = new DataView(new ArrayBuffer(8));
      b.setFloat64(0, n, true);
      w.raw(new Uint8Array(b.buffer));
    },
  }),
  bool: (b: boolean): EvtxValue => ({ type: 0x0d, write: (w) => w.u32(b ? 1 : 0) }),
  binary: (data: ArrayLike<number>): EvtxValue => ({ type: 0x0e, write: (w) => w.raw(data) }),
  /** "{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}" (Klammern optional) */
  guid: (text: string): EvtxValue => ({ type: 0x0f, write: (w) => w.raw(guidBytes(text)) }),
  sizeT32: (n: number): EvtxValue => ({ type: 0x10, write: (w) => w.u32(n) }),
  sizeT64: (n: bigint | number): EvtxValue => ({ type: 0x10, write: (w) => w.u64(n) }),
  filetime: (when: Date | string): EvtxValue => ({
    type: 0x11,
    write: (w) => w.u64(toFiletime(when)),
  }),
  systemtime: (when: Date): EvtxValue => ({
    type: 0x12,
    write: (w) => {
      w.u16(when.getUTCFullYear());
      w.u16(when.getUTCMonth() + 1);
      w.u16(when.getUTCDay());
      w.u16(when.getUTCDate());
      w.u16(when.getUTCHours());
      w.u16(when.getUTCMinutes());
      w.u16(when.getUTCSeconds());
      w.u16(when.getUTCMilliseconds());
    },
  }),
  /** "S-1-5-18" */
  sid: (text: string): EvtxValue => ({
    type: 0x13,
    write: (w) => {
      const parts = text.split('-').slice(1).map(Number);
      const [revision = 1, authority = 0, ...sub] = parts;
      w.u8(revision);
      w.u8(sub.length);
      for (let shift = 40; shift >= 0; shift -= 8) w.u8(Math.floor(authority / 2 ** shift) % 256);
      for (const s of sub) w.u32(s);
    },
  }),
  hex32: (n: number): EvtxValue => ({ type: 0x14, write: (w) => w.u32(n) }),
  hex64: (n: bigint | number): EvtxValue => ({ type: 0x15, write: (w) => w.u64(n) }),
  /** NUL-getrenntes Array von Strings (Typ 0x81) */
  stringArray: (items: string[]): EvtxValue => ({
    type: 0x81,
    write: (w) => {
      for (const item of items) {
        w.utf16(item);
        w.u16(0);
      }
    },
  }),
  uint16Array: (items: number[]): EvtxValue => ({
    type: 0x86,
    write: (w) => items.forEach((n) => w.u16(n)),
  }),
  /** Typ „NULL“ (0x00), Größe 0 – bei optionaler Substitution entfällt das Element/Attribut */
  nil: (): EvtxValue => ({ type: 0x00, write: () => undefined }),
  /** Verschachteltes Binary-XML-Fragment (Typ 0x21) mit eigener TemplateInstance */
  binxml: (template: TemplateSpec, values: EvtxValue[]): EvtxValue => ({
    type: 0x21,
    write: (w, state) => {
      w.raw([0x0f, 0x01, 0x01, 0x00]);
      writeInstance(w, state, template, values);
      w.u8(0x00);
    },
  }),
  /** Beliebige Rohbytes mit beliebigem Typ (für Negativtests) */
  rawType: (type: number, data: ArrayLike<number>): EvtxValue => ({
    type,
    write: (w) => w.raw(data),
  }),
};

function guidBytes(text: string): number[] {
  const hex = text.replace(/[{}-]/g, '');
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) throw new Error(`Ungültige GUID: ${text}`);
  const b = (i: number) => parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return [b(3), b(2), b(1), b(0), b(5), b(4), b(7), b(6), ...[8, 9, 10, 11, 12, 13, 14, 15].map(b)];
}

export function toFiletime(when: Date | string): bigint {
  const ms = (when instanceof Date ? when : new Date(when)).getTime();
  if (!Number.isFinite(ms)) throw new Error(`Ungültiger Zeitpunkt: ${String(when)}`);
  return (BigInt(ms) + 11644473600000n) * 10000n;
}

// ---------------------------------------------------------------------------
// Binary XML schreiben
// ---------------------------------------------------------------------------

function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(h, 65599) + name.charCodeAt(i)) & 0xffff;
  return h;
}

/** Schreibt einen Namens-Verweis; beim ersten Mal steht der Name direkt dahinter („inline“). */
function writeNameRef(w: Out, state: ChunkState, name: string): void {
  const known = state.names.get(name);
  if (known !== undefined) {
    w.u32(known);
    return;
  }
  const at = w.pos + 4;
  state.names.set(name, at);
  w.u32(at);
  w.u32(0); // nächster Name in der Hash-Kette (nicht gepflegt)
  w.u16(nameHash(name));
  w.u16(name.length);
  w.utf16(name);
  w.u16(0);
}

function writeValueRef(w: Out, ref: ValueRef): void {
  if ('text' in ref) {
    w.u8(0x05);
    w.u8(0x01);
    w.u16(ref.text.length);
    w.utf16(ref.text);
  } else {
    w.u8(ref.optional ? 0x0e : 0x0d);
    w.u16(ref.sub);
    w.u8(0); // deklarierter Typ: maßgeblich ist die Wertetabelle
  }
}

function writeNode(w: Out, state: ChunkState, node: TemplateNode): void {
  if ('text' in node) {
    writeValueRef(w, node);
    return;
  }
  if ('sub' in node) {
    writeValueRef(w, node);
    return;
  }
  const attrs = node.attrs ?? [];
  const children = node.children ?? [];
  w.u8(attrs.length > 0 ? 0x41 : 0x01);
  w.u16(0xffff);
  const sizeAt = w.bytes.length;
  w.u32(0);
  const dataStart = w.bytes.length;
  writeNameRef(w, state, node.el);
  if (attrs.length > 0) {
    const listAt = w.bytes.length;
    w.u32(0);
    const listStart = w.bytes.length;
    attrs.forEach(([name, value], index) => {
      w.u8(index < attrs.length - 1 ? 0x46 : 0x06);
      writeNameRef(w, state, name);
      writeValueRef(w, value);
    });
    w.patch32(listAt, w.bytes.length - listStart);
  }
  if (children.length === 0) {
    w.u8(0x03);
  } else {
    w.u8(0x02);
    for (const child of children) writeNode(w, state, child);
    w.u8(0x04);
  }
  w.patch32(sizeAt, w.bytes.length - dataStart);
}

function templateGuid(key: string): number[] {
  // FNV-1a-Varianten über den Schlüssel → 16 deterministische Byte
  const out: number[] = [];
  let h = 0x811c9dc5;
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
    h = Math.imul(h ^ (round + 1), 0x01000193) >>> 0;
    out.push(h & 0xff, (h >>> 8) & 0xff, (h >>> 16) & 0xff, (h >>> 24) & 0xff);
  }
  return out;
}

/** TemplateInstance inkl. Definition (beim ersten Mal im Chunk inline) und Wertetabelle. */
export function writeInstance(
  w: Out,
  state: ChunkState,
  template: TemplateSpec,
  values: EvtxValue[],
): void {
  const guid = templateGuid(template.key);
  w.u8(0x0c);
  w.u8(0x01);
  w.u32(guid[0]! | (guid[1]! << 8) | (guid[2]! << 16) | (guid[3]! << 24));
  const known = state.templates.get(template.key);
  if (known !== undefined) {
    w.u32(known);
  } else {
    const defOffset = w.pos + 4;
    state.templates.set(template.key, defOffset);
    w.u32(defOffset);
    w.u32(0); // nächste Definition (nicht gepflegt)
    w.raw(guid);
    const sizeAt = w.bytes.length;
    w.u32(0);
    const dataStart = w.bytes.length;
    w.raw([0x0f, 0x01, 0x01, 0x00]);
    writeNode(w, state, template.root);
    w.u8(0x00);
    w.patch32(sizeAt, w.bytes.length - dataStart);
  }

  w.u32(values.length);
  const descriptorAt = w.bytes.length;
  for (const value of values) {
    w.u16(0); // Größe – nach dem Schreiben der Daten eingetragen
    w.u8(value.type);
    w.u8(0);
  }
  values.forEach((value, index) => {
    const start = w.bytes.length;
    value.write(w, state);
    w.patch16(descriptorAt + index * 4, w.bytes.length - start);
  });
}

// ---------------------------------------------------------------------------
// Datensätze, Chunks, Datei
// ---------------------------------------------------------------------------

export interface EvtxRecordSpec {
  time: Date | string;
  recordId?: number;
  template: TemplateSpec;
  values: EvtxValue[];
}

function encodeRecord(
  spec: EvtxRecordSpec,
  recordId: number,
  base: number,
  state: ChunkState,
): Uint8Array {
  const w = new Out(base);
  w.raw([0x2a, 0x2a, 0x00, 0x00]);
  w.u32(0);
  w.u64(recordId);
  w.u64(toFiletime(spec.time));
  w.raw([0x0f, 0x01, 0x01, 0x00]);
  writeInstance(w, state, spec.template, spec.values);
  w.u8(0x00);
  while ((w.bytes.length + 4) % 8 !== 0) w.u8(0);
  const size = w.bytes.length + 4;
  w.patch32(4, size);
  w.u32(size);
  return Uint8Array.from(w.bytes);
}

export interface BuiltChunk {
  bytes: Uint8Array;
  records: number;
  firstId: number;
  lastId: number;
}

function buildChunk(specs: EvtxRecordSpec[], start: number, firstNumber: number): BuiltChunk {
  const chunk = new Uint8Array(CHUNK_SIZE);
  const dv = new DataView(chunk.buffer);
  let state: ChunkState = { names: new Map(), templates: new Map() };
  let pos = CHUNK_HEADER_SIZE;
  let count = 0;
  let lastRecordOffset = 0;
  let firstId = 0;
  let lastId = 0;

  for (let i = start; i < specs.length; i++) {
    const spec = specs[i]!;
    const recordId = spec.recordId ?? i + 1;
    const trial = cloneState(state);
    const record = encodeRecord(spec, recordId, pos, trial);
    if (pos + record.length > CHUNK_SIZE) {
      if (count === 0) throw new Error('Datensatz passt nicht in einen Chunk');
      break;
    }
    chunk.set(record, pos);
    lastRecordOffset = pos;
    pos += record.length;
    state = trial;
    if (count === 0) firstId = recordId;
    lastId = recordId;
    count++;
  }

  chunk.set(
    [...'ElfChnk'].map((c) => c.charCodeAt(0)),
    0,
  );
  dv.setBigUint64(8, BigInt(firstNumber), true);
  dv.setBigUint64(16, BigInt(firstNumber + count - 1), true);
  dv.setBigUint64(24, BigInt(firstId), true);
  dv.setBigUint64(32, BigInt(lastId), true);
  dv.setUint32(40, 128, true);
  dv.setUint32(44, lastRecordOffset, true);
  dv.setUint32(48, pos, true);
  return { bytes: chunk, records: count, firstId, lastId };
}

/** Baut eine komplette .evtx-Datei aus Datensatz-Beschreibungen (Chunks nach Bedarf). */
export function buildEvtxFromRecords(specs: EvtxRecordSpec[]): Uint8Array {
  const chunks: BuiltChunk[] = [];
  let index = 0;
  do {
    const chunk = buildChunk(specs, index, index);
    chunks.push(chunk);
    index += chunk.records;
  } while (index < specs.length);

  const out = new Uint8Array(FILE_HEADER_SIZE + chunks.length * CHUNK_SIZE);
  const dv = new DataView(out.buffer);
  out.set(
    [...'ElfFile'].map((c) => c.charCodeAt(0)),
    0,
  );
  dv.setBigUint64(8, 0n, true);
  dv.setBigUint64(16, BigInt(chunks.length - 1), true);
  dv.setBigUint64(24, BigInt((chunks.at(-1)?.lastId ?? 0) + 1), true);
  dv.setUint32(32, 128, true);
  dv.setUint16(36, 1, true);
  dv.setUint16(38, 3, true);
  dv.setUint16(40, FILE_HEADER_SIZE, true);
  dv.setUint16(42, chunks.length, true);
  chunks.forEach((chunk, i) => out.set(chunk.bytes, FILE_HEADER_SIZE + i * CHUNK_SIZE));
  return out;
}

// ---------------------------------------------------------------------------
// Standard-Ereignisse (System + EventData bzw. UserData)
// ---------------------------------------------------------------------------

export const FIXTURE_MDM_PROVIDER =
  'Microsoft-Windows-DeviceManagement-Enterprise-Diagnostics-Provider';
export const FIXTURE_MDM_PROVIDER_GUID = '{3DA494E4-0FE2-415C-B895-FB5265C5C83B}';
export const FIXTURE_MDM_CHANNEL =
  'Microsoft-Windows-DeviceManagement-Enterprise-Diagnostics-Provider/Admin';
const EVENT_NS = 'http://schemas.microsoft.com/win/2004/08/events/event';

export interface EvtxEventInput {
  time: Date | string;
  eventId: number;
  /** 1 = Kritisch, 2 = Fehler, 3 = Warnung, 4 = Information */
  level: number;
  recordId?: number;
  provider?: string;
  providerGuid?: string;
  channel?: string;
  computer?: string;
  /**
   * 'template' (Standard): benannte Data-Elemente fest im Template (wie Manifest-Ereignisse),
   * 'binxml': EventData als verschachteltes BinXml mit unbenannten Data-Elementen (klassische Ereignisse),
   * 'userdata': UserData mit benannten Feldern.
   */
  style?: 'template' | 'binxml' | 'userdata';
  /** Name → Wert (EventData bzw. UserData); bei 'binxml' werden nur die Werte geschrieben */
  data?: Array<[string, string]>;
  /** Optional: Qualifiers (Attribut von EventID) */
  qualifiers?: number;
}

const DEFAULT_COMPUTER = 'CONTOSO-PC042.contoso.com';

/** System-Elemente nach Provider (Substitutionen 0–13, siehe systemValues). */
const SYSTEM_TAIL: TemplateNode[] = [
  { el: 'EventID', attrs: [['Qualifiers', { sub: 0, optional: true }]], children: [{ sub: 1 }] },
  { el: 'Level', children: [{ sub: 2 }] },
  { el: 'Task', children: [{ sub: 3 }] },
  { el: 'Keywords', children: [{ sub: 4 }] },
  { el: 'TimeCreated', attrs: [['SystemTime', { sub: 5 }]] },
  { el: 'EventRecordID', children: [{ sub: 6 }] },
  {
    el: 'Correlation',
    attrs: [
      ['ActivityID', { sub: 7, optional: true }],
      ['RelatedActivityID', { sub: 8, optional: true }],
    ],
  },
  {
    el: 'Execution',
    attrs: [
      ['ProcessID', { sub: 9 }],
      ['ThreadID', { sub: 10 }],
    ],
  },
  { el: 'Channel', children: [{ sub: 11 }] },
  { el: 'Computer', children: [{ sub: 12 }] },
  { el: 'Security', attrs: [['UserID', { sub: 13 }]] },
];

/** Gemeinsame System-Werte (Substitutionen 0–13). */
function systemValues(e: EvtxEventInput, recordId: number): EvtxValue[] {
  return [
    e.qualifiers === undefined ? V.nil() : V.uint16(e.qualifiers),
    V.uint16(e.eventId),
    V.uint8(e.level),
    V.uint16(0),
    V.hex64(0x8000000000000000n),
    V.filetime(e.time),
    V.uint64(recordId),
    V.nil(),
    V.nil(),
    V.uint32(4242),
    V.uint32(4343),
    V.string(e.channel ?? FIXTURE_MDM_CHANNEL),
    V.string(e.computer ?? DEFAULT_COMPUTER),
    V.sid('S-1-5-18'),
  ];
}

/** Template + Werte für ein Standard-Ereignis (alle drei Stile). */
export function recordSpecFor(event: EvtxEventInput, recordId: number): EvtxRecordSpec {
  const style = event.style ?? 'template';
  const data = event.data ?? [];
  const provider = event.provider ?? FIXTURE_MDM_PROVIDER;
  const guid = event.providerGuid ?? FIXTURE_MDM_PROVIDER_GUID;
  const base = systemValues(event, recordId);

  if (style === 'binxml') {
    // Klassisch: Provider als Substitution, EventData als verschachtelte TemplateInstance (BinXml).
    const nested: TemplateSpec = {
      key: `nested:${data.length}`,
      root: {
        el: 'EventData',
        children: data.map((_, i) => ({ el: 'Data', children: [{ sub: i }] })),
      },
    };
    const template: TemplateSpec = {
      key: 'classic',
      root: {
        el: 'Event',
        attrs: [['xmlns', { text: EVENT_NS }]],
        children: [
          {
            el: 'System',
            children: [
              {
                el: 'Provider',
                attrs: [
                  ['Name', { sub: 14 }],
                  ['Guid', { sub: 15 }],
                ],
              },
              ...SYSTEM_TAIL,
            ],
          },
          { sub: 16 },
        ],
      },
    };
    return {
      time: event.time,
      recordId,
      template,
      values: [
        ...base,
        V.string(provider),
        V.guid(guid),
        V.binxml(
          nested,
          data.map(([, v]) => V.string(v)),
        ),
      ],
    };
  }

  const eventDataNode: TemplateNode =
    style === 'userdata'
      ? {
          el: 'UserData',
          children: [
            {
              el: 'Operation',
              attrs: [
                ['xmlns', { text: 'http://schemas.microsoft.com/win/2004/08/events/contoso' }],
              ],
              children: data.map(([name], i) => ({ el: name, children: [{ sub: 14 + i }] })),
            },
          ],
        }
      : {
          el: 'EventData',
          children: data.map(([name], i) => ({
            el: 'Data',
            attrs: [['Name', { text: name }]],
            children: [{ sub: 14 + i }],
          })),
        };

  const template: TemplateSpec = {
    key: `${style}:${provider}:${guid}:${data.map(([n]) => n).join(',')}`,
    root: {
      el: 'Event',
      attrs: [['xmlns', { text: EVENT_NS }]],
      children: [
        {
          el: 'System',
          children: [
            {
              el: 'Provider',
              attrs: [
                ['Name', { text: provider }],
                ['Guid', { text: guid }],
              ],
            },
            ...SYSTEM_TAIL,
          ],
        },
        eventDataNode,
      ],
    },
  };
  return {
    time: event.time,
    recordId,
    template,
    values: [...base, ...data.map(([, v]) => V.string(v))],
  };
}

/** Baut eine .evtx-Datei aus Standard-Ereignissen (RecordIDs ab 1, sofern nicht angegeben). */
export function buildEvtx(events: EvtxEventInput[]): Uint8Array {
  return buildEvtxFromRecords(events.map((e, i) => recordSpecFor(e, e.recordId ?? i + 1)));
}
