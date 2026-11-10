/**
 * CONTOSO-AND21 – Pixel 8 (Android 15), Android Enterprise vollständig verwaltet.
 * Sicherheitspatch ca. 200 Tage alt (relativ zu now). Erwartung: Betriebssystem warning (Patch alt),
 * Defender nicht anwendbar (unknown), Gerätestatus ok. App-Schutz (M20/S3) critical: Outlook mit
 * „rootedDevice“ markiert (über den Gerätenamen zugeordnet).
 */
import { de } from '../../../i18n/de';
import { and21AppProtection } from '../fleet';
import type { MockScenario } from '../types';
import {
  ago,
  appState,
  enrollmentLimit,
  entraDevice,
  inFuture,
  policy,
  windowsDevice,
} from './helpers';

const GB = 1024 ** 3;

export const and21Android: MockScenario = {
  deviceName: 'CONTOSO-AND21',
  label: de.demo.scenarios['CONTOSO-AND21'],
  build: (now) => {
    const device = windowsDevice(now, 21, {
      deviceName: 'CONTOSO-AND21',
      osFamily: 'android',
      operatingSystem: 'Android',
      osVersion: '15',
      model: 'Pixel 8',
      manufacturer: 'Google',
      serialNumber: 'DEMO-AND0021',
      // Kein Android-spezifischer Wert in DeviceEnrollmentType → 'unknown' (nicht raten)
      deviceEnrollmentType: 'unknown',
      isEncrypted: true,
      userPrincipalName: 'lea.fischer@contoso.com',
      userDisplayName: 'Lea Fischer',
      managementCertificateExpirationDate: inFuture(now, { days: 365 }),
      androidSecurityPatchLevel: ago(now, { days: 200 }).slice(0, 10),
      isSupervised: null,
      enrollmentProfileName: 'Contoso – Android Enterprise vollständig verwaltet',
      freeStorageSpaceInBytes: 64 * GB,
      totalStorageSpaceInBytes: 128 * GB,
    });
    return {
      device,
      // M20/S3: Outlook mit rootedDevice markiert
      appProtection: { status: 'ok', data: and21AppProtection(now) },
      // M14/S3: Gerätelimit von 1 Gerät für diese Benutzergruppe – das Gerät erreicht es bereits
      enrollmentLimits: {
        status: 'ok',
        data: {
          omitted: 0,
          limits: [
            enrollmentLimit(1, 'Contoso – Externe Mitarbeitende', {
              limit: 1,
              targets: [{ kind: 'group', groupId: '00000000-0000-4000-a000-000000000311' }],
            }),
            enrollmentLimit(2, 'Contoso – Standard', { limit: 5 }),
          ],
        },
      },
      protection: { status: 'notApplicable', reason: de.reasons.defenderNotWindows },
      compliancePolicies: {
        status: 'ok',
        data: [
          policy('compliance', 71, 'Contoso – Android Enterprise Compliance', {
            platformType: 'androidForWork',
            settingCount: 3,
          }),
        ],
      },
      configurationPolicies: {
        status: 'ok',
        data: [
          policy('configuration', 72, 'Contoso – Android Enterprise WLAN', {
            platformType: 'androidForWork',
            settingCount: 2,
          }),
          policy('configuration', 73, 'Contoso – Android Enterprise Passcode', {
            platformType: 'androidForWork',
            settingCount: 2,
          }),
        ],
      },
      entraDevice: { status: 'ok', data: entraDevice(now, device, { trustType: 'Workplace' }) },
      bitlockerKeys: { status: 'notApplicable', reason: de.reasons.bitlockerNotWindows },
      appInstallStates: {
        status: 'ok',
        data: [
          appState('00000000-0000-0000-0000-0000000000A1', 'Contoso Zeiterfassung 3.4'),
          appState('00000000-0000-0000-0000-0000000000A2', 'Contoso VPN Client 5.1'),
        ],
      },
    };
  },
};
