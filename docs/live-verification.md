# Prüfliste Live-Modus (gegen einen echten Tenant)

Einige Graph-Verhalten sind in der offiziellen Dokumentation nicht belegt und konnten bisher nicht gegen einen echten Tenant verifiziert werden. Diese Liste beschreibt, wie ein Admin das mit dem Browser-Netzwerk-Tab prüft und was im Projekt danach anzupassen ist.

**Wichtig**

- Es werden ausschließlich **GET**-Anfragen der App beobachtet (Regel „Read-only“). Nichts nachbauen, was Objekte verändert.
- **Keine echten Tenant-Daten** (Tenant-ID, UPN, Gerätenamen, Seriennummern, Geräte-IDs) in Issues, PRs, Commits oder diese Datei übernehmen. Ergebnisse nur als „200/400/404“, Feldnamen und Struktur festhalten; Beispielwerte durch Contoso-Platzhalter ersetzen.
- Voraussetzung: Live-Modus eingerichtet (siehe README › „Live-Modus einrichten“), Admin-Consent erteilt, Anmeldung mit einem Nutzer mit passender Rolle.

## Vorbereitung

1. App im Live-Modus starten (`VITE_APP_MODE=live`, `npm run dev`), anmelden.
2. Browser-Entwicklertools › **Netzwerk**, Filter `graph.microsoft.com`, „Log beibehalten“ aktivieren.
3. Pro Prüfpunkt Anfrage anklicken: **Status**, **Vorschau/Antwort** (nur Struktur ansehen) und die URL (unter „Headers“) notieren.

## 1. `$filter=deviceName eq …` auf v1.0 – 200 oder 400?

- **Schritt:** Auf der Startseite exakt den Namen eines bekannten Geräts suchen (Name im Admin Center nachsehen).
- **Beobachten:** `GET https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$filter=deviceName eq '…'&$select=…`
- **Erwartetes Ergebnis:**
  - **200** mit `value` (Treffer oder leer): Der Filter funktioniert auch auf v1.0. Der Fallback über die paginierte Liste wird bei exakter Suche nicht ausgelöst.
  - **400** (`BadRequest`): Der Filter wird auf v1.0 nicht unterstützt. Die App fällt dann auf die paginierte Liste ohne `$filter` zurück (zweite Anfrage `…/managedDevices?$select=…`, max. 5 Seiten, clientseitig gefiltert).
- **Dasselbe für die Teilstring-Suche:** Ein Fragment eingeben (z. B. die ersten Zeichen eines Gerätenamens) und `…?$filter=contains(deviceName,'…')` prüfen – 200 oder 400.
- **Anzupassen:**
  - 200 (eq und/oder contains): `docs/graph-api-reference.md` (Zeilen „Gerät suchen“) und Kommentar in `src/graph/endpoints.ts` von „nur in Beta dokumentiert, live verifizieren“ auf „live verifiziert (Datum)“ ändern; README › „Bekannte Grenzen“ › „Suche“ entsprechend kürzen (nicht mehr „noch nicht verifiziert“).
  - 400: README/`docs/graph-api-reference.md` als „bestätigt: Fallback über paginierte Liste nötig“ markieren. Optional prüfen, ob die 5-Seiten-Grenze für große Mandanten reicht, und das in „Bekannte Grenzen“ vermerken.

## 2. Liefern `deviceCompliancePolicyStates` / `deviceConfigurationStates` die `settingStates` ohne `$expand`?

- **Schritt:** Ein Gerät mit mindestens einer nicht konformen Compliance-Richtlinie oder einem Konfigurationsprofil im Status Fehler/Konflikt öffnen.
- **Beobachten:**
  - `GET …/managedDevices/{id}/deviceCompliancePolicyStates`
  - `GET …/managedDevices/{id}/deviceConfigurationStates`
- **Erwartetes Ergebnis (Vorschau-Tab, nur Struktur):** Je Eintrag Felder wie `displayName`, `state`, `settingCount` – und prüfen, ob zusätzlich ein Array `settingStates` mit Einträgen (`setting`, `state`, `errorCode` …) vorhanden ist.
  - **`settingStates` vorhanden und gefüllt:** Einstellungsdetails kommen ohne `$expand`.
  - **`settingStates` fehlt oder ist leer, obwohl `settingCount > 0`:** Details gibt es nur mit zusätzlicher Anfrage (`$expand=settingStates` bzw. Einzelabruf je Richtlinie).
