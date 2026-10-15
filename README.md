# MDM Doctor

**One-Click Intune Device Troubleshooter** – Gerätename eingeben und sofort Gerätestatus, Compliance, letzten Check-in, OS-Version, BitLocker, Defender und fehlgeschlagene Richtlinien als klare Status-Kacheln sehen. Jede Kachel zeigt Befund, Ursache und Lösungsvorschläge. Zusätzlich lassen sich Intune-„Collect diagnostics“-ZIPs (`DiagLogs-*.zip`) direkt im Browser analysieren.

- **Read-only** – die App verändert keine Intune- oder Entra-Objekte.
- **Demo-Modus** mit realistischen, fiktiven Daten (Contoso) – keine Anmeldung nötig.
- **Live-Modus** über Microsoft Graph (MSAL, Authorization Code + PKCE), ausschließlich offiziell dokumentierte Endpunkte (`docs/graph-api-reference.md`).
- **ZIP-Analyse lokal** – Diagnose-Archive verlassen den Browser nie.

> Status: Hackathon-MVP (M1–M7 umgesetzt). Abnahmeprotokoll: [`docs/acceptance.md`](docs/acceptance.md).

<!-- SCREENSHOTS -->

## Schnellstart

```bash
npm install
npm run dev
```

Öffnen: http://localhost:5173 (Demo-Modus).

## Demo-Skript (3 Minuten)

Für die Präsentation im Demo-Modus (keine Anmeldung, nur fiktive Contoso-Daten):

1. **Gesundes Gerät (30 s):** Chip `CONTOSO-PC001` → sieben grüne Kacheln. Eine Kachel öffnen: „Alles in Ordnung“ mit geprüften Werten und Quelle (`GET …`). Zeigen: alles read-only, nur dokumentierte Graph-Endpunkte.
2. **BitLocker aus (30 s):** `CONTOSO-PC014` eintippen (⌘K/Strg+K) → Compliance und BitLocker rot. BitLocker-Kachel: Befund · Ursache · nummerierte Lösung · Rohdaten · Link zur Microsoft-Dokumentation.
3. **Richtlinienkonflikt (45 s):** `CONTOSO-PC042` → Richtlinien „2 Probleme“: Konflikt (beteiligte Profile) und Fehler `0x87D1FDE8` mit belegter Deutung; Compliance in Schonfrist; Windows 11 23H2 kurz vor Supportende. Hinweis auf die offen ausgewiesene Settings-Catalog-Lücke. „Ticket-Notiz kopieren“ zeigen.
4. **Beispiel-ZIP (45 s):** Startseite › „Beispiel-ZIP analysieren“ → Entra-Join & PRT rot (Attempt Status `0xc000023c`, HTTP Error `0x80072ee7` mit Microsoft-Learn-Deutung), Win32-App `0x80070642` (= Win32 1602, Installation abgebrochen). „Mit Intune-Daten zusammenführen“ → elf Kacheln in einer Ansicht. Betonen: Datei verlässt den Browser nie.
5. **Berechtigungsfall (30 s):** `CONTOSO-PC050` → Richtlinien und BitLocker zeigen „Fehlende Berechtigung“ inkl. Scope (`DeviceManagementConfiguration.Read.All`, `BitlockerKey.ReadBasic.All`); der Rest des Dashboards funktioniert.

Weitere Szenarien: `CONTOSO-PC027` (Defender: Signaturen veraltet, Neustart, behandelte Bedrohung), `CONTOSO-PC033` (Check-in vor 41 Tagen), `CONTOSO-LT108` (Windows 10, Entra-Gerät deaktiviert), `CONTOSO-MAC07` (macOS, FileVault, Defender nicht anwendbar). Mehrdeutige Suche: `contoso-pc0`.

## DiagLogs-ZIP analysieren

