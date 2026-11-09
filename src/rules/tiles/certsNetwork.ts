/**
 * Kachel „Zertifikate & Netzwerk“ aus den OEM-Codepage-Ausgaben von certutil und ipconfig.
 * Reine Rohdaten: Zu Aussteller-/Ablaufdaten gibt es in Microsoft Learn keine allgemeine Bewertung,
 * daher kein Schweregrad über „Hinweis“ hinaus. Antragsteller, Seriennummern und MAC-Adressen sind
 * bereits im Parser maskiert.
 */
import { formatDate, maskUserPaths } from '../../domain/format';
import type { DataSource, Finding, Tile, TileFact } from '../../domain/types';
import type { CertificateInfo, DiagEntry, DiagnosticsReport } from '../../diagnostics/types';
import { de } from '../../i18n/de';
import { Docs } from '../knowledge/docs';

const z = de.rules.zip;
const t = z.certsNetwork;

const DAY_MS = 86_400_000;
/** Anzahl der Zertifikate/Adapter, die als Evidenz einzeln aufgelistet werden. */
const MAX_LISTED = 25;
const ENTRA_REGISTRATION_ISSUER_RE = /MS-Organization-Access/i;

function source(entry: DiagEntry | undefined, fallback: string): DataSource {
  return { kind: 'zip', label: `${z.sourcePrefix} · ${maskUserPaths(entry?.path ?? fallback)}` };
}

function certLine(cert: CertificateInfo, expired: boolean): string {
  const until = cert.notAfter ? formatDate(cert.notAfter, 'UTC') : t.untilUnknown(cert.notAfterRaw);
  return t.certLine(cert.subjectMasked, cert.serialMasked, until, expired);
}

function certEvidence(
  certs: CertificateInfo[],
  isExpired: (c: CertificateInfo) => boolean,
): Record<string, string> {
  const evidence: Record<string, string> = {};
  certs.slice(0, MAX_LISTED).forEach((cert, index) => {
    evidence[`${index + 1}. ${cert.issuer ?? '–'}`] = certLine(cert, isExpired(cert));
  });
  if (certs.length > MAX_LISTED) evidence['…'] = t.moreCerts(certs.length - MAX_LISTED);
  return evidence;
}

export function certsNetworkTile(report: DiagnosticsReport, now: Date): Tile | null {
  const certEntries = report.entries.filter(
    (e) => e.kind === 'Command' && !e.failedHresult && /certutil/i.test(e.name),
  );
  const ipconfigEntry = report.entries.find(
    (e) => e.kind === 'Command' && !e.failedHresult && /ipconfig/i.test(e.name),
  );
  if (certEntries.length === 0 && !ipconfigEntry) return null;

  const reference = report.collectedAtUtc ? new Date(report.collectedAtUtc) : now;
  const referenceMs = reference.getTime();
  const isExpired = (c: CertificateInfo): boolean =>
    c.notAfter !== null && new Date(c.notAfter).getTime() < referenceMs;
  const isExpiring = (c: CertificateInfo): boolean => {
    if (c.notAfter === null) return false;
    const delta = new Date(c.notAfter).getTime() - referenceMs;
    return delta >= 0 && delta <= 30 * DAY_MS;
  };

  const findings: Finding[] = [];
  const facts: TileFact[] = [];
  const sources: DataSource[] = [];
  const certs = report.certificates;
  const expired = certs.filter(isExpired);
  const expiring = certs.filter(isExpiring);
  const referenceLabel = formatDate(reference.toISOString(), 'UTC');

  if (certEntries.length > 0) {
    const certSource = source(certEntries[0], 'certutil -store');
    sources.push(certSource);
    if (certs.length === 0) {
      findings.push({
        id: 'certs-none',
        severity: 'unknown',
        title: t.certsNoneTitle,
        detail: t.certsNoneDetail,
        cause: t.certsNoneCause,
        remediation: [...t.certsNoneRemediation],
        source: certSource,
        docsUrl: Docs.certutilStore,
      });
    } else {
      // Ablauf-Vergleich ist reine Arithmetik (NotAfter vs. Sammelzeitpunkt) – keine Bewertung.
      findings.push({
        id: 'certs-list',
        severity: 'unknown',
        title: t.certsTitle(certs.length),
        detail: t.certsDetail(certs.length, expired.length, expiring.length, referenceLabel),
        cause: t.certsCause,
        remediation: [...t.certsRemediation],
        evidence: certEvidence(certs, isExpired),
        source: certSource,
        docsUrl: Docs.certutilStore,
      });
      const entraReg = certs.filter((c) => c.issuer && ENTRA_REGISTRATION_ISSUER_RE.test(c.issuer));
      if (entraReg.length > 0) {
        findings.push({
          id: 'certs-entra-registration',
          severity: 'unknown',
          title: t.entraRegTitle,
          detail: t.entraRegDetail(entraReg.length),
          cause: t.entraRegCause,
          remediation: [...t.entraRegRemediation],
          evidence: certEvidence(entraReg, isExpired),
          source: certSource,
          docsUrl: Docs.entraDeviceRegistrationCert,
        });
      }
      facts.push(
        { label: t.factCerts, value: String(certs.length) },
        { label: t.factExpired(referenceLabel), value: String(expired.length) },
        { label: t.factExpiring, value: String(expiring.length) },
      );
    }
  }

  const network = report.network;
  if (ipconfigEntry) {
    const ipSource = source(ipconfigEntry, 'ipconfig /all');
    sources.push(ipSource);
    if (!network || network.adapters.length === 0) {
      findings.push({
        id: 'network-none',
        severity: 'unknown',
        title: t.networkNoneTitle,
        detail: t.networkNoneDetail,
        cause: t.networkNoneCause,
        remediation: [],
        source: ipSource,
        docsUrl: Docs.ipconfig,
      });
    } else {
      const evidence: Record<string, string> = {};
      network.adapters.slice(0, MAX_LISTED).forEach((a, index) => {
        evidence[`${index + 1}. ${a.name}`] = t.adapterLine(
          a.ipv4,
          a.dnsServers,
          a.dnsSuffix,
          a.macMasked,
          a.mediaDisconnected,
        );
      });
      findings.push({
        id: 'network-ipconfig',
        severity: 'unknown',
        title: t.networkTitle(network.adapters.length),
        detail: t.networkDetail,
        cause: t.networkCause,
        remediation: [...t.networkRemediation],
        evidence,
        source: ipSource,
        docsUrl: Docs.ipconfig,
      });
      facts.push({ label: t.factAdapters, value: String(network.adapters.length) });
      if (network.primaryDnsSuffix)
        facts.push({ label: t.factPrimarySuffix, value: network.primaryDnsSuffix, mono: true });
      if (network.dnsSuffixSearchList.length > 0)
        facts.push({
          label: t.factSearchList,
          value: network.dnsSuffixSearchList.join(', '),
          mono: true,
        });
    }
  }

  const adapterCount = network ? network.adapters.length : ipconfigEntry ? 0 : null;
  const value = t.value(certs.length, adapterCount) || t.valueNone;
  return {
    id: 'certsNetwork',
    title: de.tiles.certsNetwork,
    state: 'ready',
    severity: 'unknown',
    value,
    summary: t.summary,
    findings,
    sources,
    facts,
    sections: [],
  };
}
