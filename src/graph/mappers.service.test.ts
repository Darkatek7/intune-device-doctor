/** M18: Mapper für Dienststatus und Registrierungsfehler. */
import { describe, expect, it } from 'vitest';
import {
  DEVICE_ENROLLMENT_FAILURE_REASONS,
  SERVICE_HEALTH_STATUSES,
  type GraphServiceHealth,
  type GraphTroubleshootingEvent,
} from './dto';
import {
  mapEnrollmentFailure,
  mapEnrollmentFailures,
  mapServiceHealth,
  pickEnumLoose,
  serviceHealthKind,
} from './mappers';

describe('pickEnumLoose', () => {
  it('akzeptiert camelCase (Doku) und PascalCase (Beispielantworten) für jeden dokumentierten Status', () => {
    for (const value of SERVICE_HEALTH_STATUSES) {
      expect(pickEnumLoose(value, SERVICE_HEALTH_STATUSES)).toBe(value);
      const pascal = value.charAt(0).toUpperCase() + value.slice(1);
      expect(pickEnumLoose(pascal, SERVICE_HEALTH_STATUSES)).toBe(value);
    }
  });

  it('nicht dokumentierte oder leere Werte → null', () => {
    expect(pickEnumLoose('serviceOnFire', SERVICE_HEALTH_STATUSES)).toBeNull();
    expect(pickEnumLoose('SERVICEOPERATIONAL', SERVICE_HEALTH_STATUSES)).toBeNull();
    expect(pickEnumLoose('', SERVICE_HEALTH_STATUSES)).toBeNull();
    expect(pickEnumLoose(42, SERVICE_HEALTH_STATUSES)).toBeNull();
  });
});

describe('serviceHealthKind', () => {
  it('ordnet nur über den Namen zu (Intune, Entra), alles andere null', () => {
    expect(serviceHealthKind('Microsoft Intune', 'Intune')).toBe('intune');
    expect(serviceHealthKind('Microsoft Entra', 'x')).toBe('entra');
    expect(serviceHealthKind('Exchange Online', 'Exchange')).toBeNull();
    expect(serviceHealthKind('Identity Service', 'OrgLiveID')).toBeNull();
  });
});

describe('mapServiceHealth', () => {
  const dto: GraphServiceHealth[] = [
    { id: 'Exchange', service: 'Exchange Online', status: 'ServiceOperational' },
    {
      id: 'Intune',
      service: 'Microsoft Intune',
      status: 'ServiceInterruption',
      issues: [
        {
          id: 'A',
          title: '  Older  ',
          classification: 'Advisory',
          status: 'Investigating',
          isResolved: false,
          lastModifiedDateTime: '2026-11-10T08:00:00Z',
        },
        {
          id: 'B',
          title: 'Newer',
          classification: 'incident',
          status: 'somethingNew',
          isResolved: null,
          lastModifiedDateTime: '2026-11-10T10:00:00Z',
        },
        { id: 'C', title: 'Done', isResolved: true },
      ],
    },
    { id: '', service: 'kaputt' } as GraphServiceHealth,
  ];

  it('Intune zuerst; offene Einträge neueste zuerst; behobene nur gezählt; unbekannter Status bleibt als Rohwert', () => {
    const info = mapServiceHealth(dto, true);
    expect(info.truncated).toBe(true);
    expect(info.services.map((s) => s.id)).toEqual(['Intune', 'Exchange']);
    const intune = info.services[0]!;
    expect(intune.status).toBe('serviceInterruption');
    expect(intune.resolvedCount).toBe(1);
    expect(intune.openIssues.map((i) => i.id)).toEqual(['B', 'A']);
    expect(intune.openIssues[0]).toMatchObject({
      classification: 'incident',
      status: null,
      statusRaw: 'somethingNew',
    });
    expect(intune.openIssues[1]).toMatchObject({
      title: 'Older',
      classification: 'advisory',
      status: 'investigating',
    });
  });

  it('robust gegen fehlende Werte', () => {
    expect(mapServiceHealth(null, false)).toEqual({ services: [], truncated: false });
    const [only] = mapServiceHealth([{ id: 'X' }], false).services;
    expect(only).toMatchObject({ service: 'X', status: null, statusRaw: null, openIssues: [] });
  });
});

describe('mapEnrollmentFailures', () => {
  const base: GraphTroubleshootingEvent = {
    '@odata.type': '#microsoft.graph.enrollmentTroubleshootingEvent',
    id: '1',
    eventDateTime: '2026-11-10T10:00:00Z',
    userId: 'AAAA',
    enrollmentType: 'userEnrollment',
    failureCategory: 'userValidation',
    failureReason: 'UserNotLicensed',
  };

  it('übernimmt jede dokumentierte Kategorie, sonst null + Rohwert', () => {
    for (const category of DEVICE_ENROLLMENT_FAILURE_REASONS) {
      expect(mapEnrollmentFailure({ ...base, failureCategory: category })?.failureCategory).toBe(
        category,
      );
    }
    const unknown = mapEnrollmentFailure({ ...base, failureCategory: 'quantumFailure' })!;
    expect(unknown.failureCategory).toBeNull();
    expect(unknown.failureCategoryRaw).toBe('quantumFailure');
    const type = mapEnrollmentFailure({ ...base, enrollmentType: 'appleUserEnrollment' })!;
    expect(type.enrollmentType).toBeNull();
    expect(type.enrollmentTypeRaw).toBe('appleUserEnrollment');
  });

  it('verwirft Basistyp-Ereignisse; ohne @odata.type zählen nur Einträge mit Registrierungsfeldern', () => {
    expect(
      mapEnrollmentFailure({
        '@odata.type': '#microsoft.graph.deviceManagementTroubleshootingEvent',
        id: 'x',
      }),
    ).toBeNull();
    expect(mapEnrollmentFailure({ id: 'y', eventDateTime: '2026-11-10T10:00:00Z' })).toBeNull();
    expect(mapEnrollmentFailure({ id: 'z', failureCategory: 'authentication' })).not.toBeNull();
  });

  it('Null-GUID als userId → null; sortiert neueste zuerst; Filter ohne Groß-/Kleinschreibung', () => {
    const info = mapEnrollmentFailures(
      [
        { ...base, id: 'old', eventDateTime: '2026-11-01T00:00:00Z' },
        { ...base, id: 'new', eventDateTime: '2026-11-09T00:00:00Z', userId: 'aaaa' },
        { ...base, id: 'none', userId: '00000000-0000-0000-0000-000000000000' },
      ],
      { pagesRead: 2, truncated: false, filterUserId: 'AAAA' },
    );
    expect(info.events.map((e) => e.id)).toEqual(['new', 'old']);
    expect(info).toMatchObject({ pagesRead: 2, truncated: false, filteredUserId: 'AAAA' });
    const all = mapEnrollmentFailures(
      [{ ...base, userId: '00000000-0000-0000-0000-000000000000' }],
      {
        pagesRead: 1,
        truncated: false,
      },
    );
    expect(all.events[0]!.userId).toBeNull();
  });
});
