/**
 * Kachel „Microsoft Secure Score“: nur, was Microsoft liefert – keine eigenen Sollwerte.
 *
 * - Ausgewertet werden Empfehlungen der Kategorie `Device` (`controlCategory`), ohne veraltete. Kein
 *   Filter auf den Dienst „Intune“: Learn nennt Intune nicht in der Produktliste von Secure Score, ein
 *   solcher Filter griffe womöglich nie – oder zöge Empfehlungen anderer Kategorien herein.
 * - Null passende Empfehlungen → ruhiger Hinweis „Keine Geräte-Empfehlungen gemeldet“, nie „erfüllt“.
 * - Der Bearbeitungsstatus einer Empfehlung (z. B. „Risiko akzeptiert“, `controlStateUpdates`) wird bewusst
 *   nicht gelesen; solche Empfehlungen können hier als offen erscheinen – das steht im Text der Kachel.
 * - Erfüllt = volle Punktzahl laut Microsoft (`score >= maxScore`); Teilpunkte = offen. Ohne Punktzahl →
 *   nicht prüfbar.
 * - Titel, Beschreibung, Kategorie und Dienst bleiben unverändert englisch (`lang="en"`).
 * Severity: offene Empfehlungen → warning (Microsoft-Empfehlung, Microsoft betont aber selbst, dass
 * nicht jede Empfehlung in jede Umgebung passt – steht im Text).
 */
import { formatDateTime, formatRelativeTime } from '../../domain/format';
import type { SecureScoreControl, TenantPosture } from '../../domain/posture';
import type { Finding, TileFact } from '../../domain/types';
import { dePosture } from '../../i18n/de-posture';
import { Docs } from '../knowledge/docs';
import { buildTile, issueTile } from './kit';
import type { PostureCheckResult, PostureTile } from './types';

const t = dePosture.secureScore;
const ID = 'postureSecureScore' as const;

/** Höchstzahl offener Empfehlungen, die zusätzlich als eigener Befund mit Beschreibung erscheinen (Darstellung). */
export const SECURE_SCORE_DETAIL_LIMIT = 5;

export function isDeviceControl(control: SecureScoreControl): boolean {
  if (control.deprecated) return false;
  return control.category?.trim().toLowerCase() === 'device';
}

function gap(control: SecureScoreControl): number {
  return (control.maxScore ?? 0) - (control.score ?? 0);
}

export function evaluateSecureScore(posture: TenantPosture, now: Date): PostureTile {
  const section = posture.secureScore;
  if (section.status !== 'ok') return issueTile(ID, section);
  const info = section.data;
  const source = section.source;
  const controls = info.controls.filter(isDeviceControl);
  const checks: PostureCheckResult[] = controls.map((control) => {
    const evaluable = control.score !== null && control.maxScore !== null && control.maxScore > 0;
    const met = evaluable && (control.score as number) >= (control.maxScore as number);
    return {
      id: `${ID}:${control.id}`,
      tile: ID,
      label: control.title ?? control.id,
      status: !evaluable ? 'notChecked' : met ? 'met' : 'deviating',
      level: null,
      actual: t.points(control.score, control.maxScore),
      expected: t.expected,
      docsUrl: Docs.postureSecureScore,
      ...(evaluable ? {} : { reason: t.notCheckedReason }),
      counted: true,
    };
  });

  const facts: TileFact[] = [
    { label: t.facts.score, value: t.facts.scoreValue(info.currentScore, info.maxScore) },
    { label: t.facts.state, value: t.facts.stateValue },
  ];
  if (info.createdDateTime) {
    facts.push({
      label: t.facts.date,
      value: formatRelativeTime(info.createdDateTime, now),
      title: formatDateTime(info.createdDateTime),
    });
  }
  const metCount = checks.filter((check) => check.status === 'met').length;
  facts.push({
    label: t.facts.deviceControls,
    value: t.facts.deviceControlsValue(metCount, controls.length),
  });

  const findings: Finding[] = [];
  if (controls.length === 0) {
    findings.push({
      id: `${ID}-none`,
      severity: 'unknown',
      title: t.noneTitle,
      detail: t.noneDetail,
      cause: t.noneCause,
      remediation: [...t.noneRemediation],
      source,
      docsUrl: Docs.postureSecureScoreControlProfile,
    });
    return buildTile({
      id: ID,
      value: t.valueNone,
      summary: t.noneDetail,
      findings,
      facts,
      sources: [source],
      checks,
    });
  }

  const open = controls
    .filter((_control, index) => checks[index]?.status === 'deviating')
    .sort((a, b) => gap(b) - gap(a));
  if (open.length > 0) {
    const col = t.columns;
    findings.push({
      id: `${ID}-open`,
      severity: 'warning',
      title: t.title,
      detail: t.detail(open.length, controls.length),
      cause: t.cause,
      remediation: [...t.remediation],
      table: {
        columns: [col.title, col.points, col.category, col.service],
        columnLangs: ['en', null, 'en', 'en'],
        rows: open.map((control) => ({
          cells: [
            control.title ?? control.id,
            t.points(control.score, control.maxScore),
            control.category ?? '–',
            control.service ?? '–',
          ],
          cellLangs: ['en', null, control.category ? 'en' : null, control.service ? 'en' : null],
        })),
      },
      source,
      docsUrl: Docs.postureSecureScoreActions,
    });
    for (const control of open.slice(0, SECURE_SCORE_DETAIL_LIMIT)) {
      findings.push({
        id: `${ID}-control-${control.id}`,
        severity: 'warning',
        title: control.title ?? t.controlTitleFallback,
        ...(control.title ? { titleLang: 'en' as const } : {}),
        detail: control.description ?? control.remediation ?? t.controlDetailFallback,
        ...((control.description ?? control.remediation) ? { detailLang: 'en' as const } : {}),
        cause: t.controlCause,
        remediation: [...t.controlRemediation],
        evidence: {
          controlName: control.id,
          score: control.score,
          maxScore: control.maxScore,
          implementationCost: control.implementationCost,
          userImpact: control.userImpact,
        },
        source,
        docsUrl: Docs.postureSecureScoreActions,
      });
    }
  }

  return buildTile({ id: ID, findings, facts, sources: [source], checks });
}
