/**
 * „Wahrscheinlichste Ursache“: erkennt Muster über mehrere Kacheln und liefert höchstens
 * MAX_INSIGHTS priorisierte Einschätzungen. Reine Funktion über die bereits ausgewerteten Kacheln.
 *
 * Jede Verknüpfung hat eine Microsoft-Learn-Quelle (docsUrl), die den Zusammenhang belegt (Stand
 * 2026-11-09, siehe Kommentar je Regel). Schlüsse aus fehlenden Daten gibt es nicht: Ist ein
 * beteiligter Bereich noch am Laden oder forbidden/notApplicable/unavailable/error, entsteht keine Insight.
 */
import type { Finding, Tile, TileId } from '../domain/types';
import { de } from '../i18n/de';
import { Docs } from './knowledge/docs';

const t = de.analysis.insight.items;

export interface Insight {
  id: string;
  title: string;
  explanation: string;
  /** Konkrete, read-only formulierte Schritte (Reihenfolge = Vorgehen) */
  steps: readonly string[];
  /** Beteiligte Kacheln (Links im UI) */
  relatedTiles: TileId[];
  /** „Warum?“: welche Befunde die Einschätzung auslösen */
  why: string;
  /** Microsoft-Learn-Quelle für den Zusammenhang */
  docsUrl: string;
}

export const MAX_INSIGHTS = 3;

// Microsoft-Learn-Quellen (Zusammenhang je Regel belegt)
const DOCS = {
  /** „Conditional Access Compliance – carries device and user claims, evaluated by Entra ID to enforce Conditional Access (requiring compliant devices …)“ */
  prtConditionalAccess:
    'https://learn.microsoft.com/entra/identity/devices/concept-primary-refresh-token#what-is-a-prt-used-for',
  /** „Users see this message if the device is deleted or disabled … users can't access any resources protected by device-based Conditional Access“ */
  entraDeviceFaq: 'https://learn.microsoft.com/entra/identity/devices/faq',
  /** „Event ID 76 … indicates a failed auto-enrollment“ + Voraussetzungen der automatischen Registrierung */
  autoEnrollment: Docs.autoEnrollmentMdmLogs,
  /** „If Last check in is more than 24 hours … a device that can't check in can't receive your policies“ */
  checkInTroubleshoot:
    'https://learn.microsoft.com/troubleshoot/mem/intune/device-configuration/troubleshoot-policies-in-microsoft-intune#use-the-built-in-troubleshoot-pane',
  /** „When Intune detects that a device isn't compliant … Conditional Access can then block the device“ */
  noncomplianceBlocks:
    'https://learn.microsoft.com/intune/device-security/compliance/configure-noncompliance-actions#overview',
} as const;

const PROBLEM = new Set(['warning', 'critical']);

/** Kachel fertig geladen und ohne forbidden/notApplicable/unavailable/error. */
function usable(tile: Tile | undefined): tile is Tile {
  return tile !== undefined && tile.state === 'ready' && tile.availability === undefined;
}

function problemFindings(tile: Tile | undefined): Finding[] {
  return usable(tile) ? tile.findings.filter((f) => PROBLEM.has(f.severity)) : [];
}

function findingById(tile: Tile | undefined, ids: readonly string[]): Finding | undefined {
  return usable(tile) ? tile.findings.find((f) => ids.includes(f.id)) : undefined;
}

/** Anmeldungen mit Conditional-Access-Fehler (Befund-IDs signIns-failure-N). */
function signInFailures(tile: Tile | undefined): Finding[] {
  return usable(tile) ? tile.findings.filter((f) => f.id.startsWith('signIns-failure-')) : [];
}

