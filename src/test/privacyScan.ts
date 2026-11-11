/**
 * Leck-Scanner für den Präsentationsmodus (M19, Testhilfe – nicht Teil der App).
 *
 * Die sensiblen Werte werden aus den Demo-Daten gesammelt, indem alle Szenarien über die Provider-
 * Schnittstelle abgelaufen werden (keine handgepflegte Wertliste). Gesucht wird nach
 *  – Werten unter sensiblen Feldnamen (src/privacy/keys.ts),
 *  – allem, was wie GUID oder E-Mail-Adresse aussieht, in beliebigen Feldern,
 *  – dem lokalen Teil jeder UPN.
 * `unclassifiedKeys` ist der Gegenpart: Er meldet verdächtig benannte Felder, die weder als sensibel noch als
 * bewusst sichtbar eingeordnet sind – neue Datenfelder können so nicht unbemerkt durchrutschen.
 */
import {
  auditResourceKind,
  isGenericDeviceName,
  SENSITIVE_KEYS,
  VISIBLE_KEYS,
} from '../privacy/keys';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';
import { MockProvider } from '../providers/mock/MockProvider';
import { scenarios } from '../providers/mock/scenarios';

const GUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL_RE = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
/** Feldnamen, die nach Personen-/Geräte-/Netzwerkbezug klingen (zur Prüfung der Einordnung) */
const SUSPICIOUS_KEY_RE =
  /(name|upn|mail|serial|imei|meid|mac|phone|ip(v4|v6|address)?$|user|device|tenant|object|host|owner|account|login|address)/i;
/** Zahlen, Kennzeichen und Feldnamen, die zwar so heißen, aber keine Kennung sind */
const HARMLESS_KEY_RE =
  /(count|state|status|type|kind|time|date|enabled|limit|version|ismanaged|iscompliant)/i;

type Walk = (value: unknown, key: string | null, path: string) => void;

function walkAll(root: unknown, visit: Walk): void {
  const seen = new WeakSet<object>();
  const go: Walk = (value, key, path) => {
    visit(value, key, path);
    if (value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item) => go(item, key, path));
      return;
    }
    for (const [childKey, child] of Object.entries(value))
      go(child, childKey, `${path}.${childKey}`);
  };
  go(root, null, '$');
}

/** Alle sensiblen Werte in den übergebenen Daten (kleingeschrieben, mind. 4 Zeichen, dedupliziert). */
export function collectSensitiveValues(roots: readonly unknown[]): string[] {
  const values = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value !== 'string') return;
    const v = value.trim().toLowerCase();
    // „iPhone“/„iPad“ als gemeldeter Gerätename (iOS 16+) ist keine Kennung
    if (v.length >= 4 && !isGenericDeviceName(v)) values.add(v);
  };
  for (const root of roots) {
    walkAll(root, (value, key) => {
      if (typeof value === 'string') {
        for (const match of value.match(GUID_RE) ?? []) add(match);
        for (const match of value.match(EMAIL_RE) ?? []) {
          add(match);
          add(match.split('@')[0]);
        }
        if (key && SENSITIVE_KEYS[key.toLowerCase()]) add(value);
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        // Geräte-ähnliche Objekte: auch die (nicht-GUID-)ID
        if ('deviceName' in record || 'deviceDisplayName' in record) add(record['id']);
        if ('objectId' in record) add(record['displayName']);
        // Änderungsprotokoll (M20): Benutzer als Auslöser, Geräte/Benutzer als betroffenes Objekt
        if ('actorType' in record && record['kind'] === 'user') {
          add(record['name']);
          if (typeof record['name'] === 'string') add(record['name'].split('@')[0]);
        }
        if ('resourceId' in record && auditResourceKind(record['type'])) add(record['displayName']);
      }
    });
  }
  return [...values];
}

