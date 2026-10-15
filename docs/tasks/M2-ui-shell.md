# M2 – UI-Shell im Demo-Modus

**Delegation:** `ui-builder` (sonnet). Hauptsession integriert & reviewt. Vorgaben: `docs/ui-guidelines.md`.

## Schritte
1. `src/app/AppShell.tsx`: Toolbar (transluzent, Suchfeld, Demo/Live-Segmented-Control – Live deaktiviert mit Tooltip `de.mode.liveNotConfigured`, solange `isLiveConfigured` false), Inhalt, leerer Zustand mit Beispiel-Chips (Demo) und Drop-Zone-Platzhalter (Funktion in M5).
2. `src/app/providerContext.tsx`: React-Context, der je Modus den passenden `DeviceDataProvider` liefert (Live-Provider kommt in M4 – bis dahin nur Demo).
3. `src/hooks/useDeviceSearch.ts` (Debounce nur für Vorschläge, Enter sucht sofort; Abort bei neuer Suche) und `src/hooks/useDeviceSnapshot.ts` (lädt `getDevice`, dann alle Sections **parallel**, aktualisiert den Snapshot progressiv, Abort bei Gerätewechsel, `retrySection(name)`).
4. Komponenten in `src/ui/`: `SearchField`, `ResultPicker` (mehrere Treffer), `DeviceHeader`, `TileGrid`, `StatusTile`, `TileSkeleton`, `SeverityBadge`, `DetailSheet`, `FindingCard`, `EvidenceTable`, `EmptyState`, `ErrorState`.
5. Bis M3 existiert, eine einfache Übergangs-Ableitung `snapshot → Tile[]` (nur Rohwerte, severity `unknown`) – wird in M3 ersetzt.
6. Motion & A11y wie in den Guidelines (Spring bounce 0, Sheet aus Kachel heraus, Fokus-Falle, reduced-motion, Tastatur, `aria-live`).
7. URL-State: `?device=<id>&mode=demo` (Teilen/Neuladen), Browser-Zurück schließt Sheet bzw. kehrt zur Suche zurück.

## Akzeptanz
- [ ] Gerätename eingeben → Kacheln erscheinen progressiv, Klick öffnet Detail-Sheet, Escape schließt, Fokus kehrt zurück
- [ ] Mehrdeutige Suche zeigt Auswahl, unbekannter Name zeigt freundlichen Leerzustand
- [ ] Mobil (375 px) und Desktop sauber, Dark Mode korrekt
- [ ] Komponententests: Suche → Kacheln, Sheet öffnen/schließen per Tastatur
- [ ] `npm run check` grün
