import type { DataMode } from '../domain/types';
import { scenarios } from '../providers/mock/scenarios';

export interface ExampleDevice {
  deviceName: string;
  label: string;
}

const DEMO_EXAMPLES: ExampleDevice[] = scenarios.map(({ deviceName, label }) => ({
  deviceName,
  label,
}));

/** Beispielgeräte für die Chips im leeren Zustand – nur im Demo-Modus. */
export function useExampleDevices(mode: DataMode): ExampleDevice[] {
  return mode === 'demo' ? DEMO_EXAMPLES : [];
}
