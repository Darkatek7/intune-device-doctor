/**
 * Parser für `ipconfig /all` (OEM-Codepage, lokalisiert: Deutsch + Englisch).
 * Format-Referenz: https://learn.microsoft.com/windows-server/administration/windows-commands/ipconfig
 *
 * Es werden nur Rohdaten übernommen (Adapter, IPv4, DNS-Server, DNS-Suffixe); eine Bewertung gibt es
 * nicht. Die MAC-Adresse wird maskiert (Hersteller-Präfix bleibt sichtbar). Host-Name und IPv6
 * werden bewusst nicht übernommen.
 */
import type { NetworkAdapterInfo, NetworkInfo } from '../types';

export const MAX_ADAPTERS = 50;

type Field =
  | 'description'
  | 'physical'
  | 'dhcp'
  | 'ipv4'
  | 'dns'
  | 'connectionSuffix'
  | 'media'
  | 'primarySuffix'
  | 'suffixSearchList';

/** Schlüsseltexte (Deutsch + Englisch); Vergleich nach Normalisierung ohne Punkte/Leerraum. */
const FIELD_LABELS: Array<[Field, RegExp]> = [
  ['description', /^(?:description|beschreibung)$/i],
  ['physical', /^(?:physical address|physische adresse)$/i],
  ['dhcp', /^(?:dhcp enabled|dhcp aktiviert)$/i],
  [
    'ipv4',
    /^(?:ipv4 address|ipv4-adresse|autoconfiguration ipv4 address|autokonfigurations-ipv4-adresse)$/i,
  ],
  ['dns', /^(?:dns servers|dns-server)$/i],
  ['connectionSuffix', /^(?:connection-specific dns suffix|verbindungsspezifisches dns-suffix)$/i],
  ['media', /^(?:media state|medienstatus)$/i],
  ['primarySuffix', /^(?:primary dns suffix|primäres dns-suffix)$/i],
  ['suffixSearchList', /^(?:dns suffix search list|suchliste für dns-suffixe)$/i],
];

const KEY_LINE_RE = /^\s{1,8}([^:\s][^:]*?)[ .]*:(?:\s(.*)|(.*))$/;
const CONTINUATION_RE = /^\s{20,}(\S.*)$/;
const ADAPTER_HEADER_RE = /^(\S.*):\s*$/;

/** `00-00-5E-00-53-01` → `00-00-5E-••-••-••` (nur das Herstellerpräfix bleibt). */
export function maskMac(mac: string): string {
  const parts = mac.trim().split(/[-:]/);
  if (parts.length !== 6) return '••';
  return `${parts.slice(0, 3).join('-')}-••-••-••`;
}

function cleanValue(value: string): string {
  // "192.0.2.10(Preferred)" / "(Bevorzugt)" – Zusatz entfernen
  return value
    .replace(/\((?:Preferred|Bevorzugt|Duplicate|Doppelt|Tentative|Vorläufig)\)\s*$/i, '')
    .trim();
}

function isYes(value: string): boolean | null {
  if (/^(?:yes|ja)\b/i.test(value)) return true;
  if (/^(?:no|nein)\b/i.test(value)) return false;
  return null;
}

const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;

export function parseIpconfigAll(text: string): NetworkInfo {
  const info: NetworkInfo = { primaryDnsSuffix: null, dnsSuffixSearchList: [], adapters: [] };
  let adapter: NetworkAdapterInfo | null = null;
  let lastField: Field | null = null;

  const addValue = (field: Field, value: string): void => {
    const v = cleanValue(value);
    if (!v) return;
    switch (field) {
      case 'primarySuffix':
        if (adapter === null) info.primaryDnsSuffix = v;
        break;
      case 'suffixSearchList':
        if (adapter === null) info.dnsSuffixSearchList.push(v);
        break;
      default:
        if (adapter === null) return;
        if (field === 'description') adapter.description = v;
        else if (field === 'physical') adapter.macMasked = maskMac(v);
        else if (field === 'dhcp') adapter.dhcpEnabled = isYes(v);
        else if (field === 'ipv4') {
          if (IPV4_RE.test(v)) adapter.ipv4.push(v);
        } else if (field === 'dns') adapter.dnsServers.push(v);
        else if (field === 'connectionSuffix') adapter.dnsSuffix = v;
        else if (field === 'media') adapter.mediaDisconnected = /disconnected|getrennt/i.test(v);
    }
  };

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) {
      lastField = null;
      continue;
    }
    const header = ADAPTER_HEADER_RE.exec(line);
    if (header && !/^\s/.test(line)) {
      if (info.adapters.length >= MAX_ADAPTERS) break;
      adapter = {
        name: header[1]!.trim(),
        description: null,
        macMasked: null,
        dhcpEnabled: null,
        mediaDisconnected: false,
        ipv4: [],
        dnsServers: [],
        dnsSuffix: null,
      };
      info.adapters.push(adapter);
      lastField = null;
      continue;
    }
    const continuation = CONTINUATION_RE.exec(line);
    if (continuation && lastField) {
      addValue(lastField, continuation[1]!);
      continue;
    }
    const key = KEY_LINE_RE.exec(line);
    if (!key) {
      lastField = null;
      continue;
    }
    const label = key[1]!.trim();
    const field = FIELD_LABELS.find(([, re]) => re.test(label))?.[0] ?? null;
    lastField = field;
    if (field) addValue(field, (key[2] ?? key[3] ?? '').trim());
  }
  return info;
}
