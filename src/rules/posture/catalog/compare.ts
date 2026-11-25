/**
 * Vergleichsbausteine des Katalogs. Jede Funktion legt die **Vergleichsrichtung** fest – „strenger als
 * empfohlen“ ist nie eine Abweichung:
 * - `bool`: genau der empfohlene Wahrheitswert
 * - `atLeast`: Ist ≥ Soll (z. B. Mindestlänge 8 bei Empfehlung 6 → erfüllt)
 * - `atMost`: 0 < Ist ≤ Soll (z. B. Kennwortablauf 30 bei Empfehlung 41 → erfüllt; 0 = nicht gesetzt).
 *   Ausnahme `zeroUndocumented`: Bietet das Portal für die Einstellung „Sofort“ an und dokumentiert Graph
 *   nicht, wie das kodiert ist, ist 0 mehrdeutig („Sofort“ oder nicht konfiguriert) → nicht prüfbar.
 * - `oneOf`: Ist ist der empfohlene oder ein strengerer Enum-Wert (Liste je Prüfung im Katalog)
 * - `isSet`: ein Wert ist gesetzt (Learn nennt nur ein Beispiel, keinen festen Wert)
 * - `durationAtMost`: 0 < Dauer ≤ Soll
 *
 * Zustände: fehlt der Schlüssel in `settings`, hat Graph den Wert nicht geliefert → `notChecked`.
 * `null` heißt „nicht konfiguriert“ → `deviating` (die Empfehlung verlangt einen Wert).
 */
import type { PostureValue } from '../../../domain/posture';
import { dePosture } from '../../../i18n/de-posture';
import { formatDurationMinutes, parseIsoDurationMinutes } from '../duration';
import type { CheckOutcome, PolicySubject } from '../types';

const v = dePosture.values;
const c = dePosture.common;

export type Evaluator = (subject: PolicySubject) => CheckOutcome;
export type NumberUnit = 'minutes' | 'days' | 'characters' | 'count';

const notDelivered = (): CheckOutcome => ({
  status: 'notChecked',
  actual: c.notDelivered,
  reason: c.notDeliveredReason,
});

function read(subject: PolicySubject, property: string): PostureValue | undefined {
  return Object.prototype.hasOwnProperty.call(subject.settings, property)
    ? subject.settings[property]
    : undefined;
}

export function formatNumber(value: number, unit: NumberUnit): string {
  switch (unit) {
    case 'minutes':
      return v.minutes(value);
    case 'days':
      return v.days(value);
    case 'characters':
      return v.characters(value);
    case 'count':
      return v.count(value);
  }
}

/** Anzeige eines Rohwerts ohne Einheit (Ja/Nein, Enum deutsch, sonst roh). */
export function formatRaw(value: PostureValue, labels?: Record<string, string>): string {
  if (value === null) return v.notConfigured;
  if (typeof value === 'boolean') return value ? v.yes : v.no;
  if (typeof value === 'string') return labels?.[value] ?? value;
  return String(value);
}

export function bool(property: string, wanted: boolean): Evaluator {
  return (subject) => {
    const value = read(subject, property);
    if (value === undefined) return notDelivered();
    if (value === null) return { status: 'deviating', actual: v.notConfigured };
    if (typeof value !== 'boolean') return notDelivered();
    return { status: value === wanted ? 'met' : 'deviating', actual: formatRaw(value) };
  };
}

export function atLeast(property: string, minimum: number, unit: NumberUnit): Evaluator {
  return (subject) => {
    const value = read(subject, property);
    if (value === undefined) return notDelivered();
    if (value === null) return { status: 'deviating', actual: v.notConfigured };
    if (typeof value !== 'number') return notDelivered();
    return { status: value >= minimum ? 'met' : 'deviating', actual: formatNumber(value, unit) };
  };
}

export interface AtMostOptions {
  /** 0 ist mehrdeutig (Portal kennt „Sofort“, Graph-Kodierung nicht dokumentiert) → nicht prüfbar */
  zeroUndocumented?: boolean;
}

export function atMost(
  property: string,
  maximum: number,
  unit: NumberUnit,
  options: AtMostOptions = {},
): Evaluator {
  return (subject) => {
    const value = read(subject, property);
    if (value === undefined) return notDelivered();
    if (value === null) return { status: 'deviating', actual: v.notConfigured };
    if (typeof value !== 'number') return notDelivered();
    if (value === 0 && options.zeroUndocumented) {
      return { status: 'notChecked', actual: v.zeroUndocumented, reason: v.zeroUndocumentedReason };
    }
    if (value <= 0) return { status: 'deviating', actual: v.notConfigured };
    return { status: value <= maximum ? 'met' : 'deviating', actual: formatNumber(value, unit) };
  };
}

