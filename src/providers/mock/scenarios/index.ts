/** Alle Demo-Szenarien (fiktiv, Contoso). Reihenfolge = Reihenfolge der Beispiel-Chips. */
import type { MockScenario } from '../types';
import { lt108Win10 } from './lt108-win10';
import { mac07Macos } from './mac07-macos';
import { pc001Healthy } from './pc001-healthy';
import { pc014Bitlocker } from './pc014-bitlocker';
import { pc027Defender } from './pc027-defender';
import { pc033Stale } from './pc033-stale';
import { pc042PolicyConflict } from './pc042-policy-conflict';
import { pc050Forbidden } from './pc050-forbidden';

export const scenarios: MockScenario[] = [
  pc001Healthy,
  pc014Bitlocker,
  pc027Defender,
  pc033Stale,
  pc042PolicyConflict,
  lt108Win10,
  mac07Macos,
  pc050Forbidden,
];
