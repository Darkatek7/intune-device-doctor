/**
 * Betriebssystem: Windows-Version über die quellenbelegte Release-Tabelle (Build → Version, Supportende).
 * Windows 10 → Warnung (Supportende 14.10.2025). Unbekannter Build → unknown (nicht raten).
 * Für andere Plattformen ist kein Supportstatus hinterlegt → unknown mit Hinweis.
 */
import { formatDate } from '../../domain/format';
import type { DeviceSnapshot, Finding, Severity, Tile, TileFact } from '../../domain/types';
import { de } from '../../i18n/de';
import { Docs } from '../knowledge/docs';
import { findWindowsRelease, parseWindowsVersion } from '../knowledge/windowsReleases';
import { THRESHOLDS } from '../thresholds';

const t = de.rules.osVersion;
const f = de.rules.facts;
const DAY = 86_400_000;

export function evaluateOsVersion(snapshot: DeviceSnapshot, now: Date): Tile {
  const { device } = snapshot;
  const findings: Finding[] = [];
  const facts: TileFact[] = [
    {
      label: f.os,
      value: [device.operatingSystem, device.osVersion].filter(Boolean).join(' ') || '–',
    },
  ];
  const base = {
    id: 'osVersion' as const,
    title: de.tiles.osVersion,
    state: 'ready' as const,
    sources: [device.source],
    sections: [],
  };

  if (device.osFamily !== 'windows') {
    return {
      ...base,
      severity: 'unknown',
      value: t.valueOther(device.operatingSystem ?? '', device.osVersion ?? ''),
      summary: t.summaryNotEvaluated,
      findings,
      facts,
    };
  }

  const parsed = parseWindowsVersion(device.osVersion);
  const release = parsed ? findWindowsRelease(parsed.build) : undefined;
  const buildText = parsed
    ? `${parsed.build}${parsed.revision !== null ? `.${parsed.revision}` : ''}`
    : '–';
  facts.push({ label: f.build, value: buildText, mono: true });

  if (!parsed || !release) {
    findings.push({
      id: 'osVersion-unknownBuild',
      severity: 'unknown',
      title: t.unknownBuildTitle,
      detail: t.unknownBuildDetail(device.osVersion ?? '–'),
      cause: t.unknownBuildCause,
      remediation: [...t.unknownBuildRemediation],
      evidence: { operatingSystem: device.operatingSystem, osVersion: device.osVersion },
      source: device.source,
      docsUrl: Docs.windows11Releases,
    });
    return {
      ...base,
      severity: 'unknown',
      value: parsed ? t.valueUnknownBuild(parsed.build) : (device.operatingSystem ?? '–'),
      summary: t.summaryBuild(buildText),
      findings,
      facts,
    };
  }

  facts.push({ label: f.release, value: `${release.product} ${release.version}` });
  facts.push({ label: f.endOfUpdates, value: formatDate(release.endOfUpdatesEnterprise) });
  facts.push({ label: f.endOfUpdatesHomePro, value: formatDate(release.endOfUpdatesHomePro) });

  const end = new Date(`${release.endOfUpdatesEnterprise}T23:59:59Z`);
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / DAY);
  const evidence = {
    osVersion: device.osVersion,
    build: parsed.build,
    revision: parsed.revision,
    release: `${release.product} ${release.version}`,
    endOfUpdatesEnterprise: release.endOfUpdatesEnterprise,
    endOfUpdatesHomePro: release.endOfUpdatesHomePro,
  };
  let severity: Severity = 'ok';
  let summary = t.summaryEnd(formatDate(release.endOfUpdatesEnterprise));

  if (release.product === 'Windows 10') {
    severity = 'warning';
    summary = t.summaryEnded;
    findings.push({
      id: 'osVersion-win10',
      severity,
      title: t.win10Title,
      detail: t.win10Detail(buildText),
      cause: t.win10Cause,
      remediation: [...t.win10Remediation],
      evidence,
      source: device.source,
      docsUrl: release.docsUrl,
    });
  } else if (daysLeft < 0) {
    severity = 'warning';
    summary = t.summaryEnded;
    findings.push({
      id: 'osVersion-ended',
      severity,
      title: t.endedTitle(release.version),
      detail: t.endedDetail(release.version, formatDate(release.endOfUpdatesEnterprise)),
      cause: t.endCause,
      remediation: [...t.endRemediation],
      evidence,
      source: device.source,
      docsUrl: release.docsUrl,
    });
  } else if (daysLeft <= THRESHOLDS.osEndOfUpdatesWarningDays) {
    severity = 'warning';
    findings.push({
      id: 'osVersion-ending',
      severity,
      title: t.endingTitle(release.version, daysLeft),
      detail: `${t.endingDetail(release.version, formatDate(release.endOfUpdatesEnterprise))} ${t.homeProHint}`,
      cause: t.endCause,
      remediation: [...t.endRemediation],
      evidence,
      source: device.source,
      docsUrl: release.docsUrl,
    });
  }

  const homeProEnd = new Date(`${release.endOfUpdatesHomePro}T23:59:59Z`);
  if (release.product === 'Windows 11' && daysLeft >= 0 && homeProEnd.getTime() < now.getTime()) {
    findings.push({
      id: 'osVersion-homePro',
      severity: 'unknown',
      title: t.homeProEndedTitle(release.version),
      detail: t.homeProEndedDetail(formatDate(release.endOfUpdatesHomePro)),
      cause: t.homeProEndedCause,
      remediation: [...t.endRemediation],
      evidence,
      source: device.source,
      docsUrl: release.docsUrl,
    });
  }

  return {
    ...base,
    severity,
    value: t.valueWindows(release.product, release.version),
    summary,
    findings,
    facts,
  };
}
