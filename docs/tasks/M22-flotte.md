# M22 – Flotten-Übersicht (Ansicht „Flotte“)

Neue, rein lesende Ansicht: **alle verwalteten Geräte des Mandanten in einer Liste**, auffällige zuerst,
mit Klick aufs Gerät. Die Ansicht „Mandant“ zeigt bisher nur Zähler („31 nicht konform“) – hier steht,
_welche_ Geräte das sind. Aus dem Einzelgeräte-Werkzeug wird so eines für den täglichen Blick auf den
ganzen Bestand.

## Grundregeln (zusätzlich zu CLAUDE.md)

- **Eine Quelle, kein Nachladen je Gerät:** allein die dokumentierte v1.0-Liste
  `GET /deviceManagement/managedDevices?$select=…`, Paginierung über `@odata.nextLink`, höchstens
  `MAX_FLEET_PAGES` Seiten. Ist danach nicht alles gelesen, steht das sichtbar in der Ansicht
  („unvollständig“). `$top`, `$orderby` und `$filter` sind für diese Liste nicht dokumentiert bzw. nicht
  belegt und werden nicht verwendet; gefiltert und sortiert wird im Browser.
- **Gleiche Maßstäbe wie in der Geräteansicht** (Compliance, Verschlüsselung, Check-in 7/30 Tage,
  Jailbreak/Root) – keine neuen Schwellwerte, keine neuen Lösungstexte. Erklärung und Lösung stehen in
  der Geräteansicht, ein Klick entfernt.
- **Keine Wertung von Betriebssystemversionen:** die Verteilung ist eine Zählung. „Veraltet“ sagt die
  Liste nicht (keine dokumentierte Quelle je Plattform).
- **Keine neue Berechtigung** (`DeviceManagementManagedDevices.Read.All` ist schon Pflicht).
- **Privatsphäre:** Feldnamen wie in Graph (`deviceName`, `userPrincipalName`, `serialNumber`), damit der
  Präsentationsmodus Liste, Suche und Export abdeckt.

## Vertrag (steht, nicht ohne Rücksprache ändern)

- `src/domain/fleetDevices.ts` – `FleetDevice`, `FleetDevicesInfo` (`devices`, `truncated`, `pagesRead`).
- `DeviceDataProvider.getFleetDevices(options?)` → `SectionResult<FleetDevicesInfo>`; wirft nur bei Abbruch.
- `Endpoints.managedDevicesFleet`, `FLEET_DEVICE_SELECT` (`src/graph/dto.ts`), `MAX_FLEET_PAGES`.
- Regelwerk `src/rules/fleetDevices.ts`: `evaluateFleet(info, now)` → `FleetOverview` (Zeilen sortiert,
  Auffälligkeiten `FLEET_ISSUES`, Plattformzähler, Versionsverteilung), `filterFleetRows`,
  `fleetIssuesOf`, `isFleetIssue`. Das Regelwerk enthält keine Texte.
- URL: `?view=fleet`, optional `&issue=<FleetIssue|any>`, `&platform=<OsFamily>`,
  `&managed=<FleetManagement>[,…]`.
- Nachtrag (2026-11-27): Filter „Verwaltet von“ über `managementAgent` (`fleetManagementOf`,
  Mehrfachauswahl, Gruppen `FLEET_MANAGEMENTS`; Rohwert in Zeile und Export) und Zahlen, die der Auswahl
  folgen (`fleetFacets`: Gesamtbild und Versionsverteilung zählen die Zeilen der Liste, jede Filterleiste
  zählt mit den jeweils anderen Filtern). Zuordnung und Quellen: `docs/graph-api-reference.md` › „Flotte“.

## S1 – Graph-Anbindung (`graph-implementer`)

- `GraphProvider.getFleetDevices`: `this.run('managedDevicesFleet', …)` + `readPages` mit
  `MAX_FLEET_PAGES`; Mapper `mapFleetDevice` (Datumswerte ohne Aussage → null, unbekannter
  `complianceState` → `unknown`, Einträge ohne `id` verwerfen).
- `docs/graph-api-reference.md`: Abschnitt „Flotte (M22)“; `docs/live-verification.md`: Abschnitt 10.

### Akzeptanz S1

- [x] Liste wird seitenweise gelesen, `truncated` stimmt; 403 → `forbidden`, 429 respektiert `Retry-After`, Abbruch bricht ab
- [x] Nur GET, nur `$select`; kein `$top`/`$filter`/`$orderby`
- [x] Mapper- und Provider-Tests; Vertragstest Mock ↔ Graph
- [x] Doku-Abschnitte ergänzt, offene Punkte für den Live-Test benannt

## S2 – Demo-Daten (`mock-data-writer`)

- Rund 265 fiktive Geräte (passend zu den Zählern der Ansicht „Mandant“), deterministisch, alle
  Plattformen, mit den zehn Szenario-Geräten darin.
- **Jedes Gerät der Liste lässt sich im Demo-Modus öffnen.**

### Akzeptanz S2

- [x] Verteilung der Compliance-Zustände entspricht `defaultComplianceSummary()`
- [x] Jede Auffälligkeit kommt vor, auch Kombinationen; alle Plattformen; mehrere OS-Versionen je Plattform
- [x] Öffnen eines erzeugten Geräts zeigt ein Dashboard, das zur Listenzeile passt
- [x] Nur fiktive Daten (Contoso), Tests

## S3 – Oberfläche (`ui-builder`)

- Ansicht `src/app/FleetView.tsx` (lazy), Navigationseintrag „Flotte“, Hook `useFleetDevices`. E2E in
  `e2e/fleet-devices.spec.ts` (`e2e/fleet.spec.ts` gehört zu M20).
- Kopf mit Gesamtzahl und Auffälligen; Kacheln je Auffälligkeit als Filter; Plattform-Filter; Suche;
  Geräteliste (auffällige zuerst, seitenweise anzeigen), Klick öffnet das Gerät; Versionsverteilung je
  Plattform; CSV-Export der gefilterten Liste; Hinweis bei unvollständiger Liste.

### Akzeptanz S3

- [x] Filter stehen in der URL und überleben Neuladen und Zurück
- [x] 390 px: kein horizontales Scrollen, Navigation mit fünf Einträgen nicht abgeschnitten
- [x] Tastatur und Screenreader: Filter, Liste, Zustände (lädt, leer, Fehler, keine Berechtigung)
- [x] Präsentationsmodus deckt Liste, Suche und Export ab (Leck-Scanner, Abdeckungstest)
- [x] Texte in `src/i18n/`, E2E inkl. axe

## S4 – Abschluss (Hauptsession)

README, Regel-Check, vollständige E2E-Suite, PR.

### Akzeptanz S4

- [x] README (Funktionsliste, Demo-Schritt, Grenzen), `npm run check` grün, E2E grün (493 bestanden, 3 übersprungen)
- [x] Regel-Check gegen CLAUDE.md ohne Verstoß

Offen: gegen einen echten Mandanten nicht geprüft (`docs/live-verification.md`, Abschnitt 10) – vor allem, ob die
Liste `isEncrypted` und `jailBroken` mit `$select` tatsächlich liefert.
