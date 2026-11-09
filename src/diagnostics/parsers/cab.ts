/**
 * Reiner Parser für Cabinet-Dateien (.cab), z. B. das MDM-Diagnosepaket `mdmlogs-*.cab` aus dem
 * DiagLogs-ZIP. Keine Abhängigkeit außer `fflate` (Inflate). Läuft im Analyse-Worker.
 *
 * Format: Microsoft „Cabinet File Format“ (Cabinet SDK / [MS-CAB]), siehe docs/diaglogs-format.md.
 * Unterstützt werden Dateiliste und das gezielte Entpacken **einzelner** Dateien aus Ordnern mit
 * MSZIP oder ohne Kompression. LZX und Quantum sowie mehrteilige Cabinet-Sätze werden sauber als
 * „nicht unterstützt“ gemeldet (`CabUnsupportedError`).
 *
 * MSZIP: Jeder CFDATA-Block ist ein vollständiger Deflate-Strom mit Signatur `CK`; über die
 * Blockgrenzen eines Ordners hinweg bleibt nur das 32-KiB-Verlaufsfenster erhalten (wird als
 * Wörterbuch an Inflate übergeben).
 *
 * Defensiv: alle Offsets und Größen werden gegen die Datei geprüft; Größenlimits für die entpackte
 * Datei und für die Menge der dafür zu entpackenden Daten verhindern Zeit-/Speicherbomben.
 */
import { inflateSync } from 'fflate';

/** Standardlimit für eine einzelne entpackte Datei (32 MiB) */
export const DEFAULT_MAX_CAB_FILE_BYTES = 32 * 1024 * 1024;
/** Standardlimit für die Menge entpackter Daten, die für eine Datei durchlaufen werden (256 MiB) */
export const DEFAULT_MAX_CAB_SCAN_BYTES = 256 * 1024 * 1024;

const HEADER_SIZE = 36;
const FOLDER_SIZE = 8;
const FILE_FIXED_SIZE = 16;
const DATA_FIXED_SIZE = 8;
const WINDOW_SIZE = 32768;
const MAX_NAME_BYTES = 512;

const FLAG_PREV = 0x0001;
const FLAG_NEXT = 0x0002;
const FLAG_RESERVE = 0x0004;
const ATTR_NAME_IS_UTF = 0x0080;
const IFOLD_CONTINUED_FROM_PREV = 0xfffd;
const IFOLD_CONTINUED_TO_NEXT = 0xfffe;
const IFOLD_CONTINUED_PREV_AND_NEXT = 0xffff;

export type CabCompression = 'none' | 'mszip' | 'quantum' | 'lzx' | 'unknown';

export type CabFormatErrorCode =
  | 'signature'
  | 'header'
  | 'truncated'
  | 'folder'
  | 'file'
  | 'checksum'
  | 'mszip'
  | 'inflate'
  | 'size';

/** Keine gültige oder eine beschädigte Cabinet-Datei (defekte Offsets/Größen, Prüfsumme, Inflate). */
export class CabFormatError extends Error {
  constructor(
    readonly code: CabFormatErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CabFormatError';
  }
}

export type CabUnsupportedReason = 'lzx' | 'quantum' | 'unknown' | 'multiVolume';

/** Gültiges Cabinet, aber Verfahren/Aufbau wird nicht unterstützt (LZX, Quantum, mehrteilig). */
export class CabUnsupportedError extends Error {
  constructor(
    readonly reason: CabUnsupportedReason,
    message: string,
  ) {
    super(message);
    this.name = 'CabUnsupportedError';
  }
}

/** Größenlimit überschritten (entpackte Datei bzw. zu entpackende Datenmenge). */
export class CabLimitError extends Error {
  constructor(
    readonly limit: 'fileSize' | 'scan',
    message: string,
  ) {
    super(message);
    this.name = 'CabLimitError';
  }
}

export interface CabFolderInfo {
  /** Absoluter Offset des ersten CFDATA-Blocks */
  dataOffset: number;
  blockCount: number;
  /** Rohwert `typeCompress` (untere 4 Bit = Verfahren) */
  typeCompress: number;
  compression: CabCompression;
}

export interface CabFileInfo {
  /** Name wie im Cabinet (kann Pfadtrenner enthalten) */
  name: string;
  /** Unkomprimierte Größe in Byte */
  size: number;
  folderIndex: number;
  /** Unkomprimierter Offset innerhalb des Ordners */
  offset: number;
  /** Datei beginnt in einem vorherigen bzw. endet in einem folgenden Cabinet des Satzes */
  continuedFromPrev: boolean;
  continuedToNext: boolean;
}

