import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  webServer: { command: 'npm run dev -- --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
  use: { baseURL: 'http://127.0.0.1:5173', headless: true, launchOptions: process.platform === 'darwin' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {} },
  reporter: 'list',
});
