/**
 * Sammelt die sensiblen Werte einer Ansicht (Gerät samt Abschnitten, Benutzer, weitere Geräte,
 * Anmeldungen, ZIP-Bericht …) aus den Rohdaten. Schlüsselgetrieben (keys.ts) und strukturblind: Jede neue
 * Datenstruktur mit bekannten Feldnamen ist automatisch abgedeckt.
 */
import { SENSITIVE_KEYS } from './keys';
import type { KnownValue, SensitiveKind } from './masker';

const MAX_DEPTH = 14;
const MAX_NODES = 60_000;

/** `{ key, value }`-Felder (dsregcmd): Schlüsselnamen, deren Wert sensibel ist. */
const KEYED_FIELDS: ReadonlyArray<readonly [RegExp, SensitiveKind]> = [
  [/^(device ?name|host ?name|computer ?name)$/i, 'device'],
  [/^(user ?(identity|principal ?name|email)|upn|work ?account)$/i, 'upn'],
  [/^(device ?id|tenant ?id|object ?id|user ?id)$/i, 'id'],
];

function isPlain(node: object): node is Record<string, unknown> {
  const proto = Object.getPrototypeOf(node) as unknown;
  return proto === Object.prototype || proto === null;
}

/** Alle sensiblen Werte in `root` (dedupliziert). `extra` ergänzt Werte, die nicht aus Feldnamen stammen. */
export function collectKnown(root: unknown, extra: readonly KnownValue[] = []): KnownValue[] {
  const seen = new Set<string>();
  const out: KnownValue[] = [];
  const add = (kind: SensitiveKind, value: unknown) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = `${kind}\u0000${trimmed.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, value: trimmed });
    if (kind === 'upn') {
      const at = trimmed.indexOf('@');
      if (at > 0) add('upnLocal', trimmed.slice(0, at));
    }
  };

  for (const entry of extra) add(entry.kind, entry.value);

  let nodes = 0;
  const visited = new WeakSet<object>();
  const walk = (node: unknown, depth: number) => {
    if (node === null || typeof node !== 'object' || depth > MAX_DEPTH) return;
    if (++nodes > MAX_NODES || visited.has(node)) return;
    visited.add(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (!isPlain(node)) return;
    const record = node;

    // Gerät-ähnliche Objekte: ihre `id` ist die Geräte-ID (auch wenn sie keine GUID ist).
    if (typeof record['id'] === 'string' && ('deviceName' in record || 'deviceDisplayName' in record)) {
      add('id', record['id']);
    }
    // Entra-Geräteobjekt: `displayName` ist der Gerätename (bei Richtlinien/Gruppen/Apps dagegen sichtbar).
    if ('objectId' in record && typeof record['displayName'] === 'string') {
      add('device', record['displayName']);
    }
    // dsregcmd und ähnliche Schlüssel/Wert-Listen
    if (typeof record['key'] === 'string' && typeof record['value'] === 'string') {
      const label = record['key'].trim();
      for (const [pattern, kind] of KEYED_FIELDS) {
        if (pattern.test(label)) add(kind, record['value']);
      }
    }

    for (const [key, child] of Object.entries(record)) {
      const kind = SENSITIVE_KEYS[key.toLowerCase()];
      if (kind) {
        if (typeof child === 'string') add(kind, child);
        else if (Array.isArray(child)) for (const item of child) add(kind, item);
      }
      walk(child, depth + 1);
    }
  };
  walk(root, 0);
  return out;
}
