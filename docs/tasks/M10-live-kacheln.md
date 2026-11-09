# M10 – Neue Live-Daten: Anmeldungen/Conditional Access, LAPS, Autopilot, Gruppen, weitere Geräte, Integritätsnachweis

Recherche gegen Microsoft Learn am 2026-11-09 (Ergebnisse unten, je mit URL). Vor der Umsetzung jeden Punkt in `docs/graph-api-reference.md` übernehmen (gleiches Tabellenformat, Learn-Link). URLs nur in `src/graph/endpoints.ts`, DTOs nur in `src/graph/dto.ts`, Client bleibt GET-only.

**Delegation:** Ein Subagent (sonnet) arbeitet die Schritte **der Reihe nach** in einem Worktree ab, weil alle denselben Vertrag ändern (`domain/types.ts`, `dto.ts`, `endpoints.ts`, `scopes.ts`, `GraphProvider`, `MockProvider`, Szenarien, `de.ts`). Die Hauptsession prüft den Vertrag und die Regeltexte, lässt `reviewer` laufen und committet.

## Gemeinsame Regeln

- Neue Sections in `DeviceSnapshot` als `SectionResult<…>`; nur laden, wenn anwendbar (Plattform, `azureADDeviceId`, `userId` vorhanden), sonst `notApplicable` mit Grund. 403 → `forbidden` mit `requiredScope`, Rest unberührt.
- Neue Scopes sind **optional** (`OPTIONAL_SCOPES`, wie `DeviceManagementServiceConfig.Read.All`): beim Login nicht anfragen; fehlt der Consent, zeigt die Kachel „Fehlende Berechtigung“ mit Scope + Rolle. README-Scope-Tabelle ergänzen.
- Regeln als reine Funktionen in `src/rules/tiles/`, Texte in `de.ts`/`de-rules.ts`, jede Deutung mit Learn-URL in `knowledge/docs.ts`. Eigene Schwellwerte in `rules/thresholds.ts` (keine Microsoft-Behauptung).
- Demo: bestehende Szenarien sinnvoll erweitern (fiktiv, Contoso), mindestens je ein Problemfall pro neuer Kachel; `CONTOSO-PC050` (Berechtigungsfall) zeigt für die neuen optionalen Scopes ebenfalls „Fehlende Berechtigung“.
- Ticket-Notiz enthält die neuen Kacheln automatisch (prüfen).
- Tests: Mapper, Endpunkte (u. a. „nie `credentials`“), Regeln je Szenario, Provider-Austauschbarkeit; E2E `tiles.spec.ts`/`permissions.spec.ts` erweitern.

## S1 – Anmeldungen & Conditional Access (Kachel „Anmeldungen“)

