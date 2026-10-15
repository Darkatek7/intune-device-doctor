# MDM Doctor – One-Click Intune Device Troubleshooter (Hackathon-MVP)

## Context
Leerer Ordner `/Users/theel/Documents/MDMDoctor`. Ziel: Web-Dashboard für IT-Admins – Gerätename eingeben → Status-Kacheln (Gerätestatus, Compliance, letzter Check-in, OS, BitLocker, Defender, fehlgeschlagene Richtlinien), jede Kachel klickbar mit Befund / Ursache / Lösung. Zusätzlich: Intune-„Collect diagnostics“-ZIPs (`DiagLogs-<Gerät>-<Zeitstempel>.zip`, z. B. in `~/Downloads`) lokal im Browser analysieren. Zwei Modi (Demo/Live) hinter einer gemeinsamen Provider-Schnittstelle, strikt read-only, nur offiziell dokumentierte Graph-APIs.

Ablauf: **Lokal** lege ich Grundgerüst, Doku, Agent-Definitionen und Aufgabenliste an und pushe in ein **öffentliches** Repo `Darkatek7/intune-device-doctor`. **Gecodet** wird danach in **einer** Claude-Cloud-Session, die Meilensteine nacheinander abarbeitet und an Sonnet-/Haiku-Subagents delegiert. UI auf **Deutsch**. Nur dokumentierte APIs (keine undokumentierten Beta-Reports).

Wichtige Rahmenbedingungen aus der Analyse:
- Node ist lokal **nicht installiert** → lokal nur Dateien schreiben, `npm install`/Build/Tests passieren in der Cloud.
- Die echten ZIPs enthalten Kundendaten (Tenant, UPNs, Gerätenamen) → **niemals ins (öffentliche) Repo**; `.gitignore` sperrt `*.zip`. Tests nutzen ein **synthetisches** Fixture-ZIP, das ein Skript aus dem dokumentierten Format erzeugt (Contoso-Daten).
- Cloud-Session hat keinen Zugriff auf `~/Downloads` → ZIP-Analyse läuft komplett clientseitig (Drag & Drop, kein Upload); Test mit echten ZIPs später lokal im Browser.
- Aufräumen: Der Haiku-Analyse-Agent hat versehentlich zwei temporäre Dateien im Home-Verzeichnis angelegt → lösche ich im ersten Schritt.

## Verifizierte Graph-APIs (Microsoft Learn, gegengeprüft)
Alle Aufrufe delegiert, MSAL Auth-Code + PKCE (SPA-Plattform-Redirect, sonst AADSTS9002326). Graph erlaubt CORS (`Access-Control-Allow-Origin: *`, `Retry-After` exposed).

| Kachel | Endpoint | Version | Scope |
|---|---|---|---|
| Suche/Gerät, Status, Check-in, OS, Compliance-Gesamt, BitLocker (`isEncrypted`) | `GET /deviceManagement/managedDevices?$filter=deviceName eq '…'` + `GET …/managedDevices/{id}` | v1.0 (Filter `eq`/`contains` laut Beta-Doku – live verifizieren, Fallback clientseitig) | `DeviceManagementManagedDevices.Read.All` |
| Defender | `GET …/managedDevices/{id}/windowsProtectionState` (+ `/detectedMalwareState`) | v1.0 | dto. |
| Compliance-Details | `GET …/managedDevices/{id}/deviceCompliancePolicyStates` (settingStates mit `errorCode`/`errorDescription`) | v1.0 (in SDK/Metadaten, keine REST-Seite) | dto. |
| Konfig-Profile | `GET …/managedDevices/{id}/deviceConfigurationStates` | v1.0 (wie oben; **Settings Catalog nicht abgedeckt** → Kachel weist Lücke offen aus) | `DeviceManagementConfiguration.Read.All` |
| Entra-Gerät | `GET /devices?$filter=deviceId eq '{azureADDeviceId}'` (accountEnabled, trustType, approximateLastSignInDateTime, isCompliant) | v1.0 | `Device.Read.All` |
| BitLocker-Schlüssel vorhanden? | `GET /informationProtection/bitlocker/recoveryKeys?$filter=deviceId eq '…'` (nur Metadaten, **nie** `$select=key`) | v1.0 | `BitlockerKey.ReadBasic.All` |

