# M18 – Registrierungsfehler und Dienststatus

Zwei Lücken: (1) Scheitert schon die Registrierung, gibt es kein Intune-Gerät – die App fand bisher nichts. (2) Die erste Frage jeder Fehlersuche, „Liegt es an Microsoft?“, blieb unbeantwortet. Beides in Demo und Live über die Provider-Schnittstelle, alles Mandantenweite in der bestehenden Ansicht „Mandant“ (kein neuer Toolbar-Eintrag).

Recherche gegen Microsoft Learn am 2026-11-10 (Details und Links: `docs/graph-api-reference.md` › „Dienststatus und Registrierungsfehler (v1.0, M18)“).

## Graph (nur dokumentierte v1.0-GETs)

| Zweck | Endpunkt | Scope | Learn |
| --- | --- | --- | --- |
| Dienststatus aller Dienste inkl. Vorfälle | `GET /admin/serviceAnnouncement/healthOverviews?$expand=issues` | `ServiceHealth.Read.All` (**optional**, neu) + Admin-Rolle | [list](https://learn.microsoft.com/en-us/graph/api/serviceannouncement-list-healthoverviews?view=graph-rest-1.0), [serviceHealth](https://learn.microsoft.com/en-us/graph/api/resources/servicehealth?view=graph-rest-1.0), [serviceHealthIssue](https://learn.microsoft.com/en-us/graph/api/resources/servicehealthissue?view=graph-rest-1.0) |
| Registrierungsfehler | `GET /deviceManagement/troubleshootingEvents` | `DeviceManagementManagedDevices.Read.All` (vorhanden) | [list](https://learn.microsoft.com/en-us/graph/api/intune-troubleshooting-enrollmenttroubleshootingevent-list?view=graph-rest-1.0), [Ressource](https://learn.microsoft.com/en-us/graph/api/resources/intune-troubleshooting-enrollmenttroubleshootingevent?view=graph-rest-1.0), [deviceEnrollmentFailureReason](https://learn.microsoft.com/en-us/graph/api/resources/intune-troubleshooting-deviceenrollmentfailurereason?view=graph-rest-1.0) |

Befunde aus der Doku, die die Umsetzung prägen:

- `$expand=issues` steht als Beispiel 2 auf der healthOverviews-Seite → ein Aufruf statt zusätzlich `GET /admin/serviceAnnouncement/issues`. Offene Einträge clientseitig über `isResolved`.
- Enum-Werte stehen camelCase in der Doku, die Beispielantworten zeigen PascalCase → Vergleich ohne Rücksicht auf den ersten Buchstaben.
- Der `service`-Name für Intune/Entra ist Mandanten-Datum (keine festen Werte auf Learn) → Zuordnung über den Namen, unter „Live zu verifizieren (M18)“.
- `troubleshootingEvents`: keine Query-Optionen dokumentiert → höchstens 3 Seiten (`MAX_TROUBLESHOOTING_EVENT_PAGES`), clientseitig sortiert/gefiltert, Hinweis „Nur die ersten N Seiten geprüft“. Basistyp-Einträge (ohne Registrierungsfelder) werden verworfen.
- `/users/{id}/deviceManagementTroubleshootingEvents` ist nur als PowerShell-Cmdlet belegt, keine REST-Methode → nicht verwendet.
- Name zur `userId`: `GET /users/{id}` bräuchte `User.ReadBasic.All` → kein neuer Scope, die ID wird gezeigt und das offen gesagt.

## Umsetzung

- `src/graph/endpoints.ts` (`serviceHealthOverviews`, `troubleshootingEvents`, Grenzen), `src/graph/dto.ts` (Enums `SERVICE_HEALTH_STATUSES`, `SERVICE_HEALTH_CLASSIFICATIONS`, `DEVICE_ENROLLMENT_FAILURE_REASONS`, `TROUBLESHOOTING_ENROLLMENT_TYPES`; DTOs nur gelesener Felder), `src/graph/mappers.ts` (`mapServiceHealth`, `mapEnrollmentFailures`, `pickEnumLoose`, `serviceHealthKind`), `src/graph/scopes.ts` (`ServiceHealth.Read.All` in `OPTIONAL_SCOPES`).
- Domain (`src/domain/types.ts`): `ServiceHealthInfo`, `EnrollmentFailuresInfo` u. a.; `TenantStatus.serviceHealth`/`.enrollmentFailures`; `DeviceSnapshot.enrollmentFailures` + Section-Key; `TileId` `tenantServiceHealth`, `tenantEnrollmentFailures`; `Finding.titleLang`/`detailLang` für Microsoft-Originaltexte.
- Provider: `getServiceHealth()`, `getEnrollmentFailures(device)` in Schnittstelle, `GraphProvider`, `LazyGraphProvider`, `MockProvider`; `getTenantStatus` liefert beide mit. Verbindungstest um beide Endpunkte ergänzt (nur Feldnamen).
- Regeln (`src/rules/service.ts`): vollständige, begründete Abbildung `serviceHealthStatus` → Severity; Kacheln „Dienststatus“ und „Registrierungsfehler“; Befunde der Gerätekachel „Registrierung (Benutzer)“ (`src/rules/tiles/registration.ts`). Wissensbasis `src/rules/knowledge/enrollmentFailureCategories.ts` (jede Kategorie mit Learn-Quelle), Texte `src/i18n/de-service.ts`.
- UI: Kacheln in `TenantView` (über `evaluateTenant`); Hinweis `src/ui/ServiceHealthNotice.tsx` + Hook `src/hooks/useServiceHealthNotice.ts` (einmal pro Sitzung) in `DeviceView`; Verweis `src/ui/EnrollmentFailuresHint.tsx` im Leerzustand „Kein Gerät gefunden“; Verdrahtung in `AppShell.tsx` (öffnet `?view=tenant&tile=…`).
- Demo (`src/providers/mock/service.ts`): offener Intune-Vorfall + Hinweis, sieben Registrierungsfehler in fünf Kategorien (CONTOSO-IP015: `userValidation`, CONTOSO-PC042: `enrollmentRestrictionsEnforced`); Zustände „alles in Ordnung“ (`healthyServiceHealth`) und „fehlende Berechtigung“ über `MockTenantFixture`.

## Akzeptanz

- [x] Endpunkte, Felder, Enums und Scope auf Microsoft Learn verifiziert, in `docs/graph-api-reference.md` mit Link; URLs nur in `endpoints.ts`, DTOs nur in `dto.ts`
- [x] Read-only, keine Beta-Endpunkte; Tests prüfen GET und Pfade (`GraphProvider.service.test.ts`, Verbindungstest-Registry)
- [x] `ServiceHealth.Read.All` optional (nicht beim Login), README-Scope-Tabelle mit Rollen
- [x] Dienststatus: Enum vollständig auf Severity abgebildet (unbekannt → „unbekannt“), offene Vorfälle/Hinweise mit Titel, Einstufung, Status, Beginn, letzter Aktualisierung; englische Originaltexte mit `lang="en"`; keine personenbezogenen Felder
- [x] Hinweis in der Geräteansicht nur bei offenem Intune-Vorfall, einmal pro Sitzung, ohne Scope/bei Fehlern nichts; Sprung in die Kachel
- [x] Registrierungsfehler: jüngste Fehlschläge (Zeitpunkt, Betriebssystem + Version, Registrierungsart, Kategorie, Fehlergrund, Benutzer-ID), nach Kategorie mit Anzahl; jede Kategorie mit Ursache + Lösung + Learn-Quelle, unbekannte Werte nur roh
- [x] Seitengrenze ehrlich ausgewiesen; Benutzername offen als nicht abrufbar ausgewiesen
- [x] Gerätekachel „Registrierung (Benutzer)“ zeigt Fehlschläge des primären Benutzers (ein zusätzlicher, seitenbegrenzter Abruf)
- [x] „Kein Gerät gefunden“ mit Verweis, der die Kachel „Registrierungsfehler“ öffnet
- [x] Jede Quelle liefert `SectionResult`; 403/404/429 getestet (GraphProvider), Berechtigungsfall in Komponente und MockProvider
- [x] Unit-Tests (Mapper, Regeln je Enum/Severity, Provider, Komponenten) und `e2e/service.spec.ts` inkl. axe in allen vier Projekten grün
- [x] README (Scope-Tabelle, Bekannte Grenzen, Demo-Skript), `docs/live-verification.md` › 6, „Live zu verifizieren (M18)“
