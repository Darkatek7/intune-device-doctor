/**
 * Demo-Daten für M18 (fiktiv, Contoso): Dienststatus mit einem offenen Intune-Vorfall und
 * Registrierungsfehler verschiedener Kategorien. Zeitwerte relativ zu `now`.
 *
 * - Dienstnamen: „Microsoft Intune“/„Microsoft Entra“ sind die Produktnamen (der echte `service`-String ist
 *   Mandanten-Datum, siehe docs/graph-api-reference.md › „Live zu verifizieren (M18)“); „Exchange Online“
 *   und „Microsoft 365 suite“ stammen aus der Beispielantwort der Doku.
 * - Vorfall-IDs/-Texte sind erfunden (englisch wie im Original), `failureReason` nutzt Namen aus der
 *   Intune-Data-Warehouse-Referenz (enrollmentFailureReasons).
 * - Benutzer: demoGuid('user', 15) ist der Benutzer von CONTOSO-IP015 (ohne Intune-Lizenz, passend
 *   „userValidation“), demoGuid('user', 42) der von CONTOSO-PC042; die übrigen Benutzer haben kein Demo-Gerät.
 */
import type {
  EnrollmentFailureEvent,
  EnrollmentFailuresInfo,
  ServiceHealthInfo,
} from '../../domain/types';
import { ago, demoGuid } from './scenarios/helpers';

export function defaultServiceHealth(now: Date): ServiceHealthInfo {
  return {
    truncated: false,
    services: [
      {
        id: 'Intune',
        service: 'Microsoft Intune',
        kind: 'intune',
        status: 'serviceDegradation',
        statusRaw: 'serviceDegradation',
        resolvedCount: 3,
        openIssues: [
          {
            id: 'IT900001',
            title: 'Some users may be unable to enroll new Windows devices in Microsoft Intune',
            classification: 'incident',
            status: 'serviceDegradation',
            statusRaw: 'serviceDegradation',
            startDateTime: ago(now, { hours: 3 }),
            lastModifiedDateTime: ago(now, { minutes: 25 }),
            feature: 'Device enrollment',
            featureGroup: 'Microsoft Intune',
            impactDescription:
              'Users attempting to enroll Windows devices may receive an error and be unable to complete enrollment.',
          },
          {
            id: 'IT900002',
            title: 'Admins may see delayed reporting data in the Microsoft Intune admin center',
            classification: 'advisory',
            status: 'investigating',
            statusRaw: 'investigating',
            startDateTime: ago(now, { days: 1, hours: 2 }),
            lastModifiedDateTime: ago(now, { hours: 5 }),
            feature: 'Reporting',
            featureGroup: 'Microsoft Intune',
            impactDescription:
              'Admins may notice that some reports in the Microsoft Intune admin center show data that is up to several hours old.',
          },
        ],
      },
      {
        id: 'Entra',
        service: 'Microsoft Entra',
        kind: 'entra',
        status: 'serviceOperational',
        statusRaw: 'serviceOperational',
        resolvedCount: 1,
        openIssues: [],
      },
      {
        id: 'Exchange',
        service: 'Exchange Online',
        kind: null,
        status: 'serviceOperational',
        statusRaw: 'ServiceOperational',
        resolvedCount: 2,
        openIssues: [],
      },
      {
        id: 'OSDPPlatform',
        service: 'Microsoft 365 suite',
        kind: null,
        status: 'serviceOperational',
        statusRaw: 'ServiceOperational',
        resolvedCount: 0,
        openIssues: [],
      },
    ],
  };
}

/** Zustand „alles in Ordnung“ (Tests, E2E): alle Dienste betriebsbereit, keine offenen Einträge. */
export function healthyServiceHealth(now: Date): ServiceHealthInfo {
  const info = defaultServiceHealth(now);
  return {
    ...info,
    services: info.services.map((service) => ({
      ...service,
      status: 'serviceOperational',
      statusRaw: 'serviceOperational',
      openIssues: [],
    })),
  };
}

function event(
  now: Date,
  n: number,
  hoursAgo: number,
  fields: Partial<EnrollmentFailureEvent>,
): EnrollmentFailureEvent {
  return {
    id: `00000000-0000-4000-f000-${n.toString(16).padStart(12, '0')}`,
    eventDateTime: ago(now, { hours: hoursAgo }),
    correlationId: `00000000-0000-4000-f100-${n.toString(16).padStart(12, '0')}`,
    operatingSystem: 'Windows',
    osVersion: '10.0.26100.4061',
    userId: demoGuid('user', 200 + n),
    enrollmentType: 'windowsAzureADJoin',
    enrollmentTypeRaw: 'windowsAzureADJoin',
    failureCategory: 'unknown',
    failureCategoryRaw: 'unknown',
    failureReason: null,
    ...fields,
  };
}

const category = <T extends EnrollmentFailureEvent['failureCategory']>(value: T) => ({
  failureCategory: value,
  failureCategoryRaw: value,
});

/** Registrierungsfehler des Demo-Mandanten, neueste zuerst. */
export function defaultEnrollmentFailures(now: Date): EnrollmentFailuresInfo {
  const events: EnrollmentFailureEvent[] = [
    event(now, 1, 1, {
      ...category('authentication'),
      failureReason: 'AuthenticationRequirementNotMet',
    }),
    event(now, 2, 4, {
      userId: demoGuid('user', 15),
      operatingSystem: 'iOS',
      osVersion: '18.6.2',
      enrollmentType: 'userEnrollment',
      enrollmentTypeRaw: 'userEnrollment',
      ...category('userValidation'),
      failureReason: 'UserNotLicensed',
    }),
    event(now, 3, 9, {
      userId: demoGuid('user', 42),
      operatingSystem: 'Android',
      osVersion: '15',
      enrollmentType: 'userEnrollment',
      enrollmentTypeRaw: 'userEnrollment',
      ...category('enrollmentRestrictionsEnforced'),
      failureReason: 'EnrollmentCriteriaNotMet',
    }),
    event(now, 4, 26, {
      userId: demoGuid('user', 15),
      operatingSystem: 'iOS',
      osVersion: '18.6.2',
      enrollmentType: 'userEnrollment',
      enrollmentTypeRaw: 'userEnrollment',
      ...category('userValidation'),
      failureReason: 'UserNotLicensed',
    }),
    event(now, 5, 30, {
      ...category('enrollmentRestrictionsEnforced'),
      enrollmentType: 'windowsAutoEnrollment',
      enrollmentTypeRaw: 'windowsAutoEnrollment',
      failureReason: 'DeviceCap',
    }),
    event(now, 6, 50, {
      operatingSystem: 'macOS',
      osVersion: '15.5',
      enrollmentType: 'userEnrollment',
      enrollmentTypeRaw: 'userEnrollment',
      ...category('userAbandonment'),
      failureReason: 'UserAbandonment',
    }),
    event(now, 7, 75, {
      ...category('clientDisconnected'),
    }),
  ];
  return { events, pagesRead: 1, truncated: false, filteredUserId: null };
}
