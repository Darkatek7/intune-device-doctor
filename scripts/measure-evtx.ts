/**
 * Misst den EVTX-Parser mit einem synthetischen Protokoll (Standard ~30 MB, fiktive Contoso-Daten).
 * Aufruf: npx tsx scripts/measure-evtx.ts [MB]
 */
import { buildEvtx, type EvtxEventInput } from '../src/diagnostics/evtxFixture';
import { parseEvtx } from '../src/diagnostics/parsers/evtx';

const targetMb = Number(process.argv[2] ?? 30);
const start = Date.parse('2026-09-01T00:00:00Z');

function make(count: number): EvtxEventInput[] {
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

let count = 4000;
let bytes = buildEvtx(make(count));
const perMb = bytes.length / count;
count = Math.ceil((targetMb * 1048576) / perMb);
const t0 = performance.now();
bytes = buildEvtx(make(count));
const buildMs = performance.now() - t0;
console.log(
  `Datei: ${(bytes.length / 1048576).toFixed(1)} MB, ${count} Ereignisse (Erzeugung ${Math.round(buildMs)} ms)`,
);

function run(label: string, options: Parameters<typeof parseEvtx>[1]): void {
  const t = performance.now();
  const result = parseEvtx(bytes, options);
  const ms = performance.now() - t;
  console.log(
    `${label}: ${Math.round(ms)} ms · dekodiert ${result.stats.recordsDecoded}, behalten ${result.events.length}, Chunks ${result.stats.chunksParsed}, capped=${result.stats.capped}`,
  );
}

run('Standard (max. 20 000 Datensätze)', {});
run('Standard + Filter Fehler/Warnung', { filter: (e) => (e.level ?? 9) <= 3 });
run('Alle Datensätze (ohne Begrenzung)', { maxRecords: Infinity, maxEvents: Infinity });
run('Alle, nur Fehler/Warnung behalten', {
  maxRecords: Infinity,
  maxEvents: Infinity,
  filter: (e) => (e.level ?? 9) <= 3,
});
