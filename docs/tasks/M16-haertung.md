# M16 – Sicherheits-Härtung ohne Funktionsverlust

Ziel: Angriffsfläche der öffentlichen SPA verkleinern (CSP, Trusted Types), Live-Sitzungen absichern (Abmeldung bei Inaktivität, keine Gerätenamen nach dem Abmelden), Lieferkette absichern und das Repository rechtlich/organisatorisch abrunden (SECURITY.md, Lizenz). Keine neuen Abhängigkeiten, keine neuen Graph-Endpunkte.

## S1 – Content-Security-Policy enger (`vite.config.ts`, `cspPlugin`)

- `style-src 'self' 'unsafe-inline'` → `style-src 'self'` + `style-src-attr 'unsafe-inline'`. `motion` setzt nur Inline-`style`-Attribute (Element-Animationen); `<style>`-Elemente legt zur Laufzeit nichts an:
  - App-Code: kein `createElement('style')`, kein `<style>` in JSX (Suche über `src/`).
  - Bundles: `motion`/`framer-motion` enthalten `PopChild` (`AnimatePresence mode="popLayout"`, legt ein `<style>` mit `insertRule` an) und `AnimateView`/View-Transitions – beides **wird von der App nicht verwendet** (`mode="popLayout"` kommt in `src/` nicht vor). Sollte künftig `popLayout` genutzt werden, muss `style-src` eine Nonce bekommen oder die Stelle anders gelöst werden – nicht `'unsafe-inline'` zurückholen.
- E2E `e2e/csp.spec.ts` (Produktions-Build): Startseite, Gerät öffnen, Detail-Sheet, Beispiel-ZIP (Web Worker), Ansichten „Mandant“ und „Richtlinien“ (inkl. Unterseite) → kein `securitypolicyviolation`, keine CSP-/Trusted-Types-Konsolenmeldung, kein `pageerror`. Zweiter Test prüft die Erzwingung von Trusted Types.

### Trusted Types – Untersuchung und Entscheidung

Untersucht wurden der Quelltext der Pakete in `node_modules` und die gebauten Bundles (`dist/assets/*.js`) auf Senken: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `Function('…')`, `createElement('script')`, `script.src/.text`, `srcdoc`, `new Worker(…)`, `importScripts`, `DOMParser`, `createContextualFragment`, `setTimeout(string)`, `setAttribute('src'|'on*')`.

| Paket / Code                                                       | Fundstelle                                                                                                                                            | Bewertung                                                                                                                                                                              |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App-Code (`src/`)                                                  | kein `innerHTML`/`eval`/`dangerouslySetInnerHTML`; `new Worker(new URL('./worker', import.meta.url))` in `runAnalysis`                                | Worker-Skript-URL ist eine Senke (TrustedScriptURL) → durch Default-Policy (same-origin) gedeckt                                                                                       |
| `react-dom`                                                        | `innerHTML` für `dangerouslySetInnerHTML` und für `<script>`-Elemente in JSX; `createElement('script')` für hoistbare Skripte                         | Wird von der App nicht ausgelöst (kein `dangerouslySetInnerHTML`, kein `<script>` in JSX); ein Treffer würde von der Default-Policy abgelehnt (`createHTML` → `null`) statt ausgeführt |
| `motion` / `framer-motion` / `motion-dom`                          | `insertRule` (PopChild), `textContent` am `<style>`                                                                                                   | keine Trusted-Types-Senke (CSSOM bzw. `textContent` am Nicht-Skript-Element); `<style>`-Element wird nicht angelegt (s. S1)                                                            |
| `@zip.js/zip.js`                                                   | `new Worker(url)` (`codec-worker-web.js`, `data:`/`blob:`/URL)                                                                                        | Wird nur im Hauptthread des Analysepfads mit `useWebWorkers: false` betrieben (`src/diagnostics/zip/reader.ts`: wir laufen bereits im eigenen Worker) – kein Worker aus zip.js         |
| `@azure/msal-browser` / `@azure/msal-common` / `@azure/msal-react` | `iframe.src = requestUrl` (`SilentHandler`); `window.location.assign/replace(url)` (`NavigationClient`); `window.open` im Popup-Relay (nicht genutzt) | `iframe.src` und Navigation zu https-URLs sind **keine** Trusted-Types-Senken (nur `javascript:`-Navigation, `srcdoc`, Skript-Senken). Keine `eval`/`Function`/`innerHTML`-Treffer     |
| `lucide-react`                                                     | keine Treffer                                                                                                                                         | –                                                                                                                                                                                      |
| `BookmarkletDialog`                                                | `setAttribute('href', 'javascript:…')`                                                                                                                | Zuweisung ist keine Senke; die Navigation wird in der App unterdrückt, der Link ist nur zum Ziehen in die Lesezeichenleiste (läuft dann auf fremder Seite)                             |

