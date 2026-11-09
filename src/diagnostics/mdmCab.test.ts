import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { analyzeDiagnosticsZip, type AnalysisProgress } from './analyze';
import { buildCab } from './cabFixture';
import { buildFixtureEntries, FIXTURE_FILE_NAME } from './fixture';
import {
  FIXTURE_MDM_CAB_DIRECTORY,
  FIXTURE_MDM_CAB_NAME,
  FIXTURE_MULTIVARIANT_CONDITIONS,
  buildMdmLogsCab,
} from './mdmCabFixture';
import { analyzeMdmCab, isMdmCabEntry, selectMdmCabEntry } from './mdmCab';
import { parseEntryName } from './parsers/entryName';
import type { DiagEntry } from './types';
import { buildEvtx } from './evtxFixture';
import { FIXTURE_ADMIN_LOG_EVENTS } from './fixture';
import type { OpenedZip } from './zip/reader';

const entry = (name: string, size = 100, dir = FIXTURE_MDM_CAB_DIRECTORY): DiagEntry =>
  parseEntryName(`(30) FoldersFiles ${dir}/${name}`, size, false)!;

const adminEvtx = (): Uint8Array => buildEvtx(FIXTURE_ADMIN_LOG_EVENTS);

/** Minimaler Ersatz für das ZIP: liefert die Bytes des Pakets. */
function fakeZip(bytes: Uint8Array | 'error'): Pick<OpenedZip, 'readBytes'> {
  return {
    async readBytes(e, maxBytes) {
      if (bytes === 'error') return { ok: false, reason: 'error' };
      if (e.uncompressedSize > maxBytes || bytes.length > maxBytes)
        return { ok: false, reason: 'tooLarge' };
      return { ok: true, bytes };
    },
  };
}

const OPTIONS = {
  referenceUtc: '2026-10-14T12:53:56Z',
  windowDays: 14,
  wantAdminLog: false,
};

describe('selectMdmCabEntry', () => {
  it('erkennt mdmlogs-*.cab und nimmt bei mehreren das jüngste (Datum im Namen)', () => {
    const entries = [
      entry('mdmlogs-20261001-101010.cab'),
      entry(FIXTURE_MDM_CAB_NAME),
      entry('mpsupportfiles.cab'),
      entry('MDMLOGS-20260901-101010.CAB'),
    ];
    expect(selectMdmCabEntry(entries)?.name).toContain(FIXTURE_MDM_CAB_NAME);
    expect(isMdmCabEntry(entries[2]!)).toBe(false);
    expect(isMdmCabEntry(entries[3]!)).toBe(true);
  });

  it('ignoriert Verzeichnisse, fehlgeschlagene Sammlungen und andere Eintragsarten', () => {
    const dir = parseEntryName(`(1) FoldersFiles x/${FIXTURE_MDM_CAB_NAME}/`, 0, true)!;
    const failed = parseEntryName(
      `(2) No Results - Error [0x80070003] FoldersFiles x/${FIXTURE_MDM_CAB_NAME}`,
      0,
      false,
    )!;
    const command = parseEntryName('(3) Command mdmlogs-20261014-125312.cab output.log', 5, false)!;
    expect(selectMdmCabEntry([dir, failed, command])).toBeUndefined();
  });
});

