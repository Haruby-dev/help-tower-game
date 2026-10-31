import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // เครื่องของ GitHub ไม่มีการ์ดจอ จอใหญ่วาดช้ามาก จึงรันทีละข้อและรอได้นานขึ้น
  workers: process.env.CI ? 1 : undefined,
  timeout: process.env.CI ? 120_000 : 30_000,
  expect: { timeout: process.env.CI ? 30_000 : 5_000 },
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/help-tower-game/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'mobile-landscape',
      use: { ...devices['Pixel 7 landscape'] },
    },
    {
      name: 'iphone-landscape',
      use: { ...devices['iPhone 15 Pro Max landscape'] },
    },
  ],
});
