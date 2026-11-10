/** CONTOSO-LT108 – Windows 10 22H2 (veraltet), Entra-Objekt deaktiviert. Erwartung: OS warning, Gerätestatus critical.
 * M20/S4: „retire“ seit drei Tagen ausstehend → deutlicher Hinweis im Gerätestatus. */
import { de } from '../../../i18n/de';
import type { MockScenario } from '../types';
import {
  ago,
  autopilotInfo,
  entraDevice,
  healthyCompliancePolicies,
  healthyConfigurationPolicies,
  healthyProtection,
  osVolumeKey,
  windowsDevice,
} from './helpers';

export const lt108Win10: MockScenario = {
  deviceName: 'CONTOSO-LT108',
  label: de.demo.scenarios['CONTOSO-LT108'],
  build: (now) => {
    const device = windowsDevice(now, 108, {
      deviceName: 'CONTOSO-LT108',
      // fiktiver Rohwert (keine Werteliste dokumentiert)
      actionResults: [
        {
          actionName: 'retire',
          actionState: 'pending',
          actionStateRaw: 'pending',
          startDateTime: ago(now, { days: 3 }),
          lastUpdatedDateTime: ago(now, { days: 3 }),
        },
      ],
      osVersion: '10.0.19045.6456',
      model: 'Latitude 7420',
      manufacturer: 'Dell Inc.',
      enrolledDateTime: ago(now, { days: 1100 }),
      userPrincipalName: 'lukas.wagner@contoso.com',
      userDisplayName: 'Lukas Wagner',
    });
    return {
      device,
      protection: { status: 'ok', data: healthyProtection(now) },
      compliancePolicies: { status: 'ok', data: healthyCompliancePolicies() },
      configurationPolicies: { status: 'ok', data: healthyConfigurationPolicies() },
      entraDevice: {
        status: 'ok',
        data: entraDevice(now, device, {
          accountEnabled: false,
          approximateLastSignInDateTime: ago(now, { days: 9 }),
        }),
      },
      bitlockerKeys: { status: 'ok', data: [osVolumeKey(now, 108)] },
      // Autopilot-Registrierung fehlgeschlagen (Group Tag „Contoso-Vertrieb“)
      autopilot: {
        status: 'ok',
        data: autopilotInfo(now, {
          groupTag: 'Contoso-Vertrieb',
          enrollmentState: 'failed',
          lastContactedDateTime: ago(now, { days: 31 }),
          manufacturer: 'Dell Inc.',
          model: 'Latitude 7420',
          matchedBy: 'serialNumber',
        }),
      },
    };
  },
};
