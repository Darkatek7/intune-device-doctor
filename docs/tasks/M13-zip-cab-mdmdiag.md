# M13 – DiagLogs-ZIP: `mdmlogs-*.cab` und MDMDiagReport

Branch `feat/m12-m14`, Worktree (Delegation: `zip-parser-implementer`, sonnet). Regeln aus `CLAUDE.md` unverändert (nichts hochladen, Maskierung, Quellenpflicht, fiktive Testdaten).

Speicher: Vitest nur `--maxWorkers=2`, Playwright nur `--workers=1` mit eigenem `E2E_PORT`, Prüfschritte einzeln statt `npm run check`.

## Hintergrund

Das DiagLogs-ZIP enthält u. a. `mdmlogs-<Datum>.cab` (Ergebnis von `MdmDiagnosticsTool`, siehe `docs/diaglogs-format.md`). Laut Microsoft Learn („Collect MDM logs“, https://learn.microsoft.com/windows/client-management/mdm-collect-logs) enthält dieses Paket u. a. `MDMDiagReport.xml` (detaillierte MDM-Konfiguration), `MDMDiagHtmlReport.html`, `MdmDiagReport_RegistryDump.reg` und `.evtx`-Dateien. Inhalt und Struktur vor der Umsetzung gegen Learn prüfen und in `docs/diaglogs-format.md` dokumentieren.

## S1 – CAB lesen

- `src/diagnostics/parsers/cab.ts`: reiner CAB-Parser ohne neue Abhängigkeit: CFHEADER (`MSCF`), CFFOLDER, CFFILE, CFDATA; Kompression **MSZIP** (jeder CFDATA-Block `CK` + Deflate, Wörterbuch über Blockgrenzen eines Folders hinweg – `fflate` ist bereits Abhängigkeit, Inflate mit Dictionary prüfen) und unkomprimiert; LZX/Quantum → sauber „nicht unterstützt“. Nur Dateiliste + gezieltes Entpacken einzelner Dateien; Größenlimits (z. B. CAB ≤ 64 MB, entpackte Einzeldatei ≤ 32 MB); defensiv gegen kaputte Offsets.
- Format-Quelle: Microsoft „Cabinet File Format“ (MS-CAB-Spezifikation) – Link in `docs/diaglogs-format.md`.
- `zip/reader.ts`/Worker: `.cab` aus dem ZIP nur gezielt (`mdmlogs-*.cab`) als Bytes lesen, sonst wie bisher überspringen.
- Test-Helfer: minimaler CAB-Encoder (unkomprimiert **und** MSZIP mit mehreren Blöcken) für Roundtrip-Tests; Fixture-ZIP enthält danach ein kleines synthetisches `mdmlogs-*.cab` (Contoso).

### Umsetzung S1

- `src/diagnostics/parsers/cab.ts` (`openCab`): CFHEADER/CFFOLDER/CFFILE/CFDATA, Reserve-Bereiche, Prüfsumme (`CSUMCompute`, wenn ≠ 0), MSZIP (`CK` + Inflate mit 32-KiB-Verlaufsfenster über Blockgrenzen) und unkomprimiert; LZX/Quantum/unbekannt/mehrteilig → `CabUnsupportedError` (Dateiliste bleibt nutzbar); kaputte Offsets/Größen → `CabFormatError`; Limits → `CabLimitError`. Eigene Fehlerklassen, keine Ausnahme dringt bis in die UI.
- Gezieltes Lesen: `src/diagnostics/mdmCab.ts` (`selectMdmCabEntry`, `analyzeMdmCab`) liest aus dem ZIP nur den Eintrag `mdmlogs-*.cab` als Bytes (Limit 64 MiB, vor dem Entpacken geprüft) und daraus nur Dateiliste, `MDMDiagReport.xml`, `MdmDiagLogMetadata.json` und ggf. das MDM-Admin-`.evtx`; der Aufruf sitzt in `analyze.ts` (Schritt `mdmCab`, Worker). `zip/reader.ts` blieb unverändert (`readBytes` genügt).
- Test-Helfer `src/diagnostics/cabFixture.ts` (Encoder: unkomprimiert, MSZIP mit mehreren Blöcken, Reserve-Bereiche, rohes `typeCompress`) und `mdmCabFixture.ts`; das Fixture-ZIP enthält `mdmlogs-20261014-125312.cab`.
- Quellen: Cabinet-Format und MSZIP (Learn „Microsoft Cabinet Format“), `expand`; alles in `docs/diaglogs-format.md`, Abschnitt „MDM-Diagnosepaket“, getrennt nach belegt/angenommen.

## S2 – MDMDiagReport.xml auswerten

- Parser für `MDMDiagReport.xml`: Registrierungen (Enrollment-ID, Typ, Status, Provider/Management-URL – URLs nur Host anzeigen), konfigurierte Richtlinienbereiche (Policy-Area/Config-Source, falls im Format vorhanden), Zertifikate (Aussteller, Ablauf – maskiert wie M11), Diagnose-Metadaten. Nur, was im Format tatsächlich steht; Struktur aus Learn bzw. aus der synthetischen, an Learn orientierten Beispieldatei ableiten – nicht raten. Unbekannte Struktur → Rohdaten-Hinweis statt Fehler.
- Kachel „MDM-Diagnosebericht“ (ZIP): Wert z. B. „3 Richtlinienbereiche · 2 Registrierungen“, Befunde nur mit Learn-Quelle; sonst Severity „unknown“ (Rohdaten). Besonders: zeigt **Settings-Catalog-/Richtlinienquellen im ZIP-Modus**, die über Graph v1.0 nicht verfügbar sind – Hinweis in der Richtlinien-Kachel beim Zusammenführen („Details im MDM-Diagnosebericht“).
- Evtx-Dateien aus dem CAB: nur nutzen, wenn das MDM-Admin-Log nicht schon direkt im ZIP liegt (bestehenden Parser aus M11 wiederverwenden).
- Maskierung: UPN, GUIDs (Tenant/Enrollment), Seriennummern, MAC wie im übrigen ZIP-Modus.

### Umsetzung S2 und Abweichung vom Entwurf

**Abweichung:** Der Entwurf nannte Registrierungen, Richtlinienbereiche und Zertifikate. Microsoft Learn beschreibt von `MDMDiagReport.xml` nur den Zweck („enrollment variables, provisioning packages, multivariant conditions, and others“) und den Knoten `Multivariant` mit `Condition` (Diagnose provisioning packages, ab Windows 11 22H2). Ein Elementaufbau für Registrierungen/Richtlinienbereiche/Zertifikate ist nicht dokumentiert und stand als echte Datei nicht zur Verfügung – er wurde **nicht geraten**. Umgesetzt ist stattdessen, was belegt oder rein strukturell ist:

- `parsers/mdmDiagReport.ts` + `parsers/xmlLite.ts` (kleiner, begrenzter XML-Leser für den Worker): `Condition`-Werte aller `//Multivariant`-Knoten (belegt) sowie als **Rohdaten** Wurzelelement, Elementzahl, Abschnittsnamen (gleichnamige direkte Kinder der Wurzel) mit Anzahl und Kindnamen – keine Werte, keine Deutung; unbekannte/kaputte Struktur → Hinweis statt Fehler.
- `MdmDiagLogMetadata.json` (laut Learn: Kommandozeilenargumente): skalare Felder der obersten Ebene als maskierte Rohdaten.
- Kachel „MDM-Diagnosebericht“ (`rules/tiles/mdmDiagReport.ts`, nur im ZIP-Modus): Wert z. B. „4 Abschnitte · 3 Multivariant-Bedingungen“, Severity immer „Hinweis“ (kein Befund ohne Learn-Beleg), Befunde mit Ursache, Lösung, ZIP-Quelle und Learn-Link; nicht lesbares Paket → „Nicht verfügbar“ mit Grund (zu groß, ungültig, nicht lesbar, Kompression nicht unterstützt).
- Richtlinien-Kachel: beim Zusammenführen mit einem lesbaren Paket verweist der Befund „Settings Catalog“ auf die Kachel „MDM-Diagnosebericht“ (formuliert als Verweis auf die detailliertere Sicht laut Learn, nicht als Aussage über Richtlinienquellen).
- Admin-Log aus dem Paket nur, wenn das ZIP kein lesbares eigenes enthält (M11-Parser `analyzeEventLog` wiederverwendet); die Kachel „MDM-Ereignisse“ zeigt es dann wie gewohnt, der Bericht nennt die Herkunft.
- Maskierung im Worker über `maskEventValue` (UPN, GUIDs, Seriennummern, MAC, URL-Queries); URLs werden nie übernommen.
- Quellen in `rules/knowledge/docs.ts`: `mdmCollectLogs`, `diagnoseProvisioningPackages`, `cabinetFormat`, `expandCommand`.

**Möglicher Ausbau:** Sobald eine echte, anonymisierte `MDMDiagReport.xml` vorliegt (oder Learn den Aufbau beschreibt), können Registrierungen, Richtlinienbereiche und Zertifikate gezielt ausgewertet werden – dann zuerst Aufbau in `docs/diaglogs-format.md` als „belegt“ eintragen.

## Akzeptanz

- [x] CAB-Parser rein, getestet (MSZIP mehrere Blöcke, unkomprimiert, gekappt, defekte Offsets, LZX → nicht unterstützt) – `parsers/cab.test.ts`, `mdmCab.test.ts`, Beispiel-Cabinet aus der Spezifikation
- [x] Kein Upload; Analyse im Worker; Performance-Messung per Skript dokumentiert – `scripts/measure-cab.ts`: 20,2-MB-Paket (ungünstigster Fall, Bericht und Protokoll hinter 19,6 MB nicht komprimierbaren Daten) ≈ 0,3 s ohne / ≈ 0,6 s mit Admin-Log, max. RSS ≈ 280 MB; Werte und Aufruf in `docs/diaglogs-format.md`
- [x] Quellen in `knowledge/docs.ts`; `docs/diaglogs-format.md` ergänzt (belegt / angenommen getrennt)
- [x] E2E `zip.spec.ts` grün (sieben ZIP-Kacheln, Kachel „MDM-Diagnosebericht“, Hinweis in der Richtlinien-Kachel nach dem Zusammenführen; zusätzlich `csp.spec.ts` grün – jeweils Projekt `desktop-light`)
- [x] `npm run check` grün – wegen des Speicherlimits in Einzelschritten: `npm run lint`, `npm run typecheck`, `npx vitest run --maxWorkers=2` (62 Dateien, 1131 Tests), `npx vite build`
