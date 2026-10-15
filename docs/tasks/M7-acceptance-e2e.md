# M7 – Abnahme mit Playwright (vor dem finalen PR)

Ziel: Die Hauptsession (Opus) nimmt den MVP **im echten Browser** ab – funktional per E2E-Tests und visuell per Screenshots gegen `docs/ui-guidelines.md`. Wird **nach M6 Schritt 5 und vor dem PR** ausgeführt.

Umgebung: Das Cloud-Environment installiert per Setup-Script Chromium inkl. Systemabhängigkeiten (`npx playwright@1.64.1 install --with-deps chromium`). Zusätzlich ist in `.mcp.json` der Playwright-MCP-Server (`@playwright/mcp`) konfiguriert – damit kann die Session die App interaktiv bedienen (Klicken, Tippen, Accessibility-Snapshot, Screenshot). Fehlt dort ein Browser, das MCP-Tool `browser_install` aufrufen.

**Delegation:** `test-writer` (haiku) schreibt die Specs nach Vorgabe; Hauptsession führt aus, sichtet Screenshots und entscheidet über Abnahme.

## Schritte
1. Dev-Dependencies: `@playwright/test@1.64.1` (Version muss zum installierten Browser passen), `@axe-core/playwright@^4.13.0`. Skripte: `"test:e2e": "playwright test"`, `"check:full": "npm run check && npm run test:e2e"`.
2. `playwright.config.ts`: `testDir: 'e2e'`, `webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true }`, `use.baseURL`, `trace: 'retain-on-failure'`, Reporter `list` + `html` (`open: 'never'`). Projekte: `desktop-light` (1440×900), `desktop-dark` (`colorScheme: 'dark'`), `mobile` (390×844, `isMobile`, `hasTouch`), `reduced-motion` (`reducedMotion: 'reduce'`). Nur Chromium.
3. Specs in `e2e/` (Demo-Modus, keine Netzwerkzugriffe außer localhost – per `page.route('**/*', …)` alles Fremde blockieren und als Testfehler werten, insbesondere `graph.microsoft.com`):
   - `search.spec.ts`: Startseite → Suche `CONTOSO-PC001` → 7 Kacheln, alle „In Ordnung“; `contoso-pc0` → Auswahlliste; unbekannter Name → Leerzustand.
   - `tiles.spec.ts`: je Szenario aus M1 die erwartete Severity der Schlüsselkachel; Klick öffnet Detail-Sheet mit Befund/Ursache/Lösung/Quelle; Escape schließt, Fokus zurück auf Kachel; komplette Bedienung nur per Tastatur.
   - `permissions.spec.ts`: `CONTOSO-PC050` zeigt „Fehlende Berechtigung“ inkl. Scope-Namen, Rest des Dashboards funktioniert.
   - `zip.spec.ts`: „Beispiel-ZIP analysieren“ → ZIP-Kacheln (Entra-Join & PRT critical, Win32-Apps mit `0x80070642`); zusätzlich Upload per `setInputFiles` mit dem in-memory erzeugten Fixture (`buildFixtureZip()`); prüfen, dass dabei **kein** Request das ZIP versendet.
   - `a11y.spec.ts`: axe-Scan (WCAG 2.1 AA) für Startseite, Dashboard und offenes Detail-Sheet – keine `serious`/`critical`-Verstöße.
   - `visual.spec.ts`: Screenshots (fullPage) nach `e2e-artifacts/<projekt>/<name>.png` für: Start, Dashboard gesund, Dashboard PC042, offenes Sheet, ZIP-Ansicht, Berechtigungsfall. Keine Pixel-Vergleiche (Baselines wären instabil), nur Erzeugung.
4. `npm run test:e2e` ausführen, Fehler beheben.
5. **Visuelle Abnahme durch die Hauptsession:** Alle PNGs aus `e2e-artifacts/` mit dem Read-Tool ansehen und gegen `docs/ui-guidelines.md` prüfen (Hierarchie, Abstände, Ausrichtung, Kontrast in Dark Mode, Mobil ohne horizontales Scrollen, Status nie nur über Farbe, abgeschnittene Texte). Gefundene Mängel beheben, Screenshots neu erzeugen, erneut prüfen. Optional per Playwright-MCP interaktiv nachprüfen (Sheet-Animation unterbrechen, Drag-to-dismiss mobil).
6. Abnahmeprotokoll `docs/acceptance.md`: Datum, ausgeführte Befehle + Ergebnis, Tabelle Akzeptanzkriterien M1–M6 (erfüllt/offen), gefundene und behobene UI-Mängel, bekannte Grenzen. 2–3 Screenshots (desktop-light Dashboard, desktop-dark Sheet, mobile) nach `docs/screenshots/` kopieren und in README einbinden – nur fiktive Demo-Daten sichtbar.

## Akzeptanz
- [x] `npm run check:full` grün in allen vier Projekten
- [x] Kein Request an andere Hosts als localhost während der E2E-Tests
- [x] Screenshots gesichtet, Mängel behoben, `docs/acceptance.md` vollständig
