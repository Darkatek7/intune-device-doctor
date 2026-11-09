/**
 * Doppelte Entra-Geräteobjekte (M14/S1) – Beitrag zur Kachel „Gerätestatus“.
 *
 * - Mehr als ein Objekt mit gleichem Namen und gleichem Betriebssystem → Befund mit Tabelle.
 * - Hybrid joined (ServerAd) + registriert (Workplace) → Warnung „Dual State“. Quelle: Entra-FAQ
 *   (Dual State kann zu nichtdeterministischer Auswertung führen; ab Windows 10 1803 automatische Bereinigung).
 * - Andere Duplikate → Hinweis mit den Ursachen laut Entra-FAQ.
 * - Gleicher Name, aber anderes Betriebssystem → nur als „gleichnamig“ gezeigt, nie als Duplikat gewertet.
 */
import { formatDate } from '../../domain/format';
import type {
  DeviceSnapshot,
  Finding,
  SameNameEntraDevice,
  Severity,
  TileFact,
} from '../../domain/types';
import { de } from '../../i18n/de';
import { sectionIssueFinding } from '../helpers';
import { Docs } from '../knowledge/docs';

const t = de.rules.duplicates;

export interface DuplicatesContribution {
  findings: Finding[];
  facts: TileFact[];
  /** Kurzwert für die Kachel, wenn ein Befund mit Severity die Kachel bestimmt */
  value?: { severity: Severity; value: string };
}

const yesNo = (value: boolean | null) => (value === null ? t.unknown : value ? t.yes : t.no);
const trustLabel = (type: SameNameEntraDevice['trustType']) =>
  type ? de.rules.trustType[type] : t.unknown;

function tableOf(devices: SameNameEntraDevice[]): NonNullable<Finding['table']> {
  const c = t.columns;
  return {
    columns: [c.trustType, c.enabled, c.lastSignIn, c.compliant, c.registered, c.note],
    rows: devices.map((d) => ({
      highlight: d.isCurrent,
      cells: [
        trustLabel(d.trustType),
        yesNo(d.accountEnabled),
        d.approximateLastSignInDateTime ? formatDate(d.approximateLastSignInDateTime) : t.unknown,
        yesNo(d.isCompliant),
        d.registrationDateTime ? formatDate(d.registrationDateTime) : t.unknown,
        d.isCurrent ? t.noteCurrent : d.differentOs ? t.noteOtherOs : '',
      ],
    })),
  };
}

export function duplicatesContribution(snapshot: DeviceSnapshot): DuplicatesContribution {
  const section = snapshot.duplicateDevices;
  if (!section || section.status === 'notApplicable') return { findings: [], facts: [] };
  if (section.status !== 'ok') {
    return { findings: [sectionIssueFinding('deviceStatus-duplicates', section)], facts: [] };
  }

  const { devices, moreAvailable } = section.data;
  const candidates = devices.filter((d) => !d.differentOs);
  const otherOs = devices.filter((d) => d.differentOs);
  const facts: TileFact[] = [{ label: t.factCount, value: String(candidates.length) }];
  if (otherOs.length > 0) {
    facts.push({ label: t.factSameNameOtherOs, value: String(otherOs.length) });
  }
  if (moreAvailable) facts.push({ label: t.factMore, value: t.factMoreValue });

  const findings: Finding[] = [];
  let value: DuplicatesContribution['value'];
  const base = { source: section.source, docsUrl: Docs.entraDuplicateEntriesFaq };

  if (candidates.length > 1) {
    const dualState =
      candidates.some((d) => d.trustType === 'ServerAd') &&
      candidates.some((d) => d.trustType === 'Workplace');
    const types = [...new Set(candidates.map((d) => trustLabel(d.trustType)))].join(', ');
    const evidence: Finding['evidence'] = {
      objectCount: candidates.length,
      joinTypes: candidates.map((d) => d.trustType ?? t.unknown).join(', '),
    };
    if (moreAvailable) evidence.moreAvailable = true;
    findings.push({
      ...base,
      id: dualState ? 'deviceStatus-dualState' : 'deviceStatus-duplicates',
      severity: dualState ? 'warning' : 'unknown',
      title: dualState ? t.dualStateTitle : t.duplicateTitle,
      detail: `${dualState ? t.dualStateDetail(candidates.length) : t.detail(candidates.length, types)}${
        moreAvailable ? ` ${t.moreNote}` : ''
      }`,
      cause: dualState ? t.dualStateCause : t.duplicateCause,
      remediation: [...(dualState ? t.dualStateRemediation : t.duplicateRemediation)],
      evidence,
      table: tableOf(devices),
      docsUrl: dualState ? Docs.entraDualStateFaq : Docs.entraDuplicateEntriesFaq,
      ...(dualState
        ? { links: [{ label: t.linkHybridJoin, url: Docs.hybridJoinReviewThingsToKnow }] }
        : {}),
    });
    if (dualState) value = { severity: 'warning', value: t.valueDualState };
  } else if (otherOs.length > 0) {
    findings.push({
      ...base,
      id: 'deviceStatus-sameName',
      severity: 'unknown',
      title: t.sameNameOtherOsTitle,
      detail: t.sameNameOtherOsDetail(otherOs.length),
      cause: t.sameNameOtherOsCause,
      remediation: [...t.sameNameOtherOsRemediation],
      evidence: { objectCount: devices.length, differentOs: otherOs.length },
      table: tableOf(devices),
    });
  }
  return { findings, facts, value };
}
