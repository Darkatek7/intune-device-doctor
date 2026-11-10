/**
 * Präsentationsmodus (M19): Pseudonymisierung. Reine Funktionen ohne Zustand – `createMasker(salt)` liefert
 * Pseudonyme, die für denselben Wert und denselben Salt immer gleich sind (Hash aus Salt + Art + Wert) und
 * sich ohne den Salt nicht zurückrechnen lassen. Der Salt lebt nur im Arbeitsspeicher einer Sitzung.
 *
 * Zwei Ebenen für Freitext (`text`/`deep`):
 *  (a) bekannte sensible Werte der aktuellen Ansicht (`scope(known)`) werden durch ihr Pseudonym ersetzt,
 *  (b) als Sicherheitsnetz erkennt `text` Muster: E-Mail-Adressen, GUIDs, MAC-, IPv4- und IPv6-Adressen.
 *
 * Jede Pseudonym-Funktion ist idempotent (ein Pseudonym bleibt ein Pseudonym), damit mehrfaches Maskieren
 * – Anzeige-Modell, dann Ausgabe – nichts doppelt verändert.
 */
import { maskId } from '../domain/format';

export type SensitiveKind =
  | 'device'
  | 'user'
  | 'upn'
  /** Lokaler Teil einer UPN („anna.schmidt“), taucht auch ohne Domäne in Texten auf */
  | 'upnLocal'
  | 'serial'
  | 'id'
  | 'imei'
  | 'mac'
  | 'phone'
  | 'ip'
  | 'file';

export interface KnownValue {
  kind: SensitiveKind;
  value: string;
}

/** Erkennbar fiktive Domäne der Pseudonym-UPNs (reservierte Beispiel-Domäne, nie echt). */
export const PSEUDONYM_DOMAIN = 'beispiel.example';

/** Schlüssel, deren Werte `deep` nie verändert (Links werden an der Anzeigestelle maskiert). */
const SKIP_KEYS: ReadonlySet<string> = new Set(['url', 'docsUrl', 'href', 'alertWebUrl']);

const PREFIX: Record<Exclude<SensitiveKind, 'upn' | 'upnLocal' | 'id'>, string> = {
  device: 'Gerät-',
  user: 'Benutzer-',
  serial: 'SN-',
  imei: 'IMEI-',
  mac: 'MAC-',
  phone: 'Tel-',
  ip: 'IP-',
  file: 'Datei-',
};

/** Länge des Hash-Anteils je Art (Großbuchstaben-Hex). */
const HASH_LENGTH: Record<SensitiveKind, number> = {
  device: 4,
  user: 4,
  upn: 4,
  upnLocal: 4,
  serial: 6,
  id: 4,
  imei: 6,
  mac: 4,
  phone: 4,
  ip: 4,
  file: 4,
};

const MIN_KNOWN_LENGTH: Record<SensitiveKind, number> = {
  device: 3,
  user: 3,
  upn: 5,
  upnLocal: 3,
  serial: 4,
  id: 4,
  imei: 6,
  mac: 6,
  phone: 5,
  ip: 7,
  file: 4,
};

/** FNV-1a (32 Bit) mit Murmur-Finalizer – schnell, gut gestreut; kein Sicherheitsanspruch an den Hash selbst. */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const GUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const IPV4_OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';

/**
 * Sicherheitsnetz-Muster. Reihenfolge: E-Mail vor GUID/IP (E-Mails können beides enthalten).
 * IPv4 wird nicht maskiert, wenn davor „Version“, „v“, „Build“ … steht – vierteilige Versionsnummern
 * (z. B. „Agent-Version 1.101.103.0“) sind für die Diagnose nötig.
 */
const EMAIL_RE = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const GUID_RE = new RegExp(`(?<![0-9a-f-])${GUID}(?![0-9a-f-])`, 'gi');
const MAC_RE = /(?<![0-9a-f:-])(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}(?![0-9a-f:-])/gi;
const IPV4_RE = new RegExp(
  `(?<![\\w.-])(?<!\\b(?:version|ver|v|build|agent)[\\s:.-]*)${IPV4_OCTET}(?:\\.${IPV4_OCTET}){3}(?![\\w-]|\\.\\d)`,
  'gi',
);
const IPV6_RE = /(?<![0-9a-f:])(?:[0-9a-f]{1,4}:){4,7}[0-9a-f]{1,4}(?![0-9a-f:])/gi;

export interface Scope {
  /** Ersetzt die bekannten Werte; null = keine bekannten Werte */
  readonly replace: ((input: string) => string) | null;
  readonly size: number;
}

export interface Masker {
  device(name: string): string;
  user(displayName: string): string;
  /** UPN oder E-Mail-Adresse → Pseudonym im UPN-Format mit fiktiver Domäne */
  upn(upn: string): string;
  serial(serial: string): string;
  /** GUID/ID → gekürzt wie `maskId` (kurze Werte: `ID-XXXX`) */
  id(id: string): string;
  imei(value: string): string;
  mac(value: string): string;
  phone(value: string): string;
  ip(value: string): string;
  /** Dateiname → `Datei-XXXX` + Endung */
  fileName(name: string): string;
  /** Pseudonym einer beliebigen Art */
  pseudonym(kind: SensitiveKind, value: string): string;
  /** Bekannte Werte vorbereiten (einmal je Ansicht, nicht je Zeichenkette) */
  scope(known: readonly KnownValue[]): Scope;
  /** Freitext: bekannte Werte (Scope) und Sicherheitsnetz */
  text(input: string, scope?: Scope | null): string;
  /** Tiefe Transformation: alle Zeichenketten durch `text` (Links unter `url`/`docsUrl` bleiben) */
  deep<T>(value: T, scope?: Scope | null): T;
}

