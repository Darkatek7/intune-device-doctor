# UI-Guidelines (Apple-Design-Prinzipien fürs Web)

Ziel: ruhig, klar, schnell – ein Admin erfasst in < 3 Sekunden, ob und wo ein Gerät ein Problem hat. Tokens stehen in `src/index.css` (`@theme`).

## Layout

- **Toolbar** (sticky, transluzent: `bg-surface-raised` + `backdrop-blur-xl backdrop-saturate-150`): links App-Name, Mitte Suchfeld (⌘K / `/` fokussiert), rechts Demo/Live-Segmented-Control und Konto. Statt Trennlinie ein weicher Scroll-Edge-Verlauf, nur sobald Inhalt darunter scrollt.
- **Leerer Zustand**: großes zentriertes Suchfeld, darunter Drop-Zone „oder DiagLogs-ZIP hierher ziehen“ + Datenschutzhinweis; im Demo-Modus 3–4 Chips mit Beispielgeräten (ein Klick = Szenario laden).
- **Ergebnis**: Geräte-Header (Name groß, darunter Modell · Nutzer · OS · Enrollment-Datum; rechts Zusammenfassung „3 Probleme · 1 Hinweis“ mit Severity-Farbe), darunter Kachel-Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`, `gap-4`. Kacheln sortiert: critical → warning → unknown → ok (stabile Reihenfolge innerhalb).
- Max. Inhaltsbreite ~ 80rem, Seitenabstand 1rem mobil / 2rem Desktop. Abstände in rem.

## Kachel (`StatusTile`)

- `rounded-tile bg-surface`, feiner Schatten (`shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_rgb(0_0_0/0.04)]`), Padding 1.25rem.
- Oben: Icon (lucide, 20px) + Titel (`text-sm font-medium text-secondary-label`) + Status-Badge rechts (Punkt + Text, z. B. „Problem“). **Status nie nur über Farbe** – immer Icon/Text.
- Mitte: Hauptwert groß (`text-title font-semibold`), darunter 1 Zeile Kontext (`text-sm text-secondary-label`, `line-clamp-1`).
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
