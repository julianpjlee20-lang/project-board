import { test, expect } from '@playwright/test'

test.describe('專案 CRUD', () => {
  test('應顯示專案列表頁面', async ({ page }) => {
    await page.goto('/projects')

    await expect(page.getByRole('heading', { name: '專案列表' })).toBeVisible()
    await expect(page.getByPlaceholder('輸入新專案名稱...')).toBeVisible()
    await expect(page.getByRole('button', { name: '建立' })).toBeVisible()
  })

  test('應能建立新專案並顯示在列表中', async ({ page }) => {
    await page.goto('/projects')

    const projectName = `測試專案 ${Date.now()}`
    await page.getByPlaceholder('輸入新專案名稱...').fill(projectName)
    await page.getByRole('button', { name: '建立' }).click()

    // 等待專案出現在列表中
    await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 })
  })

  test('應能點擊專案進入看板頁面', async ({ page }) => {
    await page.goto('/projects')

    // 等待專案列表載入
    await page.waitForSelector('[data-slot="card"]', { timeout: 10000 })

    // 點擊第一個專案
    await page.locator('[data-slot="card"]').first().click()

    // 應該導航到專案詳細頁
    await page.waitForURL(/\/projects\/[\w-]+/)
    await expect(page.getByText('Board')).toBeVisible()
  })
})
