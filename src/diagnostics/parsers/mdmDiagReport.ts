/**
 * Auswertung von `MDMDiagReport.xml` aus dem MDM-Diagnosepaket (`mdmlogs-*.cab`).
 *
 * Belegt (Microsoft Learn, „Collect MDM logs“ und „Diagnose provisioning packages“) ist nur:
 *  - die Datei enthält „a more detailed view into the MDM configurations, such as enrollment
 *    variables, provisioning packages, multivariant conditions, and others“, und
 *  - `([XML](Get-Content MDMDiagReport.xml)).SelectNodes('//Multivariant') | Select -ExpandProperty Condition`
 *    liest die Bedingungen multivariater Provisioning-Pakete.
 * Einen Elementaufbau (Registrierungen, Richtlinienbereiche, Zertifikate …) beschreibt Learn nicht.
 * Deshalb wertet dieser Parser **nur** die `Multivariant`-Bedingungen aus und gibt sonst lediglich
 * den Aufbau als Rohdaten wieder (Abschnittsnamen und Anzahl) – keine Werte, keine Deutung.
 */
import type { MdmDiagReportSummary } from '../types';
import { findXmlDescendants, parseXmlLite, xmlLocalName, type XmlElement } from './xmlLite';

export const MAX_MDMDIAG_SECTIONS = 40;
export const MAX_MDMDIAG_CHILD_NAMES = 8;
export const MAX_MDMDIAG_CONDITIONS = 50;
const MAX_NAME_LENGTH = 60;

export interface SummarizeOptions {
  /** Maskierung für alle übernommenen Texte (UPN, GUID, Seriennummer …); Standard: unverändert */
  mask?: (key: string, value: string) => string;
}

/** `Condition` eines `Multivariant`-Knotens: Attribut, Text oder Attribute eines Kindelements. */
function conditionsOf(node: XmlElement): string[] {
  const values: string[] = [];
  const attribute = node.attrs['Condition'];
  if (attribute !== undefined && attribute !== '') values.push(attribute);
  for (const child of node.children) {
    if (xmlLocalName(child.name) !== 'Condition') continue;
    const pairs = Object.entries(child.attrs).map(([key, value]) => `${key}=${value}`);
    const text = [...pairs, child.text].filter((part) => part !== '').join(' ');
    if (text !== '') values.push(text);
  }
  return values;
}

/** Wertet MDMDiagReport.xml aus. Ergibt `null`, wenn kein XML-Wurzelelement lesbar ist. */
export function summarizeMdmDiagReport(
  xml: string,
  options: SummarizeOptions = {},
): MdmDiagReportSummary | null {
  const mask = options.mask ?? ((_key: string, value: string) => value);
  const { root, elementCount, truncated } = parseXmlLite(xml);
  if (!root) return null;

  const name = (raw: string): string => mask('Name', raw).slice(0, MAX_NAME_LENGTH);

  const grouped = new Map<string, { count: number; childNames: Set<string> }>();
  for (const child of root.children) {
    const key = name(xmlLocalName(child.name));
    const group = grouped.get(key) ?? { count: 0, childNames: new Set<string>() };
    group.count++;
    for (const grandChild of child.children) {
      if (group.childNames.size >= MAX_MDMDIAG_CHILD_NAMES) break;
      group.childNames.add(name(xmlLocalName(grandChild.name)));
    }
    grouped.set(key, group);
  }
  const allSections = [...grouped].map(([sectionName, group]) => ({
    name: sectionName,
    count: group.count,
    childNames: [...group.childNames],
  }));

  const conditions = findXmlDescendants(root, 'Multivariant').flatMap(conditionsOf);

  return {
    rootElement: name(xmlLocalName(root.name)),
    elementCount,
    truncated,
    sections: allSections.slice(0, MAX_MDMDIAG_SECTIONS),
    sectionsTruncated: allSections.length > MAX_MDMDIAG_SECTIONS,
    multivariant: conditions.slice(0, MAX_MDMDIAG_CONDITIONS).map((c) => mask('Condition', c)),
    multivariantTotal: conditions.length,
  };
}
