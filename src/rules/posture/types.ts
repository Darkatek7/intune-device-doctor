/**
 * Typen des Regelwerks „Empfehlungen“ (M21).
 *
 * Eine **Einzelprüfung** (`PostureCheckResult`) vergleicht genau einen Ist-Wert mit einem auf Microsoft
 * Learn dokumentierten Sollwert. Kacheln werden aus Einzelprüfungen gebaut und tragen sie mit
 * (`PostureTile.checks`), damit `postureScore` das Gesamtbild ohne Nebenkanal zählen kann.
 */
import type {
  ComplianceScheduledAction,
  PostureLevel,
  PostureSettings,
} from '../../domain/posture';
import type { Tile, TileId } from '../../domain/types';
import type { dePosture } from '../../i18n/de-posture';

export type CheckStatus = 'met' | 'deviating' | 'notChecked';

/** Ergebnis eines Vergleichs (Katalog oder Kachel-Logik). */
export interface CheckOutcome {
  status: CheckStatus;
  /** Ist-Wert, deutsch formatiert */
  actual: string;
  /** Nur bei notChecked: warum nicht prüfbar */
  reason?: string;
}

/** Was eine Katalogprüfung von einer Richtlinie sieht (Compliance- oder App-Schutz-Richtlinie). */
export interface PolicySubject {
  settings: PostureSettings;
  /** Nur Compliance-Richtlinien; null = nicht gelesen */
  scheduledActions?: ComplianceScheduledAction[] | null;
}

export type CatalogCheckId = keyof typeof dePosture.catalog;
export type UncheckableId = keyof typeof dePosture.uncheckable;

/**
 * Eine Prüfung des Katalogs: Graph-Eigenschaft(en) des dokumentierten Typs (v1.0; für Android Enterprise
 * „vollständig verwaltet“ der nur in beta dokumentierte Typ, freigegebene Ausnahme) ↔ Learn-Sollwert.
 * Bezeichnung und Sollwert-Text stehen unter derselben `id` in `de.posture.catalog`.
 */
export interface CatalogCheck {
  id: CatalogCheckId;
  /** Exakte Graph-Eigenschaftsnamen (Schlüssel in `settings`); leer bei Aktionen bei Nichtkonformität */
  properties: readonly string[];
  /** null = Empfehlung ohne Stufen (z. B. Windows-Tabelle der Zero-Trust-Seite) */
  level: PostureLevel | null;
  /** Learn-Seite, die genau diesen Sollwert nennt */
  docsUrl: string;
  /** Eine Konfiguration, die die Prüfung erfüllt (Grundlage für Demo-Daten und Tests) */
  satisfiedBy: PolicySubject;
  /** Eine Konfiguration, die abweicht (Tests) */
  deviatingWith: PolicySubject;
  evaluate(subject: PolicySubject): CheckOutcome;
}

/** Learn-Sollwert ohne dokumentierte Eigenschaft bzw. ohne dokumentierte Zuordnung → „nicht prüfbar“. */
export interface UncheckableRecommendation {
  id: UncheckableId;
  level: PostureLevel | null;
  docsUrl: string;
  reason: keyof typeof dePosture.uncheckableReason;
}

/** Ein Microsoft-Framework (Sicherheitskonfiguration bzw. Datenschutzframework) als Katalog. */
export interface PostureFramework {
  id: string;
  /** Angebotene Stufen; null = nicht gestuft */
  levels: readonly PostureLevel[] | null;
  /** Hauptquelle des Frameworks (für Befunde je Richtlinie) */
  docsUrl: string;
  checks: readonly CatalogCheck[];
  uncheckable: readonly UncheckableRecommendation[];
}

/** Eine bewertete Einzelprüfung. */
export interface PostureCheckResult {
  /** Eindeutig je Auswertung, z. B. `postureComplianceWindows:winBitLocker:<Richtlinien-ID>` */
  id: string;
  tile: TileId;
  label: string;
  status: CheckStatus;
  level: PostureLevel | null;
  actual: string;
  expected: string;
  docsUrl: string;
  /** Betroffene Richtlinie (Anzeigename), falls die Prüfung zu einer Richtlinie gehört */
  subject?: string;
  /**
   * Exakte Graph-Eigenschaftsnamen der geprüften Einstellung (technischer Name, z. B.
   * `passwordMinimumLength`) – nur bei Katalogprüfungen, die eine Eigenschaft lesen.
   */
  properties?: readonly string[];
  reason?: string;
  /**
   * false = wird angezeigt, zählt aber nicht zum Gesamtbild (z. B. nicht zugewiesene Richtlinie, gilt
   * für kein Gerät).
   */
  counted: boolean;
}

/** Kachel der Ansicht „Empfehlungen“ samt ihrer Einzelprüfungen (zuweisbar zu `Tile`). */
export interface PostureTile extends Tile {
  checks: readonly PostureCheckResult[];
}

export interface PostureOptions {
  level: PostureLevel;
  now: Date;
}
