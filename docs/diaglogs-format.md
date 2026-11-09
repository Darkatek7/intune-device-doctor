# Format: Intune „Collect diagnostics“-ZIP (DiagLogs)

Abgeleitet aus zwei echten Archiven (Windows 11, Entra-joined, teils co-managed). **Alle Beispielwerte hier sind anonymisiert.** Echte ZIPs liegen nur lokal beim Entwickler und kommen nie ins Repo.

## Dateiname & Größe

- `DiagLogs-<GERÄTENAME>-<yyyyMMddTHHmmssZ>.zip`, z. B. `DiagLogs-CONTOSO-PC042-20261014T125356Z.zip`
- 75–115 MB komprimiert, ~470–490 MB entpackt, 800–1100 Einträge → **nie komplett entpacken**: Central Directory lesen, Text-Einträge on demand inflaten (`@zip.js/zip.js` mit `BlobReader` auf dem `File`), Binärdateien überspringen.
- **ZIP-Eigenheit:** Die lokalen Dateiheader tragen die Bit-Flags `0x0808` (Data Descriptor + UTF-8), das Central Directory dagegen `0`. Strikte Reader (zip.js im Standardmodus) lehnen das als „Ambiguous archive“ ab → beim Entpacken `checkLocalDirectory: false` setzen. Der Fixture-Generator bildet die Abweichung nach.

## Eintragsnamen

Flach („flattened“), Präfix `(N)` ist **nicht stabil** zwischen Archiven:

```
/^\((\d+)\) (?:No Results - Error \[(0x[0-9A-Fa-f]{8})\] )?(RegistryKey|Command|Events|FoldersFiles) (.+)$/
```

