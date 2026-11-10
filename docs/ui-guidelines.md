# UI-Guidelines (Apple-Design-Prinzipien fürs Web)

Ziel: ruhig, klar, schnell – ein Admin erfasst in < 3 Sekunden, ob und wo ein Gerät ein Problem hat. Tokens stehen in `src/index.css` (`@theme`).

## Layout

- **Toolbar** (sticky, transluzent: `bg-surface-raised` + `backdrop-blur-xl backdrop-saturate-150`): links App-Name, danach die **Hauptnavigation**, Mitte Suchfeld (⌘K / `/` fokussiert), rechts Demo/Live-Segmented-Control, Schalter „Präsentationsmodus“ (Auge, `aria-pressed`), Erscheinungsbild-Schalter und Konto. Statt Trennlinie ein weicher Scroll-Edge-Verlauf, nur sobald Inhalt darunter scrollt.
- **Leerer Zustand**: großes zentriertes Suchfeld, darunter Drop-Zone „oder DiagLogs-ZIP hierher ziehen“ + Datenschutzhinweis; im Demo-Modus 3–4 Chips mit Beispielgeräten (ein Klick = Szenario laden).
- **Ergebnis**: Geräte-Header (Name groß, darunter Modell · Nutzer · OS · Enrollment-Datum; rechts Zusammenfassung „3 Probleme · 1 Hinweis“ mit Severity-Farbe), darunter Kachel-Grid (12 Spalten, `gap-3 sm:gap-4`; große Karte 1/2/3/4 Spalten). Kacheln sortiert: critical → warning → unknown → ok (stabile Reihenfolge innerhalb).
- **Aktionsleiste** über den Kacheln: sichtbar nur „Zeitachse“ und „Ticket-Notiz kopieren“, alles Weitere (Drucken / PDF, Stand exportieren, Mit Stand vergleichen, Verbindungstest …) im Menü „Mehr“ (`ActionMenu`/`HeaderActions`). Menü-Muster nach WAI-ARIA: Schaltfläche mit `aria-haspopup="menu"`/`aria-expanded`, Pfeiltasten/Home/End, Escape schließt und gibt den Fokus zurück, Klick außerhalb und Tab schließen, gesperrte Einträge (`aria-disabled`) werden übersprungen. Mobil ragt das Menü nie über den Rand.
- **Hauptnavigation** (`<nav aria-label="Hauptnavigation">`, `aria-current="page"`): Einträge „Geräte“, „Richtlinien“, „Mandant“ stammen aus **einem Array** (`src/ui/navItems.ts`); eine neue Ansicht = ein Eintrag plus ein Handler in `AppShell` (der Typ `NavId` erzwingt ihn). Jeder Eintrag hat **sichtbaren Text** (Icon + Beschriftung, nie nur Symbol) und keinen abweichenden `aria-label` (WCAG 2.5.3, axe `label-content-name-mismatch`). Ab `lg` steht die Navigation in der Toolbar-Zeile, darunter als eigene Zeile (mobil volle Breite, Einträge gleich breit). Der URL-Zustand (`?view=…`) bleibt unverändert.
- Max. Inhaltsbreite ~ 80rem, Seitenabstand 1rem mobil / 2rem Desktop. Abstände in rem.

## Gesunde Kacheln kompakt (`CompactTile`, `TileGrid`)

- Priorität statt Gleichbehandlung: Ein Admin sucht die Auffälligkeit. Nach Abschluss des Ladens bleiben Kacheln mit **Befund** (critical, warning, unknown sowie Berechtigungs-, Fehler- und „nicht verfügbar“-Zustände) große Karten; Kacheln mit Severity **ok** und **nicht anwendbar** stehen darunter im Abschnitt „In Ordnung · N“ (`<h2>`) als **kompakte Zeile**: Icon-Squircle, Titel, Hauptwert, Status-Icon (Form + Text im zugänglichen Namen, nie nur Farbe).
- Kompakt = ein `<button>` mit denselben Bestandteilen im zugänglichen Namen wie die große Kachel (Titel, Status, Wert, Kontext), `aria-haspopup="dialog"`, öffnet dasselbe Sheet (Herauswachsen aus der Kachel). Raster 1/2/3 Spalten, Zeilenhöhe mind. 3rem; lange Titel/Werte brechen um statt abgeschnitten zu werden.
- Ist **alles** in Ordnung, steht oben eine ruhige positive Aussage („Keine Auffälligkeiten – Alle N Prüfungen sind in Ordnung“), danach die kompakten Zeilen.
- Während des Ladens bleibt die flache Skeleton-Darstellung (keine Umsortierung, kein Springen). Erst wenn nichts mehr lädt (`settled`), wandern die unauffälligen Kacheln per Layout-Animation (Spring) in den Abschnitt; die Liste ist eine einzige `<ul>` mit stabilen Keys, deshalb bauen sich die Kacheln nicht neu auf. Bei `prefers-reduced-motion` nur Crossfade.
- Große Karten: Kontextzeile bis zu **zwei** Zeilen (`line-clamp-2`), Kachelhöhen im Raster bleiben bündig.

