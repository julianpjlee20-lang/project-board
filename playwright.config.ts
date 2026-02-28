import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 測試配置
 * 詳細文件請參考: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',

  // 測試超時設定
  timeout: 120 * 1000, // 增加到 2 分鐘
  expect: {
    timeout: 15 * 1000 // 增加預期超時
  },

  // 並行執行設定
  fullyParallel: false, // 關閉完全並行，避免資料庫衝突
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1, // 單執行緒避免資料庫競爭

  // 測試報告
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list']
  ],

  // 全域設定
  use: {
    // 基礎 URL
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',

    // 追蹤設定
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // 瀏覽器設定
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
  },

  // 測試專案配置
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // channel: 'chrome', // 改用 Playwright 內建的 Chromium 更穩定
        viewport: { width: 1920, height: 1080 },
        // 增加導航超時
        navigationTimeout: 30 * 1000,
        actionTimeout: 15 * 1000,
      },
    },
    // 可選擇性啟用其他瀏覽器
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Web Server 配置（自動啟動開發伺服器）
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000, // 增加到 3 分鐘,等待資料庫連接
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
