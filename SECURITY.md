# Sicherheitsrichtlinie

## Schwachstelle melden

Bitte melde Sicherheitslücken **nicht** als öffentliches Issue, sondern privat über GitHub:
Reiter **Security › Report a vulnerability** im Repository ([Anleitung von GitHub](https://docs.github.com/de/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)). Die Meldung ist nur für die Maintainer sichtbar.

Hilfreich sind: betroffene Version bzw. Commit, Schritte zur Reproduktion, erwartetes und tatsächliches Verhalten sowie die vermutete Auswirkung. **Bitte keine echten Kundendaten** (Tenant-IDs, UPNs, Gerätenamen, Seriennummern, Diagnose-ZIPs) anhängen – ein synthetisches Beispiel genügt.

## Unterstützte Versionen

Unterstützt wird der jeweils aktuelle Stand des Branches `main`. Ältere Stände erhalten keine Korrekturen.

## Sicherheitsmodell

MDM Doctor ist eine reine Single-Page-Anwendung **ohne eigenes Backend**:

- **Read-only:** Gegen Microsoft Graph wird ausschließlich HTTP `GET` gesendet; der Graph-Client bietet keine anderen Verben, ein Test stellt das sicher. Es gibt keine Remote-Aktionen und keine Schreibzugriffe auf Intune- oder Entra-Objekte.
- **Anmeldung:** MSAL, Authorization Code + PKCE, delegierte Berechtigungen (Details und Scopes in der [README](README.md)). Der Token-Cache liegt in `sessionStorage` und endet mit dem Tab. Im Live-Modus meldet die App nach Inaktivität (Standard 30 Minuten, `VITE_IDLE_TIMEOUT_MINUTES`) lokal ab, verwirft geladene Gerätedaten und löscht die Liste „Zuletzt geöffnet“; die nächste Anmeldung erzwingt eine erneute Authentifizierung.
- **ZIP-Analyse lokal:** Diagnose-ZIPs werden im Browser (Web Worker) verarbeitet und nie hochgeladen; sensible Felder (UPN, Tenant-ID, ChannelURI, Seriennummern) werden in der Anzeige maskiert.
- **Content-Security-Policy:** Der Produktions-Build setzt eine strenge CSP (nur eigene Skripte, `connect-src` nur `graph.microsoft.com` und `login.microsoftonline.com`, Trusted Types mit restriktiver Default-Policy, kein `unsafe-inline` für Skripte und `<style>`). HTTP-Header für das Selbst-Hosting (Clickjacking-Schutz u. a.) stehen in der README.
- **Keine Telemetrie:** keine Analytics, keine Tracker, keine Anfragen an Dritte; Schriften und Assets kommen vom eigenen Origin.
- **Lieferkette:** GitHub Actions sind auf Commit-SHAs gepinnt, Dependabot und CodeQL laufen, `npm audit` prüft die Laufzeit-Abhängigkeiten.
- **Keine Kundendaten im Repository:** Demo- und Testdaten sind fiktiv (Contoso).

## Nicht im Umfang

- Schwachstellen in Microsoft Graph, Entra ID, Intune oder in Drittbibliotheken selbst (bitte beim jeweiligen Hersteller melden; Hinweise auf betroffene Abhängigkeiten sind willkommen).
- Fehlkonfigurationen der eigenen Entra-App-Registrierung oder des eigenen Hostings (z. B. fehlende HTTP-Header).
- Angriffe, die einen bereits kompromittierten Browser, Rechner oder Administrator-Account voraussetzen.
- Social Engineering, Denial-of-Service durch massenhafte Anfragen, Berichte automatisierter Scanner ohne nachvollziehbare Auswirkung.
- Funktionale Fehler ohne Sicherheitsbezug (dafür bitte ein normales Issue anlegen).

---

## Summary (English)

Please report vulnerabilities **privately** via GitHub: **Security › Report a vulnerability** on this repository; do not open public issues and do not attach real customer data. Only the current `main` branch is supported. MDM Doctor is a backend-less SPA: it only sends HTTP `GET` requests to Microsoft Graph (read-only), keeps tokens in `sessionStorage`, signs out locally after inactivity (live mode), analyzes diagnostic ZIPs entirely in the browser, ships a strict CSP (incl. Trusted Types) and collects no telemetry. Out of scope: vulnerabilities in Microsoft services or third-party libraries themselves, misconfigured self-hosting or app registrations, attacks requiring an already compromised browser or admin account, and non-security bugs.