## Kachel (`StatusTile`)

- `tile material-card rounded-tile`, Padding 1.25rem. `material-card` = solide Fläche + Lichtkante oben (`inset 0 1px 0 var(--c-highlight)`) + Schatten aus `--shadow-tile`; größere Flächen bekommen tiefere Schatten.
- Aufbau: oben links Icon im **Squircle** (`squircle size-9`), oben rechts Status-Badge (Icon + Text). Darunter Titel (`text-sm font-medium text-secondary-label`), dann Hauptwert groß (1.5rem semibold, -0.018em) und 1 Zeile Kontext. **Status nie nur über Farbe** – immer Icon/Text.
- Farbe nur, wo Aufmerksamkeit nötig ist: Problem/Prüfen tönen Squircle und einen weichen Schein aus der linken oberen Ecke (`data-severity`); gesunde Kacheln bleiben neutral.
- Hover (nur bei Zeigergeräten): 2px Anheben + stärkerer Schatten, Lichtfleck folgt dem Zeiger 1:1 (`--mx/--my`). Bei reduced-motion kein Anheben.
- Ganze Kachel ist ein `<button>` (Tastatur, `aria-haspopup="dialog"`, Fokus-Ring `ring-2 ring-accent`).
- Feedback auf **Pointer-Down**: `active:scale-[0.97]` mit 100 ms ease-out; Hover nur dezent (Schatten minimal stärker).
- Lädt: Skeleton in Kachelform (sanftes Shimmer, bei reduced-motion statisch).
- Zustände in der Kachel: forbidden → Schloss-Icon + „Fehlende Berechtigung“; notApplicable → grau „Nicht anwendbar“; unavailable → grau „Nicht verfügbar“; error → „Fehler beim Laden“ + Retry im Sheet.

## Detail-Sheet (`DetailSheet`)

- Desktop: Panel rechts (Breite ~ 32rem), mobil: Bottom-Sheet. Öffnet **aus der Kachel heraus** (Startposition/Scale von der Kachel-Bounding-Box bzw. `transform-origin` an der Kachel) und schließt auf demselben Weg zurück.
- Modal: Scrim `bg-black/20` (dark: `/40`), Hintergrund leicht zurückgenommen. Escape, Klick auf Scrim, Schließen-Button; Fokus-Falle, Fokus kehrt zur Kachel zurück. `role="dialog" aria-modal="true" aria-labelledby`.
- Inhalt je Befund (Karte): Severity-Icon + **Titel** → _Befund_ (detail) → _Ursache_ → _Lösung_ (nummerierte Schritte) → _Rohdaten_ (einklappbar, Key/Value-Tabelle, Monospace für IDs/Codes, Kopieren-Button) → _Quelle_ (`GET …` bzw. ZIP-Eintrag) + Link „Microsoft-Dokumentation“ (öffnet neuen Tab, `rel="noreferrer"`).
- Keine Befunde → freundliche Bestätigung („Alles in Ordnung“) mit den geprüften Werten.

## Motion (Bibliothek `motion`)

- Standard-Spring: `{ type: 'spring', bounce: 0, duration: 0.35 }` (kritisch gedämpft). Kein Überschwingen bei Menüs/Sheets ohne Geste.
- Bottom-Sheet mobil per Drag schließbar: 1:1-Tracking, Gummiband am oberen Rand, beim Loslassen Geschwindigkeit übergeben; Schwelle per Projektion (`v/1000 * 0.998/(1-0.998)`), dann `bounce: 0.15`.
- Animationen unterbrechbar (Sheet während des Öffnens wieder schließbar, startet vom aktuellen Wert). Nur `transform`/`opacity` animieren.
- Kacheln erscheinen gestaffelt (20–30 ms Versatz) mit Fade + 8px Hub; Statuswechsel loading → ready per Crossfade.
- `prefers-reduced-motion: reduce` → nur Opacity-Crossfades (150–200 ms), kein Scale/Slide, kein Shimmer (`useReducedMotion()` von motion).
- `prefers-reduced-transparency` → solide Flächen (Token schon vorbereitet). `prefers-contrast: more` → sichtbare Rahmen.

## Typografie

- Systemschrift (`--font-sans`). Display 2.5rem/1.08/-0.022em, Titel 1.375rem/1.2/-0.012em, Fließtext 1rem/1.5/0, klein 0.875rem/1.45/+0.005em.
- Hierarchie über Gewicht + Größe; Zahlen tabellarisch (`tabular-nums`) bei Versionen/Daten.
- Relative Zeiten („vor 3 Std.“) mit absolutem Datum im `title`/Detail (`Intl.RelativeTimeFormat('de')`, `Intl.DateTimeFormat('de-DE')`).

## Material & Tiefe

