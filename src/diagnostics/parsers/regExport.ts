/**
 * Parser für .reg-Exporte ("Windows Registry Editor Version 5.00").
 * Unterstützt Strings (Escapes \" und \\), dword, hex / hex(b) / hex(2) / hex(7) (als Rohhex),
 * den Default-Wert `@=` und Zeilenfortsetzung mit `\` bei hex-Werten.
 * Key-Vergleiche sind case-insensitiv (Windows-Registry).
 */

export type RegValue =
  | { name: string; kind: 'string'; value: string }
  | { name: string; kind: 'dword'; value: number }
  /** hexType: null für `hex:`, sonst z. B. "b", "2", "7"; hex: "01,00,…" ohne Zeilenumbrüche */
  | { name: string; kind: 'hex'; hexType: string | null; hex: string }
  | { name: string; kind: 'unknown'; raw: string };

export interface RegKey {
  /** Pfad wie in der Datei, z. B. "HKEY_LOCAL_MACHINE\Software\…" */
  path: string;
  values: RegValue[];
}

export interface RegParseOptions {
  /** Keys, für die false geliefert wird, werden samt Werten verworfen (spart Speicher). */
  keyFilter?: (path: string) => boolean;
}

/** Liest einen in Anführungszeichen stehenden String ab `start` (zeigt auf das öffnende "). */
function readQuoted(source: string, start: number): { value: string; end: number } | null {
  let out = '';
  let i = start + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      const next = source[i + 1];
      if (next === undefined) return null;
      out += next;
      i += 2;
    } else if (ch === '"') {
      return { value: out, end: i + 1 };
    } else {
      out += ch;
      i++;
    }
  }
  return null;
}

function parseData(name: string, data: string): RegValue {
  const trimmed = data.trim();
  if (trimmed.startsWith('"')) {
    const quoted = readQuoted(trimmed, 0);
    if (quoted) return { name, kind: 'string', value: quoted.value };
  }
  const dword = /^dword:([0-9a-f]{1,8})$/i.exec(trimmed);
  if (dword?.[1]) return { name, kind: 'dword', value: parseInt(dword[1], 16) };
  const hex = /^hex(?:\(([0-9a-f]+)\))?:(.*)$/is.exec(trimmed);
  if (hex) {
    return {
      name,
      kind: 'hex',
      hexType: hex[1]?.toLowerCase() ?? null,
      hex: (hex[2] ?? '').replace(/\s+/g, ''),
    };
  }
  return { name, kind: 'unknown', raw: trimmed };
}

function parseValueLine(line: string): RegValue | null {
  if (line.startsWith('@=')) return parseData('@', line.slice(2));
  if (!line.startsWith('"')) return null;
  const name = readQuoted(line, 0);
  if (!name || line[name.end] !== '=') return null;
  return parseData(name.value, line.slice(name.end + 1));
}

const HEX_START_RE = /^(?:"|@).*?=hex(?:\([0-9a-f]+\))?:/i;

export function parseRegExport(text: string, options: RegParseOptions = {}): RegKey[] {
  const keys: RegKey[] = [];
  let current: RegKey | null = null;
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    let line = (lines[i] ?? '').trim();
    if (line === '' || line.startsWith(';') || line.startsWith('Windows Registry Editor')) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      const path = line.slice(1, -1);
      if (path.startsWith('-')) {
        current = null;
        continue;
      }
      if (options.keyFilter && !options.keyFilter(path)) {
        current = null;
        continue;
      }
      current = { path, values: [] };
      keys.push(current);
      continue;
    }

    if (!current) continue;

    // Zeilenfortsetzung bei hex-Werten
    if (line.endsWith('\\') && HEX_START_RE.test(line)) {
      let joined = line.slice(0, -1);
      while (i + 1 < lines.length) {
        i++;
        const next = (lines[i] ?? '').trim();
        if (next.endsWith('\\')) {
          joined += next.slice(0, -1);
        } else {
          joined += next;
          break;
        }
      }
      line = joined;
    }

    const value = parseValueLine(line);
    if (value) current.values.push(value);
  }
  return keys;
}

/** Wert eines Keys, Name case-insensitiv. */
export function getRegValue(key: RegKey, name: string): RegValue | undefined {
  const wanted = name.toLowerCase();
  return key.values.find((v) => v.name.toLowerCase() === wanted);
}

export function getRegString(key: RegKey, name: string): string | null {
  const v = getRegValue(key, name);
  return v?.kind === 'string' ? v.value : null;
}

export function getRegDword(key: RegKey, name: string): number | null {
  const v = getRegValue(key, name);
  return v?.kind === 'dword' ? v.value : null;
}

/** Unterkeys: alle Keys, deren Pfad (case-insensitiv) mit `${prefix}\` beginnt. */
export function isUnderRegPath(path: string, prefix: string): boolean {
  return path.toLowerCase().startsWith(`${prefix.toLowerCase()}\\`);
}
