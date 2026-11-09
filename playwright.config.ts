import { defineConfig, devices } from '@playwright/test';

/**
 * E2E-Abnahme (M7): Demo-Modus gegen den Produktions-Build (vite preview).
 * Nur Chromium; vier Projekte für Light/Dark/Mobil/Reduced-Motion.
 */
/** Port des Preview-Servers; per E2E_PORT änderbar (parallele Läufe in mehreren Worktrees). */
const port = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { VITE_APP_MODE: 'demo' },
  },
  projects: [
    {
      name: 'desktop-light',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        colorScheme: 'light',
        // Standard ist Dunkel – das Light-Projekt wählt Hell wie per Toolbar-Schalter.
        storageState: {
          cookies: [],
          origins: [
            {
              origin: 'http://localhost:4173',
              localStorage: [{ name: 'mdm-doctor.theme', value: 'light' }],
            },
          ],
        },
      },
    },
    {
      name: 'desktop-dark',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        colorScheme: 'dark',
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
    {
      name: 'reduced-motion',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        reducedMotion: 'reduce',
      },
    },
  ],
});