export interface CabExtractOptions {
  /** Höchstgröße der entpackten Datei (Standard 32 MiB) */
  maxBytes?: number;
  /** Höchstmenge entpackter Daten, die bis zum Ende der Datei durchlaufen werden (Standard 256 MiB) */
  maxScanBytes?: number;
}

export interface CabOpenOptions {
  /** Höchstzahl gelesener Dateieinträge (Standard 5000) */
  maxFiles?: number;
}

export interface CabArchive {
  /** Größe laut Kopf (`cbCabinet`) */
  declaredSize: number;
  /** Tatsächlich vorliegende Bytes */
  actualSize: number;
  /** Datei kürzer als im Kopf angegeben oder Dateiliste vorzeitig zu Ende */
  truncated: boolean;
  version: string;
  setId: number;
  cabinetIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
  folders: CabFolderInfo[];
  files: CabFileInfo[];
  /** Entpackt genau eine Datei (wirft CabFormatError / CabUnsupportedError / CabLimitError). */
  extract(file: CabFileInfo, options?: CabExtractOptions): Uint8Array;
}

function compressionOf(typeCompress: number): CabCompression {
  switch (typeCompress & 0x000f) {
    case 0:
      return 'none';
    case 1:
      return 'mszip';
    case 2:
      return 'quantum';
    case 3:
      return 'lzx';
    default:
      return 'unknown';
  }
}

/** `CSUMCompute` aus der Cabinet-Spezifikation (XOR über little-endian ULONGs, Rest rechtsbündig). */
function checksum(data: Uint8Array, start: number, end: number, seed: number): number {
  let sum = seed >>> 0;
  let i = start;
  for (; i + 4 <= end; i += 4) {
    sum =
      (sum ^ (data[i]! | (data[i + 1]! << 8) | (data[i + 2]! << 16) | (data[i + 3]! << 24))) >>> 0;
  }
  const rest = end - i;
  let tail = 0;
  if (rest === 3) tail = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
  else if (rest === 2) tail = (data[i]! << 8) | data[i + 1]!;
  else if (rest === 1) tail = data[i]!;
  return (sum ^ tail) >>> 0;
}

