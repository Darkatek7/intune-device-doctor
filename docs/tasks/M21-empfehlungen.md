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

| Quelle                    | Endpunkt                                                                                                                                                                                                                      | Scope                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `complianceSettings`      | `GET /deviceManagement?$select=settings` (deviceManagementSettings)                                                                                                                                                           | `DeviceManagementConfiguration.Read.All` (prüfen)     |
| `platformCounts`          | `GET /deviceManagement/managedDeviceOverview`                                                                                                                                                                                 | `DeviceManagementManagedDevices.Read.All`             |
| `compliancePolicies`      | `GET /deviceManagement/deviceCompliancePolicies` (abgeleitete Typen mit allen Einstellungen), je Richtlinie Zuweisungen und `scheduledActionsForRule` (mit `$expand`, falls dokumentiert – sonst Einzelabrufe mit Obergrenze) | `DeviceManagementConfiguration.Read.All`              |
| `appProtectionPolicies`   | `GET /deviceAppManagement/iosManagedAppProtections`, `…/androidManagedAppProtections`                                                                                                                                         | `DeviceManagementApps.Read.All` (optional, vorhanden) |
| `conditionalAccess`       | `GET /identity/conditionalAccess/policies`                                                                                                                                                                                    | `Policy.Read.All` (neu, optional)                     |
| `secureScore`             | `GET /security/secureScores?$top=1`, `GET /security/secureScoreControlProfiles`                                                                                                                                               | `SecurityEvents.Read.All` (neu, optional)             |
| `catalogPolicies` (beta)  | `GET /beta/deviceManagement/configurationPolicies`                                                                                                                                                                            | `DeviceManagementConfiguration.Read.All`              |
| `policyTemplates` (beta)  | `GET /beta/deviceManagement/configurationPolicyTemplates`                                                                                                                                                                     | `DeviceManagementConfiguration.Read.All`              |
| Baseline-Vergleich (beta) | `GET /beta/deviceManagement/configurationPolicies/{id}/settings`, `GET /beta/deviceManagement/configurationPolicyTemplates/{id}/settingTemplates`                                                                             | wie oben                                              |

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

- [x] Jeder Endpunkt, jedes Feld und jeder Enum-Wert auf Learn verifiziert, mit Link dokumentiert
- [x] Nur GET; Beta-Endpunkte als freigegebene Ausnahme dokumentiert und im Modell erkennbar
- [x] Keine Benutzer-/Gruppen-/Mandanten-IDs im Modell (Test)
- [x] Tests je Quelle: ok, 403, 404, 429, Seitengrenze

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

- [x] Jede Prüfung trägt `docsUrl` auf die Learn-Seite, die den Sollwert nennt
- [x] Tests je Prüfung: erfüllt, abweichend, nicht konfiguriert, Quelle nicht verfügbar (403/unavailable)
- [x] Keine Aussage ohne Datenbasis: fehlende Quelle → Kachel „nicht prüfbar“ mit Grund und Scope

## S3 – Demo-Daten (`mock-data-writer`)

`src/providers/mock/posture.ts` + `MockProvider.getTenantPosture`. Fiktiver Contoso-Mandant mit
bewusst gemischtem Bild (erfüllte, abweichende und nicht prüfbare Fälle in jeder Kachel), über
`MockTenantFixture` je Quelle überschreibbar (auch `forbidden`/`error`).

### Akzeptanz S3

- [x] Fiktiver Contoso-Mandant mit gemischtem Bild (erfüllte, abweichende und nicht prüfbare Fälle)
- [x] Je Quelle über `MockTenantFixture` überschreibbar (auch `forbidden`/`error`)
- [x] Keine echten Daten, keine Benutzer-, Gruppen- oder Mandanten-IDs

## S4 – Ansicht „Empfehlungen“ (`ui-builder`)

`?view=recommendations` (+ `&level=1|2|3`, `&tile=`), Navigationseintrag „Empfehlungen“, lazy geladen.
Kopf mit Gesamtbild („x von y Empfehlungen erfüllt“) und Stufenwahl; Abschnitte mit Kacheln; Detail-Sheet
wie in „Mandant“. Präsentationsmodus (M19) deckt die Ansicht ab; Leck-Scanner und Abdeckungstest grün.

### Akzeptanz S4

