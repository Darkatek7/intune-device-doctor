/**
 * Registrierung (Benutzer) – Lizenz und Gerätelimit des primären Benutzers (M14/S3) sowie seine
 * fehlgeschlagenen Registrierungen (M18, seitenbegrenzt). Nur mit primärem
 * Benutzer (siehe evaluateTiles). Zwei unabhängige Teile: Lizenz (LicenseAssignment.Read.All) und
 * Gerätelimit (DeviceManagementServiceConfig.Read.All). Das wirksame Limit ist nicht bestimmbar
 * (Benutzergruppen werden nicht gelesen) → Anzeige aller Limit-Konfigurationen und ein Hinweis, wenn die
 * Geräteanzahl das kleinste Limit erreicht.
 */
import type {
  AssignmentTarget,
  DataSource,
  DeviceSnapshot,
  Finding,
  Severity,
  Tile,
  TileFact,
  UserLicenseInfo,
} from '../../domain/types';
import { de } from '../../i18n/de';
import {
  loadingTile,
  sectionIssueFinding,
  sectionsLoaded,
  sortFindings,
  uniqueSources,
  worstActionable,
} from '../helpers';
import { Docs } from '../knowledge/docs';
import { deviceEnrollmentFailures } from '../service';

const t = de.rules.registration;

function targetText(target: AssignmentTarget): string {
  switch (target.kind) {
    case 'allUsers':
      return t.targetAllUsers;
    case 'allDevices':
      return t.targetAllDevices;
    case 'group':
      return t.targetGroup(target.groupId);
    case 'exclusionGroup':
      return t.targetExcluded(target.groupId);
    case 'unknown':
      return t.targetUnknown;
  }
}

const statusText = (status: string | null) =>
  status ? (t.planStatus[status] ?? status) : t.planStatusUnknown;

function licenseFindings(
  license: UserLicenseInfo,
  source: DataSource,
): { findings: Finding[]; facts: TileFact[]; missing: boolean } {
  const findings: Finding[] = [];
  const intunePlans = license.plans.filter((p) => p.plan !== 'INTUNE_O365');
  const mdmO365 = license.plans.filter((p) => p.plan === 'INTUNE_O365');
  // Nur „Disabled“ (Plan in der Lizenzzuweisung abgeschaltet) zählt als fehlend. Andere Werte als
  // „Success“ (z. B. PendingInput) meldet Graph laut Live-Test auch bei aktiver M365-E5-Lizenz und
  // normal verwaltetem Gerät – daraus wird keine fehlende Lizenz abgeleitet.
  const assigned = intunePlans.filter((p) => p.provisioningStatus !== 'Disabled');
  const facts: TileFact[] = [
    { label: t.facts.licenses, value: String(license.licenseCount) },
    {
      label: t.facts.plans,
      value:
        license.plans.length === 0
          ? t.facts.noPlan
          : license.plans.map((p) => `${p.plan} – ${statusText(p.provisioningStatus)}`).join('; '),
      title: t.facts.plansNote,
    },
  ];
  const missing = assigned.length === 0;
  if (missing) {
    findings.push({
      id: 'registration-noLicense',
      severity: 'warning',
      title: t.noLicenseTitle,
      detail:
        intunePlans.length === 0
          ? t.noLicenseDetailNone(license.licenseCount)
          : t.noLicenseDetailDisabled(
              intunePlans.map((p) => `${p.plan} (${statusText(p.provisioningStatus)})`).join(', '),
            ),
      cause: t.noLicenseCause,
      remediation: [...t.noLicenseRemediation],
      evidence: {
        licenseCount: license.licenseCount,
        intunePlans: intunePlans.map((p) => `${p.plan}:${p.provisioningStatus ?? '?'}`).join(', '),
      },
      source,
      docsUrl: Docs.enrollmentLicenseMissing,
      links: [{ label: de.links.assignIntuneLicense, url: Docs.intuneLicensesAssign }],
    });
  }
  // INTUNE_O365 steckt auch in Bundles mit echtem Intune-Plan (z. B. Microsoft 365 E5) – Hinweis nur ohne diesen.
  if (mdmO365.length > 0 && intunePlans.length === 0) {
    findings.push({
      id: 'registration-mdmO365',
      severity: 'unknown',
      title: t.mdmO365Title,
      detail: t.mdmO365Detail(statusText(mdmO365[0]!.provisioningStatus)),
      cause: t.mdmO365Cause,
      remediation: [...t.mdmO365Remediation],
      evidence: { plan: 'INTUNE_O365', provisioningStatus: mdmO365[0]!.provisioningStatus },
      source,
      docsUrl: Docs.servicePlanInfo,
    });
  }
  return { findings, facts, missing };
}

