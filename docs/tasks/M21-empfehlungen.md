# M21 – Abgleich mit Microsoft-Empfehlungen (Ansicht „Empfehlungen“)

Neue, rein lesende Ansicht: Die Konfiguration des Mandanten wird mit den auf Microsoft Learn
dokumentierten Empfehlungen verglichen. Je Prüfung: Ist-Wert, Sollwert, betroffene Richtlinie, Status,
Learn-Link. Freigaben des Projektinhabers (2026-11-25): **Beta-Ausnahme** für Einstellungskatalog,
Endpunktsicherheit und Sicherheitsbaselines (`/beta/deviceManagement/configurationPolicies…`,
`…/configurationPolicyTemplates…`) sowie zwei neue **optionale** Scopes `SecurityEvents.Read.All` und
`Policy.Read.All`.

## Grundregeln (zusätzlich zu CLAUDE.md)

- **Jeder Sollwert braucht eine Learn-Quelle**, die genau diesen Wert nennt. Kein Wert aus dem Gedächtnis,
  aus Blogs oder aus CIS/BSI. Findet sich kein dokumentierter Sollwert, gibt es keine Prüfung –
  stattdessen der Hinweis „Microsoft dokumentiert dafür keinen Sollwert“.
- **Sprache der Bewertung:** „weicht von der Empfehlung ab“, nie „falsch“/„unsicher“. Microsoft nennt die
  Werte selbst Ausgangspunkt. Abweichung → höchstens `warning`; `critical` nur, wo Learn die Lücke
  ausdrücklich als Risiko benennt (z. B. Geräte ohne Compliance-Richtlinie gelten als konform, während
  Bedingter Zugriff Konformität verlangt).
- **Read-only:** keine Schaltfläche zum Beheben; nur Links ins Intune Admin Center, soweit in
  `src/links/intunePortal.ts` belegt.
- **Keine personenbezogenen Daten** im Modell (siehe Kopf von `src/domain/posture.ts`).
- Beta-Quellen sind in der UI als „Beta“ gekennzeichnet und in `docs/graph-api-reference.md` als
  freigegebene Ausnahme dokumentiert.

## Vertrag (steht, nicht ohne Rücksprache ändern)

- `src/domain/posture.ts` – Rohdaten `TenantPosture` (acht `SectionResult`-Quellen), `PostureLevel`.
  `settings`-Schlüssel sind **exakt die Graph-Eigenschaftsnamen** des jeweiligen Typs.
- `DeviceDataProvider.getTenantPosture(options?)` – wirft nur bei Abbruch.
- `TileId`: `postureTenantSettings`, `postureCoverage`, `postureAccess`, `postureComplianceWindows|Ios|Android|Macos`,
  `postureAppProtectionIos|Android`, `postureBaselines`, `postureEndpointSecurity`, `postureSecureScore`
  (Titel in `de.tiles`, Icons in `src/ui/tileIcons.ts`).
- Regelwerk: `evaluatePosture(posture: TenantPosture, options: { level: PostureLevel; now: Date }): Tile[]`
  in `src/rules/posture/index.ts`, dazu `POSTURE_SECTIONS` (Abschnitte der Ansicht mit ihren Kacheln) und
  `postureScore(tiles)` (erfüllt/gesamt). Ausgabe sind die vorhandenen `Tile`/`Finding`/`FindingTable`-Typen,
  damit Kachelraster und Detail-Sheet unverändert funktionieren.

## S1 – Graph-Anbindung (`graph-implementer`)

Quellen, jeweils auf Learn verifizieren (Endpunkt, Felder, Enums, Scope) und in
`docs/graph-api-reference.md` mit Link eintragen:

| Quelle | Endpunkt | Scope |
| --- | --- | --- |
| `complianceSettings` | `GET /deviceManagement?$select=settings` (deviceManagementSettings) | `DeviceManagementConfiguration.Read.All` (prüfen) |
| `platformCounts` | `GET /deviceManagement/managedDeviceOverview` | `DeviceManagementManagedDevices.Read.All` |
| `compliancePolicies` | `GET /deviceManagement/deviceCompliancePolicies` (abgeleitete Typen mit allen Einstellungen), je Richtlinie Zuweisungen und `scheduledActionsForRule` (mit `$expand`, falls dokumentiert – sonst Einzelabrufe mit Obergrenze) | `DeviceManagementConfiguration.Read.All` |
| `appProtectionPolicies` | `GET /deviceAppManagement/iosManagedAppProtections`, `…/androidManagedAppProtections` | `DeviceManagementApps.Read.All` (optional, vorhanden) |
| `conditionalAccess` | `GET /identity/conditionalAccess/policies` | `Policy.Read.All` (neu, optional) |
| `secureScore` | `GET /security/secureScores?$top=1`, `GET /security/secureScoreControlProfiles` | `SecurityEvents.Read.All` (neu, optional) |
| `catalogPolicies` (beta) | `GET /beta/deviceManagement/configurationPolicies` | `DeviceManagementConfiguration.Read.All` |
| `policyTemplates` (beta) | `GET /beta/deviceManagement/configurationPolicyTemplates` | `DeviceManagementConfiguration.Read.All` |
| Baseline-Vergleich (beta) | `GET /beta/deviceManagement/configurationPolicies/{id}/settings`, `GET /beta/deviceManagement/configurationPolicyTemplates/{id}/settingTemplates` | wie oben |

- Compliance-Typen: nur die in **v1.0** dokumentierten abgeleiteten Typen bekommen Einstellungen
  (`windows10CompliancePolicy`, `iosCompliancePolicy`, `macOSCompliancePolicy`, `androidCompliancePolicy`,
  `androidWorkProfileCompliancePolicy`). Alles andere → `type: 'other'`, `settings: {}`.