- [x] `?view=recommendations` mit `&level=1|2|3` und `&tile=`, Navigationseintrag „Empfehlungen“, lazy geladen
- [x] Kopf mit Gesamtbild („x von y Empfehlungen erfüllt“) und Stufenwahl; Abschnitte mit Kacheln; Detail-Sheet
- [x] Präsentationsmodus (M19) deckt die Ansicht ab; Leck-Scanner und Abdeckungstest grün

## S5 – Abschluss

README (Scopes, Beta-Ausnahme, Demo-Schritt, Grenzen), `docs/live-verification.md`, CLAUDE.md (Beta-Ausnahme),
E2E inkl. axe, Review.

### Akzeptanz S5

- [x] README: Scope-Tabelle (`Policy.Read.All`, `SecurityEvents.Read.All`), Demo-Schritt, „Bekannte Grenzen“, Datenschutz
- [x] CLAUDE.md: zwei freigegebene Beta-Ausnahmen, Quellenpflicht für Sollwerte, Architektur-Zeile
- [x] `docs/live-verification.md` Abschnitt 9 (Prüfschritte gegen einen echten Mandanten)
- [x] E2E inkl. axe, unabhängige Prüfung (siehe unten)

## S6 – Vollständige Liste, Export, Aktualität

Nachtrag auf Wunsch des Auftraggebers: Jede einzelne Empfehlung soll mit Wert und Quelle sichtbar sein, und
die Aktualität der Sollwerte soll nachvollziehbar und überwacht sein.

### Akzeptanz S6

- [x] Detail-Sheet: Liste „Alle Empfehlungen“ mit **jeder** Einzelprüfung (erfüllt, weicht ab, nicht prüfbar), nach Richtlinie gruppiert; je Zeile Status, Ist, Empfehlung, Stufe, Grund, technischer Name (Graph-Eigenschaft) und eigener Learn-Link; Filter mit Zählern
- [x] Export „Exportieren (CSV)“: alle Einzelprüfungen der gewählten Stufe, so wie angezeigt (Präsentationsmodus wirkt), mit Schutz vor Formel-Injektion
- [x] Stand der Sollwerte in der Ansicht (`POSTURE_CATALOG_VERIFIED_ON`), Hinweis ab 180 Tagen
- [x] `npm run posture:sources` + wöchentlicher Workflow: Hash je Learn-Seite und Prüfung jeder Sprungmarke gegen `docs/posture-sources.lock.json`; Befund → Issue, nie automatische Übernahme
- [x] Erster Lauf fand einen toten Anker (`create-policy#app-protection-policies-for-iosipados-and-android-apps`, von Microsoft umbenannt) – korrigiert

Offen: Der Workflow lief noch nie auf GitHub (erst nach dem Merge auf `main` möglich).

## Ergebnis der unabhängigen Prüfung

Eine unabhängige Prüfung des Regelwerks gegen die Learn-Quellen hat neun Befunde ergeben; alle sind behoben:

- **Stufe 3 und Mobile Threat Defense:** MTD ist keine Pflicht – Microsoft nennt Defender for Endpoint **oder** MTD; die Defender-Bewertung ist über v1.0 nicht lesbar und deshalb „nicht prüfbar“.
- **Endpunktsicherheit je Profil:** Die Zuordnung zum empfohlenen Profil erfolgt über den Vorlagennamen (offen ausgewiesene Heuristik) statt über den Bereich allein.
- **Android-Abdeckung getrennt:** persönliche und unternehmenseigene Geräte werden unterschieden; der Richtlinientyp für vollständig verwaltete Geräte ist nur in Beta dokumentiert und daher „nicht prüfbar“. (Stand 2026-11-25; seit dem Nachtrag vom 2026-11-27 unten wird der Typ über die dritte Beta-Ausnahme gelesen und bewertet.)
- **iOS-Wert 0:** Bei „Maximum minutes after screen lock“ gilt der Wert 0 jetzt als „nicht prüfbar“ statt als Abweichung – ob Graph damit „Sofort“ oder „nicht konfiguriert“ meint, ist nicht dokumentiert (live zu verifizieren, siehe `docs/live-verification.md`).
- **Fehlende App-Schutz-Zeilen:** drei Zeilen des Frameworks als „nicht prüfbar“ ergänzt („save copies to selected services“ – das v1.0-Enum kennt „Photo Library“ nicht; „open data from selected services“ und „Select apps to exempt“ – keine v1.0-Eigenschaft).
- **Vier Textkorrekturen:** Bedingter Zugriff mit Konformität als ODER-Alternative hat einen eigenen, zutreffenden Text; „App-Schutz lässt sich nur zusammen mit Bedingtem Zugriff durchsetzen“ statt „greift erst“; ein nur für iOS belegtes Zitat entfernt; „neuere Baseline-Versionen können …“ statt „enthalten …“.
- **Secure Score:** Filter nur noch auf die Kategorie „Device“; ohne passende Empfehlungen „Keine Geräte-Empfehlungen gemeldet“ statt „erfüllt“; als „Risiko akzeptiert“ markierte Empfehlungen liest die App bewusst nicht (im Text ausgewiesen).