Bewusst **nicht** im MVP: `managementState` (beta), `getConfigurationPoliciesReportForDevice` / `getDeviceInstallStatusReport` (undokumentiert), exportJobs (nur ReadWrite-Scopes), `createDeviceLogCollectionRequest` (schreibend). Phase 2 (optional): `logCollectionRequests` + `createDownloadUrl` (v1.0, POST ohne Gerätewirkung) → ZIP direkt aus Intune laden.
Fehler: Graph-Error-JSON `{error:{code,message,innerError:{request-id,date}}}`; 429 → `Retry-After`, sonst Exponential Backoff; 403 → „fehlende Berechtigung/Rolle/Lizenz“ mit benötigtem Scope. Alle Scopes erfordern Admin-Consent; nutzbar mit z. B. Intune Read Only Operator / Global Reader.

## Architektur
Vite + React 19 + TypeScript (strict) + Tailwind v4 + `motion` (Springs) + `@azure/msal-browser`/`@azure/msal-react` v5 + `@zip.js/zip.js` (lazy Entpacken) + Vitest/Testing Library. Reine SPA, kein Backend.

```
src/
  domain/        types.ts (ManagedDeviceSummary, DeviceSnapshot, SectionResult<T>, Tile, Finding, Severity)
  providers/     DeviceDataProvider.ts (Interface), mock/MockProvider.ts + scenarios/*, graph/GraphProvider.ts
  graph/         client.ts (nur GET, Retry/429, Fehler-Mapping), endpoints.ts, scopes.ts, dto.ts (exakt laut Doku), mappers.ts
  auth/          msalConfig.ts, AuthGate.tsx
  diagnostics/   zip/reader.ts, worker.ts, parsers/{entryName,resultsXml,dsregcmd,cmtrace,regExport,encoding}.ts, analyze.ts
  rules/         evaluate*.ts je Kachel (pure Functions Snapshot → Tile), knowledge/errorCodes.ts (nur Codes mit Quell-URL)
  ui/            SearchBar, DeviceHeader, TileGrid, StatusTile, DetailSheet, DropZone, ModeSwitch, States (Loading/Empty/Error/Forbidden)
  i18n/de.ts     alle UI-Texte zentral
scripts/make-fixture-zip.ts   synthetisches DiagLogs-ZIP (Contoso) für Tests
```
Kernidee: `DeviceDataProvider { searchDevices(q); getSnapshot(id) }`. `DeviceSnapshot` besteht aus unabhängigen `SectionResult<T>` = `ok | forbidden(missingScope) | unavailable(reason) | error(GraphError)` → jede Kachel lädt/fehlt einzeln, nie globaler Absturz. Regeln erzeugen `Tile {severity: ok|warning|critical|unknown, value, summary, findings[]}`; `Finding {title, cause, remediation[], evidence, source(endpoint|zip-entry), docsUrl}`. Modus über `VITE_APP_MODE=demo|live` + UI-Schalter; Live nur aktiv, wenn `VITE_MSAL_CLIENT_ID`/`VITE_MSAL_TENANT_ID` gesetzt → später Live-Betrieb nur per `.env.local`. Read-only abgesichert: GraphClient exportiert ausschließlich `get()`, Unit-Test prüft, dass kein anderes HTTP-Verb vorkommt.

