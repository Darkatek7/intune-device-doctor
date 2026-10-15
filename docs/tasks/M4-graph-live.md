# M4 – Live-Modus: MSAL + Microsoft Graph

**Delegation:** `graph-implementer` (sonnet); `test-writer` (haiku) für Client-/Mapper-Tests. Einzige erlaubte API-Quelle: `docs/graph-api-reference.md`.

## Schritte
1. `src/auth/msalConfig.ts`: `PublicClientApplication` mit `clientId`, `authority = https://login.microsoftonline.com/{tenantId}`, `redirectUri`, Cache `sessionStorage`. `src/auth/AuthGate.tsx`: nur im Live-Modus; Login per Redirect (Popup als Option), Anzeige Konto + Abmelden; Scopes aus `LOGIN_SCOPES`.
2. `src/graph/client.ts`: `createGraphClient(getToken)` mit **ausschließlich** `get<T>(path, {signal})` und `getAllPages<T>(path, {maxPages})`. Token per `acquireTokenSilent`, bei `InteractionRequiredAuthError` → Redirect. Fehler-Mapping auf `AppError` (`401 unauthenticated`, `403 forbidden` + `requiredScope`, `404 notFound`, `429/503 throttled` mit `Retry-After`, Netzwerk, Abort), Retry max. 3× mit Backoff, `request-id` übernehmen. Header `client-request-id` (UUID) setzen.
3. `src/graph/mappers.ts`: DTO → Domain (osFamily, productStatus-Split, volumeType Name/Zahl, null-sicher).
4. `src/providers/graph/GraphProvider.ts`: implementiert `DeviceDataProvider`:
   - Suche: erst `managedDevicesByName` (eq); leer → `managedDevicesByNameContains`; liefert der Contains-Filter 400, clientseitig auf paginierte Liste (max. 5 Seiten, `$select`) zurückfallen und Hinweis loggen.
   - Sections: Defender nur bei osFamily windows (sonst `notApplicable` ohne Request; 404 → `unavailable`), Entra/BitLocker nur mit `azureADDeviceId` (sonst `unavailable`), Konfig-Status → Section `configurationPolicies`.
   - Jede Section fängt Fehler und liefert `SectionResult` mit `source` = Endpoint-`display` + `docsUrl`.
5. Provider-Context: Live-Provider, wenn Modus live und `isLiveConfigured`; sonst Hinweis in der UI.
6. Tests (fetch gemockt): nur GET wird gesendet (Test spioniert `fetch` und prüft `method`), URL-Encoding/OData-Escaping (`O'Brien-PC`), 403 → forbidden mit Scope, 429 mit Retry-After wird wiederholt, 404 Defender → unavailable, Paging, Mapper-Randfälle. **Provider-Vertragstest**: dieselbe Testsuite läuft gegen MockProvider und GraphProvider (mit Fake-Fetch) und prüft gleiche Snapshot-Form.
7. README-Abschnitt „Live-Modus einrichten“ verifizieren/ergänzen.

## Akzeptanz
- [ ] Ohne `.env.local` bleibt Live deaktiviert, Demo unverändert
- [ ] Kein Code-Pfad sendet etwas anderes als GET an graph.microsoft.com
- [ ] Alle URLs kommen aus `endpoints.ts`
- [ ] `npm run check` grün