## Nachtrag 2026-11-27 – Android Enterprise „vollständig verwaltet“ (dritte Beta-Ausnahme)

Freigabe des Projektinhabers (2026-11-27): `GET /beta/deviceManagement/deviceCompliancePolicies` darf gelesen
werden, um Richtlinien aufzuwerten, die v1.0 ohne dokumentierten Typ liefert. Der Graph-Provider liefert
Richtlinien des Typs `androidDeviceOwnerCompliancePolicy` als `type: 'androidDeviceOwner'`, `beta: true`,
mit den 25 Einstellungs-Eigenschaften der Beta-Ressource; `betaRead` beschreibt den Abruf (`ok`/`failed`,
Seitengrenze). Sollwerte gegengeprüft am 2026-11-27 – nur dieser Zusatz, `POSTURE_CATALOG_VERIFIED_ON`
bleibt unverändert.

**Framework** `ANDROID_FULLY_MANAGED_COMPLIANCE` (`src/rules/posture/catalog/compliance.ts`), Quelle:
„Android Enterprise fully managed device security configuration examples“, Tabellen „Device compliance
(level 1/2/3)“ (`Docs.postureAndroidFullyManagedLevel1…3`). Anders als das Arbeitsprofil kennt es Stufe 1.

| Prüfung                 | Stufe | Graph-Eigenschaft (beta)                                                       | Learn-Sollwert                            |
| ----------------------- | ----- | ------------------------------------------------------------------------------ | ----------------------------------------- |
| `afmBasicIntegrity`     | 1     | `securityRequireSafetyNetAttestationBasicIntegrity`                            | Check basic integrity                     |
| `afmOsMinimum`          | 1     | `osMinimumVersion`                                                             | gesetzt (Learn: nur Format, Beispiel 9.0) |
| `afmPasswordRequired`   | 1     | `passwordRequired`                                                             | Require                                   |
| `afmPasswordType`       | 1     | `passwordRequiredType`                                                         | Numeric Complex (oder strenger)           |
| `afmPasswordMinLength`  | 1     | `passwordMinimumLength`                                                        | 6 (oder mehr)                             |
| `afmPasswordInactivity` | 1     | `passwordMinutesOfInactivityBeforeLock`                                        | 5 (oder weniger)                          |
| `afmEncryption`         | 1     | `storageRequireEncryption`                                                     | Require                                   |
| `afmIntuneAppIntegrity` | 1     | `securityRequireIntuneAppIntegrity`                                            | Require                                   |
| `afmMarkNoncompliant`   | 1     | – (`scheduledActionsForRule`, `block` mit 0 Stunden)                           | Immediately                               |
| `afmPasswordExpiration` | 2     | `passwordExpirationDays`                                                       | 365 (oder weniger)                        |
| `afmPasswordReuse`      | 2     | `passwordPreviousPasswordCountToBlock`                                         | 5 (oder mehr)                             |
| `afmDeviceIntegrity`    | 2     | `securityRequireSafetyNetAttestationCertifiedDevice`                           | Check basic integrity & device integrity  |
| `afmStrongIntegrity`    | 2     | `securityRequiredAndroidSafetyNetEvaluationType` = `hardwareBacked`            | Check strong integrity                    |
| `afmThreatLevel`        | 3     | `deviceThreatProtectionEnabled`, `deviceThreatProtectionRequiredSecurityLevel` | Secured                                   |

**Bewusst nicht geprüft bzw. „nicht prüfbar“ – und warum**

- „Minimum security patch level: Not configured“ (Stufe 1): keine Prüfung – jede Einstellung erfüllt den Wert.
- „Minimum OS version, Example: 11.0“ (Stufe 3): keine zweite Prüfung – Learn nennt wie in Stufe 1 nur
  Format und Beispiel, keinen festen Wert.
