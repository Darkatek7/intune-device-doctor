# M1 – Fundament & Demo-Daten

**Delegation:** Hauptsession (Tooling, Typen-Review); `mock-data-writer` (haiku) für Szenarien.

## Schritte
1. `npm install` ausführen, `package-lock.json` committen. Prüfen, dass `npm run lint`, `npm run typecheck`, `npm test` (mit einem Smoke-Test `src/App.test.tsx`) und `vite build` laufen. ESLint-Flat-Config an die tatsächlichen Plugin-Exporte anpassen (react-hooks v7, react-refresh 0.5 – in `node_modules` nachsehen).
2. Domain-Typen (`src/domain/types.ts`) reviewen; nur ändern, wenn nötig (dann überall nachziehen).
3. Hilfsfunktionen `src/domain/format.ts`: `formatRelativeTime(iso, now)` (de), `formatDateTime`, `formatBytes`, `osFamilyFrom(operatingSystem)`, `maskUpn("max.mustermann@contoso.com") → "ma…@contoso.com"`, `hresultToHex(signedDecimal)`.
4. `src/providers/mock/MockProvider.ts` implementiert `DeviceDataProvider` mit künstlicher Latenz (120–600 ms pro Section, deterministisch per Seed), respektiert `AbortSignal`.
5. Szenarien `src/providers/mock/scenarios/*.ts` (fiktiv, Contoso; Datumswerte relativ zu „jetzt“ berechnen):
   | Gerät | Szenario | Erwartung |
   |---|---|---|
   | `CONTOSO-PC001` | Windows 11, alles gesund, Check-in vor 2 Std. | alle Kacheln ok |
   | `CONTOSO-PC014` | BitLocker aus (`isEncrypted false`), Compliance-Richtlinie mit Setting `BitLockerEnabled` nonCompliant, keine Recovery-Keys | Compliance + BitLocker critical |
   | `CONTOSO-PC027` | Defender: `signatureUpdateOverdue`, `rebootRequired`, `deviceState rebootPending`, 1 Malware (`quarantined`), productStatus `avSignaturesOutOfDate,pendingRebootDueToThreatAction` (`rebootPending` ist kein gültiger productStatus-Wert, nur deviceState) | Defender critical/warning |
   | `CONTOSO-PC033` | letzter Check-in vor 41 Tagen, Compliance `noncompliant` (abgelaufen), Entra `approximateLastSignInDateTime` alt | Check-in critical |
   | `CONTOSO-PC042` | Konfigurationsprofil `conflict` + Profil `error` mit `errorCode -2016281112` und errorDescription; Compliance `inGracePeriod` mit Ablaufdatum | Richtlinien critical, Compliance warning |
   | `CONTOSO-LT108` | Windows 10 22H2 (veraltet), Entra `accountEnabled false` | OS warning, Gerätestatus critical |
   | `CONTOSO-MAC07` | macOS, FileVault an (`isEncrypted true`), Defender → `notApplicable` | ok, Defender nicht anwendbar |
   | `CONTOSO-PC050` | Simuliert fehlende Berechtigung: configurationPolicies `forbidden` (Scope DeviceManagementConfiguration.Read.All), bitlockerKeys `forbidden` | Kacheln zeigen Berechtigungszustand |
   Außerdem: Suche nach `contoso-pc0` liefert mehrere Treffer; unbekannter Name → leeres Array.
6. Unit-Tests: MockProvider (Suche exakt/Teilstring/keine Treffer, Abort), `format.ts`.

## Akzeptanz
- [x] `npm run check` grün, Lockfile committet
- [x] 8 Szenarien abrufbar, alle Felder typkonform zu Graph-Enums
- [x] Keine echten Namen/IDs in Mock-Daten
