/**
 * Texte der Regel-Engine (Befund · Ursache · Lösung), Teil von `de` (de.rules).
 * Lösungen sind read-only formuliert: Der Admin handelt im Intune Admin Center bzw. am Gerät.
 */
export const deRules = {
  common: {
    unknownScope: 'unbekannter Scope',
    forbiddenTitle: 'Fehlende Berechtigung',
    forbiddenSummary: (scope: string) => `Benötigt ${scope}`,
    forbiddenDetail: (endpoint: string) =>
      `Microsoft Graph hat den Aufruf ${endpoint} mit HTTP 403 abgelehnt.`,
    forbiddenCause: (scope: string) =>
      `Der App fehlt die delegierte Berechtigung ${scope} (kein Admin-Consent), oder dem angemeldeten Konto fehlt eine passende Intune-/Entra-Rolle bzw. ein Bereichstag oder eine Lizenz.`,
    forbiddenRemediation: (scope: string) => [
      `Berechtigung ${scope} in der App-Registrierung hinzufügen und Admin-Consent durch einen Global Administrator bzw. Privileged Role Administrator erteilen lassen.`,
      'Prüfen, ob das Konto eine lesende Rolle hat (z. B. Intune „Read Only Operator“ oder Entra „Global Reader“) und das Gerät im zugewiesenen Bereich (Scope-Tag) liegt.',
      'Abmelden und erneut anmelden, damit das Token die neue Berechtigung enthält.',
    ],
    notApplicableTitle: 'Für dieses Gerät nicht anwendbar',
    notApplicableCause: 'Die Datenquelle gilt für diese Plattform nicht.',
    notApplicableRemediation:
      'Keine Aktion nötig – den entsprechenden Status ggf. im Intune Admin Center plattformspezifisch prüfen.',
    unavailableTitle: 'Daten nicht verfügbar',
    unavailableCause:
      'Das Gerät hat diese Daten (noch) nicht gemeldet, oder sie sind über die dokumentierte API nicht abrufbar.',
    unavailableRemediation:
      'Nach dem nächsten Check-in erneut prüfen; Status zusätzlich im Intune Admin Center kontrollieren.',
    errorTitle: 'Fehler beim Laden',
    errorCause:
      'Der Aufruf an Microsoft Graph ist fehlgeschlagen (Netzwerk, Dienststörung oder unerwartete Antwort).',
    errorRemediation:
      'Über „Erneut laden“ wiederholen. Bleibt der Fehler, Request-ID notieren und den Microsoft-365-Dienststatus prüfen.',
    throttledTitle: 'Anfragen werden gedrosselt',
    throttledCause:
      'Microsoft Graph begrenzt die Anzahl der Anfragen pro App und Tenant (HTTP 429).',
    throttledRemediation:
      'Kurz warten und dann „Erneut laden“ wählen – die App wartet automatisch die von Graph genannte Zeit (Retry-After) ab.',
  },
  facts: {
    entraStatus: 'Entra-Status',
    trustType: 'Join-Typ',
    managementAgent: 'Verwaltung',
    enrollmentType: 'Enrollment-Typ',
    enrolled: 'Registriert seit',
    storage: 'Freier Speicher',
    threatState: 'Mobile Threat Defense',
    jailBroken: 'Jailbreak/Root',
    complianceState: 'Compliance-Status',
    gracePeriodEnds: 'Schonfrist endet',
    policiesEvaluated: 'Ausgewertete Richtlinien',
    lastSync: 'Letzter Check-in',
    entraLastSignIn: 'Letzte Entra-Anmeldung',
    os: 'Betriebssystem',
    build: 'Build',
    release: 'Version',
    endOfUpdates: 'Updates bis (Enterprise/Education)',
    endOfUpdatesHomePro: 'Updates bis (Home/Pro)',
    encryption: 'Verschlüsselung',
    recoveryKeys: 'Wiederherstellungsschlüssel in Entra',
    signatureVersion: 'Signaturversion',
    engineVersion: 'Engine-Version',
    realTime: 'Echtzeitschutz',
    tamper: 'Manipulationsschutz',
    lastQuickScan: 'Letzter Schnellscan',
    lastReported: 'Zuletzt gemeldet',
    profiles: 'Konfigurationsprofile',
    compliancePolicies: 'Compliance-Richtlinien',
    yes: 'Ja',
    no: 'Nein',
    on: 'An',
    off: 'Aus',
    unknown: 'Unbekannt',
    none: 'Keine',
    zipFile: 'Datei',
    zipEntries: 'Einträge',
    zipCollected: 'Gesammelt',
  },
  trustType: {
    AzureAd: 'Microsoft Entra joined',
    ServerAd: 'Microsoft Entra hybrid joined',
    Workplace: 'Microsoft Entra registriert',
  },
  managementAgent: {
    mdm: 'Intune (MDM)',
    eas: 'Exchange ActiveSync',
    easMdm: 'Intune + Exchange ActiveSync',
    intuneClient: 'Intune-PC-Client',
    easIntuneClient: 'Intune-PC-Client + Exchange ActiveSync',
    configurationManagerClient: 'Configuration Manager',
    configurationManagerClientMdm: 'Co-Management (Configuration Manager + Intune)',
    configurationManagerClientMdmEas: 'Co-Management + Exchange ActiveSync',
    unknown: 'Unbekannt',
    jamf: 'Jamf',
    googleCloudDevicePolicyController: 'Google Cloud Device Policy Controller',
  },
  deviceStatus: {
    valueActive: 'Aktiv',
    valueDisabled: 'In Entra deaktiviert',
    valueNoEntra: 'Kein Entra-Objekt',
    valueThreat: 'Bedrohung gemeldet',
    valueJailbroken: 'Jailbreak erkannt',
    valueLowStorage: 'Wenig Speicher',
    summary: (parts: string[]) => parts.join(' · '),
    disabledTitle: 'Gerät ist in Microsoft Entra ID deaktiviert',
    disabledDetail: (name: string) =>
      `Das Entra-Geräteobjekt „${name}“ hat accountEnabled = false.`,
    disabledCause:
      'Ein deaktiviertes Gerät kann sich nicht mehr bei Microsoft Entra ID authentifizieren; Primary Refresh Token und Refresh Tokens auf dem Gerät werden widerrufen. Zugriff über gerätebasierten bedingten Zugriff und Windows Hello for Business schlägt fehl.',
    disabledRemediation: [
      'Klären, ob das Gerät absichtlich deaktiviert wurde (z. B. Verlust, Bereinigung veralteter Geräte).',
      'Wenn das Gerät weiter genutzt wird: im Microsoft Entra Admin Center unter „Geräte“ das Gerät wieder aktivieren (erfordert z. B. die Rolle Cloud Device Administrator).',
      'Bei Hybrid-Geräten prüfen, ob das Computerkonto im lokalen AD deaktiviert oder aus dem Synchronisationsbereich genommen wurde.',
    ],
    noEntraTitle: 'Kein passendes Entra-Geräteobjekt gefunden',
    noEntraDetail: (deviceId: string) =>
      `Für die Entra-Geräte-ID ${deviceId} gibt es kein Geräteobjekt in Microsoft Entra ID.`,
    noEntraCause:
      'Das Gerät wurde in Microsoft Entra ID gelöscht oder hat sich nie registriert. Ohne Geräteobjekt greifen gerätebasierter bedingter Zugriff und Compliance-Weitergabe nicht.',
    noEntraRemediation: [
      'Im Microsoft Entra Admin Center nach dem Gerätenamen suchen (evtl. Duplikat mit anderer ID).',
      'Am Gerät `dsregcmd /status` ausführen und Join-Zustand prüfen; bei Bedarf das Gerät neu registrieren bzw. neu joinen.',
    ],
    threatTitle: (state: string) => `Mobile Threat Defense meldet „${state}“`,
    threatDetail:
      'partnerReportedThreatState des Geräts zeigt ein Risiko, das ein Mobile-Threat-Defense-Partner gemeldet hat.',
    threatCause:
      'Der angebundene Mobile-Threat-Defense-Partner hat auf dem Gerät eine Bedrohung oder Kompromittierung erkannt.',
    threatRemediation: [
      'Details zur Bedrohung in der Konsole des Mobile-Threat-Defense-Partners prüfen.',
      'Gerät bis zur Klärung über bedingten Zugriff/Compliance vom Zugriff auf Unternehmensdaten ausschließen.',
    ],
    jailbrokenTitle: 'Jailbreak bzw. Root erkannt',
    jailbrokenDetail: 'Intune meldet jailBroken = "True".',
    jailbrokenCause:
      'Das Betriebssystem des Geräts wurde verändert; Sicherheitsmechanismen der Plattform sind nicht mehr verlässlich.',
    jailbrokenRemediation: [
      'Gerät mit dem Nutzer klären und Zugriff auf Unternehmensdaten sperren (Compliance-Einstellung „Gejailbreakte Geräte blockieren“).',
      'Gerät auf Werkszustand zurücksetzen lassen und neu registrieren.',
    ],
    lowStorageTitle: 'Wenig freier Speicherplatz',
    lowStorageDetail: (free: string, total: string, percent: string) =>
      `Frei: ${free} von ${total} (${percent}).`,
    lowStorageCause:
      'Zu wenig freier Speicher kann Updates, App-Installationen und Richtlinienanwendungen scheitern lassen.',
    lowStorageRemediation: [
      'Mit dem Nutzer Speicher freigeben (Downloads, temporäre Dateien, Speicheroptimierung).',
      'Bei wiederholtem Auftreten größere Festplatte bzw. Gerätetausch einplanen.',
    ],
  },
  compliance: {
    value: {
      compliant: 'Konform',
      noncompliant: 'Nicht konform',
      conflict: 'Konflikt',
      error: 'Fehler',
      inGracePeriod: 'In Schonfrist',
      configManager: 'Über Configuration Manager',
      unknown: 'Unbekannt',
    } as Record<string, string>,
    summaryPolicies: (bad: number, total: number) =>
      bad === 0
        ? `${total} ${total === 1 ? 'Richtlinie' : 'Richtlinien'} · alle konform`
        : `${bad} von ${total} Richtlinien nicht konform`,
    summaryGrace: (date: string) => `Schonfrist bis ${date}`,
    summaryNoPolicies: 'Keine Compliance-Richtlinie gemeldet',
    stateTitle: {
      noncompliant: 'Gerät ist nicht konform',
      conflict: 'Compliance-Konflikt',
      error: 'Fehler bei der Compliance-Auswertung',
      inGracePeriod: 'Gerät ist in der Schonfrist',
      unknown: 'Compliance-Status unbekannt',
      configManager: 'Compliance wird von Configuration Manager ausgewertet',
    } as Record<string, string>,
    stateDetail: (state: string) => `complianceState des Geräts: ${state}.`,
    graceDetail: (date: string, relative: string) =>
      `Das Gerät erfüllt nicht alle Compliance-Einstellungen, hat aber noch Zugriff bis ${date} (${relative}).`,
    noncompliantCause:
      'Das Gerät hat eine oder mehrere Compliance-Einstellungen nicht erfüllt, oder der Nutzer hat die Richtlinien nicht eingehalten. Nicht konforme Geräte werden – je nach bedingtem Zugriff – von Unternehmensressourcen ausgeschlossen.',
    graceCause:
      'Das Gerät ist nicht konform, befindet sich aber in der vom Admin definierten Schonfrist. Nach Ablauf wird es als nicht konform behandelt.',
    conflictCause: 'Für das Gerät widersprechen sich Compliance-Regeln.',
    errorCause:
      'Mindestens eine Compliance-Einstellung meldet „Fehler“. Der Status bleibt bis zu sieben Tage unverändert; danach wird das Gerät nicht konform bzw. in die Schonfrist gesetzt.',
    unknownCause:
      'Intune hat noch keinen auswertbaren Compliance-Status (z. B. kurz nach der Registrierung oder ohne zugewiesene Richtlinie).',
    configManagerCause:
      'Die Compliance dieses co-verwalteten Geräts wird über Configuration Manager ausgewertet, nicht über Intune-Richtlinien.',
    remediationCommon: [
      'Im Intune Admin Center unter Geräte › <Gerät> › Gerätekonformität die betroffenen Einstellungen ansehen.',
      'Ursache am Gerät beheben (z. B. Verschlüsselung aktivieren, Update installieren) und anschließend eine Synchronisierung auslösen, damit Intune neu bewertet.',
    ],
    remediationGrace: (date: string) => [
      `Ursache vor Ablauf der Schonfrist (${date}) beheben – danach greifen die konfigurierten Aktionen bei Nichtkonformität.`,
      'Im Intune Admin Center unter Geräte › <Gerät> › Gerätekonformität die betroffenen Einstellungen ansehen.',
    ],
    remediationUnknown: [
      'Prüfen, ob dem Gerät bzw. Nutzer eine Compliance-Richtlinie zugewiesen ist.',
      'Gerät synchronisieren lassen und nach dem nächsten Check-in erneut prüfen.',
    ],
    remediationConfigManager: [
      'Compliance-Status in der Configuration-Manager-Konsole prüfen oder den Workload „Compliance-Richtlinien“ auf Intune umstellen.',
    ],
    policyTitle: (name: string) => `Richtlinie „${name}“: nicht konform`,
    policyDetail: (count: number) =>
      count === 0
        ? 'Die Richtlinie meldet den Zustand nicht konform (keine Einstellungsdetails gemeldet).'
        : `${count} ${count === 1 ? 'Einstellung ist' : 'Einstellungen sind'} nicht erfüllt.`,
    settingLine: (name: string, value: string | null) =>
      value === null ? name : `${name} (aktueller Wert: ${value})`,
    policyCause:
      'Mindestens eine Einstellung dieser Compliance-Richtlinie ist auf dem Gerät nicht erfüllt.',
    policyRemediation: (settings: string) => [
      `Am Gerät die nicht erfüllten Einstellungen herstellen: ${settings}.`,
      'Danach Synchronisierung auslösen (Einstellungen › Konten › Auf Arbeits- oder Schulkonto zugreifen › Info › Synchronisieren) und Neubewertung abwarten.',
    ],
    validityHint:
      'Meldet ein Gerät seinen Compliance-Status nicht innerhalb der Gültigkeitsdauer (Standard: 30 Tage), behandelt Intune es als nicht konform.',
  },
  checkIn: {
    valueNever: 'Nie',
    summary: (date: string) => `Am ${date}`,
    staleTitle: (relative: string) => `Letzter Check-in ${relative}`,
    staleDetail: (date: string, days: number) =>
      `lastSyncDateTime: ${date} – seit ${days} ${days === 1 ? 'Tag' : 'Tagen'} keine Verbindung zu Intune.`,
    warnTitle: (relative: string) => `Check-in verzögert (${relative})`,
    warnDetail: (date: string) =>
      `lastSyncDateTime: ${date} – länger als 24 Stunden ohne Check-in.`,
    neverTitle: 'Kein Check-in gemeldet',
    neverDetail: 'Für das Gerät ist kein lastSyncDateTime vorhanden.',
    cause:
      'Das Gerät war ausgeschaltet, offline oder konnte den Intune-Dienst nicht erreichen (Netzwerk/Proxy, abgelaufenes Gerätezertifikat, defekte MDM-Registrierung). Ohne Check-in erhält es keine neuen Richtlinien, Apps oder Aktionen.',
    remediation: [
      'Klären, ob das Gerät eingeschaltet und mit dem Internet verbunden ist (Nutzer kontaktieren).',
      'Am Gerät die Synchronisierung auslösen: Einstellungen › Konten › Auf Arbeits- oder Schulkonto zugreifen › Konto › Info › Synchronisieren – oder im Intune Admin Center unter Geräte › <Gerät> › „Synchronisieren“ (die App selbst führt keine Aktion aus).',
      'Schlägt die Synchronisierung fehl: Netzwerk-/Proxy-Zugriff auf die Intune-Endpunkte und die MDM-Registrierung prüfen (DiagLogs-ZIP über „Diagnosedaten sammeln“ hilft).',
    ],
    staleExtra:
      'Nach Ablauf der Compliance-Gültigkeitsdauer (Standard 30 Tage) wird das Gerät als nicht konform behandelt. Dauerhaft ungenutzte Geräte als veraltet bereinigen.',
  },
  osVersion: {
    valueWindows: (product: string, version: string) => `${product} ${version}`,
    valueUnknownBuild: (build: number) => `Windows (Build ${build})`,
    valueOther: (os: string, version: string) => `${os} ${version}`.trim(),
    summaryEnd: (date: string) => `Updates bis ${date} (Enterprise)`,
    summaryEnded: 'Keine Updates mehr',
    summaryBuild: (build: string) => `Build ${build}`,
    summaryNotEvaluated: 'Supportstatus nur für Windows hinterlegt',
    win10Title: 'Windows 10 – Support beendet',
    win10Detail: (build: string) =>
      `Das Gerät läuft mit Windows 10 22H2 (Build ${build}). Windows 10 hat am 14.10.2025 das Supportende erreicht.`,
    win10Cause:
      'Ohne Extended Security Updates (ESU) erhält das Gerät keine Sicherheitsupdates mehr und ist zunehmend angreifbar.',
    win10Remediation: [
      'Prüfen, ob das Gerät Windows-11-tauglich ist, und das Upgrade per Intune-Feature-Update-Richtlinie planen.',
      'Falls kein Upgrade möglich ist: Gerät für Extended Security Updates (ESU) registrieren oder ersetzen.',
    ],
    endedTitle: (version: string) => `Windows 11 ${version} erhält keine Updates mehr`,
    endedDetail: (version: string, date: string) =>
      `Für Windows 11 ${version} endeten die Updates (Enterprise/Education) am ${date}.`,
    endingTitle: (version: string, days: number) =>
      `Windows 11 ${version}: Updates enden in ${days} ${days === 1 ? 'Tag' : 'Tagen'}`,
    endingDetail: (version: string, date: string) =>
      `Windows 11 ${version} erhält Updates (Enterprise/Education) bis ${date}.`,
    endCause:
      'Nach dem Ende des Servicings gibt es keine Sicherheits- und Qualitätsupdates mehr für diese Version. Home/Pro-Editionen laufen meist früher aus.',
    endRemediation: [
      'Feature-Update auf eine aktuelle Windows-11-Version per Intune-Feature-Update-Richtlinie zuweisen.',
      'Update-Ringe und Bereitstellungsstatus im Intune Admin Center (Berichte › Windows-Updates) prüfen.',
    ],
    homeProHint: 'Für Home/Pro-Editionen gelten frühere Enddaten.',
    homeProEndedTitle: (version: string) =>
      `Windows 11 ${version}: Home/Pro erhalten keine Updates mehr`,
    homeProEndedDetail: (date: string) =>
      `Für Home-, Pro-, Pro-Education- und Pro-for-Workstations-Editionen endeten die Updates am ${date}. Enterprise/Education werden länger versorgt. Die Edition meldet die dokumentierte Graph-API nicht.`,
    homeProEndedCause:
      'Läuft das Gerät mit einer Home- oder Pro-Edition, erhält es keine Sicherheitsupdates mehr.',
    unknownBuildTitle: 'Windows-Build nicht in der Release-Tabelle',
    unknownBuildDetail: (version: string) =>
      `Der Build ${version} ist in der hinterlegten Tabelle (Microsoft Learn „Windows release information“) nicht enthalten – Supportstatus wird nicht geraten.`,
    unknownBuildCause:
      'Insider-, LTSC- oder sehr neuer/alter Build bzw. unvollständige Versionsangabe.',
    unknownBuildRemediation: [
      'Version und Supportende auf der Seite „Windows release information“ manuell prüfen.',
    ],
  },
  bitlocker: {
    titleFileVault: 'FileVault',
    titleEncryption: 'Verschlüsselung',
    valueEncrypted: 'Verschlüsselt',
    valueNotEncrypted: 'Nicht verschlüsselt',
    valueUnknown: 'Unbekannt',
    summaryKeyEscrowed: 'Schlüssel in Entra gesichert',
    summaryNoKey: 'Kein Schlüssel in Entra',
    summaryKeyUnknown: (status: string) => `Schlüsselstatus: ${status}`,
    summaryPlatform: 'Laut Intune-Gerätebericht',
    keysCount: (os: number, other: number) =>
      os === 0 && other === 0 ? 'Keine' : `${os} Betriebssystem-Volume, ${other} weitere`,
    notEncryptedTitle: (name: string) => `${name} ist nicht aktiviert`,
    notEncryptedDetail: 'Intune meldet isEncrypted = false für dieses Gerät.',
    notEncryptedCauseWindows:
      'BitLocker wurde nicht aktiviert – z. B. keine oder fehlgeschlagene Verschlüsselungsrichtlinie, fehlende Voraussetzungen (TPM, Windows-Wiederherstellungsumgebung), oder die Verschlüsselung wartet auf eine Nutzeraktion.',
    notEncryptedCauseMac:
      'FileVault ist nicht aktiviert oder der Nutzer hat die Aktivierung noch nicht bestätigt.',
    notEncryptedRemediationWindows: [
      'Im Intune Admin Center den Verschlüsselungsbericht (Geräte › Überwachen › Verschlüsselungsbericht) für das Gerät prüfen – dort steht der konkrete Status bzw. Fehler.',
      'Sicherstellen, dass dem Gerät eine BitLocker-Richtlinie (Endpoint Security › Datenträgerverschlüsselung) zugewiesen ist.',
      'Am Gerät TPM- und WinRE-Status prüfen; Fehler stehen im Ereignisprotokoll „BitLocker-API“.',
    ],
    notEncryptedRemediationMac: [
      'FileVault-Richtlinie (Endpoint Security › Datenträgerverschlüsselung) zuweisen und den Status im Verschlüsselungsbericht prüfen.',
      'Nutzer bitten, die FileVault-Aktivierung beim nächsten Abmelden/Anmelden zu bestätigen.',
    ],
    noKeyTitle: 'Wiederherstellungsschlüssel nicht in Entra gesichert',
    noKeyDetail:
      'Das Gerät ist verschlüsselt, aber in Microsoft Entra ID ist kein Wiederherstellungsschlüssel für das Betriebssystem-Volume hinterlegt.',
    noKeyCause:
      'Die Schlüsselsicherung ist fehlgeschlagen oder nicht konfiguriert (z. B. Verschlüsselung vor der Registrierung, fehlendes Netzwerk bei der Sicherung). Ohne gesicherten Schlüssel ist eine Wiederherstellung durch den Helpdesk nicht möglich.',
    noKeyRemediation: [
      'Im Verschlüsselungsbericht prüfen, ob „Sicherung des Wiederherstellungsschlüssels fehlgeschlagen“ gemeldet wird; Details im Ereignisprotokoll des Geräts.',
      'In der BitLocker-Richtlinie die Sicherung der Wiederherstellungsinformationen in Microsoft Entra ID verlangen.',
      'Schlüssel bei Bedarf am Gerät manuell sichern lassen (manage-bde) – die App liest Schlüssel nie aus.',
    ],
    unknownTitle: 'Verschlüsselungsstatus unbekannt',
    unknownDetail: 'Intune meldet für isEncrypted keinen Wert.',
    unknownCause:
      'Das Gerät hat (noch) keinen Hardware-/Verschlüsselungsbestand an Intune gemeldet.',
    unknownRemediation: [
      'Nach dem nächsten Check-in erneut prüfen; Verschlüsselungsbericht im Intune Admin Center ansehen.',
    ],
  },
  defender: {
    valueProtected: 'Geschützt',
    valueThreat: 'Bedrohung aktiv',
    valueDisabled: 'Schutz deaktiviert',
    valueCritical: 'Kritischer Zustand',
    valueReboot: 'Neustart ausstehend',
    valueSignatures: 'Signaturen veraltet',
    valueAttention: 'Prüfen',
    valueTreated: 'Bedrohung behandelt',
    summary: (scan: string) => `Letzter Schnellscan ${scan}`,
    activeMalwareTitle: (name: string) => `Aktive Bedrohung: ${name}`,
    malwareDetail: (severity: string, state: string, threatState: string, when: string) =>
      `Schweregrad ${severity}, Status ${state}, Bedrohungsstatus ${threatState}, erkannt ${when}.`,
    activeMalwareCause:
      'Microsoft Defender hat eine Bedrohung erkannt, die nicht (vollständig) beseitigt wurde.',
    activeMalwareRemediation: [
      'Bedrohung im Microsoft Defender-Portal bzw. am Gerät (Windows-Sicherheit › Viren- & Bedrohungsschutz › Schutzverlauf) prüfen.',
      'Vollständigen Scan am Gerät ausführen lassen und empfohlene Aktion (Quarantäne/Entfernen) durchführen.',
      'Bei Bedarf das Gerät isolieren und den Sicherheitsvorfall nach Prozess behandeln.',
    ],
    remediatedMalwareTitle: (name: string) => `Bedrohung erkannt und behandelt: ${name}`,
    remediatedMalwareCause:
      'Microsoft Defender hat eine Bedrohung erkannt und unter Quarantäne gestellt bzw. entfernt.',
    remediatedMalwareRemediation: [
      'Herkunft der Datei klären (Download, E-Mail, USB) und den Nutzer sensibilisieren.',
      'Ausstehende Aktionen (z. B. Neustart) abschließen lassen.',
    ],
    protectionOffTitle: 'Virenschutz ist deaktiviert',
    protectionOffDetail: 'malwareProtectionEnabled = false.',
    rtpOffTitle: 'Echtzeitschutz ist deaktiviert',
    rtpOffDetail: 'realTimeProtectionEnabled = false.',
    protectionOffCause:
      'Microsoft Defender Antivirus ist ausgeschaltet – z. B. durch ein Drittanbieter-Antivirus (Windows Security Center), lokale Änderung oder Richtlinie.',
    protectionOffRemediation: [
      'Antivirus-Richtlinie in Intune (Endpoint Security › Antivirus) prüfen und Echtzeitschutz erzwingen.',
      'Prüfen, ob ein Drittanbieter-Antivirus installiert ist, das Defender deaktiviert.',
      'Manipulationsschutz aktivieren, damit Schutzeinstellungen nicht lokal abgeschaltet werden können.',
    ],
    deviceCriticalTitle: 'Defender meldet einen kritischen Zustand',
    deviceCriticalDetail: 'deviceState = critical.',
    deviceCriticalCause: 'Defender meldet einen Zustand, der sofortiges Handeln erfordert.',
    deviceCriticalRemediation: [
      'Gerät im Microsoft Defender-Portal bzw. in Windows-Sicherheit prüfen und die angezeigte Aktion ausführen.',
    ],
    signaturesTitle: 'Signaturen sind veraltet',
    signaturesDetail: (version: string) =>
      `signatureUpdateOverdue = true (aktuelle Version ${version}).`,
    signaturesCause:
      'Das Gerät hat die Security-Intelligence-Updates nicht rechtzeitig erhalten – z. B. offline, Update-Quelle nicht erreichbar oder Defender deaktiviert.',
    signaturesRemediation: [
      'Netzwerkzugriff des Geräts auf die konfigurierte Update-Quelle (Microsoft Update, WSUS, Dateifreigabe) prüfen.',
      'Am Gerät „Windows-Sicherheit › Viren- & Bedrohungsschutz › Schutzupdates › Nach Updates suchen“ ausführen lassen.',
      'Reihenfolge der Update-Quellen in der Antivirus-Richtlinie prüfen.',
    ],
    quickScanTitle: 'Schnellscan überfällig',
    quickScanDetail: (when: string) => `quickScanOverdue = true (letzter Schnellscan ${when}).`,
    quickScanCause:
      'Der geplante Schnellscan wurde nicht ausgeführt, z. B. weil das Gerät zur geplanten Zeit aus war.',
    quickScanRemediation: [
      'Scan-Zeitplan in der Antivirus-Richtlinie prüfen; Schnellscan am Gerät manuell starten lassen.',
    ],
    rebootTitle: 'Neustart erforderlich',
    rebootDetail: (state: string) => `rebootRequired = true, deviceState = ${state}.`,
    rebootCause:
      'Eine Defender-Aktion (z. B. Bereinigung einer Bedrohung oder Plattform-Update) wird erst nach einem Neustart abgeschlossen.',
    rebootRemediation: ['Nutzer bitten, das Gerät neu zu starten; danach Status erneut prüfen.'],
    fullScanTitle: 'Vollständiger Scan erforderlich',
    fullScanDetail: 'fullScanRequired = true bzw. deviceState = fullScanPending.',
    fullScanCause: 'Defender verlangt nach einer Erkennung einen vollständigen Scan.',
    fullScanRemediation: [
      'Vollständigen Scan am Gerät ausführen lassen (Windows-Sicherheit › Scanoptionen › Vollständige Überprüfung).',
    ],
    manualStepsTitle: 'Manuelle Schritte ausstehend',
    manualStepsDetail: 'deviceState = manualStepsPending.',
    manualStepsCause: 'Zur Bereinigung einer Bedrohung sind manuelle Schritte am Gerät nötig.',
    manualStepsRemediation: [
      'In Windows-Sicherheit › Schutzverlauf die empfohlenen Schritte ausführen lassen.',
    ],
    offlineScanTitle: 'Offline-Scan ausstehend',
    offlineScanDetail: 'deviceState = offlineScanPending.',
    offlineScanCause:
      'Defender benötigt einen Microsoft Defender Offline-Scan, um eine Bedrohung zu entfernen.',
    offlineScanRemediation: [
      'Microsoft Defender Offline-Scan am Gerät starten lassen (Neustart erforderlich).',
    ],
    malwareListErrorTitle: 'Liste erkannter Bedrohungen nicht abrufbar',
    malwareListErrorDetail: (message: string) =>
      `detectedMalwareState konnte nicht geladen werden: ${message} – ob Bedrohungen vorliegen, ist unbekannt.`,
    malwareListErrorCause:
      'Der Abruf der Malware-Liste ist fehlgeschlagen (Berechtigung, Drosselung oder Dienstfehler).',
    malwareListErrorRemediation: [
      'Ansicht später erneut laden; bei HTTP 403 die Berechtigung DeviceManagementManagedDevices.Read.All prüfen.',
      'Bedrohungen zusätzlich im Microsoft Defender-Portal bzw. am Gerät prüfen.',
    ],
    tamperTitle: 'Manipulationsschutz ist aus',
    tamperDetail: 'tamperProtectionEnabled = false.',
    tamperCause:
      'Ohne Manipulationsschutz können wichtige Defender-Einstellungen lokal deaktiviert oder geändert werden.',
    tamperRemediation: [
      'Manipulationsschutz per Intune-Richtlinie (Endpoint Security › Antivirus › Windows-Sicherheitsfunktionen) aktivieren.',
    ],
    productStatusTitle: 'Defender meldet weitere Zustände',
    productStatusDetail: (items: string) => `productStatus: ${items}.`,
    productStatusCause:
      'Microsoft Defender meldet Produktzustände, die nicht dem Normalbetrieb entsprechen.',
    productStatusRemediation: [
      'Gerät in Windows-Sicherheit bzw. im Microsoft Defender-Portal prüfen und gemeldete Zustände beheben.',
    ],
    /** Klartext je windowsDefenderProductStatus-Wert (Microsoft Learn, übersetzt) */
    productStatus: {
      noStatus: 'Kein Status',
      serviceNotRunning: 'Dienst läuft nicht',
      serviceStartedWithoutMalwareProtection: 'Dienst ohne Antimalware-Engine gestartet',
      pendingFullScanDueToThreatAction: 'Vollständiger Scan wegen Bedrohungsaktion ausstehend',
      pendingRebootDueToThreatAction: 'Neustart wegen Bedrohungsaktion ausstehend',
      pendingManualStepsDueToThreatAction: 'Manuelle Schritte wegen Bedrohungsaktion ausstehend',
      avSignaturesOutOfDate: 'Antivirus-Signaturen veraltet',
      asSignaturesOutOfDate: 'Antispyware-Signaturen veraltet',
      noQuickScanHappenedForSpecifiedPeriod: 'Kein Schnellscan im festgelegten Zeitraum',
      noFullScanHappenedForSpecifiedPeriod: 'Kein vollständiger Scan im festgelegten Zeitraum',
      systemInitiatedScanInProgress: 'Systemscan läuft',
      systemInitiatedCleanInProgress: 'Systembereinigung läuft',
      samplesPendingSubmission: 'Proben warten auf Übermittlung',
      productRunningInEvaluationMode: 'Produkt läuft im Evaluierungsmodus',
      productRunningInNonGenuineMode: 'Produkt läuft auf nicht originalem Windows',
      productExpired: 'Produkt abgelaufen',
      offlineScanRequired: 'Offline-Scan erforderlich',
      serviceShutdownAsPartOfSystemShutdown: 'Dienst wird mit dem System heruntergefahren',
      threatRemediationFailedCritically: 'Bedrohungsbereinigung kritisch fehlgeschlagen',
      threatRemediationFailedNonCritically: 'Bedrohungsbereinigung nicht kritisch fehlgeschlagen',
      noStatusFlagsSet: 'Keine Statusflags gesetzt',
      platformOutOfDate: 'Plattform veraltet',
      platformUpdateInProgress: 'Plattform-Update läuft',
      platformAboutToBeOutdated: 'Plattform bald veraltet',
      signatureOrPlatformEndOfLifeIsPastOrIsImpending:
        'Ende des Supports für Signaturen/Plattform erreicht oder steht bevor',
      windowsSModeSignaturesInUseOnNonWin10SInstall:
        'S-Modus-Signaturen auf Nicht-S-Modus-Installation',
    } as Record<string, string>,
  },
  policies: {
    valueOk: 'Alle angewendet',
    valueProblems: (n: number) => `${n} ${n === 1 ? 'Problem' : 'Probleme'}`,
    valueWarnings: (n: number) => `${n} nicht konform`,
    valueNone: 'Keine gemeldet',
    summary: (profiles: number | null, compliance: number | null) =>
      [
        profiles === null ? null : `${profiles} ${profiles === 1 ? 'Profil' : 'Profile'}`,
        compliance === null
          ? null
          : `${compliance} Compliance-${compliance === 1 ? 'Richtlinie' : 'Richtlinien'}`,
      ]
        .filter(Boolean)
        .join(' · '),
    kindProfile: 'Konfigurationsprofil',
    kindCompliance: 'Compliance-Richtlinie',
    errorTitle: (kind: string, name: string) => `${kind} „${name}“: Fehler`,
    conflictTitle: (kind: string, name: string) => `${kind} „${name}“: Konflikt`,
    nonCompliantTitle: (kind: string, name: string) => `${kind} „${name}“: nicht konform`,
    stateLabel: {
      error: 'Fehler',
      conflict: 'Konflikt',
      nonCompliant: 'nicht konform',
      compliant: 'konform',
      remediated: 'behoben',
      notApplicable: 'nicht anwendbar',
      notAssigned: 'nicht zugewiesen',
      unknown: 'unbekannt',
    } as Record<string, string>,
    policyDetail: (state: string, settings: string) =>
      settings ? `Zustand ${state}. Betroffen: ${settings}.` : `Zustand ${state}.`,
    settingWithCode: (name: string, code: string) => `${name} (${code})`,
    errorCause: 'Das Gerät konnte mindestens eine Einstellung des Profils nicht anwenden.',
    conflictCause:
      'Mehrere Richtlinien setzen dieselbe Einstellung auf unterschiedliche Werte. Intune löst Konflikte zwischen Konfigurationsprofilen nicht automatisch auf; Compliance-Einstellungen haben Vorrang vor Konfigurationsprofilen.',
    conflictSources: (names: string) => `Beteiligte Richtlinien: ${names}.`,
    nonCompliantCause: 'Mindestens eine Einstellung erfüllt die Vorgabe der Richtlinie nicht.',
    errorRemediation: [
      'Im Intune Admin Center unter Geräte › <Gerät> › Gerätekonfiguration das Profil öffnen und die fehlerhafte Einstellung prüfen.',
      'Prüfen, ob die Einstellung von Edition und Version des Geräts unterstützt wird.',
      'Nach der Korrektur das Gerät synchronisieren lassen und den Status erneut prüfen.',
    ],
    conflictRemediation: [
      'Alle Profile ermitteln, die die betroffene Einstellung konfigurieren (siehe Rohdaten „Quellen“).',
      'Konflikt manuell auflösen: Einstellung nur in einem Profil setzen oder Zuweisungen/Filter so anpassen, dass sich die Profile nicht überschneiden.',
    ],
    nonCompliantRemediation: [
      'Betroffene Einstellungen am Gerät herstellen bzw. Richtlinienwerte prüfen; danach synchronisieren.',
    ],
    codeKnown: (label: string) => `Fehlercode: ${label}.`,
    codeUnknown: (hex: string, decimal: number) => `Unbekannter Code ${hex} (${decimal}).`,
    codeWin32: (hex: string, base: number, name: string | null) =>
      name
        ? `${hex} entspricht Win32-Fehler ${base} (${name}).`
        : `${hex} entspricht Win32-Fehler ${base}.`,
    settingsCatalogTitle: 'Settings-Catalog-Profile nicht enthalten',
    settingsCatalogDetail:
      'Settings-Catalog-Profile (und weitere neuere Richtlinientypen) werden über die dokumentierte Graph-API (deviceConfigurationStates) nicht pro Gerät gemeldet.',
    settingsCatalogCause:
      'Die App nutzt ausschließlich offiziell dokumentierte v1.0-Endpunkte; für diese Profile gibt es dort keinen gerätebezogenen Status.',
    settingsCatalogRemediation: [
      'Status dieser Profile im Intune Admin Center prüfen: Geräte › <Gerät> › Gerätekonfiguration.',
    ],
    forbiddenProfilesSummary: 'Profile: Berechtigung fehlt',
  },
  zip: {
    sourcePrefix: 'DiagLogs-ZIP',
    entraJoin: {
      joinType: {
        entra: 'Microsoft Entra joined',
        hybrid: 'Microsoft Entra hybrid joined',
        domain: 'Domain Joined',
        none: 'Nicht verbunden',
      },
      valuePrtMissing: 'Kein PRT',
      valueOk: 'PRT vorhanden',
      summary: (join: string, prt: string) => `${join} · ${prt}`,
      noDsregTitle: 'dsregcmd-Ausgabe fehlt',
      noDsregDetail: 'Im Archiv wurde keine Ausgabe von „dsregcmd /status“ gefunden.',
      noDsregCause:
        'Die Sammlung ist fehlgeschlagen oder das Diagnoseprofil enthält den Befehl nicht.',
      noDsregRemediation: [
        'Am Gerät `dsregcmd /status` im Benutzerkontext ausführen lassen und das Ergebnis prüfen.',
      ],
      prtTitle: 'Kein Primary Refresh Token (PRT)',
      prtDetail: (attempt: string | null, status: string | null, http: string | null) =>
        [
          'dsregcmd meldet AzureAdPrt : NO.',
          attempt ? `Letzter fehlgeschlagener Versuch: ${attempt}.` : null,
          status ? `Attempt Status: ${status}.` : null,
          http ? `HTTP Error: ${http}.` : null,
        ]
          .filter(Boolean)
          .join(' '),
      prtCause:
        'Ohne PRT funktionieren einmaliges Anmelden (SSO) bei Microsoft-Entra-Apps und gerätebasierter bedingter Zugriff nicht zuverlässig; Compliance-geschützte Ressourcen können den Zugriff verweigern.',
      prtCodeCause: (title: string, cause: string) => `${title}: ${cause}`,
      prtUnknownCode: (hex: string) =>
        `Attempt Status ${hex}: Unbekannter Code – keine dokumentierte Deutung hinterlegt.`,
      prtNtStatus: (hex: string, name: string, text: string) =>
        `Attempt Status ${hex} = ${name} („${text}“).`,
      prtHttpError: (hex: string, name: string, text: string) =>
        `HTTP Error ${hex} entspricht WinHTTP ${name} („${text}“).`,
      prtRemediation: [
        'Gerät sperren und entsperren bzw. ab- und wieder anmelden, um einen neuen PRT-Abruf auszulösen; danach `dsregcmd /status` im Benutzerkontext prüfen.',
        'Fehlercode „Attempt Status“ mit der Microsoft-Seite „Troubleshoot primary refresh token issues“ abgleichen.',
      ],
      contextHint:
        'Hinweis: Die Intune-Diagnosesammlung führt dsregcmd nicht im Kontext des angemeldeten Benutzers aus; Benutzer- und SSO-Status können daher vom tatsächlichen Benutzerzustand abweichen.',
      wamTitle: 'WamDefaultSet meldet einen Fehler',
      wamDetail: (value: string, code: string | null) =>
        code ? `WamDefaultSet : ${value} – ${code}` : `WamDefaultSet : ${value}.`,
      wamCause:
        'Für den angemeldeten Benutzer wurde kein Standard-WebAccount im Web Account Manager (WAM) angelegt. Laut Microsoft kann dieses Feld auch einen Fehler zeigen, wenn dsregcmd mit erhöhten Rechten ausgeführt wurde.',
      wamRemediation: [
        '`dsregcmd /status` als angemeldeter Benutzer (ohne Administratorrechte) ausführen und WamDefaultSet erneut prüfen.',
        'Bleibt der Fehler: Benutzer ab- und anmelden; AAD-Ereignisprotokolle am Gerät auswerten.',
      ],
      authTitle: 'Geräteauthentifizierung fehlgeschlagen',
      authDetail: (value: string) => `DeviceAuthStatus : ${value}.`,
      authCause:
        'Das Gerät ist in Microsoft Entra ID deaktiviert oder gelöscht, oder der Test konnte (ohne Netzwerkverbindung im Systemkontext) nicht ausgeführt werden.',
      authRemediation: [
        'Gerät im Microsoft Entra Admin Center suchen und Status (aktiviert/gelöscht) prüfen.',
        'Ist das Gerät gelöscht: Gerät je nach Join-Typ neu registrieren.',
      ],
      notJoinedTitle: 'Gerät ist nicht mit Microsoft Entra ID verbunden',
      notJoinedDetail: 'AzureAdJoined : NO und DomainJoined : NO.',
      notJoinedCause:
        'Das Gerät ist weder Entra-joined noch domänengebunden; Intune-Richtlinien für Entra-Geräte und bedingter Zugriff greifen nicht.',
      notJoinedRemediation: [
        'Join-Status am Gerät prüfen und das Gerät gemäß Bereitstellungsprozess (Autopilot, Hybrid-Join) verbinden.',
      ],
    },
    win32: {
      valueFailed: (failed: number, total: number) => `${failed} von ${total} fehlgeschlagen`,
      valueOk: (total: number) => `${total} ${total === 1 ? 'App' : 'Apps'} ohne Fehler`,
      valueNone: 'Keine Daten',
      summaryCounts: (installed: number, failed: number, other: number) =>
        `${installed} installiert · ${failed} fehlgeschlagen · ${other} sonstige`,
      summaryNone: 'Keine Win32-App-Zustände im Archiv',
      failedTitle: (appId: string) => `Installation fehlgeschlagen: App ${appId}`,
      failedDetail: (code: string) => `Status „Failed“, ${code}.`,
      codeWin32: (
        hex: string,
        decimal: number,
        base: number,
        name: string | null,
        text: string | null,
      ) =>
        name
          ? `Fehlercode ${hex} (${decimal}) = Win32 ${base} ${name} („${text}“)`
          : `Fehlercode ${hex} (${decimal}) = Win32-Fehler ${base}`,
      codeUnknown: (hex: string, decimal: number) => `Unbekannter Code ${hex} (${decimal})`,
      codeNone: 'ohne Fehlercode',
      failedCause:
        'Die Intune Management Extension (IME) meldet für diese Win32-App eine fehlgeschlagene Installation.',
      failedRemediation: [
        'App im Intune Admin Center über die App-ID finden (Apps › Windows; die ID steht in der URL der App) und den Gerätestatus prüfen.',
        'IME-Logs im Archiv bzw. am Gerät auswerten: AppWorkload.log und IntuneManagementExtension.log unter C:\\ProgramData\\Microsoft\\IntuneManagementExtension\\Logs.',
        'Installationsbefehl, Erkennungsregel und Rückgabecodes der App prüfen; bei Benutzerzuweisung beachten, dass Apps mit Administratorbedarf im Benutzerkontext scheitern.',
      ],
      pendingRebootTitle: (appId: string) => `Neustart ausstehend: App ${appId}`,
      pendingRebootDetail: 'Status „InstalledPendingReboot“.',
      pendingRebootCause:
        'Die Installation ist abgeschlossen, wird aber erst nach einem Neustart wirksam.',
      pendingRebootRemediation: ['Nutzer bitten, das Gerät neu zu starten.'],
      imeTitle: (errors: number, warnings: number) =>
        `IME-Log: ${errors} Fehler-, ${warnings} Warnzeilen`,
      imeDetail: (lines: string) => `Auszug: ${lines}`,
      imeCause:
        'Die Intune Management Extension protokolliert Fehler bzw. Warnungen. Typ 3 markiert teils auch Informationen – nur als Hinweis werten.',
      imeRemediation: [
        'Einträge im zeitlichen Zusammenhang mit fehlgeschlagenen Apps im vollständigen Log prüfen.',
      ],
    },
    enrollment: {
      valueMdm: 'Intune-MDM registriert',
      valueCoManaged: 'Co-Management',
      valueMissing: 'Keine MDM-Registrierung',
      valueNone: 'Keine Daten',
      summary: (count: number, upn: string | null) =>
        `${count} ${count === 1 ? 'Registrierung' : 'Registrierungen'}${upn ? ` · ${upn}` : ''}`,
      missingTitle: 'Keine Intune-MDM-Registrierung gefunden',
      missingDetail:
        'Unter HKLM\\Software\\Microsoft\\Enrollments gibt es keinen Eintrag mit ProviderID „MS DM Server“.',
      missingCause:
        'Das Gerät ist nicht (mehr) bei Intune registriert oder die Registrierung ist beschädigt.',
      missingRemediation: [
        'Registrierungsstatus im Intune Admin Center und am Gerät (Einstellungen › Konten › Auf Arbeits- oder Schulkonto zugreifen) prüfen.',
        'Registrierungsfehler anhand der Microsoft-Seite zur Fehlerbehebung bei der Windows-Registrierung analysieren.',
      ],
      coManagedTitle: 'Co-Management erkannt',
      coManagedDetail:
        'Zusätzlich zur Intune-Registrierung existiert eine Registrierung mit ProviderID „WMI_Bridge_SCCM_Server“ (Configuration Manager).',
      coManagedCause:
        'Das Gerät wird gleichzeitig von Configuration Manager und Intune verwaltet; je Workload entscheidet die Co-Management-Einstellung, wer zuständig ist.',
      coManagedRemediation: [
        'Bei Richtlinienproblemen prüfen, welcher Workload (z. B. Compliance, Gerätekonfiguration) Intune bzw. Configuration Manager zugeordnet ist.',
      ],
      providerLabel: (provider: string) => `Registrierung (${provider})`,
      providerValue: (state: number | null, type: number | null) =>
        `EnrollmentState ${state ?? '–'}, EnrollmentType ${type ?? '–'}`,
    },
    collection: {
      valueOk: 'Vollständig',
      valueFailed: (n: number) => `${n} ${n === 1 ? 'Sammlung' : 'Sammlungen'} fehlgeschlagen`,
      valueHarmless: (n: number) => `${n} erwartbar fehlend`,
      summary: (entries: number, collected: string | null) =>
        collected ? `${entries} Einträge · gesammelt ${collected}` : `${entries} Einträge`,
      failedTitle: (kind: string, target: string) => `${kind} nicht gesammelt: ${target}`,
      failedDetail: (hresult: string, meaning: string | undefined) =>
        meaning ? `${hresult} – ${meaning}.` : `${hresult}.`,
      harmlessCause:
        'Diese Komponente ist auf vielen Geräten nicht installiert; das Fehlen der Daten ist dann erwartbar.',
      failedCause:
        'Die Sammlung dieses Eintrags ist fehlgeschlagen – Pfad/Schlüssel fehlt oder der Befehl lieferte einen Fehler.',
      harmlessRemediation: ['Keine Aktion nötig, sofern die Komponente nicht eingesetzt wird.'],
      failedRemediation: [
        'Prüfen, ob die Komponente auf dem Gerät vorhanden sein sollte.',
        'Bei Bedarf die Daten manuell am Gerät erheben.',
      ],
      notesTitle: 'Hinweise zur Analyse',
      notesCause:
        'Manche Einträge werden bewusst nicht ausgewertet (Binärdateien, Größenlimit, lokalisierte Ausgaben).',
      notesRemediation: [
        'Binäre Logs (.evtx, .etl, .cab) bei Bedarf lokal mit der Ereignisanzeige bzw. passenden Werkzeugen öffnen.',
      ],
      kind: {
        RegistryKey: 'Registry-Schlüssel',
        Command: 'Befehl',
        Events: 'Ereignisprotokoll',
        FoldersFiles: 'Dateien',
      } as Record<string, string>,
    },
  },
} as const;
