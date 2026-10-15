# Abnahmeprotokoll – MDM Doctor Hackathon-MVP

**Datum:** 15.10.2026 · **Branch:** `hackathon-mvp` (Basis `main` a315ceb) · **Abnahme:** Hauptsession (Opus) mit Playwright (Chromium 156, `@playwright/test` 1.64.1) und Playwright-MCP für interaktive Prüfungen.

## Ausgeführte Befehle und Ergebnis

| Befehl                                                                                         | Ergebnis                                                    |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `npm run check` (ESLint, `tsc` app + node, Vitest, `vite build`)                               | grün – 40 Testdateien, 684 Tests; Build ok                  |
| `npm run test:e2e` (4 Projekte: desktop-light, desktop-dark, mobile, reduced-motion)           | grün – 116/116                                              |
| `npm run check:full`                                                                           | grün (Summe der beiden Zeilen oben)                         |
| Netzwerk-Guard in allen E2E-Tests                                                              | keine Anfrage an andere Hosts als localhost, kein Nicht-GET |
| axe-core (WCAG 2.0/2.1 A + AA) auf Startseite, Dashboard, offenem Sheet – in allen 4 Projekten | keine `serious`/`critical`-Verstöße                         |
| Jeder Meilenstein-Commit in einem sauberen `git worktree` geprüft (`npm run check`)            | grün                                                        |

Build (Demo-Pfad): `index` 195 kB (gzip 59 kB) + `react` 219 kB + `motion` 147 kB. MSAL (`token`, 256 kB) und Graph-Provider werden nur im Live-Modus geladen; Worker-Chunk für die ZIP-Analyse 59 kB.

## Akzeptanzkriterien

| Meilenstein | Kriterium                                                                                          | Status                                                                                                                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1          | `npm run check` grün, Lockfile committet                                                           | erfüllt                                                                                                                                                                                                                      |
| M1          | 8 Szenarien abrufbar, Felder typkonform zu Graph-Enums                                             | erfüllt (Test prüft u. a. alle 26 `productStatus`-Werte; Korrektur: `rebootPending` ist kein productStatus-Wert)                                                                                                             |
| M1          | Keine echten Namen/IDs in Mock-Daten                                                               | erfüllt (Contoso, `contoso.com`, Demo-GUIDs, `DEMO-…`-Seriennummern)                                                                                                                                                         |
| M2          | Gerätename → Kacheln progressiv, Klick öffnet Sheet, Escape schließt, Fokus zurück                 | erfüllt (Unit + E2E, auch reine Tastaturbedienung)                                                                                                                                                                           |
| M2          | Mehrdeutige Suche → Auswahl, unbekannter Name → Leerzustand                                        | erfüllt                                                                                                                                                                                                                      |
| M2          | Mobil (390 px) und Desktop sauber, Dark Mode korrekt                                               | erfüllt (Screenshots gesichtet, kein horizontales Scrollen)                                                                                                                                                                  |
| M2          | Komponententests Suche → Kacheln, Sheet per Tastatur                                               | erfüllt                                                                                                                                                                                                                      |
| M3          | Jedes Szenario erzeugt die erwarteten Severities (festes `now`)                                    | erfüllt                                                                                                                                                                                                                      |
| M3          | Jeder Befund hat Ursache, ≥ 1 Lösung, Quelle                                                       | erfüllt (Test über alle Szenarien und Kacheln)                                                                                                                                                                               |
| M3          | Kein Wissensbasis-Eintrag ohne `docsUrl`                                                           | erfüllt (Test erzwingt Microsoft-Learn-URL)                                                                                                                                                                                  |
| M4          | Ohne `.env.local` bleibt Live deaktiviert, Demo unverändert                                        | erfüllt                                                                                                                                                                                                                      |
| M4          | Kein Code-Pfad sendet etwas anderes als GET an graph.microsoft.com                                 | erfüllt (Client bietet nur `get`/`getAllPages`; Spy-Test über komplette Snapshot-Ladung; statischer Wächter-Test)                                                                                                            |
| M4          | Alle URLs aus `endpoints.ts`                                                                       | erfüllt (nextLink nur auf `https://graph.microsoft.com/`)                                                                                                                                                                    |
| M5          | Fixture → PRT fehlt, WamDefaultSet-Fehler, 1 Failed-App `0x80070642`, 2 fehlgeschlagene Sammlungen | erfüllt                                                                                                                                                                                                                      |
| M5          | Großes ZIP friert UI nicht ein, Speicher moderat                                                   | erfüllt per Design: Web Worker, nur Central Directory + Text-Einträge on demand (8 MiB, .reg 32 MiB), Binärdateien nie entpackt. **Nicht** mit einem echten 100-MB-Archiv gemessen (keine echten ZIPs in der Cloud-Session). |
| M5          | Datei wird nirgends hochgeladen                                                                    | erfüllt (kein `fetch` im Analysepfad – Unit-Test mit werfendem Spy; E2E-Upload ohne Netzwerkanfragen)                                                                                                                        |
| M6          | `npm run check` grün, PR offen                                                                     | `check` grün; PR siehe unten                                                                                                                                                                                                 |
| M6          | Reviewer-Befunde behoben oder begründet                                                            | erfüllt (siehe „Reviews“)                                                                                                                                                                                                    |
| M7          | `npm run check:full` grün in allen vier Projekten                                                  | erfüllt                                                                                                                                                                                                                      |
| M7          | Kein Request an andere Hosts als localhost                                                         | erfüllt                                                                                                                                                                                                                      |
| M7          | Screenshots gesichtet, Mängel behoben, dieses Protokoll                                            | erfüllt                                                                                                                                                                                                                      |

