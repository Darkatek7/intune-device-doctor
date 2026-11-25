import lockRaw from '../../../docs/posture-sources.lock.json?raw';
import { describe, expect, it } from 'vitest';
import {
  isPostureCatalogStale,
  POSTURE_CATALOG_STALE_AFTER_DAYS,
  POSTURE_CATALOG_VERIFIED_ON,
  postureCatalogAgeDays,
  postureSourceLinks,
  postureSourcePages,
} from './sources';

interface Lock {
  version: number;
  pages: Record<string, { sha256: string; reportedDate: string | null; fragments: string[] }>;
}

const lock = JSON.parse(lockRaw) as Lock;

describe('Sperrdatei der Quellseiten', () => {
  it('enthält genau die Seiten der Verweise – bei neuer Quelle `npm run posture:sources -- --update` ausführen', () => {
    expect(Object.keys(lock.pages).sort()).toEqual(postureSourcePages());
  });

  it('enthält alle Sprungmarken der Verweise (und keine weiteren)', () => {
    for (const page of postureSourcePages()) {
      const expected = [
        ...new Set(
          postureSourceLinks()
            .filter((l) => l.page === page && l.fragment)
            .map((l) => l.fragment as string),
        ),
      ].sort();
      expect(lock.pages[page]?.fragments, page).toEqual(expected);
    }
  });

  it('hat je Seite einen SHA-256-Hash', () => {
    for (const entry of Object.values(lock.pages)) expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('Alter der Sollwerte', () => {
  const verified = Date.parse(`${POSTURE_CATALOG_VERIFIED_ON}T00:00:00Z`);
  const day = 86_400_000;

  it('zählt ganze Tage seit der Prüfung', () => {
    expect(postureCatalogAgeDays(new Date(verified))).toBe(0);
    expect(postureCatalogAgeDays(new Date(verified + 10 * day + 3600_000))).toBe(10);
  });

  it('wird nie negativ', () => {
    expect(postureCatalogAgeDays(new Date(verified - 5 * day))).toBe(0);
  });

  it('gilt erst nach der Frist als veraltet', () => {
    expect(isPostureCatalogStale(new Date(verified + POSTURE_CATALOG_STALE_AFTER_DAYS * day))).toBe(
      false,
    );
    expect(
      isPostureCatalogStale(new Date(verified + (POSTURE_CATALOG_STALE_AFTER_DAYS + 1) * day)),
    ).toBe(true);
  });
});
