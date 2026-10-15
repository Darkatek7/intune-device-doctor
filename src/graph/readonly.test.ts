/**
 * Statischer Wächter für die harte Regel "Read-only": Im Graph-/Auth-Code darf weder ein
 * schreibendes HTTP-Verb vorkommen noch ein $select auf den BitLocker-Schlüsselwert.
 */
import { describe, expect, it } from 'vitest';

const sources = import.meta.glob(
  ['/src/graph/**/*.{ts,tsx}', '/src/providers/graph/**/*.{ts,tsx}', '/src/auth/**/*.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const files = Object.entries(sources).filter(([name]) => !/\.test\.(ts|tsx)$/.test(name));

describe('Read-only-Wächter', () => {
  it('prüft tatsächlich Quelldateien', () => {
    const names = files.map(([name]) => name);
    expect(names).toContain('/src/graph/client.ts');
    expect(names).toContain('/src/providers/graph/GraphProvider.ts');
    expect(names).toContain('/src/auth/token.ts');
  });

  it.each(files)('%s enthält kein schreibendes HTTP-Verb und kein $select=key', (_name, raw) => {
    const code = stripComments(raw);
    expect(code).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/i);
    expect(code).not.toMatch(/\$select=[^&'"`\s]*\bkey\b/i);
  });
});
