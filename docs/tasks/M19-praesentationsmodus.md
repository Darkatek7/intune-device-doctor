# M19 – Präsentationsmodus

Anlass: Screenshots aus dem Live-Modus enthalten echte Gerätenamen, Benutzernamen und Seriennummern. Ein Schalter „Präsentationsmodus“ verbirgt alle personen- und gerätebezogenen Kennungen, damit man Screenshots machen und den Bildschirm teilen kann, ohne Kundendaten zu zeigen. Das Paket verändert nur, was **angezeigt, kopiert, gedruckt und exportiert** wird – keine Graph-Endpunkte, DTOs, Provider oder Regeln.

## Verhalten

- Schalter in der Toolbar (Auge-Symbol, `aria-pressed`, fester Name „Präsentationsmodus“, `title` nennt die Aktion), in Demo, Live und ZIP-Ansicht; Zustand in `localStorage` (`mdm-doctor.privacy`, abgesichert wie `mdm-doctor.theme`), Standard **aus**. Solange er an ist, steht unter der Toolbar-Zeile dauerhaft die Pille „Präsentationsmodus · Namen verborgen“ samt Hinweis, dass Richtlinien-, Gruppen- und App-Namen sichtbar bleiben (und den Firmennamen enthalten können).
- **Verborgen:** Gerätenamen, Benutzer-Anzeigenamen, UPNs/E-Mail-Adressen, Seriennummern, IMEI/MEID, MAC-, IP-Adressen, Telefonnummern, Objekt-IDs/GUIDs, Name/UPN des angemeldeten Kontos. **Sichtbar:** Richtlinien-, Gruppen-, App-Namen, Modell, Hersteller, Betriebssystem, Fehlercodes, Zeitpunkte.
- **Pseudonyme** statt Punkte: `Gerät-7F3A`, `Benutzer-2C9E`, `benutzer-2c9e@beispiel.example`, `SN-…`, IDs wie `maskId` (`1234…cdef`). Hash aus **zufälligem Sitzungs-Salt** (nur Arbeitsspeicher) + Art + Wert → stabil in der Sitzung und über alle Ansichten, nicht umkehrbar. Jede Pseudonym-Funktion ist idempotent.
- **Ausgaben:** Ticket-Notiz (Kopieren, Druck/PDF), „Stand exportieren“ (Inhalt und Dateiname), kopierte Rohdaten, CSV der Sammelprüfung, Vergleich, Markdown-Bericht des Verbindungstests – alle maskiert; die Dialoge sagen es in einem Satz (`de.privacy.output`).
- **Funktion bleibt:** Zustand und Handler halten die echten Werte; maskiert wird erst an der Anzeige- bzw. Ausgabegrenze. Links mit Kennungen (`PrivateLink`): `href` maskiert, Klick öffnet die echte Adresse.
- **Eingaben:** Suchfeld zeigt nach dem Öffnen eines Geräts (App setzt den Suchtext) nichts mehr an (Enter im leeren Feld wiederholt die letzte Suche); Trefferauswahl und „Nicht gefunden“ wiederholen die Eingabe nicht; die Sammelprüfung leert die Eingabeliste beim Start, zeigt Pseudonyme auch für eingetippte Namen ohne Treffer; „Zuletzt geöffnet“, Beispiel-Chips und Suchvorschläge zeigen Pseudonyme; `document.title`, `title`/`aria-label` und Tooltips ebenfalls.
- **ZIP:** Maskierung von UPN, Tenant-ID, GUIDs bleibt immer aktiv; zusätzlich verbirgt der Modus den Gerätenamen (Titel, Dateiname `DiagLogs-Gerät-XXXX-<Zeitstempel>.zip`, Fortschritt, Vergleich, zusammengeführte Ansicht).

## Umsetzung

