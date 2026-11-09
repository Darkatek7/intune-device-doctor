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