**Entscheidung: aktiviert** – `require-trusted-types-for 'script'` im Produktions-Meta-Tag plus strenge Default-Policy (`src/security/trustedTypes.ts`, installiert als erster Import in `src/main.tsx`, nur im Produktions-Build):

- `createScriptURL`: nur `http(s)`-URLs der eigenen Origin und `blob:`-URLs der eigenen Origin; alles andere → `null` (die Senke wirft `TypeError`).
- `createHTML`, `createScript`: immer `null` (abgelehnt).
- Begründung: (a) jede gefundene Laufzeit-Senke (Worker-URL) ist gedeckt, alle übrigen Fundstellen sind in der App nicht erreichbar oder keine Senke; (b) die komplette E2E-Suite läuft mit aktivierter Richtlinie grün; (c) in MSAL wurde keine ungedeckte Senke gefunden.
- **Grenze der Aussage:** Der Live-Login konnte hier nicht gegen einen echten Tenant getestet werden. Die Bewertung von MSAL beruht auf statischer Analyse (v5.29.0). Deshalb steht der Punkt „Anmeldung funktioniert mit Trusted Types“ in `docs/live-verification.md` › 6. Fällt dort eine Verletzung auf: `require-trusted-types-for 'script'` in `vite.config.ts` entfernen (alle anderen Härtungen bleiben unabhängig davon wirksam).
- Hinweis: `meta`-CSP wirkt nicht in dediziert same-origin geladenen Workern (der Worker-Skript-Response trägt keine CSP) – dort gelten Trusted Types daher nicht; der Worker enthält ohnehin keine Senken (Treffer im Bundle: nur eigene `.text`-Felder).
- Browser ohne Trusted-Types-Unterstützung ignorieren die Direktive; die Default-Policy wird dann nicht angelegt.

## S2 – Sitzung im Live-Modus (`src/auth/*`)

- `src/config.ts`: `appConfig.idleTimeoutMinutes` aus `VITE_IDLE_TIMEOUT_MINUTES` (Standard 30, `0` = aus, ganze Minuten 1–1440, sonst Standard); dokumentiert in `.env.example` und README.
- `src/auth/useIdleTimeout.ts`: zeitbasiert (`Date.now()`, Sekundentakt; schlafender Rechner/gedrosselter Tab → sofortige Abmeldung beim nächsten Tick/Ereignis, überfällige Sitzung wird nicht „wiederbelebt“). Aktivität: Zeiger, Tastatur, Scrollen, Rad, Touch, Rückkehr in den Tab – passiv, auf 1×/s gedrosselt. Während der Vorwarnung dismissen nur bewusste Eingaben (Klick/Taste/Rad/Touch), nicht Mausrauschen oder Scrollen.
- `src/auth/IdleLogout.tsx`: Hinweis 60 s vorher (`role="alert"`, nicht-modal, kein Fokus-Wechsel), Schaltfläche „Angemeldet bleiben“; Sekundenanzeige `aria-hidden`, damit der Screenreader nicht jede Sekunde vorliest. Eingebunden in `AuthGate` (nur bei angemeldetem Konto im Live-Modus).
- Lokale Abmeldung: `signOutInactive` in `src/auth/token.ts` ruft in MSAL v5 `instance.clearCache()` (ohne Konto: alle Konten und Token dieses Tabs; keine Weiterleitung, kein MSAL-Ereignis) nach `setActiveAccount(null)`. Die Anmelde-Ansicht wird über `subscribeLocalSignOut` (`src/auth/sessionState.ts`) umgeschaltet, auch wenn das Leeren fehlschlagen sollte. Der Gate rendert dann `children` nicht mehr: `AppShell` samt aller geladenen Gerätedaten ist unmontiert (die Provider halten keinen Daten-Cache).
- Hinweis „Aus Sicherheitsgründen nach N Minuten Inaktivität abgemeldet“ auf der Anmeldeseite; `sessionStorage`-Merker `mdm-doctor.idleLogout` (Minuten) und `mdm-doctor.forceLogin`. Die nächste Anmeldung sendet `prompt: 'login'`; beide Merker werden nach erfolgreicher Rückkehr vom Login gelöscht.
- Jede Abmeldung (manuell und Inaktivität) löscht `mdm-doctor.recent.live` (`clearStoredRecentDevices('live')` in `src/hooks/useRecentDevices.ts`); die Demo-Liste bleibt.
- Tests: `src/auth/idleLogout.test.tsx` (Fake-Timer nur für `setTimeout/clearTimeout/setInterval/clearInterval/Date`, nie `requestAnimationFrame`), `src/config.test.ts`.

