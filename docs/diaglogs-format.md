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
| OEM-Codepage (CP850) | ipconfig, certutil, pnputil → ohne BOM; seit M11/A über eigene Tabelle dekodiert und ausgewertet (certutil, ipconfig) |
| Encoding über BOM erkennen (`TextDecoder('utf-16le')` bzw. `'utf-8'`). Ausgaben sind teils lokalisiert (z. B. Deutsch: „Domänenprofil“, `EIN`/`AUS`) → für Befunde bevorzugt sprachneutrale Quellen (dsregcmd-Keys sind Englisch). |

## certutil und ipconfig (OEM-Codepage CP850, seit M11/A)

Die Ausgaben von `certutil`, `ipconfig` und `pnputil` schreibt Windows in der OEM-Codepage (auf deutschen Systemen CP850, **ohne BOM**). `TextDecoder` kennt CP850 nicht; `decodeText(bytes, { oem: true })` (`parsers/encoding.ts`) verwendet daher eine eigene Tabelle für 0x80–0xFF. Der Reader setzt `oem` nur für `Command`-Einträge, deren Name `ipconfig`, `certutil` oder `pnputil` enthält. Bytes, die gültiges UTF-8 sind (auch reines ASCII), bleiben UTF-8; BOM-Dateien bleiben unverändert.

**Annahme zu den Eintragsnamen:** Die genauen Namen der beiden Einträge sind in den vorliegenden Archiven nicht dokumentiert. Erkannt werden `Command`-Einträge, deren Name `certutil` bzw. `ipconfig` enthält (z. B. `windir_system32_certutil_exe_-store_My`, `windir_system32_ipconfig_exe_-all`); bei mehreren ipconfig-Einträgen wird der mit „all“ im Namen bevorzugt.

- **certutil `-store`** (`parsers/certutil.ts`): Blöcke unter `================ Certificate N ================` bzw. `Zertifikat N`; ausgewertet werden Seriennummer (`Serial Number`/`Seriennummer`), Aussteller (`Issuer`/`Aussteller`), `NotBefore`/`NotAfter` (bzw. „Gültig ab“/„Gültig bis“/„Ablaufdatum“) und Antragsteller (`Subject`/`Antragsteller`). Datumsformate: `d.M.yyyy HH:mm` (de), `M/d/yyyy h:mm AM|PM` (en-US), ISO. certutil gibt lokale Zeit ohne Zone aus; der Wert wird wie UTC behandelt (Ungenauigkeit höchstens im Stundenbereich). **Maskierung schon im Parser:** Seriennummer (`xxxx…xxxx`), GUIDs/E-Mail-Adressen in Namen, Antragsteller-CN außerhalb von CA-Speichern. Nicht lesbare Daten bleiben als Rohwert erhalten.
- **ipconfig `/all`** (`parsers/ipconfig.ts`): je Adapter Beschreibung, MAC (nur Herstellerpräfix, Rest `••`), DHCP, IPv4, DNS-Server, verbindungsspezifisches DNS-Suffix, Medienstatus; global primäres DNS-Suffix und Suffix-Suchliste. Host-Name und IPv6-Adressen werden nicht übernommen. Lokalisierte Schlüssel: Deutsch und Englisch.
- **Anzeige** (Kachel „Zertifikate & Netzwerk“, `rules/tiles/certsNetwork.ts`): reine Rohdaten, Severity „Hinweis“. Verglichen wird nur `NotAfter` mit dem Sammelzeitpunkt aus dem Dateinamen (abgelaufen / läuft innerhalb von 30 Tagen ab) – rechnerisch, ohne Bewertung. Eine Deutung bestimmter Aussteller (z. B. „Microsoft Intune MDM Device CA“) gibt es **nicht**: Microsoft Learn nennt diesen Namen nicht. Belegt ist nur, dass Learn das Computerzertifikat mit Aussteller `MS-Organization-Access` im Zusammenhang mit der Entra-Geräteregistrierung beschreibt (Troubleshoot co-management, Abschnitt „Common issues“); Folgen eines Ablaufs sind dort nicht beschrieben.

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
- **Binär, nicht ausgewertet:** `.etl`, `.cab` (`mpsupportfiles.cab`; `mdmlogs-*.cab` wird seit M13 gezielt gelesen, siehe unten) sowie alle `.evtx` bis auf die zwei unten genannten Ereignisprotokolle (Dateien bis ~34 MB, evtl. gekappt).

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
- Severity: Fehlerereignisse im Fenster → _warning_ (eigener Richtwert `THRESHOLDS.eventLogErrorWarningCount`, keine Microsoft-Vorgabe); keine → _ok_; Hauptprotokoll fehlt/ist nicht lesbar → _unavailable_ mit Grund.
- Privatsphäre: UPN, GUIDs/Tenant-IDs, SIDs, Seriennummern, `ChannelURI` und URL-Queries werden bereits im Worker maskiert bzw. verworfen; Werte werden auf 300 Zeichen und 12 Felder je Ereignis gekürzt.

