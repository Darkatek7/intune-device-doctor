/**
 * Parser für `certutil -store <Speicher>` (OEM-Codepage, lokalisiert: Deutsch + Englisch).
 * Format-Referenz: https://learn.microsoft.com/windows-server/administration/windows-commands/certutil
 *
 * Pro Zertifikat steht im Block unter der Überschrift „================ Certificate 0 ================“
 * (bzw. „Zertifikat 0“): Seriennummer, Aussteller, NotBefore/NotAfter und Antragsteller. Nicht
 * erkannte Zeilen werden ignoriert. Antragsteller und Seriennummer werden direkt maskiert, damit
 * nur maskierte Werte in den Report gelangen.
 */
import { maskId, maskUpn } from '../../domain/format';
import type { CertificateInfo } from '../types';

export const MAX_CERTIFICATES = 500;

const BLOCK_RE = /^=+\s*(?:Certificate|Zertifikat)\s+\d+\s*=+\s*$/i;
const SERIAL_RE = /^(?:Serial Number|Seriennummer)\s*:\s*(.*)$/i;
const ISSUER_RE = /^(?:Issuer|Aussteller)\s*:\s*(.*)$/i;
const SUBJECT_RE = /^(?:Subject|Antragsteller)\s*:\s*(.*)$/i;
const NOT_BEFORE_RE = /^(?:NotBefore|Gültig ab)\s*:\s*(.*)$/i;
const NOT_AFTER_RE = /^(?:NotAfter|Gültig bis|Ablaufdatum)\s*:\s*(.*)$/i;

const GUID_RE = /[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/gi;
const EMAIL_RE = /[^\s,=;"]+@[^\s,;"]+/g;
/** Speicher mit Zertifizierungsstellen: Namen sind dort Teil der Information und unkritisch. */
const CA_STORE_RE = /^(?:Root|CA|AuthRoot|TrustedPublisher|TrustedPeople|Disallowed|ROOT)\b/;

/** GUIDs und E-Mail-Adressen in einem Distinguished Name maskieren. */
function maskNameParts(dn: string): string {
  return dn.replace(EMAIL_RE, (m) => maskUpn(m) ?? '…').replace(GUID_RE, (m) => maskId(m) ?? '…');
}

/** Antragsteller: bei Nicht-CA-Speichern zusätzlich alle CN-Werte maskieren (z. B. Gerätename). */
function maskSubject(subject: string, issuer: string | null, store: string | null): string {
  const base = maskNameParts(subject);
  const isCa = (store !== null && CA_STORE_RE.test(store)) || subject === issuer;
  if (isCa) return base;
  return base.replace(/(\bCN=)([^,]+)/gi, (_m, prefix: string, value: string) =>
    value.includes('…') ? `${prefix}${value}` : `${prefix}${maskId(value.trim()) ?? '…'}`,
  );
}

/**
 * Datum aus certutil → ISO-Zeitstempel (ohne Zeitzone, wie UTC behandelt).
 * Unterstützt `d.M.yyyy [H:mm[:ss]]` (de), `M/d/yyyy h:mm[:ss] AM|PM` (en-US) und ISO.
 */
export function parseCertDate(raw: string): string | null {
  const text = raw.trim();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const build = (y: number, mo: number, d: number, h: number, mi: number, s: number) => {
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
    return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}Z`;
  };

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(text);
  if (iso) {
    return build(+iso[1]!, +iso[2]!, +iso[3]!, +(iso[4] ?? 0), +(iso[5] ?? 0), +(iso[6] ?? 0));
  }

  const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(text);
  if (dotted) {
    return build(
      +dotted[3]!,
      +dotted[2]!,
      +dotted[1]!,
      +(dotted[4] ?? 0),
      +(dotted[5] ?? 0),
      +(dotted[6] ?? 0),
    );
  }

  const slashed =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?/.exec(
      text,
    );
  if (slashed) {
    let hour = +(slashed[4] ?? 0);
    const meridiem = slashed[7]?.toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    // en-US: Monat/Tag; ist der erste Wert > 12, muss es Tag/Monat sein.
    const first = +slashed[1]!;
    const second = +slashed[2]!;
    const [month, day] = first > 12 ? [second, first] : [first, second];
    return build(+slashed[3]!, month, day, hour, +(slashed[5] ?? 0), +(slashed[6] ?? 0));
  }
  return null;
}

interface RawBlock {
  serial: string | null;
  issuer: string | null;
  subject: string | null;
  notBefore: string | null;
  notAfter: string | null;
}

function emptyBlock(): RawBlock {
  return { serial: null, issuer: null, subject: null, notBefore: null, notAfter: null };
}

/** `certutil -store`-Ausgabe → Zertifikate (maximal MAX_CERTIFICATES). */
export function parseCertutilStore(text: string): CertificateInfo[] {
  const lines = text.split(/\r?\n/);
  let store: string | null = null;
  let current: RawBlock | null = null;
  const blocks: RawBlock[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (BLOCK_RE.test(trimmed)) {
      if (blocks.length >= MAX_CERTIFICATES) break;
      current = emptyBlock();
      blocks.push(current);
      continue;
    }
    if (current === null) {
      // Kopfzeile vor dem ersten Zertifikat, z. B.: My "Personal"
      if (store === null && trimmed && !/^certutil\b/i.test(trimmed)) store = trimmed;
      continue;
    }
    if (/^certutil\b/i.test(trimmed)) {
      current = null;
      continue;
    }
    // Erste Fundstelle je Schlüssel zählt (ausführliche Ausgaben wiederholen Felder in Erweiterungen).
    const take = (re: RegExp, key: keyof RawBlock): void => {
      if (current![key] !== null) return;
      const m = re.exec(trimmed);
      if (m?.[1] !== undefined && m[1].trim()) current![key] = m[1].trim();
    };
    take(SERIAL_RE, 'serial');
    take(ISSUER_RE, 'issuer');
    take(SUBJECT_RE, 'subject');
    take(NOT_BEFORE_RE, 'notBefore');
    take(NOT_AFTER_RE, 'notAfter');
  }

  return blocks.map((b) => {
    const issuer = b.issuer ? maskNameParts(b.issuer) : null;
    return {
      store,
      issuer,
      subjectMasked: b.subject ? maskSubject(b.subject, b.issuer, store) : null,
      serialMasked: b.serial ? maskId(b.serial.replace(/\s+/g, '')) : null,
      notBefore: b.notBefore ? parseCertDate(b.notBefore) : null,
      notAfter: b.notAfter ? parseCertDate(b.notAfter) : null,
      notAfterRaw: b.notAfter,
    };
  });
}
