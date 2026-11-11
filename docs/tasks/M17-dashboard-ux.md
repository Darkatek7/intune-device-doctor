# M17 – Dashboard-UX: Befunde zuerst, Aktionen bündeln, Navigation, Ladezeit

Ausgangslage (CONTOSO-PC042): 10 von 15 Kacheln sagen nur „In Ordnung“, sind aber so groß wie die Problem-Kacheln; mobil ist das Dashboard rund 3280 px lang (3 Fingerhübe pro Befund). Fünf Aktions-Schaltflächen belegen mobil vier Zeilen. „Mandant“ und „Richtlinien“ sind lose Symbol-Schaltflächen. Dieses Paket ist **reine Darstellung** – kein Eingriff in Datenmodell, Provider oder Regeln.

## U1 – Gesunde Kacheln kompakt

- `src/ui/CompactTile.tsx` (Zeile: Icon, Titel, Wert, Status-Icon), `src/ui/tileGroups.ts` (`isHealthyTile`), `src/ui/TileGrid.tsx` (Abschnitt „In Ordnung · N“, positive Aussage bei „alles ok“, ein 12-Spalten-Raster mit stabilen Keys → Layout-Animation statt Neuaufbau).
- Nach dem Laden (`settled`): Befund → große Karte; ok / nicht anwendbar → kompakt. Beim Laden bleibt die flache Skeleton-Ansicht. Gilt für Geräte-, ZIP-, zusammengeführte und Mandanten-Ansicht (alle über `TileGrid`).

## U2 – Aktionen bündeln

- `src/ui/ActionMenu.tsx` (WAI-ARIA-Menübutton), `src/ui/HeaderActions.tsx` (eine Aktionsleiste für Geräte- und ZIP-Header). Sichtbar: „Zeitachse“, „Ticket-Notiz kopieren“; im Menü „Mehr“: Drucken / PDF, Stand exportieren, Mit Stand vergleichen (Gerät) bzw. Mit weiterer ZIP vergleichen (ZIP), Verbindungstest (Live).
- `TicketNoteButton`, `CompareControls`, `CompareZipControls` bleiben Träger der Dialoge/Dateiauswahl (`showPrint`/`headless`, `ref`-Handle); die Funktionen sind unverändert, der Fokus kehrt nach dem Schließen zu „Mehr“ zurück.

## U3 – Texte und Startseite

- Kontextzeile der großen Kachel zweizeilig (`line-clamp-2`).
- Untertitel der Startseite nennt die Seriennummer („Gerätenamen, Benutzer oder Seriennummer eingeben …“).
- Beispielgeräte zeigen das Plattform-Symbol (`deviceIconKind`, über `useExampleDevices`).
- Chip „Beispiel-ZIP analysieren“ (und Beschreibungen der Beispielgeräte) brechen um statt abgeschnitten zu werden.

## U4 – Navigation

- `src/ui/navItems.ts`: Array `NAV_ITEMS` (Geräte, Richtlinien, Mandant) – neue Ansicht = Eintrag + Handler in `AppShell` (`Record<NavId, …>`). `Toolbar` rendert `<nav aria-label="Hauptnavigation">` mit `aria-current="page"`; sichtbarer Text auf allen Breiten, kein `aria-label` auf den Einträgen. URL-Zustand, Home-Schaltfläche und Suchfeld unverändert.

## U5 – Ladezeit

- `src/app/lazyViews.ts`: `React.lazy` für Richtlinien (+ Detail), Mandant, Verbindungstest, Sammelprüfung und ZIP-Ansicht; `Suspense` + `ViewFallback` (Verzögerung 200 ms, `aria-busy`). Direktlinks funktionieren unverändert.

## Akzeptanz

- [x] Kacheln mit Befund bleiben große Karten; ok/nicht anwendbar kompakt unter „In Ordnung · N“; `<button>`, `aria-haspopup="dialog"`, Status nie nur über Farbe
- [x] Alles in Ordnung → klare positive Aussage oben, dann kompakte Zeilen
- [x] Skeletons wie bisher; Übergang per Layout-Animation (Spring), reduced-motion nur Crossfade; kein Springen beim Nachladen
- [x] „Mehr“-Menü: `aria-haspopup="menu"`/`aria-expanded`, Pfeiltasten, Escape + Fokus zurück, Klick außerhalb, Tastatur vollständig; bestehende Funktionen unverändert
- [x] Kontextzeile zweizeilig, Untertitel mit Seriennummer, Plattform-Symbole, Chip nicht abgeschnitten
- [x] Datengetriebene Navigation mit sichtbaren Texten (auch mobil); axe `label-content-name-mismatch` sauber
- [x] Lazy-Chunks für Richtlinien, Mandant, Verbindungstest, Sammelprüfung, ZIP-Ansicht; Direktlinks laufen
- [x] Unit-Tests (kompakte Kachel, `TileGrid`, `ActionMenu`, `HeaderActions`, Navigation, Plattform-Symbole, Platzhalter) und `e2e/dashboard-ux.spec.ts` (mobile Dokumenthöhe, Menü, Navigation, Startseite, axe)
- [x] README-Demo-Skript und `docs/ui-guidelines.md` angepasst; Screenshots in `docs/screenshots/` neu erzeugt
