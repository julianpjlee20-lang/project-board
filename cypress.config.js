// eslint-disable-next-line @typescript-eslint/no-require-imports
const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    // 基礎 URL
    baseUrl: 'http://localhost:3000',

    // 測試文件位置
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',

    // 支援文件
    supportFile: 'cypress/support/e2e.ts',

    // 截圖和影片
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    video: true,

    // 測試設定
    viewportWidth: 1920,
    viewportHeight: 1080,
    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    responseTimeout: 15000,

    // 自動重試（失敗時）
    retries: {
      runMode: 2,
      openMode: 0,
    },

    setupNodeEvents(on, config) {
      return config
    },
  },
})
