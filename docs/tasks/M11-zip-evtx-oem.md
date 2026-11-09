# M11 – DiagLogs-ZIP: Ereignisprotokolle (.evtx) und OEM-Codepage-Ausgaben

Zwei unabhängige Stränge, parallel in getrennten Worktrees (Delegation: `zip-parser-implementer`, sonnet). Beide ändern `analyze.ts`, `diagnostics/types.ts`, `rules/tiles/diagnostics.ts` und `de.ts` – Integrationsänderungen klein und lokal halten, die Hauptsession führt zusammen. Regeln aus `CLAUDE.md` gelten unverändert: nichts hochladen, Maskierung, Quellenpflicht, fiktive Testdaten.

## Strang A – OEM-Codepage (CP850) für Command-Ausgaben

### A1 – Dekodierung

- `src/diagnostics/parsers/encoding.ts`: CP850-Decoder (Tabelle für 0x80–0xFF; `TextDecoder` kennt CP850 nicht). Wird nur für bekannte OEM-Ausgaben ohne BOM verwendet (`ipconfig`, `certutil`, `pnputil` – Eintragsnamen in `docs/diaglogs-format.md`), sonst Verhalten unverändert. Tests mit Umlauten (ä ö ü ß Ä Ö Ü) in CP850-Bytes.

### A2 – Auswertung

- **certutil** (Zertifikatsspeicher-Ausgabe): Zertifikate mit Aussteller, Ablaufdatum („NotAfter“, deutsch/englisch lokalisiert – beide Formen), Antragsteller. Befund nur dort, wo eine Microsoft-Learn-Quelle die Bedeutung belegt (z. B. Intune-MDM-Gerätezertifikat abgelaufen / läuft in ≤ 30 Tagen ab, wenn Learn den Aussteller „Microsoft Intune MDM Device CA“ nennt – Quelle suchen und in `knowledge/docs.ts` eintragen; ohne Quelle nur als Rohdaten anzeigen). Antragsteller/Seriennummern in der Anzeige maskieren.
- **ipconfig /all**: Adapter, IPv4, DNS-Server, DNS-Suffix nur als Rohdaten/Evidenz (keine Bewertung). MAC-Adressen maskieren.
- Format-Doku `docs/diaglogs-format.md` und Fixture (`src/diagnostics/fixture.ts` / `scripts/make-fixture-zip.ts`) um synthetische CP850-Ausgaben ergänzen (Contoso, fiktive Daten).

## Strang B – Ereignisprotokolle (.evtx)

### B1 – Lesen

- `zip/reader.ts`: `.evtx` bleiben standardmäßig übersprungen; **gezielt** werden nur die Protokolle `DeviceManagement-Enterprise-Diagnostics-Provider Admin` und – falls im ZIP vorhanden – `…AAD Operational` als `Uint8Array` gelesen (Größenlimit z. B. 48 MB, sonst Hinweis „zu groß“). Nur im Worker.
- `src/diagnostics/parsers/evtx.ts`: reiner Parser (ohne Abhängigkeit): Dateikopf `ElfFile\0`, Chunks `ElfChnk\0` (64 KiB), Datensätze (`**\0\0`), Binary XML inkl. Templates (TemplateInstance, Substitutionen, normale/optionale Substitution), Werttypen mindestens: String, AnsiString, Int8–UInt64, Bool, GUID, SizeT, FILETIME, SYSTEMTIME, SID, HexInt32/64, Binary. Ergebnis je Ereignis: `EventID`, `Level`, `TimeCreated`, `Provider`, `EventData`/`UserData` als Name→Wert. Defekte Chunks/Datensätze überspringen statt abzubrechen (gekappte Dateien!). Prüfsummen nicht erzwingen. Laufzeit- und Mengenbegrenzung (z. B. max. 20 000 Datensätze).
- Synthetische `.evtx`-Erzeugung für Tests (minimaler BinXML-Encoder mit Template) in einem Test-Helfer bzw. im Fixture-Generator; Fixture-ZIP enthält danach ein kleines gültiges Admin-Log mit fiktiven Fehlerereignissen statt der Dummy-Datei.

### B2 – Auswertung

- Neuer ZIP-Abschnitt/Kachel „MDM-Ereignisse“: Ereignisse mit Level Kritisch/Fehler/Warnung, gruppiert nach EventID (Anzahl, letzter Zeitpunkt, Beispieldaten). Zeitfenster: letzte 14 Tage vor dem ZIP-Zeitstempel.
- HRESULT-Werte in EventData über die vorhandene Wissensbasis (`knowledge/win32.ts`, `errorCodes.ts`) deuten; unbekannt → „Unbekannter Code“ + Hex/Dezimal. **Keine Deutung von Event-IDs ohne Microsoft-Learn-Quelle** – sonst nur ID + Rohdaten.
- Severity: Fehlerereignisse in den letzten 14 Tagen → warning (eigener Schwellwert in `rules/thresholds.ts`, keine Microsoft-Behauptung); keine → ok; Protokoll fehlt/nicht lesbar → unavailable mit Grund.
- Maskierung: UPNs, GUID-artige Tenant-IDs, Seriennummern in EventData wie im übrigen ZIP-Modus.
- `docs/diaglogs-format.md` um den EVTX-Abschnitt ergänzen (Aufbau, was gelesen wird, Grenzen).

## Akzeptanz (beide Stränge)

- [ ] Parser als reine Funktionen mit Unit-Tests (inkl. gekappter/defekter Dateien)
- [ ] Kein `fetch`/Upload im Analysepfad; Analyse bleibt im Worker
- [ ] Alle Texte in `de.ts`, jede Deutung mit Quelle
- [ ] E2E `zip.spec.ts` mit dem neuen Fixture grün
- [ ] `npm run check` grün
