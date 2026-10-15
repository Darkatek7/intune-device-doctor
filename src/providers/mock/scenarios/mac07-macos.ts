/** CONTOSO-MAC07 – macOS mit FileVault, Defender und BitLocker nicht anwendbar. Erwartung: ok, Defender nicht anwendbar. */
import { de } from '../../../i18n/de';
import type { MockScenario } from '../types';
import { entraDevice, policy, windowsDevice } from './helpers';

export const mac07Macos: MockScenario = {
  deviceName: 'CONTOSO-MAC07',
  label: de.demo.scenarios['CONTOSO-MAC07'],
  build: (now) => {
    const device = windowsDevice(now, 7, {
      deviceName: 'CONTOSO-MAC07',
      osFamily: 'macos',
      operatingSystem: 'macOS',
      osVersion: '15.6.1',
      model: 'MacBook Pro (14-inch, M3, 2023)',
      manufacturer: 'Apple',
      serialNumber: 'DEMO-MAC0007',
      deviceEnrollmentType: 'appleBulkWithUser',
      isEncrypted: true,
      jailBroken: 'False',
      userPrincipalName: 'felix.neumann@contoso.com',
      userDisplayName: 'Felix Neumann',
    });
    return {
      device,
      protection: { status: 'notApplicable', reason: de.reasons.defenderNotWindows },
      compliancePolicies: {
        status: 'ok',
        data: [
          policy('compliance', 31, 'Contoso – macOS Compliance', {
            platformType: 'macOS',
            settingCount: 3,
          }),
        ],
      },
      configurationPolicies: {
        status: 'ok',
        data: [
          policy('configuration', 32, 'Contoso – macOS FileVault', {
            platformType: 'macOS',
            settingCount: 4,
          }),
          policy('configuration', 33, 'Contoso – macOS WLAN', {
            platformType: 'macOS',
            settingCount: 2,
          }),
        ],
      },
      entraDevice: { status: 'ok', data: entraDevice(now, device, { trustType: 'Workplace' }) },
      bitlockerKeys: { status: 'notApplicable', reason: de.reasons.bitlockerNotWindows },
    };
  },
};
