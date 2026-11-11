/**
 * CONTOSO-IP015 – iPhone 15 (iOS 18.6.2), Apple User Enrollment, nicht beaufsichtigt.
 * MDM-Zertifikat läuft in 12 Tagen ab, das Apple-MDM-Push-Zertifikat des Mandanten in 20 Tagen. Erwartung: Gerätestatus warning (Zertifikat; der Hinweis
 * „nicht beaufsichtigt“ ist unknown und zieht die Kachel nicht hoch), Defender und Betriebssystem unknown.
 * App-Schutz (M20/S3) warning: Teams seit 45 Tagen nicht synchronisiert, Zuordnung nur über den Benutzer.
 */
import { de } from '../../../i18n/de';
import { ip015AppProtection } from '../fleet';
import type { MockScenario } from '../types';
import { appState, entraDevice, inFuture, policy, userLicenseInfo, windowsDevice } from './helpers';

const GB = 1024 ** 3;

export const ip015Ios: MockScenario = {
  deviceName: 'CONTOSO-IP015',
  label: de.demo.scenarios['CONTOSO-IP015'],
  build: (now) => {
    const device = windowsDevice(now, 15, {
      deviceName: 'CONTOSO-IP015',
      osFamily: 'ios',
      operatingSystem: 'iOS',
      osVersion: '18.6.2',
      model: 'iPhone 15',
      manufacturer: 'Apple',
      serialNumber: 'DEMO-IP0015',
      deviceEnrollmentType: 'appleUserEnrollment',
      isEncrypted: true,
      jailBroken: 'False',
      userPrincipalName: 'jonas.weber@contoso.com',
      userDisplayName: 'Jonas Weber',
      managementCertificateExpirationDate: inFuture(now, { days: 12 }),
      isSupervised: false,
      enrollmentProfileName: null,
      freeStorageSpaceInBytes: 41 * GB,
      totalStorageSpaceInBytes: 128 * GB,
    });
    return {
      device,
      // M20/S3: generischer Gerätename (iOS 16+) → nur über den Benutzer zugeordnet, Teams veraltet
      appProtection: { status: 'ok', data: ip015AppProtection(now) },
      // M14/S3: nur „Mobile Device Management for Office 365“, noch nicht aktiviert → keine Intune-Lizenz
      userLicense: {
        status: 'ok',
        data: userLicenseInfo([
          {
            plan: 'INTUNE_O365',
            skuPartNumber: 'O365_BUSINESS_PREMIUM',
            provisioningStatus: 'PendingActivation',
          },
        ]),
      },
      protection: { status: 'notApplicable', reason: de.reasons.defenderNotWindows },
      compliancePolicies: {
        status: 'ok',
        data: [
          policy('compliance', 61, 'Contoso – iOS Compliance', {
            platformType: 'iOS',
            settingCount: 3,
          }),
        ],
      },
      configurationPolicies: {
        status: 'ok',
        data: [
          policy('configuration', 62, 'Contoso – iOS WLAN', {
            platformType: 'iOS',
            settingCount: 2,
          }),
          policy('configuration', 63, 'Contoso – iOS Passcode', {
            platformType: 'iOS',
            settingCount: 2,
          }),
        ],
      },
      entraDevice: { status: 'ok', data: entraDevice(now, device, { trustType: 'Workplace' }) },
      applePushCertificate: {
        status: 'ok',
        data: {
          expirationDateTime: inFuture(now, { days: 20 }),
          lastModifiedDateTime: inFuture(now, { days: -345 }),
        },
      },
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
