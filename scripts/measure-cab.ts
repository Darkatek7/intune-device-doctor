/**
 * Misst die Auswertung des MDM-Diagnosepakets (`mdmlogs-*.cab`, M13) mit einem synthetischen
 * Cabinet (Standard ~20 MB, fiktive Contoso-Daten). Gehört nicht zur Vitest-Suite (Speicher!).
 *   NODE_OPTIONS=--max-old-space-size=1536 npx tsx scripts/measure-cab.ts [MB]
 *   npx tsx scripts/measure-cab.ts --write <Datei> [MB]    # nur erzeugen (Datei außerhalb des Repos ablegen)
 *   NODE_OPTIONS=--max-old-space-size=256 npx tsx scripts/measure-cab.ts --read <Datei>
 * `--write` + `--read` messen die Auswertung in einem frischen Prozess ohne Generator-Ballast.
 *
 * Aufbau des Pakets (alles in EINEM Ordner, wie von makecab standardmäßig angelegt – Annahme):
 * zuerst eine nicht komprimierbare Füll-Datei (Pseudozufall, erzwingt die Paketgröße), dann
 * MDMDiagReport.xml, dann das MDM-Admin-Ereignisprotokoll. Damit müssen für den Bericht und das
 * Protokoll alle davor liegenden Blöcke durchlaufen werden (ungünstigster Fall).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { analyzeMdmCab } from '../src/diagnostics/mdmCab';
import { buildCab, type CabFileInput } from '../src/diagnostics/cabFixture';
import { buildEvtx, type EvtxEventInput } from '../src/diagnostics/evtxFixture';
import { openCab } from '../src/diagnostics/parsers/cab';
import { summarizeMdmDiagReport } from '../src/diagnostics/parsers/mdmDiagReport';
import { parseEntryName } from '../src/diagnostics/parsers/entryName';
import type { OpenedZip } from '../src/diagnostics/zip/reader';

const args = process.argv.slice(2);
const mode = args[0] === '--write' || args[0] === '--read' ? args[0] : null;
const filePath = mode ? args[1] : undefined;
const targetMb = Number((mode === '--write' ? args[2] : mode ? undefined : args[0]) ?? 20);
const MIB = 1048576;
const encoder = new TextEncoder();

/** Deterministischer Pseudozufall (xorshift32) – nicht komprimierbar, ohne Zufallsquelle. */
function noise(length: number): Uint8Array {
  const out = new Uint8Array(length);
  let x = 0x2545f491;
  for (let i = 0; i < length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    out[i] = x & 0xff;
  }
  return out;
}

/** MDMDiagReport.xml mit fiktivem Aufbau (Learn beschreibt den Elementaufbau nicht). */
function makeReportXml(targetBytes: number): Uint8Array {
  const parts: string[] = [
    '<?xml version="1.0" encoding="utf-8"?>\n<MDMEnterpriseDiagnosticsReport>\n',
  ];
  let size = parts[0]!.length;
  for (let i = 0; size < targetBytes; i++) {
    const block =
      `  <Package Id="{00000000-0000-0000-0000-${String(i).padStart(12, '0')}}" Name="Contoso Paket ${i}">\n` +
      `    <Multivariant Condition="Name=Lang Value=de"/>\n` +
      `    <Multivariant><Condition Name="Architecture" Value="Pattern:.*64.*"/></Multivariant>\n` +
      `    <Setting Name="Contoso/Beispiel/${i}" Value="${i}"/>\n` +
      `  </Package>\n`;
    parts.push(block);
    size += block.length;
  }
  parts.push('</MDMEnterpriseDiagnosticsReport>\n');
  return encoder.encode(parts.join(''));
}

function makeEvents(count: number): EvtxEventInput[] {
  const start = Date.parse('2026-10-01T00:00:00Z');
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(start + i * 20_000),
    eventId: [76, 75, 404, 814, 1819, 208][i % 6]!,
    level: [2, 4, 3, 4, 2, 4][i % 6]!,
    style: i % 5 === 0 ? ('binxml' as const) : ('template' as const),
    data: [
      ['EnrollmentID', '00000000-0000-0000-0000-00000000000A'],
      ['Result', `-21470236${i % 100}`],
      [
        'Message',
        `Contoso Demo-Ereignis ${i}: Auto MDM Enroll (Unknown Win32 Error code: 0x8018002b)`,
      ],
    ] as Array<[string, string]>,
  }));
}

