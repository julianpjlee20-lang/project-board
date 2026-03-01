import { test, expect } from '@playwright/test'

test.describe('專案 CRUD', () => {
  const createdProjectIds: string[] = []

  test.afterAll(async ({ request }) => {
    // 清理所有測試中建立的專案
    for (const id of createdProjectIds) {
      await request.delete(`/api/projects/${id}`)
    }
  })

  test('應顯示專案列表頁面', async ({ page }) => {
    await page.goto('/projects')

    await expect(page.getByRole('heading', { name: '專案列表' })).toBeVisible()
    await expect(page.getByPlaceholder('輸入新專案名稱...')).toBeVisible()
    await expect(page.getByRole('button', { name: '建立' })).toBeVisible()
  })

  test('應能建立新專案並顯示在列表中', async ({ page, request }) => {
    await page.goto('/projects')

    const projectName = `CRUD測試 ${Date.now()}`
    await page.getByPlaceholder('輸入新專案名稱...').fill(projectName)
    await page.getByRole('button', { name: '建立' }).click()

    // 等待專案出現在列表中
    await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 })

    // 取得新建立的專案 ID 以便清理
    const projectsRes = await request.get('/api/projects')
    const projects = await projectsRes.json()
    const created = projects.find((p: { name: string }) => p.name === projectName)
    if (created) createdProjectIds.push(created.id)
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
