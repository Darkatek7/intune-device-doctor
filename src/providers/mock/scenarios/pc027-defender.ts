/** CONTOSO-PC027 – Defender-Warnungen: Signaturen veraltet, Neustart ausstehend, 1 Malware in Quarantäne. Erwartung: Defender critical/warning. */
import { de } from '../../../i18n/de';
import type { MockScenario } from '../types';
import {
  ago,
  entraDevice,
  healthyCompliancePolicies,
  healthyConfigurationPolicies,
  healthyProtection,
  osVolumeKey,
  windowsDevice,
} from './helpers';

export const pc027Defender: MockScenario = {
  deviceName: 'CONTOSO-PC027',
  label: de.demo.scenarios['CONTOSO-PC027'],
  build: (now) => {
    const device = windowsDevice(now, 27, {
      userPrincipalName: 'lena.fischer@contoso.com',
      userDisplayName: 'Lena Fischer',
    });
    return {
      device,
      protection: {
        status: 'ok',
        data: healthyProtection(now, {
          signatureUpdateOverdue: true,
          rebootRequired: true,
          deviceState: 'rebootPending',
          productStatus: ['avSignaturesOutOfDate', 'pendingRebootDueToThreatAction'],
          signatureVersion: '1.439.20.0',
          lastReportedDateTime: ago(now, { hours: 3 }),
          detectedMalware: [
            {
              id: 'demo-malware-1',
              displayName: 'Virus:DOS/EICAR_Test_File',
              severity: 'severe',
              state: 'quarantined',
              threatState: 'quarantined',
              category: 'virus',
              initialDetectionDateTime: ago(now, { days: 2 }),
              lastStateChangeDateTime: ago(now, { days: 2, hours: -1 }),
              detectionCount: 1,
              additionalInformationUrl: null,
            },
          ],
        }),
      },
      compliancePolicies: { status: 'ok', data: healthyCompliancePolicies() },
      configurationPolicies: { status: 'ok', data: healthyConfigurationPolicies() },
      entraDevice: { status: 'ok', data: entraDevice(now, device) },
      bitlockerKeys: { status: 'ok', data: [osVolumeKey(now, 27)] },
    };
  },
};
