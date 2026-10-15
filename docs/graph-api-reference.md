# Microsoft Graph – verifizierte Referenz für MDM Doctor

Stand: Oktober 2026, gegengeprüft auf learn.microsoft.com. **Nur diese Endpunkte sind erlaubt** (siehe CLAUDE.md). Alle Aufrufe delegiert (angemeldeter Admin), Basis `https://graph.microsoft.com/v1.0`, Methode **GET**.

## Endpunkte

| Zweck | Request | Scope (least privileged, delegiert) | Doku |
|---|---|---|---|
| Gerät suchen (exakt) | `GET /deviceManagement/managedDevices?$filter=deviceName eq '{name}'&$select=…` | `DeviceManagementManagedDevices.Read.All` | [list](https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-list?view=graph-rest-1.0) |
| Gerät suchen (Teilstring) | `…?$filter=contains(deviceName,'{x}')` | dto. | Filter `eq`/`contains` auf `deviceName` nur in der [Beta-Ressource](https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-manageddevice?view=graph-rest-beta) dokumentiert → live verifizieren; bei 400 auf clientseitige Filterung über paginierte Liste mit `$select` zurückfallen |
| Gerät suchen (Fallback) | `GET /deviceManagement/managedDevices?$select=…` (ohne `$filter`, max. 5 Seiten, clientseitig gefiltert) | dto. | [list](https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-list?view=graph-rest-1.0) – nur, wenn `eq`/`contains` mit HTTP 400 abgelehnt werden |
| Gerätedetails | `GET /deviceManagement/managedDevices/{id}` | dto. | [get](https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-get?view=graph-rest-1.0) |
| Defender | `GET /deviceManagement/managedDevices/{id}/windowsProtectionState` | dto. | [resource](https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-windowsprotectionstate?view=graph-rest-1.0) |
| Erkannte Malware | `GET …/windowsProtectionState/detectedMalwareState` | dto. | [resource](https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-windowsdevicemalwarestate?view=graph-rest-1.0) |
| Compliance-Richtlinien pro Gerät | `GET /deviceManagement/managedDevices/{id}/deviceCompliancePolicyStates` | dto. | v1.0-Route laut [PowerShell SDK](https://learn.microsoft.com/en-us/powershell/module/microsoft.graph.devicemanagement/get-mgdevicemanagementmanageddevicecompliancepolicystate?view=graph-powershell-1.0); Kind-Typ [settingState](https://learn.microsoft.com/en-us/graph/api/resources/intune-deviceconfig-devicecompliancepolicysettingstate?view=graph-rest-1.0) |
| Konfigurationsprofile pro Gerät | `GET /deviceManagement/managedDevices/{id}/deviceConfigurationStates` | `DeviceManagementConfiguration.Read.All` | [PowerShell SDK](https://learn.microsoft.com/en-us/powershell/module/microsoft.graph.devicemanagement/get-mgdevicemanagementmanageddeviceconfigurationstate?view=graph-powershell-1.0); [settingState](https://learn.microsoft.com/en-us/graph/api/resources/intune-deviceconfig-deviceconfigurationsettingstate?view=graph-rest-1.0). **Deckt Settings-Catalog-Profile nicht (dokumentiert) ab** → Hinweis in der Kachel |
| Entra-Gerät | `GET /devices?$filter=deviceId eq '{azureADDeviceId}'&$select=…` | `Device.Read.All` | [list](https://learn.microsoft.com/en-us/graph/api/device-list?view=graph-rest-1.0), [resource](https://learn.microsoft.com/en-us/graph/api/resources/device?view=graph-rest-1.0) |
| BitLocker-Schlüssel hinterlegt? | `GET /informationProtection/bitlocker/recoveryKeys?$filter=deviceId eq '{azureADDeviceId}'` | `BitlockerKey.ReadBasic.All` | [list](https://learn.microsoft.com/en-us/graph/api/bitlocker-list-recoverykeys?view=graph-rest-1.0) – liefert **keinen** Schlüsselwert; `$top` nicht unterstützt, Paging über `@odata.nextLink`. **Nie** `$select=key` (würde Schlüssel lesen + Audit-Eintrag) |

Alle Intune-Scopes und `BitlockerKey.ReadBasic.All` erfordern **Admin-Consent** ([permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference)). Zusätzlich `User.Read` für Login/Profil.

## managedDevice (v1.0) – genutzte Felder
`id, deviceName, userPrincipalName, userDisplayName, operatingSystem, osVersion, model, manufacturer, serialNumber, complianceState, complianceGracePeriodExpirationDateTime, lastSyncDateTime, enrolledDateTime, managementAgent, deviceEnrollmentType, isEncrypted, jailBroken (String), azureADDeviceId, partnerReportedThreatState, freeStorageSpaceInBytes, totalStorageSpaceInBytes`

- `complianceState`: `unknown, compliant, noncompliant, conflict, error, inGracePeriod, configManager`
- `managementAgent`: `eas, mdm, easMdm, intuneClient, easIntuneClient, configurationManagerClient, configurationManagerClientMdm, configurationManagerClientMdmEas, unknown, jamf, googleCloudDevicePolicyController`
- `deviceEnrollmentType`: `unknown, userEnrollment, deviceEnrollmentManager, appleBulkWithUser, appleBulkWithoutUser, windowsAzureADJoin, windowsBulkUserless, windowsAutoEnrollment, windowsBulkAzureDomainJoin, windowsCoManagement, windowsAzureADJoinUsingDeviceAuth, appleUserEnrollment, appleUserEnrollmentWithServiceAccount`
- `partnerReportedThreatState`: `unknown, activated, deactivated, secured, lowSeverity, mediumSeverity, highSeverity, unresponsive, compromised, misconfigured`
- **Beta-only, nicht verwenden:** `managementState`, `deviceType`, `ownerType`, `joinType`, `autopilotEnrolled`, `hardwareInformation`, `windowsActiveMalwareCount`.
- Nur per GET by id + `$select`: `physicalMemoryInBytes`, `ethernetMacAddress`, `notes`, `udid`, `iccid` (nicht benötigt).

## windowsProtectionState (v1.0)
Booleans: `malwareProtectionEnabled, realTimeProtectionEnabled, networkInspectionSystemEnabled, quickScanOverdue, fullScanOverdue, signatureUpdateOverdue, rebootRequired, fullScanRequired, isVirtualMachine, tamperProtectionEnabled`
Strings: `engineVersion, signatureVersion, antiMalwareVersion, lastQuickScanSignatureVersion, lastFullScanSignatureVersion`
Datum: `lastQuickScanDateTime, lastFullScanDateTime, lastReportedDateTime`
- `deviceState`: `clean, fullScanPending, rebootPending, manualStepsPending, offlineScanPending, critical`
- `productStatus` (`windowsDefenderProductStatus`, Flags, kommasepariert, 26 Werte), z. B. `noStatus, serviceNotRunning, avSignaturesOutOfDate, platformOutOfDate, threatRemediationFailedCritically` – vollständige Liste auf der Ressourcenseite.

detectedMalwareState: `severity (unknown, low, moderate, high, severe)`, `executionState (unknown, blocked, allowed, running, notRunning)`, `state (unknown, detected, cleaned, quarantined, removed, allowed, blocked, cleanFailed, quarantineFailed, removeFailed, allowFailed, abandoned, blockFailed)`, `threatState (active, actionFailed, manualStepsRequired, fullScanRequired, rebootRequired, remediatedWithNonCriticalFailures, quarantined, removed, cleaned, allowed, noStatusCleared)`, `category`, `displayName`, `initialDetectionDateTime`, `lastStateChangeDateTime`, `detectionCount`, `additionalInformationUrl`.

Für Nicht-Windows-Geräte ist windowsProtectionState fachlich nicht anwendbar → `notApplicable`, ohne Request. Ein 404 bei Windows-Geräten → `unavailable` („Gerät hat noch keinen Defender-Status gemeldet“).

## Compliance-/Konfigurationsstatus
Parent (`deviceCompliancePolicyState` / `deviceConfigurationState`): `id, displayName, version, platformType, state, settingCount, settingStates[]`.
- `state` / `settingStates[].state` (`complianceStatus`): `unknown, notApplicable, compliant, remediated, nonCompliant, error, conflict, notAssigned`
- `platformType`: `android, androidForWork, iOS, macOS, windowsPhone81, windows81AndLater, windows10AndLater, all`
- settingState: `setting, settingName, instanceDisplayName, state, errorCode (Int64), errorDescription, userPrincipalName, sources[] (id, displayName), currentValue`

**Bekannte Grenze:** Ob die Listen `deviceCompliancePolicyStates`/`deviceConfigurationStates` `settingStates` ohne `$expand` mitliefern, ist in der v1.0-Doku nicht belegt. Die App fordert kein `$expand` an; fehlen die Einstellungen, zeigt sie Befunde auf Richtlinienebene (Zustand ohne Einstellungsdetails).

## bitlockerRecoveryKey (v1.0)
[resource](https://learn.microsoft.com/en-us/graph/api/resources/bitlockerrecoverykey?view=graph-rest-1.0): genutzt `id, createdDateTime, deviceId, volumeType` – **nie** `key`.
- `volumeType`: `1` (operatingSystemVolume), `2` (fixedDataVolume), `3` (removableDataVolume), `4` (unknownFutureValue); laut Doku als Zahl beschrieben, im JSON-Beispiel als String → Mapper akzeptiert beides.

## Entra device (v1.0)
`id, deviceId, displayName, accountEnabled, trustType (Workplace | AzureAd | ServerAd), approximateLastSignInDateTime, isCompliant, isManaged, operatingSystem, operatingSystemVersion, registrationDateTime`. `deviceId` unterstützt `eq`. Header `ConsistencyLevel: eventual` ist für einfache `eq`-Filter nicht nötig, schadet aber nicht.

## Fehler, Drosselung, CORS
- Fehlerkörper: `{"error":{"code","message","innerError":{"request-id","client-request-id","date"}}}` – auf `code`/HTTP-Status reagieren, nie auf `message`. [errors](https://learn.microsoft.com/en-us/graph/errors)
- **401** → Token erneuern (`acquireTokenSilent`, Fallback interaktiv). **403** → `forbidden` mit benötigtem Scope aus `endpoints.ts`; Ursachen: fehlender Consent, fehlende Intune-Rolle/Scope-Tag, fehlende Lizenz. **404** → `notFound`/`unavailable`. **429/503** → `Retry-After` (Sekunden) abwarten, sonst exponentieller Backoff, max. 3 Versuche. [throttling](https://learn.microsoft.com/en-us/graph/throttling)
- Limits Intune-Geräte: 2000 Requests/20 s pro App und Tenant ([limits](https://learn.microsoft.com/en-us/graph/throttling-limits)).
- CORS: Graph antwortet mit `Access-Control-Allow-Origin: *`, `Retry-After` ist exposed → direkte SPA-Aufrufe funktionieren.
- Paging: `@odata.nextLink` folgen (Limit setzen, z. B. 5 Seiten).

## Auth (MSAL)
- `@azure/msal-browser` 5.x + `@azure/msal-react` 5.x; SPA-Flow = Authorization Code + PKCE (Standard).
- App-Registrierung: Plattform **Single-page application**, Redirect-URI `http://localhost:5173` (sonst AADSTS9002326). Authority `https://login.microsoftonline.com/{tenantId}`.
- Rollen, die lesen dürfen: Intune-RBAC „Read Only Operator“, Entra „Global Reader“, „Helpdesk Administrator“, „Security Reader“, „Intune Administrator“. Delegierter Zugriff = Schnittmenge aus Consent-Scopes und Rolle/Scope-Tags des Nutzers. BitLocker-Metadaten zusätzlich nur für z. B. Cloud Device Administrator, Helpdesk Administrator, Intune Service Administrator, Security Reader, Global Reader.

## Bewusst NICHT verwendet
| API | Grund |
|---|---|
| `POST /beta/deviceManagement/reports/getConfigurationPoliciesReportForDevice` | nicht offiziell dokumentiert |
| `POST /beta/deviceManagement/reports/getDeviceInstallStatusReport` | nicht dokumentiert (404-Doku) |
| `deviceManagement/reports/exportJobs` | nur `*.ReadWrite.All`-Scopes, asynchron |
| `createDeviceLogCollectionRequest` | schreibende Aktion (beta) |
| `managedDevice.managementState` u. a. Beta-Felder | nur beta |
| `recoveryKeys/{id}?$select=key` | liest Schlüssel – nicht nötig, sensibel |

## Phase 2 (optional, nach MVP)
`GET /deviceManagement/managedDevices/{id}/logCollectionRequests` + `POST …/logCollectionRequests/{id}/createDownloadUrl` (v1.0, liefert `{"value":"<SAS-URL>"}`, keine Gerätewirkung) → vorhandenes DiagLogs-ZIP direkt laden. Offen: v1.0-List-Seite nennt nur ReadWrite-Scope; CORS des Blob-Downloads ungeprüft. Erst nach Rücksprache.
