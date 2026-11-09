# M9 – CI, Demo-Hosting, Live-Prüfliste, Bedienkomfort

Nach M8 (11/2026). Arbeitszweig `feat/m9-m11`. Zwei unabhängige Stränge (A: Infrastruktur, B: UI), parallel in getrennten Worktrees; die Hauptsession führt zusammen, lässt `reviewer` (haiku) laufen und committet („M9: …“).

## Strang A – Infrastruktur (Delegation: Subagent, sonnet)

### A1 – CI (GitHub Actions)

- `.github/workflows/ci.yml`: bei `pull_request` und `push` auf `main`: Node 22 (`actions/setup-node` mit npm-Cache), `npm ci`, `npm run check`.
- Job `e2e` im selben Workflow: nur bei `push` auf `main`, per `workflow_dispatch` und nachts (`schedule`); `npx playwright install --with-deps chromium`, `npm run test:e2e`, bei Fehler Playwright-Report als Artefakt hochladen.
- Actions auf Major-Tags (`@v4` usw.), `permissions: contents: read`, `concurrency` bricht veraltete Läufe ab.
- `npm ci` warnt wegen `allow-scripts` (esbuild-postinstall) – Build muss trotzdem funktionieren (lokal geprüft: grün).
- `.github/dependabot.yml`: npm wöchentlich, gruppiert (minor/patch in einer PR), plus `github-actions` monatlich.

### A2 – Demo-Hosting (GitHub Pages)

- `vite.config.ts`: `base` aus `process.env.VITE_BASE ?? '/'`.
- `.github/workflows/pages.yml`: bei `push` auf `main` + `workflow_dispatch`; Build mit `VITE_APP_MODE=demo` und `VITE_BASE=/intune-device-doctor/`; Deploy über `actions/upload-pages-artifact` + `actions/deploy-pages` (`permissions: pages: write, id-token: write`).
- Im Demo-Build darf der Live-Modus nicht erreichbar sein, wenn keine MSAL-IDs gesetzt sind (vorhandenes Verhalten prüfen, nichts lockern).
- Content-Security-Policy als `<meta http-equiv>` (GitHub Pages kann keine Header setzen) – nur im Produktions-Build (Vite-Plugin `transformIndexHtml`, `apply: 'build'`), damit der Dev-Server mit HMR weiterläuft: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://graph.microsoft.com https://login.microsoftonline.com; worker-src 'self' blob:; frame-src https://login.microsoftonline.com; base-uri 'self'; form-action 'self'; object-src 'none'`. Mit `npm run build && npx vite preview` + E2E prüfen, dass nichts blockiert wird (Worker, Motion-Inline-Styles, MSAL-Popup/Redirect). Passt etwas nicht, Richtlinie gezielt anpassen und im Commit begründen.
- README: Abschnitt „Demo online“ (URL `https://darkatek7.github.io/intune-device-doctor/`, einmalig in den Repo-Einstellungen _Pages → Source: GitHub Actions_ setzen) und Hinweis, dass für einen gehosteten Live-Modus die Hosting-URL zusätzlich als SPA-Redirect-URI eingetragen werden muss.

### A3 – Prüfliste Live-Modus

- `docs/live-verification.md`: Schritt-für-Schritt-Prüfung gegen einen echten Tenant (Netzwerk-Tab, nur GET): (1) `$filter=deviceName eq …` auf v1.0 – 200 oder 400? (2) liefern `deviceCompliancePolicyStates`/`deviceConfigurationStates` `settingStates` ohne `$expand`? (3) neue Endpunkte aus M10. Je Punkt: erwartetes Ergebnis, was im Code/README anzupassen ist. Keine echten Tenant-Daten eintragen.

## Strang B – Bedienkomfort (Delegation: `ui-builder`, sonnet)

### B1 – Zuletzt geöffnete Geräte

- Hook `src/hooks/useRecentDevices.ts`: speichert pro Modus (`demo`/`live` getrennte Schlüssel) max. 8 Einträge `{ id, deviceName, osFamily, openedAt }` in `localStorage`, jeder Zugriff in `try/catch` (Privatmodus → leere Liste, keine Fehler). Keine UPNs, Seriennummern oder sonstigen Felder speichern.
- Startseite (`Landing`): Liste „Zuletzt geöffnet“ unter dem Suchfeld (Plattform-Symbol aus `deviceIcon.ts`, Name, relative Zeit), Klick öffnet das Gerät wie ein Suchtreffer; Schaltfläche „Verlauf löschen“. Nichts anzeigen, wenn leer.
- Im Live-Modus Hinweis per `title`/Untertitel: „Nur in diesem Browser gespeichert“.

### B2 – Tastaturkürzel

- `⌘K` (macOS) / `Strg+K` sowie `/` (außerhalb von Eingabefeldern) fokussieren das Suchfeld und markieren den Inhalt. Hinweis-Chip im Suchfeld (`⌘K` bzw. `Strg K`, je nach `navigator.platform`/`userAgentData`). Kollidiert nicht mit offenem Detail-Sheet/Dialog (dort Fokus-Falle respektieren).

### B3 – Ticket-Notiz drucken / als PDF

- Im Ticket-Notiz-Dialog Schaltfläche „Drucken / PDF“ (`window.print()`); `@media print` blendet alles außer der Notiz aus, schwarz auf weiß, Systemschrift, Seitenränder. Keine neue Abhängigkeit.

### Akzeptanz

- [ ] Alle Texte in `src/i18n/de.ts`; A11y (Rollen, Labels, Fokus) gemäß `docs/ui-guidelines.md`
- [ ] Unit-Tests: Hook (inkl. kaputtem/fehlendem localStorage, Limit 8, Moduswechsel), Tastaturkürzel, Druck-Button
- [ ] E2E: Gerät öffnen → zurück → erscheint unter „Zuletzt geöffnet“; `Strg+K` fokussiert Suche
- [ ] `npm run check` und `npm run test:e2e` grün
