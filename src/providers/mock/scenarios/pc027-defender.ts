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
  securityAlert,
  signInEntry,
  signInsInfo,
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
      signIns: {
        status: 'ok',
        data: signInsInfo(
          [
            signInEntry(now, 27, { hours: 4 }),
            signInEntry(now, 28, { days: 1, hours: 3 }, { deviceIsCompliant: false }),
          ],
          { totalForUser: 8 },
        ),
      },
      // M14/S4: offene Defender-Warnungen (fiktive Titel nach dem Muster der Defender-Alerts)
      securityAlerts: {
        status: 'ok',
        data: {
          alerts: [
            securityAlert(now, 27, 'Suspicious PowerShell command line', {
              severity: 'high',
              categories: ['Execution', 'DefenseEvasion'],
              deviceRiskScore: 'high',
              createdDateTime: ago(now, { hours: 3 }),
            }),
            securityAlert(now, 28, 'Suspicious execution of hidden file', {
              severity: 'low',
              status: 'inProgress',
              categories: ['DefenseEvasion'],
              createdDateTime: ago(now, { days: 2 }),
            }),
          ],
          resolvedCount: 1,
          evaluated: 57,
          moreAvailable: false,
        },
      },
    };
  },
};
