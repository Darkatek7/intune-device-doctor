/**
 * CLI: schreibt das synthetische DiagLogs-Fixture nach tests/fixtures/ (gitignored).
 * Aufruf: npm run fixture
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFixtureZip, FIXTURE_FILE_NAME } from '../src/diagnostics/fixture';

export { buildFixtureZip, FIXTURE_FILE_NAME } from '../src/diagnostics/fixture';

const scriptPath = fileURLToPath(import.meta.url);

// Nur beim direkten Ausführen schreiben, nicht beim Import.
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const outDir = join(dirname(scriptPath), '..', 'tests', 'fixtures');
  const outPath = join(outDir, FIXTURE_FILE_NAME);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, buildFixtureZip());
  console.log(`Fixture geschrieben: ${outPath}`);
}
