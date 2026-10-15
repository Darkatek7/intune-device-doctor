/**
 * Windows-Versionen nach OS-Build (Stand 2026-10-15). Nur Werte aus den offiziellen Seiten:
 * - Windows 11: https://learn.microsoft.com/windows/release-health/windows11-release-information
 * - Windows 10: https://learn.microsoft.com/windows/release-health/release-information
 * - Lebenszyklus: https://learn.microsoft.com/lifecycle/products/windows-11-enterprise-and-education
 *   und https://learn.microsoft.com/lifecycle/products/windows-11-home-and-pro
 * Unbekannte Builds werden NICHT geraten (→ Severity unknown).
 */

export const WINDOWS11_RELEASE_INFO_URL =
  'https://learn.microsoft.com/windows/release-health/windows11-release-information';
export const WINDOWS10_RELEASE_INFO_URL =
  'https://learn.microsoft.com/windows/release-health/release-information';

export interface WindowsRelease {
  /** Hauptbuild, z. B. 26200 */
  build: number;
  product: 'Windows 10' | 'Windows 11';
  /** Funktionsupdate, z. B. "25H2" */
  version: string;
  availability: string | null;
  /** Ende der Updates Home/Pro (ISO-Datum) */
  endOfUpdatesHomePro: string;
  /** Ende der Updates Enterprise/Education (ISO-Datum) */
  endOfUpdatesEnterprise: string;
  /** Letzter Build laut Release-Info zum Stand-Datum (nur informativ) */
  latestBuild: string | null;
  docsUrl: string;
}

export const WINDOWS_RELEASES_AS_OF = '2026-10-15';

export const WINDOWS_RELEASES: WindowsRelease[] = [
  {
    build: 26300,
    product: 'Windows 11',
    version: '26H2',
    availability: '2026-09-29',
    endOfUpdatesHomePro: '2028-10-10',
    endOfUpdatesEnterprise: '2029-10-09',
    latestBuild: '26300.9711',
    docsUrl: WINDOWS11_RELEASE_INFO_URL,
  },
  {
    build: 28000,
    product: 'Windows 11',
    version: '26H1',
    availability: '2026-02-10',
    endOfUpdatesHomePro: '2028-03-14',
    endOfUpdatesEnterprise: '2029-03-13',
    latestBuild: '28000.3231',
    docsUrl: WINDOWS11_RELEASE_INFO_URL,
  },
  {
    build: 26200,
    product: 'Windows 11',
    version: '25H2',
    availability: '2025-09-30',
    endOfUpdatesHomePro: '2027-10-12',
    endOfUpdatesEnterprise: '2028-10-10',
    latestBuild: '26200.9711',
    docsUrl: WINDOWS11_RELEASE_INFO_URL,
  },
  {
    build: 26100,
    product: 'Windows 11',
    version: '24H2',
    availability: '2024-10-01',
    // Lifecycle-Seite Home/Pro: 10/14/2026 6:59:59 AM UTC → 2026-10-13
    endOfUpdatesHomePro: '2026-10-13',
    endOfUpdatesEnterprise: '2027-10-12',
    latestBuild: '26100.9711',
    docsUrl: WINDOWS11_RELEASE_INFO_URL,
  },
  {
    build: 22631,
    product: 'Windows 11',
    version: '23H2',
    availability: '2023-10-31',
    // Lifecycle-Seite Home/Pro: 11/12/2025 6:59:59 AM UTC → 2025-11-11
    endOfUpdatesHomePro: '2025-11-11',
    endOfUpdatesEnterprise: '2026-11-10',
    latestBuild: '22631.7652',
    docsUrl: WINDOWS11_RELEASE_INFO_URL,
  },
  {
    build: 22621,
    product: 'Windows 11',
    version: '22H2',
    availability: null,
    // Lifecycle-Seiten: Home/Pro 10/9/2024, Enterprise/Education 10/15/2025 (jeweils 6:59:59 AM UTC)
    endOfUpdatesHomePro: '2024-10-08',
    endOfUpdatesEnterprise: '2025-10-14',
    latestBuild: null,
    docsUrl: WINDOWS11_RELEASE_INFO_URL,
  },
  {
    build: 19045,
    product: 'Windows 10',
    version: '22H2',
    availability: '2022-10-18',
    // "On October 14, 2025, Windows 10 reached end of support." (ESU separat)
    endOfUpdatesHomePro: '2025-10-14',
    endOfUpdatesEnterprise: '2025-10-14',
    latestBuild: null,
    docsUrl: WINDOWS10_RELEASE_INFO_URL,
  },
];

export interface ParsedWindowsVersion {
  major: number;
  minor: number;
  build: number;
  revision: number | null;
}

/** "10.0.26200.9711" → { build: 26200, revision: 9711 }. Ungültig → null. */
export function parseWindowsVersion(
  osVersion: string | null | undefined,
): ParsedWindowsVersion | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$/.exec((osVersion ?? '').trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    build: Number(match[3]),
    revision: match[4] !== undefined ? Number(match[4]) : null,
  };
}

export function findWindowsRelease(build: number): WindowsRelease | undefined {
  return WINDOWS_RELEASES.find((release) => release.build === build);
}
