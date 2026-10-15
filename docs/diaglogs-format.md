# Format: Intune „Collect diagnostics“-ZIP (DiagLogs)

Abgeleitet aus zwei echten Archiven (Windows 11, Entra-joined, teils co-managed). **Alle Beispielwerte hier sind anonymisiert.** Echte ZIPs liegen nur lokal beim Entwickler und kommen nie ins Repo.

## Dateiname & Größe
- `DiagLogs-<GERÄTENAME>-<yyyyMMddTHHmmssZ>.zip`, z. B. `DiagLogs-CONTOSO-PC042-20261014T125356Z.zip`
- 75–115 MB komprimiert, ~470–490 MB entpackt, 800–1100 Einträge → **nie komplett entpacken**: Central Directory lesen, Text-Einträge on demand inflaten (`@zip.js/zip.js` mit `BlobReader` auf dem `File`), Binärdateien überspringen.

## Eintragsnamen
Flach („flattened“), Präfix `(N)` ist **nicht stabil** zwischen Archiven:
```
/^\((\d+)\) (?:No Results - Error \[(0x[0-9A-Fa-f]{8})\] )?(RegistryKey|Command|Events|FoldersFiles) (.+)$/
```
| Typ | Payload-Muster | Beispiel |
|---|---|---|
| RegistryKey | `/^(.+) export\.reg$/` | `(9) RegistryKey HKLM_Software_Microsoft_IntuneManagementExtension export.reg` |
| Command | `/^(.+) output\.log$/` | `(31) Command windir_system32_Dsregcmd_exe_status output.log` |
| Events | `/^(.+) Events\.evtx$/` | `(62) Events System Events.evtx` |
| FoldersFiles | `/^([^/]+)\/([^/]+)$/` (Verzeichnis/Datei) | `(64) FoldersFiles ProgramData_Microsoft_IntuneManagementExtension_Logs/intunemanagementextension.log` |
| Fehlgeschlagen | `No Results - Error [0x…]`, 0 Byte | `(25) No Results - Error [0x80070001] RegistryKey HKLM_SYSTEM_Setup_SetupDiag_Results` |
Dazu `results.xml` im Root. Verzeichniseinträge enden auf `/`. Lange Namen sind abgeschnitten; `_` ersetzt `\`, `/` und Leerzeichen (mehrdeutig).

## results.xml
ASCII, kein BOM. `<Collection HRESULT="0">` mit `<ID>`, `<SasUrl>SasUrlPlaceHolder</SasUrl>`, dann `<RegistryKey HRESULT="…">pfad</RegistryKey>`, `<Command HRESULT="…">…</Command>`, `<Events HRESULT="…">…</Events>`, `<FoldersFiles HRESULT="…">…</FoldersFiles>` mit `%env%`-Pfaden; am Ende u. a. `ClientTimeoutInSeconds`, `OutputFileFormat=flattened`.
HRESULT-Bedeutung ist **typabhängig** (dezimal, signiert):
- RegistryKey: `-2147024893` (0x80070003) tritt bei **erfolgreichen** Exporten auf; `-2147024895` (0x80070001) = Schlüssel fehlt.
- FoldersFiles: `0` ok, `0x80070003` Pfad nicht gefunden, `0x80070002` Datei nicht gefunden.
- Command: `0` ok, `0x8000FFFF` Fehler (0-Byte-Ausgabe).
→ Fehlgeschlagene Sammlungen besser aus `No Results - Error`-Einträgen ableiten, results.xml nur ergänzend. Typisch fehlend (harmlos, Komponente nicht installiert): CloudManagedUpdate, EPMAgent, SetupDiag, ccmsetup-Logs.

## Encodings
| Encoding | Dateien |
|---|---|
| UTF-16LE mit BOM (`FF FE`) | alle `.reg`, msinfo32-Ausgabe |
| UTF-8 mit BOM | IME-Logs, CBS, setupact, HTML-Reports |
| UTF-8 ohne BOM | dsregcmd, MpCmdRun, netsh (lokalisiert) |
| OEM-Codepage (CP850) | ipconfig, certutil, pnputil → **MVP: nicht auswerten** |
Encoding über BOM erkennen (`TextDecoder('utf-16le')` bzw. `'utf-8'`). Ausgaben sind teils lokalisiert (z. B. Deutsch: „Domänenprofil“, `EIN`/`AUS`) → für Befunde bevorzugt sprachneutrale Quellen (dsregcmd-Keys sind Englisch).

## dsregcmd /status (`Command windir_system32_Dsregcmd_exe_status output.log`)
Abschnitte mit Rahmen `+----…+` und Kopf `| Name |`, darunter `Key : Value` (rechtsbündige Keys). Abschnitte: Device State, Device Details, Tenant Details, User State, SSO State, Diagnostic Data, IE Proxy Config for Current User, WinHttp Default Proxy Config, Ngc Prerequisite Check. Unterblöcke `AcquirePrtDiagnostics` / `RefreshPrtDiagnostics` wiederholen Keys (`Attempt Status`, `HTTP Error`, `HTTP status`) → verschachtelt parsen.

Relevante Felder (anonymisiertes Beispiel eines Problemgeräts):
```
             AzureAdJoined : YES
              DomainJoined : NO
          DeviceAuthStatus : SUCCESS
              TpmProtected : YES
             WamDefaultSet : ERROR (0x80070520)
                AzureAdPrt : NO
      Previous Prt Attempt : 2026-10-12 11:28:30.434 UTC
            Attempt Status : 0xc000023c
             User Identity : user@contoso.com
           Credential Type : NGC
                HTTP Error : 0x80072ee7
