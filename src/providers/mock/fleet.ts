/**
 * Demo-Daten für M20 (fiktiv, Contoso). Zeitwerte relativ zu `now`.
 *
 * S1 – Compliance-Übersicht: ein Mandant mit 265 gemeldeten Geräten, davon 31 nicht konform (≈ 11,7 % –
 * über dem eigenen Richtwert von 10 %), zwei mit Fehler, eines mit Konflikt. Die Einstellungsnamen folgen
 * dem dokumentierten Muster „Klassenname.Eigenschaft“ (`setting`) bzw. dem Eigenschaftsnamen
 * (`settingName`); die Zahlen sind erfunden.
 *
 * S2 – Änderungsprotokoll: einige Änderungen der letzten Tage, darunter eine Änderung an „Contoso – VPN
 * Always On“ (demoGuid('policy', 23)) zwei Tage vor dessen Fehler auf CONTOSO-PC042, eine automatisierte
 * Änderung durch eine Anwendung und eine ältere Änderung außerhalb des 7-Tage-Fensters. Aktivitätsnamen
 * folgen dem Muster der Intune-Überwachungsprotokolle („<Vorgang> <Objekttyp>“), die Administratoren sind
 * fiktiv (contoso.com).
 *
 * S3 – App-Schutz: CONTOSO-IP015 (iOS) meldet wie ab iOS 16 üblich nur den generischen Gerätenamen
 * „iPhone“ → Zuordnung nur über den Benutzer, eine App seit 45 Tagen nicht synchronisiert.
 * CONTOSO-AND21 (Android) meldet den Gerätenamen, Outlook ist mit `rootedDevice` markiert.
 * Bundle-IDs/Paketnamen sind die öffentlichen der Microsoft-Apps, Versionen erfunden.
 */
import type {
  AppProtectionInfo,
  AppProtectionRegistration,
  AuditEventEntry,
  AuditEventsInfo,
  ComplianceSettingSummariesInfo,
  ComplianceSettingSummaryInfo,
  DeviceStateSummaryInfo,
} from '../../domain/types';
import type { SettingSummaryPlatformType } from '../../graph/dto';
import { ago, demoGuid } from './scenarios/helpers';

// ---------- S1: Compliance-Übersicht ----------

export function defaultComplianceSummary(): DeviceStateSummaryInfo {
  return {
    kind: 'compliance',
    counts: {
      compliantDeviceCount: 212,
      nonCompliantDeviceCount: 31,
      inGracePeriodCount: 6,
      errorDeviceCount: 2,
      conflictDeviceCount: 1,
      unknownDeviceCount: 9,
      notApplicableDeviceCount: 4,
      remediatedDeviceCount: 0,
      configManagerCount: 0,
    },
  };
}

export function defaultConfigurationSummary(): DeviceStateSummaryInfo {
  return {
    kind: 'configuration',
    counts: {
      compliantDeviceCount: 540,
      nonCompliantDeviceCount: 12,
      errorDeviceCount: 3,
      conflictDeviceCount: 2,
      unknownDeviceCount: 20,
      notApplicableDeviceCount: 30,
      remediatedDeviceCount: 0,
    },
  };
}

function setting(
  n: number,
  className: string,
  settingName: string,
  platform: SettingSummaryPlatformType,
  counts: { nonCompliant: number; error?: number; conflict?: number; compliant: number },
): ComplianceSettingSummaryInfo {
  return {
    id: `00000000-0000-4000-c000-${n.toString().padStart(12, '0')}`,
    name: settingName,
    setting: `${className}.${settingName}`,
    platform,
    platformRaw: platform,
    nonCompliantDeviceCount: counts.nonCompliant,
    errorDeviceCount: counts.error ?? 0,
    conflictDeviceCount: counts.conflict ?? 0,
    compliantDeviceCount: counts.compliant,
  };
}

export function defaultComplianceSettings(): ComplianceSettingSummariesInfo {
  const win = 'Windows10CompliancePolicy';
  const ios = 'IosCompliancePolicy';
  const android = 'AndroidWorkProfileCompliancePolicy';
  return {
    pagesRead: 1,
    truncated: false,
    settings: [
      setting(1, win, 'osMinimumVersion', 'windows10AndLater', {
        nonCompliant: 14,
        compliant: 160,
      }),
      setting(2, win, 'bitLockerEnabled', 'windows10AndLater', {
        nonCompliant: 9,
        error: 2,
        compliant: 165,
      }),
      setting(3, ios, 'passcodeRequired', 'iOS', { nonCompliant: 4, compliant: 38 }),
      setting(4, win, 'defenderEnabled', 'windows10AndLater', {
        nonCompliant: 3,
        conflict: 1,
        compliant: 171,
      }),
      setting(
        5,
        android,
        'securityRequireSafetyNetAttestationBasicIntegrity',
        'androidWorkProfile',
        {
          nonCompliant: 1,
          compliant: 21,
        },
      ),
      setting(6, win, 'passwordRequired', 'windows10AndLater', { nonCompliant: 0, compliant: 174 }),
    ],
  };
}

// ---------- S2: Änderungsprotokoll ----------

const ADMIN = 'anna.schmidt@contoso.com';
const HELPDESK = 'tim.wagner@contoso.com';

