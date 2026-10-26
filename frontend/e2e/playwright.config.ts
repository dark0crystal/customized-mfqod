import { defineConfig, devices } from '@playwright/test';

/**
 * MFQOD e2e suite — framework-agnostic (URLs + DOM only).
 *   BASE_URL  app under test        (default http://127.0.0.1:3100 = frozen Next baseline)
 *   API_URL   FastAPI backend        (default http://127.0.0.1:8000)
 *   QA_CREDENTIALS  path to {email,password,username,user_id} JSON (see README)
 */
export const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  outputDir: 'test-results/artifacts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'Asia/Muscat',
    acceptDownloads: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
