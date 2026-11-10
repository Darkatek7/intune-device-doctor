# M15 – Ansicht „Richtlinien“: Richtlinie → betroffene Geräte

Helpdesk-Fall: Nach einem Rollout melden viele Geräte Fehler. Die Ansicht beantwortet „Bei welchen Geräten schlägt Richtlinie X fehl?“ – umgekehrt zur Geräteansicht, in Demo und Live über die Provider-Schnittstelle.

Recherche gegen Microsoft Learn am 2026-11-10 (Details und Links: `docs/graph-api-reference.md` › „Richtlinien → Geräte (v1.0, M15)“).

## Graph (nur dokumentierte v1.0-GETs)

| Zweck | Endpunkt | Learn |
| --- | --- | --- |
| Konfigurationsprofile | `GET /deviceManagement/deviceConfigurations` | [list](https://learn.microsoft.com/en-us/graph/api/intune-deviceconfig-deviceconfiguration-list?view=graph-rest-1.0) |
| Zähler je Profil | `GET …/deviceConfigurations/{id}/deviceStatusOverview` | [get](https://learn.microsoft.com/en-us/graph/api/intune-deviceconfig-deviceconfigurationdeviceoverview-get?view=graph-rest-1.0) |
| Gerätestatus je Profil | `GET …/deviceConfigurations/{id}/deviceStatuses` | [list](https://learn.microsoft.com/en-us/graph/api/intune-deviceconfig-deviceconfigurationdevicestatus-list?view=graph-rest-1.0) |
| Compliance-Richtlinien | `GET /deviceManagement/deviceCompliancePolicies` | [list](https://learn.microsoft.com/en-us/graph/api/intune-deviceconfig-devicecompliancepolicy-list?view=graph-rest-1.0) |
| Zähler je Richtlinie | `GET …/deviceCompliancePolicies/{id}/deviceStatusOverview` | [get](https://learn.microsoft.com/en-us/graph/api/intune-deviceconfig-devicecompliancedeviceoverview-get?view=graph-rest-1.0) |
| Gerätestatus je Richtlinie | `GET …/deviceCompliancePolicies/{id}/deviceStatuses` | [list](https://learn.microsoft.com/en-us/graph/api/intune-deviceconfig-devicecompliancedevicestatus-list?view=graph-rest-1.0) |

- Scope überall `DeviceManagementConfiguration.Read.All` – laut allen sechs Learn-Seiten least privileged (delegiert), bereits beim Login angefragt. Kein neuer Scope.
- Keine Query-Optionen dokumentiert → kein `$select`/`$filter`/`$top`; Paging über `@odata.nextLink`.
- Befunde aus der Doku, die die Umsetzung prägen:
  - `deviceStatusOverview` kennt in v1.0 nur `pendingCount, notApplicableCount, successCount, errorCount, failedCount` (+ `lastUpdateDateTime`, `configurationVersion`) – **keinen Konflikt-Zähler**. Konflikt/„nicht konform“ zeigt nur der Gerätestatus.
  - `deviceStatuses` hat kein Plattform-Feld (nur `deviceModel`) und keine als managedDevice-ID belegte `id` → Spalte „Modell“, Gerät öffnen über die vorhandene Suche nach dem Namen.
  - `deviceConfigurationDeviceStatus`: „Support for this Entity is being deprecated starting May 2026“ → Hinweis in der Ansicht.
  - Der Basistyp der Richtlinien hat kein Plattform-Feld → Ableitung nur aus dem Präfix des abgeleiteten Typs (`@odata.type`), sonst „Plattform nicht erkennbar“.
  - Settings Catalog (`configurationPolicies`) und Endpunktsicherheit (`intents`) nur beta → „über dokumentierte API nicht verfügbar“.

## Grenzen

- Zähler höchstens für **50** Richtlinien (zuletzt geänderte zuerst), **4** parallel (`MAX_POLICY_OVERVIEWS`, `POLICY_OVERVIEW_CONCURRENCY`); der Rest „Zähler nicht abgefragt“.
- Listen höchstens 5 Seiten (`MAX_LIST_PAGES`, sonst Hinweis), Gerätestatus höchstens 3 Seiten (`MAX_POLICY_STATUS_PAGES`, sonst Hinweis).
- Jede Liste und jede Übersicht ist ein eigenes `SectionResult`: 403 → „fehlende Berechtigung“ mit Scope, 404 → „nicht verfügbar“, andere Fehler → „Fehler beim Laden“ mit „Erneut versuchen“; die Ansicht bricht nie als Ganzes. 429 + `Retry-After` behandelt der Client.

## Umsetzung

- `src/graph/endpoints.ts` (6 Endpunkte + Grenzen), `src/graph/dto.ts` (`GraphTenantPolicy`, `GraphPolicyDeviceOverview`, `GraphPolicyDeviceStatus`), `src/graph/mappers.ts` (`mapTenantPolicies`, `mapPolicyOverview`, `mapPolicyDeviceStatuses`, `policyPlatformFromODataType`).
- Domain: `TenantPolicies`, `TenantPolicyInfo`, `PolicyDeviceOverview`, `PolicyDeviceStatusesInfo` (`src/domain/types.ts`); Sortierung/Filter/Bewertung in `src/domain/policyOverview.ts`.
- Provider: `getTenantPolicies()`, `getPolicyDeviceStatuses()` in Schnittstelle, `GraphProvider`, `LazyGraphProvider`, `MockProvider`; Verbindungstest um die sechs Endpunkte ergänzt.
- Demo: `src/providers/mock/policies.ts` leitet Richtlinien, Zähler und Gerätestatus aus den Demo-Geräten ab (z. B. „Contoso – Edge Sicherheitsbaseline“: Konflikt auf CONTOSO-PC042; „Contoso – VPN Always On“: Fehler 0x87D1FDE8 auf CONTOSO-PC042) plus ein Profil ohne Geräte (leerer Zustand).
- UI: `src/app/PoliciesView.tsx` (Liste), `src/app/PolicyDetailView.tsx` (Gerätestatus als Unterseite), Hooks `src/hooks/useTenantPolicies.ts`, Texte `src/i18n/de-policies.ts`, Toolbar-Button „Richtlinien“ (`src/ui/Toolbar.tsx`), URL `?view=policies[&policy=…]` (`src/hooks/useUrlState.ts`), Verdrahtung in `src/app/AppShell.tsx`.

## Akzeptanz

- [x] Endpunkte auf Microsoft Learn verifiziert und in `docs/graph-api-reference.md` mit Link eingetragen; URLs nur in `endpoints.ts`, DTOs nur in `dto.ts`, Mapper in `mappers.ts`
- [x] Read-only: nur `client.get()`; Tests prüfen Methode GET und Pfade ohne Query
- [x] Keine Beta-Endpunkte; Einstellungskatalog/Endpunktsicherheit als „über dokumentierte API nicht verfügbar“ ausgewiesen
- [x] Grenzen ehrlich: „Zähler nicht abgefragt“, „Liste unvollständig“, „weitere Geräte nicht abgefragt“
- [x] Jede Quelle liefert `SectionResult`; 403/404/Fehler brechen die Ansicht nicht (Tests GraphProvider, MockProvider, Komponente)
- [x] Toolbar-Button „Richtlinien“ neben „Mandant“, Vorlesename = sichtbarer Text (WCAG 2.5.3), `?view=policies`, Zurück-Navigation (Browser und Schaltfläche) inkl. Fokus-Rückgabe
- [x] Liste: Typ, Plattform (falls ableitbar), Zähler, sortiert nach Problemen, Namensfilter
- [x] Gerätestatus: Standardfilter „Nur Probleme“, Spalten Gerät, Benutzer, Modell (statt Plattform – nicht dokumentiert), Status, zuletzt gemeldet; Gerätename öffnet die Geräteansicht über die Suche
- [x] Ladezustände, leere Zustände, Berechtigungsfall, Dark Mode, Mobile, reduced motion
- [x] Demo konsistent mit den Demo-Geräten (Namen der Mock-Richtlinien wiederverwendet)
- [x] Unit-Tests (Endpunkte, Mapper, GraphProvider, MockProvider, Logik, Ansicht) und `e2e/policies.spec.ts` inkl. axe grün
- [x] README-Abschnitt, Live-Prüfliste (`docs/live-verification.md` › 5) und „Live zu verifizieren (M15)“ ergänzt