describe('analyzeMdmCab', () => {
  it('liest Dateiliste, MDMDiagReport.xml und Metadaten – ohne sensible Werte', async () => {
    const bytes = buildMdmLogsCab({ adminLogEvtx: adminEvtx() });
    const { pkg, adminLog } = await analyzeMdmCab(
      fakeZip(bytes),
      entry(FIXTURE_MDM_CAB_NAME),
      OPTIONS,
    );
    expect(adminLog).toBeNull();
    expect(pkg).toMatchObject({
      status: 'ok',
      truncated: false,
      unsupportedReason: null,
      fileCount: 6,
      reportStatus: 'ok',
      metadataStatus: 'ok',
      adminLogFromPackage: false,
    });
    expect(pkg.files.map((f) => f.name)).toContain('MDMDiagReport.xml');
    expect(pkg.report?.rootElement).toBe('MDMEnterpriseDiagnosticsReport');
    expect(pkg.report?.sections.map((s) => [s.name, s.count])).toEqual([
      ['DeviceInfo', 1],
      ['Enrollment', 2],
      ['Certificate', 1],
      ['ProvisioningPackages', 1],
    ]);
    expect(pkg.report?.multivariant).toEqual(FIXTURE_MULTIVARIANT_CONDITIONS);
    expect(pkg.metadata.map((m) => m.key)).toEqual(['Tool', 'Arguments', 'RequestedBy']);
    expect(pkg.metadata[1]?.value).toBe('-area DeviceEnrollment;DeviceProvisioning;Autopilot');

    const json = JSON.stringify(pkg);
    expect(json).not.toContain('user@contoso.com');
    expect(json).not.toContain('geheim');
    expect(json).not.toContain('CONTOSO-SN-000042');
    expect(json).not.toContain('00000000-0000-0000-0000-000000000001');
  });

  it('wertet das MDM-Admin-Log aus dem Paket nur auf Anforderung aus', async () => {
    const bytes = buildMdmLogsCab({ adminLogEvtx: adminEvtx() });
    const wanted = await analyzeMdmCab(fakeZip(bytes), entry(FIXTURE_MDM_CAB_NAME), {
      ...OPTIONS,
      wantAdminLog: true,
    });
    expect(wanted.pkg.adminLogFromPackage).toBe(true);
    expect(wanted.adminLog).toMatchObject({
      id: 'mdmAdmin',
      status: 'ok',
      counts: { critical: 0, error: 4, warning: 1 },
      scanned: 7,
    });
    expect(wanted.adminLog?.entryPath).toContain('!microsoft-windows-devicemanagement');

    // Paket ohne .evtx → kein Protokoll, kein Fehler
    const without = await analyzeMdmCab(fakeZip(buildMdmLogsCab()), entry(FIXTURE_MDM_CAB_NAME), {
      ...OPTIONS,
      wantAdminLog: true,
    });
    expect(without.adminLog).toBeNull();
    expect(without.pkg.adminLogFromPackage).toBe(false);
  });

  it('Admin-Log über dem Dateigrößenlimit → Status tooLarge statt Entpacken', async () => {
    const bytes = buildMdmLogsCab({ adminLogEvtx: adminEvtx() });
    const { adminLog, pkg } = await analyzeMdmCab(fakeZip(bytes), entry(FIXTURE_MDM_CAB_NAME), {
      ...OPTIONS,
      wantAdminLog: true,
      maxFileBytes: 1000,
    });
    expect(adminLog?.status).toBe('tooLarge');
    expect(pkg.adminLogFromPackage).toBe(true);
  });

  it('unkomprimiertes Paket funktioniert ebenso', async () => {
    const bytes = buildMdmLogsCab({ compression: 'none', blockSize: 512 });
    const { pkg } = await analyzeMdmCab(fakeZip(bytes), entry(FIXTURE_MDM_CAB_NAME), OPTIONS);
    expect(pkg.reportStatus).toBe('ok');
    expect(pkg.report?.multivariantTotal).toBe(3);
  });

  it('LZX: Dateiliste bleibt lesbar, Auswertung „nicht unterstützt“', async () => {
    const lzx = buildCab(
      [
        { name: 'MDMDiagReport.xml', data: new TextEncoder().encode('<r/>') },
        { name: 'MdmDiagLogMetadata.json', data: new TextEncoder().encode('{}') },
      ],
      { rawTypeCompress: 0x1503 },
    );
    const { pkg } = await analyzeMdmCab(fakeZip(lzx), entry(FIXTURE_MDM_CAB_NAME), OPTIONS);
    expect(pkg.status).toBe('ok');
    expect(pkg.fileCount).toBe(2);
    expect(pkg.reportStatus).toBe('unsupported');
    expect(pkg.metadataStatus).toBe('unsupported');
    expect(pkg.unsupportedReason).toBe('lzx');
    expect(pkg.report).toBeNull();
  });

  it('fehlende Dateien → missing; kein XML → invalid; zu große XML → tooLarge', async () => {
    const noReport = buildCab([{ name: 'MdmLogCollectorFootPrint.txt', data: new Uint8Array(3) }]);
    const a = await analyzeMdmCab(fakeZip(noReport), entry(FIXTURE_MDM_CAB_NAME), OPTIONS);
    expect(a.pkg).toMatchObject({
      status: 'ok',
      reportStatus: 'missing',
      metadataStatus: 'missing',
    });

    const notXml = buildCab([
      { name: 'MDMDiagReport.xml', data: new TextEncoder().encode('kein xml') },
      { name: 'MdmDiagLogMetadata.json', data: new TextEncoder().encode('[1, 2]') },
    ]);
    const b = await analyzeMdmCab(fakeZip(notXml), entry(FIXTURE_MDM_CAB_NAME), OPTIONS);
    expect(b.pkg).toMatchObject({ reportStatus: 'invalid', metadataStatus: 'invalid' });

    const c = await analyzeMdmCab(fakeZip(buildMdmLogsCab()), entry(FIXTURE_MDM_CAB_NAME), {
      ...OPTIONS,
      maxXmlBytes: 100,
    });
    expect(c.pkg.reportStatus).toBe('tooLarge');
  });

  it('Pfadanteile im Cabinet-Namen werden toleriert und Benutzerpfade maskiert', async () => {
    const cab = buildCab([
      { name: 'Reports\\MDMDiagReport.xml', data: new TextEncoder().encode('<r><a/></r>') },
      { name: 'C:\\Users\\max.mustermann\\x.txt', data: new Uint8Array(1) },
    ]);
    const { pkg } = await analyzeMdmCab(fakeZip(cab), entry(FIXTURE_MDM_CAB_NAME), OPTIONS);
    expect(pkg.reportStatus).toBe('ok');
    expect(JSON.stringify(pkg.files)).not.toContain('max.mustermann');
  });

  it('Fehlerfälle ergeben Status statt Ausnahme: zu groß, nicht lesbar, kein Cabinet, gekappt', async () => {
    const bytes = buildMdmLogsCab();
    const tooLarge = await analyzeMdmCab(fakeZip(bytes), entry(FIXTURE_MDM_CAB_NAME), {
      ...OPTIONS,
      maxCabBytes: 100,
    });
    expect(tooLarge.pkg.status).toBe('tooLarge');
    expect(
      (await analyzeMdmCab(fakeZip('error'), entry(FIXTURE_MDM_CAB_NAME), OPTIONS)).pkg.status,
    ).toBe('unreadable');
    const junk = new TextEncoder().encode('dies ist kein Cabinet');
    expect(
      (await analyzeMdmCab(fakeZip(junk), entry(FIXTURE_MDM_CAB_NAME), OPTIONS)).pkg.status,
    ).toBe('invalid');

    const cut = bytes.subarray(0, Math.floor(bytes.length * 0.7));
    const truncated = await analyzeMdmCab(fakeZip(cut), entry(FIXTURE_MDM_CAB_NAME), OPTIONS);
    expect(truncated.pkg.status).toBe('ok');
    expect(truncated.pkg.truncated).toBe(true);
  });
});

