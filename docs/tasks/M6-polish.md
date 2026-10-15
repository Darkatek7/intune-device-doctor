# M6 – Feinschliff & Übergabe

**Delegation:** `ui-builder` (sonnet) für Polish; `reviewer` (haiku) für den Abschluss-Check.

## Schritte
1. Durchgang Leer-/Lade-/Fehlerzustände in allen Modi; Drosselungshinweis; Offline-Hinweis.
2. Dark Mode, `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast` prüfen; Tastatur-Durchgang; Lighthouse-A11y ≥ 95 (manuell dokumentieren, falls kein Browser verfügbar).
3. Export: Befunde eines Geräts als Markdown in die Zwischenablage („Ticket-Notiz kopieren“) – rein lokal.
4. README: Screenshots-Platzhalter, Demo-Skript für die Hackathon-Präsentation (3 Minuten: gesundes Gerät → PC014 BitLocker → PC042 Richtlinienkonflikt → Beispiel-ZIP mit PRT-Fehler → Berechtigungsfall PC050), Live-Einrichtung, Datenschutz, bekannte Grenzen (Settings Catalog, App-Status pro Gerät, Binärlogs).
5. `reviewer`-Lauf: read-only, nur dokumentierte Endpunkte, keine Kundendaten, alle Texte in `de.ts`, Quellenpflicht.
6. PR `mvp → main` mit Zusammenfassung und Checkliste.

## Akzeptanz
- [x] `npm run check` grün, PR offen
- [x] Reviewer-Befunde behoben oder begründet
