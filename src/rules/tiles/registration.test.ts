import { describe, expect, it } from 'vitest';
import type {
  DeviceSnapshot,
  EnrollmentLimitsInfo,
  SectionResult,
  UserLicenseInfo,
} from '../../domain/types';
import { de } from '../../i18n/de';
import { MockProvider } from '../../providers/mock/MockProvider';
import { enrollmentLimit, userLicenseInfo } from '../../providers/mock/scenarios/helpers';
import { loadFullSnapshot } from '../../test/snapshot';
import { evaluateTiles } from '../evaluate';
import { Docs } from '../knowledge/docs';
import { evaluateRegistration } from './registration';

const NOW = new Date('2026-10-15T12:00:00Z');
const t = de.rules.registration;
const SOURCE = { kind: 'graph', label: 'GET /users/{userId}/licenseDetails' } as const;

async function snapshotOf(name: string): Promise<DeviceSnapshot> {
  return loadFullSnapshot(new MockProvider({ latency: false, now: () => NOW }), name);
}

const ok = <T>(data: T): SectionResult<T> => ({
  status: 'ok',
  data,
  source: SOURCE,
  fetchedAt: NOW.toISOString(),
});
const license = (data: UserLicenseInfo) => ok(data);
const limits = (data: EnrollmentLimitsInfo) => ok(data);

