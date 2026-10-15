import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  analyzeDiagnosticsZip,
  mergeCollectionFailures,
  parseDiagFileName,
  selectImeLogEntries,
  type AnalysisProgress,
} from './analyze';
import { parseEntryName } from './parsers/entryName';
import { runDiagnosticsAnalysis } from './runAnalysis';
import { FIXTURE_FILE_NAME, buildFixtureZip } from './fixture';

const fixtureFile = (): File => new File([new Uint8Array(buildFixtureZip())], FIXTURE_FILE_NAME);

describe('parseDiagFileName', () => {
  it('liest Gerätename und Zeitstempel (Gerätename darf Bindestriche enthalten)', () => {
    expect(parseDiagFileName(FIXTURE_FILE_NAME)).toEqual({
      deviceName: 'CONTOSO-PC042',
      collectedAtUtc: '2026-10-14T12:53:56Z',
    });
    expect(parseDiagFileName('DiagLogs-A-B-C-20261014T125356Z (1).zip').deviceName).toBe('A-B-C');
  });

  it('liefert null bei fremden Dateinamen', () => {
    expect(parseDiagFileName('foo.zip')).toEqual({ deviceName: null, collectedAtUtc: null });
  });
});

describe('selectImeLogEntries', () => {
  it('nimmt das aktuelle Log und nur die jüngste Rotation', () => {
    const dir = 'ProgramData_Microsoft_IntuneManagementExtension_Logs';
    const names = [
      'IntuneManagementExtension.log',
      'IntuneManagementExtension-20260101-101010.log',
      'IntuneManagementExtension-20260301-101010.log',
      'AppWorkload.log',
    ];
    const entries = names.map((n, i) =>
      parseEntryName(`(${i}) FoldersFiles ${dir}/${n}`, 10, false)!,
    );
    const picked = selectImeLogEntries(entries).map((e) => e.name.split('/')[1]);
    expect(picked).toEqual([
      'IntuneManagementExtension.log',
      'AppWorkload.log',
      'IntuneManagementExtension-20260301-101010.log',
    ]);
  });
});

describe('mergeCollectionFailures', () => {
  it('dedupliziert über normalisierte Ziele', () => {
    const merged = mergeCollectionFailures(
      [
        {
          kind: 'FoldersFiles',
          target: 'ProgramData_Microsoft_EPMAgent_Logs',
          hresult: '0x80070003',
        },
      ],
      [
        {
          kind: 'FoldersFiles',
          target: '%ProgramData%\\Microsoft\\EPMAgent\\Logs\\*.*',
          hresult: '0x80070003',
        },
      ],
    );
    expect(merged).toHaveLength(1);
  });
});

describe('analyzeDiagnosticsZip (Fixture)', () => {
  it('liefert die erwarteten Befunde', async () => {
    const progress: AnalysisProgress[] = [];
    const report = await analyzeDiagnosticsZip(fixtureFile(), {
      onProgress: (p) => progress.push(p),
    });

    expect(report.fileName).toBe(FIXTURE_FILE_NAME);
    expect(report.deviceNameFromFile).toBe('CONTOSO-PC042');
    expect(report.collectedAtUtc).toBe('2026-10-14T12:53:56Z');
    expect(report.entryCount).toBe(9);

    expect(report.dsregcmd).toMatchObject({
      azureAdPrt: 'NO',
      wamDefaultSet: 'ERROR (0x80070520)',
      prtAttemptStatus: '0xc000023c',
      prtHttpError: '0x80072ee7',
    });

    expect(report.enrollments).toHaveLength(2);
    expect(report.enrollments.map((e) => e.providerId).sort()).toEqual([
      'MS DM Server',
      'WMI_Bridge_SCCM_Server',
    ]);
    expect(report.enrollments.find((e) => e.providerId === 'MS DM Server')?.upnMasked).toBe(
      'us…@contoso.com',
    );

    expect(report.win32Apps).toHaveLength(3);
    const failed = report.win32Apps.filter((a) => a.status === 'Failed');
    expect(failed).toHaveLength(1);
    expect(failed[0]?.errorCodeHex).toBe('0x80070642');

    expect(report.collectionFailures).toHaveLength(2);
    expect(report.collectionFailures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'RegistryKey', hresult: '0x80070001' }),
        expect.objectContaining({
          kind: 'FoldersFiles',
          hresult: '0x80070003',
          meaning: 'Pfad nicht gefunden',
        }),
      ]),
    );

    expect(report.imeIssues.map((i) => i.type)).toEqual([3, 2, 3, 3]);
    const multi = report.imeIssues.find((i) => i.message.includes('AAD User check'));
    expect(multi?.message).toContain('Contoso.Demo.Stack');
    expect(report.imeIssues[0]?.file).toBe('IntuneManagementExtension.log');

    expect(report.analysisNotes.some((n) => n.includes('.evtx'))).toBe(true);

    expect(progress[0]?.stage).toBe('opening');
    expect(progress.at(-1)).toMatchObject({ stage: 'done' });
  });

  it('enthält keine sensiblen Werte im Report', async () => {
    const json = JSON.stringify(await analyzeDiagnosticsZip(fixtureFile()));
    expect(json).not.toContain('DEMO-CHANNEL-URI');
    expect(json).not.toContain('00000000-0000-0000-0000-000000000000');
    expect(json).not.toContain('user@contoso.com');
    expect(json).not.toContain('AADTenantID');
  });

  describe('ohne Netzwerk', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('ruft fetch nie auf', async () => {
      const spy = vi.fn(() => {
        throw new Error('fetch darf im Analysepfad nicht aufgerufen werden');
      });
      vi.stubGlobal('fetch', spy);
      await analyzeDiagnosticsZip(fixtureFile());
      expect(spy).not.toHaveBeenCalled();
    });
  });

  it('respektiert das Größenlimit', async () => {
    const report = await analyzeDiagnosticsZip(fixtureFile(), { maxTextBytes: 10 });
    expect(report.dsregcmd).toBeNull();
    expect(report.analysisNotes.some((n) => n.includes('Größenlimit'))).toBe(true);
  });

  it('bricht bei Abbruchsignal ab', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      analyzeDiagnosticsZip(fixtureFile(), { signal: controller.signal }),
    ).rejects.toBeDefined();
  });
});

describe('runDiagnosticsAnalysis', () => {
  it('fällt ohne Worker auf den direkten Aufruf zurück', async () => {
    vi.stubGlobal('Worker', undefined);
    try {
      const report = await runDiagnosticsAnalysis(fixtureFile());
      expect(report.deviceNameFromFile).toBe('CONTOSO-PC042');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('lehnt bei bereits abgebrochenem Signal ab', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runDiagnosticsAnalysis(fixtureFile(), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
