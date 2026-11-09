/**
 * Zuweisungen – „Warum gilt diese Richtlinie / diese App?“ (M14/S2). Beitrag zur Richtlinien- und zur
 * Apps-Kachel: eine Tabelle (Name · Art · Zuweisung) und Hinweise bei Ausschlüssen, die zum gemeldeten
 * Zustand nicht passen. Abgeglichen wird nur mit den Gerätegruppen aus der Section `deviceGroups`;
 * Benutzergruppen werden nicht gelesen. Reine Hinweise (Severity `unknown`), nie Warnung/Kritisch.
 */
import type {
  AssignmentEntry,
  AssignmentObjectInfo,
  AssignmentTarget,
  DataSource,
  DeviceSnapshot,
  Finding,
  FindingTable,
  TileFact,
} from '../../domain/types';
import { de } from '../../i18n/de';
import { Docs } from '../knowledge/docs';

const t = de.rules.assignments;

export type AssignmentScope = 'policies' | 'apps';

export interface AssignmentsContribution {
  findings: Finding[];
  facts: TileFact[];
  source?: DataSource;
}

interface GroupContext {
  /** null = Gerätegruppen nicht lesbar (Mitgliedschaft nicht prüfbar) */
  names: Map<string, string> | null;
  hiddenCount: number;
}

function groupContext(snapshot: DeviceSnapshot): GroupContext {
  const groups = snapshot.deviceGroups;
  if (!groups || groups.status !== 'ok') return { names: null, hiddenCount: 0 };
  return {
    names: new Map(groups.data.groups.map((g) => [g.id.toLowerCase(), g.displayName])),
    hiddenCount: groups.data.hiddenCount,
  };
}

interface Described {
  text: string;
  /** Ausschluss über eine Gerätegruppe, in der das Gerät Mitglied ist */
  excludedBy?: string;
}

function describeTarget(target: AssignmentTarget, groups: GroupContext): Described {
  switch (target.kind) {
    case 'allDevices':
      return { text: t.allDevices };
    case 'allUsers':
      return { text: t.allUsers };
    case 'unknown':
      return { text: t.unknownTarget };
    case 'group':
    case 'exclusionGroup': {
      const exclusion = target.kind === 'exclusionGroup';
      if (!groups.names) {
        return { text: exclusion ? t.exclusionUnchecked : t.groupUnchecked };
      }
      const name = groups.names.get(target.groupId.toLowerCase());
      if (name !== undefined) {
        return exclusion
          ? { text: t.excludedViaDeviceGroup(name), excludedBy: name }
          : { text: t.viaDeviceGroup(name) };
      }
      return {
        text: exclusion
          ? t.exclusionNoMembership
          : groups.hiddenCount > 0
            ? t.groupNoMembershipHidden
            : t.groupNoMembership,
      };
    }
  }
}

function describeEntry(entry: AssignmentEntry, groups: GroupContext): Described {
  const described = describeTarget(entry.target, groups);
  const intent = entry.intent ? t.intents[entry.intent] : null;
  return { ...described, text: intent ? `${intent}: ${described.text}` : described.text };
}

function describeObject(
  object: AssignmentObjectInfo,
  groups: GroupContext,
): { text: string; excludedBy: string[] } {
  switch (object.status) {
    case 'notFound':
      return { text: t.notFound, excludedBy: [] };
    case 'notEvaluable':
      return { text: t.notEvaluable, excludedBy: [] };
    case 'error':
      return { text: t.error, excludedBy: [] };
    case 'ok': {
      if (object.assignments.length === 0) return { text: t.noAssignments, excludedBy: [] };
      const described = object.assignments.map((entry) => describeEntry(entry, groups));
      return {
        text: described.map((d) => d.text).join('; '),
        excludedBy: described.flatMap((d) => (d.excludedBy ? [d.excludedBy] : [])),
      };
    }
  }
}

