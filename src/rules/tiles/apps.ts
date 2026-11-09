/**
 * Apps: Absicht + Installationsstatus der zugewiesenen Apps auf dem Gerät
 * (Graph beta mobileAppIntentAndStates, pro primärem Benutzer).
 * failed/uninstallFailed → critical, erforderlich aber nicht installiert → warning,
 * ausstehend → Hinweis. Immer ein Hinweis auf die Beta-Datenquelle.
 */
import type {
  AppInstallStateInfo,
  DataSource,
  DeviceSnapshot,
  Finding,
  Severity,
  Tile,
  TileFact,
} from '../../domain/types';
import { de } from '../../i18n/de';
import { IntunePortal } from '../../links/intunePortal';
import {
  availabilityOf,
  loadingTile,
  sectionsLoaded,
  sortFindings,
  unavailableTile,
  worstActionable,
} from '../helpers';
import { Docs } from '../knowledge/docs';
import { assignmentsContribution } from './assignments';

const t = de.rules.apps;
const f = de.rules.facts;

const REQUIRED = new Set(['requiredInstall', 'requiredAndAvailableInstall']);
const AVAILABLE = new Set(['available', 'availableInstallWithoutEnrollment']);

export function evaluateApps(snapshot: DeviceSnapshot, _now: Date): Tile {
  void _now;
  const sections: Tile['sections'] = ['appInstallStates'];
  if (!sectionsLoaded(snapshot, sections)) return loadingTile('apps', sections);
  const section = snapshot.appInstallStates!;
  if (section.status !== 'ok') return unavailableTile('apps', sections, section);

  const apps = section.data;
  const findings: Finding[] = [];
  for (const app of apps) {
    const finding = appFinding(app, section.source);
    if (finding) findings.push(finding);
  }
  findings.push({
    id: 'apps-beta',
    severity: 'unknown',
    title: t.betaTitle,
    detail: t.betaDetail,
    cause: t.betaCause,
    remediation: [...t.betaRemediation],
    source: section.source,
    docsUrl: Docs.appIntentAndStatesBeta,
  });

  // M14/S2: Zuweisungen (reine Hinweise; laden nach den Gerätezuständen, blockieren die Kachel nicht)
  const assignments = assignmentsContribution(snapshot, 'apps');
  findings.push(...assignments.findings);

  const required = apps.filter((a) => a.intent !== null && REQUIRED.has(a.intent));
  const installedRequired = required.filter((a) => a.installState === 'installed').length;
  const available = apps.filter((a) => a.intent !== null && AVAILABLE.has(a.intent)).length;
  const failed = apps.filter(
    (a) => a.installState === 'failed' || a.installState === 'uninstallFailed',
  ).length;
  const missing = findings.filter((x) => x.id.startsWith('apps-missing-')).length;

  const facts: TileFact[] = [
    { label: f.appsAssigned, value: String(apps.length) },
    {
      label: f.appsInstalled,
      value: String(apps.filter((a) => a.installState === 'installed').length),
    },
    { label: f.appsFailed, value: String(failed) },
    ...assignments.facts,
  ];

  const severity: Severity = worstActionable(findings, 'ok');
  const value =
    failed > 0
      ? t.valueFailed(failed)
      : missing > 0
        ? t.valueMissing(missing)
        : apps.length === 0
          ? t.valueNone
          : t.valueOk;

  return {
    id: 'apps',
    title: de.tiles.apps,
    state: 'ready',
    severity,
    value,
    summary: t.summary(installedRequired, required.length, available),
    findings: sortFindings(findings),
    sources: assignments.source ? [section.source, assignments.source] : [section.source],
    facts,
    availability: availabilityOf(section),
    sections: [...sections, 'assignments'],
  };
}

function appFinding(app: AppInstallStateInfo, source: DataSource): Finding | null {
  const required = app.intent !== null && REQUIRED.has(app.intent);
  let kind: 'failed' | 'uninstallFailed' | 'missing' | 'pending';
  let severity: Severity;
  if (app.installState === 'failed') {
    kind = 'failed';
    severity = 'critical';
  } else if (app.installState === 'uninstallFailed') {
    kind = 'uninstallFailed';
    severity = 'critical';
  } else if (required && app.installState === 'notInstalled') {
    kind = 'missing';
    severity = 'warning';
  } else if (app.installState === 'pendingInstall') {
    kind = 'pending';
    severity = 'unknown';
  } else {
    return null;
  }

  const title =
    kind === 'failed'
      ? t.failedTitle(app.displayName)
      : kind === 'uninstallFailed'
        ? t.uninstallFailedTitle(app.displayName)
        : kind === 'missing'
          ? t.missingTitle(app.displayName)
          : t.pendingTitle(app.displayName);
  const cause =
    kind === 'failed'
      ? t.failedCause
      : kind === 'uninstallFailed'
        ? t.uninstallFailedCause
        : kind === 'missing'
          ? t.missingCause
          : t.pendingCause;

  return {
    id: `apps-${kind}-${app.appId}`,
    severity,
    title,
    detail: t.detail(
      t.state[app.installState] ?? app.installState,
      app.intent ? (t.intent[app.intent] ?? app.intent) : t.unknownIntent,
      app.version,
    ),
    cause,
    remediation: kind === 'pending' ? [...t.pendingRemediation] : [...t.remediation],
    evidence: {
      appId: app.appId,
      displayName: app.displayName,
      installState: app.installState,
      intent: app.intent,
      version: app.version,
    },
    source,
    docsUrl: Docs.appInstallTroubleshoot,
    links: [{ label: de.links.openApp, url: IntunePortal.app(app.appId) }],
  };
}