describe('analyzeDiagnosticsZip mit MDM-Diagnosepaket', () => {
  const analyze = (entries: Record<string, Uint8Array>, options = {}) =>
    analyzeDiagnosticsZip(new File([zipSync(entries)], FIXTURE_FILE_NAME), options);
  const cabKey = (entries: Record<string, Uint8Array>): string =>
    Object.keys(entries).find((k) => k.includes('mdmlogs-'))!;
  const adminKey = (entries: Record<string, Uint8Array>): string =>
    Object.keys(entries).find((k) => k.includes('DeviceManagement-Enterprise'))!;

  it('Fixture: Paket wird gelesen, das Admin-Log kommt weiter aus dem ZIP', async () => {
    const progress: AnalysisProgress[] = [];
    const report = await analyze(buildFixtureEntries(), {
      onProgress: (p: AnalysisProgress) => progress.push(p),
    });
    expect(report.mdmDiag).toMatchObject({
      status: 'ok',
      reportStatus: 'ok',
      adminLogFromPackage: false,
    });
    expect(report.mdmDiag?.report?.multivariant).toEqual(FIXTURE_MULTIVARIANT_CONDITIONS);
    expect(report.eventLogs).toHaveLength(1);
    expect(report.eventLogs[0]?.entryPath).not.toContain('!');
    expect(progress.some((p) => p.stage === 'mdmCab')).toBe(true);
    expect(progress.at(-1)).toMatchObject({ stage: 'done' });
    // Das Paket zählt nicht zu den „nicht ausgewerteten Binärdateien“
    expect(report.analysisNotes.join('\n')).not.toContain('.cab');
  });

  it('ohne eigenes Admin-Log im ZIP wird das Protokoll aus dem Paket genutzt', async () => {
    const entries = buildFixtureEntries();
    delete entries[adminKey(entries)];
    const report = await analyze(entries);
    expect(report.eventLogs).toHaveLength(1);
    expect(report.eventLogs[0]).toMatchObject({
      id: 'mdmAdmin',
      status: 'ok',
      counts: { critical: 0, error: 4, warning: 1 },
    });
    expect(report.eventLogs[0]?.entryPath).toContain(`${FIXTURE_MDM_CAB_NAME}!`);
    expect(report.mdmDiag?.adminLogFromPackage).toBe(true);
  });

  it('ein unlesbares Admin-Log im ZIP wird durch das lesbare aus dem Paket ersetzt', async () => {
    const entries = buildFixtureEntries();
    entries[adminKey(entries)] = new Uint8Array([1, 2, 3, 4]);
    const report = await analyze(entries);
    const admin = report.eventLogs.filter((l) => l.id === 'mdmAdmin');
    expect(admin).toHaveLength(1);
    expect(admin[0]?.status).toBe('ok');
    expect(report.mdmDiag?.adminLogFromPackage).toBe(true);
  });

  it('ohne Paket bleibt mdmDiag leer; ein defektes Paket kippt die Analyse nicht', async () => {
    const without = buildFixtureEntries();
    delete without[cabKey(without)];
    expect((await analyze(without)).mdmDiag).toBeUndefined();

    const broken = buildFixtureEntries();
    broken[cabKey(broken)] = new TextEncoder().encode('MSCF kaputt');
    const report = await analyze(broken);
    expect(report.mdmDiag?.status).toBe('invalid');
    expect(report.win32Apps).toHaveLength(3);
  });

  it('Größenlimit für das Paket', async () => {
    const report = await analyze(buildFixtureEntries(), { maxMdmCabBytes: 100 });
    expect(report.mdmDiag?.status).toBe('tooLarge');
  });
});