**ZIP-Analyse** (Web Worker, nur Central Directory lesen, Text on demand, Binärdateien .evtx/.etl/.cab übersprungen): Parser für Entry-Namen (`/^\((\d+)\) (?:No Results - Error \[(0x[0-9A-F]{8})\] )?(RegistryKey|Command|Events|FoldersFiles) (.+)$/`), `results.xml` (fehlgeschlagene Sammlungen), `dsregcmd /status` (PRT, WamDefaultSet, DeviceAuthStatus, verschachtelte Diagnostics-Blöcke), IME-CMTrace-Logs (Typ 3 nur als Hinweis), `.reg`-Exporte UTF-16LE (Enrollments: EnrollmentState/ProviderID; IME `Win32Apps\…` Status/ErrorCode als signiertes HRESULT → Hex). Encodings: UTF-16LE/UTF-8-BOM/UTF-8; CP850-Ausgaben (ipconfig, certutil) im MVP nicht ausgewertet. Zusatz-Kacheln aus ZIP: Entra-Join & PRT, Win32-Apps, Enrollment, Sammel-Fehler. Lädt man ZIP + Live-Gerät gleichen Namens, werden Befunde zusammengeführt. Sensible Werte (UPN, Tenant-ID, ChannelURI) werden in der Anzeige maskiert.

## UI/UX (Apple-Design-Skill)
- Eine Seite: transluzente Toolbar (`backdrop-filter`, Scroll-Edge statt Linie) mit Suchfeld, Demo/Live-Pill, Konto. Leerer Zustand: großes Suchfeld + „oder DiagLogs-ZIP hierher ziehen“.
- Geräte-Header (Name, Modell, Nutzer, OS, „3 Probleme gefunden“), darunter Kachel-Grid (1/2/3/4 Spalten), Reihenfolge nach Schweregrad. Kachel: Status-Punkt + Farbe (systemnahe Grün/Orange/Rot/Grau, nie nur Farbe – plus Icon/Text), Titel, Hauptwert, eine Zeile Kontext.
- Klick → Detail-Sheet, das aus der Kachel heraus wächst (transform-origin = Kachel) und auf gleichem Weg zurückgeht; Abschnitte Befund · Ursache · Lösung (nummerierte Schritte) · Rohdaten (einklappbar) · Quelle + Doku-Link. Escape/Scrim schließt, Fokus-Falle.
- Motion: Springs `bounce: 0`, `duration ≈ 0.35`, Feedback auf Pointer-Down (`scale(0.97)`), Skeleton pro Kachel, unterbrechbar. `prefers-reduced-motion` → Crossfade, `prefers-reduced-transparency` → solide Flächen, `prefers-contrast` → Rahmen. Dark Mode. Systemschrift, negative Laufweite nur bei großen Titeln, Abstände in rem.
- Klare Zustände: lädt / nicht gefunden / mehrere Treffer (Auswahlliste) / Berechtigung fehlt (welcher Scope, welche Rolle) / Daten nicht verfügbar (z. B. Defender bei macOS) / Drosselung.

Demo-Szenarien (fiktiv, Contoso): gesund; nicht konform wegen BitLocker; Defender-Signaturen überfällig + Neustart nötig; Check-in > 30 Tage; Konfig-Konflikt + Fehlercode; Entra-PRT kaputt (Hybrid-Muster aus den echten ZIPs nachgebaut, anonymisiert); macOS-Gerät (Defender „nicht verfügbar“).

## Was ich lokal jetzt anlege
1. Streudateien `~/.dsreg_sections_*.txt` löschen.
2. Projektgerüst: `package.json` (aktuelle Versionen per npm-Registry ermittelt), `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/` mit Ordnerstruktur, **Domain-Typen + Provider-Interface + Graph-DTOs ausformuliert**, sonst Stubs mit TODO-Verweis auf Task; `.env.example`, `.gitignore` (inkl. `*.zip`, `.env*.local`), `README.md` (Setup, Entra-App-Registrierung, Scopes, Rollen, Datenschutz).
3. `CLAUDE.md`: Regeln (read-only, nur APIs aus `docs/graph-api-reference.md`, keine Kundendaten, deutsche UI, Apple-Design-Regeln, Definition of Done = `npm run lint && npm run typecheck && npm test && npm run build`), Ablauf der Meilensteine, Delegationsregeln.
4. `docs/`: `PLAN.md` (dieser Plan), `graph-api-reference.md` (verifizierte Tabelle oben inkl. Doku-URLs, Enums, Fehlerformen), `diaglogs-format.md` (anonymisierte Format-Spezifikation der ZIPs), `ui-guidelines.md` (Apple-Design kondensiert, Tokens), `tasks/M1…M6.md` mit Akzeptanzkriterien.
5. `.claude/agents/` (Model im Frontmatter):
   - `graph-implementer` – **sonnet**: Graph-Client, Provider, MSAL, Mapper.
   - `zip-parser-implementer` – **sonnet**: Worker + Parser + Analyzer.
   - `ui-builder` – **sonnet**: Komponenten nach ui-guidelines.
   - `mock-data-writer` – **haiku**: Demo-Szenarien, Fixture-Generator.
   - `test-writer` – **haiku**: Unit-Tests zu fertigen Modulen.
   - `reviewer` – **haiku**: prüft gegen CLAUDE.md-Regeln (read-only, keine erfundenen Endpunkte).
   Orchestrierung, Domain-Modell, Regeln/Lösungstexte und Integration macht die Hauptsession.
