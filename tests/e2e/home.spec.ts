import { test, expect } from '@playwright/test'

test.describe('首頁', () => {
  test('應顯示標題和進入看板按鈕', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Project Board' })).toBeVisible()
    await expect(page.getByText('團隊專案管理看板，追蹤任務進度、分配工作、掌握時程')).toBeVisible()
    await expect(page.getByRole('button', { name: '進入看板' })).toBeVisible()
  })

  test('應顯示三個功能介紹卡片', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('看板管理')).toBeVisible()
    await expect(page.getByText('任務追蹤')).toBeVisible()
    await expect(page.getByText('即時通知')).toBeVisible()
  })

  test('點擊進入看板按鈕應導航到專案列表', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: '進入看板' }).click()
    await page.waitForURL('/projects')

    await expect(page.getByRole('heading', { name: '專案列表' })).toBeVisible()
  })
})
