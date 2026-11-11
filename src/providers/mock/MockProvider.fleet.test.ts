/** M20: Demo-Daten für Änderungsprotokoll und App-Schutz (fiktiv, Contoso). */
import { describe, expect, it } from 'vitest';
import { Endpoints } from '../../graph/endpoints';
import { de } from '../../i18n/de';
import { MockProvider } from './MockProvider';
import { scenarios } from './scenarios';
import { and21Android } from './scenarios/and21-android';

const NOW = new Date('2026-11-10T12:00:00Z');
const create = (options = {}) => new MockProvider({ latency: false, now: () => NOW, ...options });

async function device(provider: MockProvider, name: string) {
  const [hit] = await provider.searchDevices(name);
  return provider.getDevice(hit!.id);
}

describe('MockProvider – Änderungsprotokoll (M20/S2)', () => {
  it('Standard: Einträge mit Quelle aus endpoints.ts; Vorgabe forbidden mit optionalem Scope', async () => {
    const result = await create().getAuditEvents();
    expect(result.status).toBe('ok');
    expect(result.source.label).toBe(Endpoints.auditEvents.display);
    const forbidden = await create({
      tenant: { auditEvents: { status: 'forbidden' } },
    }).getAuditEvents();
    expect(forbidden.status === 'forbidden' && forbidden.error.requiredScope).toBe(
      'DeviceManagementApps.Read.All',
    );
  });
});

describe('MockProvider – App-Schutz (M20/S3)', () => {
  it('Demo: AND21 mit rootedDevice (Gerätename), IP015 nur über den Benutzer; Windows nicht anwendbar', async () => {
    const provider = create();
    const android = await provider.getAppProtection(await device(provider, 'CONTOSO-AND21'));
    expect(android.status === 'ok' && android.data.matchedBy).toBe('deviceName');
    expect(
      android.status === 'ok' &&
        android.data.registrations.some((r) => r.flaggedReasons.includes('rootedDevice')),
    ).toBe(true);
    expect(android.source.label).toBe(Endpoints.managedAppRegistrations.display);

    const ios = await provider.getAppProtection(await device(provider, 'CONTOSO-IP015'));
    expect(ios.status === 'ok' && ios.data.matchedBy).toBe('user');

    const windows = await provider.getAppProtection(await device(provider, 'CONTOSO-PC001'));
    expect(windows).toMatchObject({
      status: 'notApplicable',
      reason: de.fleet.reasons.appProtectionPlatform,
    });
  });

  it('Vorgabe forbidden → fehlende Berechtigung mit DeviceManagementApps.Read.All', async () => {
    const provider = create({
      scenarios: [
        ...scenarios.filter((s) => s.deviceName !== and21Android.deviceName),
        {
          ...and21Android,
          build: (now: Date) => ({
            ...and21Android.build(now),
            appProtection: { status: 'forbidden' as const },
          }),
        },
      ],
    });
    const result = await provider.getAppProtection(await device(provider, 'CONTOSO-AND21'));
    expect(result.status === 'forbidden' && result.error.requiredScope).toBe(
      'DeviceManagementApps.Read.All',
    );
  });
});
