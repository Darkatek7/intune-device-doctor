# MDM Doctor – Arbeitsregeln für Claude

One-Click Intune Device Troubleshooter: Gerätename eingeben → Status-Kacheln mit Befund, Ursache und Lösung. Demo-Modus (Mock-Daten) und Live-Modus (Microsoft Graph, MSAL/PKCE) hinter **einer** Provider-Schnittstelle. Zusätzlich Analyse von Intune-DiagLogs-ZIPs komplett im Browser. Gesamtplan: `docs/PLAN.md`.

## Harte Regeln
1. **Read-only.** Kein Code, der Intune-/Entra-Objekte verändert. Der Graph-Client bietet nur `get()`; ein Test stellt sicher, dass kein anderes HTTP-Verb gesendet wird. Keine Remote-Actions (Sync, Wipe, Collect diagnostics …).
2. **Keine erfundenen Graph-APIs.** Erlaubt sind nur Endpunkte, Felder und Enum-Werte aus `docs/graph-api-reference.md` (mit offiziellem Microsoft-Learn-Link). URLs entstehen ausschließlich in `src/graph/endpoints.ts`, DTOs in `src/graph/dto.ts`. Fehlt etwas: in der UI als „über dokumentierte API nicht verfügbar“ ausweisen statt zu raten. Keine undokumentierten Beta-Reports (z. B. `getConfigurationPoliciesReportForDevice`).
3. **Keine Kundendaten im Repo** (öffentlich!). Keine echten ZIPs, Tenant-IDs, UPNs, Gerätenamen, Seriennummern. Demo-/Testdaten sind fiktiv (Contoso, `contoso.com`, `CONTOSO-PC042`). `.gitignore` sperrt `*.zip`; Test-ZIPs werden in-memory von `scripts/make-fixture-zip.ts` erzeugt.
4. **Fehlercodes & Lösungstexte nur mit Quelle.** Wissensbasis-Einträge (`src/rules/knowledge/`) brauchen eine Microsoft-Learn-URL. Win32-HRESULTs (`0x8007xxxx`) dürfen generisch auf den Win32-Code zurückgeführt werden (System Error Codes). Unbekannte Codes: „Unbekannter Code“ + Hex/Dezimal anzeigen, nichts erfinden.
5. **Fehler sauber behandeln.** Jede Datenquelle liefert `SectionResult` (`ok | forbidden | notApplicable | unavailable | error`). Eine fehlende Berechtigung oder ein 404 bricht nie das ganze Dashboard. 429 → `Retry-After` respektieren.
6. **UI auf Deutsch**, alle Texte in `src/i18n/de.ts`. Design nach `docs/ui-guidelines.md` (Apple-Design-Prinzipien).
7. **Privatsphäre im ZIP-Modus:** Datei nie hochladen; UPN, Tenant-ID, ChannelURI, Seriennummern in der Anzeige maskieren.

## Architektur (Kurzfassung)
- `src/domain/types.ts` – Domain-Modell (DeviceSnapshot, SectionResult, Tile, Finding). **Vertrag – Änderungen bewusst und überall nachziehen.**
- `src/providers/DeviceDataProvider.ts` – gemeinsame Schnittstelle; `mock/MockProvider.ts`, `graph/GraphProvider.ts`.
- `src/graph/` – `dto.ts`, `endpoints.ts`, `scopes.ts`, `client.ts` (GET-only, Retry, Fehler-Mapping), `mappers.ts`.
- `src/auth/` – MSAL (`@azure/msal-browser` v5, `@azure/msal-react` v5), Auth-Code + PKCE.
- `src/diagnostics/` – ZIP-Reader (`@zip.js/zip.js`, lazy), Web Worker, Parser, `analyze.ts`.
- `src/rules/` – reine Funktionen `DeviceSnapshot → Tile`, Wissensbasis.
- `src/ui/` – Komponenten. Kein Datenzugriff in Komponenten außer über Hooks/Provider.

## Befehle
- `npm run dev` – Dev-Server (Port 5173)
- `npm run check` – **Definition of Done**: lint + typecheck + test + build müssen grün sein
- `npm run fixture` – synthetisches DiagLogs-ZIP nach `tests/fixtures/` schreiben (gitignored)

## Arbeitsweise (Cloud-Session)
- Meilensteine `docs/tasks/M1-*.md` … `M6-*.md` **der Reihe nach** abarbeiten. Akzeptanzkriterien abhaken, `npm run check` grün, dann committen („M2: …“) und auf Branch `mvp` pushen. Am Ende PR `mvp → main`.
- **Delegation an Subagents** (`.claude/agents/`), um Kosten zu sparen:
  - `mock-data-writer` (haiku): Demo-Szenarien, Fixture-Generator – mechanisch, klar spezifiziert.
  - `test-writer` (haiku): Unit-Tests für fertige Module.
  - `reviewer` (haiku): Regel-Check gegen diese Datei vor jedem Meilenstein-Commit.
  - `ui-builder` (sonnet): UI-Komponenten nach `docs/ui-guidelines.md`.
  - `graph-implementer` (sonnet): Graph-Client, MSAL, GraphProvider, Mapper.
  - `zip-parser-implementer` (sonnet): Worker, Parser, Analyzer.
  - Hauptsession: Domain-Modell, Regeln/Lösungstexte, Integration, Review der Subagent-Ergebnisse.
- Subagents bekommen konkrete Dateien + Akzeptanzkriterien aus der Task-Datei. Ergebnisse immer selbst prüfen (Diff lesen, `npm run check`).
- Bibliotheks-APIs (Motion, MSAL v5, zip.js, Tailwind v4, Vitest 5, ESLint 10) bei Unsicherheit in `node_modules/<pkg>` (Typdefinitionen/README) nachsehen statt raten.