- Texte aus Secure Score (`description`, `remediation`) können HTML enthalten → im Mapper zu reinem Text
  machen (keine HTML-Senke; Trusted Types sind erzwungen).
- Seiten- und Mengenobergrenzen als Konstanten in `endpoints.ts`; `truncated` setzen.
- `MAX_BASELINE_COMPARISONS` (Vorschlag 5): nur Richtlinien mit `templateFamily: 'baseline'`, zuletzt
  geänderte zuerst. Vergleich nur für einfache Einstellungstypen (Auswahl, einfacher Wert); alles andere
  zählt in `skippedCount`.
- 403/404/429 je Quelle über `SectionResult`; neue Scopes in `OPTIONAL_SCOPES`; Verbindungstest-Registry
  ergänzen, falls die Endpunkt-Registry das verlangt.

### Akzeptanz S1

- [ ] Jeder Endpunkt, jedes Feld und jeder Enum-Wert auf Learn verifiziert, mit Link dokumentiert
- [ ] Nur GET; Beta-Endpunkte als freigegebene Ausnahme dokumentiert und im Modell erkennbar
- [ ] Keine Benutzer-/Gruppen-/Mandanten-IDs im Modell (Test)
- [ ] Tests je Quelle: ok, 403, 404, 429, Seitengrenze

## S2 – Regelwerk und Texte (Katalog der Empfehlungen)

`src/rules/posture/` (reine Funktionen), Texte in `src/i18n/de-posture.ts`, Quellen in
`src/rules/knowledge/docs.ts`.

Empfehlungen und ihre Learn-Quellen (jeweils die Tabelle auf der Seite lesen und exakt übernehmen):

- **Mandanten-Einstellungen:** „Mark devices with no compliance policy assigned as“ → „Not compliant“,
  wenn Bedingter Zugriff mit Compliance genutzt wird; Gültigkeitszeitraum (Standard 30 Tage).
  Quelle: Intune › Compliance › Übersicht („Compliance policy settings“).
- **Abdeckung:** jede Plattform mit verwalteten Geräten hat eine **zugewiesene** Compliance-Richtlinie
  (Zero-Trust-Empfehlungen für Intune, „Compliance policies protect … devices“).
- **Bedingter Zugriff:** aktive Richtlinie, die ein konformes Gerät verlangt („Require compliant PCs and
  mobile devices“, Zero Trust › Common security policies).
- **Compliance Windows:** Tabelle „Recommended compliance settings for Windows 10 and later“ (Zero Trust).
- **Compliance iOS/iPadOS und Android:** Sicherheitskonfigurations-Frameworks Stufe 1–3
  (`intune/device-security/security-configurations/…`), je Registrierungsart, soweit der v1.0-Typ die
  Einstellung kennt. Für macOS: nur, wenn Learn Sollwerte nennt – sonst nur Abdeckung.
- **App-Schutz iOS/Android:** „Data protection framework using app protection policies“, Stufe 1–3.
- **Sicherheitsbaselines (Beta):** vorhanden und zugewiesen; Vorlagenversion aktuell (`lifecycleState`);
  Abweichungen von den Standardwerten der Vorlage (Tabelle Einstellung/Ist/Standard).
- **Endpunktsicherheit (Beta):** je Bereich (Antivirus, Datenträgerverschlüsselung, Firewall, ASR, EDR,
  Kontoschutz) mindestens eine zugewiesene Richtlinie – nur, soweit Learn das als Empfehlung nennt.
- **Secure Score:** Empfehlungen der Kategorie Gerät bzw. des Dienstes Intune mit erreichter und maximaler
  Punktzahl; Microsoft-Texte unverändert (`lang="en"`).

Stufe: Für Frameworks mit Stufen bewertet das Regelwerk gegen `options.level` (Standard 2) und nennt je
Richtlinie die höchste vollständig erreichte Stufe. Gibt es mehrere Richtlinien einer Plattform, wird jede
einzeln bewertet (nicht zusammengeführt – welche Richtlinie für ein Gerät gilt, hängt von Zuweisungen ab).

### Akzeptanz S2

- [ ] Jede Prüfung trägt `docsUrl` auf die Learn-Seite, die den Sollwert nennt
- [ ] Tests je Prüfung: erfüllt, abweichend, nicht konfiguriert, Quelle nicht verfügbar (403/unavailable)
- [ ] Keine Aussage ohne Datenbasis: fehlende Quelle → Kachel „nicht prüfbar“ mit Grund und Scope

## S3 – Demo-Daten (`mock-data-writer`)

`src/providers/mock/posture.ts` + `MockProvider.getTenantPosture`. Fiktiver Contoso-Mandant mit
bewusst gemischtem Bild (erfüllte, abweichende und nicht prüfbare Fälle in jeder Kachel), über
`MockTenantFixture` je Quelle überschreibbar (auch `forbidden`/`error`).

## S4 – Ansicht „Empfehlungen“ (`ui-builder`)

`?view=recommendations` (+ `&level=1|2|3`, `&tile=`), Navigationseintrag „Empfehlungen“, lazy geladen.
Kopf mit Gesamtbild („x von y Empfehlungen erfüllt“) und Stufenwahl; Abschnitte mit Kacheln; Detail-Sheet
wie in „Mandant“. Präsentationsmodus (M19) deckt die Ansicht ab; Leck-Scanner und Abdeckungstest grün.

## S5 – Abschluss

README (Scopes, Beta-Ausnahme, Demo-Schritt, Grenzen), `docs/live-verification.md`, CLAUDE.md (Beta-Ausnahme),
E2E inkl. axe, Review.
