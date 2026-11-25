/**
 * Kurzschreibweisen für Katalogeinträge. Jeder Eintrag bringt eine erfüllende und eine abweichende
 * Beispielkonfiguration mit (`satisfiedBy`/`deviatingWith`) – daraus prüfen die Tests die
 * Vergleichsrichtung, und die Demo-Daten können sich daran orientieren.
 */
import type { PostureLevel, PostureValue } from '../../../domain/posture';
import type { CatalogCheck, CatalogCheckId, PolicySubject } from '../types';
import {
  atLeast,
  atMost,
  bool,
  durationAtMost,
  isSet,
  oneOf,
  type Evaluator,
  type NumberUnit,
} from './compare';

export interface Where {
  level: PostureLevel | null;
  docsUrl: string;
}

const subject = (settings: Record<string, PostureValue>): PolicySubject => ({ settings });

export function custom(
  id: CatalogCheckId,
  properties: readonly string[],
  where: Where,
  evaluate: Evaluator,
  satisfiedBy: PolicySubject,
  deviatingWith: PolicySubject,
): CatalogCheck {
  return { id, properties, ...where, evaluate, satisfiedBy, deviatingWith };
}

/** Empfehlung „Erforderlich“/„Blockieren“ als Wahrheitswert. */
export function requireValue(
  id: CatalogCheckId,
  property: string,
  wanted: boolean,
  where: Where,
): CatalogCheck {
  return custom(
    id,
    [property],
    where,
    bool(property, wanted),
    subject({ [property]: wanted }),
    subject({ [property]: !wanted }),
  );
}

export function minimum(
  id: CatalogCheckId,
  property: string,
  value: number,
  unit: NumberUnit,
  where: Where,
): CatalogCheck {
  return custom(
    id,
    [property],
    where,
    atLeast(property, value, unit),
    subject({ [property]: value }),
    subject({ [property]: value - 1 }),
  );
}

export function maximum(
  id: CatalogCheckId,
  property: string,
  value: number,
  unit: NumberUnit,
  where: Where,
): CatalogCheck {
  return custom(
    id,
    [property],
    where,
    atMost(property, value, unit),
    subject({ [property]: value }),
    subject({ [property]: value + 1 }),
  );
}

export function anyValueSet(
  id: CatalogCheckId,
  property: string,
  example: string,
  where: Where,
): CatalogCheck {
  return custom(
    id,
    [property],
    where,
    isSet(property),
    subject({ [property]: example }),
    subject({ [property]: null }),
  );
}

/** `allowed[0]` ist der Learn-Wert, die übrigen sind strengere Werte. */
export function enumAtLeast(
  id: CatalogCheckId,
  property: string,
  allowed: readonly string[],
  deviating: string,
  labels: Record<string, string>,
  where: Where,
): CatalogCheck {
  return custom(
    id,
    [property],
    where,
    oneOf(property, allowed, labels),
    subject({ [property]: allowed[0] ?? null }),
    subject({ [property]: deviating }),
  );
}

export function durationMaximum(
  id: CatalogCheckId,
  property: string,
  maximumMinutes: number,
  satisfied: string,
  deviating: string,
  where: Where,
): CatalogCheck {
  return custom(
    id,
    [property],
    where,
    durationAtMost(property, maximumMinutes),
    subject({ [property]: satisfied }),
    subject({ [property]: deviating }),
  );
}