6. `git init`, Commit, `gh repo create Darkatek7/intune-device-doctor --public --source . --push`.

## Meilensteine in der Cloud-Session
| M | Inhalt | Delegation |
|---|---|---|
| M1 | `npm install`, Lint/Format/Vitest lauffähig, Domain-Typen, Mock-Provider + 7 Szenarien, i18n | haiku (Mocks), Haupt (Typen) |
| M2 | UI-Shell, Suche, Kachel-Grid, Detail-Sheet, Zustände, Motion/A11y – komplett im Demo-Modus | sonnet ui-builder |
| M3 | Regel-Engine je Kachel + Wissensbasis (Ursachen/Lösungen, Fehlercodes nur mit Quelle) + Tests | Haupt + haiku Tests |
| M4 | MSAL + GraphClient (GET-only, Retry, Fehler-Mapping) + GraphProvider + Mapper, Tests mit gemocktem fetch | sonnet graph-implementer + haiku Tests |
| M5 | ZIP-Analyse: Worker, Parser, Zusatz-Kacheln, Merge mit Gerät, Fixture-Generator + Tests | sonnet zip-parser + haiku Fixtures/Tests |
| M6 | Feinschliff: Dark Mode, Reduced-Motion/Transparency, Leer-/Fehlerzustände, README-Demo-Skript, reviewer-Lauf | sonnet + haiku reviewer |
Nach jedem Meilenstein: DoD-Befehle grün, Commit, Push auf Branch `mvp`, PR am Ende.

## Cloud-Environment (Formular aus deinem Screenshot)
- **Name:** `MDMDoctor`
- **Network access:** `Trusted` (npm-Registry + GitHub reichen; Graph wird in der Cloud nicht aufgerufen)
- **Network secrets:** keine
- **Setup script:**
  ```bash
  #!/bin/bash
  set -e
  npm install
  ```
- **Environment variables:** `VITE_APP_MODE=demo`
Danach starte ich die Cloud-Session mit dem Brief „Arbeite `docs/tasks/M1–M6` gemäß `CLAUDE.md` ab“.

## Verifikation
- Cloud: pro Meilenstein `npm run lint && npm run typecheck && npm test && npm run build`; Tests decken Parser (gegen synthetisches ZIP), Regeln (je Szenario erwartete Severity), GraphClient (429/403/404-Mapping, nur GET), Provider-Austauschbarkeit (gleiche Snapshot-Form).
- Lokal danach (Node per `brew install node` nötig): `npm run dev` → Demo-Szenarien durchklicken; echte `DiagLogs-*.zip` per Drag & Drop laden → erwartete Befunde: AzureAdPrt = NO mit Attempt-Status-Code, WamDefaultSet-Fehler, fehlgeschlagene Win32-Apps (z. B. 0x80070642), fehlgeschlagene Sammlungen aus results.xml.
- Live (später): Entra-App (SPA, Redirect `http://localhost:5173`), Scopes oben + Admin-Consent, `.env.local` setzen, Modus „Live“, Testgerät suchen; Netzwerk-Tab prüfen: nur GET-Requests an graph.microsoft.com.
