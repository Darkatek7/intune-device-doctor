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

1. Entra Admin Center › App-Registrierungen › Neue Registrierung, Plattform **Single-page application**, Redirect-URI `http://localhost:5173`.
2. API-Berechtigungen (Microsoft Graph, **delegiert**): `User.Read`, `DeviceManagementManagedDevices.Read.All`, `DeviceManagementConfiguration.Read.All`, `Device.Read.All`, `BitlockerKey.ReadBasic.All` – anschließend **Admin-Consent** erteilen.
3. `.env.example` nach `.env.local` kopieren, `VITE_MSAL_CLIENT_ID` und `VITE_MSAL_TENANT_ID` eintragen.
4. Angemeldete Nutzer brauchen eine lesende Rolle, z. B. Intune „Read Only Operator“ oder Entra „Global Reader“.

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run check` | Lint, Typecheck, Tests, Build (Definition of Done) |
| `npm run fixture` | Synthetisches DiagLogs-Test-ZIP erzeugen |

## Datenschutz

Echte Diagnose-ZIPs enthalten personen- und tenantbezogene Daten. Sie werden ausschließlich lokal im Browser verarbeitet und dürfen nicht ins Repository (`.gitignore` sperrt `*.zip`).

## Dokumentation

- `docs/PLAN.md` – Gesamtplan
- `docs/graph-api-reference.md` – verifizierte Graph-Endpunkte, Felder, Scopes
- `docs/diaglogs-format.md` – Aufbau der DiagLogs-ZIPs
- `docs/ui-guidelines.md` – Designregeln
- `CLAUDE.md` – Arbeitsregeln für Claude Code
