import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:1422',
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    locale: 'zh-CN',
    viewport: { width: 1360, height: 900 },
    headless: true,
  },
  webServer: {
    command: 'pnpm preview --host 127.0.0.1 --port 1422 --strictPort',
    url: 'http://127.0.0.1:1422',
    reuseExistingServer: false,
  },
});