/** Verdächtig benannte Felder, die weder sensibel noch bewusst sichtbar eingeordnet sind. */
export function unclassifiedKeys(roots: readonly unknown[]): string[] {
  const found = new Set<string>();
  for (const root of roots) {
    walkAll(root, (value, key) => {
      if (!key || typeof value !== 'string' || !value) return;
      const lower = key.toLowerCase();
      if (SENSITIVE_KEYS[lower] || VISIBLE_KEYS.includes(lower)) return;
      if (HARMLESS_KEY_RE.test(key) && !/name$/i.test(key)) return;
      if (SUSPICIOUS_KEY_RE.test(key)) found.add(key);
    });
  }
  return [...found].sort();
}

// ---------- Demo-Daten einsammeln ----------

/** Läuft alle Demo-Szenarien und den Demo-Mandanten über die Provider-Schnittstelle ab. */
export async function loadAllMockData(
  provider: DeviceDataProvider = new MockProvider({ latency: false }),
) {
  const out: unknown[] = [];
  for (const scenario of scenarios) {
    const hits = await provider.searchDevices(scenario.deviceName);
    out.push(hits);
    const first = hits[0];
    if (!first) continue;
    const device = await provider.getDevice(first.id);
    out.push(device);
    out.push(
      await Promise.all([
        provider.getProtectionState(device),
        provider.getCompliancePolicyStates(device),
        provider.getConfigurationPolicyStates(device),
        provider.getEntraDevice(device),
        provider.getDuplicateDevices(device),
        provider.getBitLockerKeys(device),
        provider.getAppInstallStates(device),
        provider.getApplePushCertificate(device),
        provider.getSignIns(device),
        provider.getLocalAdmin(device),
        provider.getAutopilot(device),
        provider.getDeviceGroups(device),
        provider.getUserDevices(device),
        provider.getHealthAttestation(device),
        provider.getUserLicense(device),
        provider.getEnrollmentLimits(device),
        provider.getSecurityAlerts(device),
        provider.getEnrollmentFailures(device),
        provider.getAppProtection(device),
      ]),
    );
  }
  out.push(await provider.getTenantStatus());
  out.push(await provider.getServiceHealth());
  out.push(await provider.getAuditEvents());
  const policies = await provider.getTenantPolicies();
  out.push(policies);
  for (const list of [policies.configurations, policies.compliancePolicies]) {
    if (list.status !== 'ok') continue;
    for (const policy of list.data.policies) {
      out.push(await provider.getPolicyDeviceStatuses({ kind: policy.kind, id: policy.id }));
    }
  }
  return out;
}

// ---------- Fundstellen ----------

const ATTRIBUTES = [
  'title',
  'aria-label',
  'value',
  'href',
  'alt',
  'placeholder',
  'aria-description',
  'aria-valuetext',
];

export interface Leak {
  value: string;
  where: string;
}

/** Textinhalt und Attribute (sowie `.value` von Eingabefeldern) von `root` nach `values` durchsuchen. */
export function scanDom(root: ParentNode, values: readonly string[], label = 'DOM'): Leak[] {
  const leaks: Leak[] = [];
  const check = (haystack: string | null | undefined, where: string) => {
    if (!haystack) return;
    const lower = haystack.toLowerCase();
    for (const value of values)
      if (lower.includes(value)) leaks.push({ value, where: `${label}: ${where}` });
  };
  const container = root instanceof Document ? root.documentElement : (root as Element);
  check(container.textContent, 'Text');
  check(root instanceof Document ? root.title : null, 'document.title');
  for (const element of [container, ...Array.from(container.querySelectorAll('*'))]) {
    for (const attribute of ATTRIBUTES) {
      check(element.getAttribute(attribute), `<${element.tagName.toLowerCase()} ${attribute}>`);
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      check(element.value, `<${element.tagName.toLowerCase()}>.value`);
    }
  }
  return leaks;
}

export function scanText(text: string, values: readonly string[], label: string): Leak[] {
  const lower = text.toLowerCase();
  return values.filter((value) => lower.includes(value)).map((value) => ({ value, where: label }));
}

/** Lesbare Fehlermeldung für `expect(...).toEqual([])`: nur Fundstellen, nie der ganze Inhalt. */
export function describeLeaks(leaks: readonly Leak[]): string[] {
  return leaks.slice(0, 20).map((leak) => `${leak.where} enthält „${leak.value}“`);
}
