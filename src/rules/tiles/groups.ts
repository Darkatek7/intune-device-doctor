/**
 * Gruppen des Geräts (Entra, transitiveMemberOf, Scope Device.Read.All): rein informativ, keine Bewertung.
 * Nur Name und ID von Gruppen; Objekte ohne Leserecht (nur Typ + ID) zählen als „ausgeblendet“.
 * Gruppen des Benutzers sind bewusst nicht enthalten (bräuchten einen weiteren Scope).
 */
import type { DeviceSnapshot, Finding, Tile, TileFact } from '../../domain/types';
import { de } from '../../i18n/de';
import { availabilityOf, loadingTile, sectionsLoaded, unavailableTile } from '../helpers';
import { Docs } from '../knowledge/docs';

const t = de.rules.groups;

export function evaluateGroups(snapshot: DeviceSnapshot, _now: Date): Tile {
  void _now;
  const sections: Tile['sections'] = ['deviceGroups'];
  if (!sectionsLoaded(snapshot, sections)) return loadingTile('groups', sections);
  const section = snapshot.deviceGroups!;
  if (section.status !== 'ok') return unavailableTile('groups', sections, section);

  const { groups, hiddenCount, truncated } = section.data;
  const findings: Finding[] = [];
  if (hiddenCount > 0) {
    findings.push({
      id: 'groups-hidden',
      severity: 'unknown',
      title: t.hiddenTitle,
      detail: t.hiddenDetail(hiddenCount),
      cause: t.hiddenCause,
      remediation: [...t.hiddenRemediation],
      evidence: { hiddenCount },
      source: section.source,
      docsUrl: Docs.deviceTransitiveMemberOf,
    });
  }

  const facts: TileFact[] = [{ label: t.facts.count, value: String(groups.length + hiddenCount) }];
  if (hiddenCount > 0) facts.push({ label: t.facts.hidden, value: String(hiddenCount) });
  if (truncated) facts.push({ label: t.facts.more, value: t.facts.moreValue });
  for (const group of groups.slice(0, t.maxListed)) {
    facts.push({ label: group.displayName, value: group.id });
  }
  if (groups.length > t.maxListed) {
    facts.push({ label: t.moreListed(groups.length - t.maxListed), value: '' });
  }
  facts.push({ label: t.facts.scope, value: t.facts.scopeValue });

  const total = groups.length + hiddenCount;
  return {
    id: 'groups',
    title: de.tiles.groups,
    state: 'ready',
    severity: 'ok',
    value: total === 0 ? t.valueNone : t.value(total),
    summary: t.summary,
    findings,
    sources: [section.source],
    facts,
    availability: availabilityOf(section),
    sections,
  };
}