describe('Registrierung (Benutzer) – Lizenz', () => {
  it('lädt, solange eine Section fehlt', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const tile = evaluateRegistration({ device: base.device }, NOW);
    expect(tile.state).toBe('loading');
    expect(tile.sections).toEqual([
      'userLicense',
      'enrollmentLimits',
      'userDevices',
      'enrollmentFailures',
    ]);
  });

  it('Standard (CONTOSO-PC001): INTUNE_A aktiv → ok, Hinweis-Tabelle der Limits, Severity ok', async () => {
    const tile = evaluateRegistration(await snapshotOf('CONTOSO-PC001'), NOW);
    expect(tile.severity).toBe('ok');
    expect(tile.value).toBe(t.valueLicenseOk);
    expect(tile.findings.map((f) => [f.id, f.severity])).toEqual([
      ['registration-limits', 'unknown'],
    ]);
    expect(tile.facts).toContainEqual({
      label: t.facts.plans,
      value: 'INTUNE_A – aktiv',
      title: t.facts.plansNote,
    });
    expect(tile.facts.find((f) => f.label === t.facts.smallestLimit)?.value).toBe('5');
  });

  it('keine Lizenz mit Intune-Plan → warning mit Learn-Quelle', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const tile = evaluateRegistration(
      { ...base, userLicense: license(userLicenseInfo([], 0)) },
      NOW,
    );
    const finding = tile.findings.find((f) => f.id === 'registration-noLicense')!;
    expect(finding.severity).toBe('warning');
    expect(finding.detail).toBe(t.noLicenseDetailNone(0));
    expect(finding.docsUrl).toBe(Docs.enrollmentLicenseMissing);
    expect(finding.links?.[0]?.url).toBe(Docs.intuneLicensesAssign);
    expect(tile.severity).toBe('warning');
    expect(tile.value).toBe(t.valueNoLicense);
  });

  it('Lizenzen ohne Intune-Plan werden gezählt; nur deaktivierte Intune-Pläne → warning mit Statustext', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const without = evaluateRegistration(
      { ...base, userLicense: license(userLicenseInfo([], 2)) },
      NOW,
    );
    expect(without.findings.find((f) => f.id === 'registration-noLicense')!.detail).toBe(
      t.noLicenseDetailNone(2),
    );
    const disabled = evaluateRegistration(
      {
        ...base,
        userLicense: license(
          userLicenseInfo([
            { plan: 'INTUNE_A', skuPartNumber: 'SPE_E3', provisioningStatus: 'Disabled' },
          ]),
        ),
      },
      NOW,
    );
    const finding = disabled.findings.find((f) => f.id === 'registration-noLicense')!;
    expect(finding.detail).toBe(t.noLicenseDetailDisabled(`INTUNE_A (${t.planStatus.Disabled})`));
    expect(disabled.severity).toBe('warning');
  });

  it('zugewiesener Intune-Plan mit anderem Status als „Success“ ist keine fehlende Lizenz', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    for (const status of [
      'PendingInput',
      'PendingActivation',
      'PendingProvisioning',
      'Error',
      null,
    ] as const) {
      const tile = evaluateRegistration(
        {
          ...base,
          userLicense: license(
            userLicenseInfo([
              { plan: 'INTUNE_A', skuPartNumber: 'SPE_E5', provisioningStatus: status },
            ]),
          ),
        },
        NOW,
      );
      expect(
        tile.findings.some((f) => f.id === 'registration-noLicense'),
        String(status),
      ).toBe(false);
      expect(tile.value, String(status)).toBe(t.valueLicenseOk);
    }
  });

  it('Microsoft 365 E5 wie im Live-Test (INTUNE_A PendingInput + INTUNE_O365 PendingActivation): kein Befund zur Lizenz', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const tile = evaluateRegistration(
      {
        ...base,
        userLicense: license(
          userLicenseInfo([
            { plan: 'INTUNE_A', skuPartNumber: 'SPE_E5', provisioningStatus: 'PendingInput' },
            {
              plan: 'INTUNE_O365',
              skuPartNumber: 'SPE_E5',
              provisioningStatus: 'PendingActivation',
            },
          ]),
        ),
      },
      NOW,
    );
    const ids = tile.findings.map((f) => f.id);
    expect(ids).not.toContain('registration-noLicense');
    expect(ids).not.toContain('registration-mdmO365');
    expect(tile.summary).toContain(t.summaryLicenseOk);
  });

  it('INTUNE_A_VL oder INTUNE_EDU mit Success genügen', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    for (const plan of ['INTUNE_A_VL', 'INTUNE_EDU'] as const) {
      const tile = evaluateRegistration(
        {
          ...base,
          userLicense: license(
            userLicenseInfo([{ plan, skuPartNumber: 'X', provisioningStatus: 'Success' }]),
          ),
        },
        NOW,
      );
      expect(
        tile.findings.some((f) => f.id === 'registration-noLicense'),
        plan,
      ).toBe(false);
    }
  });

  it('Demo CONTOSO-IP015: nur INTUNE_O365 (Aktivierung ausstehend) → warning plus eigener Hinweis', async () => {
    const tile = evaluateRegistration(await snapshotOf('CONTOSO-IP015'), NOW);
    expect(tile.severity).toBe('warning');
    expect(tile.findings.map((f) => f.id)).toEqual(
      expect.arrayContaining(['registration-noLicense', 'registration-mdmO365']),
    );
    const hint = tile.findings.find((f) => f.id === 'registration-mdmO365')!;
    expect(hint.severity).toBe('unknown');
    expect(hint.detail).toBe(t.mdmO365Detail(t.planStatus.PendingActivation!));
    expect(hint.docsUrl).toBe(Docs.servicePlanInfo);
  });
});

