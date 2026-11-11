/**
 * Sammelt die sensiblen Werte einer Ansicht (Gerät samt Abschnitten, Benutzer, weitere Geräte,
 * Anmeldungen, ZIP-Bericht …) aus den Rohdaten. Schlüsselgetrieben (keys.ts) und strukturblind: Jede neue
 * Datenstruktur mit bekannten Feldnamen ist automatisch abgedeckt.
 */
import { auditResourceKind, isGenericDeviceName, SENSITIVE_KEYS } from './keys';
import type { KnownValue, SensitiveKind } from './masker';

const MAX_DEPTH = 14;
/**
 * Schutz vor entarteten Eingaben, keine fachliche Grenze: Ein großes DiagLogs-ZIP bringt mehrere
 * zehntausend Ereignisdatensätze mit. Die Daten werden in der Breite durchlaufen (flache Felder zuerst),
 * damit Gerät, Benutzer und Registrierung auch dann erfasst sind, wenn die Grenze je erreicht würde.
 */
const MAX_NODES = 1_000_000;

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
    if (kind === 'device' && isGenericDeviceName(trimmed)) return;
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
  // Breitensuche: Warteschlange mit Lesezeiger (kein shift – das wäre bei großen Listen quadratisch).
  const queue: Array<{ node: object; depth: number }> = [];
  const enqueue = (node: unknown, depth: number) => {
    if (node === null || typeof node !== 'object' || depth > MAX_DEPTH) return;
    if (visited.has(node) || nodes >= MAX_NODES) return;
    nodes++;
    visited.add(node);
    queue.push({ node, depth });
  };
  const visit = (node: object, depth: number) => {
    if (Array.isArray(node)) {
      for (const item of node) enqueue(item, depth + 1);
      return;
    }
    if (!isPlain(node)) return;
    const record = node;

    // Gerät-ähnliche Objekte: ihre `id` ist die Geräte-ID (auch wenn sie keine GUID ist).
    if (
      typeof record['id'] === 'string' &&
      ('deviceName' in record || 'deviceDisplayName' in record)
    ) {
      add('id', record['id']);
    }
    // Entra-Geräteobjekt: `displayName` ist der Gerätename (bei Richtlinien/Gruppen/Apps dagegen sichtbar).
    if ('objectId' in record && typeof record['displayName'] === 'string') {
      add('device', record['displayName']);
    }
    // Änderungsprotokoll (M20): wer geändert hat – bei Benutzern steht dort die UPN
    if ('actorType' in record && record['kind'] === 'user' && typeof record['name'] === 'string') {
      add(record['name'].includes('@') ? 'upn' : 'user', record['name']);
    }
    // Änderungsprotokoll (M20): betroffenes Objekt – nur bei Geräten und Benutzern ist der Name eine Kennung
    if ('resourceId' in record && typeof record['displayName'] === 'string') {
      const kind = auditResourceKind(record['type']);
      if (kind) add(kind, record['displayName']);
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
      enqueue(child, depth + 1);
    }
  };
  enqueue(root, 0);
  for (let next = 0; next < queue.length; next++) {
    const entry = queue[next]!;
    visit(entry.node, entry.depth);
  }
  return out;
}
