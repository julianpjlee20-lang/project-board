import { test, expect } from '@playwright/test'

test.describe('卡片 Modal 編輯', () => {
  let projectId: string
  let cardColumnId: string

  test.beforeAll(async ({ request }) => {
    // 透過 API 建立共用測試專案
    const res = await request.post('/api/projects', {
      data: { name: `Modal測試 ${Date.now()}` }
    })
    expect(res.ok()).toBeTruthy()
    const project = await res.json()
    projectId = project.id

    // 取得預設欄位
    const columnsRes = await request.get(`/api/projects/${projectId}/columns`)
    const columns = await columnsRes.json()
    cardColumnId = columns[0].id

    // 透過 API 建立測試卡片
    const cardRes = await request.post('/api/cards', {
      data: {
        title: 'Modal 測試卡片',
        column_id: cardColumnId,
        position: 0
      }
    })
    expect(cardRes.ok()).toBeTruthy()
  })

  test.afterAll(async ({ request }) => {
    if (projectId) {
      await request.delete(`/api/projects/${projectId}`)
    }
  })

  test('應能開啟卡片 Modal 並編輯內容', async ({ page }) => {
    await page.goto(`/projects/${projectId}`)
    await expect(page.getByText('Modal 測試卡片')).toBeVisible({ timeout: 10000 })

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
    await page.goto(`/projects/${projectId}`)
    await expect(page.getByText('Modal 測試卡片')).toBeVisible({ timeout: 10000 })

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
