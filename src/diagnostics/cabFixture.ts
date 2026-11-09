/**
 * Minimaler Cabinet-Encoder für Tests, Fixture-ZIP und Messskript (kein Produktivcode).
 * Schreibt den Aufbau nach „Microsoft Cabinet File Format“ (CFHEADER, CFFOLDER, CFFILE, CFDATA);
 * Kompression: keine oder MSZIP (je Block ein vollständiger Deflate-Strom mit Signatur `CK`, das
 * 32-KiB-Verlaufsfenster wird über Blockgrenzen eines Ordners hinweg als Wörterbuch genutzt).
 * Browser- und Node-tauglich. Ausschließlich fiktive Daten verwenden.
 */
import { deflateSync } from 'fflate';

export interface CabFileInput {
  name: string;
  data: Uint8Array;
  /** Index des Ordners (Standard 0); Dateien eines Ordners werden in Reihenfolge abgelegt */
  folder?: number;
  /** Name als UTF-8 mit Attribut `_A_NAME_IS_UTF` ablegen */
  utf?: boolean;
}

export interface BuildCabOptions {
  compression?: 'none' | 'mszip';
  /**
   * Rohwert für `typeCompress` (z. B. 0x1503 für LZX). Die Datenblöcke bleiben dabei unkomprimiert –
   * nur für Tests, die „nicht unterstützt“ prüfen.
   */
  rawTypeCompress?: number;
  /** Unkomprimierte Bytes je Block (Standard 32768; kleiner = mehr Blöcke bei wenig Testdaten) */
  blockSize?: number;
  /** CFDATA-Prüfsummen schreiben (Standard true) */
  checksums?: boolean;
  /** Reserve-Bereiche (Kopf/Ordner/Datenblock) mit dieser Größe in Byte */
  reserve?: { header: number; folder: number; data: number };
}

const WINDOW = 32768;

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

function nameBytes(name: string, utf: boolean): Uint8Array {
  if (utf) return new TextEncoder().encode(name);
  return Uint8Array.from(name, (ch) => ch.charCodeAt(0) & 0xff);
}

const DOS_DATE = ((2026 - 1980) << 9) | (10 << 5) | 14;
const DOS_TIME = (12 << 11) | (0 << 5) | 0;

interface FolderBuild {
  files: CabFileInput[];
  blocks: Uint8Array[];
  typeCompress: number;
}

/** Baut ein Cabinet. Gleiche Eingaben ergeben gleiche Bytes. */
export function buildCab(files: CabFileInput[], options: BuildCabOptions = {}): Uint8Array {
  const compression = options.compression ?? 'none';
  const blockSize = options.blockSize ?? WINDOW;
  const withChecksums = options.checksums ?? true;
  const reserve = options.reserve;
  const reserveData = reserve?.data ?? 0;
  const baseType = options.rawTypeCompress ?? (compression === 'mszip' ? 1 : 0);

  const folderCount = Math.max(1, ...files.map((f) => (f.folder ?? 0) + 1));
  const folders: FolderBuild[] = Array.from({ length: folderCount }, () => ({
    files: [],
    blocks: [],
    typeCompress: baseType,
  }));
  for (const file of files) folders[file.folder ?? 0]!.files.push(file);

  // CFDATA-Blöcke je Ordner
  for (const folder of folders) {
    const total = folder.files.reduce((n, f) => n + f.data.length, 0);
    const data = new Uint8Array(total);
    let at = 0;
    for (const f of folder.files) {
      data.set(f.data, at);
      at += f.data.length;
    }
    let history: Uint8Array = new Uint8Array(0);
    for (let start = 0; start < total; start += blockSize) {
      const chunk = data.subarray(start, Math.min(total, start + blockSize));
      let payload: Uint8Array;
      if (compression === 'mszip' && options.rawTypeCompress === undefined) {
        const deflated = deflateSync(chunk, history.length > 0 ? { dictionary: history } : {});
        payload = new Uint8Array(deflated.length + 2);
        payload[0] = 0x43;
        payload[1] = 0x4b;
        payload.set(deflated, 2);
        const joined = new Uint8Array(history.length + chunk.length);
        joined.set(history, 0);
        joined.set(chunk, history.length);
        history = joined.length > WINDOW ? joined.subarray(joined.length - WINDOW) : joined;
      } else {
        payload = chunk;
      }
      const block = new Uint8Array(8 + reserveData + payload.length);
      const view = new DataView(block.buffer);
      view.setUint16(4, payload.length, true);
      view.setUint16(6, chunk.length, true);
      block.set(payload, 8 + reserveData);
      if (withChecksums && reserveData === 0) {
        const partial = checksum(payload, 0, payload.length, 0);
        view.setUint32(0, checksum(block, 4, 8, partial), true);
      }
      folder.blocks.push(block);
    }
  }

  // Layout
  const cbHeaderReserve = reserve?.header ?? 0;
  const cbFolderReserve = reserve?.folder ?? 0;
  const headerSize = 36 + (reserve ? 4 + cbHeaderReserve : 0);
  const foldersSize = folderCount * (8 + cbFolderReserve);
  const fileEntries: Uint8Array[] = [];
  for (let fi = 0; fi < folders.length; fi++) {
    let offset = 0;
    for (const f of folders[fi]!.files) {
      const name = nameBytes(f.name, f.utf ?? false);
      const entry = new Uint8Array(16 + name.length + 1);
      const v = new DataView(entry.buffer);
      v.setUint32(0, f.data.length, true);
      v.setUint32(4, offset, true);
      v.setUint16(8, fi, true);
      v.setUint16(10, DOS_DATE, true);
      v.setUint16(12, DOS_TIME, true);
      v.setUint16(14, 0x20 | (f.utf ? 0x80 : 0), true);
      entry.set(name, 16);
      fileEntries.push(entry);
      offset += f.data.length;
    }
  }
  const coffFiles = headerSize + foldersSize;
  const filesSize = fileEntries.reduce((n, e) => n + e.length, 0);
  let dataPos = coffFiles + filesSize;
  const folderOffsets: number[] = [];
  for (const folder of folders) {
    folderOffsets.push(dataPos);
    dataPos += folder.blocks.reduce((n, b) => n + b.length, 0);
  }

  const out = new Uint8Array(dataPos);
  const view = new DataView(out.buffer);
  out.set([0x4d, 0x53, 0x43, 0x46], 0);
  view.setUint32(8, out.length, true);
  view.setUint32(16, coffFiles, true);
  out[24] = 3; // versionMinor
  out[25] = 1; // versionMajor
  view.setUint16(26, folderCount, true);
  view.setUint16(28, files.length, true);
  view.setUint16(30, reserve ? 0x0004 : 0, true);
  view.setUint16(32, 0x0622, true);
  view.setUint16(34, 0, true);
  if (reserve) {
    view.setUint16(36, cbHeaderReserve, true);
    out[38] = cbFolderReserve;
    out[39] = reserveData;
  }
  let at = headerSize;
  folders.forEach((folder, i) => {
    view.setUint32(at, folderOffsets[i]!, true);
    view.setUint16(at + 4, folder.blocks.length, true);
    view.setUint16(at + 6, folder.typeCompress, true);
    at += 8 + cbFolderReserve;
  });
  for (const entry of fileEntries) {
    out.set(entry, at);
    at += entry.length;
  }
  for (const folder of folders) {
    for (const block of folder.blocks) {
      out.set(block, at);
      at += block.length;
    }
  }
  return out;
}
