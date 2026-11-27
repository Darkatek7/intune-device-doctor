/** M22/S2: Demo-Flotte – deterministisch, Zähler wie in der Ansicht „Mandant“, jede Auffälligkeit ≥ 3. */
import { describe, expect, it } from 'vitest';
import { evaluateFleet, FLEET_ISSUES } from '../../rules/fleetDevices';
import { defaultComplianceSummary } from './fleet';
import { GENERATED_FLEET_SIZE, generatedFleetFixtures } from './fleetDevices';
import { MockProvider } from './MockProvider';
import { scenarios } from './scenarios';

const NOW = new Date('2026-11-10T12:00:00Z');
const create = (options = {}) => new MockProvider({ latency: false, now: () => NOW, ...options });

async function fleet() {
  const result = await create().getFleetDevices();
  if (result.status !== 'ok') throw new Error(`Flotte nicht ok: ${result.status}`);
  return result.data.devices;
}

describe('Demo-Flotte (M22/S2) – Erzeugung', () => {
  it('ist deterministisch: zweimal bauen ergibt dieselben Geräte', () => {
    const a = generatedFleetFixtures(NOW);
    const b = generatedFleetFixtures(NOW);
    expect(a).toEqual(b);
    expect(a).toHaveLength(GENERATED_FLEET_SIZE);
  });

  it('bringt zusammen mit den zehn Szenarien 265 Geräte', async () => {
    expect(scenarios).toHaveLength(10);
    expect(await fleet()).toHaveLength(265);
  });

  it('eindeutige IDs und Namen, keine Kollision mit den Szenarien', async () => {
    const devices = await fleet();
    expect(new Set(devices.map((d) => d.id)).size).toBe(devices.length);
    expect(new Set(devices.map((d) => d.deviceName)).size).toBe(devices.length);
    const scenarioNames = new Set(scenarios.map((s) => s.deviceName));
    const generated = devices.filter((d) => !scenarioNames.has(d.deviceName));
    expect(generated).toHaveLength(GENERATED_FLEET_SIZE);
    expect(generated.every((d) => /^CONTOSO-(PC|MB|IP|AND|SRV)\d+$/.test(d.deviceName))).toBe(true);
  });

  it('nur fiktive Adressen (@contoso.com) und fiktive Seriennummern', async () => {
    const devices = await fleet();
    for (const device of devices) {
      if (device.userPrincipalName !== null) {
        expect(device.userPrincipalName).toMatch(/^[a-z]+\.[a-z]+@contoso\.com$/);
      }
      if (device.serialNumber !== null) expect(device.serialNumber).toMatch(/^DEMO-/);
    }
    expect(devices.some((d) => d.userPrincipalName === null)).toBe(true);
  });
});

