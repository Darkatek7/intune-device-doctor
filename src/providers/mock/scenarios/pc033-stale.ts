/** CONTOSO-PC033 – letzter Check-in vor 41 Tagen, Compliance noncompliant, Entra-Anmeldung alt. Erwartung: Check-in critical. */
import { de } from '../../../i18n/de';
import type { MockScenario } from '../types';
import {
  ago,
  entraDevice,
  healthyCompliancePolicies,
  healthyConfigurationPolicies,
  healthyProtection,
  osVolumeKey,
  policy,
  setting,
  windowsDevice,
} from './helpers';

export const pc033Stale: MockScenario = {
  deviceName: 'CONTOSO-PC033',
  label: de.demo.scenarios['CONTOSO-PC033'],
  build: (now) => {
    const device = windowsDevice(now, 33, {
      userPrincipalName: 'markus.becker@contoso.com',
      userDisplayName: 'Markus Becker',
      complianceState: 'noncompliant',
      lastSyncDateTime: ago(now, { days: 41 }),
    });
    return {
      device,
      protection: {
        status: 'ok',
        data: healthyProtection(now, {
          lastReportedDateTime: ago(now, { days: 41 }),
          lastQuickScanDateTime: ago(now, { days: 42 }),
          signatureUpdateOverdue: true,
          quickScanOverdue: true,
          productStatus: ['avSignaturesOutOfDate'],
        }),
      },
      compliancePolicies: {
        status: 'ok',
        data: [
          policy('compliance', 3, 'Default Device Compliance Policy', {
            state: 'nonCompliant',
            settings: [
              setting({
                settingName: 'Is active',
                state: 'nonCompliant',
                currentValue: 'false',
              }),
              setting({
                settingName: 'Enrolled user exists',
                state: 'compliant',
                currentValue: 'true',
              }),
            ],
          }),
          ...healthyCompliancePolicies(),
        ],
      },
      configurationPolicies: { status: 'ok', data: healthyConfigurationPolicies() },
      entraDevice: {
        status: 'ok',
        data: entraDevice(now, device, {
          approximateLastSignInDateTime: ago(now, { days: 43 }),
        }),
      },
      bitlockerKeys: { status: 'ok', data: [osVolumeKey(now, 33)] },
    };
  },
};
