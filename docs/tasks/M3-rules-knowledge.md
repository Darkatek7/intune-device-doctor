# M3 – Regel-Engine & Wissensbasis

**Delegation:** Hauptsession schreibt Regeln + Texte; `test-writer` (haiku) schreibt Tests je Szenario; `reviewer` (haiku) prüft Quellenpflicht.

## Schritte
1. `src/rules/evaluate.ts`: `evaluateTiles(snapshot, now): Tile[]` + je Kachel eine reine Funktion in `src/rules/tiles/*.ts`. Kachel ist `loading`, solange benötigte Sections `undefined` sind.
2. Regeln (Schwellen als Konstanten in `src/rules/thresholds.ts`):
   - **Gerätestatus**: Entra `accountEnabled false` → critical; kein Entra-Objekt → warning; `partnerReportedThreatState` high/compromised → critical; `jailBroken === 'True'` → critical; Speicher < 10 % frei → warning; `managementAgent` zur Info.
   - **Compliance**: `compliant` ok; `inGracePeriod` warning (mit Ablaufdatum); `noncompliant`/`error`/`conflict` critical; `unknown` unknown. Findings je nicht konformer Richtlinie/Setting (settingName, currentValue, errorCode → Hex).
   - **Check-in**: ≤ 24 h ok, ≤ 7 Tage warning, > 7 Tage critical (Schwellen konfigurierbar). Lösung: Gerät einschalten/online, Sync am Gerät auslösen (Einstellungen › Konten › Auf Arbeits- oder Schulkonto zugreifen › Info › Synchronisieren) bzw. im Intune Admin Center „Synchronisieren“ – die App selbst führt nichts aus.
   - **Betriebssystem**: Anzeige Version + Build; Windows 10 → warning (Supportende); bekannte Builds nur über eine kleine, quellenbelegte Tabelle `src/rules/knowledge/windowsReleases.ts` (Microsoft Learn „Windows release information“); unbekannter Build → unknown statt Raten.
   - **BitLocker**: `isEncrypted false` → critical; true + Recovery-Key für OS-Volume in Entra → ok; true ohne Key → warning („Schlüssel nicht in Entra gesichert“); forbidden → Kachel zeigt Berechtigungsbedarf, Severity aus `isEncrypted`. macOS: als „FileVault“ beschriften.
   - **Defender**: notApplicable für Nicht-Windows; critical bei aktiver Malware (`threatState active/actionFailed`), `malwareProtectionEnabled/realTimeProtectionEnabled false`, `deviceState critical`; warning bei `signatureUpdateOverdue`, `quickScanOverdue`, `rebootRequired`, `tamperProtectionEnabled false`; productStatus-Flags in Klartext übersetzen.
   - **Richtlinien**: Compliance- + Konfigurationszustände zusammen; `error`/`conflict` critical, `nonCompliant` warning; Findings je Richtlinie und Setting mit errorCode. Immer Hinweis-Finding (unknown/info): „Settings-Catalog-Profile werden über die dokumentierte Graph-API nicht pro Gerät gemeldet – Status im Intune Admin Center prüfen.“
3. Wissensbasis `src/rules/knowledge/`: `errorCodes.ts` (Struktur `{ code, hex, title, cause, remediation[], docsUrl }`), `win32.ts` (HRESULT `0x8007xxxx` → Win32-Code + Link System Error Codes), Texte zu Defender-productStatus, Compliance-Zuständen. **Jeder Eintrag mit Microsoft-Learn-URL**, sonst weglassen.
4. Gesamtzusammenfassung für den Header (`summarize(tiles)`).

## Akzeptanz
- [x] Jedes Mock-Szenario erzeugt die in M1 erwarteten Severities (Tests mit festem `now`)
- [x] Jeder Finding hat `cause`, mind. 1 `remediation`, `source`
- [x] Keine Wissensbasis-Einträge ohne `docsUrl` (Test erzwingt das)
- [x] `npm run check` grün
