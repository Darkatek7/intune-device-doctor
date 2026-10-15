/** CONTOSO-PC050 – Gesundes Gerät, aber fehlende Berechtigung für Konfigurationsprofile und BitLocker-Schlüssel. Erwartung: Kacheln zeigen Berechtigungszustand. */
import { de } from '../../../i18n/de';
import type { MockScenario } from '../types';
import {
  entraDevice,
  healthyCompliancePolicies,
  healthyProtection,
  windowsDevice,
} from './helpers';

export const pc050Forbidden: MockScenario = {
  deviceName: 'CONTOSO-PC050',
  label: de.demo.scenarios['CONTOSO-PC050'],
  build: (now) => {
    const device = windowsDevice(now, 50, {
      userPrincipalName: 'emilia.roth@contoso.com',
      userDisplayName: 'Emilia Roth',
    });
    return {
      device,
      protection: { status: 'ok', data: healthyProtection(now) },
      compliancePolicies: { status: 'ok', data: healthyCompliancePolicies() },
      configurationPolicies: { status: 'forbidden' },
      entraDevice: { status: 'ok', data: entraDevice(now, device) },
      bitlockerKeys: { status: 'forbidden' },
    };
  },
};