/** Gemeldeter Zustand des Objekts aus den Gerätezuständen (Rohwert) und seine Anzeige. */
function stateOf(
  snapshot: DeviceSnapshot,
  object: AssignmentObjectInfo,
): { raw: string; label: string } | null {
  const id = object.id.toLowerCase();
  if (object.kind === 'app') {
    const states = snapshot.appInstallStates;
    const app =
      states?.status === 'ok' ? states.data.find((a) => a.appId.toLowerCase() === id) : undefined;
    if (!app) return null;
    // Absicht „exclude“ (Beta-Absicht) ist selbst ein Ausschluss – kein Widerspruch
    if (app.intent === 'exclude') return { raw: 'notApplicable', label: '' };
    return {
      raw: app.installState,
      label: t.stateLabels.app[app.installState] ?? app.installState,
    };
  }
  const section =
    object.kind === 'compliance' ? snapshot.compliancePolicies : snapshot.configurationPolicies;
  const policy =
    section?.status === 'ok' ? section.data.find((p) => p.id.toLowerCase() === id) : undefined;
  if (!policy) return null;
  return { raw: policy.state, label: t.stateLabels.policy[policy.state] ?? policy.state };
}

export function assignmentsContribution(
  snapshot: DeviceSnapshot,
  scope: AssignmentScope,
): AssignmentsContribution {
  const section = snapshot.assignments;
  if (!section || section.status !== 'ok') return { findings: [], facts: [] };

  const objects = section.data.objects.filter((o) =>
    scope === 'apps' ? o.kind === 'app' : o.kind !== 'app',
  );
  if (objects.length === 0) return { findings: [], facts: [] };

  const groups = groupContext(snapshot);
  const findings: Finding[] = [];
  const rows: FindingTable['rows'] = [];
  const base = { source: section.source };

  for (const object of objects) {
    const described = describeObject(object, groups);
    const state = object.status === 'ok' ? stateOf(snapshot, object) : null;
    // Ausschluss über eine Gerätegruppe des Geräts, aber der Zustand ist nicht „Nicht zutreffend“
    const contradicted =
      described.excludedBy.length > 0 && state !== null && state.raw !== 'notApplicable';
    rows.push({
      cells: [object.displayName, t.kinds[object.kind], described.text],
      highlight: contradicted,
    });
    if (contradicted && state) {
      const groupName = described.excludedBy[0]!;
      findings.push({
        ...base,
        id: `${scope}-excluded-${object.id}`,
        severity: 'unknown',
        title: t.excludedTitle(object.displayName),
        detail: t.excludedDetail(groupName, state.label),
        cause: t.excludedCause,
        remediation: [...t.excludedRemediation],
        evidence: { objectId: object.id, excludedGroup: groupName, reportedState: state.raw },
        docsUrl: scope === 'apps' ? Docs.appAssignmentScope : Docs.assignPolicyExcludeGroups,
      });
    }
  }

  const checked = objects.filter((o) => o.status === 'ok').length;
  const detail = [
    scope === 'apps' ? t.appsDetail(objects.length) : t.policiesDetail(objects.length),
    section.data.skipped > 0 ? t.skippedNote(section.data.skipped) : null,
    t.unavailableNote,
  ]
    .filter(Boolean)
    .join(' ');
  findings.push({
    ...base,
    id: `${scope}-assignments`,
    severity: 'unknown',
    title: scope === 'apps' ? t.appsTitle : t.policiesTitle,
    detail,
    cause: t.cause,
    remediation: [...t.remediation],
    table: { columns: [t.columns.name, t.columns.kind, t.columns.assignment], rows },
    docsUrl: scope === 'apps' ? Docs.mobileAppAssignmentsList : Docs.configurationAssignmentsList,
  });

  return {
    findings,
    facts: [{ label: t.factChecked, value: t.factCheckedValue(checked, objects.length) }],
    source: section.source,
  };
}
