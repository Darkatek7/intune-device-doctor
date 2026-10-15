/** CONTOSO-PC042 – Konfigurationskonflikt (SmartScreen), Profil mit errorCode, Compliance in Schonfrist. Erwartung: Richtlinien critical, Compliance warning. */
import { de } from '../../../i18n/de';
import type { MockScenario } from '../types';
import {
  demoGuid,
  entraDevice,
  healthyConfigurationPolicies,
  healthyProtection,
  inFuture,
  osVolumeKey,
  policy,
  setting,
  windowsDevice,
} from './helpers';

export const pc042PolicyConflict: MockScenario = {
  deviceName: 'CONTOSO-PC042',
  label: de.demo.scenarios['CONTOSO-PC042'],
  build: (now) => {
    const device = windowsDevice(now, 42, {
      userPrincipalName: 'sophie.hartmann@contoso.com',
      userDisplayName: 'Sophie Hartmann',
      osVersion: '10.0.22631.4317',
      complianceState: 'inGracePeriod',
      complianceGracePeriodExpirationDateTime: inFuture(now, { days: 2 }),
    });
    return {
      device,
      protection: { status: 'ok', data: healthyProtection(now) },
      compliancePolicies: {
        status: 'ok',
        data: [
          policy('compliance', 1, 'Contoso – Windows 11 Basis-Compliance', {
            state: 'nonCompliant',
            settings: [
              setting({
                settingName: 'OsMinimumVersion',
                state: 'nonCompliant',
                currentValue: '10.0.22631.4317',
              }),
            ],
          }),
          policy('compliance', 2, 'Contoso – Defender & BitLocker'),
        ],
      },
      configurationPolicies: {
        status: 'ok',
        data: [
          policy('configuration', 21, 'Contoso – Edge Sicherheitsbaseline', {
            state: 'conflict',
            settings: [
              setting({
                settingName: 'SmartScreenEnabled',
                state: 'conflict',
                currentValue: null,
                sources: [
                  {
                    id: demoGuid('policy', 21),
                    displayName: 'Contoso – Edge Sicherheitsbaseline',
                  },
                  { id: demoGuid('policy', 22), displayName: 'Contoso – Edge Pilot' },
                ],
              }),
            ],
          }),
          policy('configuration', 23, 'Contoso – VPN Always On', {
            state: 'error',
            settings: [
              setting({
                settingName: 'AlwaysOn',
                state: 'error',
                errorCode: -2016281112,
                errorDescription: 'Remediation failed',
                currentValue: null,
              }),
            ],
          }),
          ...healthyConfigurationPolicies(),
        ],
      },
      entraDevice: { status: 'ok', data: entraDevice(now, device) },
      bitlockerKeys: { status: 'ok', data: [osVolumeKey(now, 42)] },
    };
  },
};