export function evaluateRegistration(snapshot: DeviceSnapshot, now: Date): Tile {
  const sections: Tile['sections'] = [
    'userLicense',
    'enrollmentLimits',
    'userDevices',
    'enrollmentFailures',
  ];
  if (!sectionsLoaded(snapshot, sections)) return loadingTile('registration', sections);
  const license = snapshot.userLicense!;
  const limits = snapshot.enrollmentLimits!;
  const userDevices = snapshot.userDevices!;
  const failures = snapshot.enrollmentFailures!;

  const findings: Finding[] = [];
  const facts: TileFact[] = [];
  let licenseMissing = false;

  // --- Lizenz ---
  if (license.status === 'ok') {
    const part = licenseFindings(license.data, license.source);
    findings.push(...part.findings);
    facts.push(...part.facts);
    licenseMissing = part.missing;
  } else {
    findings.push(sectionIssueFinding('registration-license', license));
  }

  // --- Gerätelimit ---
  const deviceCount = userDevices.status === 'ok' ? userDevices.data.length + 1 : null;
  if (deviceCount !== null) {
    facts.push({
      label: t.facts.devices,
      value: String(deviceCount),
      title: t.facts.devicesNote,
    });
  }
  let limitReached = false;
  if (limits.status === 'ok') {
    const { limits: configs, omitted } = limits.data;
    const known = configs.map((c) => c.limit).filter((l): l is number => l !== null);
    const smallest = known.length > 0 ? Math.min(...known) : null;
    facts.push({ label: t.facts.limitConfigs, value: String(configs.length) });
    if (smallest !== null) facts.push({ label: t.facts.smallestLimit, value: String(smallest) });
    findings.push({
      id: 'registration-limits',
      severity: 'unknown',
      title: t.limitsTitle,
      detail: [t.limitsDetail(configs.length), omitted > 0 ? t.limitsOmitted(omitted) : null]
        .filter(Boolean)
        .join(' '),
      cause: t.limitsCause,
      remediation: [...t.limitsRemediation],
      table: {
        columns: [t.columns.name, t.columns.priority, t.columns.limit, t.columns.targets],
        rows: configs.map((c) => ({
          cells: [
            c.displayName,
            c.priority === null ? t.unknownValue : String(c.priority),
            c.limit === null ? t.unknownValue : String(c.limit),
            c.targets === null
              ? t.targetsUnreadable
              : c.targets.length === 0
                ? t.targetsNone
                : c.targets.map(targetText).join('; '),
          ],
        })),
      },
      source: limits.source,
      docsUrl: Docs.deviceLimitsIntuneEntra,
    });
    if (deviceCount !== null && smallest !== null && deviceCount >= smallest) {
      limitReached = true;
      findings.push({
        id: 'registration-limitReached',
        severity: 'unknown',
        title: t.limitReachedTitle,
        detail: t.limitReachedDetail(deviceCount, smallest),
        cause: t.limitReachedCause,
        remediation: [...t.limitReachedRemediation],
        evidence: { deviceCount, smallestLimit: smallest },
        source: limits.source,
        docsUrl: Docs.enrollmentDeviceCapReached,
      });
    }
  } else {
    findings.push(sectionIssueFinding('registration-limits', limits));
  }

  // --- Fehlgeschlagene Registrierungen des Benutzers (M18) ---
  const failurePart = deviceEnrollmentFailures(failures, now);
  findings.push(...failurePart.findings);
  facts.push(...failurePart.facts);

  const anyUnavailable = license.status !== 'ok' || limits.status !== 'ok';
  const severity: Severity = worstActionable(findings, anyUnavailable ? 'unknown' : 'ok');
  const missingStatus = license.status !== 'ok' ? license.status : limits.status;
  const availability =
    license.status !== 'ok' ? license.status : limits.status !== 'ok' ? limits.status : undefined;

  const failedCount = failures.status === 'ok' ? failures.data.events.length : 0;
  const value = licenseMissing
    ? t.valueNoLicense
    : failedCount > 0
      ? de.service.failures.valueCount(failedCount)
      : limitReached
        ? t.valueLimit
        : missingStatus !== 'ok'
          ? de.availability[missingStatus]
          : t.valueLicenseOk;
  const licenseSummary =
    license.status !== 'ok'
      ? t.summaryLicenseUnknown
      : licenseMissing
        ? t.summaryLicenseMissing
        : t.summaryLicenseOk;

  return {
    id: 'registration',
    title: de.tiles.registration,
    state: 'ready',
    severity,
    value,
    summary: t.summary(licenseSummary, deviceCount !== null ? t.summaryDevices(deviceCount) : null),
    findings: sortFindings(findings),
    sources: uniqueSources([
      license.source,
      limits.source,
      userDevices.status === 'ok' ? userDevices.source : undefined,
      failures.status === 'notApplicable' ? undefined : failures.source,
    ]),
    facts,
    availability,
    sections,
  };
}
