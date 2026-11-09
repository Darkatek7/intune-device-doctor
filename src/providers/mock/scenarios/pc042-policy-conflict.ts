/** CONTOSO-PC042 – Konfigurationskonflikt (SmartScreen), Profil mit errorCode, Compliance in Schonfrist. Erwartung: Richtlinien critical, Compliance warning, Apps critical (VPN-Client fehlgeschlagen). */
import { de } from '../../../i18n/de';
import type { MockScenario } from '../types';
import {
  appState,
  demoGuid,
  entraDevice,
  healthyConfigurationPolicies,
  healthyProtection,
  inFuture,
  osVolumeKey,
  policy,
  setting,
  windowsDevice,
  caPolicy,
  signInEntry,
  signInsInfo,
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
      signIns: {
        status: 'ok',
        data: signInsInfo(
          [
            signInEntry(
              now,
              42,
              { hours: 3 },
              {
                appDisplayName: 'Microsoft Teams',
                resourceDisplayName: 'Microsoft Teams Services',
                clientAppUsed: 'Mobile Apps and Desktop clients',
                conditionalAccessStatus: 'failure',
                errorCode: 53000,
                failureReason: 'Device is not compliant.',
                deviceIsCompliant: false,
                appliedPolicies: [
                  caPolicy('Contoso – Kompatibles Gerät erforderlich', 'failure', [
                    'Require device to be marked as compliant',
                  ]),
                  caPolicy('Contoso – MFA für alle Benutzer', 'success', [
                    'Require multifactor authentication',
                  ]),
                ],
              },
            ),
            signInEntry(
              now,
              43,
              { hours: 20 },
              {
                appDisplayName: 'Microsoft Teams',
                resourceDisplayName: 'Microsoft Teams Services',
                clientAppUsed: 'Mobile Apps and Desktop clients',
                conditionalAccessStatus: 'failure',
                errorCode: 53000,
                failureReason: 'Device is not compliant.',
                deviceIsCompliant: false,
                appliedPolicies: [
                  caPolicy('Contoso – Kompatibles Gerät erforderlich', 'failure', [
                    'Require device to be marked as compliant',
                  ]),
                ],
              },
            ),
            signInEntry(now, 44, { days: 2 }, { deviceIsCompliant: false }),
          ],
          { totalForUser: 17 },
        ),
      },
      // Passend zum Beispiel-ZIP: VPN-Client fehlgeschlagen, Zeiterfassung installiert
      appInstallStates: {
        status: 'ok',
        data: [
          appState('00000000-0000-0000-0000-0000000000A1', 'Contoso Zeiterfassung 3.4', {
            version: '3.4.0',
          }),
          appState('00000000-0000-0000-0000-0000000000A2', 'Contoso VPN Client 5.1', {
            version: '5.1.2',
            installState: 'failed',
          }),
          appState('00000000-0000-0000-0000-0000000000A4', 'Fabrikam PDF Studio 12', {
            intent: 'available',
            installState: 'notInstalled',
          }),
        ],
      },
    };
  },
};