function decodeName(bytes: Uint8Array, utf: boolean): string {
  if (utf) return new TextDecoder('utf-8').decode(bytes);
  // Ohne UTF-Attribut ist die Kodierung lokal; Latin-1 bewahrt zumindest ASCII-Namen exakt.
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

/** Hängt `block` an das Verlaufsfenster an und behält die letzten 32 KiB. */
function nextWindow(history: Uint8Array, block: Uint8Array): Uint8Array {
  if (block.length >= WINDOW_SIZE) return block.subarray(block.length - WINDOW_SIZE);
  const joined = new Uint8Array(history.length + block.length);
  joined.set(history, 0);
  joined.set(block, history.length);
  return joined.length > WINDOW_SIZE ? joined.subarray(joined.length - WINDOW_SIZE) : joined;
}

/**
 * Liest Kopf, Ordner und Dateiliste eines Cabinets (kein Entpacken). Wirft `CabFormatError`, wenn
 * es kein Cabinet ist oder Kopf/Dateiliste nicht lesbar sind. Ein gekapptes Cabinet (kürzer als im
 * Kopf angegeben) liefert, was vollständig vorhanden ist (`truncated: true`).
 */
export function openCab(bytes: Uint8Array, options: CabOpenOptions = {}): CabArchive {
  const maxFiles = options.maxFiles ?? 5000;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = bytes.length;

  const need = (offset: number, count: number): void => {
    if (offset < 0 || count < 0 || offset + count > length)
      throw new CabFormatError('truncated', 'Cabinet-Datei ist kürzer als ihre Struktur angibt');
  };

  if (length < 4 || view.getUint32(0, true) !== 0x4643534d) {
    throw new CabFormatError('signature', 'Keine Cabinet-Datei (Signatur MSCF fehlt)');
  }
  if (length < HEADER_SIZE) throw new CabFormatError('header', 'Cabinet-Kopf ist unvollständig');

  const declaredSize = view.getUint32(8, true);
  const coffFiles = view.getUint32(16, true);
  const versionMinor = bytes[24]!;
  const versionMajor = bytes[25]!;
  const folderCount = view.getUint16(26, true);
  const fileCount = view.getUint16(28, true);
  const flags = view.getUint16(30, true);
  const setId = view.getUint16(32, true);
  const cabinetIndex = view.getUint16(34, true);
  if (versionMajor !== 1) throw new CabFormatError('header', 'Unbekannte Cabinet-Version');

  let cursor = HEADER_SIZE;
  let reserveFolder = 0;
  let reserveData = 0;
  if (flags & FLAG_RESERVE) {
    need(cursor, 4);
    const reserveHeader = view.getUint16(cursor, true);
    reserveFolder = bytes[cursor + 2]!;
    reserveData = bytes[cursor + 3]!;
    cursor += 4;
    need(cursor, reserveHeader);
    cursor += reserveHeader;
  }
  const skipString = (): void => {
    for (let n = 0; n <= 256; n++) {
      need(cursor, 1);
      if (bytes[cursor++] === 0) return;
    }
    throw new CabFormatError('header', 'Zeichenkette im Cabinet-Kopf ist zu lang');
  };
  if (flags & FLAG_PREV) {
    skipString();
    skipString();
  }
  if (flags & FLAG_NEXT) {
    skipString();
    skipString();
  }

  // Ordner folgen unmittelbar auf den Kopf
  const folders: CabFolderInfo[] = [];
  for (let i = 0; i < folderCount; i++) {
    need(cursor, FOLDER_SIZE + reserveFolder);
    const dataOffset = view.getUint32(cursor, true);
    const blockCount = view.getUint16(cursor + 4, true);
    const typeCompress = view.getUint16(cursor + 6, true);
    cursor += FOLDER_SIZE + reserveFolder;
    folders.push({
      dataOffset,
      blockCount,
      typeCompress,
      compression: compressionOf(typeCompress),
    });
  }

  let truncated = declaredSize > length;

  // Dateiliste
  const files: CabFileInfo[] = [];
  if (fileCount > 0) {
    if (coffFiles < cursor || coffFiles >= length)
      throw new CabFormatError('file', 'Offset der Dateiliste liegt außerhalb der Datei');
    let pos = coffFiles;
    const wanted = Math.min(fileCount, maxFiles);
    for (let i = 0; i < wanted; i++) {
      if (pos + FILE_FIXED_SIZE + 1 > length) {
        if (truncated) break;
        throw new CabFormatError('file', 'Dateiliste endet vorzeitig');
      }
      const size = view.getUint32(pos, true);
      const offset = view.getUint32(pos + 4, true);
      const iFolder = view.getUint16(pos + 8, true);
      const attribs = view.getUint16(pos + 14, true);
      let nameEnd = pos + FILE_FIXED_SIZE;
      while (
        nameEnd < length &&
        bytes[nameEnd] !== 0 &&
        nameEnd - pos - FILE_FIXED_SIZE < MAX_NAME_BYTES
      )
        nameEnd++;
      if (nameEnd >= length || bytes[nameEnd] !== 0) {
        if (truncated) break;
        throw new CabFormatError('file', 'Dateiname ist nicht abgeschlossen oder zu lang');
      }
      const name = decodeName(
        bytes.subarray(pos + FILE_FIXED_SIZE, nameEnd),
        (attribs & ATTR_NAME_IS_UTF) !== 0,
      );
      pos = nameEnd + 1;

      const continuedFromPrev =
        iFolder === IFOLD_CONTINUED_FROM_PREV || iFolder === IFOLD_CONTINUED_PREV_AND_NEXT;
      const continuedToNext =
        iFolder === IFOLD_CONTINUED_TO_NEXT || iFolder === IFOLD_CONTINUED_PREV_AND_NEXT;
      let folderIndex = iFolder;
      if (continuedFromPrev) folderIndex = 0;
      else if (continuedToNext) folderIndex = Math.max(0, folderCount - 1);
      if (folderIndex >= folderCount)
        throw new CabFormatError('folder', 'Datei verweist auf einen nicht vorhandenen Ordner');

      files.push({ name, size, folderIndex, offset, continuedFromPrev, continuedToNext });
    }
    if (files.length < wanted) truncated = true;
  }

  const extract = (file: CabFileInfo, extractOptions: CabExtractOptions = {}): Uint8Array => {
    const maxBytes = extractOptions.maxBytes ?? DEFAULT_MAX_CAB_FILE_BYTES;
    const maxScan = extractOptions.maxScanBytes ?? DEFAULT_MAX_CAB_SCAN_BYTES;
    if (file.size > maxBytes)
      throw new CabLimitError('fileSize', 'Entpackte Datei überschreitet das Größenlimit');
    if (file.continuedFromPrev || file.continuedToNext)
      throw new CabUnsupportedError('multiVolume', 'Datei erstreckt sich über mehrere Cabinets');
    const folder = folders[file.folderIndex];
    if (!folder) throw new CabFormatError('folder', 'Ordner der Datei nicht vorhanden');
    if (folder.compression !== 'none' && folder.compression !== 'mszip') {
      throw new CabUnsupportedError(
        folder.compression === 'lzx' || folder.compression === 'quantum'
          ? folder.compression
          : 'unknown',
        'Kompressionsverfahren wird nicht unterstützt',
      );
    }
    const end = file.offset + file.size;
    if (end > maxScan)
      throw new CabLimitError('scan', 'Zu entpackende Datenmenge überschreitet das Limit');
    const out = new Uint8Array(file.size);
    if (file.size === 0) return out;

    const mszip = folder.compression === 'mszip';
    let pos = folder.dataOffset;
    let folderPos = 0;
    let history: Uint8Array = new Uint8Array(0);
    for (let i = 0; i < folder.blockCount && folderPos < end; i++) {
      if (pos < 0 || pos + DATA_FIXED_SIZE > length)
        throw new CabFormatError('truncated', 'Datenblock liegt außerhalb der Datei');
      const blockPos = pos;
      const csum = view.getUint32(pos, true);
      const cbData = view.getUint16(pos + 4, true);
      const cbUncomp = view.getUint16(pos + 6, true);
      const dataStart = pos + DATA_FIXED_SIZE + reserveData;
      if (dataStart + cbData > length)
        throw new CabFormatError('truncated', 'Datenblock ist abgeschnitten');
      if (cbUncomp === 0)
        throw new CabUnsupportedError(
          'multiVolume',
          'Datenblock setzt sich im nächsten Cabinet fort',
        );
      const blockStart = folderPos;
      const blockEnd = folderPos + cbUncomp;
      pos = dataStart + cbData;
      folderPos = blockEnd;

      // Unkomprimierte Blöcke vor der Datei brauchen weder Prüfsumme noch Verlauf.
      if (!mszip && blockEnd <= file.offset) continue;

      const payload = bytes.subarray(dataStart, dataStart + cbData);
      // Die Prüfsumme deckt cbData/cbUncomp und die Nutzdaten ab; mit Reserve-Bereich pro Block
      // (selten, Auslegung nicht belegt) wird sie nicht geprüft.
      if (csum !== 0 && reserveData === 0) {
        const partial = checksum(payload, 0, payload.length, 0);
        if (checksum(bytes, blockPos + 4, blockPos + DATA_FIXED_SIZE, partial) !== csum)
          throw new CabFormatError('checksum', 'Prüfsumme eines Datenblocks stimmt nicht');
      }

      let block: Uint8Array;
      if (mszip) {
        if (cbData < 2 || payload[0] !== 0x43 || payload[1] !== 0x4b)
          throw new CabFormatError('mszip', 'MSZIP-Signatur CK fehlt');
        try {
          block = inflateSync(payload.subarray(2), {
            ...(history.length > 0 ? { dictionary: history } : {}),
          });
        } catch {
          throw new CabFormatError('inflate', 'MSZIP-Block lässt sich nicht entpacken');
        }
        if (block.length !== cbUncomp)
          throw new CabFormatError('size', 'Entpackte Blockgröße weicht vom Kopf ab');
        history = nextWindow(history, block);
      } else {
        if (cbData !== cbUncomp)
          throw new CabFormatError('size', 'Größe eines unkomprimierten Blocks inkonsistent');
        block = payload;
      }

      if (blockEnd > file.offset) {
        const from = Math.max(file.offset, blockStart);
        const to = Math.min(end, blockEnd);
        out.set(block.subarray(from - blockStart, to - blockStart), from - file.offset);
      }
    }
    if (folderPos < end)
      throw new CabFormatError('truncated', 'Ordner enthält weniger Daten als die Datei angibt');
    return out;
  };

  return {
    declaredSize,
    actualSize: length,
    truncated,
    version: `${versionMajor}.${versionMinor}`,
    setId,
    cabinetIndex,
    hasPrev: (flags & FLAG_PREV) !== 0,
    hasNext: (flags & FLAG_NEXT) !== 0,
    folders,
    files,
    extract,
  };
}

/** Dateiname ohne Verzeichnisanteil (Pfadtrenner `\` und `/`). */
export function cabBaseName(name: string): string {
  const slash = Math.max(name.lastIndexOf('\\'), name.lastIndexOf('/'));
  return slash >= 0 ? name.slice(slash + 1) : name;
}
