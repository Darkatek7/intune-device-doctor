# M5 – DiagLogs-ZIP-Analyse

**Delegation:** `mock-data-writer` (haiku) zuerst für den Fixture-Generator; dann `zip-parser-implementer` (sonnet); `test-writer` (haiku). Formatbeschreibung: `docs/diaglogs-format.md`.

## Schritte
1. `scripts/make-fixture-zip.ts`: exportiert `buildFixtureZip(): Uint8Array` (fflate `zipSync`), CLI schreibt `tests/fixtures/DiagLogs-CONTOSO-PC042-20261014T125356Z.zip`. Inhalt laut „Fixture für Tests“ im Formatdokument, korrekte Encodings (UTF-16LE+BOM für .reg, UTF-8+BOM für IME-Logs).
2. Parser (`src/diagnostics/parsers/`, reine Funktionen, je mit Tests): `entryName.ts`, `encoding.ts` (BOM-Erkennung → TextDecoder), `resultsXml.ts` (DOMParser, im Worker regex-basiert falls kein DOMParser), `dsregcmd.ts` (Abschnitte + verschachtelte Blöcke), `cmtrace.ts` (mehrzeilig, Limit), `regExport.ts` (Keys/Werte inkl. dword/hex, Escapes) + Extraktoren `enrollments.ts`, `win32Apps.ts`.
3. `src/diagnostics/zip/reader.ts`: zip.js `ZipReader(new BlobReader(file))`, Central Directory → `DiagEntry[]`, Text on demand mit Größenlimit (z. B. 8 MB je Datei; größere nur die letzten N MB / überspringen + `analysisNotes`). Binär (`.evtx/.etl/.cab`) nie entpacken.
4. `src/diagnostics/worker.ts` + `analyze.ts`: Analyse im Web Worker (`new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`), Fortschritt melden, Ergebnis `DiagnosticsReport`. Sensible Werte maskieren, ChannelURI verwerfen.
5. Regeln für ZIP-Kacheln (`src/rules/tiles/`): **Entra-Join & PRT** (dsregcmd), **Win32-Apps** (Failed-Apps mit Hex-Code + Win32-Deutung), **Enrollment** (EnrollmentState, ProviderIDs, Co-Management erkannt), **Diagnose-Sammlung** (fehlgeschlagene Sammlungen, harmlos-Liste als info). Quelle = ZIP-Eintragsname.
6. UI: Drop-Zone + Datei-Button aktivieren, Fortschrittsanzeige, ZIP-Ansicht nutzt dasselbe Kachel-Grid. Gerätename aus Dateiname; wenn im aktuellen Modus ein Gerät gleichen Namens existiert, Angebot „Mit Intune-Daten zusammenführen“ → `snapshot.diagnostics` setzen, Kacheln beider Quellen anzeigen. Ohne Gerät: reine ZIP-Ansicht.
7. Ein Demo-Chip „Beispiel-ZIP analysieren“ lädt das Fixture (zur Laufzeit via `buildFixtureZip`, kein Binär-Asset im Repo).

## Akzeptanz
- [x] Fixture-ZIP → erwartete Befunde (PRT fehlt, WamDefaultSet-Fehler, 1 Failed-App mit `0x80070642`, 2 fehlgeschlagene Sammlungen)
- [x] 100-MB-ZIP friert die UI nicht ein (Worker), Speicher bleibt moderat (nur Text-Einträge on demand) – per Design erfüllt, mit echtem Archiv noch nicht gemessen (siehe docs/acceptance.md)
- [x] Datei wird nirgends hochgeladen (kein fetch im Analysepfad)
- [x] `npm run check` grün
