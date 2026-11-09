/**
 * Encoding-Erkennung (docs/diaglogs-format.md): UTF-16LE (BOM FF FE), UTF-8 (BOM EF BB BF) oder
 * UTF-8 ohne BOM. Command-Ausgaben von ipconfig, certutil und pnputil sind dagegen OEM-Codepage
 * (CP850 auf deutschen/westeuropäischen Systemen, ohne BOM) – nur dort wird CP850 verwendet.
 */
export type DetectedEncoding = 'utf-16le' | 'utf-8' | 'cp850';

export interface DecodedText {
  text: string;
  encoding: DetectedEncoding;
}

export interface DecodeOptions {
  /**
   * Eintrag ist eine bekannte OEM-Ausgabe (ipconfig, certutil, pnputil): ohne BOM und wenn die Bytes
   * kein gültiges UTF-8 sind, wird als CP850 dekodiert.
   */
  oem?: boolean;
}

/** CP850 (DOS Latin-1), Bytes 0x80–0xFF. 0x00–0x7F entsprechen ASCII. */
const CP850_HIGH =
  'ÇüéâäàåçêëèïîìÄÅ' +
  'ÉæÆôöòûùÿÖÜø£Ø×ƒ' +
  'áíóúñÑªº¿®¬½¼¡«»' +
  '░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐' +
  '└┴┬├─┼ãÃ╚╔╩╦╠═╬¤' +
  'ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀' +
  'ÓßÔÒõÕµþÞÚÛÙýÝ¯´' +
  '­±‗¾¶§÷¸°¨·¹³²■ ';

/** CP850-Bytes → Text. `TextDecoder` kennt CP850 nicht, daher eigene Tabelle. */
export function decodeCp850(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 8192;
  for (let start = 0; start < bytes.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, bytes.length);
    let chunk = '';
    for (let i = start; i < end; i++) {
      const b = bytes[i] ?? 0;
      chunk += b < 0x80 ? String.fromCharCode(b) : (CP850_HIGH[b - 0x80] ?? '�');
    }
    chunks.push(chunk);
  }
  return chunks.join('');
}

/** Command-Ausgaben, die Windows in der OEM-Codepage schreibt (docs/diaglogs-format.md). */
const OEM_COMMAND_RE = /(?:^|[_\s])(?:ipconfig|certutil|pnputil)(?:_exe)?(?=$|[_\s.])/i;

export function isOemCommandName(entryName: string): boolean {
  return OEM_COMMAND_RE.test(entryName);
}

export function decodeText(bytes: Uint8Array, options: DecodeOptions = {}): DecodedText {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    const body = bytes.subarray(2);
    return { text: new TextDecoder('utf-16le').decode(body), encoding: 'utf-16le' };
  }
  const hasUtf8Bom =
    bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const body = hasUtf8Bom ? bytes.subarray(3) : bytes;
  if (options.oem && !hasUtf8Bom) {
    try {
      // Reines ASCII und echtes UTF-8 bleiben unverändert; CP850-Umlaute sind kein gültiges UTF-8.
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(body), encoding: 'utf-8' };
    } catch {
      return { text: decodeCp850(body), encoding: 'cp850' };
    }
  }
  return { text: new TextDecoder('utf-8').decode(body), encoding: 'utf-8' };
}
