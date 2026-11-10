# M20 – Übersicht, Änderungsprotokoll, App-Schutz, Remote-Aktionen

Vier lesende Ergänzungen auf Basis von M18. Alles read-only; neuer optionaler Scope nur für S2/S3 (`DeviceManagementApps.Read.All`). Recherche gegen Microsoft Learn am 2026-11-10 (Details und Links: `docs/graph-api-reference.md`).

## S1 – Compliance-Übersicht im Mandanten (kein neuer Scope)

Endpunkte (v1.0, `DeviceManagementConfiguration.Read.All`): `GET /deviceManagement/deviceCompliancePolicyDeviceStateSummary`, `…/deviceCompliancePolicySettingStateSummaries`, `…/deviceConfigurationDeviceStateSummaries` (Gegenstück für Konfigurationsprofile – in v1.0 dokumentiert, deshalb ergänzt).

- Domain: `DeviceStateSummaryInfo`, `ComplianceSettingSummariesInfo`; `TenantStatus.complianceSummary/.complianceSettings/.configurationSummary`; `TileId` `tenantCompliance`, `tenantConfiguration`.
- Regeln `src/rules/fleet.ts`; Texte `src/i18n/de-fleet.ts`; Demo `src/providers/mock/fleet.ts`; Balken `src/ui/ShareBar.tsx` (Textalternative + Legende).
- Ansicht „Mandant“ in beschriftete Abschnitte gegliedert (`TENANT_SECTIONS`).
- Severity: Fehler/Konflikte > 0 → Prüfen; Anteil nicht konform ≥ 10 % → Prüfen (**eigener Richtwert**), sonst Hinweis; nie „Problem“.

## Akzeptanz S1

- [x] Endpunkte, Felder, Enums und Scope auf Learn verifiziert, in `docs/graph-api-reference.md` mit Link
- [x] Kacheln mit exakt den dokumentierten Zählern, Anteilsbalken mit Textalternative, „Häufigste Verstöße“ ehrlich begrenzt (3 Seiten)
- [x] Gegenstück für Konfigurationsprofile geprüft und ergänzt
- [x] Severity begründet, Richtwert gekennzeichnet; Tests je Severity-Zweig; 403/404/429 über `SectionResult`
- [x] Ansicht „Mandant“ in Abschnitte gegliedert, bestehende Tests angepasst (Kachelzahl aus `TENANT_SECTIONS` berechnet)

## S2 – Änderungsprotokoll (optionaler Scope `DeviceManagementApps.Read.All`)

Endpunkt (v1.0): `GET /deviceManagement/auditEvents`.

- Domain: `AuditEventsInfo`, `AuditEventEntry`; `TenantStatus.auditEvents`; Provider-Methode `getAuditEvents()`; `TileId` `tenantChanges`.
- Mandant: Abschnitt „Änderungen“ mit Kachel „Letzte Änderungen“ (7 Tage). Richtlinien-Detail: `src/ui/PolicyChanges.tsx`.
- `FindingTable` mit `columnLangs`/`cellLangs` (`lang="en"` für Microsoft-Rohwerte), auch für die M18-Tabellen.

## Akzeptanz S2

- [x] Endpunkt, Felder, Scope und Rollen auf Learn verifiziert, mit Link dokumentiert
- [x] Vom `actor` nur UPN, App-Name und Typ; IP-Adresse und IDs nie gelesen (Test)
- [x] Höchstens 5 Seiten, clientseitig sortiert, Seitengrenze ausgewiesen
- [x] Richtlinien-Detail: Änderungen an dieser Richtlinie, ruhiger Hinweis ohne Kausalität, Richtwert gekennzeichnet
- [x] 403/404/429 im Provider getestet; fehlende Berechtigung bricht weder Mandant noch Richtlinien-Detail
- [x] README (Scope, Datenschutz, Grenzen, Demo-Schritt 9), Live-Verifikation ergänzt

## S3 – App-Schutz (MAM) am Gerät (optionaler Scope `DeviceManagementApps.Read.All`)

Endpunkt (v1.0): `GET /deviceAppManagement/managedAppRegistrations` (Mandantenliste, höchstens 3 Seiten).

- Domain: `AppProtectionInfo`, `AppProtectionRegistration`; Snapshot-Section `appProtection`; Provider-Methode `getAppProtection()`; `TileId` `appProtection` (nur iOS/Android).
- Regel `src/rules/tiles/appProtection.ts`; Demo: `CONTOSO-AND21` (Outlook `rootedDevice`), `CONTOSO-IP015` (generischer Gerätename, Teams 45 Tage ohne Synchronisierung).

## Akzeptanz S3

- [x] Endpunkt, Felder, Enum `managedAppFlaggedReason` und Scope auf Learn verifiziert; `/users/{id}/managedAppRegistrations` nicht als REST belegt → nicht genutzt
- [x] Zuordnung nur über dokumentierte Felder (`userId`, `deviceName`); ohne sicheren Treffer alle Registrierungen des Benutzers, offen ausgewiesen (iOS 16+: generischer Name)
- [x] `rootedDevice` → Problem (bei unsicherer Zuordnung Prüfen); > 30 Tage ohne Synchronisierung → Prüfen (eigener Richtwert, gekennzeichnet)
- [x] Windows-MAM nur beta → nicht abgefragt, als nicht anwendbar begründet
- [x] Tests: Mapper, Regel (alle Zweige), Provider 403/404/429, Mock-Demo und forbidden; Verbindungstest-Probe; Doku
