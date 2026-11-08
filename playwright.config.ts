import { defineConfig, devices } from '@playwright/test';

/**
 * Browser checks of the menus on phones (tests/e2e). They drive the dev server, whose `?screen=` deep links open each
 * screen straight away (src/app/main.ts devScreen). Run with `npm run test:e2e`; heavy, so off the laptop (see README).
 */
const PORT = 5179;
/** E2E_BASE_URL: run the checks against a dev server already running elsewhere (for example a copy of the base commit). */
const external = process.env.E2E_BASE_URL;
const phone = (width: number, height: number) => ({ ...devices['Pixel 7'], viewport: { width, height }, deviceScaleFactor: 1 });

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.ts',
  timeout: 120_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list']],
  use: { baseURL: external ?? `http://localhost:${PORT}/`, locale: 'es-ES', trace: 'off' },
  ...(external ? {} : { webServer: { command: `npx vite --port ${PORT} --strictPort`, url: `http://localhost:${PORT}/`, reuseExistingServer: true, timeout: 120_000 } }),
  projects: [
    { name: 'phone-320x640', use: phone(320, 640), testMatch: 'mobile-*.spec.ts' },
    { name: 'phone-360x800', use: phone(360, 800), testMatch: 'mobile-*.spec.ts' },
    { name: 'phone-390x844', use: phone(390, 844), testMatch: 'mobile-*.spec.ts' },
    { name: 'phone-412x915', use: phone(412, 915), testMatch: 'mobile-*.spec.ts' },
    { name: 'phone-844x390', use: phone(844, 390), testMatch: 'mobile-*.spec.ts' },
    { name: 'desktop-1440x900', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testMatch: 'desktop-*.spec.ts' },
  ],
});