### Grenzen

- Prüfsummen (Datei-, Chunk-, Datensatz-CRC) und Hash-Tabellen werden **nicht** ausgewertet; defekte Chunks/Datensätze werden übersprungen und als „unvollständig“ ausgewiesen (gekappte Dateien liefern alle vollständigen Datensätze).
- Mengen-/Zeitbegrenzung: höchstens 20 000 dekodierte Datensätze und 5000 behaltene Ereignisse je Protokoll (jüngste Chunks zuerst) sowie 20 s Rechenzeit; wird sie erreicht, weist die Kachel „begrenzt“ aus und ältere Ereignisse im Fenster fehlen. Datensätze vor dem Fenster werden nicht dekodiert, Ereignisse außerhalb der Stufen 1–3 nicht behalten.
- Messung (`scripts/measure-evtx.ts`, synthetisch, 30 MB / 44 587 Ereignisse): alle Datensätze dekodieren ≈ 0,2 s; App-Einstellung ≈ 50 ms; in einem Prozess mit 256 MB Heap bleibt der Heap unter 40 MB.
- Gelesen wird nur der beschriebene Bereich eines Chunks (bis zum „freien Bereich“ im Chunk-Kopf); Reste dahinter werden ignoriert.

## MDM-Diagnosepaket (`mdmlogs-*.cab`, seit M13)

Das ZIP enthält das Ergebnis des `MdmDiagnosticsTool` als Cabinet `mdmlogs-<Datum>.cab`; der Eintrag `Command …mdmdiagnosticstool_exe… output.log` meldet `Succeeded to CollectLog at: …mdmlogs-….cab` (beobachtet, siehe oben). Gelesen wird **nur** dieses Paket und nur gezielt: Dateiliste, `MDMDiagReport.xml`, `MdmDiagLogMetadata.json` und – falls das ZIP kein lesbares eigenes MDM-Admin-Ereignisprotokoll enthält – dessen `.evtx` (gleicher Parser wie oben). Alle übrigen Dateien im Paket (`.etl`, `.reg`, HTML-Bericht …) bleiben ungelesen. Nichts wird hochgeladen; die Auswertung läuft im Analyse-Worker (`src/diagnostics/mdmCab.ts`).

### Belegt (Microsoft Learn)

