/** CONTOSO-PC014 – BitLocker aus, Compliance-Richtlinie nonCompliant, keine Recovery-Keys. Erwartung: Compliance + BitLocker critical. */
import { de } from '../../../i18n/de';
import type { MockScenario } from '../types';
import {
  entraDevice,
  healthyConfigurationPolicies,
  healthyProtection,
  policy,
  setting,
  windowsDevice,
} from './helpers';

export const pc014Bitlocker: MockScenario = {
  deviceName: 'CONTOSO-PC014',
  label: de.demo.scenarios['CONTOSO-PC014'],
  build: (now) => {
    const device = windowsDevice(now, 14, {
      userPrincipalName: 'jonas.weber@contoso.com',
      userDisplayName: 'Jonas Weber',
      complianceState: 'noncompliant',
      isEncrypted: false,
    });
    return {
      device,
      protection: { status: 'ok', data: healthyProtection(now) },
      compliancePolicies: {
        status: 'ok',
        data: [
          policy('compliance', 1, 'Contoso – Windows 11 Basis-Compliance', {
            version: 4,
            settingCount: 6,
          }),
          policy('compliance', 2, 'Contoso – Defender & BitLocker', {
            version: 2,
            settingCount: 4,
            state: 'nonCompliant',
            settings: [
              setting({
                setting: 'Windows10CompliancePolicy.BitLockerEnabled',
                settingName: 'BitLockerEnabled',
                state: 'nonCompliant',
                currentValue: 'false',
                errorCode: 0,
              }),
              setting({
                settingName: 'DefenderEnabled',
                state: 'compliant',
                currentValue: 'true',
              }),
            ],
          }),
        ],
      },
      configurationPolicies: { status: 'ok', data: healthyConfigurationPolicies() },
      entraDevice: { status: 'ok', data: entraDevice(now, device) },
      bitlockerKeys: { status: 'ok', data: [] },
    };
  },
};