- Toolbar: Glas (`--c-glass`, `backdrop-blur-2xl backdrop-saturate-[1.8]`), Inhalt scrollt darunter.
- Umgebungslicht (`AmbientGlow`): statischer, weicher Schein oben in der Farbe des Gesamtzustands (Startseite: Akzent; Gerät/ZIP: schlechteste Severity). Farbwechsel blendet über eine registrierte CSS-Property weich über. Entfällt bei `prefers-reduced-transparency` und `prefers-contrast: more`.
- Gruppierte Inhalte im Sheet (Befunde, geprüfte Werte) liegen auf `bg-fill` (iOS „grouped“): im Dunkeln heller als die Sheet-Fläche, nicht dunkler.
- App-Glyphe: Squircle mit Blau-Indigo-Verlauf (`app-glyph`) in Toolbar und Startseite.

## Nachladen

- Selten gebrauchte Ansichten (Richtlinien samt Detail, Mandant, Verbindungstest, Sammelprüfung, ZIP-Ansicht) laden per `React.lazy` nach (`src/app/lazyViews.ts`). Bis dahin zeigt `ViewFallback` einen ruhigen Platzhalter (`role="status"`, `aria-busy`), der erst nach 200 ms einblendet – bei schnellem Laden erscheint nichts (kein Aufblitzen).

## Präsentationsmodus

- **Schalter** (`PrivacyToggle`, Toolbar): Symbol-Schaltfläche mit `aria-pressed`, festem zugänglichen Namen „Präsentationsmodus“ (der Zustand steht in `aria-pressed`, nicht im Namen) und `title`, der die Aktion nennt. In Demo, Live und ZIP-Ansicht verfügbar; Standard aus; Zustand in `localStorage` (`mdm-doctor.privacy`).
- **Hinweis** (`PrivacyNotice`): Solange der Modus an ist, steht unter der Toolbar-Zeile dauerhaft ein ruhiger Streifen (`bg-accent/10`) mit der Pille „Präsentationsmodus · Namen verborgen“ und dem Satz, dass Richtlinien-, Gruppen- und App-Namen sichtbar bleiben und den Firmennamen enthalten können. Er ist Teil der sticky Toolbar und damit auf jedem Screenshot.
- **Pseudonyme** (`Gerät-7F3A`, `Benutzer-2C9E`, `benutzer-2c9e@beispiel.example`) sind überall gleich; Dialoge, die Text ausgeben (Ticket-Notiz, Druck, Export, CSV, Vergleich, Verbindungstest-Bericht), sagen in einem Satz, dass er maskiert ist.
- **Anschluss neuer Ansichten:** Anzeige-Modelle (`Tile`, `Finding` …) laufen durch `view.deep(…)` aus `useBuildPrivacyView(quelle)`, Listen und Köpfe geben Pseudonyme je Feld über `usePrivacy().masker` aus, Links mit Kennungen über `PrivateLink`. Kein Feldname gehört in eine Komponente – nur in `src/privacy/keys.ts`.

## Erscheinungsbild

- **Dunkel ist Standard.** Hell per Sonne/Mond-Schalter in der Toolbar (`ThemeToggle`, Beschriftung nennt die Aktion). Die Wahl wird in `localStorage` (`mdm-doctor.theme`) gemerkt und als `data-theme` am `<html>` gesetzt; ein Inline-Skript in `index.html` setzt sie vor dem ersten Rendern (kein Aufblitzen).
- Tokens: `:root` = dunkel, `:root[data-theme='light']` = hell; Tailwind-Variante `dark:` folgt `data-theme`, nicht `prefers-color-scheme`. Wechsel mit 200-ms-Übergang (entfällt bei reduced-motion).

## Farben & Severity

| Severity                                                                    | Token           | Icon (lucide)   | Text       |
| --------------------------------------------------------------------------- | --------------- | --------------- | ---------- |
| ok                                                                          | `text-ok`       | `CircleCheck`   | In Ordnung |
| warning                                                                     | `text-warning`  | `TriangleAlert` | Prüfen     |
| critical                                                                    | `text-critical` | `OctagonAlert`  | Problem    |
| unknown                                                                     | `text-unknown`  | `CircleHelp`    | Unbekannt  |
| Hintergrund-Tönung von Badges: Farbe mit 12 % Deckkraft (`bg-critical/12`). |

## Texte

- Kurz, konkret, deutsch, ohne Jargon-Overload. Lösungsschritte als Imperativ („Gerät in Intune synchronisieren lassen …“). Da die App read-only ist, formulieren Lösungen, was der Admin **im Intune Admin Center / am Gerät** tun kann – die App führt nichts aus.
- Fehlermeldungen sagen, was fehlt und wer es beheben kann („Benötigt Berechtigung DeviceManagementConfiguration.Read.All – Admin-Consent durch einen Global Administrator erteilen lassen“).

## Barrierefreiheit

- Kontrast ≥ 4.5:1 für Text; Fokus immer sichtbar; vollständig per Tastatur bedienbar; `aria-live="polite"` für Lade-/Ergebnisstatus; Drop-Zone auch als Datei-Button nutzbar.