- „Require the device to be at or under the machine risk score: Clear“ (Stufe 3, `afmMdeRisk`): Die
  Eigenschaft `advancedThreatProtectionRequiredSecurityLevel` ist dokumentiert, nicht aber, welcher Wert von
  `deviceThreatProtectionLevel` dem Portalwert „Clear“ entspricht → `uncheckable` mit dem neuen Grund
  `valueMappingUndocumented`. Keine Prüfung liest die Eigenschaft.
- Kennworttyp `lowSecurityBiometric` und `customPassword` (sowie unbekannte Werte): kein dokumentierter Rang
  gegenüber „Numeric Complex“ → nicht prüfbar (weder erfüllt noch abweichend). `deviceDefault`, `required`,
  `numeric` weichen ab; `numericComplex`, `alphabetic`, `alphanumeric`, `alphanumericWithSymbols` erfüllen.
- `passwordMinutesOfInactivityBeforeLock = 0`: Die Beta-Ressource nennt weder Wertebereich noch die
  Bedeutung von 0 → nicht prüfbar (eigener Grundtext, nicht die iOS-Begründung „Portal bietet Sofort an“).
- Bedrohungsstufe (Mobile Threat Defense) nicht aktiviert: nicht prüfbar, keine Abweichung – Learn nennt
  Defender for Endpoint **oder** MTD („It isn't necessary to deploy both“); die Defender-Alternative ist
  wegen der fehlenden Wertzuordnung nicht bewertbar. Kein Text dieses Frameworks behauptet „v1.0“.
- Die Tabellen „Device restrictions (level 1–3)“ derselben Seite betreffen Konfigurationsprofile, keine
  Compliance-Richtlinien – nicht Teil dieser Prüfung.

**Kachel „Compliance: Android“**

- Bewertet bis zu zwei Frameworks (Arbeitsprofil Stufe 2/3, vollständig verwaltet Stufe 1–3). Der Fakt
  „Bewertetes Framework“ nennt die tatsächlich bewerteten. „Stufe N erreicht“ erscheint nur, wenn alle
  bewerteten Frameworks gegen dieselbe Stufe bewertet werden und jede gezählte Richtlinie sie erreicht – bei
  gewählter Stufe 1 (Arbeitsprofil effektiv 2, vollständig verwaltet 1) steht der Zählwert, und die Fakten
  nennen die Stufe je Framework. Je Framework ein eigener Befund „nicht prüfbar“.
- **Dedizierte Geräte:** Der Graph-Typ gilt laut Beta-Ressource auch für dedizierte Geräte und
  unternehmenseigene Geräte mit Arbeitsprofil; die Learn-Empfehlung nennt „fully managed mobile users“. Die
  Eigenschaften unterscheiden die Arten nicht. Die Kachel sagt das als Fakt „Geltung des Richtlinientyps“
  und im Befund jeder abweichenden Richtlinie („dort können Abweichungen beabsichtigt sein“).
- **Beta-Kennzeichnung** (Fakt „Datenquelle“, Zusatz „Beta-API“, Quelle der Beta-Liste) nur, wenn eine
  Richtlinie der Kachel `beta: true` trägt; ebenso in der Kachel „Abdeckung der Geräte“, wenn die
  Abdeckung unternehmenseigener Android-Geräte auf einer solchen Richtlinie beruht.
- `type: 'other'` mit Android-Typ bleibt „nicht prüfbar“ – mit zutreffendem Grund: anderer Beta-Typ
  (z. B. AOSP), Beta-Liste nicht lesbar (`betaRead.status = 'failed'`) oder abgeschnitten. Dasselbe gilt für
  Richtlinien ohne erkennbare Plattform.
- **Abdeckung:** Eine zugewiesene Richtlinie `androidDeviceOwner` erfüllt „Android unternehmenseigen“. Fehlt
  sie, bleibt es „nicht prüfbar“ (kein kritischer Befund): Die Beta-Liste wird nur gelesen, wenn v1.0
  Richtlinien ohne dokumentierten Typ liefert, und kann scheitern.

**Quellenwächter:** `docs/posture-sources.lock.json` um die drei Sprungmarken der Seite und um drei
Beta-Seiten ergänzt (Ressource `androidDeviceOwnerCompliancePolicy`, Enums
`androidDeviceOwnerRequiredPasswordType` und `androidSafetyNetEvaluationType`); die Hashes aller bisherigen
Seiten blieben unverändert.