```
Befundideen: `AzureAdPrt : NO` (kein Primary Refresh Token → SSO/Compliance-Auswertung gestört), `WamDefaultSet : ERROR`, `DeviceAuthStatus` ≠ SUCCESS, `AzureAdJoined : NO`, `Attempt Status`/`HTTP Error`-Codes. Bedeutungen nur mit Quelle (Microsoft Learn: „Troubleshoot devices by using the dsregcmd command“). Ein zweites Beispielgerät zeigte `Attempt Status 0xc0000072`, `HTTP status 400`, `Client ErrorCode 0x801c0083`.

## IME-Logs (CMTrace-Format)
Ordner `ProgramData_Microsoft_IntuneManagementExtension_Logs/` (intunemanagementextension, appworkload, agentexecutor, healthscripts, sensor, clienthealth …, rotiert mit Datumssuffix). UTF-8 mit BOM, Einträge können mehrzeilig sein:
```
/<!\[LOG\[([\s\S]*?)\]LOG\]!><time="([^"]+)" date="([^"]+)" component="([^"]*)" context="([^"]*)" type="(\d)" thread="(\d+)" file="([^"]*)">/g
```
`type`: 1 Info, 2 Warnung, 3 Fehler (3 markiert auch manche Infos → nur Hinweis). Beispiele (anonymisiert): `LogonUser failed with error code : 1008`, `AAD User check is failed, exception is System.ComponentModel.Win32Exception (0x80004005)`, `DNS detection: WinHttpGetProxyForUrl call failed because of error 12180`, `Powershell exit code is 1`. Pro Datei max. ~200 Typ-2/3-Einträge übernehmen, nur aktuelle (nicht rotierte) Datei + jüngste Rotation.

## Registry-Exporte (.reg, UTF-16LE)
Format „Windows Registry Editor Version 5.00“, Keys teils kleingeschrieben, Werte `"str"`, `dword:xxxxxxxx`, `hex:`, `hex(b):`, Escapes `\"`.
- **Enrollments** (`…HKLM_Software_Microsoft_Enrollments export.reg`): je `[…\Enrollments\<GUID>]` u. a. `EnrollmentState` (dword, 1 = enrolled), `EnrollmentType` (6 bei Intune-MDM), `ProviderID` (`MS DM Server` = Intune; `WMI_Bridge_SCCM_Server` = ConfigMgr/Co-Management), `UPN` (maskieren!), `AADTenantID` (maskieren!), Unterkeys `FirstSync` (`IsSyncDone`), `DMClient\<ProviderID>`, `Push` (`ChannelURI` – **nie anzeigen**).
- **IntuneManagementExtension** (`…IntuneManagementExtension export.reg`, mehrere MB): `Win32Apps\<UserOrDeviceId>\<AppGUID>…` mit Unterkeys `OperationalState`/`ReportCache`, Werte `Status` (`Installed`, `Failed`, `NotApplicable`, `InstalledPendingReboot`), `ErrorCode` (signierte Dezimal-HRESULT → Hex `0x80070642`), `ApplicabilityCode`, `RebootStatus`, `ComplianceStateMessage` (JSON). Beobachtet: 8–13 `Failed`, Codes z. B. `0x80070642` (Win32 1602), `0x80070BC2` (Win32 3010), `0x80070490`, `0x87D30065`.
- **DeviceHealthMonitoring** (PolicyManager): Endpoint-Analytics-Konfiguration – nur informativ.

## Weitere Einträge
- `Command …mpcmdrun_exe_-GetFiles output.log` (UTF-8): Defender-Supportpaket-Erstellung; Zeile `ValidateMapsConnection successfully established a connection to MAPS` = Cloud-Schutz erreichbar.
- `Command …mdmdiagnosticstool_exe… output.log`: Ergebnis der verschachtelten MDM-Diagnose (`Succeeded to CollectLog at: …mdmlogs-….cab`).
- Netzwerk: `netsh winhttp show proxy`, `netsh advfirewall show allprofiles` (lokalisiert).
- **Binär, MVP überspringen:** `.evtx` (bis ~34 MB, evtl. gekappt), `.etl`, `.cab` (`mpsupportfiles.cab`, `mdmlogs-*.cab` – später interessant).

## Fixture für Tests
`scripts/make-fixture-zip.ts` baut ein kleines synthetisches Archiv mit exakt diesen Namens-/Encoding-Konventionen: results.xml, dsregcmd (Problemgerät mit PRT-Fehler), 1 IME-Log mit Typ-1/2/3-Einträgen inkl. mehrzeiligem Eintrag, Enrollments-.reg (UTF-16LE) mit 2 Enrollments, IME-.reg mit je einer Installed/Failed/NotApplicable-App, 2 `No Results`-Einträge, 1 Dummy-`.evtx`. Fiktive Daten (`CONTOSO-PC042`, `user@contoso.com`, Null-GUIDs).
