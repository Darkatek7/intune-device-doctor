/**
 * Encoding-Erkennung per BOM (docs/diaglogs-format.md): UTF-16LE (FF FE), UTF-8 (EF BB BF) oder
 * UTF-8 ohne BOM. OEM-Codepages (CP850) werden im MVP nicht unterstützt.
 */
export type DetectedEncoding = 'utf-16le' | 'utf-8';

export interface DecodedText {
  text: string;
  encoding: DetectedEncoding;
}

export function decodeText(bytes: Uint8Array): DecodedText {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    const body = bytes.subarray(2);
    return { text: new TextDecoder('utf-16le').decode(body), encoding: 'utf-16le' };
  }
  const hasUtf8Bom =
    bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const body = hasUtf8Bom ? bytes.subarray(3) : bytes;
  return { text: new TextDecoder('utf-8').decode(body), encoding: 'utf-8' };
}
