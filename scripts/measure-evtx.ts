/**
 * Misst den EVTX-Parser mit einem synthetischen Protokoll (Standard ~30 MB, fiktive Contoso-Daten).
 * Gehört nicht zur Vitest-Suite (Speicher!). Aufrufe:
 *   NODE_OPTIONS=--max-old-space-size=1536 npx tsx scripts/measure-evtx.ts [MB]
 *   npx tsx scripts/measure-evtx.ts --write <Datei> [MB]    # nur erzeugen (Datei außerhalb des Repos ablegen)
 *   NODE_OPTIONS=--max-old-space-size=256 npx tsx scripts/measure-evtx.ts --read <Datei>
 * `--write` + `--read` messen den Parser in einem frischen Prozess ohne Generator-Ballast.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildEvtx, type EvtxEventInput } from '../src/diagnostics/evtxFixture';
import { parseEvtx } from '../src/diagnostics/parsers/evtx';

const args = process.argv.slice(2);
const mode = args[0] === '--write' || args[0] === '--read' ? args[0] : null;
const filePath = mode ? args[1] : undefined;
const targetMb = Number((mode === '--write' ? args[2] : mode ? undefined : args[0]) ?? 30);
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

function generate(): Uint8Array {
  let count = 4000;
  const perEvent = buildEvtx(make(count)).length / count;
  count = Math.ceil((targetMb * 1048576) / perEvent);
  const t0 = performance.now();
  const out = buildEvtx(make(count));
  console.log(
    `Datei: ${(out.length / 1048576).toFixed(1)} MB, ${count} Ereignisse (Erzeugung ${Math.round(performance.now() - t0)} ms)`,
  );
  return out;
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
  console.log(`Datei: ${(bytes.length / 1048576).toFixed(1)} MB (gelesen)`);
} else {
  bytes = generate();
}

const mb = (n: number): string => `${(n / 1048576).toFixed(0)} MB`;

function memory(): string {
  const m = process.memoryUsage();
  return `Heap ${mb(m.heapUsed)}, RSS ${mb(m.rss)}, ArrayBuffers ${mb(m.arrayBuffers)}, max. RSS ${mb(process.resourceUsage().maxRSS * 1024)}`;
}

console.log(`Vor dem Parsen: ${memory()}`);

function run(label: string, options: Parameters<typeof parseEvtx>[1]): void {
  const t = performance.now();
  const result = parseEvtx(bytes, options);
  const ms = performance.now() - t;
  console.log(
    `${label}: ${Math.round(ms)} ms · dekodiert ${result.stats.recordsDecoded}, behalten ${result.events.length}, Chunks ${result.stats.chunksParsed}, capped=${result.stats.capped}\n    ${memory()}`,
  );
}

// Jüngstes Ereignis ermitteln (für das 14-Tage-Fenster); dabei wird nichts behalten.
let lastMs = start;
run('Alle Datensätze dekodieren, nichts behalten (Worst Case Laufzeit)', {
  maxRecords: Infinity,
  maxEvents: Infinity,
  filter: (e) => {
    const ms = e.timeCreated ? Date.parse(e.timeCreated) : NaN;
    if (Number.isFinite(ms) && ms > lastMs) lastMs = ms;
    return false;
  },
});

const productionLike = (e: { level: number | null }): boolean =>
  e.level !== null && e.level >= 1 && e.level <= 3;

// Wie in der App (eventLogs.ts): Mengenbegrenzung + Filter während des Parsens, 14-Tage-Fenster.
run('App-Einstellung (Fenster 14 Tage, max. 20 000 Datensätze, Filter)', {
  maxRecords: 20_000,
  maxEvents: 5000,
  since: lastMs - 14 * 86_400_000,
  filter: productionLike,
});
run('Ohne Fenster, max. 20 000 Datensätze, Filter', {
  maxRecords: 20_000,
  maxEvents: 5000,
  filter: productionLike,
});
run('Alle dekodieren, nur Fehler/Warnung behalten', {
  maxRecords: Infinity,
  maxEvents: Infinity,
  filter: productionLike,
});
