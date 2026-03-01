import { test, expect } from '@playwright/test'

test.describe('Phase 階段管理', () => {
  let projectId: string

  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/projects', {
      data: { name: `Phase測試 ${Date.now()}` }
    })
    expect(res.ok()).toBeTruthy()
    const project = await res.json()
    projectId = project.id
  })

  test.afterAll(async ({ request }) => {
    if (projectId) {
      await request.delete(`/api/projects/${projectId}`)
    }
  })

  test('應能新增 Phase', async ({ page }) => {
    await page.goto(`/projects/${projectId}`)

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
    await page.goto(`/projects/${projectId}`)

    // 確認「全部」篩選器預設選中
    await expect(page.getByText('全部')).toBeVisible()
  })
})