/** `allowed` = empfohlener Wert und alle strengeren Werte (Reihenfolge laut Learn bzw. Graph-Enum). */
export function oneOf(
  property: string,
  allowed: readonly string[],
  labels: Record<string, string>,
): Evaluator {
  return (subject) => {
    const value = read(subject, property);
    if (value === undefined) return notDelivered();
    if (value === null) return { status: 'deviating', actual: v.notConfigured };
    if (typeof value !== 'string') return notDelivered();
    return {
      status: allowed.includes(value) ? 'met' : 'deviating',
      actual: formatRaw(value, labels),
    };
  };
}

export function isSet(property: string): Evaluator {
  return (subject) => {
    const value = read(subject, property);
    if (value === undefined) return notDelivered();
    if (value === null || (typeof value === 'string' && value.trim() === '')) {
      return { status: 'deviating', actual: v.notSet };
    }
    return { status: 'met', actual: v.set(String(value)) };
  };
}

export function durationAtMost(property: string, maximumMinutes: number): Evaluator {
  return (subject) => {
    const value = read(subject, property);
    if (value === undefined) return notDelivered();
    if (value === null) return { status: 'deviating', actual: v.notConfigured };
    const minutes = typeof value === 'string' ? parseIsoDurationMinutes(value) : null;
    if (minutes === null) {
      return {
        status: 'notChecked',
        actual: c.unknownFormat(String(value)),
        reason: c.unknownFormat(String(value)),
      };
    }
    if (minutes <= 0) return { status: 'deviating', actual: v.notConfigured };
    return {
      status: minutes <= maximumMinutes ? 'met' : 'deviating',
      actual: formatDurationMinutes(minutes),
    };
  };
}

/**
 * Stufe 3 (iOS/iPadOS, Android-Arbeitsprofil): „Require the device to be at or under the Device Threat
 * Level: Secured“. Learn ergänzt in beiden Tabellen: „Customers should consider implementing Microsoft
 * Defender for Endpoint or a mobile threat defense solution. It isn't necessary to deploy both.“
 * - Bedrohungsstufe aktiviert (`deviceThreatProtectionEnabled = true`): nur `secured` erfüllt, jede andere
 *   Stufe weicht ab.
 * - Nicht aktiviert (false/null): **nicht prüfbar** – die Alternative (Risikobewertung von Defender for
 *   Endpoint) ist über v1.0 nicht lesbar; „weicht ab“ wäre eine Behauptung ohne Beleg.
 */
export function deviceThreatLevelSecured(labels: Record<string, string>): Evaluator {
  const level = oneOf('deviceThreatProtectionRequiredSecurityLevel', ['secured'], labels);
  return (subject) => {
    const enabled = read(subject, 'deviceThreatProtectionEnabled');
    if (enabled === undefined) return notDelivered();
    if (enabled !== null && typeof enabled !== 'boolean') return notDelivered();
    if (enabled !== true) {
      return { status: 'notChecked', actual: v.threatNotEnabled, reason: v.threatNotEnabledReason };
    }
    const outcome = level(subject);
    return { ...outcome, actual: v.join([v.threatEnabled, outcome.actual]) };
  };
}

/** Alle Teilprüfungen müssen erfüllt sein; eine Abweichung genügt für „weicht ab“. */
export function allOf(...evaluators: Evaluator[]): Evaluator {
  return (subject) => {
    const outcomes = evaluators.map((evaluate) => evaluate(subject));
    const actual = v.join(outcomes.map((outcome) => outcome.actual));
    if (outcomes.some((outcome) => outcome.status === 'deviating')) {
      return { status: 'deviating', actual };
    }
    const unchecked = outcomes.find((outcome) => outcome.status === 'notChecked');
    if (unchecked) return { status: 'notChecked', actual, reason: unchecked.reason };
    return { status: 'met', actual };
  };
}

/**
 * „Mark device noncompliant: Immediately“. Die Standardaktion jeder Compliance-Richtlinie erscheint in
 * `scheduledActionsForRule` als `actionType: block` („Block the device in AAD“ laut Enum-Doku) mit
 * `gracePeriodHours` (0 = sofort). Fehlt eine block-Aktion, ist die Zuordnung nicht sicher → nicht prüfbar.
 */
export function markNoncompliantImmediately(): Evaluator {
  return (subject) => {
    const actions = subject.scheduledActions;
    if (actions === null || actions === undefined) {
      return { status: 'notChecked', actual: v.actionsNotRead, reason: v.actionsNotRead };
    }
    const block = actions.find((action) => action.actionType === 'block');
    if (!block) return { status: 'notChecked', actual: v.noBlockAction, reason: v.noBlockAction };
    if (block.gracePeriodHours === null) return notDelivered();
    return block.gracePeriodHours === 0
      ? { status: 'met', actual: v.immediately }
      : { status: 'deviating', actual: v.afterHours(block.gracePeriodHours) };
  };
}
