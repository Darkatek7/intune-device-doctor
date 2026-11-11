import type { DataMode } from '../domain/types';
import { scenarios } from '../providers/mock/scenarios';
import { deviceIconKind, type DeviceIconKind } from '../ui/deviceIcon';

export interface ExampleDevice {
  deviceName: string;
  label: string;
  /** Plattform-Symbol der Chips (Laptop, Smartphone, Tablet) */
  iconKind: DeviceIconKind;
}

let demoExamples: ExampleDevice[] | undefined;

/** Beispielgeräte für die Chips im leeren Zustand – nur im Demo-Modus. */
export function useExampleDevices(mode: DataMode): ExampleDevice[] {
  if (mode !== 'demo') return [];
  // Das Symbol folgt der Plattform des Szenarios (Mac/iPhone/Android ≠ Laptop); einmal berechnet.
  demoExamples ??= scenarios.map(({ deviceName, label, build }) => ({
    deviceName,
    label,
    iconKind: deviceIconKind(build(new Date()).device),
  }));
  return demoExamples;
}