Im Intune Admin Center › Geräte › _Gerät_ › „Diagnosedaten sammeln“ erzeugtes Archiv (`DiagLogs-<Gerät>-<Zeitstempel>.zip`) auf die Startseite ziehen oder über „Datei auswählen“ öffnen. Die Analyse läuft in einem Web Worker komplett im Browser: Es wird nur das Inhaltsverzeichnis gelesen und Texteinträge bei Bedarf entpackt; Binärdateien (`.evtx`, `.etl`, `.cab`) werden übersprungen. UPN, Tenant-ID und GUIDs werden in der Anzeige maskiert, die Push-ChannelURI wird verworfen. Gibt es im aktuellen Modus ein Gerät mit gleichem Namen, lassen sich ZIP- und Intune-Befunde zusammenführen.

## Live-Modus einrichten

Der Live-Modus liest Gerätedaten **read-only** (nur HTTP GET) über Microsoft Graph. Anmeldung per MSAL (Authorization Code + PKCE, Redirect-Flow); Token-Cache in `sessionStorage`.

1. **App registrieren:** Entra Admin Center › App-Registrierungen › Neue Registrierung (einzelner Mandant).
2. **Plattform:** Authentifizierung › Plattform hinzufügen › **Single-page application** (nicht „Web“, sonst `AADSTS9002326`). **Redirect-URI** `http://localhost:5173` (bzw. die URL, unter der die App gehostet wird; muss exakt mit `VITE_MSAL_REDIRECT_URI` bzw. dem Origin übereinstimmen).
3. **API-Berechtigungen** (Microsoft Graph, **delegiert**) – genau diese, keine Schreibrechte:

   | Scope                                     | Zweck                                                                    |
   | ----------------------------------------- | ------------------------------------------------------------------------ |
   | `User.Read`                               | Anmeldung/Profil                                                         |
   | `DeviceManagementManagedDevices.Read.All` | Geräte, Defender, Compliance-Status                                      |
   | `DeviceManagementConfiguration.Read.All`  | Konfigurationsprofil-Status                                              |
   | `Device.Read.All`                         | Entra-Geräteobjekt                                                       |
   | `BitlockerKey.ReadBasic.All`              | Nur ob ein BitLocker-Schlüssel hinterlegt ist (nie der Schlüssel selbst) |

   Anschließend **Admin-Consent** für den Mandanten erteilen (alle Intune-Scopes und `BitlockerKey.ReadBasic.All` erfordern ihn).

4. **Konfiguration:** `.env.example` nach `.env.local` kopieren und setzen:

   ```bash
   VITE_APP_MODE=live
   VITE_MSAL_CLIENT_ID=<Anwendungs-(Client-)ID>
   VITE_MSAL_TENANT_ID=<Verzeichnis-(Mandanten-)ID>
   # optional, Standard ist der aktuelle Origin
   VITE_MSAL_REDIRECT_URI=http://localhost:5173
   ```

   Ohne Client- und Tenant-ID bleibt der Live-Modus deaktiviert; der Demo-Modus funktioniert unverändert. Dev-Server nach Änderungen an `.env.local` neu starten.

5. **Rollen der Nutzer:** Delegierter Zugriff = Schnittmenge aus Consent-Scopes und den Rechten des angemeldeten Nutzers. Ausreichend sind z. B. Intune-RBAC „Read Only Operator“ oder Entra „Global Reader“, „Helpdesk Administrator“, „Security Reader“, „Intune Administrator“. BitLocker-Metadaten sehen zusätzlich nur z. B. Cloud Device Administrator, Helpdesk Administrator, Intune Service Administrator, Security Reader, Global Reader. Fehlt etwas, zeigt die jeweilige Kachel „Fehlende Berechtigung“ mit dem benötigten Scope; der Rest des Dashboards funktioniert weiter.

