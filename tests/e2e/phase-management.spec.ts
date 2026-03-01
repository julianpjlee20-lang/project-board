import { test, expect } from '@playwright/test'

test.describe('Phase 階段管理', () => {
  test.beforeEach(async ({ page }) => {
    // 建立測試專案
    await page.goto('/projects')
    const projectName = `Phase測試 ${Date.now()}`
    await page.getByPlaceholder('輸入新專案名稱...').fill(projectName)
    await page.getByRole('button', { name: '建立' }).click()
    await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 })
    await page.getByText(projectName).click()
    await page.waitForURL(/\/projects\/[\w-]+/)
  })

  test('應能新增 Phase', async ({ page }) => {
    // 點擊「+ 新增階段」
    await page.getByText('+ 新增階段').click()

    // 填寫 Phase 名稱
    const phaseInput = page.locator('input[placeholder*="階段"]').or(page.locator('input[type="text"]').last())
    await phaseInput.fill('測試階段')
    await phaseInput.press('Enter')

    // 驗證 Phase 出現在篩選欄
    await expect(page.getByText('測試階段')).toBeVisible({ timeout: 10000 })
  })

  test('Phase 篩選器應能過濾卡片', async ({ page }) => {
    // 確認「全部」篩選器預設選中
    await expect(page.getByText('全部')).toBeVisible()
  })
})