- `GET /auditLogs/signIns?$filter=userId eq '{userId}' and createdDateTime ge {jetzt−7 Tage}&$top=200` – nur erste Seite (neueste zuerst, laut Doku Standard). **Kein** Filter auf `deviceDetail/deviceId` (nicht dokumentiert; dokumentiert ist `$filter` auf `deviceDetail` nur für `browser`/`operatingSytem`) → clientseitig auf `deviceDetail.deviceId == azureADDeviceId` eingrenzen. `$select` ist nicht dokumentiert → nicht verwenden; `ipAddress`, `location`, Risiko-Felder **nicht** in DTO/Domain übernehmen.
- Scope `AuditLog.Read.All` (optional). Voraussetzungen laut Doku: Entra ID P1/P2; Rolle z. B. Reports Reader, Global Reader, Security Reader. `appliedConditionalAccessPolicies` fehlt ohne CA-Leserecht (kein 403!) → dann „Richtliniendetails nicht sichtbar (Rolle)“ statt Annahmen.
- Felder: `createdDateTime`, `appDisplayName`, `resourceDisplayName`, `clientAppUsed`, `isInteractive`, `status{errorCode, failureReason, additionalDetails}`, `conditionalAccessStatus` (`success|failure|notApplied|unknownFutureValue`), `appliedConditionalAccessPolicies[]{id, displayName, enforcedGrantControls[], enforcedSessionControls[], result}` (`success|failure|notApplied|notEnabled|unknown|unknownFutureValue`; `reportOnly*` nur mit `Prefer: include-unknown-enum-members` – nicht anfordern), `deviceDetail{deviceId, displayName, isCompliant, isManaged, operatingSystem, trustType}`.
- Regeln: Anmeldungen dieses Geräts mit `conditionalAccessStatus = failure` in 7 Tagen → warning (App, Zeitpunkt, blockierende Richtlinie(n), Fehlercode). Fehlercodes nur mit Quelle deuten (Entra-Fehlercodes: https://learn.microsoft.com/en-us/entra/identity-platform/reference-error-codes – konkrete Codes dort nachweisen), sonst „Unbekannter Code“. `deviceDetail.isCompliant === false`, obwohl Intune `compliant` meldet → Hinweis (zeitversetzte Auswertung möglich – nur sagen, was die Doku stützt). Keine Anmeldungen des Geräts gefunden → ok/neutral mit Hinweis „nur interaktive Anmeldungen, nur in Entra registrierte Geräte“.
- Quellen: https://learn.microsoft.com/en-us/graph/api/signin-list?view=graph-rest-1.0, https://learn.microsoft.com/en-us/graph/api/resources/signin?view=graph-rest-1.0, https://learn.microsoft.com/en-us/graph/api/resources/devicedetail?view=graph-rest-1.0, https://learn.microsoft.com/en-us/graph/api/resources/appliedconditionalaccesspolicy?view=graph-rest-1.0, https://learn.microsoft.com/en-us/graph/api/resources/signinstatus?view=graph-rest-1.0

## S2 – Windows LAPS (Kachel „Lokaler Administrator (LAPS)“, nur Windows)

- `GET /directory/deviceLocalCredentials/{azureADDeviceId}?$select=id,deviceName,lastBackupDateTime,refreshDateTime` – `id` = Entra-`deviceId` (= `azureADDeviceId`). **Nie** `credentials` anfordern (Kennwort); Unit-Test sichert das ab. Antwort laut Doku-Beispiel unter `{"value": {…}}` → Mapper akzeptiert beide Formen (wie Apple-Zertifikat).
- Scope `DeviceLocalCredential.ReadBasic.All` (optional; **nicht** `…Read.All`). Rollen laut Doku: Cloud Device Administrator, Helpdesk Administrator, Intune Service Administrator, Security Administrator, Security Reader, Global Reader. Pflicht-Header `User-Agent` setzt der Browser selbst (live prüfen, in `docs/live-verification.md` eintragen).
- Regeln: `lastBackupDateTime` älter als `THRESHOLDS.lapsBackupWarningDays` (eigener Wert, z. B. 30) → warning; `refreshDateTime` deutlich in der Vergangenheit (> 7 Tage) → Hinweis „geplante Rotation überfällig“ (Feldbeschreibung laut Doku: Zeitpunkt der nächsten Aktualisierung). 404 → `unavailable` „Graph liefert keinen LAPS-Eintrag für dieses Gerät“ (Bedeutung nicht dokumentiert → keine weitere Deutung).
- Quellen: https://learn.microsoft.com/en-us/graph/api/devicelocalcredentialinfo-get?view=graph-rest-1.0, https://learn.microsoft.com/en-us/graph/api/resources/devicelocalcredentialinfo?view=graph-rest-1.0

## S3 – Windows Autopilot (Wert/Befund in „Gerätestatus“ oder eigene Kachel „Autopilot“, nur Windows)

- `GET /deviceManagement/windowsAutopilotDeviceIdentities` (v1.0). Query-Optionen sind auf der List-Seite **nicht** dokumentiert. Vorgehen: Prüfen, ob irgendeine Microsoft-Learn-Seite einen `$filter` auf `serialNumber` für diese Ressource belegt (z. B. `contains(serialNumber,'…')`); falls ja, mit Beleg verwenden und bei HTTP 400 auf die paginierte Liste zurückfallen (max. 5 Seiten, wie die Gerätesuche); falls nein, nur die begrenzte Liste. Treffer über `managedDeviceId == managedDevice.id`, sonst `serialNumber`. Nicht gefunden innerhalb der Grenze → `unavailable` mit ehrlichem Grund.
- Scope `DeviceManagementServiceConfig.Read.All` (bereits optional vorhanden).
- Felder (v1.0): `id, groupTag, serialNumber, manufacturer, model, enrollmentState (unknown|enrolled|pendingReset|failed|notContacted), lastContactedDateTime, managedDeviceId, displayName`. Nicht verwenden: `productKey`, `userPrincipalName`/`addressableUserName` (nicht nötig), `azureActiveDirectoryDeviceId` („to be deprecated“). `deploymentProfileAssignmentStatus` u. ä. gibt es nur in beta → nicht verwenden, in der Kachel als „über dokumentierte API nicht verfügbar“ ausweisen.
- Regeln: `enrollmentState = failed` → warning; Group Tag als Wert; nicht registriert → neutraler Hinweis (kein Fehler).
- Quellen: https://learn.microsoft.com/en-us/graph/api/intune-enrollment-windowsautopilotdeviceidentity-list?view=graph-rest-1.0, https://learn.microsoft.com/en-us/graph/api/resources/intune-enrollment-windowsautopilotdeviceidentity?view=graph-rest-1.0

## S4 – Gruppen des Geräts (Kachel „Gruppen“, informativ)

- `GET /devices(deviceId='{azureADDeviceId}')/transitiveMemberOf` – ohne Query-Optionen (die sind nur als Advanced Query mit `ConsistencyLevel: eventual` + `$count` unterstützt → bewusst vermeiden), Paging über `@odata.nextLink`, max. 5 Seiten. Nur `#microsoft.graph.group` anzeigen (`id`, `displayName`); Objekte ohne Leserecht kommen nur mit `@odata.type`/`id` → als „ausgeblendet (keine Berechtigung)“ zählen.
- Scope `Device.Read.All` (vorhanden). Gruppen des **Benutzers** bräuchten `User.Read.All` (neuer Scope) → bewusst nicht; als Grenze dokumentieren.
- Darstellung: Anzahl als Wert, Liste im Sheet mit Link ins Entra Admin Center nur, falls eine Portal-URL bereits analog zu `src/links/intunePortal.ts` belegt ist – sonst nur Name. Severity `ok` (informativ), keine Bewertung.
- Quellen: https://learn.microsoft.com/en-us/graph/api/device-list-transitivememberof?view=graph-rest-1.0

## S5 – Weitere Geräte des Benutzers (Geräte-Header)

- `GET /deviceManagement/managedDevices?$filter=userPrincipalName eq '{upn}'&$select=id,deviceName,operatingSystem,complianceState,lastSyncDateTime` (bereits dokumentierter Filter, siehe Referenz). `GET /users/{id}/managedDevices` ist **nicht** als Methode dokumentiert → nicht verwenden.
- Geräte-Header: kompakte Zeile „Weitere Geräte von {Benutzer}“ (max. 5, Plattform-Symbol, Compliance-Punkt), Klick öffnet das Gerät in der App (gleicher Weg wie Suchtreffer). Aktuelles Gerät ausblenden. Fehler/403 → Zeile entfällt still (kein Dashboard-Fehler).

## S6 – Integritätsnachweis (Device Health Attestation, nur Windows)

- `GET /deviceManagement/managedDevices/{id}?$select=deviceHealthAttestationState` (eigener Aufruf, Scope vorhanden). Felder fast alle `String` ohne dokumentierte Werte → **nur Rohdaten** (Secure Boot, BitLocker-Status, Code Integrity, ELAM, Boot-Debugging, Test Signing, TPM-Version, `lastUpdateDateTime` (String!), `issuedDateTime`) als Evidenz in der Kachel „BitLocker“ bzw. „Gerätestatus“. Befunde nur, wo die Ressourcenseite Werte dokumentiert. `virtualSecureMode` nicht verwenden (Support in v1.0 beendet).
- Quelle: https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-devicehealthattestationstate?view=graph-rest-1.0

## Akzeptanz

- [ ] `docs/graph-api-reference.md`, README (Scopes, Rollen, Lizenz, Grenzen) und `docs/live-verification.md` (falls vorhanden, sonst Abschnitt in der Referenz) ergänzt
- [ ] Read-only-Test grün; Test „LAPS-Endpunkt fordert nie `credentials` an“
- [ ] Jede neue Section unabhängig: 403/404/Fehler bricht nichts anderes
- [ ] Demo-Szenarien zeigen jede neue Kachel mindestens einmal mit Befund
- [ ] `npm run check` und `npm run test:e2e` grün
