/**
 * Anzeige von „Verwaltet von“ einer Flottenzeile – gemeinsam für Liste und CSV-Export. Die Gruppe
 * „Sonstige“ nennt den Rohwert von Graph; fehlt er, steht das ausdrücklich da.
 */
import { de } from '../i18n/de';
import type { FleetRow } from './fleetDevices';

const t = de.fleetDevices.management;

export function fleetManagementLabel(row: Pick<FleetRow, 'management' | 'device'>): string {
  if (row.management !== 'other') return t.names[row.management];
  const agent = row.device.managementAgent;
  return agent ? t.otherWithAgent(agent) : t.notReported;
}