function audit(
  n: number,
  time: string,
  activity: string,
  category: string,
  resource: { id: string; name: string; type: string },
  actor: { kind: 'user' | 'application'; name: string },
  result = 'Success',
): AuditEventEntry {
  return {
    id: `00000000-0000-4000-e000-${n.toString().padStart(12, '0')}`,
    activityDateTime: time,
    activity,
    activityType: activity,
    activityOperationType: activity.split(' ')[0] ?? null,
    activityResult: result,
    category,
    componentName: category,
    correlationId: `00000000-0000-4000-f000-${n.toString().padStart(12, '0')}`,
    actor: {
      kind: actor.kind,
      name: actor.name,
      actorType: actor.kind === 'user' ? 'ItPro' : 'Application',
    },
    resources: [{ resourceId: resource.id, displayName: resource.name, type: resource.type }],
  };
}

export const VPN_POLICY_ID = demoGuid('policy', 23);

export function defaultAuditEvents(now: Date): AuditEventsInfo {
  const vpn = { id: VPN_POLICY_ID, name: 'Contoso – VPN Always On', type: 'DeviceConfiguration' };
  return {
    pagesRead: 1,
    truncated: false,
    events: [
      audit(
        1,
        ago(now, { hours: 20 }),
        'Assign DeviceCompliancePolicy',
        'Compliance',
        {
          id: demoGuid('policy', 1),
          name: 'Contoso – Windows 11 Basis-Compliance',
          type: 'DeviceCompliancePolicy',
        },
        { kind: 'user', name: ADMIN },
      ),
      audit(2, ago(now, { days: 2 }), 'Patch DeviceConfiguration', 'DeviceConfiguration', vpn, {
        kind: 'user',
        name: ADMIN,
      }),
      audit(
        3,
        ago(now, { days: 3, hours: 4 }),
        'Patch MobileApp',
        'Application',
        { id: 'app-vpn-client', name: 'Contoso VPN Client 5.1', type: 'MobileApp' },
        { kind: 'application', name: 'Contoso Automation' },
      ),
      audit(
        4,
        ago(now, { days: 4 }),
        'Delete DeviceConfiguration',
        'DeviceConfiguration',
        {
          id: demoGuid('policy', 90),
          name: 'Contoso – WLAN Gäste (alt)',
          type: 'DeviceConfiguration',
        },
        { kind: 'user', name: HELPDESK },
        'Failure',
      ),
      audit(5, ago(now, { days: 12 }), 'Create DeviceConfiguration', 'DeviceConfiguration', vpn, {
        kind: 'user',
        name: ADMIN,
      }),
    ],
  };
}

// ---------- S3: App-Schutz ----------

function registration(
  n: number,
  platform: 'ios' | 'android',
  appIdentifier: string,
  values: Partial<AppProtectionRegistration> & { lastSyncDateTime: string },
): AppProtectionRegistration {
  return {
    id: `00000000-0000-4000-a100-${n.toString().padStart(12, '0')}`,
    appIdentifier,
    appPlatform: platform,
    applicationVersion: null,
    managementSdkVersion: null,
    platformVersion: null,
    deviceType: null,
    deviceName: null,
    createdDateTime: null,
    flaggedReasons: [],
    ...values,
  };
}

/** CONTOSO-IP015: generischer Gerätename (iOS 16+) → alle Registrierungen des Benutzers, eine veraltet. */
export function ip015AppProtection(now: Date): AppProtectionInfo {
  const ios = { deviceType: 'iPhone', platformVersion: '18.6.2', deviceName: 'iPhone' };
  return {
    matchedBy: 'user',
    userRegistrationCount: 2,
    pagesRead: 1,
    truncated: false,
    registrations: [
      registration(1, 'ios', 'com.microsoft.Office.Outlook', {
        ...ios,
        applicationVersion: '4.2541.0',
        managementSdkVersion: '20.3.1',
        createdDateTime: ago(now, { days: 120 }),
        lastSyncDateTime: ago(now, { hours: 2 }),
      }),
      registration(2, 'ios', 'com.microsoft.skype.teams', {
        ...ios,
        applicationVersion: '7.14.1',
        managementSdkVersion: '19.8.0',
        createdDateTime: ago(now, { days: 200 }),
        lastSyncDateTime: ago(now, { days: 45 }),
      }),
    ],
  };
}

/** CONTOSO-AND21: Gerätename stimmt überein, Outlook ist mit rootedDevice markiert. */
export function and21AppProtection(now: Date): AppProtectionInfo {
  const android = { deviceType: 'Pixel 8', platformVersion: '15', deviceName: 'CONTOSO-AND21' };
  return {
    matchedBy: 'deviceName',
    userRegistrationCount: 2,
    pagesRead: 1,
    truncated: false,
    registrations: [
      registration(3, 'android', 'com.microsoft.office.outlook', {
        ...android,
        applicationVersion: '4.2541.1',
        managementSdkVersion: '11.2.0',
        createdDateTime: ago(now, { days: 60 }),
        lastSyncDateTime: ago(now, { hours: 5 }),
        flaggedReasons: ['rootedDevice'],
      }),
      registration(4, 'android', 'com.microsoft.teams', {
        ...android,
        applicationVersion: '1416/1.0.0.2025',
        managementSdkVersion: '11.2.0',
        createdDateTime: ago(now, { days: 60 }),
        lastSyncDateTime: ago(now, { days: 1 }),
      }),
    ],
  };
}

/** Andere iOS/Android-Geräte ohne Angabe: keine Registrierung des Benutzers. */
export function emptyAppProtection(): AppProtectionInfo {
  return {
    matchedBy: 'user',
    userRegistrationCount: 0,
    pagesRead: 1,
    truncated: false,
    registrations: [],
  };
}