describe('Demo-Flotte (M22/S2) – Zähler und Verteilung', () => {
  it('Compliance-Zustände entsprechen defaultComplianceSummary() (unknown + notApplicable)', async () => {
    const c = defaultComplianceSummary().counts;
    const expected: Record<string, number> = {
      compliant: c.compliantDeviceCount ?? 0,
      noncompliant: c.nonCompliantDeviceCount ?? 0,
      inGracePeriod: c.inGracePeriodCount ?? 0,
      error: c.errorDeviceCount ?? 0,
      conflict: c.conflictDeviceCount ?? 0,
      // ComplianceState hat kein notApplicable → nächstliegender Wert unknown
      unknown: (c.unknownDeviceCount ?? 0) + (c.notApplicableDeviceCount ?? 0),
    };
    const devices = await fleet();
    const actual: Record<string, number> = {};
    for (const device of devices) {
      actual[device.complianceState] = (actual[device.complianceState] ?? 0) + 1;
    }
    expect(actual).toEqual(
      Object.fromEntries(Object.entries(expected).filter(([, count]) => count > 0)),
    );
  });

  it('jede Auffälligkeit kommt bei mindestens drei Geräten vor', async () => {
    const overview = evaluateFleet({ devices: await fleet(), truncated: false, pagesRead: 1 }, NOW);
    for (const group of overview.groups) {
      expect(group.count, group.issue).toBeGreaterThanOrEqual(3);
    }
    expect(overview.groups.map((g) => g.issue)).toEqual([...FLEET_ISSUES]);
  });

  it('Kombinationen: mindestens ein Gerät mit drei Auffälligkeiten', async () => {
    const overview = evaluateFleet({ devices: await fleet(), truncated: false, pagesRead: 1 }, NOW);
    expect(overview.rows.some((row) => row.issues.length >= 3)).toBe(true);
    expect(
      overview.rows.some(
        (row) => row.issues.includes('nonCompliant') && row.issues.includes('notEncrypted'),
      ),
    ).toBe(true);
  });

  it('Verwaltet von: MDE-Server ohne Benutzer und Compliance-Bewertung, Co-Management, Android über Cloud DPC', async () => {
    const devices = await fleet();
    const mde = devices.filter((d) => d.managementAgent === 'msSense');
    expect(mde).toHaveLength(6);
    expect(mde.every((d) => /^CONTOSO-SRV\d+$/.test(d.deviceName))).toBe(true);
    expect(mde.every((d) => d.complianceState === 'unknown' && d.userPrincipalName === null)).toBe(
      true,
    );
    expect(
      devices.filter((d) => d.managementAgent === 'configurationManagerClientMdm'),
    ).toHaveLength(3);
    const android = devices.filter((d) => d.operatingSystem === 'Android');
    expect(android.length).toBeGreaterThan(0);
    expect(devices.every((d) => d.managementAgent !== null)).toBe(true);
  });

  it('Jailbreak/Root nur auf iOS/iPadOS und Android', async () => {
    const devices = await fleet();
    const jailbroken = devices.filter((d) => d.jailBroken === 'True');
    expect(jailbroken.length).toBeGreaterThanOrEqual(3);
    for (const device of jailbroken) {
      expect(['iOS', 'iPadOS', 'Android']).toContain(device.operatingSystem);
    }
  });

  it('alle vier Plattformen mit mindestens drei OS-Versionen je Plattform (erzeugte Geräte)', () => {
    const generated = generatedFleetFixtures(NOW).map((f) => f.device);
    const byPlatform = new Map<string, Set<string | null>>();
    for (const device of generated) {
      const set = byPlatform.get(device.osFamily) ?? new Set<string | null>();
      set.add(device.osVersion);
      byPlatform.set(device.osFamily, set);
    }
    for (const platform of ['windows', 'macos', 'ios', 'android']) {
      expect(byPlatform.get(platform)?.size ?? 0, platform).toBeGreaterThanOrEqual(3);
    }
  });

  it('Windows überwiegt; Plattformen im Überblick', async () => {
    const overview = evaluateFleet({ devices: await fleet(), truncated: false, pagesRead: 1 }, NOW);
    const count = (p: string) => overview.platforms.find((x) => x.platform === p)?.count ?? 0;
    expect(count('windows')).toBeGreaterThan(count('macos') + count('ios') + count('android'));
    for (const platform of ['windows', 'macos', 'ios', 'android'])
      expect(count(platform)).toBeGreaterThan(0);
  });

  it('Geräte ohne Verschlüsselungs- und Check-in-Angabe (null/null) sind vorhanden', async () => {
    const devices = await fleet();
    const unknown = devices.filter((d) => d.isEncrypted === null && d.lastSyncDateTime === null);
    expect(unknown.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Demo-Flotte (M22/S2) – Öffnen und Konsistenz', () => {
  it('jedes Gerät der Liste lädt per getDevice und passt zur Listenzeile', async () => {
    const provider = create();
    const result = await provider.getFleetDevices();
    if (result.status !== 'ok') throw new Error('Flotte nicht ok');
    for (const row of result.data.devices) {
      const device = await provider.getDevice(row.id);
      expect(device, row.deviceName).toMatchObject({
        id: row.id,
        deviceName: row.deviceName,
        complianceState: row.complianceState,
        isEncrypted: row.isEncrypted,
        lastSyncDateTime: row.lastSyncDateTime,
        userPrincipalName: row.userPrincipalName,
        osVersion: row.osVersion,
        jailBroken: row.jailBroken,
      });
    }
  });

  it('die Suche findet erzeugte Geräte über Name und Benutzer', async () => {
    const provider = create();
    const byName = await provider.searchDevices('CONTOSO-MB101');
    expect(byName).toHaveLength(1);
    expect(byName[0]?.deviceName).toBe('CONTOSO-MB101');
    const [sample] = (await fleet()).filter(
      (d) => d.userPrincipalName && d.deviceName.startsWith('CONTOSO-PC2'),
    );
    const byUser = await provider.searchDevices(sample!.userPrincipalName!);
    expect(byUser.some((d) => d.id === sample!.id)).toBe(true);
  });

  it('Abschnitte eines erzeugten Geräts liefern Daten oder einen Grund (keine Ausnahme)', async () => {
    const provider = create();
    const [device] = (await fleet()).filter((d) => d.deviceName === 'CONTOSO-AND101');
    const info = await provider.getDevice(device!.id);
    const [protection, apps, appProtection] = await Promise.all([
      provider.getProtectionState(info),
      provider.getAppInstallStates(info),
      provider.getAppProtection(info),
    ]);
    expect(protection.status).toBe('notApplicable');
    expect(apps.status).toBe('ok');
    expect(['ok', 'notApplicable']).toContain(appProtection.status);
  });

  it('Richtlinien-Ansicht bleibt unverändert: nur die Szenarien zählen', async () => {
    const withFleet = await create().getTenantPolicies();
    const scenarioOnly = await create({ scenarios }).getTenantPolicies();
    expect(withFleet).toEqual(scenarioOnly);
  });

  it('eigene Szenarien: genau diese Geräte, keine erzeugte Flotte', async () => {
    const provider = create({ scenarios: scenarios.slice(0, 3) });
    const result = await provider.getFleetDevices();
    if (result.status !== 'ok') throw new Error('nicht ok');
    expect(result.data.devices).toHaveLength(3);
  });

  it('Vorgabe tenant.fleetDevices hat Vorrang', async () => {
    const provider = create({
      tenant: { fleetDevices: { status: 'forbidden' } },
    });
    expect((await provider.getFleetDevices()).status).toBe('forbidden');
  });
});
