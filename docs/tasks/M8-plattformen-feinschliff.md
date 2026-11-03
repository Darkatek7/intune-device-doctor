# M8 – macOS/iOS/Android, Portal-Links, Feinschliff

Nach den ersten Live-Tests (11/2026). Schritte **der Reihe nach**; nach jedem Schritt `reviewer` (haiku), `npm run check` grün, Commit auf `feat/live-mode-fixes`. Am Ende pushen.

## Schritte

### S1 – Portal-Link „Managed Apps“ des Geräts
**Delegation:** Hauptsession (Link + Integration), `ui-builder` (sonnet) für die Link-Zeile im Geräte-Header.
- `IntunePortal.deviceManagedApps(id)` = `https://intune.microsoft.com/#view/Microsoft_Intune_ManagedDevices/ManagedDeviceMenu.MenuView/~/managedApps/managedDeviceId/{id}` (Portal-Adresse, undokumentiert – live vom Nutzer übernommen).
- Geräte-Header (nur Intune-Gerät): Links „Gerät im Admin Center“ und „Managed Apps“. Apps-Befunde verlinken zusätzlich auf „Managed Apps“.
- [x] Links öffnen in neuem Tab (`rel="noopener noreferrer"`), Texte in `de.ts`, A11y-Name eindeutig.

### S2 – „Nicht verfügbar“-Kacheln ohne Dreifach-Text
**Delegation:** `ui-builder` (sonnet).
- Detail-Sheet: Ist die einzige Section einer Kachel nicht `ok`, steht der Grund **einmal** (Befund-Karte); Kopfzeile/Zusammenfassung und Verfügbarkeits-Box wiederholen ihn nicht.
- [x] Unit-Test für Sheet mit `unavailable`-Kachel; bestehende Tests grün.

### S3 – Gerätefelder für macOS/iOS/Android (v1.0, kein neuer Scope)
**Delegation:** Hauptsession (Domain, Regeln, Texte, Quellen); `mock-data-writer` (haiku) für Demo-Szenarien iOS + Android; `test-writer` (haiku) für Regel-Tests.
- `managedDevice` (v1.0): `managementCertificateExpirationDate`, `isSupervised`, `androidSecurityPatchLevel`, `enrollmentProfileName` in DTO/Domain/Mapper.
- Gerätestatus: MDM-Zertifikat abgelaufen → critical, läuft in ≤ 30 Tagen ab → warning; Enrollment-Profil als Wert; iOS/iPadOS „Beaufsichtigt“ als Wert.
- Betriebssystem: Android-Sicherheitspatch als Wert, älter als `THRESHOLDS.androidPatchWarningDays` (90) → warning (eigener Schwellwert, keine Microsoft-Behauptung).
- Demo: `CONTOSO-IP015` (iPhone, nicht beaufsichtigt, Zertifikat läuft bald ab), `CONTOSO-AND21` (Android Enterprise, alter Patch).
- [x] Jeder Befund mit Microsoft-Learn-Quelle; unbekannte/leer gemeldete Felder → kein Befund.

### S4 – Apple MDM-Push-Zertifikat (Tenant)
**Delegation:** `graph-implementer` (sonnet) für Endpoint/DTO/Provider/Mock; Hauptsession für Regel + Doku; `test-writer` (haiku).
- `GET /deviceManagement/applePushNotificationCertificate?$select=expirationDateTime,lastModifiedDateTime` (v1.0), **neuer Scope** `DeviceManagementServiceConfig.Read.All` (Admin-Consent!). Kein `appleIdentifier` (Apple-ID = personenbezogen).
- Nur für macOS/iOS/iPadOS geladen; Befund in „Gerätestatus“: abgelaufen → critical, ≤ 30 Tage → warning. 403 → „Fehlende Berechtigung“ mit Scope, Rest unberührt.
- Der Scope ist **optional** (`OPTIONAL_SCOPES`) und wird beim Login nicht angefragt – ein fehlender Consent darf die Anmeldung nicht blockieren (AADSTS65001); nach erteiltem Consent ist er trotzdem im Token.
- Demo: `CONTOSO-IP015` – Apple-Push-Zertifikat läuft in 20 Tagen ab.
- [x] README (Scope-Tabelle) und `docs/graph-api-reference.md` ergänzen.

## Bewusst nicht (über dokumentierte API nicht verfügbar)
- Geräteinventar (Properties Catalog) – keine Graph-API.
- Letzter angemeldeter Benutzer (`usersLoggedOn`) – nur beta.
- Supportende macOS/iOS – Apple veröffentlicht keine offiziellen Daten.
- App-Status in Tenants, in denen `mobileAppIntentAndStates` leer ist – Kachel bleibt ausgeblendet.

## Bereits vorhanden
- Jailbreak/Root → kritischer Befund (`deviceStatus-jailbroken`).
- Ticket-Notiz enthält alle sichtbaren Kacheln.
