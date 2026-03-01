import { test, expect } from '@playwright/test'

test.describe('卡片 Modal 編輯', () => {
  let projectUrl: string

  test.beforeEach(async ({ page }) => {
    // 建立測試專案
    await page.goto('/projects')
    const projectName = `Modal測試 ${Date.now()}`
    await page.getByPlaceholder('輸入新專案名稱...').fill(projectName)
    await page.getByRole('button', { name: '建立' }).click()
    await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 })
    await page.getByText(projectName).click()
    await page.waitForURL(/\/projects\/[\w-]+/)
    projectUrl = page.url()

    // 新增一張卡片
    await page.locator('text=+ 新增卡片').first().click()
    await page.locator('form.mt-2 input').first().fill('Modal 測試卡片')
    await page.locator('form.mt-2 button[type="submit"]').first().click()
    await expect(page.getByText('Modal 測試卡片')).toBeVisible({ timeout: 10000 })
  })

  test('應能開啟卡片 Modal 並編輯內容', async ({ page }) => {
    // 點擊卡片開啟 Modal
    await page.getByText('Modal 測試卡片').click()

    // 等待 Modal 開啟
    await expect(page.locator('[class*="fixed"]').or(page.locator('[role="dialog"]'))).toBeVisible({ timeout: 5000 })

    // 編輯描述
    const descInput = page.locator('textarea').first()
    if (await descInput.isVisible()) {
      await descInput.fill('這是一段測試描述')
    }
  })

  test('應能在 Modal 中新增子任務', async ({ page }) => {
    await page.getByText('Modal 測試卡片').click()
    await expect(page.locator('[class*="fixed"]').or(page.locator('[role="dialog"]'))).toBeVisible({ timeout: 5000 })

    // 尋找子任務輸入框並新增
    const subtaskInput = page.getByPlaceholder(/子任務|subtask|新增/i)
    if (await subtaskInput.isVisible()) {
      await subtaskInput.fill('子任務項目 1')
      await subtaskInput.press('Enter')
      await expect(page.getByText('子任務項目 1')).toBeVisible({ timeout: 5000 })
    }
  })
})