- `src/privacy/masker.ts` – `createMasker(salt)`: `device() user() upn() serial() id() imei() mac() phone() ip() fileName()`, `scope(known)` (bekannte Werte, längste zuerst, Wortgrenzen, ohne Groß-/Kleinschreibung), `text(str, scope?)` (bekannte Werte + Sicherheitsnetz: E-Mail, GUID, MAC, IPv4, IPv6), `deep(model, scope?)` (tiefe Transformation, Schlüssel `url`/`docsUrl`/`href`/`alertWebUrl` bleiben für `PrivateLink`). Reine Funktionen.
- `src/privacy/keys.ts` – die **einzige** Stelle mit Feldnamen: `SENSITIVE_KEYS` (Schlüssel → Art), `VISIBLE_KEYS` (bewusst sichtbare Felder, nur vom Abdeckungstest gelesen).
- `src/privacy/collect.ts` – `collectKnown(root)`: schlüsselgetriebener, strukturblinder Sammler (Geräte-IDs aus geräteähnlichen Objekten, `displayName` von Entra-Objekten, dsregcmd-Schlüssel/Wert-Paare, lokaler Teil jeder UPN).
- `src/privacy/view.ts` (`createView`, `viewFor`) – Sicht = Schalter + Masker + bekannte Werte; `text`, `deep`, `extend(quelle)`.
- `src/privacy/privacyContext.ts` / `PrivacyProvider.tsx` – `usePrivacy()` (Schalter + Masker, für Listen und Köpfe), `useBuildPrivacyView(quelle)` (Sicht einer Ansicht), `PrivacyViewProvider` + `usePrivacyView()` (Sicht für alle Nachfahren inkl. Portale/Dialoge, ohne Prop-Drilling). Ohne Provider: Modus aus – bestehende Komponententests bleiben unverändert.
- `src/privacy/storage.ts`, `fileName.ts`; UI `src/ui/PrivacyToggle.tsx` (Schalter + `PrivacyNotice`), `src/ui/PrivateLink.tsx`; Texte `src/i18n/de-privacy.ts` (`de.privacy`).
- Anschluss: `DeviceView`, `ZipView`, `TenantView` (Kacheln, Zeitachse, Ticket-Notiz, Export, Titel), `AppShell` (Suchfeld, Fortschritt), Listen/Köpfe (`ResultPicker`, `RecentDevices`, `Landing`, `SearchField`, `DeviceHeader`, `ZipHeader`, `MergeOffer`, `BulkView`, `PolicyDetailView`, `ConnectionTestView`, `AccountButton`), Dialoge (`TicketNoteDialog`, `CompareDialog`, `EvidenceTable`, `HeaderActions`, `ErrorState`).

## Neue Ansicht anschließen (z. B. M20: Änderungsprotokoll, App-Schutz, Compliance-Übersicht)

1. **Neue Datenfelder** mit Personen-/Gerätebezug: eine Zeile in `SENSITIVE_KEYS` (`src/privacy/keys.ts`), z. B. `initiatedbyuserprincipalname`; bewusst sichtbare Felder in `VISIBLE_KEYS`. Der Test `src/privacy/coverage.test.ts` läuft über alle Demo-Daten und **schlägt fehl**, solange ein verdächtig benanntes Feld (Name, UPN, Mail, Seriennummer, User, Device, IP, Tenant, Owner …) unklassifiziert ist – neue Demo-Daten müssen dafür in `loadAllMockData` (`src/test/privacyScan.ts`) abgelaufen werden (neue Provider-Methode = eine Zeile).
2. **Kacheln/Befunde/Tabellen** (reine Daten): in der Ansicht `const view = useBuildPrivacyView(daten)`, dann `view.deep(evaluate…(daten))` und `<PrivacyViewProvider view={view}>` um den Rückgabewert. Neue Kacheln sind damit automatisch abgedeckt (Beispiel: `TenantView`).
3. **Listen und Köpfe** mit Namen: `const { enabled, masker } = usePrivacy()`, je Feld `enabled ? masker.device(x) : x`, `masker.user(…)`, `masker.upn(…)`, `masker.serial(…)`; Aria-Labels und Tooltips aus dem maskierten Wert bauen. Handler bekommen weiter den echten Wert (Beispiel: `PolicyDetailView`).
4. **Ausgaben** (Kopieren, Drucken, Download): Text vor der Ausgabe durch `view.text(…)`; sagt der Dialog es nicht, einen Satz aus `de.privacy.output` ergänzen.
5. **Links** mit IDs: `<PrivateLink href=…>` statt `<a>`.
6. **Leck-Scanner** (`src/privacy/leaks.test.tsx`): die Ansicht dort einmal rendern und mit `noLeaks('…')` prüfen (Text und Attribute `title`, `aria-label`, `value`, `href`, `alt`, `placeholder`, `document.title`); Gegenprobe: ohne Modus muss `scanDom` Werte finden.