Hinweise: Bei Drosselung (HTTP 429/503) wartet der Client gemäß `Retry-After` (sonst Backoff 1 s, 2 s) und versucht es insgesamt bis zu dreimal. Die Teilstring-Suche nutzt `contains(deviceName, …)`; lehnt Graph den Filter mit HTTP 400 ab, wird clientseitig über die paginierte Geräteliste (max. 5 Seiten) gefiltert. Konfigurationsprofile aus dem Settings Catalog sind über die dokumentierten APIs nicht vollständig abrufbar. Die verwendeten Endpunkte stehen in `docs/graph-api-reference.md`.

## Befehle

| Befehl               | Zweck                                                      |
| -------------------- | ---------------------------------------------------------- |
| `npm run dev`        | Entwicklungsserver                                         |
| `npm run check`      | Lint, Typecheck, Tests, Build (Definition of Done)         |
| `npm run fixture`    | Synthetisches DiagLogs-Test-ZIP erzeugen                   |
| `npm run test:e2e`   | Playwright-E2E inkl. axe-Scan und Screenshots (4 Projekte) |
| `npm run check:full` | `check` + E2E                                              |

## Datenschutz

- Echte Diagnose-ZIPs enthalten personen- und tenantbezogene Daten. Sie werden ausschließlich lokal im Browser verarbeitet (kein Upload, kein `fetch` im Analysepfad) und dürfen nicht ins Repository (`.gitignore` sperrt `*.zip`, `*.cab`, `*.evtx`, `*.etl`).
- Die „Ticket-Notiz“ wird nur in die lokale Zwischenablage kopiert.
- Der Live-Modus liest nur (HTTP GET); BitLocker-Schlüsselwerte werden nie abgefragt (kein `$select=key`), es geht nur um die Frage, ob ein Schlüssel hinterlegt ist.
- Demo- und Testdaten sind fiktiv (Contoso, `contoso.com`).

## Bekannte Grenzen

- **Settings Catalog:** Gerätebezogene Zustände von Settings-Catalog-Profilen liefert die dokumentierte Graph-v1.0-API nicht; die Richtlinien-Kachel weist das offen aus (Status im Intune Admin Center prüfen). Undokumentierte Beta-Reports werden bewusst nicht genutzt.
- **Einstellungsdetails im Live-Modus:** Ob `deviceCompliancePolicyStates`/`deviceConfigurationStates` die `settingStates` ohne `$expand` liefern, ist nicht dokumentiert; ohne sie zeigt die App Befunde auf Richtlinienebene.
- **Suche:** `$filter` auf `deviceName` ist nur in der Beta-Ressource dokumentiert; bei HTTP 400 fällt die App auf die paginierte Liste (max. 5 Seiten) zurück. Gegen einen echten Tenant noch nicht verifiziert.
- **App-Status pro Gerät** (Intune-Apps) ist über dokumentierte v1.0-Endpunkte nicht verfügbar; Win32-App-Zustände gibt es nur aus dem DiagLogs-ZIP.
- **Windows-Edition** (Home/Pro vs. Enterprise) meldet Graph v1.0 nicht; Supportenden werden für Enterprise/Education bewertet, Home/Pro als Hinweis.
- **Binärlogs** (`.evtx`, `.etl`, `.cab`) und OEM-Codepage-Ausgaben (ipconfig, certutil) werden im MVP nicht ausgewertet. dsregcmd läuft bei der Diagnosesammlung nicht im Benutzerkontext; SSO-/Benutzerstatus kann abweichen (wird im Befund erwähnt).
- **macOS/iOS/Android:** Kein hinterlegter Supportstatus für das Betriebssystem (Kachel „ohne Bewertung“).

## Dokumentation

- `docs/PLAN.md` – Gesamtplan
- `docs/graph-api-reference.md` – verifizierte Graph-Endpunkte, Felder, Scopes
- `docs/diaglogs-format.md` – Aufbau der DiagLogs-ZIPs
- `docs/ui-guidelines.md` – Designregeln
- `CLAUDE.md` – Arbeitsregeln für Claude Code
