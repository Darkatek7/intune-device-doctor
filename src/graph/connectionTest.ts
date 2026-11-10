/**
 * Verbindungstest (M14/S6, nur Live): ruft jeden Endpunkt aus `Endpoints` genau einmal lesend auf,
 * damit sich die „Live zu verifizieren“-Listen in docs/graph-api-reference.md mit einem Klick abarbeiten
 * lassen.
 *
 * Verträge:
 * - READ-ONLY: es wird ausschließlich `client.get` benutzt (kein getAllPages – nur die erste Seite), die
 *   URLs entstehen ausschließlich über `Endpoints.<id>.path(...)`.
 * - Jeder Endpunkt höchstens einmal, nacheinander (sequenziell), jederzeit abbrechbar.
 * - Von der Antwort bleiben NUR: Ergebnis, Dauer, Anzahl der Einträge und die NAMEN der Felder auf oberster
 *   Ebene des ersten Eintrags. Werte, IDs und Namen von Objekten gelangen weder ins Ergebnis noch in
 *   ein Log. Die Antwort wird nach der Auswertung verworfen (das gilt auch für VPP-Tokens, deren Antwort
 *   `token` und `appleId` enthält: es werden nur Feldnamen gelesen).
 * - Kennungen, die spätere Aufrufe brauchen (z. B. die ID einer Richtlinie für `…/assignments`), werden
 *   nur flüchtig in `derived` gehalten und nie zurückgegeben.
 * - `Probes` ist ein `Record<EndpointId, …>`: wer einen Endpunkt ergänzt, bekommt ohne Eintrag hier einen
 *   Compile-Fehler – so bleibt der Test vollständig.
 */
import type { EndpointProbeResult, ManagedDeviceInfo, ProbeOutcome } from '../domain/types';
import { de } from '../i18n/de';
import { GraphRequestError, type GraphClient } from './client';
import { Endpoints, SIGN_IN_WINDOW_DAYS, type EndpointId } from './endpoints';
import { isGuid } from './mappers';

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';
/** Höchstens so viele Feldnamen je Endpunkt. */
export const MAX_FIELD_NAMES = 40;
/** Nur schlichte Schema-Namen: schützt davor, dass frei vergebene Schlüssel (Dictionaries) angezeigt werden. */
const FIELD_NAME_PATTERN = /^[A-Za-z@][A-Za-z0-9_.@-]{0,63}$/;
/** OData-Metadaten der Antwort, keine Felder des Eintrags. */
const IGNORED_FIELD_NAMES = new Set(['@odata.context', '@odata.nextLink', '@odata.count']);

type SkipKey = keyof typeof de.connectionTest.skip;

/** Flüchtig gemerkte Kennungen aus früheren Antworten (nie Teil des Ergebnisses). */
interface Derived {
  enrollmentConfigurationId?: string;
  configurationId?: string;
  compliancePolicyId?: string;
  appId?: string;
  /** Erste ID aus den Mandanten-Listen (M15) */
  tenantConfigurationId?: string;
  tenantCompliancePolicyId?: string;
}

interface ProbeContext {
  device: ManagedDeviceInfo;
  now: Date;
  derived: Derived;
}

