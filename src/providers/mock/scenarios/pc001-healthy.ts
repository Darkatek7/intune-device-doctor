/** CONTOSO-PC001 – Windows 11, alles gesund, Check-in vor 2 Std. Erwartung: alle Kacheln ok. */
import { de } from '../../../i18n/de';
import type { MockScenario } from '../types';
import {
  entraDevice,
  healthyCompliancePolicies,
  healthyConfigurationPolicies,
  healthyProtection,
  osVolumeKey,
  windowsDevice,
} from './helpers';

export const pc001Healthy: MockScenario = {
  deviceName: 'CONTOSO-PC001',
  label: de.demo.scenarios['CONTOSO-PC001'],
  build: (now) => {
    const device = windowsDevice(now, 1, {
      userPrincipalName: 'anna.schmidt@contoso.com',
      userDisplayName: 'Anna Schmidt',
    });
    return {
      device,
      protection: { status: 'ok', data: healthyProtection(now) },
      compliancePolicies: { status: 'ok', data: healthyCompliancePolicies() },
      configurationPolicies: { status: 'ok', data: healthyConfigurationPolicies() },
      entraDevice: { status: 'ok', data: entraDevice(now, device) },
      bitlockerKeys: { status: 'ok', data: [osVolumeKey(now, 1)] },
    };
  },
};
