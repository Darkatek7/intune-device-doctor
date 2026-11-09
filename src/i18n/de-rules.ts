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
    /** Zusätzlicher Hinweis je Scope: Rollen laut Microsoft Learn (nur dort, wo die Doku sie nennt). */
    forbiddenRoleHints: {
      'AuditLog.Read.All':
        'Das Anmeldeprotokoll erfordert laut Microsoft Entra ID P1/P2 und für das Konto eine Entra-Rolle wie Global Reader, Reports Reader, Security Administrator, Security Operator oder Security Reader.',
      'LicenseAssignment.Read.All':
        'Die Lizenzdetails eines Benutzers darf laut Microsoft nur lesen, wer eine Entra-Rolle wie Directory Readers, License Administrator oder User Administrator hat (oder eine benutzerdefinierte Rolle mit microsoft.directory/users/licenseDetails/read).',
      'SecurityAlert.Read.All':
        'Sicherheitswarnungen darf laut Microsoft nur lesen, wer eine Entra-Rolle wie Security Reader, Global Reader, Security Operator oder Security Administrator hat.',
      'DeviceLocalCredential.ReadBasic.All':
        'Für die LAPS-Metadaten braucht das Konto laut Microsoft eine Entra-Rolle wie Cloud Device Administrator, Helpdesk Administrator, Intune Service Administrator, Security Administrator, Security Reader oder Global Reader.',
    } as Record<string, string>,
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
    mdmCertificate: 'MDM-Zertifikat gültig bis',
    apnsCertificate: 'Apple-MDM-Push-Zertifikat gültig bis',
    supervised: 'Beaufsichtigt (supervised)',
    enrollmentProfile: 'Enrollment-Profil',
    securityPatch: 'Sicherheitspatch',
    appsAssigned: 'Zugewiesene Apps',
    appsInstalled: 'Installiert',
    appsFailed: 'Fehlgeschlagen',
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
  /** M14/S5: Ansicht „Mandant“ – mandantenweite Zertifikate und Token */
  tenant: {
    push: {
      valueValid: 'Gültig',
      valueExpiring: 'Läuft ab',
      valueExpired: 'Abgelaufen',
      summaryValid: (date: string) => `Gültig bis ${date}`,
      facts: { expires: 'Gültig bis', modified: 'Zuletzt geändert' },
      noExpiryTitle: 'Ablaufdatum nicht gemeldet',
      noExpiryDetail: 'applePushNotificationCertificate.expirationDateTime ist leer.',
      noExpiryCause:
        'Graph meldet zum Apple-MDM-Push-Zertifikat kein Ablaufdatum. Ohne Datum lässt sich nicht beurteilen, wann es erneuert werden muss.',
      noExpiryRemediation: [
        'Das Ablaufdatum im Intune Admin Center unter Geräte › Registrierung › Apple › „Apple MDM Push Certificate“ prüfen.',
      ],
    },
    vpp: {
      valueNone: 'Keine Token',
      valueOk: 'Alle Token in Ordnung',
      valueProblems: (n: number) => (n === 1 ? '1 Token prüfen' : `${n} Token prüfen`),
      summaryNone: 'Im Mandanten ist kein VPP-Token hinterlegt',
      summary: (count: number, earliest: string | null) =>
        `${count === 1 ? '1 Token' : `${count} Token`}${earliest ? ` · frühester Ablauf ${earliest}` : ''}`,
      tokenLabel: (name: string | null, index: number) => name ?? `VPP-Token ${index + 1}`,
      facts: { count: 'Token', earliest: 'Frühester Ablauf' },
      noneTitle: 'Kein VPP-Token hinterlegt',
      noneDetail: 'GET /deviceAppManagement/vppTokens liefert eine leere Liste.',
      noneCause:
        'Im Mandanten ist kein Apple-VPP-Token (Apple Business Manager bzw. Apple School Manager) mit Intune verbunden. Das ist in Ordnung, solange keine per VPP gekauften Apps verteilt werden.',
      noneRemediation: [
        'Keine Aktion nötig, wenn keine VPP-Apps genutzt werden.',
        'Andernfalls im Intune Admin Center unter Mandantenverwaltung › Connectors und Token › Apple-VPP-Token prüfen, ob das Token noch vorhanden ist.',
      ],
      expiredTitle: (name: string) => `VPP-Token „${name}“ ist abgelaufen`,
      expiredDetail: (date: string | null) =>
        `state: expired${date ? `, expirationDateTime: ${date}` : ''}.`,
      expiredCause:
        'Das Token ist abgelaufen. Intune zeigt abgelaufene Token – wie auch Token, deren verwaltetes Apple-ID-Konto sich geändert hat – als „ungültig“ an. Das Token wird gebraucht, um per VPP gekaufte Apps zu verwalten.',
      invalidTitle: (name: string) => `VPP-Token „${name}“ ist ungültig`,
      invalidDetail: (date: string | null) =>
        `state: invalid${date ? `, expirationDateTime: ${date}` : ''}.`,
      invalidCause:
        'Laut Microsoft zeigt Intune ein Token als ungültig an, wenn sich das verwaltete Apple-ID-Konto des Tokens geändert hat (Domänenwechsel, Kennwort geändert oder abgelaufen, Konto deaktiviert) oder das Token abgelaufen ist.',
      expiringTitle: (name: string, relative: string) => `VPP-Token „${name}“ läuft ${relative} ab`,
      expiringDetail: (date: string, days: number) =>
        `expirationDateTime: ${date} – Warnschwelle ${days} Tage (Richtwert dieser App, keine Microsoft-Vorgabe).`,
      expiringCause:
        'VPP-Token sind begrenzt gültig und müssen rechtzeitig erneuert werden. Läuft ein Token ab, wird es von Intune als ungültig angezeigt.',
      renewRemediation: [
        'Token im Apple Business Manager bzw. Apple School Manager neu herunterladen (Einstellungen › Zahlungen und Abrechnung › Apps und Bücher › Inhaltstoken › Herunterladen).',
        'Im Intune Admin Center unter Mandantenverwaltung › Connectors und Token › Apple-VPP-Token das vorhandene Token öffnen, bei „Grundlagen“ auf „Bearbeiten“ klicken, das neue Token hochladen und speichern.',
        'Danach die Seite aktualisieren – das neue Ablaufdatum erscheint in Intune mit etwas Verzögerung.',
      ],
      syncFailedTitle: (name: string) => `Synchronisierung des VPP-Tokens „${name}“ fehlgeschlagen`,
      syncFailedDetail: (date: string | null) =>
        `lastSyncStatus: failed${date ? `, lastSyncDateTime: ${date}` : ''}.`,
      syncFailedCause:
        'Die letzte Synchronisierung der Apps mit Apple ist fehlgeschlagen. Die Dokumentation nennt für den Status „failed“ keine Ursache; ein abgelaufenes oder ungültiges Token lässt sich am Zustand des Tokens ablesen.',
      syncFailedRemediation: [
        'Im Intune Admin Center unter Mandantenverwaltung › Connectors und Token › Apple-VPP-Token das Token auswählen und „Synchronisieren“ wählen.',
        'Bleibt der Status „failed“, den Zustand des Tokens prüfen (abgelaufen oder ungültig) und es bei Bedarf erneuern.',
      ],
      externalTitle: (name: string) => `VPP-Token „${name}“: Zustand assignedToExternalMDM`,
      externalDetail: 'state: assignedToExternalMDM.',
      externalCause:
        'Intune meldet den Zustand assignedToExternalMDM. Die Dokumentation beschreibt diesen Wert nicht weiter – eine Deutung ist deshalb nicht belegt.',
      externalRemediation: [
        'Das Token im Intune Admin Center unter Mandantenverwaltung › Connectors und Token › Apple-VPP-Token ansehen und mit dem Apple Business Manager abgleichen.',
      ],
      unknownStateTitle: (name: string) => `VPP-Token „${name}“: Zustand unbekannt`,
      unknownStateDetail: 'state: unknown.',
      unknownStateCause: 'Intune meldet für das Token keinen bekannten Zustand.',
      unknownStateRemediation: [
        'Das Token im Intune Admin Center unter Mandantenverwaltung › Connectors und Token › Apple-VPP-Token prüfen.',
      ],
      overviewTitle: 'Alle VPP-Token im Überblick',
      overviewDetail: (count: number) =>
        count === 1 ? '1 Token im Mandanten.' : `${count} Token im Mandanten.`,
      overviewCause:
        'Übersicht der von Graph gemeldeten Token. Das Token selbst und die Apple-ID werden von dieser App nie gelesen.',
      overviewRemediation: [
        'Einzelheiten und Erneuerung im Intune Admin Center unter Mandantenverwaltung › Connectors und Token › Apple-VPP-Token.',
      ],
      columns: {
        name: 'Organisation',
        type: 'Art',
        expires: 'Gültig bis',
        lastSync: 'Letzte Synchronisierung',
        state: 'Zustand',
        apps: 'Apps',
      },
      types: { business: 'Business', education: 'Education' } as Record<string, string>,
      states: {
        valid: 'gültig',
        expired: 'abgelaufen',
        invalid: 'ungültig',
        assignedToExternalMDM: 'assignedToExternalMDM',
        unknown: 'unbekannt',
      } as Record<string, string>,
      syncStatuses: {
        none: 'keine',
        inProgress: 'läuft',
        completed: 'abgeschlossen',
        failed: 'fehlgeschlagen',
      } as Record<string, string>,
      unknownValue: '–',
    },
    unavailable: {
      value: (n: number) => `${n} Bereiche`,
      summary: 'Nicht über die dokumentierte v1.0-API abrufbar',
      facts: { count: 'Bereiche' },
      sourceLabel: (resource: string) => `GET /beta/${resource} (nicht abgerufen)`,
      betaOnly: (resource: string) =>
        `Nur in der Beta-API dokumentiert (${resource}). MDM Doctor liest ausschließlich v1.0-Endpunkte.`,
      cause:
        'Für diesen Bereich gibt es in der Microsoft-Dokumentation keinen v1.0-Endpunkt. MDM Doctor verwendet nur dokumentierte v1.0-Endpunkte – einzige Ausnahme ist der App-Installationsstatus – und rät deshalb nicht.',
      ade: {
        title: 'Apple-Token für die automatische Geräteregistrierung (ADE/DEP)',
        resource: 'deviceManagement/depOnboardingSettings',
        remediation: [
          'Ablauf und Synchronisierung des Tokens im Intune Admin Center unter Geräte › Registrierung › Apple › „Registrierungsprogramm-Token“ prüfen.',
        ],
      },
      android: {
        title: 'Android Enterprise (Managed Google Play)',
        resource: 'deviceManagement/androidManagedStoreAccountEnterpriseSettings',
        remediation: [
          'Verbindung und App-Synchronisierung im Intune Admin Center unter Mandantenverwaltung › Connectors und Token prüfen.',
        ],
      },
      autopilot: {
        title: 'Windows-Autopilot-Synchronisierung',
        resource: 'deviceManagement/windowsAutopilotSettings',
        remediation: [
          'Den Synchronisierungsstatus im Intune Admin Center unter Geräte › Registrierung › Windows prüfen.',
        ],
      },
      ndes: {
        title: 'Zertifikat-Connectors (NDES)',
        resource: 'deviceManagement/ndesConnectors',
        remediation: [
          'Status und letzte Verbindung der Connectors im Intune Admin Center unter Mandantenverwaltung › Connectors und Token prüfen.',
        ],
      },
    },
  },
  /** M14/S4: Kachel „Sicherheitswarnungen“ – offene Defender-for-Endpoint-Warnungen dieses Geräts */
  securityAlerts: {
    valueNone: 'Keine offenen Warnungen',
    valueOpen: (n: number) => (n === 1 ? '1 offene Warnung' : `${n} offene Warnungen`),
    summaryNone: (evaluated: number, more: boolean) =>
      `Keine offene Defender-Warnung für dieses Gerät unter ${more ? 'den neuesten ' : ''}${evaluated} Warnungen`,
    summary: (open: number, high: number, medium: number) =>
      `${open === 1 ? '1 offene Warnung' : `${open} offene Warnungen`} (${high} hoch, ${medium} mittel)`,
    facts: {
      open: 'Offene Warnungen',
      highMedium: 'Davon hoch / mittel',
      resolved: 'Behoben (ausgeblendet)',
      deviceRisk: 'Geräterisiko (Defender)',
      latest: 'Neueste Warnung',
      evaluated: 'Geprüfte Warnungen',
      evaluatedMore: (n: number) => `${n} (nur die neuesten)`,
    },
    severity: {
      high: 'Hoch',
      medium: 'Mittel',
      low: 'Niedrig',
      informational: 'Information',
      unknown: 'Unbekannt',
    } as Record<string, string>,
    status: { new: 'Neu', inProgress: 'In Bearbeitung', unknown: 'Unbekannt' } as Record<
      string,
      string
    >,
    risk: {
      none: 'keines',
      informational: 'Information',
      low: 'niedrig',
      medium: 'mittel',
      high: 'hoch',
    } as Record<string, string>,
    untitled: 'Warnung ohne Titel',
    alertDetail: (p: {
      severity: string;
      status: string;
      created: string | null;
      categories: string[];
      byName: boolean;
    }) =>
      [
        `Schweregrad: ${p.severity} · Status: ${p.status}${p.created ? ` · erzeugt ${p.created}` : ''}.`,
        p.categories.length > 0 ? `Kategorien: ${p.categories.join(', ')}.` : null,
        p.byName
          ? 'Zuordnung über den Gerätenamen (die Warnung enthält keine Entra-Geräte-ID).'
          : null,
      ]
        .filter(Boolean)
        .join(' '),
    /** Bedeutung des Schweregrads laut Microsoft Learn (Defender-for-Endpoint-Warnungsliste) */
    causeBySeverity: {
      high: 'Microsoft Defender for Endpoint stuft die Warnung als hohes Risiko ein: Solche Warnungen sind typisch für fortgeschrittene Angriffe, z. B. Diebstahl von Anmeldedaten, Ransomware-Aktivität oder Manipulation von Sicherheitssensoren.',
      medium:
        'Defender for Endpoint hat Verhalten erkannt, das zu einem fortgeschrittenen Angriff gehören kann (z. B. auffällige Registryänderung oder Ausführung verdächtiger Dateien). Es kann auch von internen Sicherheitstests stammen, erfordert laut Microsoft aber eine Untersuchung.',
      low: 'Defender for Endpoint hat eine Bedrohung durch weit verbreitete Malware oder Hacking-Werkzeuge erkannt. Das deutet laut Microsoft oft nicht auf einen gezielten Angriff hin und kann auch vom Test eines Sicherheitswerkzeugs stammen.',
      informational:
        'Defender for Endpoint meldet einen Hinweis, der nicht zwingend schädlich ist, aber das Sicherheitsbewusstsein fördern soll.',
      unknown:
        'Defender for Endpoint hat zu dieser Warnung keinen Schweregrad gemeldet. Was erkannt wurde, steht in der Warnung im Defender-Portal.',
    } as Record<string, string>,
    remediation: [
      'Warnung im Defender-Portal öffnen (Link) und dort Warnungsverlauf, betroffene Objekte und Untersuchungsstatus prüfen.',
      'Bearbeitung (Zuweisung, Klassifizierung, Behebung) erfolgt im Defender-Portal durch das Security-Team – MDM Doctor ändert nichts.',
      'Nach der Behebung der Warnung im Defender-Portal verschwindet sie hier (behobene Warnungen werden ausgeblendet).',
    ],
    moreTitle: (n: number) =>
      n === 1 ? '1 weitere offene Warnung' : `${n} weitere offene Warnungen`,
    moreDetail: (shown: number) =>
      `Angezeigt werden die ${shown} schwerwiegendsten bzw. neuesten offenen Warnungen.`,
    moreCause: 'Die Kachel zeigt aus Platzgründen nur eine begrenzte Zahl einzelner Warnungen.',
    moreRemediation: [
      'Alle Warnungen des Geräts im Defender-Portal unter „Investigation & response › Incidents & alerts › Alerts“ ansehen.',
    ],
    partialTitle: 'Nur die neuesten Warnungen geprüft',
    partialDetail: (evaluated: number) =>
      `Gelesen wurden die neuesten ${evaluated} Defender-for-Endpoint-Warnungen des Mandanten; weitere Seiten wurden nicht gelesen.`,
    partialCause:
      'Graph liefert die Warnungen seitenweise (neueste zuerst). Für ein Gerät lässt sich laut Dokumentation nicht filtern, deshalb liest MDM Doctor höchstens drei Seiten à 100 Warnungen und ordnet sie clientseitig zu.',
    partialRemediation: [
      'Ältere Warnungen dieses Geräts auf der Geräteseite im Defender-Portal („Incidents and alerts“) prüfen.',
    ],
    noneTitle: 'Keine offene Warnung für dieses Gerät',
    noneDetail: (evaluated: number, more: boolean, resolved: number) =>
      `Unter ${more ? 'den neuesten ' : ''}${evaluated} Defender-for-Endpoint-Warnungen des Mandanten gehört keine offene zu diesem Gerät${resolved > 0 ? ` (${resolved} behobene ausgeblendet)` : ''}.`,
    noneCause:
      'Für dieses Gerät ist unter den gelesenen Warnungen keine offene vorhanden. Das schließt nicht aus, dass es ältere Warnungen gibt oder andere Dienste (z. B. Defender for Identity) Warnungen zum Gerät führen – gelesen werden nur Warnungen von Defender for Endpoint.',
    noneRemediation: [
      'Keine Aktion nötig. Weitere Warnungen und Vorfälle zum Gerät im Defender-Portal ansehen.',
    ],
  },
  /** M14/S3: Kachel „Registrierung (Benutzer)“ – Lizenz und Gerätelimit des primären Benutzers */
  registration: {
    valueLicenseOk: 'Lizenz vorhanden',
    valueNoLicense: 'Keine Intune-Lizenz',
    valueLimit: 'Gerätelimit prüfen',
    summary: (license: string, devices: string | null) =>
      devices ? `${license} · ${devices}` : license,
    summaryLicenseOk: 'Intune-Lizenz aktiv',
    summaryLicenseMissing: 'Kein aktiver Intune-Lizenzplan',
    summaryLicenseUnknown: 'Lizenz nicht auswertbar',
    summaryDevices: (n: number) =>
      n === 1 ? '1 Gerät des Benutzers' : `${n} Geräte des Benutzers`,
    facts: {
      licenses: 'Lizenzen des Benutzers',
      plans: 'Intune-Serviceplan',
      noPlan: 'keiner',
      devices: 'Geräte des Benutzers in Intune',
      devicesNote: 'erste Seite der Abfrage, inkl. dieses Geräts',
      limitConfigs: 'Gerätelimit-Konfigurationen',
      smallestLimit: 'Kleinstes Limit',
    },
    planStatus: {
      Success: 'aktiv',
      Disabled: 'deaktiviert',
      Error: 'Fehler',
      PendingInput: 'wartet auf Bestätigung des Dienstes',
      PendingActivation: 'Aktivierung durch einen Administrator ausstehend',
      PendingProvisioning: 'Bereitstellung ausstehend',
    } as Record<string, string>,
    planStatusUnknown: 'Status unbekannt',
    mdmO365Name: 'Mobile Device Management for Office 365',
    noLicenseTitle: 'Kein aktiver Intune-Lizenzplan',
    noLicenseDetailNone: (count: number) =>
      count === 0
        ? 'Dem primären Benutzer ist keine Lizenz zugewiesen.'
        : `Dem primären Benutzer sind ${count === 1 ? '1 Lizenz' : `${count} Lizenzen`} zugewiesen, aber keine enthält einen Intune-Serviceplan (INTUNE_A, INTUNE_A_VL oder INTUNE_EDU).`,
    noLicenseDetailInactive: (plans: string) =>
      `Der Benutzer hat Intune-Serviceplans, aber keiner ist aktiv: ${plans}.`,
    noLicenseCause:
      'Laut Microsoft kann ein Gerät nicht registriert werden, wenn dem Benutzer die nötige Lizenz fehlt oder er einen falschen Lizenztyp für die MDM-Instanz hat. Das Gerät erscheint hier zwar verwaltet – für neue Registrierungen und die weitere Verwaltung braucht der Benutzer jedoch eine Lizenz.',
    noLicenseRemediation: [
      'Im Microsoft 365 Admin Center oder Entra Admin Center prüfen, ob dem Benutzer eine Lizenz mit Intune-Plan zugewiesen ist (direkt oder über eine Lizenzgruppe).',
      'Bei gruppenbasierter Lizenzierung den Lizenzstatus der Gruppe auf Fehler prüfen.',
      'Nach der Zuweisung kann es etwas dauern, bis der Plan den Status „aktiv“ meldet; danach „Erneut laden“.',
    ],
    mdmO365Title: 'Nur „Mobile Device Management for Office 365“ zugewiesen',
    mdmO365Detail: (status: string) =>
      `Der Serviceplan INTUNE_O365 („Mobile Device Management for Office 365“) ist zugewiesen, Status: ${status}. Er wird hier nicht als Intune-Plan gewertet.`,
    mdmO365Cause:
      'Laut Microsoft erfordert dieser Plan eine ausdrückliche Aktivierung durch einen Administrator („Aktivierung ausstehend“), bevor er bereitgestellt ist.',
    mdmO365Remediation: [
      'Prüfen, ob für den Mandanten Intune oder die MDM-Funktion von Microsoft 365 als Verwaltung vorgesehen ist, und dem Benutzer entsprechend die passende Lizenz zuweisen.',
    ],
    limitsTitle: 'Gerätelimit-Konfigurationen',
    limitsDetail: (count: number) =>
      count === 0
        ? 'Im Mandanten ist keine Gerätelimit-Konfiguration lesbar.'
        : `Der Mandant hat ${count === 1 ? '1 Gerätelimit-Konfiguration' : `${count} Gerätelimit-Konfigurationen`}. Welche für diesen Benutzer gilt, ist nicht sicher bestimmbar: Benutzergruppen werden nicht gelesen. Laut Microsoft unterliegt ein Benutzer nur der Konfiguration mit dem niedrigsten Prioritätswert, der er zugewiesen ist.`,
    limitsOmitted: (n: number) =>
      `${n === 1 ? '1 weitere Konfiguration wurde' : `${n} weitere Konfigurationen wurden`} nicht gelesen (höchstens 10).`,
    limitsCause:
      'Das Intune-Gerätelimit begrenzt, wie viele Geräte ein Benutzer registrieren darf. Es gilt laut Microsoft nicht für Co-Management, Registrierung per Gruppenrichtlinie, Microsoft-Entra-Join (auch Massenregistrierung), Windows Autopilot und Geräteregistrierungs-Manager; dafür lässt sich in Microsoft Entra ID ein hartes Limit setzen (Geräteeinstellungen).',
    limitsRemediation: [
      'Im Intune Admin Center unter „Geräte › Registrierungseinschränkungen › Gerätelimit-Einschränkungen“ prüfen, welche Konfiguration dem Benutzer zugewiesen ist.',
      'Unter „Benutzer › Alle Benutzer › Benutzer › Geräte“ die Zahl der registrierten Geräte des Benutzers ansehen.',
    ],
    columns: { name: 'Name', priority: 'Priorität', limit: 'Limit', targets: 'Ziele' },
    unknownValue: '–',
    targetAllUsers: 'Alle Benutzer',
    targetAllDevices: 'Alle Geräte',
    targetGroup: (id: string) => `Gruppe ${id}`,
    targetExcluded: (id: string) => `ausgenommen: Gruppe ${id}`,
    targetUnknown: 'unbekannter Zieltyp',
    targetsUnreadable: 'Ziele nicht lesbar',
    targetsNone: 'keine Zuweisung',
    limitReachedTitle: 'Geräteanzahl erreicht das kleinste konfigurierte Limit',
    limitReachedDetail: (devices: number, limit: number) =>
      `Der Benutzer hat ${devices === 1 ? '1 Gerät' : `${devices} Geräte`} in Intune (erste Seite der Abfrage, inkl. dieses Geräts); das kleinste konfigurierte Gerätelimit beträgt ${limit}.`,
    limitReachedCause:
      'Laut Microsoft zeigt der Fehler „DeviceCapReached“ an, dass ein Benutzer mehr Geräte registrieren will, als das Gerätelimit erlaubt; entspricht die Zahl der registrierten Geräte dem Limit, sind keine weiteren Registrierungen möglich. Ob dieses Limit für den Benutzer gilt, hängt von seiner Zuweisung ab (siehe Tabelle) und davon, ob die Registrierungsart vom Limit ausgenommen ist.',
    limitReachedRemediation: [
      'Prüfen, welche Limit-Konfiguration dem Benutzer zugewiesen ist (Priorität beachten) und wie viele Geräte der Benutzer unter „Benutzer › Geräte“ hat.',
      'Veraltete Geräteeinträge des Benutzers bereinigen oder das Limit unter „Registrierungseinschränkungen“ anpassen – MDM Doctor ändert nichts.',
    ],
  },
  /** M14/S2: Zuweisungen – „Warum gilt diese Richtlinie / diese App?“ (Richtlinien- und Apps-Kachel) */
  assignments: {
    factChecked: 'Zuweisungen geprüft',
    factCheckedValue: (done: number, total: number) => `${done} von ${total}`,
    policiesTitle: 'Zuweisungen: Warum gelten diese Richtlinien?',
    appsTitle: 'Zuweisungen: Warum ist diese App zugewiesen?',
    policiesDetail: (count: number) =>
      `Zuweisungsziele von ${count === 1 ? '1 Richtlinie bzw. einem Profil' : `${count} Richtlinien und Profilen`}, abgeglichen mit den Gruppen, in denen dieses Gerät Mitglied ist.`,
    appsDetail: (count: number) =>
      `Zuweisungsziele von ${count === 1 ? '1 App' : `${count} Apps`}, abgeglichen mit den Gruppen, in denen dieses Gerät Mitglied ist.`,
    cause:
      'Laut Microsoft hat ein Ausschluss Vorrang vor einem Einschluss, wenn beide dieselbe Gruppenart betreffen (Geräte- oder Benutzergruppen). Intune verknüpft Benutzer- und Gerätegruppen dabei nicht: Ein Ausschluss über eine Gerätegruppe greift nicht für Zuweisungen an Benutzergruppen.',
    remediation: [
      'Zeile mit der gewünschten Richtlinie bzw. App suchen und die Spalte „Zuweisung“ lesen: Sie nennt die Gerätegruppe, über die das Gerät das Ziel erreicht.',
      'Fehlt die erwartete Gruppe, die Mitgliedschaft des Geräts im Microsoft Entra Admin Center prüfen (dynamische Gerätegruppen werden zeitverzögert berechnet).',
      '„Vermutlich Benutzergruppe“ heißt: Das Gerät ist nicht Mitglied dieser Gruppe. Gehört die Gruppe dem primären Benutzer, im Entra Admin Center nachsehen – MDM Doctor liest Benutzergruppen nicht.',
    ],
    unavailableNote:
      'Über die dokumentierte v1.0-Schnittstelle nicht verfügbar: Zuweisungsfilter und die Zuweisungen von Settings-Catalog-Richtlinien (nur in der Beta-Schnittstelle). Beides im Intune Admin Center prüfen.',
    skippedNote: (n: number) =>
      `${n === 1 ? '1 weiteres Objekt wurde' : `${n} weitere Objekte wurden`} nicht abgefragt (höchstens 30 Abrufe je Gerät).`,
    columns: { name: 'Name', kind: 'Art', assignment: 'Zuweisung' },
    kinds: { compliance: 'Compliance', configuration: 'Profil', app: 'App' },
    intents: {
      available: 'verfügbar',
      required: 'erforderlich',
      uninstall: 'deinstallieren',
      availableWithoutEnrollment: 'verfügbar ohne Registrierung',
    },
    viaDeviceGroup: (name: string) => `zugewiesen über Gerätegruppe „${name}“`,
    excludedViaDeviceGroup: (name: string) => `ausgeschlossen über Gerätegruppe „${name}“`,
    allDevices: 'zugewiesen an „Alle Geräte“',
    allUsers: 'zugewiesen an „Alle Benutzer“',
    groupNoMembership:
      'Gruppe ohne Mitgliedschaft des Geräts – vermutlich Benutzergruppe (Benutzergruppen werden nicht gelesen)',
    groupNoMembershipHidden:
      'Gruppe ohne bekannte Mitgliedschaft des Geräts – vermutlich Benutzergruppe oder eine Gerätegruppe, deren Name nicht lesbar ist',
    exclusionNoMembership: 'Ausschluss einer Gruppe ohne Mitgliedschaft des Geräts',
    groupUnchecked: 'Gruppe (Mitgliedschaft des Geräts nicht prüfbar)',
    exclusionUnchecked: 'Ausschluss einer Gruppe (Mitgliedschaft des Geräts nicht prüfbar)',
    unknownTarget: 'unbekannter Zieltyp',
    noAssignments: 'keine Zuweisung gefunden',
    notFound:
      'nicht auswertbar – Graph kennt unter der ID des Gerätezustands kein Objekt dieses Typs (HTTP 404)',
    notEvaluable: 'nicht auswertbar – die ID des Gerätezustands ist keine Objekt-ID',
    error: 'nicht auswertbar – der Abruf ist fehlgeschlagen',
    excludedTitle: (name: string) =>
      `„${name}“: Ausschluss über Gerätegruppe, Zustand nicht „Nicht zutreffend“`,
    excludedDetail: (groupName: string, state: string) =>
      `Die Zuweisung schließt die Gerätegruppe „${groupName}“ aus, in der dieses Gerät Mitglied ist. Der gemeldete Zustand lautet trotzdem „${state}“ statt „Nicht zutreffend“.`,
    excludedCause:
      'Laut Microsoft hat ein Ausschluss bei gleicher Gruppenart Vorrang. Dass das Gerät trotzdem einen anderen Zustand meldet, kann an einer weiteren Zuweisung liegen, die das Gerät über eine Benutzergruppe erreicht (Benutzer- und Gerätegruppen werden nicht verknüpft), oder an einer dynamischen Gerätegruppe, deren Mitgliedschaft verzögert berechnet wird.',
    excludedRemediation: [
      'Alle Zuweisungen des Objekts im Intune Admin Center ansehen und prüfen, ob das Gerät das Ziel zusätzlich über eine Benutzergruppe oder „Alle Benutzer“ erreicht.',
      'Bei einer dynamischen Ausschlussgruppe: Zeitpunkt der Aufnahme des Geräts in die Gruppe mit dem Zeitpunkt der Zuweisung vergleichen.',
    ],
    stateLabels: {
      policy: {
        unknown: 'Unbekannt',
        notApplicable: 'Nicht zutreffend',
        compliant: 'Konform',
        remediated: 'Behoben',
        nonCompliant: 'Nicht konform',
        error: 'Fehler',
        conflict: 'Konflikt',
        notAssigned: 'Nicht zugewiesen',
      } as Record<string, string>,
      app: {
        installed: 'Installiert',
        failed: 'Fehlgeschlagen',
        notInstalled: 'Nicht installiert',
        uninstallFailed: 'Deinstallation fehlgeschlagen',
        pendingInstall: 'Ausstehend',
        unknown: 'Unbekannt',
        notApplicable: 'Nicht zutreffend',
      } as Record<string, string>,
    },
  },
  /** M14/S1: gleichnamige Entra-Objekte (Befund in „Gerätestatus“) */
  duplicates: {
    factCount: 'Entra-Objekte mit gleichem Namen',
    factSameNameOtherOs: 'Gleichnamig, anderes Betriebssystem',
    factMore: 'Weitere Seiten',
    factMoreValue: 'nicht gelesen (nur die erste Seite)',
    valueDualState: 'Dual State in Entra',
    dualStateTitle: 'Dual State: hybrid joined und registriert',
    duplicateTitle: 'Mehrere Entra-Objekte mit demselben Gerätenamen',
    detail: (count: number, types: string) =>
      `In Microsoft Entra ID gibt es ${count} Geräteobjekte mit diesem Namen (${types}). Das aktuelle Objekt ist in der Tabelle markiert.`,
    dualStateDetail: (count: number) =>
      `In Microsoft Entra ID gibt es ${count} Geräteobjekte mit diesem Namen, darunter eines „hybrid joined“ (ServerAd) und eines „registriert“ (Workplace). Das aktuelle Objekt ist in der Tabelle markiert.`,
    moreNote:
      'Es wurden nur die ersten Treffer gelesen; weitere gleichnamige Objekte sind möglich.',
    dualStateCause:
      'Wenn Benutzer auf einem domänenbeigetretenen Gerät „Konto zu Windows hinzufügen“ bestätigen, wird das Gerät zusätzlich in Microsoft Entra ID registriert. Nach dem Hybrid-Join existieren dann zwei Zustände desselben Geräts. Laut Microsoft hat der Hybrid-Join meist Vorrang; manchmal führt dieser Dual State aber zu einer nichtdeterministischen Auswertung des Geräts und zu Zugriffsproblemen.',
    dualStateRemediation: [
      'Windows-Version des Geräts prüfen: Ab Windows 10 1803 bereinigt Windows den registrierten Zustand automatisch, sobald sich der betreffende Domänenbenutzer am hybrid-joined Gerät anmeldet (bei mehreren Benutzern je Benutzer einzeln).',
      'Am Gerät `dsregcmd /status` ausführen und prüfen, ob der registrierte Zustand noch besteht; lokale Konten werden nicht automatisch bereinigt.',
      'Das Objekt wird in Entra nicht sofort gelöscht, wenn es von Intune verwaltet wird. Vor einem manuellen Entfernen des registrierten Zustands beachten: Laut Microsoft meldet Windows 10 das Gerät dann bei Intune ab, wenn die Registrierung über die automatische Registrierung der Entra-Registrierung erfolgte.',
      'Vorgehen zum Vermeiden und Bereinigen des Dual State: Abschnitt „Review things you should know“ der Hybrid-Join-Planung (Link unten).',
    ],
    duplicateCause:
      'Laut Microsoft entstehen doppelte Geräteeinträge z. B. durch wiederholtes Trennen und erneutes Beitreten desselben Geräts, durch „Geschäfts- oder Schulkonto hinzufügen“ (jeder Windows-Benutzer erzeugt einen neuen Eintrag mit demselben Namen) oder wenn ein Entra-joined Gerät zurückgesetzt, neu installiert und unter demselben Namen erneut beigetreten ist.',
    duplicateRemediation: [
      'Das aktuelle Objekt (Spalte „Hinweis“) mit den übrigen vergleichen: Join-Typ, letzte Anmeldung und Registrierungsdatum zeigen, welche Einträge nicht mehr genutzt werden.',
      'Veraltete Objekte im Microsoft Entra Admin Center unter „Geräte“ prüfen und nach Rücksprache bereinigen (erfordert z. B. die Rolle Cloud Device Administrator). MDM Doctor ändert nichts.',
      'Nach dem Aufräumen am Gerät `dsregcmd /status` ausführen, um den Join-Zustand zu bestätigen.',
    ],
    sameNameOtherOsTitle: 'Gleichnamiges Entra-Objekt mit anderem Betriebssystem',
    sameNameOtherOsDetail: (count: number) =>
      count === 1
        ? 'Ein weiteres Entra-Objekt trägt denselben Namen, gehört aber zu einem anderen Betriebssystem. Es wird nicht als Duplikat gewertet.'
        : `${count} weitere Entra-Objekte tragen denselben Namen, gehören aber zu einem anderen Betriebssystem. Sie werden nicht als Duplikate gewertet.`,
    sameNameOtherOsCause:
      'Verschiedene Geräte (z. B. ein Mobilgerät und ein Laptop) können denselben Anzeigenamen haben. Der Name allein identifiziert ein Gerät in Entra nicht eindeutig.',
    sameNameOtherOsRemediation: [
      'Nur falls es sich um dasselbe Gerät handeln sollte: Objekt anhand der Spalten „Join-Typ“ und „Registriert am“ im Microsoft Entra Admin Center prüfen.',
    ],
    columns: {
      trustType: 'Join-Typ',
      enabled: 'Aktiviert',
      lastSignIn: 'Letzte Anmeldung (ca.)',
      compliant: 'Konform',
      registered: 'Registriert am',
      note: 'Hinweis',
    },
    linkHybridJoin: 'Dual State bereinigen (Microsoft Learn)',
    noteCurrent: 'aktuelles Objekt',
    noteOtherOs: 'gleichnamig, anderes Betriebssystem',
    yes: 'ja',
    no: 'nein',
    unknown: '–',
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
    valueCertExpired: 'MDM-Zertifikat abgelaufen',
    valueCertExpiring: 'MDM-Zertifikat läuft ab',
    certExpiredTitle: 'MDM-Gerätezertifikat abgelaufen',
    certExpiringTitle: (relative: string) => `MDM-Gerätezertifikat läuft ${relative} ab`,
    certDetail: (date: string) => `managementCertificateExpirationDate: ${date}.`,
    certCause:
      'Das MDM-Zertifikat gilt ein Jahr ab Registrierung und wird jährlich automatisch erneuert. Checkt das Gerät vor Ablauf nicht ein, kann es danach nicht mehr beim Dienst einchecken; 180 Tage nach Ablauf wird es automatisch entfernt.',
    certRemediation: [
      'Gerät vor Ablauf einschalten, mit dem Internet verbinden und synchronisieren lassen, damit es eincheckt.',
      'Ist das Zertifikat bereits abgelaufen, kann das Gerät nicht mehr einchecken – Vorgehen mit dem Gerätenutzer klären.',
    ],
    valueApnsExpired: 'Apple-Push-Zertifikat abgelaufen',
    valueApnsExpiring: 'Apple-Push-Zertifikat läuft ab',
    apnsExpiredTitle: 'Apple-MDM-Push-Zertifikat des Mandanten abgelaufen',
    apnsExpiringTitle: (relative: string) =>
      `Apple-MDM-Push-Zertifikat des Mandanten läuft ${relative} ab`,
    apnsDetail: (date: string) => `applePushNotificationCertificate.expirationDateTime: ${date}.`,
    apnsCause:
      'Das Apple-MDM-Push-Zertifikat ist 365 Tage gültig und muss jährlich erneuert werden, damit iOS/iPadOS- und macOS-Geräte verwaltet werden können. Nach Ablauf bleibt eine Kulanzfrist von 30 Tagen für die Erneuerung.',
    apnsRemediation: [
      'Im Intune Admin Center unter Geräte › Geräteonboarding › Registrierung › Apple › „Apple MDM Push Certificate“ das Zertifikat erneuern.',
      'Mit derselben Apple-ID erneuern, mit der es erstellt wurde – im Apple Push Certificates Portal beim vorhandenen Zertifikat „Renew“ wählen.',
    ],
    notSupervisedTitle: 'iOS/iPadOS-Gerät ist nicht beaufsichtigt',
    notSupervisedDetail: 'isSupervised: false.',
    notSupervisedCause:
      'Beaufsichtigung (supervised mode) gibt mehr Verwaltungsoptionen; bestimmte Einschränkungen, z. B. für AirDrop, setzen sie voraus. Intune aktiviert sie über die automatische Geräteregistrierung (ADE).',
    notSupervisedRemediation: [
      'Prüfen, ob das Gerät firmeneigen ist und über ADE registriert werden sollte.',
      'Nachträglich lässt sich Beaufsichtigung nur über Apple Configurator aktivieren (setzt das Gerät zurück).',
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
    summaryPolicies: (bad: number, total: number, stale = false) =>
      bad === 0
        ? `${total} ${total === 1 ? 'Richtlinie' : 'Richtlinien'} · alle konform`
        : stale
          ? `${bad} von ${total} Richtlinien mit abweichendem Status`
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
    warnDetail: (date: string, days: number) =>
      `lastSyncDateTime: ${date} – seit ${days} Tagen kein Check-in (mehr als 7 Tage).`,
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
    summaryPatch: (date: string) => `Sicherheitspatch ${date}`,
    patchOldTitle: (days: number) => `Android-Sicherheitspatch ist ${days} Tage alt`,
    patchOldDetail: (level: string, limit: number) =>
      `androidSecurityPatchLevel: ${level} – älter als ${limit} Tage.`,
    patchOldCause:
      'Android-Geräte können monatliche Sicherheitspatches erhalten; die Auslieferung hängt von Hersteller bzw. Mobilfunkanbieter ab. Über die Compliance-Einstellung „Mindest-Sicherheitspatchlevel“ kann Intune Geräte mit älterem Patchstand als nicht konform markieren.',
    patchOldRemediation: [
      'Am Gerät nach verfügbaren Systemupdates suchen und sie installieren.',
      'Prüfen, ob Hersteller bzw. Mobilfunkanbieter für das Modell noch Sicherheitspatches ausliefern.',
    ],
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
  apps: {
    valueOk: 'Alle installiert',
    valueNone: 'Keine zugewiesen',
    valueFailed: (n: number) => `${n} fehlgeschlagen`,
    valueMissing: (n: number) => `${n} nicht installiert`,
    summary: (installed: number, required: number, available: number) =>
      [
        required > 0 ? `${installed} von ${required} Pflicht-Apps installiert` : null,
        available > 0 ? `${available} verfügbar` : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'Keine Pflicht-Apps zugewiesen',
    failedTitle: (name: string) => `App „${name}“: Installation fehlgeschlagen`,
    uninstallFailedTitle: (name: string) => `App „${name}“: Deinstallation fehlgeschlagen`,
    missingTitle: (name: string) => `Pflicht-App „${name}“ nicht installiert`,
    pendingTitle: (name: string) => `App „${name}“: Installation ausstehend`,
    detail: (state: string, intent: string, version: string | null) =>
      `Installationsstatus ${state}, Zuweisung ${intent}${version ? `, Version ${version}` : ''}.`,
    failedCause:
      'Intune meldet für diese App auf dem Gerät „fehlgeschlagen“. Den Fehlercode liefert diese Schnittstelle nicht; er steht im Intune Admin Center unter „Managed Apps“ des Geräts.',
    uninstallFailedCause:
      'Die App ist zur Deinstallation zugewiesen, die Deinstallation auf dem Gerät ist aber fehlgeschlagen.',
    missingCause:
      'Die App ist als erforderlich zugewiesen, laut Intune aber nicht auf dem Gerät installiert.',
    pendingCause:
      'Die Installation ist angestoßen, aber noch nicht abgeschlossen – z. B. weil das Gerät noch nicht eingecheckt hat oder die Installation auf die Anmeldung des Benutzers wartet.',
    remediation: [
      'Im Intune Admin Center unter „Problembehandlung und Support“ den Benutzer und das Gerät wählen und unter „Managed Apps“ die Installationsdetails der App mit Fehlercode ansehen.',
      'Für eine erforderliche App das Gerät synchronisieren lassen; Intune versucht die Installation dann erneut.',
      'Für Win32-Apps zusätzlich das DiagLogs-ZIP („Diagnosedaten sammeln“) hier analysieren – es enthält Fehlercode und Logs der Intune Management Extension.',
    ],
    pendingRemediation: [
      'Gerät synchronisieren lassen und nach dem nächsten Check-in erneut prüfen.',
    ],
    betaTitle: 'Datenquelle: Microsoft Graph beta',
    betaDetail:
      'Der App-Status stammt aus der Beta-Schnittstelle mobileAppIntentAndStates (pro primärem Benutzer). Für v1.0 gibt es keinen gerätebezogenen App-Status.',
    betaCause:
      'Microsoft unterstützt Intune-Beta-APIs, sie können sich aber häufiger ändern. Apps anderer Benutzer des Geräts sind nicht enthalten.',
    betaRemediation: [
      'Bei Abweichungen den App-Status im Intune Admin Center unter „Problembehandlung und Support“ › Benutzer › Gerät › „Managed Apps“ prüfen.',
    ],
    intent: {
      available: 'verfügbar',
      notAvailable: 'nicht verfügbar',
      requiredInstall: 'erforderlich',
      requiredUninstall: 'Deinstallation erforderlich',
      requiredAndAvailableInstall: 'erforderlich und verfügbar',
      availableInstallWithoutEnrollment: 'verfügbar ohne Registrierung',
      exclude: 'ausgeschlossen',
    } as Record<string, string>,
    state: {
      installed: 'installiert',
      failed: 'fehlgeschlagen',
      notInstalled: 'nicht installiert',
      uninstallFailed: 'Deinstallation fehlgeschlagen',
      pendingInstall: 'ausstehend',
      unknown: 'unbekannt',
      notApplicable: 'nicht anwendbar',
    } as Record<string, string>,
    unknownIntent: 'unbekannt',
  },
  /** M10: Kachel „Anmeldungen“ (Entra-Anmeldeprotokoll, Conditional Access) */
  signIns: {
    valueFailures: (n: number) => (n === 1 ? '1 CA-Fehler' : `${n} CA-Fehler`),
    valueOk: 'Keine CA-Fehler',
    valueNone: 'Keine Anmeldungen',
    summary: (count: number, days: number) =>
      `${count === 1 ? '1 Anmeldung' : `${count} Anmeldungen`} dieses Geräts in ${days} Tagen`,
    summaryNone: (days: number) =>
      `Keine Anmeldung dieses Geräts in den letzten ${days} Tagen gefunden`,
    facts: {
      deviceCount: (days: number) => `Anmeldungen dieses Geräts (${days} Tage)`,
      failures: 'Mit Conditional-Access-Fehler',
      last: 'Letzte Anmeldung',
      userCount: 'Ausgewertete Anmeldungen des Benutzers',
      userCountMore: (n: number) => `${n} (nur die neuesten)`,
      policyDetails: 'Richtliniendetails',
      policyVisible: 'sichtbar',
      policyHidden: 'nicht sichtbar (Rolle)',
    },
    failureTitle: (app: string, count: number) =>
      count === 1
        ? `Conditional-Access-Fehler bei „${app}“`
        : `${count}× Conditional-Access-Fehler bei „${app}“`,
    failureDetail: (p: {
      when: string;
      resource: string | null;
      app: string;
      client: string | null;
    }) =>
      `Zuletzt ${p.when}: Anmeldung mit „${p.app}“${p.resource ? ` an „${p.resource}“` : ''}${p.client ? ` (Client: ${p.client})` : ''} – conditionalAccessStatus: failure.`,
    failedPolicies: (names: string) => `Fehlgeschlagene Richtlinie(n): ${names}.`,
    failedPoliciesNone:
      'Graph nennt zu diesem Eintrag keine als „failure“ ausgewertete Richtlinie.',
    policiesHiddenShort: 'Richtliniendetails nicht sichtbar (Rolle).',
    errorLine: (code: number, name: string | null, reason: string | null) =>
      `Fehlercode ${code}${name ? ` (${name})` : ''}${reason ? `: ${reason}` : ''}.`,
    unknownCode: (code: number) =>
      `Unbekannter Code ${code} (AADSTS${code}) – keine Deutung belegt.`,
    failureCause:
      'Eine Conditional-Access-Richtlinie hat diese Anmeldung nicht zugelassen bzw. ihre Zugriffssteuerung als nicht erfüllt ausgewertet (conditionalAccessStatus: failure).',
    hiddenTitle: 'Richtliniendetails nicht sichtbar (Rolle)',
    hiddenDetail:
      'Die Anmeldeeinträge enthalten kein Feld appliedConditionalAccessPolicies. Graph lässt es ohne Leserecht auf Conditional-Access-Daten weg – ohne Fehlermeldung.',
    hiddenCause:
      'Das angemeldete Konto darf Anmeldeprotokolle lesen, aber keine Conditional-Access-Daten. Welche Richtlinie die Anmeldung abgewiesen hat, lässt sich deshalb hier nicht anzeigen.',
    hiddenRemediation: [
      'Mit einem Konto mit einer der Rollen Global Reader, Security Reader, Security Administrator oder Conditional Access Administrator erneut prüfen – Microsoft nennt sie als Rollen mit Zugriff auf die Conditional-Access-Daten im Anmeldeprotokoll.',
      'Alternativ den Eintrag im Entra Admin Center unter Entra ID › Überwachung & Integrität › Anmeldeprotokolle über die Korrelations-ID öffnen.',
    ],
    noneTitle: 'Keine Anmeldungen dieses Geräts gefunden',
    noneDetail: (days: number, total: number, more: boolean) =>
      `Unter ${more ? 'den neuesten ' : ''}${total} Anmeldungen des primären Benutzers der letzten ${days} Tage gehört keine zu diesem Gerät${more ? ' (weitere Seiten wurden nicht gelesen)' : ''}.`,
    noneCause:
      'Das Anmeldeprotokoll enthält laut Microsoft nur interaktive und erfolgreiche föderierte Anmeldungen; die Geräte-ID ist nur für in Microsoft Entra registrierte Geräte gefüllt. Meldet sich niemand am Gerät an, ist das kein Fehler.',
    noneRemediation: [
      'Bei Verdacht auf Anmeldeprobleme im Entra Admin Center unter Anmeldeprotokolle nach Benutzer und Gerät filtern.',
      'Zeitraum und Anmeldetyp (interaktiv/nicht interaktiv) im Portal ausweiten – diese App liest nur die neuesten interaktiven Einträge.',
    ],
    mismatchTitle: 'Anmeldung als „nicht konform“ erfasst, Intune meldet „konform“',
    mismatchDetail: (when: string) =>
      `Im Anmeldeeintrag vom ${when} steht deviceDetail.isCompliant = false, Intune meldet das Gerät aktuell als konform.`,
    mismatchCause:
      'Der Anmeldeeintrag hält die Geräteangaben fest, die bei dieser Anmeldung erhoben wurden. Der Compliance-Status des Geräts kann sich seitdem geändert haben.',
    mismatchRemediation: [
      'Zeitpunkt der Anmeldung mit dem letzten Check-in und der letzten Compliance-Auswertung vergleichen.',
      'Tritt der Widerspruch bei neuen Anmeldungen weiter auf: den Anmeldeeintrag (Korrelations-ID) im Entra Admin Center öffnen und auf dem Tab „Geräteinfo“ prüfen, welches Gerät erkannt wurde.',
    ],
  },
  /** M10: Kachel „Integritätsnachweis“ (Device Health Attestation, Rohwerte) */
  attestation: {
    valueData: 'Daten vorhanden',
    valueMismatch: 'Abweichung gemeldet',
    valueNone: 'Keine Daten',
    summaryData: 'Rohwerte der Device Health Attestation',
    summaryNone: 'Graph liefert keine Attestierungsdaten',
    facts: {
      secureBoot: 'Secure Boot',
      bitLockerStatus: 'BitLocker-Status',
      codeIntegrity: 'Code Integrity',
      elam: 'Early Launch Antimalware (ELAM)',
      bootDebugging: 'Boot-Debugging',
      testSigning: 'Test Signing',
      tpmVersion: 'TPM-Version',
      lastUpdate: 'Letzte Aktualisierung (Rohwert)',
      issued: 'Ausgestellt',
      supported: 'DHA-Unterstützung',
      mismatch: 'Integritätsabweichung',
      note: 'Hinweis',
      noteValue: 'Rohwerte laut Graph – Microsoft dokumentiert dafür keine Bedeutung',
    },
    mismatchTitle: 'Integritätsabweichung gemeldet',
    mismatchDetail: (value: string) =>
      `Der DHA-Dienst meldet healthStatusMismatchInfo: „${value}“.`,
    mismatchCause:
      'Laut Ressourcenbeschreibung erscheint dieses Attribut, wenn der DHA-Dienst ein Integritätsproblem erkennt. Welches Problem gemeint ist, beschreibt die Dokumentation nicht – der Wert wird unverändert angezeigt.',
    mismatchRemediation: [
      'Die Rohwerte dieser Kachel (Secure Boot, BitLocker-Status, Code Integrity, ELAM …) mit dem tatsächlichen Gerätezustand vergleichen, z. B. mit den Kacheln „BitLocker“ und „Defender“.',
      'Zeitpunkte der letzten Aktualisierung und Ausstellung prüfen – die Werte zeigen den Stand der letzten Auswertung.',
      'Werte nicht ohne Dokumentation deuten – Microsoft beschreibt für die meisten Felder keine möglichen Werte.',
    ],
    noneTitle: 'Keine Attestierungsdaten',
    noneDetail: 'Das Feld deviceHealthAttestationState enthält keine Werte für dieses Gerät.',
    noneCause:
      'Graph liefert für dieses Gerät keine Werte; Microsoft nennt dazu keine Ursache. Das Feld healthAttestationSupportedStatus zeigt laut Ressourcenbeschreibung, ob DHA für das Gerät unterstützt wird.',
    noneRemediation: ['Prüfen, ob das Gerät kürzlich eingecheckt hat (Kachel „Letzter Check-in“).'],
  },
  /** M10: Kachel „Gruppen“ (Entra-Gruppen des Geräts, informativ) */
  groups: {
    value: (n: number) => (n === 1 ? '1 Gruppe' : `${n} Gruppen`),
    valueNone: 'Keine Gruppen',
    summary: 'Mitgliedschaften des Geräts in Entra (direkt und verschachtelt)',
    facts: {
      count: 'Gruppen des Geräts',
      hidden: 'Ausgeblendet (keine Berechtigung)',
      more: 'Weitere Gruppen',
      moreValue: 'nicht gelesen (nur die ersten Seiten)',
      scope: 'Nicht enthalten',
      scopeValue: 'Gruppen des Benutzers (anderer Scope nötig)',
    },
    maxListed: 30,
    moreListed: (n: number) => `${n} weitere`,
    hiddenTitle: 'Einige Gruppennamen sind ausgeblendet',
    hiddenDetail: (n: number) =>
      `${n === 1 ? 'Bei 1 Gruppe' : `Bei ${n} Gruppen`} liefert Graph nur Typ und ID, keinen Namen.`,
    hiddenCause:
      'Hat die App keine Leseberechtigung auf einen Objekttyp, liefert Graph Mitglieder laut Microsoft nur mit @odata.type und id zurück.',
    hiddenRemediation: [
      'Das ist nur ein Hinweis, kein Fehler – die Anzahl der Gruppen stimmt, nur die Namen fehlen.',
    ],
  },
  /** M10: Kachel „Autopilot“ (Windows Autopilot, v1.0) */
  autopilot: {
    valueRegistered: 'Registriert',
    valueFailed: 'Fehlgeschlagen',
    valueNotRegistered: 'Nicht registriert',
    summaryRegistered: (groupTag: string | null) =>
      groupTag
        ? `Autopilot-Eintrag mit Group Tag „${groupTag}“`
        : 'Autopilot-Eintrag ohne Group Tag',
    summaryNotRegistered: 'Gerät steht nicht in der Autopilot-Geräteliste',
    facts: {
      groupTag: 'Group Tag',
      groupTagNone: 'keiner',
      enrollmentState: 'Registrierungsstatus',
      lastContacted: 'Zuletzt kontaktiert',
      hardware: 'Hardware',
      matchedBy: 'Zuordnung',
      matchedByManagedDeviceId: 'über Intune-Geräte-ID',
      matchedBySerialNumber: 'über Seriennummer',
      profile: 'Bereitstellungsprofil',
      profileUnavailable: 'über dokumentierte API (v1.0) nicht verfügbar',
    },
    /** Übersetzung der Enum-Werte von enrollmentState (v1.0) */
    states: {
      unknown: 'unbekannt',
      enrolled: 'registriert',
      pendingReset: 'Zurücksetzen ausstehend',
      failed: 'fehlgeschlagen',
      notContacted: 'noch nicht kontaktiert',
    } as Record<string, string>,
    failedTitle: 'Autopilot-Registrierung fehlgeschlagen',
    failedDetail: 'Der Autopilot-Eintrag des Geräts meldet enrollmentState = failed.',
    failedCause:
      'Autopilot meldet für dieses Gerät eine fehlgeschlagene Registrierung. Die Dokumentation beschreibt die Ursache nicht näher; der Wert sagt nur, dass sie nicht abgeschlossen wurde.',
    failedRemediation: [
      'Den Eintrag des Geräts in der Autopilot-Geräteliste im Intune Admin Center öffnen (laut Microsoft unter Geräte › Registrierung › Windows › Windows Autopilot › Geräte) und dort den Status prüfen.',
      'Letzten Check-in und Compliance des Geräts in den Kacheln „Letzter Check-in“ und „Compliance“ ansehen.',
      'Den Bereitstellungsstatus nicht aus dieser Kachel ableiten: Das Bereitstellungsprofil ist über die dokumentierte v1.0-API nicht lesbar.',
    ],
    notRegisteredTitle: 'Nicht in Autopilot registriert',
    notRegisteredDetail:
      'Die Autopilot-Geräteliste wurde vollständig gelesen; weder die Intune-Geräte-ID noch die Seriennummer des Geräts kommen darin vor.',
    notRegisteredCause:
      'Ein Gerät erscheint in der Autopilot-Liste erst, nachdem sein Hardware-Hash beim Autopilot-Dienst registriert wurde (laut Microsoft durch Hersteller, Partner oder manuellen Import). Geräte, die nicht über Autopilot bereitgestellt werden, stehen dort nicht – das ist kein Fehler.',
    notRegisteredRemediation: [
      'Nur falls das Gerät über Autopilot bereitgestellt werden sollte: Im Intune Admin Center unter Geräte › Registrierung › Windows › Windows Autopilot › Geräte nach der Seriennummer suchen; fehlt das Gerät, die Registrierung (Hardware-Hash) nach der verlinkten Microsoft-Seite nachholen.',
    ],
  },
  /** M10: Kachel „Lokaler Administrator (LAPS)“ (Windows LAPS, nur Metadaten) */
  laps: {
    valueOk: 'Kennwort gesichert',
    valueStale: 'Sicherung veraltet',
    valueNoBackup: 'Keine Sicherung',
    valueHint: 'Rotation überfällig',
    summaryOk: (when: string) => `Letzte Sicherung ${when}`,
    summaryNoBackup: 'Graph meldet keinen Sicherungszeitpunkt',
    facts: {
      lastBackup: 'Letzte Kennwortsicherung',
      nextRefresh: 'Nächste geplante Aktualisierung',
      deviceName: 'Gerät laut Entra',
      passwordNote: 'Kennwort',
      passwordNever: 'wird nie abgerufen oder angezeigt',
    },
    staleTitle: 'Kennwortsicherung veraltet',
    staleDetail: (when: string, days: number, limit: number) =>
      `Das lokale Administrator-Kennwort wurde zuletzt ${when} in Entra gesichert (vor ${days} Tagen; Richtwert dieser App: ${limit} Tage).`,
    staleCause:
      'Windows LAPS rotiert und sichert das Kennwort nach dem Intervall der Richtlinie (PasswordAgeDays, Standard 30 Tage). Eine ältere Sicherung kann bedeuten, dass das Gerät die Richtlinie nicht verarbeitet, die Sicherung scheitert oder das Gerät lange offline war – oder dass die Richtlinie ein längeres Intervall vorgibt (der Richtwert ist keine Microsoft-Vorgabe).',
    staleRemediation: [
      'Im Intune Admin Center unter Endpoint Security › Account Protection prüfen, ob dem Gerät eine Richtlinie „Local admin password solution (Windows LAPS)“ zugewiesen ist und ob dort als Sicherungsverzeichnis Microsoft Entra ID gewählt ist.',
      'Prüfen, ob LAPS in Entra aktiviert ist (Entra ID › Geräte › Geräteeinstellungen › „Enable Local Administrator Password Solution (LAPS)“) und das Gerät in Entra aktiviert ist – für deaktivierte Geräte rotiert und sichert Windows LAPS laut Microsoft nicht.',
      'Auf dem Gerät in der Ereignisanzeige unter Anwendungs- und Dienstprotokolle › Microsoft › Windows › LAPS › Betriebsbereit nach den Ereignissen 10003 (Start), 10004 (erfolgreich) bzw. 10005 (fehlgeschlagen, mit Fehlercode) suchen (Ereignis-IDs laut Microsoft-Dokumentation zu Windows LAPS).',
    ],
    noBackupTitle: 'Kein Sicherungszeitpunkt gemeldet',
    noBackupDetail:
      'Der LAPS-Eintrag des Geräts enthält keinen Zeitpunkt der letzten Kennwortsicherung (lastBackupDateTime).',
    noBackupCause:
      'Für das Gerät wurde noch kein Kennwort in Entra gesichert, oder Graph liefert den Wert nicht. Laut Microsoft stehen die Daten im Intune Admin Center erst, nachdem das Gerät eingecheckt und die LAPS-Richtlinie erfolgreich verarbeitet hat.',
    hintTitle: 'Geplante Kennwortrotation überfällig',
    hintDetail: (when: string, days: number, limit: number) =>
      `Die nächste Aktualisierung war für ${when} geplant (seit ${days} Tagen überschritten; refreshDateTime). Hinweis ab ${limit} Tagen – Richtwert dieser App, keine Microsoft-Vorgabe.`,
    hintCause:
      'Laut Feldbeschreibung nennt refreshDateTime den Zeitpunkt, zu dem das Kennwort aktualisiert und in Entra gesichert wird. Liegt er deutlich in der Vergangenheit, hat das Gerät die Rotation nicht ausgeführt oder nicht gemeldet.',
    hintRemediation: [
      'Prüfen, wann das Gerät zuletzt eingecheckt hat (Kachel „Letzter Check-in“) und ob es online war.',
      'Auf dem Gerät die LAPS-Ereignisse 10003 bis 10005 prüfen (siehe Ereignisprotokoll Windows LAPS).',
    ],
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
    errorCauseCompliance:
      'Mindestens eine Einstellung der Compliance-Richtlinie meldet „Fehler“. Der Status bleibt bis zu sieben Tage unverändert; danach wird das Gerät nicht konform bzw. in die Schonfrist gesetzt.',
    errorRemediationCompliance: [
      'Im Intune Admin Center unter Geräte › <Gerät> › Gerätekonformität die Richtlinie öffnen und die Einstellung mit Fehler prüfen.',
      'Gerät synchronisieren lassen und den Status erneut prüfen.',
    ],
    staleTitle: (kind: string, name: string) => `${kind} „${name}“: Status weicht ab`,
    staleDetail: (state: string) =>
      `Graph meldet für diese Richtlinie den Zustand ${state}, der Gesamtstatus des Geräts (complianceState) ist aber „konform“.`,
    staleCause:
      'Der Richtlinienstatus pro Gerät (deviceCompliancePolicyStates) widerspricht dem Gesamtstatus des Geräts. Einen Grund für die Abweichung nennt die dokumentierte API nicht; das Intune Admin Center zeigt den Stand je Einstellung.',
    staleRemediation: [
      'Im Intune Admin Center unter Geräte › <Gerät> › Gerätekonformität die Richtlinie öffnen und den Status je Einstellung prüfen.',
      'Sind dort alle Einstellungen konform, ist nichts zu tun – das Gerät gilt insgesamt als konform.',
    ],
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
        unknown: 'Join-Status unbekannt',
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
      summaryCounts: (installed: number, _failed: number, other: number) =>
        `${installed} installiert · ${other} sonstige`,
      summaryNone: 'Keine Win32-App-Zustände im Archiv',
      statusFact: (status: string) => `Status „${status}“`,
      statusFactValue: (count: number) => `${count} ${count === 1 ? 'App' : 'Apps'}`,
      failedTitle: (appId: string) => `Installation fehlgeschlagen: App ${appId}`,
      failedTitleNamed: (name: string) => `Installation fehlgeschlagen: ${name}`,
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
        'App im Intune Admin Center öffnen (Link unten bzw. Apps › Windows, Suche nach der App-ID) und den Installationsstatus des Geräts prüfen.',
        'IME-Logs im Archiv bzw. am Gerät auswerten: AppWorkload.log und IntuneManagementExtension.log unter C:\\ProgramData\\Microsoft\\IntuneManagementExtension\\Logs.',
        'Installationsbefehl, Erkennungsregel und Rückgabecodes der App prüfen; bei Benutzerzuweisung beachten, dass Apps mit Administratorbedarf im Benutzerkontext scheitern.',
      ],
      pendingRebootTitle: (appId: string) => `Neustart ausstehend: App ${appId}`,
      pendingRebootTitleNamed: (name: string) => `Neustart ausstehend: ${name}`,
      pendingRebootDetail: 'Status „InstalledPendingReboot“.',
      pendingRebootCause:
        'Die Installation ist abgeschlossen, wird aber erst nach einem Neustart wirksam.',
      pendingRebootRemediation: ['Nutzer bitten, das Gerät neu zu starten.'],
      imeTitle: (errors: number, warnings: number) =>
        `IME-Log: ${errors} ${errors === 1 ? 'Fehlerzeile' : 'Fehlerzeilen'}, ${warnings} ${warnings === 1 ? 'Warnzeile' : 'Warnzeilen'}`,
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
      summary: (count: number) => `${count} ${count === 1 ? 'Registrierung' : 'Registrierungen'}`,
      upnLabel: 'Benutzer (maskiert)',
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
    /** M11/A: certutil- und ipconfig-Ausgaben (OEM-Codepage) – nur Rohdaten, ohne Bewertung */
    certsNetwork: {
      valueNone: 'Keine Daten',
      value: (certs: number, adapters: number | null) =>
        [
          certs > 0 ? `${certs} ${certs === 1 ? 'Zertifikat' : 'Zertifikate'}` : null,
          adapters !== null ? `${adapters} Adapter` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      summary: 'Rohdaten aus certutil und ipconfig – ohne Bewertung',
      factCerts: 'Zertifikate',
      factExpired: (date: string) => `Laut NotAfter abgelaufen (vor ${date})`,
      factExpiring: 'Läuft innerhalb von 30 Tagen ab',
      factAdapters: 'Netzwerkadapter',
      factPrimarySuffix: 'Primäres DNS-Suffix',
      factSearchList: 'DNS-Suffixsuchliste',
      certsTitle: (n: number) => `Zertifikate im Speicher (${n})`,
      certsDetail: (n: number, expired: number, expiring: number, date: string) =>
        `${n} ${n === 1 ? 'Zertifikat' : 'Zertifikate'} aus certutil. Verglichen mit dem Sammelzeitpunkt (${date}) ist der Ablauf (NotAfter) bei ${expired} überschritten, bei ${expiring} innerhalb von 30 Tagen erreicht.`,
      certsCause:
        'Rohdaten aus der certutil-Ausgabe. Zu diesen Zertifikaten gibt es in Microsoft Learn keine allgemeine Bewertung des Ablaufdatums; sie werden deshalb nur angezeigt, nicht gedeutet.',
      certsRemediation: [
        'Bei Bedarf das Zertifikat am Gerät prüfen (certlm.msc bzw. „certutil -store“).',
      ],
      certsNoneTitle: 'Keine Zertifikate erkannt',
      certsNoneDetail:
        'Die certutil-Ausgabe enthielt keine erkennbaren Zertifikatsblöcke (Format oder Sprache unbekannt).',
      certsNoneCause:
        'Der Parser kennt die deutsche und englische certutil-Ausgabe; andere Sprachen oder Formate werden nicht ausgewertet.',
      certsNoneRemediation: ['Ausgabe im Archiv direkt prüfen.'],
      certLine: (subject: string | null, serial: string | null, until: string, expired: boolean) =>
        [
          subject ? `Antragsteller ${subject}` : null,
          serial ? `Seriennummer ${serial}` : null,
          `gültig bis ${until}${expired ? ' (abgelaufen)' : ''}`,
        ]
          .filter(Boolean)
          .join(' · '),
      untilUnknown: (raw: string | null) => (raw ? `${raw} (Format unbekannt)` : 'unbekannt'),
      moreCerts: (n: number) => `… und ${n} weitere`,
      entraRegTitle: 'Zertifikat mit Aussteller „MS-Organization-Access“',
      entraRegDetail: (n: number) =>
        `${n} ${n === 1 ? 'Zertifikat' : 'Zertifikate'} mit dem Aussteller „MS-Organization-Access“ im Speicher.`,
      entraRegCause:
        'Microsoft Learn nennt das Computerzertifikat mit diesem Aussteller im Zusammenhang mit der Geräteregistrierung (Microsoft Entra ID). Eine Bewertung des Ablaufdatums ist dort nicht beschrieben – die Werte werden nur angezeigt.',
      entraRegRemediation: [
        'Zum Zusammenhang siehe die verlinkte Microsoft-Learn-Seite (Geräteregistrierung, dsregcmd /leave).',
      ],
      networkTitle: (n: number) => `Netzwerkadapter (ipconfig /all, ${n})`,
      networkDetail:
        'Adapter, IPv4-Adressen, DNS-Server und DNS-Suffixe laut ipconfig. MAC-Adressen sind bis auf das Herstellerpräfix maskiert.',
      networkCause: 'Rohdaten aus ipconfig /all; es erfolgt keine Bewertung.',
      networkRemediation: [
        'Bei Verbindungsproblemen die Werte mit der erwarteten Netzwerkkonfiguration vergleichen.',
      ],
      networkNoneTitle: 'ipconfig-Ausgabe nicht erkannt',
      networkNoneDetail: 'In der ipconfig-Ausgabe wurde kein Adapter erkannt.',
      networkNoneCause:
        'Der Parser kennt die deutsche und englische ipconfig-Ausgabe; andere Sprachen oder Formate werden nicht ausgewertet.',
      adapterLine: (
        ipv4: string[],
        dns: string[],
        suffix: string | null,
        mac: string | null,
        disconnected: boolean,
      ) =>
        disconnected
          ? 'Medium getrennt'
          : [
              `IPv4 ${ipv4.length ? ipv4.join(', ') : '–'}`,
              `DNS ${dns.length ? dns.join(', ') : '–'}`,
              suffix ? `Suffix ${suffix}` : null,
              mac ? `MAC ${mac}` : null,
            ]
              .filter(Boolean)
              .join(' · '),
    },
    collection: {
      valueOk: 'Vollständig',
      valueFailed: (n: number) => `${n} ${n === 1 ? 'Sammlung' : 'Sammlungen'} fehlgeschlagen`,
      valueHarmless: (n: number) => `${n} erwartbar fehlend`,
      summary: (entries: number) => `${entries} Einträge im Archiv`,
      failedTitle: (kind: string, target: string) => `${kind} nicht gesammelt: ${target}`,
      failedDetail: (hresult: string, meaning: string | undefined) =>
        meaning ? `${hresult} – ${meaning}.` : `${hresult}.`,
      codeKnown: (name: string, text: string) => `${name} („${text}“)`,
      codeUnknown: 'Unbekannter Code',
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
    /** Kachel „MDM-Ereignisse“: Ereignisprotokolle aus dem ZIP (Strang B, M11) */
    mdmEvents: {
      logLabel: {
        mdmAdmin: 'DeviceManagement-Enterprise-Diagnostics-Provider/Admin',
        aadOperational: 'AAD/Operational',
      } as Record<string, string>,
      logShort: {
        mdmAdmin: 'MDM Admin',
        aadOperational: 'AAD Operational',
      } as Record<string, string>,
      levelLabel: { 1: 'Kritisch', 2: 'Fehler', 3: 'Warnung' } as Record<number, string>,
      valueOk: 'Keine Fehler',
      valueOkWithWarnings: (warnings: number) =>
        `Keine Fehler · ${warnings} ${warnings === 1 ? 'Warnung' : 'Warnungen'}`,
      valueErrors: (errors: number) =>
        `${errors} ${errors === 1 ? 'Fehlerereignis' : 'Fehlerereignisse'}`,
      summaryOk: (scanned: number, days: number) =>
        `${scanned} ${scanned === 1 ? 'Ereignis' : 'Ereignisse'} der letzten ${days} Tage geprüft`,
      summaryErrors: (groups: number, days: number) =>
        `${groups} ${groups === 1 ? 'Ereignis-ID' : 'Ereignis-IDs'} · letzte ${days} Tage`,
      reasons: {
        missing:
          'Das Ereignisprotokoll „DeviceManagement-Enterprise-Diagnostics-Provider/Admin“ ist nicht im Archiv enthalten.',
        tooLarge: (log: string, sizeMiB: number, limitMiB: number) =>
          `Das Ereignisprotokoll „${log}“ wurde nicht gelesen: ${sizeMiB} MiB überschreiten das Größenlimit von ${limitMiB} MiB.`,
        unreadable: (log: string) =>
          `Das Ereignisprotokoll „${log}“ konnte nicht aus dem Archiv gelesen werden.`,
        invalid: (log: string) =>
          `Das Ereignisprotokoll „${log}“ ist keine gültige .evtx-Datei oder zu stark beschädigt.`,
      },
      unavailableTitle: 'Ereignisprotokoll nicht ausgewertet',
      unavailableCause: {
        missing:
          'Das Archiv enthält das Protokoll nicht (Sammlung fehlgeschlagen oder nicht Teil der Diagnosedaten).',
        tooLarge: 'Das Protokoll ist größer als das Limit für die Auswertung im Browser.',
        unreadable: 'Der Eintrag im Archiv ist leer oder beschädigt.',
        invalid: 'Die Datei hat nicht das Format eines Windows-Ereignisprotokolls (.evtx).',
      } as Record<string, string>,
      unavailableRemediation: [
        'Das Protokoll am Gerät in der Ereignisanzeige öffnen: Anwendungs- und Dienstprotokolle › Microsoft › Windows › DeviceManagement-Enterprise-Diagnostics-Provider › Admin.',
        'Bei fehlendem Protokoll die Diagnosedaten erneut sammeln.',
      ],
      groupTitle: (eventId: number, level: string, count: number, known: string | null) =>
        known
          ? `Ereignis ${eventId}: ${known} (${count}×)`
          : `Ereignis ${eventId} (${level}, ${count}×)`,
      groupDetail: (
        count: number,
        level: string,
        log: string,
        last: string,
        sample: string | null,
        codes: string[],
      ) =>
        [
          `${count}× ${level} im Protokoll ${log}, zuletzt ${last}.`,
          sample ? `Beispiel: ${sample}.` : null,
          ...codes,
        ]
          .filter(Boolean)
          .join(' '),
      sampleField: (name: string, value: string) => `${name} = „${value}“`,
      codeKnown: (hex: string, name: string, text: string) => `${hex} = ${name} („${text}“).`,
      unknownEventCause:
        'Für diese Ereignis-ID ist keine Deutung mit Microsoft-Learn-Quelle hinterlegt – angezeigt werden nur die Rohdaten aus dem Ereignis.',
      genericRemediation: [
        'Den vollständigen Meldungstext in der Ereignisanzeige am Gerät lesen – das Archiv enthält nur die Parameter, nicht den Meldungstext des Providers.',
        'Den Zeitpunkt mit anderen Befunden vergleichen (Registrierung, IME-Log, Entra-Join).',
      ],
      warningCause:
        'Warnungen werden nur angezeigt und nicht als Fehler gewertet; für diese Ereignis-ID ist keine Deutung mit Microsoft-Learn-Quelle hinterlegt – angezeigt werden nur die Rohdaten aus dem Ereignis.',
      moreTitle: (n: number) => `Weitere ${n} ${n === 1 ? 'Ereignis-ID' : 'Ereignis-IDs'}`,
      moreDetail: (items: string) => `Nicht einzeln aufgeführt: ${items}.`,
      moreCause: 'Die Anzeige ist auf die häufigsten Ereignisgruppen begrenzt.',
      moreRemediation: ['Das Protokoll bei Bedarf am Gerät in der Ereignisanzeige filtern.'],
      incompleteTitle: 'Ereignisprotokoll unvollständig oder begrenzt',
      incompleteDetail: (log: string, skipped: number, capped: boolean) =>
        [
          `„${log}“: Die Datei ist gekappt oder teilweise beschädigt${skipped > 0 ? ` (${skipped} nicht lesbare Bereiche übersprungen)` : ''}.`,
          capped
            ? 'Die Auswertung wurde mengen- bzw. zeitbegrenzt; ältere Ereignisse fehlen.'
            : null,
        ]
          .filter(Boolean)
          .join(' '),
      incompleteCause:
        'Der Eintrag im Archiv ist gekappt oder beschädigt bzw. sehr groß; deshalb sind nicht alle Ereignisse sichtbar.',
      incompleteRemediation: [
        'Bei Bedarf das Protokoll direkt am Gerät in der Ereignisanzeige prüfen.',
      ],
      factWindow: 'Zeitfenster',
      factWindowValue: (from: string, to: string, days: number) =>
        `${from} – ${to} UTC (${days} Tage)`,
      factLog: (shortName: string) => shortName,
      factLogValue: (scanned: number, errors: number, warnings: number) =>
        `${scanned} geprüft · ${errors} Fehler · ${warnings} Warnungen`,
    },
  },
  ticket: {
    heading: (name: string) => `MDM Doctor – Befunde für ${name}`,
    generated: (date: string, mode: string) => `Erstellt: ${date} · Datenquelle: ${mode}`,
    modeDemo: 'Demo-Daten (fiktiv)',
    modeLive: 'Microsoft Graph (live, read-only)',
    modeZip: 'DiagLogs-ZIP (lokal analysiert)',
    summary: 'Zusammenfassung',
    tilesHeading: 'Status',
    findingsHeading: 'Befunde',
    noFindings: 'Keine Probleme gefunden.',
    cause: 'Ursache',
    remediation: 'Lösung',
    source: 'Quelle',
    docs: 'Doku',
    severity: { ok: 'OK', warning: 'Prüfen', critical: 'Problem', unknown: 'Hinweis' } as Record<
      string,
      string
    >,
    device: (parts: string[]) => parts.join(' · '),
  },
} as const;
