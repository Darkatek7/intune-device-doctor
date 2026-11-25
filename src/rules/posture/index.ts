/**
 * Regelwerk der Ansicht „Empfehlungen“ (M21): reine Funktionen `TenantPosture → Tile[]`.
 *
 * Aufbau
 * - `catalog/` – Daten: je Microsoft-Framework die Prüfungen {Graph-Eigenschaft ↔ Learn-Sollwert, Stufe,
 *   Learn-URL, Vergleich}; Texte unter derselben ID in `de.posture.catalog`. Learn-Sollwerte ohne
 *   v1.0-Eigenschaft stehen als `uncheckable` daneben („über dokumentierte API nicht prüfbar“).
 * - je Kachel eine Datei (Auswertung), `kit.ts` mit gemeinsamen Bausteinen.
 *
 * Einzelprüfungen und Gesamtbild
 * Jede Kachel entsteht aus Einzelprüfungen (`PostureCheckResult`: erfüllt / weicht ab / nicht prüfbar).
 * `evaluatePosture` liefert `PostureTile` – das ist ein gewöhnliches `Tile` (Kachelraster und
 * Detail-Sheet funktionieren unverändert) mit dem zusätzlichen Feld `checks`. `postureScore(tiles)`
 * zählt diese Prüfungen; Kopien per Spread (`{ ...tile }`) behalten sie. Wer nur die Prüfungen braucht,
 * nimmt `evaluatePostureChecks`. Prüfungen mit `counted: false` (z. B. nicht zugewiesene Richtlinie)
 * werden angezeigt, zählen aber nicht.
 *
 * Bewertung: „weicht von der Empfehlung ab“ → höchstens `warning`. `critical` nur, wo Learn die Lücke
 * ausdrücklich als Risiko nennt (Begründung jeweils im Kopf der Datei): Mandanten-Einstellung „konform
 * ohne Richtlinie“ bei aktivem Bedingten Zugriff mit Konformität (tenantSettings.ts), Plattform mit
 * Geräten ohne zugewiesene Compliance-Richtlinie (coverage.ts).
 */
import type { PostureLevel, TenantPosture } from '../../domain/posture';
import type { Tile, TileId } from '../../domain/types';
import type { dePosture } from '../../i18n/de-posture';
import { evaluateAccess } from './access';
import { evaluateAppProtectionTile } from './appProtection';
import { evaluateBaselines } from './baselines';
import { evaluateComplianceTile } from './compliance';
import { evaluateCoverage } from './coverage';
import { evaluateEndpointSecurity } from './endpointSecurity';
import { evaluateSecureScore } from './secureScore';
import { evaluateTenantSettings } from './tenantSettings';
import type { PostureCheckResult, PostureOptions, PostureTile } from './types';

export type { PostureCheckResult, PostureTile } from './types';
export { parseIsoDurationMinutes } from './duration';
export { ALL_FRAMEWORKS } from './catalog';

/** Kacheln der Ansicht in fester Reihenfolge. */
export function evaluatePosture(
  posture: TenantPosture,
  options: { level: PostureLevel; now: Date },
): PostureTile[] {
  const opts: PostureOptions = { level: options.level, now: options.now };
  return [
    evaluateTenantSettings(posture),
    evaluateCoverage(posture),
    evaluateAccess(posture),
    evaluateComplianceTile(posture, 'windows', opts),
    evaluateComplianceTile(posture, 'ios', opts),
    evaluateComplianceTile(posture, 'android', opts),
    evaluateComplianceTile(posture, 'macos', opts),
    evaluateAppProtectionTile(posture, 'ios', opts),
    evaluateAppProtectionTile(posture, 'android', opts),
    evaluateBaselines(posture),
    evaluateEndpointSecurity(posture),
    evaluateSecureScore(posture, opts.now),
  ];
}

/** Alle Einzelprüfungen (z. B. für Export oder Tests), in Kachelreihenfolge. */
export function evaluatePostureChecks(
  posture: TenantPosture,
  options: { level: PostureLevel; now: Date },
): PostureCheckResult[] {
  return evaluatePosture(posture, options).flatMap((tile) => [...tile.checks]);
}

export type PostureSectionId = keyof typeof dePosture.sections;

/** Abschnitte der Ansicht in Anzeigereihenfolge mit ihren Kacheln (wie TENANT_SECTIONS in src/rules/tenant.ts). */
export const POSTURE_SECTIONS: ReadonlyArray<{ key: PostureSectionId; tiles: readonly TileId[] }> =
  [
    { key: 'basics', tiles: ['postureTenantSettings', 'postureCoverage', 'postureAccess'] },
    {
      key: 'compliance',
      tiles: [
        'postureComplianceWindows',
        'postureComplianceIos',
        'postureComplianceAndroid',
        'postureComplianceMacos',
      ],
    },
    { key: 'appProtection', tiles: ['postureAppProtectionIos', 'postureAppProtectionAndroid'] },
    { key: 'endpoint', tiles: ['postureBaselines', 'postureEndpointSecurity'] },
    { key: 'secureScore', tiles: ['postureSecureScore'] },
  ];

/** Kacheln nach Abschnitt (Reihenfolge laut POSTURE_SECTIONS); leere Abschnitte entfallen. */
export function groupPostureTiles<T extends Tile>(
  tiles: T[],
): Array<{ key: PostureSectionId; tiles: T[] }> {
  return POSTURE_SECTIONS.map((section) => ({
    key: section.key,
    tiles: section.tiles
      .map((id) => tiles.find((tile) => tile.id === id))
      .filter((tile): tile is T => tile !== undefined),
  })).filter((section) => section.tiles.length > 0);
}

export function isPostureTile(tile: Tile): tile is PostureTile {
  return Array.isArray((tile as Partial<PostureTile>).checks);
}

export interface PostureScore {
  met: number;
  deviating: number;
  notChecked: number;
  total: number;
}

/** Gesamtbild über alle Kacheln: erfüllte / abweichende / nicht prüfbare Einzelprüfungen (nur gezählte). */
export function postureScore(tiles: Tile[]): PostureScore {
  const checks = tiles
    .filter(isPostureTile)
    .flatMap((tile) => tile.checks.filter((c) => c.counted));
  const met = checks.filter((check) => check.status === 'met').length;
  const deviating = checks.filter((check) => check.status === 'deviating').length;
  const notChecked = checks.filter((check) => check.status === 'notChecked').length;
  return { met, deviating, notChecked, total: checks.length };
}
