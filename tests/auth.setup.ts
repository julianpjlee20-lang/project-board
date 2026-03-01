import { test as setup, expect } from '@playwright/test'
import { TEST_USER } from './global-setup'

const AUTH_FILE = 'tests/.auth/user.json'

setup('authenticate', async ({ page }) => {
  // 前往登入頁
  await page.goto('/login')

  // 填寫帳密
  await page.getByPlaceholder('Email').fill(TEST_USER.email)
  await page.getByPlaceholder('密碼（至少 6 字元）').fill(TEST_USER.password)

  // 提交登入（使用 type=submit 以區分多個登入相關按鈕）
  await page.getByRole('button', { name: '登入', exact: true }).first().click()

  // 等待導航到 /projects（登入成功）
  await page.waitForURL('**/projects', { timeout: 15000 })
  await expect(page.getByRole('heading', { name: '專案列表' })).toBeVisible()

  // 儲存認證狀態供後續測試使用
  await page.context().storageState({ path: AUTH_FILE })
})
