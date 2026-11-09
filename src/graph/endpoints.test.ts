import { describe, expect, it } from 'vitest';
import { Endpoints, SIGN_IN_PAGE_SIZE } from './endpoints';
import { GraphScope, LOGIN_SCOPES, OPTIONAL_SCOPES } from './scopes';

describe('Endpunkte – Anmeldeprotokoll', () => {
  const url = new URL(
    `https://graph.microsoft.com/v1.0${Endpoints.signIns.path('user-1', '2026-10-08T12:00:00Z')}`,
  );

  it('filtert auf userId und createdDateTime (beides laut Doku filterbar), erste Seite mit $top', () => {
    expect(url.pathname).toBe('/v1.0/auditLogs/signIns');
    expect(url.searchParams.get('$filter')).toBe(
      "userId eq 'user-1' and createdDateTime ge 2026-10-08T12:00:00Z",
    );
    expect(url.searchParams.get('$top')).toBe(String(SIGN_IN_PAGE_SIZE));
  });

  it('nutzt weder $select (nicht dokumentiert) noch einen Filter auf deviceDetail', () => {
    expect([...url.searchParams.keys()].sort()).toEqual(['$filter', '$top']);
    expect(url.searchParams.get('$filter')).not.toMatch(/deviceDetail/i);
  });

  it('escaped Hochkommas in der Benutzer-ID', () => {
    const escaped = Endpoints.signIns.path("a'b", '2026-10-08T12:00:00Z');
    expect(decodeURIComponent(escaped)).toContain("userId eq 'a''b'");
  });

  it('braucht den optionalen Scope AuditLog.Read.All, der beim Login nicht angefragt wird', () => {
    expect(Endpoints.signIns.scope).toBe(GraphScope.AuditLogRead);
    expect(GraphScope.AuditLogRead).toBe('AuditLog.Read.All');
    expect(OPTIONAL_SCOPES).toContain(GraphScope.AuditLogRead);
    expect(LOGIN_SCOPES).not.toContain(GraphScope.AuditLogRead);
    expect(Endpoints.signIns.method).toBe('GET');
    expect(Endpoints.signIns.version).toBe('v1.0');
    expect(Endpoints.signIns.docsUrl).toMatch(/^https:\/\/learn\.microsoft\.com\//);
  });
});

describe('Endpunkte – Integritätsnachweis', () => {
  const id = '00000000-0000-4000-9000-000000000001';
  const def = Endpoints.managedDeviceHealthAttestation;
  const url = new URL(`https://graph.microsoft.com/v1.0${def.path(id)}`);

  it('ist ein v1.0-GET auf die Einzelressource mit $select=deviceHealthAttestationState', () => {
    expect(def.method).toBe('GET');
    expect(def.version).toBe('v1.0');
    expect(url.pathname).toBe(`/v1.0/deviceManagement/managedDevices/${id}`);
    expect(url.searchParams.get('$select')).toBe('deviceHealthAttestationState');
    expect(def.docsUrl).toMatch(/^https:\/\/learn\.microsoft\.com\//);
  });

  it('braucht keinen zusätzlichen Scope (bereits beim Login angefragt)', () => {
    expect(def.scope).toBe('DeviceManagementManagedDevices.Read.All');
    expect(LOGIN_SCOPES).toContain(def.scope);
    expect(OPTIONAL_SCOPES).not.toContain(def.scope);
  });
});

describe('Endpunkte – Windows LAPS', () => {
  const id = '00000000-0000-4000-9000-000000000001';
  const url = new URL(
    `https://graph.microsoft.com/v1.0${Endpoints.deviceLocalCredentialInfo.path(id)}`,
  );

  it('fordert nie die Eigenschaft credentials (Kennwort) an', () => {
    expect(url.pathname).toBe(`/v1.0/directory/deviceLocalCredentials/${id}`);
    const select = url.searchParams.get('$select') ?? '';
    expect(select).toBe('id,deviceName,lastBackupDateTime,refreshDateTime');
    expect(select.split(',')).not.toContain('credentials');
    expect(url.search.toLowerCase()).not.toContain('credentials');
  });

  it('braucht den optionalen Scope DeviceLocalCredential.ReadBasic.All (nicht …Read.All)', () => {
    const scope = Endpoints.deviceLocalCredentialInfo.scope;
    expect(scope).toBe('DeviceLocalCredential.ReadBasic.All');
    expect(OPTIONAL_SCOPES).toContain(scope);
    expect(LOGIN_SCOPES).not.toContain(scope);
    expect(LOGIN_SCOPES).not.toContain('DeviceLocalCredential.Read.All');
    expect(Endpoints.deviceLocalCredentialInfo.method).toBe('GET');
    expect(Endpoints.deviceLocalCredentialInfo.docsUrl).toMatch(
      /^https:\/\/learn\.microsoft\.com\//,
    );
  });
});

describe('Endpunkte – gleichnamige Entra-Objekte (M14/S1)', () => {
  const def = Endpoints.entraDevicesByName;
  const url = new URL(`https://graph.microsoft.com/v1.0${def.path("CONTOSO-PC'014")}`);

  it('ist ein v1.0-GET auf /devices mit eq-Filter auf displayName (Standard-Query) und minimalem $select', () => {
    expect(def.method).toBe('GET');
    expect(def.version).toBe('v1.0');
    expect(url.pathname).toBe('/v1.0/devices');
    expect(url.searchParams.get('$filter')).toBe("displayName eq 'CONTOSO-PC''014'");
    expect([...url.searchParams.keys()].sort()).toEqual(['$filter', '$select']);
    expect(url.searchParams.get('$select')?.split(',')).toEqual([
      'id',
      'deviceId',
      'displayName',
      'trustType',
      'accountEnabled',
      'approximateLastSignInDateTime',
      'isCompliant',
      'isManaged',
      'registrationDateTime',
      'profileType',
      'operatingSystem',
    ]);
  });

  it('fordert weder physicalIds noch deviceMetadata an und filtert nicht auf registrationDateTime (Advanced Query)', () => {
    const query = decodeURIComponent(url.search).toLowerCase();
    expect(query).not.toContain('physicalids');
    expect(query).not.toContain('devicemetadata');
    expect(url.searchParams.get('$filter')).not.toMatch(/registrationDateTime/i);
  });

  it('braucht Device.Read.All (bereits beim Login angefragt) und hat einen Learn-Link', () => {
    expect(def.scope).toBe('Device.Read.All');
    expect(LOGIN_SCOPES).toContain(def.scope);
    expect(def.docsUrl).toMatch(/^https:\/\/learn\.microsoft\.com\//);
  });
});

describe('Endpoints – Zuweisungen (M14/S2)', () => {
  const id = '00000000-0000-4000-b000-000000000015';
  const cases = [
    [
      'deviceConfigurationAssignments',
      `/v1.0/deviceManagement/deviceConfigurations/${id}/assignments`,
    ],
    [
      'deviceCompliancePolicyAssignments',
      `/v1.0/deviceManagement/deviceCompliancePolicies/${id}/assignments`,
    ],
    ['mobileAppAssignments', `/v1.0/deviceAppManagement/mobileApps/${id}/assignments`],
  ] as const;

  it.each(cases)(
    '%s: v1.0-GET ohne Query-Optionen (kein $expand), Scope Configuration.Read',
    (key, path) => {
      const def = Endpoints[key];
      expect(def.method).toBe('GET');
      expect(def.version).toBe('v1.0');
      expect(`/v1.0${def.path(id)}`).toBe(path);
      expect(def.path(id)).not.toContain('?');
      expect(def.path(id)).not.toContain('$expand');
      expect(def.scope).toBe('DeviceManagementConfiguration.Read.All');
      expect(LOGIN_SCOPES).toContain(def.scope);
      expect(def.docsUrl).toMatch(/^https:\/\/learn\.microsoft\.com\//);
    },
  );

  it('kodiert die ID im Pfad', () => {
    expect(Endpoints.mobileAppAssignments.path('a/b')).toBe(
      '/deviceAppManagement/mobileApps/a%2Fb/assignments',
    );
  });
});

describe('Endpunkte – Registrierung: Lizenz und Gerätelimit (M14/S3)', () => {
  it('licenseDetails: v1.0-GET /users/{id}/licenseDetails mit minimalem $select, optionaler Scope LicenseAssignment.Read.All', () => {
    const def = Endpoints.userLicenseDetails;
    const url = new URL(`https://graph.microsoft.com/v1.0${def.path('user-1')}`);
    expect(def.method).toBe('GET');
    expect(def.version).toBe('v1.0');
    expect(url.pathname).toBe('/v1.0/users/user-1/licenseDetails');
    expect(url.searchParams.get('$select')).toBe('id,skuId,skuPartNumber,servicePlans');
    expect([...url.searchParams.keys()]).toEqual(['$select']);
    expect(def.scope).toBe('LicenseAssignment.Read.All');
    expect(OPTIONAL_SCOPES).toContain(def.scope);
    expect(LOGIN_SCOPES).not.toContain(def.scope);
    expect(def.docsUrl).toMatch(/^https:\/\/learn\.microsoft\.com\//);
  });

  it('Registrierungskonfigurationen und deren Zuweisungen: ohne Query (kein $filter/$expand), Scope ServiceConfig.Read (optional)', () => {
    const list = Endpoints.deviceEnrollmentConfigurations;
    const assignments = Endpoints.deviceEnrollmentConfigurationAssignments;
    expect(list.path()).toBe('/deviceManagement/deviceEnrollmentConfigurations');
    expect(assignments.path('cfg-1')).toBe(
      '/deviceManagement/deviceEnrollmentConfigurations/cfg-1/assignments',
    );
    for (const def of [list, assignments]) {
      expect(def.method).toBe('GET');
      expect(def.version).toBe('v1.0');
      expect(def.path('x')).not.toContain('?');
      expect(def.scope).toBe('DeviceManagementServiceConfig.Read.All');
      expect(OPTIONAL_SCOPES).toContain(def.scope);
      expect(def.docsUrl).toMatch(/^https:\/\/learn\.microsoft\.com\//);
    }
  });

  it('beide neuen Scopes sind optional und nicht im Login enthalten', () => {
    for (const scope of ['LicenseAssignment.Read.All', 'SecurityAlert.Read.All'] as const) {
      expect(OPTIONAL_SCOPES).toContain(scope);
      expect(LOGIN_SCOPES).not.toContain(scope);
    }
  });
});

describe('Endpunkte – Sicherheitswarnungen (M14/S4)', () => {
  it('securityAlerts: v1.0-GET /security/alerts_v2 nur mit dokumentierten Parametern ($filter auf serviceSource, $top), optionaler Scope SecurityAlert.Read.All', () => {
    const def = Endpoints.securityAlerts;
    const url = new URL(`https://graph.microsoft.com/v1.0${def.path()}`);
    expect(def.method).toBe('GET');
    expect(def.version).toBe('v1.0');
    expect(url.pathname).toBe('/v1.0/security/alerts_v2');
    expect(url.searchParams.get('$filter')).toBe("serviceSource eq 'microsoftDefenderForEndpoint'");
    expect(url.searchParams.get('$top')).toBe('100');
    // laut Doku nur $count, $filter, $skip, $top → kein $select/$orderby/$expand
    expect([...url.searchParams.keys()].sort()).toEqual(['$filter', '$top']);
    expect(def.scope).toBe('SecurityAlert.Read.All');
    expect(OPTIONAL_SCOPES).toContain(def.scope);
    expect(LOGIN_SCOPES).not.toContain(def.scope);
    expect(def.docsUrl).toMatch(/^https:\/\/learn\.microsoft\.com\//);
  });
});

describe('Endpunkte – Mandanten-Status (M14/S5)', () => {
  it('vppTokens: v1.0-GET /deviceAppManagement/vppTokens ohne Query (kein $select dokumentiert), optionaler Scope ServiceConfig.Read', () => {
    const def = Endpoints.vppTokens;
    expect(def.method).toBe('GET');
    expect(def.version).toBe('v1.0');
    expect(def.path()).toBe('/deviceAppManagement/vppTokens');
    expect(def.scope).toBe('DeviceManagementServiceConfig.Read.All');
    expect(OPTIONAL_SCOPES).toContain(def.scope);
    expect(def.docsUrl).toMatch(/^https:\/\/learn\.microsoft\.com\//);
  });
});
