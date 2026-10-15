# MDM Doctor

**One-Click Intune Device Troubleshooter** – Gerätename eingeben und sofort Gerätestatus, Compliance, letzten Check-in, OS-Version, BitLocker, Defender und fehlgeschlagene Richtlinien als klare Status-Kacheln sehen. Jede Kachel zeigt Befund, Ursache und Lösungsvorschläge. Zusätzlich lassen sich Intune-„Collect diagnostics“-ZIPs (`DiagLogs-*.zip`) direkt im Browser analysieren.

- **Read-only** – die App verändert keine Intune- oder Entra-Objekte.
- **Demo-Modus** mit realistischen, fiktiven Daten (Contoso) – keine Anmeldung nötig.
- **Live-Modus** über Microsoft Graph (MSAL, Authorization Code + PKCE), ausschließlich offiziell dokumentierte Endpunkte (`docs/graph-api-reference.md`).
- **ZIP-Analyse lokal** – Diagnose-Archive verlassen den Browser nie.

> Status: Grundgerüst. Umsetzung nach `docs/PLAN.md` und `docs/tasks/`.

## Schnellstart

```bash
npm install
npm run dev
```

Öffnen: http://localhost:5173 (Demo-Modus).

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

| Befehl            | Zweck                                              |
| ----------------- | -------------------------------------------------- |
| `npm run dev`     | Entwicklungsserver                                 |
| `npm run check`   | Lint, Typecheck, Tests, Build (Definition of Done) |
| `npm run fixture` | Synthetisches DiagLogs-Test-ZIP erzeugen           |

## Datenschutz

Echte Diagnose-ZIPs enthalten personen- und tenantbezogene Daten. Sie werden ausschließlich lokal im Browser verarbeitet und dürfen nicht ins Repository (`.gitignore` sperrt `*.zip`).

## Dokumentation

- `docs/PLAN.md` – Gesamtplan
- `docs/graph-api-reference.md` – verifizierte Graph-Endpunkte, Felder, Scopes
- `docs/diaglogs-format.md` – Aufbau der DiagLogs-ZIPs
- `docs/ui-guidelines.md` – Designregeln
- `CLAUDE.md` – Arbeitsregeln für Claude Code
