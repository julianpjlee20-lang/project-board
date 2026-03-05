import { test, expect } from '@playwright/test'

test.describe('看板視圖', () => {
  let projectId: string

  test.beforeAll(async ({ request }) => {
    // 透過 API 建立共用測試專案
    const res = await request.post('/api/projects', {
      data: { name: `Board測試 ${Date.now()}` }
    })
    expect(res.ok()).toBeTruthy()
    const project = await res.json()
    projectId = project.id
  })

  test.afterAll(async ({ request }) => {
    // 清理測試專案（CASCADE 會刪除相關欄位、卡片等）
    if (projectId) {
      await request.delete(`/api/projects/${projectId}`)
    }
  })

  test('應顯示預設三個欄位 (待辦, 進行中, 已完成)', async ({ page }) => {
    await page.goto(`/projects/${projectId}`)
    await expect(page.getByText('待辦')).toBeVisible()
    await expect(page.getByText('進行中')).toBeVisible()
    await expect(page.getByText('已完成')).toBeVisible()
  })

  test('應能新增欄位', async ({ page }) => {
    await page.goto(`/projects/${projectId}`)
    const columnName = `新欄位 ${Date.now()}`
    await page.getByPlaceholder('新欄位名稱...').fill(columnName)
    await page.getByPlaceholder('新欄位名稱...').press('Enter')

    await expect(page.getByText(columnName)).toBeVisible({ timeout: 10000 })
  })

  test('應能新增卡片到欄位', async ({ page }) => {
    await page.goto(`/projects/${projectId}`)
    // 點擊第一個欄位的「+ 新增卡片」
    await page.locator('text=+ 新增卡片').first().click()

    // 填寫卡片名稱並提交
    const cardTitle = `測試卡片 ${Date.now()}`
    await page.locator('form.mt-2 input').first().fill(cardTitle)
    await page.locator('form.mt-2 button[type="submit"]').first().click()

    await expect(page.getByText(cardTitle)).toBeVisible({ timeout: 10000 })
  })

  test('應能切換四種視圖', async ({ page }) => {
    await page.goto(`/projects/${projectId}`)
    // 看板視圖（預設）
    await expect(page.getByText('待辦')).toBeVisible()

    // 列表視圖
    await page.getByText('📝 列表').click()
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 })

    // 行事曆視圖
    await page.getByText('📅 行事曆').click()
    await expect(page.getByText('日').first()).toBeVisible({ timeout: 5000 })

    // 進度視圖
    await page.getByText('📊 進度').click()
    await expect(page.getByText('整體進度')).toBeVisible({ timeout: 5000 })

    // 回到看板視圖
    await page.getByText('📋 看板').click()
    await expect(page.getByText('待辦')).toBeVisible()
  })
})