describe('Registrierung (Benutzer) – Gerätelimit', () => {
  it('Demo CONTOSO-AND21: Geräteanzahl erreicht das kleinste Limit → Hinweis (kein Problem)', async () => {
    const tile = evaluateRegistration(await snapshotOf('CONTOSO-AND21'), NOW);
    const hint = tile.findings.find((f) => f.id === 'registration-limitReached')!;
    expect(hint.severity).toBe('unknown');
    expect(hint.detail).toBe(t.limitReachedDetail(1, 1));
    expect(hint.docsUrl).toBe(Docs.enrollmentDeviceCapReached);
    expect(tile.value).toBe(t.valueLimit);
    expect(tile.severity).toBe('ok');
  });

  it('Tabelle zeigt alle Konfigurationen nach Priorität mit Zielen; Ausnahmen der Registrierungsarten stehen in der Ursache', async () => {
    const tile = evaluateRegistration(await snapshotOf('CONTOSO-PC001'), NOW);
    const finding = tile.findings.find((f) => f.id === 'registration-limits')!;
    expect(finding.table?.columns).toEqual([
      t.columns.name,
      t.columns.priority,
      t.columns.limit,
      t.columns.targets,
    ]);
    expect(finding.table?.rows.map((r) => r.cells.slice(0, 3))).toEqual([
      ['Contoso – Außendienst', '1', '15'],
      ['Contoso – Standard', '2', '5'],
    ]);
    expect(finding.table!.rows[1]!.cells[3]).toBe(t.targetAllUsers);
    expect(finding.table!.rows[0]!.cells[3]).toContain('Gruppe ');
    expect(finding.cause).toContain('Autopilot');
    expect(finding.cause).toContain('Co-Management');
    expect(finding.docsUrl).toBe(Docs.deviceLimitsIntuneEntra);
  });

  it('Geräteanzahl unter dem kleinsten Limit → kein Hinweis; nicht lesbare Ziele und unbekannte Werte werden ehrlich gezeigt', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const tile = evaluateRegistration(
      {
        ...base,
        enrollmentLimits: limits({
          omitted: 2,
          limits: [
            enrollmentLimit(1, 'Ohne Ziele', { targets: null, limit: null, priority: null }),
            enrollmentLimit(2, 'Leer', { targets: [] }),
          ],
        }),
      },
      NOW,
    );
    expect(tile.findings.some((f) => f.id === 'registration-limitReached')).toBe(false);
    const finding = tile.findings.find((f) => f.id === 'registration-limits')!;
    expect(finding.detail).toContain(t.limitsOmitted(2));
    expect(finding.table!.rows[0]!.cells).toEqual(['Ohne Ziele', '–', '–', t.targetsUnreadable]);
    expect(finding.table!.rows[1]!.cells[3]).toBe(t.targetsNone);
  });

  it('keine Konfiguration lesbar → Hinweistext ohne erfundenes Limit', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const tile = evaluateRegistration(
      { ...base, enrollmentLimits: limits({ limits: [], omitted: 0 }) },
      NOW,
    );
    expect(tile.findings.find((f) => f.id === 'registration-limits')!.detail).toBe(
      t.limitsDetail(0),
    );
    expect(tile.facts.some((f) => f.label === t.facts.smallestLimit)).toBe(false);
  });
});

describe('Registrierung (Benutzer) – Berechtigung, Fehler, Sichtbarkeit', () => {
  it('Demo CONTOSO-PC050: beide optionalen Scopes fehlen → „Fehlende Berechtigung“ mit Scope, Kachel unknown', async () => {
    const tile = evaluateRegistration(await snapshotOf('CONTOSO-PC050'), NOW);
    expect(tile.availability).toBe('forbidden');
    expect(tile.value).toBe(de.availability.forbidden);
    expect(tile.severity).toBe('unknown');
    const forbidden = tile.findings.filter((f) => f.id.endsWith('-forbidden'));
    expect(forbidden.map((f) => f.id)).toEqual(
      expect.arrayContaining(['registration-license-forbidden', 'registration-limits-forbidden']),
    );
    expect(forbidden.some((f) => f.cause.includes('LicenseAssignment.Read.All'))).toBe(true);
    expect(forbidden.some((f) => f.cause.includes('DeviceManagementServiceConfig.Read.All'))).toBe(
      true,
    );
  });

  it('nur ein Teil fehlt: der andere Teil bleibt auswertbar', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const tile = evaluateRegistration(
      {
        ...base,
        userLicense: {
          status: 'forbidden',
          error: { code: 'forbidden', message: 'x', requiredScope: 'LicenseAssignment.Read.All' },
          source: SOURCE,
        },
      },
      NOW,
    );
    expect(tile.availability).toBe('forbidden');
    expect(tile.findings.some((f) => f.id === 'registration-limits')).toBe(true);
    expect(tile.findings.some((f) => f.id === 'registration-license-forbidden')).toBe(true);
  });

  it('Kachel nur mit primärem Benutzer', async () => {
    const base = await snapshotOf('CONTOSO-PC001');
    const withUser = evaluateTiles(base, NOW).map((t) => t.id);
    expect(withUser).toContain('registration');
    const userless = evaluateTiles({ ...base, device: { ...base.device, userId: null } }, NOW).map(
      (t) => t.id,
    );
    expect(userless).not.toContain('registration');
  });
});
