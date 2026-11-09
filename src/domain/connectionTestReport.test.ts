import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de';
import { buildConnectionTestReport, countOutcomes } from './connectionTestReport';
import type { EndpointProbeResult } from './types';

const result = (overrides: Partial<EndpointProbeResult> = {}): EndpointProbeResult => ({
  endpointId: 'managedDevice',
  display: 'GET /deviceManagement/managedDevices/{id}',
  version: 'v1.0',
  scope: 'DeviceManagementManagedDevices.Read.All',
  outcome: 'ok',
  httpStatus: null,
  durationMs: 123,
  entryCount: 1,
  fieldNames: ['id', 'deviceName'],
  skipReason: null,
  ...overrides,
});

const options = { osFamily: 'windows' as const, date: new Date(2026, 9, 15, 12), complete: true };

describe('buildConnectionTestReport', () => {
  it('erzeugt eine Markdown-Tabelle mit einer Zeile je Endpunkt', () => {
    const report = buildConnectionTestReport(
      [
        result(),
        result({
          endpointId: 'vppTokens',
          display: 'GET /deviceAppManagement/vppTokens',
          scope: 'DeviceManagementServiceConfig.Read.All',
          outcome: 'forbidden',
          httpStatus: 403,
          durationMs: 80,
          entryCount: null,
          fieldNames: [],
        }),
      ],
      options,
    );
    expect(report).toContain(`## ${de.connectionTest.report.title}`);
    expect(report).toContain('2026-10-15');
    expect(report).toContain('windows');
    expect(report).toContain(
      '| `GET /deviceManagement/managedDevices/{id}` | v1.0 | `DeviceManagementManagedDevices.Read.All` | ok | 123 ms | 1 | `id`, `deviceName` |',
    );
    expect(report).toContain('forbidden (403)');
    const tableRows = report.split('\n').filter((line) => line.startsWith('|'));
    expect(tableRows).toHaveLength(2 + 2);
    expect(report.endsWith('\n')).toBe(true);
  });

  it('kennzeichnet den Beta-Endpunkt', () => {
    const report = buildConnectionTestReport(
      [result({ endpointId: 'mobileAppIntentAndStates', version: 'beta' })],
      options,
    );
    expect(report).toContain(de.connectionTest.report.betaMark);
  });

  it('nennt den Grund übersprungener Endpunkte', () => {
    const report = buildConnectionTestReport(
      [
        result({
          outcome: 'skipped',
          durationMs: null,
          entryCount: null,
          fieldNames: [],
          skipReason: de.connectionTest.skip.windowsOnly,
        }),
      ],
      options,
    );
    expect(report).toContain(`skipped – ${de.connectionTest.skip.windowsOnly}`);
    expect(report).toContain('1 übersprungen');
  });

  it('weist einen abgebrochenen Test als unvollständig aus', () => {
    expect(buildConnectionTestReport([result()], { ...options, complete: false })).toContain(
      de.connectionTest.report.partial,
    );
    expect(buildConnectionTestReport([result()], options)).not.toContain(
      de.connectionTest.report.partial,
    );
  });

  it('escaped senkrechte Striche und entfernt Zeilenumbrüche in Zellen', () => {
    const report = buildConnectionTestReport(
      [result({ display: 'GET /a|b\n/c', fieldNames: ['x|y'] })],
      options,
    );
    expect(report).toContain('`GET /a\\|b /c`');
    expect(report).toContain('`x\\|y`');
    expect(report.split('\n').filter((line) => line.startsWith('| `')).length).toBe(1);
  });

  it('enthält nur Plattform, Datum und Strukturangaben – keine Namen oder IDs', () => {
    const report = buildConnectionTestReport([result()], options);
    expect(report).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(report).not.toMatch(/@/);
    expect(report).not.toMatch(/CONTOSO/i);
  });
});

describe('countOutcomes', () => {
  it('zählt die Ergebnisse', () => {
    expect(
      countOutcomes([
        result(),
        result(),
        result({ outcome: 'forbidden' }),
        result({ outcome: 'skipped' }),
      ]),
    ).toEqual({ ok: 2, forbidden: 1, notFound: 0, badRequest: 0, error: 0, skipped: 1 });
  });
});