## Visuelle Abnahme – gefundene und behobene Mängel

Gesichtet gegen `docs/ui-guidelines.md` (Hierarchie, Abstände, Kontrast, mobil, Status nie nur über Farbe, abgeschnittene Texte):

| Mangel                                                                                                                         | Behebung                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Kacheltitel „Microsoft Defe…“ abgeschnitten                                                                                    | Titel „Defender“                                                                    |
| Kachelzeilen abgeschnitten („Wiederherstellungsschlüssel in Entr…“, Defender-Signatur + Scan, ZIP-Kacheln mit UPN/Zeitstempel) | kürzere Zusammenfassungen; Details (UPN maskiert, Zeitstempel) in „Geprüfte Werte“  |
| Berechtigungsfall: Titel „Richt…“/„BitLo…“ abgeschnitten wegen langem Badge                                                    | Badge-Kurzform „Kein Zugriff“ (Schloss-Icon, volle Form als Tooltip und Kachelwert) |
| Rohe Enum-Werte im Befund („Zustand conflict“)                                                                                 | deutsche Zustandsnamen („Zustand Konflikt“)                                         |
| Header „1 unbekannt“                                                                                                           | „1 ohne Bewertung“                                                                  |
| Kacheltitel „Diagnose-Sam…“                                                                                                    | „Diagnosedaten“                                                                     |
| Kontrast < 4,5:1 (Akzent auf Canvas, Weiß auf Dark-Akzent, Secondary-Label, OK/Unknown-Farben)                                 | Tokens angehoben, `accent-fill` für weißen Text                                     |
| Dark + `prefers-contrast: more`: heller Separator überschrieb Dark-Werte                                                       | Media-Query-Reihenfolge korrigiert, sichtbare Rahmen                                |

Interaktiv per Playwright-MCP geprüft: Sheet öffnet als Morph aus der Kachel und schließt auf demselben Weg, mobiles Bottom-Sheet, Dark Mode, Beispiel-ZIP + Zusammenführen.

Restpunkt (nicht behoben, kosmetisch): Mit `scrollbar-gutter: stable` bleibt in Chromium ohne Overlay-Scrollbars rechts ein ~15 px breiter Streifen neben der Toolbar in Canvas-Farbe sichtbar (verhindert dafür Layout-Sprünge beim Öffnen des Sheets).

## Reviews (Subagent `reviewer`, je Meilenstein)

- **M1:** keine Verstöße.
- **M2/M3:** englische Fehlercode-Titel → deutsch (Originaltext in Anführungszeichen), Doku-URLs zentral in `knowledge/docs.ts`. Begründet beibehalten: Texte der Wissensbasis liegen neben ihrer Quelle in `src/rules/knowledge/` (CLAUDE.md verortet die Wissensbasis dort; so ist die Quellenpflicht je Eintrag testbar). Wörtliche englische Microsoft-Fehlertexte werden bewusst als Zitat angezeigt.
- **M4:** BitLocker-Felder in der Referenz belegt, nicht dokumentierte DTO-Felder entfernt, Malware-Listen-Fehler wird als Hinweis ausgewiesen (keine falsche Entwarnung), 404 bei Entra/BitLocker → `unavailable`.
- **M5:** GUIDs und Benutzerpfade in IME-Logmeldungen/Pfaden maskiert, unbelegte HRESULT-Kurzdeutungen entfernt (generisch über Win32-Tabelle oder „Unbekannter Code“), Texte nach `src/i18n`.
- **Test-Writer-Funde:** 4 productStatus-Flags gingen verloren (behoben); bekannte Codes als „unbekannt“ gemeldet und fehlende Join-Felder als „nicht verbunden“ gewertet (beide behoben).

## Bekannte Grenzen

Siehe README „Bekannte Grenzen“: Settings Catalog pro Gerät nicht dokumentiert, `settingStates` ohne `$expand` unbelegt, `$filter` auf `deviceName` nur in Beta-Doku (Fallback vorhanden), kein App-Status pro Gerät über v1.0, Windows-Edition unbekannt, Binärlogs nicht ausgewertet, Live-Modus nur mit gemocktem `fetch` getestet (kein Tenant in der Cloud-Session), keine Messung mit echten 100-MB-Archiven, Lighthouse nicht verfügbar (stattdessen axe-core + Kontrastberechnung).

## Umgebung / Workarounds

- Playwright-MCP (`@playwright/mcp@0.0.83`) erwartet Chromium-Revision 1247, installiert ist 1248 → Symlink `/opt/pw-browsers/chromium-1247 → chromium-1248` (nur Sitzungsumgebung, nicht im Repo).
- jsdom 30 meldet „EBADENGINE“ für Node 22.22.0 (verlangt 22.22.2); alle Tests laufen trotzdem.
- `git push` war in der Cloud-Session nicht möglich (HTTP 403, fehlende GitHub-App-Berechtigung) – siehe PR-Beschreibung.
