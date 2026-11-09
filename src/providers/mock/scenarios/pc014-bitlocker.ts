/** CONTOSO-PC014 – BitLocker aus, Compliance-Richtlinie nonCompliant, keine Recovery-Keys. Erwartung: Compliance + BitLocker critical. Zusätzlich (M14/S1): hybrid joined + registriertes Entra-Objekt gleichen Namens → „Dual State“ (Warnung im Gerätestatus). */
import { de } from '../../../i18n/de';
import type { MockScenario } from '../types';
import {
  ago,
  entraDevice,
  healthyConfigurationPolicies,
  healthAttestationInfo,
  healthyProtection,
  policy,
  sameNameDevice,
  setting,
  windowsDevice,
  signInEntry,
  signInsInfo,
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
      // Hybrid Join mit automatischer Registrierung (Gruppenrichtlinie)
      deviceEnrollmentType: 'windowsAutoEnrollment',
    });
    const entra = entraDevice(now, device, { trustType: 'ServerAd' });
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
      entraDevice: { status: 'ok', data: entra },
      duplicateDevices: {
        status: 'ok',
        data: {
          moreAvailable: false,
          devices: [
            sameNameDevice(now, 14, {
              objectId: entra.objectId,
              deviceId: device.azureADDeviceId,
              trustType: 'ServerAd',
              isCompliant: false,
              isCurrent: true,
            }),
            // Registrierter Zustand (z. B. „Konto zu Windows hinzufügen“), älter und ohne Verwaltung
            sameNameDevice(now, 1014, {
              deviceId: '00000000-0000-4000-9000-000000001014',
              trustType: 'Workplace',
              approximateLastSignInDateTime: ago(now, { days: 38 }),
              isCompliant: null,
              isManaged: false,
              registrationDateTime: ago(now, { days: 400 }),
            }),
          ],
        },
      },
      bitlockerKeys: { status: 'ok', data: [] },
      healthAttestation: {
        status: 'ok',
        data: healthAttestationInfo(now, {
          bitLockerStatus: 'disabled',
          healthStatusMismatchInfo: 'Demo: Integritätsabweichung gemeldet (fiktiver Wert)',
        }),
      },
      signIns: {
        status: 'ok',
        data: signInsInfo(
          [
            signInEntry(
              now,
              14,
              { hours: 26 },
              {
                appDisplayName: 'Microsoft Teams',
                resourceDisplayName: 'Microsoft Teams Services',
                clientAppUsed: 'Mobile Apps and Desktop clients',
                conditionalAccessStatus: 'failure',
                errorCode: 53000,
                failureReason: 'Access has been blocked due to conditional access policies.',
                deviceIsCompliant: false,
                appliedPolicies: null,
              },
            ),
            signInEntry(now, 15, { days: 3 }, { deviceIsCompliant: false, appliedPolicies: null }),
          ],
          { totalForUser: 11 },
        ),
      },
    };
  },
};