function generate(): Uint8Array {
  const t0 = performance.now();
  const xml = makeReportXml(3 * MIB);
  const evtx = buildEvtx(makeEvents(12_000));
  const fillBytes = Math.max(0, Math.round(targetMb * MIB) - Math.round(evtx.length * 0.05));
  const files: CabFileInput[] = [
    { name: 'DiagnosticLogCSP_Collector_Autopilot_Beispiel.etl', data: noise(fillBytes) },
    { name: 'MDMDiagReport.xml', data: xml },
    {
      name: 'microsoft-windows-devicemanagement-enterprise-diagnostics-provider-admin.evtx',
      data: evtx,
    },
  ];
  const cab = buildCab(files, { compression: 'mszip' });
  console.log(
    `Paket: ${(cab.length / MIB).toFixed(1)} MB (Füll-Datei ${(fillBytes / MIB).toFixed(1)} MB, ` +
      `MDMDiagReport.xml ${(xml.length / MIB).toFixed(1)} MB, .evtx ${(evtx.length / MIB).toFixed(1)} MB; ` +
      `Erzeugung ${Math.round(performance.now() - t0)} ms)`,
  );
  return cab;
}

if (mode === '--write') {
  if (!filePath) throw new Error('Pfad fehlt');
  writeFileSync(filePath, generate());
  console.log(`geschrieben: ${filePath}`);
  process.exit(0);
}

let bytes: Uint8Array;
if (mode === '--read') {
  if (!filePath) throw new Error('Pfad fehlt');
  bytes = readFileSync(filePath);
  console.log(`Paket: ${(bytes.length / MIB).toFixed(1)} MB (gelesen)`);
} else {
  bytes = generate();
}

const mb = (n: number): string => `${(n / MIB).toFixed(0)} MB`;
function memory(): string {
  const m = process.memoryUsage();
  return `Heap ${mb(m.heapUsed)}, RSS ${mb(m.rss)}, ArrayBuffers ${mb(m.arrayBuffers)}, max. RSS ${mb(process.resourceUsage().maxRSS * 1024)}`;
}

console.log(`Vor der Auswertung: ${memory()}`);

const entry = parseEntryName(
  '(22) FoldersFiles Users_Public_Documents_MDMDiagnostics/mdmlogs-20261014-125312.cab',
  bytes.length,
  false,
)!;
const zip: Pick<OpenedZip, 'readBytes'> = {
  async readBytes() {
    return { ok: true, bytes };
  },
};

let t = performance.now();
const cab = openCab(bytes);
console.log(
  `Dateiliste lesen (openCab): ${Math.round(performance.now() - t)} ms · ${cab.files.length} Dateien, ${cab.folders.length} Ordner, ` +
    `Kompression ${cab.folders[0]?.compression}\n    ${memory()}`,
);

for (const wantAdminLog of [false, true]) {
  t = performance.now();
  const { pkg, adminLog } = await analyzeMdmCab(zip, entry, {
    referenceUtc: '2026-10-14T12:53:56Z',
    windowDays: 14,
    wantAdminLog,
  });
  console.log(
    `analyzeMdmCab (Admin-Log ${wantAdminLog ? 'mit' : 'ohne'}): ${Math.round(performance.now() - t)} ms · ` +
      `Paket ${pkg.status}, Bericht ${pkg.reportStatus} (${pkg.report?.elementCount ?? 0} Elemente, ` +
      `${pkg.report?.multivariantTotal ?? 0} Bedingungen, gekappt=${pkg.report?.truncated ?? '-'}), ` +
      `Admin-Log ${adminLog ? `${adminLog.status}, ${adminLog.scanned} geprüft` : 'nicht gelesen'}\n    ${memory()}`,
  );
}

// Bericht an der Größengrenze (Standard 16 MiB entpackt), nur der XML-Leser.
const bigXml = new TextDecoder().decode(makeReportXml(15 * MIB));
t = performance.now();
const summary = summarizeMdmDiagReport(bigXml);
console.log(
  `summarizeMdmDiagReport (${(bigXml.length / MIB).toFixed(1)} MB XML): ${Math.round(performance.now() - t)} ms · ` +
    `${summary?.elementCount ?? 0} Elemente, gekappt=${summary?.truncated}, Bedingungen ${summary?.multivariantTotal}\n    ${memory()}`,
);
