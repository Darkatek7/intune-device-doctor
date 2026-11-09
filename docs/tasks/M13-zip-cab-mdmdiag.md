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

## S2 – MDMDiagReport.xml auswerten

- Parser für `MDMDiagReport.xml`: Registrierungen (Enrollment-ID, Typ, Status, Provider/Management-URL – URLs nur Host anzeigen), konfigurierte Richtlinienbereiche (Policy-Area/Config-Source, falls im Format vorhanden), Zertifikate (Aussteller, Ablauf – maskiert wie M11), Diagnose-Metadaten. Nur, was im Format tatsächlich steht; Struktur aus Learn bzw. aus der synthetischen, an Learn orientierten Beispieldatei ableiten – nicht raten. Unbekannte Struktur → Rohdaten-Hinweis statt Fehler.
- Kachel „MDM-Diagnosebericht“ (ZIP): Wert z. B. „3 Richtlinienbereiche · 2 Registrierungen“, Befunde nur mit Learn-Quelle; sonst Severity „unknown“ (Rohdaten). Besonders: zeigt **Settings-Catalog-/Richtlinienquellen im ZIP-Modus**, die über Graph v1.0 nicht verfügbar sind – Hinweis in der Richtlinien-Kachel beim Zusammenführen („Details im MDM-Diagnosebericht“).
- Evtx-Dateien aus dem CAB: nur nutzen, wenn das MDM-Admin-Log nicht schon direkt im ZIP liegt (bestehenden Parser aus M11 wiederverwenden).
- Maskierung: UPN, GUIDs (Tenant/Enrollment), Seriennummern, MAC wie im übrigen ZIP-Modus.

## Akzeptanz

- [ ] CAB-Parser rein, getestet (MSZIP mehrere Blöcke, unkomprimiert, gekappt, defekte Offsets, LZX → nicht unterstützt)
- [ ] Kein Upload; Analyse im Worker; Performance-Messung per Skript (z. B. 20-MB-CAB) dokumentiert
- [ ] Quellen in `knowledge/docs.ts`; `docs/diaglogs-format.md` ergänzt
- [ ] E2E `zip.spec.ts` grün (Kachelzahl anpassen)
- [ ] `npm run check` grün