- **Paketinhalt** ([Collect MDM logs](https://learn.microsoft.com/windows/client-management/mdm-collect-logs), „Understanding zip structure“; dort für die ZIP-Ausgabe des Tools beschrieben): `MDMDiagHtmlReport.html` (Momentaufnahme von MDM-Konfiguration und Richtlinien, u. a. Verwaltungs-URL, MDM-Geräte-ID, Zertifikate), `MdmDiagLogMetadata.json` (Kommandozeilenargumente des Aufrufs), `MDMDiagReport.xml` („a more detailed view into the MDM configurations, such as enrollment variables, provisioning packages, multivariant conditions, and others“), `MdmDiagReport_RegistryDump.reg`, `MdmLogCollectorFootPrint.txt`, `DiagnosticLogCSP_Collector_*` (ETL) und `*.evtx` (u. a. MDM-Admin). Was gesammelt wird, bestimmt der Parameter `-area`.
- **`Multivariant` / `Condition`** ([Diagnose provisioning packages](https://learn.microsoft.com/windows/configuration/provisioning-packages/diagnose-provisioning-packages), „Unable to apply a multivariant provisioning package“): ab Windows 11, Version 22H2 enthält `MDMDiagReport.xml` die Bedingungen multivariater Provisioning-Pakete; auslesbar mit `([XML](Get-Content MDMDiagReport.xml)).SelectNodes('//Multivariant') | Select -ExpandProperty Condition`.
- **Cabinet-Format** ([Microsoft Cabinet Format](https://learn.microsoft.com/previous-versions/bb417343(v=msdn.10))): Aufbau `CFHEADER` (Signatur `MSCF`, `cbCabinet`, `coffFiles`, `cFolders`, `cFiles`, `flags` mit `cfhdrPREV_CABINET`/`cfhdrNEXT_CABINET`/`cfhdrRESERVE_PRESENT`, optionale Reserve-Bereiche), `CFFOLDER` (`coffCabStart`, `cCFData`, `typeCompress`), `CFFILE`, `CFDATA` (`csum`, `cbData`, `cbUncomp`); Prüfsumme `CSUMCompute` (0 = nicht geschrieben → nicht prüfen); Dateien eines Ordners werden fortlaufend komprimiert, ein Ordner ist die Dekompressionsgrenze.
- **MSZIP** (selbe Seite, „Microsoft MSZIP Data Compression Format“): jeder `CFDATA`-Block ist ein vollständiger Deflate-Strom mit zwei Byte Signatur `CK` (`0x43 0x4B`) und steht für 32 KiB unkomprimierte Daten (der letzte Block eines Ordners ggf. weniger); „only the history buffer survives from one block to the next“ → Inflate mit den letzten 32 KiB der entpackten Daten als Wörterbuch.
- **Entpacken von Hand** ([expand](https://learn.microsoft.com/windows-server/administration/windows-commands/expand)): `expand -d <Datei>.cab` listet, `expand <Datei>.cab -f:<Dateien> <Ziel>` entpackt – Grundlage der Lösungstexte, wenn das Paket im Browser nicht ausgewertet werden kann.

### Angenommen / nicht belegt

- **Elementaufbau von `MDMDiagReport.xml`:** Learn beschreibt ihn nicht (außer `Multivariant` mit `Condition`). Der Parser (`parsers/mdmDiagReport.ts`) wertet deshalb nur die `Condition`-Werte aller `//Multivariant`-Knoten aus (Attribut `Condition`, Text oder Attribute eines Kindelements `Condition`) und gibt sonst **nur Rohdaten** wieder: Wurzelelement, Anzahl Elemente, gleichnamige direkte Kindelemente der Wurzel (Name, Anzahl, Namen ihrer Kinder). **Keine Werte, keine Deutung** – auch keine Registrierungen, Richtlinienbereiche oder Zertifikate, solange das Format dafür nicht dokumentiert ist. Das Fixture (`src/diagnostics/mdmCabFixture.ts`) verwendet einen **frei erfundenen** Aufbau; er stützt keinen Befund.
- **Inhalt des CAB = Inhalt der ZIP-Ausgabe:** Learn beschreibt die `-zip`-Ausgabe; dass das `mdmlogs-*.cab` im DiagLogs-ZIP dieselben Dateien enthält, ist eine Annahme. Maßgeblich ist die tatsächliche Dateiliste, die die Kachel anzeigt.
- **Ablage im ZIP:** Eintragsart `FoldersFiles` mit Dateiname `mdmlogs-*.cab` (Verzeichnisname unbekannt, nur der Dateiname wird geprüft); bei mehreren Paketen gilt das mit dem lexikografisch größten Namen (Datum im Namen). Das Datum im Namen ist nicht dokumentiert.
- **Kompression:** `typeCompress`-Werte 0 = keine, 1 = MSZIP, 2 = Quantum, 3 = LZX (untere 4 Bit) stammen aus dem Cabinet-SDK (`tcompTYPE_*`) und sind auf der Learn-Seite nicht beziffert. Erwartet wird MSZIP (Standard von `makecab`); LZX, Quantum, unbekannte Verfahren und mehrteilige Cabinet-Sätze (`cfhdrPREV/NEXT_CABINET`) werden als „nicht unterstützt“ ausgewiesen, die Dateiliste bleibt.
- **Nur mit eigenem Encoder geprüft:** MSZIP-Roundtrips laufen gegen `src/diagnostics/cabFixture.ts`; das unkomprimierte Beispiel-Cabinet stammt aus der Spezifikation („A Sample Cabinet File“). Ausgabe des echten `makecab`/`MdmDiagnosticsTool` stand nicht zur Verfügung (keine Kundendaten im Repo, kein CAB-Werkzeug in der Entwicklungsumgebung).

### Grenzen und Schutz

- **Limits:** Paket ≤ 64 MiB (wie im ZIP gespeichert; darüber „zu groß“ mit Grund in der Kachel, vor dem Entpacken geprüft), je entpackter Datei ≤ 32 MiB, `MDMDiagReport.xml` ≤ 16 MiB entpackt, höchstens 256 MiB entpackte Daten je Extraktion (Durchlauf bis zur Zieldatei im Ordner), 5000 Dateieinträge gelesen, 200 im Ergebnis, 40 davon in der Kachel aufgelistet. Der XML-Leser (`parsers/xmlLite.ts`, ohne DOMParser, keine DTD-/Entity-Auflösung) stoppt bei 200 000 Elementen, Tiefe 64, Text 2000 / Attribut 1000 Zeichen und meldet „begrenzt“.
- **Defensiv:** Offsets, Größen und Namen werden gegen die Datei geprüft; gekappte Cabinets liefern alle vollständigen Teile (`truncated`), defekte Strukturen/Prüfsummen/Deflate-Ströme ergeben „ungültig“ statt einer Ausnahme. Die Prüfsumme (`csum`) jedes gelesenen Blocks wird geprüft, wenn sie geschrieben ist (außer bei Reserve-Bereich je Block, dessen Einbezug die Spezifikation nicht eindeutig regelt); ein Deflate-Strom, der mehr oder weniger als `cbUncomp` Byte ergibt, bricht die Extraktion sofort ab.
- **Privatsphäre:** UPN, GUIDs/Tenant-IDs, Seriennummern, MAC und URL-Queries werden bereits im Worker mit derselben Maskierung wie bei den Ereignisprotokollen entfernt (`maskEventValue`); Aus `MDMDiagReport.xml` werden nur Elementnamen und die `Multivariant`-Bedingungen übernommen, keine sonstigen Text- oder Attributwerte. `MdmDiagLogMetadata.json`: nur skalare Felder der obersten Ebene (≤ 12, Schlüssel und Wert maskiert); Feldnamen sind nicht dokumentiert.
- **Messung** (`scripts/measure-cab.ts`, synthetisch, Paket 20,2 MB: 19,6 MB nicht komprimierbare Füll-Datei vor `MDMDiagReport.xml` (3,0 MB, 53 886 Elemente) und MDM-Admin-`.evtx` (8,0 MB, 12 000 Ereignisse) in einem Ordner = ungünstigster Fall; Node 24, ein Prozess): Dateiliste < 1 ms; `analyzeMdmCab` ohne Admin-Log ≈ 0,3 s, mit Admin-Log ≈ 0,6 s (10 016 geprüfte Ereignisse); XML-Leser an der Grenze (15 MB, wird bei 200 000 Elementen gekappt) ≈ 0,17 s. Speicher: max. RSS ≈ 280 MB (Paket + Entpacktes), Heap ≤ 110 MB; unter `--max-old-space-size=256` läuft die Messung durch.

## Fixture für Tests

`scripts/make-fixture-zip.ts` baut ein kleines synthetisches Archiv mit exakt diesen Namens-/Encoding-Konventionen: results.xml, dsregcmd (Problemgerät mit PRT-Fehler), 1 IME-Log mit Typ-1/2/3-Einträgen inkl. mehrzeiligem Eintrag, Enrollments-.reg (UTF-16LE) mit 2 Enrollments, IME-.reg mit je einer Installed/Failed/NotApplicable-App, 2 `No Results`-Einträge, 1 Dummy-`.evtx` (`System`), ein kleines gültiges MDM-Admin-`.evtx` mit fiktiven Ereignissen (Stile Template, klassisches BinXml und UserData; erzeugt von `src/diagnostics/evtxFixture.ts`, Fenster-Test mit einem Ereignis vor den 14 Tagen) sowie je eine deutsche CP850-Ausgabe von `certutil -store My` (3 Zertifikate, Umlaute) und `ipconfig /all` (Ethernet + getrenntes WLAN) und ein kleines synthetisches `mdmlogs-20261014-125312.cab` (MSZIP; `src/diagnostics/mdmCabFixture.ts`) mit erfundenem `MDMDiagReport.xml`, drei `Multivariant`-Bedingungen, `MdmDiagLogMetadata.json` und einer Kopie des Admin-Logs. Fiktive Daten (`CONTOSO-PC042`, `user@contoso.com`, Null-GUIDs).