## S3 – Lieferkette (`.github/`)

- Alle Actions in `ci.yml`, `pages.yml`, `codeql.yml` auf Commit-SHAs gepinnt (Kommentar mit Version; SHAs per `gh api repos/<owner>/<repo>/git/ref/tags/<tag>`, annotierte Tags zum Commit aufgelöst). Dependabot (`github-actions`) aktualisiert gepinnte Actions weiter.
- `pages.yml`: Workflow-Ebene nur `contents: read`; `pages: write` und `id-token: write` ausschließlich im Job `deploy`.
- `ci.yml`: Job `audit` (`npm audit --omit=dev --audit-level=high`) bei `schedule`, `workflow_dispatch` und Push auf `main`, nicht bei PRs. Lokal geprüft: 0 Funde.
- `codeql.yml`: `javascript-typescript`, Push auf `main`, Pull Requests, wöchentlich (Mo 03:41 UTC); Rechte `contents: read`, `security-events: write` nur am Job.
- `dependabot.yml`: Major-Updates von `typescript` ignoriert (`typescript-eslint` unterstützt TypeScript 7 noch nicht).
- `SECURITY.md` (deutsch, englische Kurzfassung): privater Meldeweg über „Security › Report a vulnerability“, unterstützt wird `main`, Sicherheitsmodell, nicht im Umfang.

## S4 – Lizenz und README

- `LICENSE` (MIT, `Copyright (c) 2026 Darkatek7`), `"license": "MIT"` in `package.json`, README-Abschnitt „Lizenz“ – eigener Commit „M16: MIT-Lizenz“.
- README: Statuszeile auf den tatsächlichen Stand (M1–M15 gemergt), Abschnitt „Datenschutz“ um Abmeldung/„Zuletzt geöffnet“ ergänzt, Live-Einrichtung um `VITE_IDLE_TIMEOUT_MINUTES`, Hosting-Abschnitt um empfohlene HTTP-Header (`frame-ancestors 'self'`, `nosniff`, `Referrer-Policy`; GitHub Pages kann keine Header setzen).

## Akzeptanzkriterien

- [x] CSP: `style-src 'self'` + `style-src-attr 'unsafe-inline'`; kein `<style>` zur Laufzeit nötig (begründet dokumentiert)
- [x] E2E `csp.spec.ts` über Kernabläufe grün (keine Verstöße, keine CSP-Konsolenfehler)
- [x] Trusted Types untersucht, Entscheidung und Begründung dokumentiert (aktiviert mit Default-Policy; Live-Prüfpunkt in `docs/live-verification.md`)
- [x] README: empfohlene HTTP-Header für Selbst-Hosting, Hinweis zu GitHub Pages
- [x] Abmeldung bei Inaktivität (Standard 30 min, `VITE_IDLE_TIMEOUT_MINUTES`, `0` = aus) mit zugänglicher Vorwarnung
- [x] Inaktivitäts-Abmeldung lokal (kein Redirect), Daten nicht mehr erreichbar, Hinweis auf der Anmeldeseite
- [x] Nächste Anmeldung nach Inaktivität mit `prompt: 'login'`
- [x] „Zuletzt geöffnet“ (Live) wird bei jeder Abmeldung gelöscht, Demo-Liste bleibt
- [x] Unit-Tests: Inaktivitäts-Timer, Löschen der Live-Liste, `prompt: 'login'`
- [x] Actions auf SHAs gepinnt; Pages-Rechte nur am Deploy-Job; Audit-Job; CodeQL; Dependabot-Ignore
- [x] `SECURITY.md`
- [x] `LICENSE` (eigener Commit), `package.json`, README „Lizenz“; README-Status und „Datenschutz“ aktualisiert
- [x] `npm run lint`, `npm run typecheck`, `vitest run`, `vite build` grün; E2E-Suite grün
