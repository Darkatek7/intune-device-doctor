/** M18: Demo-Daten für Dienststatus und Registrierungsfehler. */
import { describe, expect, it } from 'vitest';
import { DEVICE_ENROLLMENT_FAILURE_REASONS } from '../../graph/dto';
import { Endpoints } from '../../graph/endpoints';
import { de } from '../../i18n/de';
import { openIntuneIncidents } from '../../rules/service';
import { MockProvider } from './MockProvider';
import { pc001Healthy } from './scenarios/pc001-healthy';
import { healthyServiceHealth } from './service';

const NOW = new Date('2026-11-10T12:00:00Z');
const create = (tenant = {}) => new MockProvider({ latency: false, now: () => NOW, tenant });

async function device(provider: MockProvider, name: string) {
  const [hit] = await provider.searchDevices(name);
  return provider.getDevice(hit!.id);
}

describe('MockProvider – Dienststatus (M18)', () => {
  it('Standard: offener Intune-Vorfall, Quelle aus endpoints.ts, nur fiktive Daten', async () => {
    const result = await create().getServiceHealth();
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.source.label).toBe(Endpoints.serviceHealthOverviews.display);
    expect(openIntuneIncidents(result.data)).toHaveLength(1);
    const status = await create().getTenantStatus();
    expect(status.serviceHealth.status).toBe('ok');
  });

  it('Vorgaben: alles in Ordnung bzw. fehlende Berechtigung mit ServiceHealth.Read.All', async () => {
    const healthy = await create({
      serviceHealth: { status: 'ok', data: healthyServiceHealth(NOW) },
    }).getServiceHealth();
    expect(healthy.status === 'ok' && openIntuneIncidents(healthy.data)).toEqual([]);
    const forbidden = await create({ serviceHealth: { status: 'forbidden' } }).getServiceHealth();
    expect(forbidden.status).toBe('forbidden');
    if (forbidden.status === 'forbidden') {
      expect(forbidden.error.requiredScope).toBe('ServiceHealth.Read.All');
    }
  });
});

describe('MockProvider – Registrierungsfehler (M18)', () => {
  it('Standard: mehrere Fehlschläge in verschiedenen dokumentierten Kategorien, neueste zuerst', async () => {
    const status = await create().getTenantStatus();
    expect(status.enrollmentFailures.status).toBe('ok');
    if (status.enrollmentFailures.status !== 'ok') return;
    const { events } = status.enrollmentFailures.data;
    const categories = new Set(events.map((e) => e.failureCategory));
    expect(categories.size).toBeGreaterThanOrEqual(4);
    for (const category of categories) {
      expect(DEVICE_ENROLLMENT_FAILURE_REASONS).toContain(category);
    }
    const times = events.map((e) => Date.parse(e.eventDateTime!));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(JSON.stringify(events)).not.toMatch(/@(?!contoso)/);
  });

  it('Gerät: gefiltert auf den Benutzer; ohne Benutzer notApplicable; Mandanten-Vorgabe wirkt auch hier', async () => {
    const provider = create();
    const ip015 = await provider.getEnrollmentFailures(await device(provider, 'CONTOSO-IP015'));
    expect(ip015.status === 'ok' && ip015.data.events.map((e) => e.failureCategory)).toEqual([
      'userValidation',
      'userValidation',
    ]);
    const pc001 = await provider.getEnrollmentFailures(await device(provider, 'CONTOSO-PC001'));
    expect(pc001.status === 'ok' && pc001.data.events).toEqual([]);

    const userlessProvider = new MockProvider({
      latency: false,
      now: () => NOW,
      scenarios: [
        {
          ...pc001Healthy,
          build: (now) => {
            const fixture = pc001Healthy.build(now);
            return { ...fixture, device: { ...fixture.device, userId: null } };
          },
        },
      ],
    });
    const userless = await userlessProvider.getEnrollmentFailures(
      await device(userlessProvider, 'CONTOSO-PC001'),
    );
    expect(userless).toMatchObject({
      status: 'notApplicable',
      reason: de.service.reasons.enrollmentFailuresNoUser,
    });

    const forbiddenProvider = create({ enrollmentFailures: { status: 'forbidden' } });
    const forbidden = await forbiddenProvider.getEnrollmentFailures(
      await device(forbiddenProvider, 'CONTOSO-IP015'),
    );
    expect(forbidden.status).toBe('forbidden');
  });
});
