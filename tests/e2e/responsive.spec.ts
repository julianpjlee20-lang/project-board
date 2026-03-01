import { test, expect } from '@playwright/test'

test.describe('響應式佈局', () => {
  test('首頁在手機視圖應正確顯示', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Project Board' })).toBeVisible()
    await expect(page.getByRole('button', { name: '進入看板' })).toBeVisible()

    // 功能卡片應堆疊為單欄
    await expect(page.getByText('看板管理')).toBeVisible()
    await expect(page.getByText('任務追蹤')).toBeVisible()
    await expect(page.getByText('即時通知')).toBeVisible()
  })

  test('專案列表在手機視圖應正確顯示', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/projects')

    await expect(page.getByRole('heading', { name: '專案列表' })).toBeVisible()
    await expect(page.getByPlaceholder('輸入新專案名稱...')).toBeVisible()
  })

  test('首頁在平板視圖應正確顯示', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Project Board' })).toBeVisible()
    await expect(page.getByText('看板管理')).toBeVisible()
  })

  test('首頁在桌面視圖應正確顯示', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Project Board' })).toBeVisible()
    await expect(page.getByText('看板管理')).toBeVisible()
  })
})
