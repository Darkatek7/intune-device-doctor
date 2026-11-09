# M12 – Analyse und Bedienung ohne neue API

Branch `feat/m12-m14`. Nutzt ausschließlich Daten, die Provider und ZIP-Analyse schon liefern – **keine neuen Graph-Endpunkte**. Zwei Stränge, parallel in Worktrees (sonnet); die Hauptsession führt zusammen, lässt `reviewer` laufen und committet.

Speicher: Vitest nur `--maxWorkers=2`, Playwright nur `--workers=1` mit eigenem `E2E_PORT`, Prüfschritte einzeln statt `npm run check`.

## Strang A – Zeitachse und wahrscheinlichste Ursache

### A1 – Zeitachse

- Reine Funktion `src/rules/timeline.ts`: `DeviceSnapshot (+ optional DiagnosticsReport) → TimelineEvent[]` (`time`, `kind`, `severity`, `title`, `detail`, `tileId`, `source`). Quellen: Registrierung (`enrolledDateTime`), letzter Check-in, Entra-Anmeldung (`approximateLastSignInDateTime`), Anmeldungen inkl. CA-Fehler (M10), LAPS-Sicherung/geplante Rotation, Autopilot-Kontakt, BitLocker-Schlüssel-Zeitpunkte, Defender-Scans/Signaturen, Ablauf MDM-/Apple-Push-Zertifikat, Schonfrist-Ende Compliance; aus dem ZIP: Sammelzeitpunkt, MDM-Ereignisse (gruppiert), IME-Fehler (Typ 3 nur als Hinweis), Zertifikatsabläufe. Nur Felder, die tatsächlich gesetzt sind; Zukunftstermine (Ablauf, Rotation) als „geplant“ markiert.
- UI: Schaltfläche „Zeitachse“ im Geräte-Header bzw. ZIP-Header → Sheet/Panel mit vertikaler Zeitachse (gruppiert nach Tag, neueste oben, Filter „nur Probleme“), Klick auf einen Eintrag öffnet die zugehörige Kachel. Apple-Design laut `docs/ui-guidelines.md`, Tastatur + Screenreader (Liste mit `<time>`), reduced-motion.
- Ticket-Notiz: optional die letzten 10 Problem-Ereignisse anhängen.

### A2 – Wahrscheinlichste Ursache

- Reine Funktion `src/rules/correlate.ts`: erkennt Muster über mehrere Kacheln und liefert 0–3 priorisierte `Insight`s (`title`, `explanation`, `steps[]`, `relatedTiles[]`, `docsUrl`). **Jede Verknüpfung braucht eine Microsoft-Learn-Quelle**, die den Zusammenhang belegt (Microsoft-Learn-MCP-Tools nutzen). Kandidaten – nur umsetzen, was belegt ist:
  - Kein PRT / Entra-Join-Problem (ZIP) **und** CA-Fehler bei Anmeldungen → zuerst Entra-Join/PRT beheben (Learn: PRT und gerätebasierter Conditional Access).
  - Gerät nicht konform / in Schonfrist **und** CA-Fehler 53000 → Compliance zuerst (Fehlercode-Seite + Compliance-Doku).
  - Letzter Check-in alt **und** Richtlinien/Apps mit Fehlern → Befunde sind evtl. veraltet; zuerst Synchronisierung/Erreichbarkeit klären.
  - Entra-Gerät deaktiviert **und** LAPS/CA-Befunde → deaktiviertes Gerät als Ursache.
  - MDM-Ereignis 76 (ZIP) **und** Enrollment-Befund → automatische Registrierung prüfen.
- UI: Karte „Wahrscheinlichste Ursache“ über dem Kachel-Grid (nur wenn mindestens ein Insight), mit „Warum?“-Aufklappbereich und Links zu den beteiligten Kacheln; Hinweis „Automatische Einschätzung aus den angezeigten Befunden“. In der Ticket-Notiz oben.
- Keine Insight, wenn ein beteiligter Bereich `forbidden`/`error` ist (keine Schlüsse aus fehlenden Daten).

## Strang B – Vergleich, Sammelprüfung, Lesezeichen

### B1 – Vorher/Nachher (Gerät)

- „Stand exportieren“ im Geräte-Header: lädt eine JSON-Datei (Schema-Version, Zeitpunkt, Modus, ausgewertete Kacheln mit Severity/Wert/Befund-IDs – **keine Rohdaten**, keine UPNs/Seriennummern) herunter. Nichts wird automatisch gespeichert.
- „Mit Stand vergleichen“: JSON-Datei wählen → Vergleichsansicht: pro Kachel alt → neu (besser/schlechter/gleich), neue und behobene Befunde. Datei bleibt lokal; Schema validieren, fremde Dateien sauber ablehnen.

### B2 – Zwei ZIPs vergleichen

- In der ZIP-Ansicht „Mit weiterer ZIP vergleichen“ → zweite Datei wird ebenfalls nur lokal analysiert; Vergleich wie B1 (gleiche Komponente), zusätzlich Sammelzeitpunkte beider Archive. Warnung, wenn die Gerätenamen nicht übereinstimmen.

### B3 – Sammelprüfung

- Neue Ansicht „Mehrere Geräte“ (Link in der Toolbar/Startseite): Gerätenamen einfügen (eine pro Zeile, max. 50) oder CSV/TXT wählen. Pro Name **nur** `provider.searchDevices` (eine Anfrage), höchstens 2 parallel, `Retry-After` respektieren, abbrechbar. Tabelle: Name, Treffer (0/1/mehrere), Plattform, Compliance, letzter Check-in (mit Severity nach den bestehenden Schwellwerten), Benutzer (Anzeigename). Zeile anklicken → Gerät öffnen. Export der Tabelle als CSV (lokal). Kein vollständiger Snapshot pro Gerät (Drosselung).
- Demo-Modus: funktioniert mit den Mock-Szenarien.

### B4 – Lesezeichen „In MDM Doctor öffnen“

- Seite/Dialog „Lesezeichen“ mit einem ziehbaren `javascript:`-Link (Bookmarklet): liest auf `intune.microsoft.com` die Geräte-ID aus der URL (Muster wie in `src/links/intunePortal.ts`, z. B. `mdmDeviceId/{id}` bzw. `managedDeviceId/{id}`) und öffnet `<App-URL>?device=<id>&mode=live` in neuem Tab; sonst kurze Meldung. App-URL = aktuelle Origin + Base. Kein Zugriff auf Inhalte der Intune-Seite außer `location.href`. Anleitung (Lesezeichenleiste) in `de.ts`.

## Akzeptanz

- [ ] Reine Funktionen (`timeline`, `correlate`, Vergleich, CSV-Import/-Export, Bookmarklet-URL-Parsing) mit Unit-Tests
- [ ] Jede Insight mit Learn-Quelle; keine Schlüsse aus `forbidden`/`error`-Bereichen
- [ ] Keine Daten verlassen den Browser; Exporte nur per Download
- [ ] Alle Texte in `de.ts`/`de-rules.ts`; A11y nach `docs/ui-guidelines.md`
- [ ] E2E für Zeitachse, Ursache-Karte, Sammelprüfung (Demo), Vergleich
- [ ] `npm run check` und E2E grün