| Typ                                                                                                                                               | Payload-Muster                             | Beispiel                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| RegistryKey                                                                                                                                       | `/^(.+) export\.reg$/`                     | `(9) RegistryKey HKLM_Software_Microsoft_IntuneManagementExtension export.reg`                         |
| Command                                                                                                                                           | `/^(.+) output\.log$/`                     | `(31) Command windir_system32_Dsregcmd_exe_status output.log`                                          |
| Events                                                                                                                                            | `/^(.+) Events\.evtx$/`                    | `(62) Events System Events.evtx`                                                                       |
| FoldersFiles                                                                                                                                      | `/^([^/]+)\/([^/]+)$/` (Verzeichnis/Datei) | `(64) FoldersFiles ProgramData_Microsoft_IntuneManagementExtension_Logs/intunemanagementextension.log` |
| Fehlgeschlagen                                                                                                                                    | `No Results - Error [0x…]`, 0 Byte         | `(25) No Results - Error [0x80070001] RegistryKey HKLM_SYSTEM_Setup_SetupDiag_Results`                 |
| Dazu `results.xml` im Root. Verzeichniseinträge enden auf `/`. Lange Namen sind abgeschnitten; `_` ersetzt `\`, `/` und Leerzeichen (mehrdeutig). |

## results.xml

ASCII, kein BOM. `<Collection HRESULT="0">` mit `<ID>`, `<SasUrl>SasUrlPlaceHolder</SasUrl>`, dann `<RegistryKey HRESULT="…">pfad</RegistryKey>`, `<Command HRESULT="…">…</Command>`, `<Events HRESULT="…">…</Events>`, `<FoldersFiles HRESULT="…">…</FoldersFiles>` mit `%env%`-Pfaden; am Ende u. a. `ClientTimeoutInSeconds`, `OutputFileFormat=flattened`.
HRESULT-Bedeutung ist **typabhängig** (dezimal, signiert):

- RegistryKey: `-2147024893` (0x80070003) tritt bei **erfolgreichen** Exporten auf; `-2147024895` (0x80070001) = Schlüssel fehlt.
- FoldersFiles: `0` ok, `0x80070003` Pfad nicht gefunden, `0x80070002` Datei nicht gefunden.
- Command: `0` ok, `0x8000FFFF` Fehler (0-Byte-Ausgabe).
  → Fehlgeschlagene Sammlungen besser aus `No Results - Error`-Einträgen ableiten, results.xml nur ergänzend. Typisch fehlend (harmlos, Komponente nicht installiert): CloudManagedUpdate, EPMAgent, SetupDiag, ccmsetup-Logs.

## Encodings

| Encoding                                                                                                                                                                                                                           | Dateien                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| UTF-16LE mit BOM (`FF FE`)                                                                                                                                                                                                         | alle `.reg`, msinfo32-Ausgabe                          |
| UTF-8 mit BOM                                                                                                                                                                                                                      | IME-Logs, CBS, setupact, HTML-Reports                  |
| UTF-8 ohne BOM                                                                                                                                                                                                                     | dsregcmd, MpCmdRun, netsh (lokalisiert)                |
| OEM-Codepage (CP850)                                                                                                                                                                                                               | ipconfig, certutil, pnputil → **MVP: nicht auswerten** |
| Encoding über BOM erkennen (`TextDecoder('utf-16le')` bzw. `'utf-8'`). Ausgaben sind teils lokalisiert (z. B. Deutsch: „Domänenprofil“, `EIN`/`AUS`) → für Befunde bevorzugt sprachneutrale Quellen (dsregcmd-Keys sind Englisch). |

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
      Previous Prt Attempt : 2026-10-12 08:00:00.000 UTC
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

- **Enrollments** (`…HKLM_Software_Microsoft_Enrollments export.reg`): 30–40 Keys, davon nur ~6 mit `ProviderID` (übrige = System-/Zertifikats-Enrollments, für MDM-Diagnose ignorieren). Je `[…\Enrollments\<GUID>]` u. a. `EnrollmentState` (dword, 1 = enrolled), `EnrollmentType` (6 bei Intune-MDM), `ProviderID` (`MS DM Server` = Intune; `WMI_Bridge_SCCM_Server` = ConfigMgr/Co-Management), `UPN` (Form teils `user@domain@<Tenant-ID>` – maskieren, Tenant-Teil verwerfen!), `AADTenantID` (maskieren!), Unterkeys `FirstSync` (`IsSyncDone`), `DMClient\<ProviderID>`, `Push` (`ChannelURI` – **nie anzeigen**).
- **IntuneManagementExtension** (`…IntuneManagementExtension export.reg`, 4–8 MB): Der App-Status steht unter `SideCarPolicies\StatusServiceReports\<UserOrDeviceId>\<AppGUID>` mit den Werten `AppId`, `ApplicabilityCode`, `Required`, `Status` (`Installed`, `Failed`, `NotApplicable`, `InstalledPendingReboot`), `Status2` und `ErrorCode` (signierte Dezimal-HRESULT als String → Hex `0x80070642`). Dieselbe App erscheint pro Nutzer erneut (GUID-Schreibweise kann abweichen) → per AppId zusammenführen. Unter `Win32Apps\<UserOrDeviceId>\<AppGUID>_<Revision>` stehen nur Begleitwerte (`Intent`, `RebootStatus`, `DownloadStatus`, `ComplianceStateMessage`/`EnforcementStateMessage` als Unterkeys), **kein** `Status`. Beobachtet: 7–10 `Failed` bei 450–770 Apps, Codes z. B. `0x80070642` (Win32 1602), `0x80070046`, `0x80079C51`, `0x87D30065`, `0x87D1041C`.
- **DeviceHealthMonitoring** (PolicyManager): Endpoint-Analytics-Konfiguration – nur informativ.

## Weitere Einträge

- `Command …mpcmdrun_exe_-GetFiles output.log` (UTF-8): Defender-Supportpaket-Erstellung; Zeile `ValidateMapsConnection successfully established a connection to MAPS` = Cloud-Schutz erreichbar.
- `Command …mdmdiagnosticstool_exe… output.log`: Ergebnis der verschachtelten MDM-Diagnose (`Succeeded to CollectLog at: …mdmlogs-….cab`).
- Netzwerk: `netsh winhttp show proxy`, `netsh advfirewall show allprofiles` (lokalisiert).
- **Binär, nicht ausgewertet:** `.etl`, `.cab` (`mpsupportfiles.cab`, `mdmlogs-*.cab` – später interessant) sowie alle `.evtx` bis auf die zwei unten genannten Ereignisprotokolle (Dateien bis ~34 MB, evtl. gekappt).

## Ereignisprotokolle (.evtx)

Einträge `(N) Events <Protokollname> Events.evtx`; der Protokollname ist flach (`/` → `_`) und kann abgeschnitten sein, deshalb wird tolerant verglichen (Groß-/Kleinschreibung und Sonderzeichen egal). Gelesen werden **gezielt nur**:

- `…DeviceManagement-Enterprise-Diagnostics-Provider…Admin` (Kanal `Microsoft-Windows-DeviceManagement-Enterprise-Diagnostics-Provider/Admin`; laut [Collect MDM logs](https://learn.microsoft.com/windows/client-management/mdm-collect-logs) das wichtigste Ereignisprotokoll für MDM) und
- falls vorhanden `…AAD…Operational` (Microsoft Entra, Kanal `Microsoft-Windows-AAD/Operational`).

Alle übrigen `.evtx` bleiben unausgewertet (Hinweis in den Analyse-Notizen). Der Eintrag wird erst nach der Größenprüfung entpackt (Limit 48 MiB entpackt, darüber „zu groß“ mit Grund in der Kachel); das Parsen läuft im Analyse-Worker, nichts wird hochgeladen.

### Aufbau (`src/diagnostics/parsers/evtx.ts`, ohne Abhängigkeit)

- **Dateikopf** (4096 Byte), Signatur `ElfFile\0`; Chunk-Anzahl im Kopf wird nur zur Erkennung gekappter Dateien genutzt.
- **Chunks** à 65 536 Byte ab Offset 4096, Signatur `ElfChnk\0`, Kopf 512 Byte (Offset 32: letzte RecordID, Offset 48: Beginn des freien Bereichs). Namen und Template-Definitionen werden per Offset relativ zum Chunk-Anfang referenziert und je Chunk gecacht.
- **Datensätze** ab Offset 512: `2A 2A 00 00`, Größe, RecordID, Schreibzeit (FILETIME), Binary XML, Größe (Kopie am Ende). Die Schreibzeit dient zum schnellen Überspringen von Datensätzen außerhalb des Zeitfensters, ohne das Binary XML zu lesen.
- **Binary XML**: Tokens und Werttypen nach [MS-EVEN6 2.2.12 BinXml](https://learn.microsoft.com/openspecs/windows_protocols/ms-even6/c73573ae-1c90-43a2-a65f-ad7501155956): Element/Attribut, Wert-/Zeichen-/Entity-Referenzen, `TemplateInstance` (Definition beim ersten Mal inline, danach per Offset), normale/optionale Substitution, verschachteltes BinXml (Werttyp `0x21`, typisch für `EventData` klassischer Ereignisse). Werttypen: String, AnsiString, Int8–UInt64, Float, Bool, Binary, GUID, SizeT, FILETIME, SYSTEMTIME, SID, HexInt32/64 sowie Arrays dieser Typen; unbekannte Typen ergeben einen leeren Wert.
- Ergebnis je Ereignis: `EventID`, `Level`, `TimeCreated` (UTC), Provider, Kanal, Computer, `EventData`/`UserData` als Name → Wert (unbenannte Felder: `Data1`, `Data2` …). Der Dateikopf-Aufbau (Datei/Chunk/Datensatz) ist von Microsoft nicht dokumentiert und folgt [libevtx „Windows XML Event Log (EVTX) format“](https://github.com/libyal/libevtx/tree/main/documentation).

### Auswertung

- Zeitfenster: **14 Tage vor dem ZIP-Zeitstempel** aus dem Dateinamen (fehlt er: vor dem jüngsten Ereignis). Übernommen werden nur **Kritisch (1), Fehler (2), Warnung (3)**; Information/Ausführlich zählen nur in „geprüfte Ereignisse“.
- Gruppierung nach Ereignis-ID: Anzahl, letzter Zeitpunkt, Beispieldaten des jüngsten Ereignisses. HRESULTs in den Daten (`0x…` bzw. Zahlen in Feldern wie `Result`) werden über die vorhandene Wissensbasis gedeutet, sonst „Unbekannter Code“ mit Hex/Dezimal.
- **Event-IDs werden nur mit Microsoft-Learn-Beleg gedeutet** (`src/rules/knowledge/events.ts`: MDM-Admin 76, 1819; AAD-Operational 1081, 1088). Alle anderen zeigen nur ID und Rohdaten. Die Meldungstexte der Provider stehen nicht in der `.evtx`, sondern in den Ressourcen des Providers auf dem Gerät.
- Severity: Fehlerereignisse im Fenster → *warning* (eigener Richtwert `THRESHOLDS.eventLogErrorWarningCount`, keine Microsoft-Vorgabe); keine → *ok*; Hauptprotokoll fehlt/ist nicht lesbar → *unavailable* mit Grund.
- Privatsphäre: UPN, GUIDs/Tenant-IDs, SIDs, Seriennummern, `ChannelURI` und URL-Queries werden bereits im Worker maskiert bzw. verworfen; Werte werden auf 300 Zeichen und 12 Felder je Ereignis gekürzt.

### Grenzen

- Prüfsummen (Datei-, Chunk-, Datensatz-CRC) und Hash-Tabellen werden **nicht** ausgewertet; defekte Chunks/Datensätze werden übersprungen und als „unvollständig“ ausgewiesen (gekappte Dateien liefern alle vollständigen Datensätze).
- Mengen-/Zeitbegrenzung: höchstens 20 000 dekodierte Datensätze und 5000 behaltene Ereignisse je Protokoll (jüngste Chunks zuerst) sowie 20 s Rechenzeit; wird sie erreicht, weist die Kachel „begrenzt“ aus und ältere Ereignisse im Fenster fehlen. Datensätze vor dem Fenster werden nicht dekodiert, Ereignisse außerhalb der Stufen 1–3 nicht behalten.
- Messung (`scripts/measure-evtx.ts`, synthetisch, 30 MB / 44 587 Ereignisse): alle Datensätze dekodieren ≈ 0,2 s; App-Einstellung ≈ 50 ms; in einem Prozess mit 256 MB Heap bleibt der Heap unter 40 MB.
- Gelesen wird nur der beschriebene Bereich eines Chunks (bis zum „freien Bereich“ im Chunk-Kopf); Reste dahinter werden ignoriert.

## Fixture für Tests

`scripts/make-fixture-zip.ts` baut ein kleines synthetisches Archiv mit exakt diesen Namens-/Encoding-Konventionen: results.xml, dsregcmd (Problemgerät mit PRT-Fehler), 1 IME-Log mit Typ-1/2/3-Einträgen inkl. mehrzeiligem Eintrag, Enrollments-.reg (UTF-16LE) mit 2 Enrollments, IME-.reg mit je einer Installed/Failed/NotApplicable-App, 2 `No Results`-Einträge, 1 Dummy-`.evtx` (`System`) und ein kleines gültiges MDM-Admin-`.evtx` mit fiktiven Ereignissen (Stile Template, klassisches BinXml und UserData; erzeugt von `src/diagnostics/evtxFixture.ts`, Fenster-Test mit einem Ereignis vor den 14 Tagen). Fiktive Daten (`CONTOSO-PC042`, `user@contoso.com`, Null-GUIDs).