export function createMasker(salt: string): Masker {
  const code = (kind: SensitiveKind, value: string): string =>
    hash32(`${salt}|${kind}|${value.trim().toLowerCase()}`)
      .toString(16)
      .toUpperCase()
      .padStart(8, '0')
      .slice(0, HASH_LENGTH[kind]);

  const prefixed =
    (kind: keyof typeof PREFIX) =>
    (value: string): string => {
      const prefix = PREFIX[kind];
      // Idempotent: „Gerät-7F3A“ bleibt „Gerät-7F3A“.
      if (value.startsWith(prefix) && /^[0-9A-F]{4,6}(\.\w+)?$/.test(value.slice(prefix.length))) {
        return value;
      }
      return `${prefix}${code(kind, value)}`;
    };

  const upn = (value: string): string => {
    const trimmed = value.trim();
    const at = trimmed.indexOf('@');
    if (at >= 0 && trimmed.toLowerCase().endsWith(`@${PSEUDONYM_DOMAIN}`)) return trimmed;
    // „user@domain@<Tenant-ID>“ (Windows-Enrollment): Pseudonym für den Benutzer, keine Domäne.
    const local = at >= 0 ? trimmed.slice(0, at) : trimmed;
    return `benutzer-${code('upnLocal', local)}@${PSEUDONYM_DOMAIN}`;
  };

  const id = (value: string): string => {
    if (/^.{4}….{4}$/.test(value) || /^ID-[0-9A-F]{4}$/.test(value)) return value;
    return value.length > 8 ? (maskId(value) ?? '…') : `ID-${code('id', value)}`;
  };

  const fileName = (name: string): string => {
    const dot = name.lastIndexOf('.');
    const extension = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : '';
    if (/^Datei-[0-9A-F]{4}(\.\w+)?$/.test(name)) return name;
    return `${PREFIX.file}${code('file', name)}${extension}`;
  };

  const pseudonym = (kind: SensitiveKind, value: string): string => {
    switch (kind) {
      case 'upn':
        return upn(value);
      case 'upnLocal':
        return `benutzer-${code('upnLocal', value)}`;
      case 'id':
        return id(value);
      case 'file':
        return fileName(value);
      default:
        return prefixed(kind)(value);
    }
  };

  /** Pseudonym-UPN-Teile, die `text` nicht erneut maskieren darf. */
  const isPseudonymEmail = (email: string) => email.toLowerCase().endsWith(`@${PSEUDONYM_DOMAIN}`);

  const scope = (known: readonly KnownValue[]): Scope => {
    // Längste zuerst, damit „CONTOSO-PC042“ vor „PC042“ greift; je Wert nur einmal.
    const byValue = new Map<string, SensitiveKind>();
    for (const entry of known) {
      const value = entry.value.trim();
      if (value.length < MIN_KNOWN_LENGTH[entry.kind]) continue;
      if (!byValue.has(value.toLowerCase())) byValue.set(value.toLowerCase(), entry.kind);
    }
    if (byValue.size === 0) return { replace: null, size: 0 };
    const values = [...byValue.keys()].sort((a, b) => b.length - a.length);
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])(?:${values.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`,
      'giu',
    );
    return {
      size: byValue.size,
      replace: (input) =>
        input.replace(pattern, (match) =>
          pseudonym(byValue.get(match.toLowerCase()) ?? 'id', match),
        ),
    };
  };

  const text = (input: string, active?: Scope | null): string => {
    if (!input) return input;
    let out = active?.replace ? active.replace(input) : input;
    out = out.replace(EMAIL_RE, (match) => (isPseudonymEmail(match) ? match : upn(match)));
    out = out.replace(GUID_RE, (match) => id(match));
    out = out.replace(MAC_RE, (match) => prefixed('mac')(match));
    out = out.replace(IPV6_RE, (match) => prefixed('ip')(match));
    out = out.replace(IPV4_RE, (match) => prefixed('ip')(match));
    return out;
  };

  const deep = <T>(value: T, active?: Scope | null): T => {
    const walk = (node: unknown, key?: string): unknown => {
      if (typeof node === 'string') return key && SKIP_KEYS.has(key) ? node : text(node, active);
      if (Array.isArray(node)) return node.map((item) => walk(item, key));
      if (node !== null && typeof node === 'object') {
        const proto = Object.getPrototypeOf(node) as unknown;
        if (proto !== Object.prototype && proto !== null) return node;
        const result: Record<string, unknown> = {};
        for (const [childKey, child] of Object.entries(node))
          result[childKey] = walk(child, childKey);
        return result;
      }
      return node;
    };
    return walk(value) as T;
  };

  return {
    device: prefixed('device'),
    user: prefixed('user'),
    upn,
    serial: prefixed('serial'),
    id,
    imei: prefixed('imei'),
    mac: prefixed('mac'),
    phone: prefixed('phone'),
    ip: prefixed('ip'),
    fileName,
    pseudonym,
    scope,
    text,
    deep,
  };
}

/** Zufälliger Sitzungs-Salt (nur Arbeitsspeicher). */
export function randomSalt(): string {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}