interface Probe {
  /** Nur sinnvoll für Windows-Geräte (Ressource existiert nur dort) → sonst übersprungen. */
  windowsOnly?: boolean;
  /** Pfad aus `Endpoints.<id>.path(...)` oder der Grund, warum der Aufruf nicht möglich ist. */
  request(ctx: ProbeContext): { path: string } | { skip: SkipKey };
  /** Merkt sich Kennungen für spätere Endpunkte (nur im Speicher). */
  capture?(entries: unknown[], derived: Derived): void;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstGuid(entries: unknown[]): string | undefined {
  for (const entry of entries) {
    const id = text(record(entry)?.['id']);
    if (id && isGuid(id)) return id;
  }
  return undefined;
}

function firstId(entries: unknown[]): string | undefined {
  for (const entry of entries) {
    const id = text(record(entry)?.['id']);
    if (id) return id;
  }
  return undefined;
}

function userId(device: ManagedDeviceInfo): string | null {
  const id = device.userId?.trim();
  return id && id !== EMPTY_GUID ? id : null;
}

function azureAdId(device: ManagedDeviceInfo): string | null {
  const id = device.azureADDeviceId?.trim();
  return id && id !== EMPTY_GUID ? id : null;
}

function upn(device: ManagedDeviceInfo): string | null {
  return text(device.userPrincipalName);
}

/** Probe für Endpunkte, die nur das Gerät (Verwaltungs-ID) brauchen. */
function byDeviceId(
  id:
    | 'windowsProtectionState'
    | 'detectedMalwareState'
    | 'managedDevice'
    | 'deviceCompliancePolicyStates'
    | 'deviceConfigurationStates'
    | 'managedDeviceHealthAttestation',
) {
  return (ctx: ProbeContext) => ({ path: Endpoints[id].path(ctx.device.id) });
}

function needsAzureAdId(build: (azureAdDeviceId: string) => string): Probe['request'] {
  return (ctx) => {
    const id = azureAdId(ctx.device);
    return id ? { path: build(id) } : { skip: 'noAzureAdId' };
  };
}

function needsUserPrincipalName(build: (name: string) => string): Probe['request'] {
  return (ctx) => {
    const name = upn(ctx.device);
    return name ? { path: build(name) } : { skip: 'noUser' };
  };
}

function needsUserId(build: (id: string, ctx: ProbeContext) => string): Probe['request'] {
  return (ctx) => {
    const id = userId(ctx.device);
    return id ? { path: build(id, ctx) } : { skip: 'noUser' };
  };
}

function needsDerived(key: keyof Derived, build: (value: string) => string): Probe['request'] {
  return (ctx) => {
    const value = ctx.derived[key];
    return value ? { path: build(value) } : { skip: 'noSource' };
  };
}

/**
 * Reihenfolge = Reihenfolge des Tests: Endpunkte, aus deren Antwort eine Kennung für spätere Aufrufe
 * stammt (Richtlinien, Apps, Registrierungskonfigurationen), stehen vor den abhängigen Aufrufen.
 */
export const Probes: Record<EndpointId, Probe> = {
  managedDevicesByName: {
    request: (ctx) => ({ path: Endpoints.managedDevicesByName.path(ctx.device.deviceName) }),
  },
  managedDevicesByNameContains: {
    request: (ctx) => ({
      path: Endpoints.managedDevicesByNameContains.path(ctx.device.deviceName),
    }),
  },
  managedDevicesList: { request: () => ({ path: Endpoints.managedDevicesList.path() }) },
  managedDevice: { request: byDeviceId('managedDevice') },
  windowsProtectionState: { windowsOnly: true, request: byDeviceId('windowsProtectionState') },
  detectedMalwareState: { windowsOnly: true, request: byDeviceId('detectedMalwareState') },
  deviceCompliancePolicyStates: {
    request: byDeviceId('deviceCompliancePolicyStates'),
    capture: (entries, derived) => {
      derived.compliancePolicyId = firstGuid(entries);
    },
  },
  deviceConfigurationStates: {
    request: byDeviceId('deviceConfigurationStates'),
    capture: (entries, derived) => {
      derived.configurationId = firstGuid(entries);
    },
  },
  managedDeviceHealthAttestation: {
    windowsOnly: true,
    request: byDeviceId('managedDeviceHealthAttestation'),
  },
  entraDeviceByDeviceId: {
    request: needsAzureAdId((id) => Endpoints.entraDeviceByDeviceId.path(id)),
  },
  entraDevicesByName: {
    request: (ctx) => ({ path: Endpoints.entraDevicesByName.path(ctx.device.deviceName) }),
  },
  deviceTransitiveMemberOf: {
    request: needsAzureAdId((id) => Endpoints.deviceTransitiveMemberOf.path(id)),
  },
  bitlockerRecoveryKeys: {
    request: needsAzureAdId((id) => Endpoints.bitlockerRecoveryKeys.path(id)),
  },
  deviceLocalCredentialInfo: {
    windowsOnly: true,
    request: needsAzureAdId((id) => Endpoints.deviceLocalCredentialInfo.path(id)),
  },
  mobileAppIntentAndStates: {
    request: needsUserId((id) => Endpoints.mobileAppIntentAndStates.path(id)),
    capture: (entries, derived) => {
      for (const entry of entries) {
        const apps = record(entry)?.['mobileAppList'];
        if (!Array.isArray(apps)) continue;
        for (const app of apps) {
          const id = text(record(app)?.['applicationId']);
          if (id && isGuid(id)) {
            derived.appId = id;
            return;
          }
        }
      }
    },
  },
  mobileApp: { request: needsDerived('appId', (id) => Endpoints.mobileApp.path(id)) },
  mobileAppAssignments: {
    request: needsDerived('appId', (id) => Endpoints.mobileAppAssignments.path(id)),
  },
  deviceConfigurationAssignments: {
    request: needsDerived('configurationId', (id) =>
      Endpoints.deviceConfigurationAssignments.path(id),
    ),
  },
  deviceCompliancePolicyAssignments: {
    request: needsDerived('compliancePolicyId', (id) =>
      Endpoints.deviceCompliancePolicyAssignments.path(id),
    ),
  },
  signIns: {
    request: needsUserId((id, ctx) => {
      const since = new Date(ctx.now.getTime() - SIGN_IN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      return Endpoints.signIns.path(id, since.toISOString());
    }),
  },
  windowsAutopilotDeviceIdentities: {
    windowsOnly: true,
    request: () => ({ path: Endpoints.windowsAutopilotDeviceIdentities.path() }),
  },
  managedDevicesByUser: {
    request: needsUserPrincipalName((name) => Endpoints.managedDevicesByUser.path(name)),
  },
  managedDevicesOfUser: {
    request: needsUserPrincipalName((name) => Endpoints.managedDevicesOfUser.path(name)),
  },
  userLicenseDetails: {
    request: needsUserId((id) => Endpoints.userLicenseDetails.path(id)),
  },
  deviceEnrollmentConfigurations: {
    request: () => ({ path: Endpoints.deviceEnrollmentConfigurations.path() }),
    capture: (entries, derived) => {
      derived.enrollmentConfigurationId = firstId(entries);
    },
  },
  deviceEnrollmentConfigurationAssignments: {
    request: needsDerived('enrollmentConfigurationId', (id) =>
      Endpoints.deviceEnrollmentConfigurationAssignments.path(id),
    ),
  },
  applePushNotificationCertificate: {
    request: () => ({ path: Endpoints.applePushNotificationCertificate.path() }),
  },
  vppTokens: { request: () => ({ path: Endpoints.vppTokens.path() }) },
  deviceConfigurations: {
    request: () => ({ path: Endpoints.deviceConfigurations.path() }),
    capture: (entries, derived) => {
      derived.tenantConfigurationId = firstId(entries);
    },
  },
  deviceConfigurationDeviceStatusOverview: {
    request: needsDerived('tenantConfigurationId', (id) =>
      Endpoints.deviceConfigurationDeviceStatusOverview.path(id),
    ),
  },
  deviceConfigurationDeviceStatuses: {
    request: needsDerived('tenantConfigurationId', (id) =>
      Endpoints.deviceConfigurationDeviceStatuses.path(id),
    ),
  },
  deviceCompliancePolicies: {
    request: () => ({ path: Endpoints.deviceCompliancePolicies.path() }),
    capture: (entries, derived) => {
      derived.tenantCompliancePolicyId = firstId(entries);
    },
  },
  deviceCompliancePolicyDeviceStatusOverview: {
    request: needsDerived('tenantCompliancePolicyId', (id) =>
      Endpoints.deviceCompliancePolicyDeviceStatusOverview.path(id),
    ),
  },
  deviceCompliancePolicyDeviceStatuses: {
    request: needsDerived('tenantCompliancePolicyId', (id) =>
      Endpoints.deviceCompliancePolicyDeviceStatuses.path(id),
    ),
  },
  securityAlerts: { request: () => ({ path: Endpoints.securityAlerts.path() }) },
};

/** Endpunkte in Testreihenfolge. */
export const PROBE_ORDER = Object.keys(Probes) as EndpointId[];

export interface ConnectionTestOptions {
  signal?: AbortSignal;
  /** Wird nach jedem Endpunkt aufgerufen (Fortschritt). */
  onResult?: (result: EndpointProbeResult, index: number, total: number) => void;
  /** Für Tests. */
  now?: () => Date;
  /** Monotone Uhr in Millisekunden (Tests); Standard: performance.now(). */
  clock?: () => number;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function abortError(): DOMException {
  return new DOMException(de.errors.aborted, 'AbortError');
}

/** Einträge der Antwort: Sammlung → `value`, einzelnes Objekt → das Objekt selbst. */
export function entriesOf(body: unknown): unknown[] {
  const obj = record(body);
  if (!obj) return [];
  return Array.isArray(obj['value']) ? (obj['value'] as unknown[]) : [obj];
}

/** NAMEN der Felder auf oberster Ebene des ersten Eintrags – nie Werte. */
export function fieldNamesOf(entry: unknown): string[] {
  const obj = record(entry);
  if (!obj) return [];
  return Object.keys(obj)
    .filter((name) => !IGNORED_FIELD_NAMES.has(name) && FIELD_NAME_PATTERN.test(name))
    .slice(0, MAX_FIELD_NAMES);
}

function outcomeOf(error: unknown): { outcome: ProbeOutcome; httpStatus: number | null } {
  if (!(error instanceof GraphRequestError)) return { outcome: 'error', httpStatus: null };
  const { code, httpStatus } = error.error;
  if (code === 'forbidden') return { outcome: 'forbidden', httpStatus: httpStatus ?? 403 };
  if (code === 'notFound') return { outcome: 'notFound', httpStatus: httpStatus ?? 404 };
  if (httpStatus === 400) return { outcome: 'badRequest', httpStatus };
  return { outcome: 'error', httpStatus: httpStatus ?? null };
}

function base(
  id: EndpointId,
): Pick<EndpointProbeResult, 'endpointId' | 'display' | 'version' | 'scope'> {
  const endpoint = Endpoints[id];
  return {
    endpointId: id,
    display: endpoint.display,
    version: endpoint.version,
    scope: endpoint.scope,
  };
}

/**
 * Ruft jeden Endpunkt genau einmal auf. Wirft nur bei Abbruch (DOMException 'AbortError'); bereits
 * gemeldete Ergebnisse (`onResult`) bleiben gültig.
 */
export async function runConnectionTest(
  client: GraphClient,
  device: ManagedDeviceInfo,
  options: ConnectionTestOptions = {},
): Promise<EndpointProbeResult[]> {
  const now = options.now ?? (() => new Date());
  const clock = options.clock ?? (() => performance.now());
  const derived: Derived = {};
  const results: EndpointProbeResult[] = [];
  const total = PROBE_ORDER.length;

  const push = (result: EndpointProbeResult) => {
    results.push(result);
    options.onResult?.(result, results.length - 1, total);
  };
  const skipped = (id: EndpointId, key: SkipKey): EndpointProbeResult => ({
    ...base(id),
    outcome: 'skipped',
    httpStatus: null,
    durationMs: null,
    entryCount: null,
    fieldNames: [],
    skipReason: de.connectionTest.skip[key],
  });

  for (const id of PROBE_ORDER) {
    if (options.signal?.aborted) throw abortError();
    const probe = Probes[id];

    if (probe.windowsOnly && device.osFamily !== 'windows') {
      push(skipped(id, 'windowsOnly'));
      continue;
    }
    const request = probe.request({ device, now: now(), derived });
    if ('skip' in request) {
      push(skipped(id, request.skip));
      continue;
    }

    const endpoint = Endpoints[id];
    const started = clock();
    try {
      const body = await client.get<unknown>(request.path, {
        signal: options.signal,
        scope: endpoint.scope,
      });
      const durationMs = Math.max(0, Math.round(clock() - started));
      const entries = entriesOf(body);
      probe.capture?.(entries, derived);
      push({
        ...base(id),
        outcome: 'ok',
        httpStatus: null,
        durationMs,
        entryCount: entries.length,
        fieldNames: fieldNamesOf(entries[0]),
        skipReason: null,
      });
    } catch (error) {
      if (isAbort(error)) throw error;
      const { outcome, httpStatus } = outcomeOf(error);
      push({
        ...base(id),
        outcome,
        httpStatus,
        durationMs: Math.max(0, Math.round(clock() - started)),
        entryCount: null,
        fieldNames: [],
        skipReason: null,
      });
    }
  }
  return results;
}