export function correlate(tiles: readonly Tile[]): Insight[] {
  const byId = (id: TileId): Tile | undefined => tiles.find((tile) => tile.id === id);
  const signIns = byId('signIns');
  const failures = signInFailures(signIns);
  const found: Array<Insight & { priority: number }> = [];

  // 1. Entra-Gerät deaktiviert + Conditional-Access-Fehler → deaktiviertes Gerät als Ursache
  if (failures.length > 0 && findingById(byId('deviceStatus'), ['deviceStatus-disabled'])) {
    found.push({
      id: 'deviceDisabled',
      priority: 1,
      title: t.deviceDisabled.title,
      explanation: t.deviceDisabled.explanation,
      steps: t.deviceDisabled.steps,
      relatedTiles: ['deviceStatus', 'signIns'],
      why: t.deviceDisabled.why,
      docsUrl: DOCS.entraDeviceFaq,
    });
  }

  // 2. Kein PRT / Entra-Join-Problem (ZIP) + Conditional-Access-Fehler → zuerst Entra-Join/PRT beheben
  const join = problemFindings(byId('entraJoin')).find((f) =>
    ['entraJoin-prt', 'entraJoin-deviceAuth', 'entraJoin-notJoined'].includes(f.id),
  );
  if (join && failures.length > 0) {
    found.push({
      id: 'prtMissing',
      priority: 2,
      title: t.prtMissing.title,
      explanation: t.prtMissing.explanation,
      steps: t.prtMissing.steps,
      relatedTiles: ['entraJoin', 'signIns'],
      why: t.prtMissing.why(join.title),
      docsUrl: DOCS.prtConditionalAccess,
    });
  }

  // 3. MDM-Ereignis 76 (ZIP) + Enrollment-Befund → automatische Registrierung prüfen
  const event76 = findingById(byId('mdmEvents'), ['mdmEvents-mdmAdmin-76']);
  const enrollment = problemFindings(byId('enrollment'))[0];
  if (event76 && enrollment) {
    found.push({
      id: 'autoEnrollment',
      priority: 3,
      title: t.autoEnrollment.title,
      explanation: t.autoEnrollment.explanation,
      steps: t.autoEnrollment.steps,
      relatedTiles: ['mdmEvents', 'enrollment'],
      why: t.autoEnrollment.why(enrollment.title),
      docsUrl: DOCS.autoEnrollment,
    });
  }

  // 4. Letzter Check-in alt + Befunde bei Richtlinien/Apps/Compliance → Befunde evtl. veraltet
  const stale = findingById(byId('checkIn'), ['checkIn-stale', 'checkIn-delayed']);
  const affected = (['policies', 'apps', 'compliance'] as const).filter(
    (id) => problemFindings(byId(id)).length > 0,
  );
  if (stale && affected.length > 0) {
    found.push({
      id: 'staleCheckIn',
      priority: 4,
      title: t.staleCheckIn.title,
      explanation: t.staleCheckIn.explanation,
      steps: t.staleCheckIn.steps,
      relatedTiles: ['checkIn', ...affected],
      why: t.staleCheckIn.why(stale.title, affected.map((id) => de.tiles[id]).join(', ')),
      docsUrl: DOCS.checkInTroubleshoot,
    });
  }

  // 5. Gerät nicht konform + CA-Fehler 53000 → Compliance zuerst
  //    (In der Schonfrist behält der Benutzer laut Microsoft den Zugriff – dort keine Insight.)
  const notCompliant = findingById(byId('compliance'), ['compliance-state-noncompliant']);
  const blocked = failures.some((f) => f.evidence?.['errorCode'] === 53000);
  if (notCompliant && blocked) {
    found.push({
      id: 'complianceBlocked',
      priority: 5,
      title: t.complianceBlocked.title,
      explanation: t.complianceBlocked.explanation,
      steps: t.complianceBlocked.steps,
      relatedTiles: ['compliance', 'signIns'],
      why: t.complianceBlocked.why,
      docsUrl: DOCS.noncomplianceBlocks,
    });
  }

  return found
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_INSIGHTS)
    .map(({ id, title, explanation, steps, relatedTiles, why, docsUrl }) => ({
      id,
      title,
      explanation,
      steps,
      relatedTiles,
      why,
      docsUrl,
    }));
}
