/**
 * Parser für die Ausgabe von `dsregcmd /status` (docs/diaglogs-format.md).
 * Abschnitte: Rahmen `+---+`, Kopf `| Name |`, darunter `Key : Value`.
 * Verschachtelte Blöcke (AcquirePrtDiagnostics / RefreshPrtDiagnostics) stehen auf gleicher
 * Einrückung und enden an der nächsten Leerzeile bzw. am nächsten Abschnitt.
 *
 * Datenschutz: Werte mit UPN, Tenant-/Geräte-IDs, Zertifikats-Fingerabdrücken usw. werden
 * beim Parsen maskiert und nie im Klartext übernommen.
 */
import { maskId, maskUpn } from '../../domain/format';
import type { DsregField, DsregSection, DsregStatus } from '../types';

const FRAME_RE = /^\+-+\+$/;
const HEADER_RE = /^\|\s*(.*?)\s*\|$/;
const KV_RE = /^\s*(.+?)\s+:(?:\s+(.*))?$/;

const BLOCK_KEYS = new Set(['acquireprtdiagnostics', 'refreshprtdiagnostics']);

const GUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL_RE = /[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']+/g;
const THUMBPRINT_RE = /^[0-9a-f]{32,64}$/i;

/** Keys, deren Wert immer maskiert wird (klein geschrieben). */
const MASKED_KEYS = new Set([
  'user identity',
  'executing account name',
  'tenantid',
  'tenantname',
  'deviceid',
  'thumbprint',
  'keycontainerid',
  'correlation id',
  'endpoint uri',
]);

function maskText(value: string): string {
  return value.length <= 2 ? '…' : `${value.slice(0, 2)}…`;
}

/** Entfernt UPNs und GUIDs aus beliebigem Text (Fallback für alle Werte). */
export function maskSensitiveText(value: string): string {
  return value
    .replace(EMAIL_RE, (m) => maskUpn(m) ?? '…')
    .replace(GUID_RE, (m) => maskId(m) ?? '…');
}

function maskValue(key: string, value: string): string {
  const generic = maskSensitiveText(value);
  if (!MASKED_KEYS.has(key.toLowerCase()) || value === '') return generic;
  const lower = key.toLowerCase();
  if (lower === 'thumbprint' || THUMBPRINT_RE.test(value)) return maskId(value) ?? '…';
  if (lower === 'tenantname') return maskText(value);
  if (lower === 'user identity' || lower === 'executing account name') {
    // Bereits maskierte UPNs bleiben stehen; "NT AUTHORITY\SYSTEM" ist unkritisch.
    if (value.includes('@') || /^NT AUTHORITY\\/i.test(value)) return generic;
    return maskText(value);
  }
  return generic;
}

interface MutableBlock {
  name: string;
  fields: DsregField[];
}

export function parseDsregcmd(text: string): DsregStatus {
  const sections: DsregSection[] = [];
  let section: DsregSection | null = null;
  let block: MutableBlock | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    if (FRAME_RE.test(line.trim())) {
      block = null;
      continue;
    }

    const header = HEADER_RE.exec(line.trim());
    if (header && line.trim().startsWith('|')) {
      section = { name: header[1] ?? '', fields: [], blocks: [] };
      sections.push(section);
      block = null;
      continue;
    }

    if (line.trim() === '') {
      block = null;
      continue;
    }
    if (!section) continue;

    const kv = KV_RE.exec(line);
    if (!kv) continue;
    const key = kv[1]?.trim() ?? '';
    if (!key) continue;
    const value = maskValue(key, (kv[2] ?? '').trim());

    if (BLOCK_KEYS.has(key.toLowerCase())) {
      block = { name: key, fields: [] };
      section.blocks.push(block);
      section.fields.push({ key, value });
      continue;
    }

    (block ?? section).fields.push({ key, value });
  }

  return withConvenience(sections);
}

function findField(sections: DsregSection[], key: string): string | undefined {
  const wanted = key.toLowerCase();
  for (const section of sections) {
    const hit = section.fields.find((f) => f.key.toLowerCase() === wanted);
    if (hit) return hit.value;
  }
  return undefined;
}

function withConvenience(sections: DsregSection[]): DsregStatus {
  const status: DsregStatus = { sections };
  const assign = <K extends keyof Omit<DsregStatus, 'sections'>>(
    prop: K,
    value: string | undefined,
  ): void => {
    if (value !== undefined) status[prop] = value;
  };

  assign('azureAdJoined', findField(sections, 'AzureAdJoined'));
  assign('domainJoined', findField(sections, 'DomainJoined'));
  assign('deviceAuthStatus', findField(sections, 'DeviceAuthStatus'));
  assign('tpmProtected', findField(sections, 'TpmProtected'));
  assign('azureAdPrt', findField(sections, 'AzureAdPrt'));
  assign('wamDefaultSet', findField(sections, 'WamDefaultSet'));

  const acquire = sections
    .flatMap((s) => s.blocks)
    .find((b) => b.name.toLowerCase() === 'acquireprtdiagnostics');
  const inBlock = (key: string): string | undefined =>
    acquire?.fields.find((f) => f.key.toLowerCase() === key)?.value;
  assign('prtAttemptStatus', inBlock('attempt status'));
  assign('prtHttpError', inBlock('http error'));
  return status;
}