## Akzeptanz

- [x] Schalter in der Toolbar (`aria-pressed`, Name, `title`), `localStorage` `mdm-doctor.privacy` abgesichert, Standard aus; dauerhafter Hinweis bei Modus an
- [x] Gerätenamen, Benutzer, UPN/E-Mail, Seriennummer, IMEI/MEID, MAC, Telefon, IP, GUIDs, Konto-Anzeige verborgen; Richtlinien-/Gruppen-/App-Namen, Modell, OS, Fehlercodes, Zeitpunkte sichtbar (im Hinweis und README offen gesagt)
- [x] Pseudonyme stabil über alle Ansichten, Sitzungs-Salt nur im Arbeitsspeicher, UPN-Format mit fiktiver Domäne, IDs gekürzt wie `maskId`
- [x] Ticket-Notiz, Druck/PDF, Export (Inhalt + Dateiname), kopierte Rohdaten, CSV, Vergleich, Markdown-Bericht maskiert; Dialoge sagen es in einem Satz
- [x] Funktion bleibt: weitere Geräte des Benutzers, Gerät aus Richtlinie öffnen, Sammelprüfung, ZIP zusammenführen, Vergleich, Portal-Links
- [x] Suchfeld nach dem Öffnen leer, kein Echo der Eingabe in Trefferauswahl/Leerzustand, Sammelprüfung leert die Eingabeliste, Zuletzt geöffnet/Chips/Vorschläge mit Pseudonymen, `document.title`/Attribute ohne Kennungen
- [x] ZIP: bestehende Maskierung bleibt, Gerätename (Titel, Dateiname) zusätzlich verborgen
- [x] Leck-Scanner (Komponententest über Startseite, Suchvorschläge, Trefferauswahl, jedes Demo-Gerät inkl. aller Detail-Sheets, Zeitachse, Ticket-Notiz/Druck, Export, Vergleich, Verbindungstest, Mandant, Richtlinien, Sammelprüfung, Beispiel-ZIP, zusammengeführte Ansicht) mit Gegenprobe; Abdeckungstest der Datenfelder
- [x] E2E `e2e/privacy.spec.ts` (alle vier Projekte, axe-Scan mit Modus an)
- [x] Bestehende Tests grün (Standard aus); `npm run lint`, `typecheck`, `vitest`, `vite build` grün
- [x] README „Datenschutz“/„Präsentationsmodus“, `docs/ui-guidelines.md`

## Bekannte Grenzen

- Eigene Eingaben lassen sich während des Tippens nicht verbergen; die Adresszeile trägt `?device=<id>`.
- Namen ohne bekannten Bezug in Freitext (z. B. Benutzername in Ereignisdaten) erkennt das Sicherheitsnetz nicht; vierteilige Versionsnummern nach „Version/v/Build“ bleiben bewusst unberührt (sonst wären sie von IPv4 nicht unterscheidbar).
- Organisationsname eines VPP-Tokens sowie Richtlinien-/Gruppen-/App-Namen bleiben sichtbar (können den Firmennamen enthalten).
- „Zuletzt geöffnet“ liegt weiter mit echten Namen im `localStorage`; nur die Anzeige ist maskiert.
- Hash-Pseudonyme mit 4 Hex-Zeichen können bei sehr langen Listen kollidieren (Unterscheidbarkeit, keine Identität).