- **Anzupassen:**
  - Vorhanden: `docs/graph-api-reference.md` (Abschnitt „Bekannte Grenze“) und README › „Bekannte Grenzen“ › „Einstellungsdetails im Live-Modus“ auf „verifiziert“ umstellen; Hinweis „nicht dokumentiert“ streichen.
  - Fehlt: Prüfen, ob `$expand=settingStates` in der Doku ([deviceCompliancePolicyState](https://learn.microsoft.com/en-us/graph/api/resources/intune-deviceconfig-devicecompliancepolicystate?view=graph-rest-1.0), [deviceConfigurationState](https://learn.microsoft.com/en-us/graph/api/resources/intune-deviceconfig-deviceconfigurationstate?view=graph-rest-1.0)) belegt ist. Nur wenn ja, in `src/graph/endpoints.ts` ergänzen (URLs entstehen ausschließlich dort) und `docs/graph-api-reference.md` aktualisieren; sonst die Grenze in README/Referenz als „bestätigt: nur Richtlinienebene“ festhalten und die UI-Meldung beibehalten.

## 3. Neue Endpunkte aus M10

Die offenen Fragen je Endpunkt stehen als Checkliste in `docs/graph-api-reference.md` › „Live zu verifizieren (M10)“; dort auch abhaken. Vorgehen in der App:

- **Anmeldungen** (Scope `AuditLog.Read.All` per Admin-Consent erteilen; Tenant mit Entra ID P1/P2; Rolle z. B. Reports Reader): Windows-Gerät mit primärem Benutzer öffnen → `GET …/auditLogs/signIns?$filter=userId eq '…' and createdDateTime ge …&$top=200`. Erwartet 200; Einträge mit `deviceDetail.deviceId` = Entra-Geräte-ID. Bei 400: Filterkombination in `src/graph/endpoints.ts` (`signIns`) anpassen und Referenz/README nachziehen.
- **Windows LAPS** (Scope `DeviceLocalCredential.ReadBasic.All`): Windows-Gerät mit LAPS öffnen → `GET …/directory/deviceLocalCredentials/{deviceId}?$select=id,deviceName,lastBackupDateTime,refreshDateTime`. Erwartet 200 **ohne** `credentials`. Gerät ohne LAPS: Status notieren (404/leer) und den Mapper/Text in `src/graph/mappers.ts` bzw. `de-rules.ts` daran ausrichten.
- **Autopilot** (Scope `DeviceManagementServiceConfig.Read.All`): Autopilot-registriertes Windows-Gerät öffnen → `GET …/deviceManagement/windowsAutopilotDeviceIdentities` (+ Folgeseiten über `@odata.nextLink`). Seitengröße und ob `managedDeviceId` gefüllt ist notieren; bei großen Tenants prüfen, ob die 5-Seiten-Grenze (`MAX_LIST_PAGES`) reicht.
- **Gruppen**: `GET …/devices(deviceId='…')/transitiveMemberOf` – erwartet 200, Gruppen mit `displayName`.
- **Weitere Geräte**: `GET …/managedDevices?$filter=userPrincipalName eq '…'&$select=…` – erwartet 200.
- **Integritätsnachweis**: `GET …/managedDevices/{id}?$select=deviceHealthAttestationState` – Feldstruktur und Wertebeispiele (ohne Gerätebezug) notieren.

## 4. Erweiterungen aus M14

Die offenen Fragen stehen als Checkliste in `docs/graph-api-reference.md` › „Live zu verifizieren (M14)“. Der Verbindungstest der App (Ansicht „Verbindungstest“, nur Live) ruft jeden Endpunkt einmal auf und zeigt nur Status, Dauer, Anzahl und Feldnamen – daraus lässt sich der Bericht für diese Liste kopieren.

**Verbindungstest durchführen:** Live anmelden → Gerät öffnen (am besten ein Windows-Gerät mit primärem Benutzer, Richtlinien und Apps) → Menü „Mehr“ › „Verbindungstest“ → „Test starten“. Die App ruft jeden Endpunkt der Registry nacheinander genau einmal per `GET` auf (abbrechbar) und zeigt je Endpunkt Ergebnis (`ok | forbidden | notFound | badRequest | error`, übersprungene mit Grund), Dauer, Anzahl der Einträge und die **Namen** der Felder – keine Werte. Danach „Bericht kopieren (Markdown)“ und die Tabelle ohne Änderung in den PR bzw. unter die jeweiligen Punkte einfügen; der Bericht enthält weder Gerätenamen noch IDs. Auswertung: `forbidden` bei einem optionalen Scope = Admin-Consent bzw. Rolle fehlt (kein Fehler der App); `badRequest` = Query-Kombination nicht akzeptiert (Endpunkt in `src/graph/endpoints.ts` anpassen); `notFound` bei den abgeleiteten `…/assignments`-Aufrufen = die ID aus dem Gerätezustand ist nicht die Richtlinien-ID; Feldnamen mit `src/graph/dto.ts` vergleichen. Den Test nur in einem Tenant ausführen, in dem die knapp 30 Lesezugriffe (eine Anfrage je Endpunkt) erlaubt sind.

- **Zuweisungen** (Scope `DeviceManagementConfiguration.Read.All`, bereits beim Login): Gerät mit Richtlinien öffnen → `GET …/deviceConfigurations/{id}/assignments`, `…/deviceCompliancePolicies/{id}/assignments`, `…/deviceAppManagement/mobileApps/{id}/assignments`. Prüfen: (a) 200 oder 404 – und ob die `id` aus dem Gerätezustand die Richtlinien-ID ist (bei 404 / nicht-GUID zeigt die App „nicht auswertbar“); (b) Schreibweise von `target/@odata.type` (mit/ohne `#`); (c) `groupId`-Feld bei Gruppenzielen.
- **Lizenz** (Scope `LicenseAssignment.Read.All` per Admin-Consent; Konto mit z. B. Directory Readers / License Administrator): Gerät mit primärem Benutzer öffnen → `GET …/users/{id}/licenseDetails?$select=…`. Erwartet 200 mit `servicePlans[]`; notieren, ob `$select` akzeptiert wird (sonst 400 → `$select` in `src/graph/endpoints.ts` entfernen). Plan-IDs der Intune-Pläne gegen die Lizenz-Referenz prüfen.
- **Gerätelimit** (Scope `DeviceManagementServiceConfig.Read.All`): `GET …/deviceManagement/deviceEnrollmentConfigurations` und je Limit-Konfiguration `…/{id}/assignments`. Prüfen: `@odata.type` der Limit-Einträge, Feld `limit`, Form der Ziele und wie die Standardkonfiguration geliefert wird.
- **Sicherheitswarnungen** (Scope `SecurityAlert.Read.All` per Admin-Consent; Konto mit z. B. Security Reader / Global Reader): Gerät öffnen → `GET …/security/alerts_v2?$filter=serviceSource eq 'microsoftDefenderForEndpoint'&$top=100`. Erwartet 200 mit `evidence[]`; notieren, ob Filter und `$top` zusammen akzeptiert werden, ob `deviceEvidence` die `azureAdDeviceId` trägt und ob `@odata.nextLink` folgt. Ein bekanntes Gerät mit offener Warnung muss in der Kachel erscheinen; im Verbindungstest nur die Feldnamen notieren (keine Titel, IDs oder Benutzer).
- **Mandant** (Scope `DeviceManagementServiceConfig.Read.All`): Navigation › „Mandant“ → `GET …/deviceAppManagement/vppTokens` und `GET …/deviceManagement/applePushNotificationCertificate`. Erwartet 200; notieren, ob der Scope für die VPP-Token ausreicht (die Doku nennt außerdem `DeviceManagementApps.Read.All`), welche Werte `state`/`lastSyncStatus` liefern und ob Ablaufdaten mit dem Admin Center übereinstimmen. Wichtig: Die Antwort enthält `token` und `appleId` – nie in Berichte, Tickets oder Screenshots übernehmen.

## 5. Ansicht „Richtlinien“ (M15)

Checkliste: `docs/graph-api-reference.md` › „Live zu verifizieren (M15)“. Scope `DeviceManagementConfiguration.Read.All` (bereits beim Login). Der Verbindungstest ruft die sechs neuen Endpunkte mit auf (Liste → erste Richtlinie → Übersicht und Gerätestatus).

- Navigation › „Richtlinien“ → `GET …/deviceManagement/deviceConfigurations` und `…/deviceCompliancePolicies`, danach je Richtlinie `…/{id}/deviceStatusOverview` (höchstens 50). Prüfen: 200 ohne Query-Optionen; `@odata.type` vorhanden (Plattform-Spalte); Zähler stimmen mit dem Admin Center (Gerätestatus der Richtlinie) überein – notieren, wie Konflikte/„nicht konform“ gezählt werden.
- Eine Richtlinie mit bekannten Fehlern öffnen → `…/{id}/deviceStatuses`. Prüfen: Einträge vorhanden (bei Konfigurationsprofilen trotz Abkündigungshinweis ab Mai 2026), `deviceDisplayName` = Intune-Gerätename (Klick findet das Gerät), Form der `id`. Keine Gerätenamen/UPNs in Berichte übernehmen.

## 6. Sicherheits-Härtung (M16)

Trusted Types und die strenge CSP gelten **nur im Produktions-Build** (Meta-Tag per `cspPlugin`); `npm run dev` prüft sie nicht. Deshalb mit `VITE_APP_MODE=live` und den Entra-IDs bauen und lokal ausliefern: `npm run build && npx vite preview`, die Redirect-URI der App-Registrierung muss zur Preview-URL passen (`VITE_MSAL_REDIRECT_URI`).

- **Anmeldung funktioniert mit Trusted Types:** Konsole offen halten (Filter „Trusted Type“ und „Content Security Policy“). Anmelden (Redirect), Gerät öffnen, Verbindungstest laufen lassen. Erwartet: keine `TypeError`-/CSP-/„Trusted Type“-Meldungen, `securitypolicyviolation` bleibt leer. Zusätzlich prüfen: stille Token-Erneuerung im versteckten iframe (z. B. nach Ablauf des Access-Tokens ca. 60–90 Minuten nach der Anmeldung weiterarbeiten; die iframe-Anfrage an `login.microsoftonline.com` darf nicht blockiert werden) und manuelle Abmeldung.
- **Abmeldung bei Inaktivität:** mit `VITE_IDLE_TIMEOUT_MINUTES=2` bauen. Nach ca. 90 s ohne Eingabe erscheint der Hinweis „Bald abgemeldet“ (Klick „Angemeldet bleiben“ verlängert); nach 2 Minuten zeigt die Anmeldeseite „Aus Sicherheitsgründen … abgemeldet“, die Gerätedaten sind weg, „Zuletzt geöffnet“ ist leer. In einem zweiten Tab das Intune Admin Center offen halten: Dessen Sitzung muss bestehen bleiben (lokale Abmeldung, keine Weiterleitung zur Microsoft-Abmeldeseite). Die erneute Anmeldung muss nach Zugangsdaten fragen (`prompt=login` in der Autorisierungs-URL, Netzwerk-Tab).
- Findet sich eine Trusted-Types-Verletzung, die Meldung (ohne Tenant-Daten) im PR festhalten; Notausstieg: `require-trusted-types-for 'script'` in `vite.config.ts` entfernen (Details: `docs/tasks/M16-haertung.md`).

## 7. Dienststatus und Registrierungsfehler (M18)

Checkliste: `docs/graph-api-reference.md` › „Live zu verifizieren (M18)“. Der Verbindungstest ruft beide Endpunkte mit auf (nur Feldnamen).

- **Dienststatus** (Scope `ServiceHealth.Read.All` per Admin-Consent; Konto mit einer Admin-Rolle, z. B. Service Support Administrator): Navigation › „Mandant“ → `GET …/admin/serviceAnnouncement/healthOverviews?$expand=issues`. Prüfen: 200; Schreibweise der Enum-Werte; **wie `service` und `id` für Intune und Entra lauten** (Kachel „Dienststatus“ › „Alle gemeldeten Dienste“) – erkennt die App beide? Ohne Rolle bzw. Consent: Kachel „Fehlende Berechtigung“, in der Geräteansicht erscheint **kein** Hinweis. Mit offenem Intune-Vorfall: Hinweis über den Gerätekacheln, Sprung in die Kachel; Titel/Beschreibung mit dem Microsoft 365 Admin Center vergleichen. Keine Vorfalltexte in Berichte übernehmen (nur Status/Struktur).
- **Registrierungsfehler** (Scope `DeviceManagementManagedDevices.Read.All`, bereits beim Login): Navigation › „Mandant“ → `GET …/deviceManagement/troubleshootingEvents`. Prüfen: `@odata.type` der Einträge, Seitengröße und Reihenfolge, Form von `failureReason`; Zahlen mit dem Bericht Geräte › Überwachen › Registrierungsfehler vergleichen. Ein Gerät öffnen, dessen Benutzer kürzlich einen Fehlschlag hatte: erscheint der Befund in „Registrierung (Benutzer)“ (Abgleich über `userId`)? Keine Benutzer-IDs oder Gerätenamen in Berichte übernehmen.

## Abschluss

- Alle Punkte mit Datum und Ergebnis (nur Status/Struktur, keine Tenant-Daten) in einem PR festhalten und die genannten Dokumentationsstellen anpassen.
- `npm run check` ausführen; bei Änderungen an `endpoints.ts`/Mappern die zugehörigen Tests mitziehen (der GET-only-Test muss grün bleiben).
