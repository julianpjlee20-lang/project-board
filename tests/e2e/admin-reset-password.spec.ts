import { test, expect } from '@playwright/test'
import { TEST_USER } from '../global-setup'

test.describe('管理員重設密碼功能', () => {
  let targetUserId: string
  let targetUserEmail: string
  const newPassword = 'NewPass123!'

  test.beforeAll(async ({ request }) => {
    // 透過 API 建立目標測試用戶（將被重設密碼）
    targetUserEmail = `reset-password-target-${Date.now()}@example.com`
    const registerRes = await request.post('/api/auth/register', {
      data: {
        email: targetUserEmail,
        password: 'OriginalPass123!',
        name: 'Target User',
      },
    })
    expect(registerRes.ok()).toBeTruthy()
    const newUser = await registerRes.json()
    targetUserId = newUser.profileId

    // 驗證用戶已建立
    expect(targetUserId).toBeTruthy()
    expect(targetUserEmail).toBeTruthy()

    // 啟用使用者以便進行後續測試
    const activateRes = await request.patch(`/api/admin/users/${targetUserId}`, {
      data: { is_active: true },
    })
    expect(activateRes.ok()).toBeTruthy()
  })

  // ========================================
  // API 層面測試：核心功能（6 個測試）
  // ========================================

  test('Admin 重設他人密碼成功 → 200 + force_password_change 為 true', async ({
    request,
  }) => {
    // Arrange & Act
    const res = await request.post(
      `/api/admin/users/${targetUserId}/reset-password`,
      {
        data: { new_password: newPassword },
      }
    )

    // Assert
    expect(res.ok()).toBeTruthy()
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.message).toBe('密碼已重設')

    // 驗證使用者的 force_password_change 已設為 true
    const getUserRes = await request.get(`/api/admin/users/${targetUserId}`)
    expect(getUserRes.ok()).toBeTruthy()
    const userData = await getUserRes.json()
    expect(userData.force_password_change).toBe(true)
  })

  test('重設自己的密碼 → 403 禁止', async ({ request }) => {
    // Arrange：使用 TEST_USER（admin）
    const adminEmail = TEST_USER.email

    // 取得 TEST_USER 的 ID
    const usersRes = await request.get('/api/admin/users?limit=100')
    const { users } = await usersRes.json()
    const adminUser = users.find((u: { email: string }) => u.email === adminEmail)
    expect(adminUser).toBeDefined()
    const adminUserId = adminUser.id

    // Act：admin 嘗試重設自己的密碼
    const res = await request.post(
      `/api/admin/users/${adminUserId}/reset-password`,
      {
        data: { new_password: 'SomeNewPass123!' },
      }
    )

    // Assert
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('無法重設自己的密碼')
  })

  test('重設不存在的用戶 → 404 未找到', async ({ request }) => {
    // Arrange
    const nonExistentUserId = '00000000-0000-0000-0000-000000000000'

    // Act
    const res = await request.post(
      `/api/admin/users/${nonExistentUserId}/reset-password`,
      {
        data: { new_password: newPassword },
      }
    )

    // Assert
    expect(res.status()).toBe(404)
    const body = await res.json()
    expect(body.error).toContain('使用者不存在')
  })

  test('重設密碼時密碼長度 < 6 → 400 驗證失敗', async ({ request }) => {
    // Arrange
    const invalidPassword = 'short'

    // Act
    const res = await request.post(
      `/api/admin/users/${targetUserId}/reset-password`,
      {
        data: { new_password: invalidPassword },
      }
    )

    // Assert
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('驗證失敗')
  })

  test('重設密碼時缺少 new_password 欄位 → 400 驗證失敗', async ({
    request,
  }) => {
    // Arrange
    const emptyBody = {}

    // Act
    const res = await request.post(
      `/api/admin/users/${targetUserId}/reset-password`,
      {
        data: emptyBody,
      }
    )

    // Assert
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('驗證失敗')
  })

  // ========================================
  // UI 層面測試（8 個測試）
  // ========================================

  test('Admin 使用者詳情頁顯示「重設密碼」按鈕', async ({ page }) => {
    // Arrange & Act
    await page.goto(`/admin/users/${targetUserId}`)

    // Assert
    // 應顯示「重設密碼」標題（使用 heading role）
    await expect(page.getByRole('heading', { name: '重設密碼' })).toBeVisible()

    // 應有「確認重設密碼」按鈕
    const resetButton = page.getByRole('button', { name: '確認重設密碼' })
    await expect(resetButton).toBeVisible()
  })

  test('Admin 使用者列表頁有重設密碼的快速按鈕', async ({ page }) => {
    // Arrange & Act
    await page.goto('/admin/users')

    // 搜尋目標用戶
    const searchInput = page.getByPlaceholder('搜尋名稱或 Email...')
    await searchInput.fill(targetUserEmail)

    // 等待用戶列表更新
    await page.waitForTimeout(500)

    // Assert
    // 應找到目標用戶的「重設密碼」按鈕
    const resetButton = page
      .locator('tr')
      .filter({ has: page.getByText(targetUserEmail) })
      .getByRole('button', { name: '重設密碼' })

    await expect(resetButton).toBeVisible()
  })

  test('ForcePasswordBanner 在 force_password_change=true 時顯示', async ({
    page,
    request,
  }) => {
    // Arrange：確保目標用戶 force_password_change=true
    const bannerUserEmail = `banner-test-${Date.now()}@example.com`
    const bannerPassword = 'BannerTest123!'

    // 建立測試用戶
    const registerRes = await request.post('/api/auth/register', {
      data: {
        email: bannerUserEmail,
        password: bannerPassword,
        name: 'Banner Test User',
      },
    })
    expect(registerRes.ok()).toBeTruthy()
    const bannerUser = await registerRes.json()
    const bannerUserId = bannerUser.profileId

    // 啟用用戶
    await request.patch(`/api/admin/users/${bannerUserId}`, {
      data: { is_active: true },
    })

    // 重設密碼
    const resetRes = await request.post(
      `/api/admin/users/${bannerUserId}/reset-password`,
      {
        data: { new_password: 'ResetBanner123!' },
      }
    )
    expect(resetRes.ok()).toBeTruthy()

    // 清除 admin session，以新用戶身份登入
    await page.context().clearCookies()
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(bannerUserEmail)
    await page.getByPlaceholder('密碼（至少 6 字元）').fill('ResetBanner123!')
    await page.getByRole('button', { name: '登入', exact: true }).click()

    // 等待登入成功
    await page.waitForURL('**/projects', { timeout: 15000 })

    // 等待 session 刷新，確保獲得最新的 force_password_change 標誌
    await page.waitForTimeout(1000)

    // Assert
    // 應顯示黃色警告 banner
    await expect(page.getByText('管理員已重設您的密碼')).toBeVisible()

    // 應有「立即更改」按鈕
    const updateButton = page.getByRole('link', { name: '立即更改' })
    await expect(updateButton).toBeVisible()
  })

  test('ForcePasswordBanner 點擊「立即更改」導向設定頁', async ({
    page,
    request,
  }) => {
    // Arrange
    const settingsUserEmail = `settings-test-${Date.now()}@example.com`
    const settingsPassword = 'SettingsTest123!'

    const registerRes = await request.post('/api/auth/register', {
      data: {
        email: settingsUserEmail,
        password: settingsPassword,
        name: 'Settings Test User',
      },
    })
    expect(registerRes.ok()).toBeTruthy()
    const settingsUser = await registerRes.json()
    const settingsUserId = settingsUser.profileId

    await request.patch(`/api/admin/users/${settingsUserId}`, {
      data: { is_active: true },
    })

    const resetRes = await request.post(
      `/api/admin/users/${settingsUserId}/reset-password`,
      {
        data: { new_password: 'ResetSettings123!' },
      }
    )
    expect(resetRes.ok()).toBeTruthy()

    // 清除 admin session，以新用戶身份登入
    await page.context().clearCookies()
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(settingsUserEmail)
    await page.getByPlaceholder('密碼（至少 6 字元）').fill('ResetSettings123!')
    await page.getByRole('button', { name: '登入', exact: true }).click()

    await page.waitForURL('**/projects', { timeout: 15000 })

    // 等待 session 刷新
    await page.waitForTimeout(1000)

    // Act：點擊 banner 上的「立即更改」
    const updateButton = page.getByRole('link', { name: '立即更改' })
    await updateButton.click()

    // Assert
    await page.waitForURL('**/settings', { timeout: 10000 })
    expect(page.url()).toContain('/settings')
  })

  test('ForcePasswordBanner 點擊關閉按鈕可以解除', async ({
    page,
    request,
  }) => {
    // Arrange
    const dismissUserEmail = `dismiss-test-${Date.now()}@example.com`
    const dismissPassword = 'DismissTest123!'

    const registerRes = await request.post('/api/auth/register', {
      data: {
        email: dismissUserEmail,
        password: dismissPassword,
        name: 'Dismiss Test User',
      },
    })
    expect(registerRes.ok()).toBeTruthy()
    const dismissUser = await registerRes.json()
    const dismissUserId = dismissUser.profileId

    await request.patch(`/api/admin/users/${dismissUserId}`, {
      data: { is_active: true },
    })

    const resetRes = await request.post(
      `/api/admin/users/${dismissUserId}/reset-password`,
      {
        data: { new_password: 'ResetDismiss123!' },
      }
    )
    expect(resetRes.ok()).toBeTruthy()

    // 清除 admin session，以新用戶身份登入
    await page.context().clearCookies()
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(dismissUserEmail)
    await page.getByPlaceholder('密碼（至少 6 字元）').fill('ResetDismiss123!')
    await page.getByRole('button', { name: '登入', exact: true }).click()

    await page.waitForURL('**/projects', { timeout: 15000 })

    // 等待 session 刷新
    await page.waitForTimeout(1000)

    // Act：點擊 ForcePasswordBanner 的關閉按鈕（區別於 Testing DB banner）
    const forceBanner = page.locator('.bg-amber-50').filter({ hasText: '管理員已重設您的密碼' })
    const closeButton = forceBanner.getByRole('button', { name: '關閉提示' })
    await closeButton.click()

    // Assert
    await expect(page.getByText('管理員已重設您的密碼')).not.toBeVisible()
  })

  test('Admin 在使用者詳情頁重設密碼成功', async ({ page, request }) => {
    // Arrange
    const detailUserEmail = `detail-test-${Date.now()}@example.com`
    const detailPassword = 'DetailTest123!'
    const resetPassword = 'DetailReset123!'

    const registerRes = await request.post('/api/auth/register', {
      data: {
        email: detailUserEmail,
        password: detailPassword,
        name: 'Detail Test User',
      },
    })
    expect(registerRes.ok()).toBeTruthy()
    const detailUser = await registerRes.json()
    const detailUserId = detailUser.profileId

    await request.patch(`/api/admin/users/${detailUserId}`, {
      data: { is_active: true },
    })

    // Act：導航至使用者詳情頁
    await page.goto(`/admin/users/${detailUserId}`)

    // 填寫新密碼
    const passwordInputs = page.getByPlaceholder('輸入新密碼')
    await passwordInputs.first().fill(resetPassword)

    const confirmInputs = page.getByPlaceholder('再次輸入新密碼')
    await confirmInputs.first().fill(resetPassword)

    // 點擊「確認重設密碼」
    await page.getByRole('button', { name: '確認重設密碼' }).click()

    // Assert
    // 應顯示成功提示
    await expect(page.getByText('密碼已重設成功')).toBeVisible({ timeout: 5000 })

    // 清除 admin session，驗證新密碼可登入
    await page.context().clearCookies()
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(detailUserEmail)
    await page.getByPlaceholder('密碼（至少 6 字元）').fill(resetPassword)
    await page.getByRole('button', { name: '登入', exact: true }).click()

    // 應成功登入
    await page.waitForURL('**/projects', { timeout: 15000 })
    expect(page.url()).toContain('projects')
  })

  test('Admin 在使用者列表快速重設密碼', async ({ page, request }) => {
    // Arrange
    const quickUserEmail = `quick-test-${Date.now()}@example.com`

    const registerRes = await request.post('/api/auth/register', {
      data: {
        email: quickUserEmail,
        password: 'QuickTest123!',
        name: 'Quick Test User',
      },
    })
    expect(registerRes.ok()).toBeTruthy()
    const quickUser = await registerRes.json()
    const quickUserId = quickUser.profileId

    await request.patch(`/api/admin/users/${quickUserId}`, {
      data: { is_active: true },
    })

    // Act
    await page.goto('/admin/users')

    // 搜尋目標用戶
    const searchInput = page.getByPlaceholder('搜尋名稱或 Email...')
    await searchInput.fill(quickUserEmail)
    await page.waitForTimeout(500)

    // 找到「重設密碼」按鈕
    const resetButton = page
      .locator('tr')
      .filter({ has: page.getByText(quickUserEmail) })
      .getByRole('button', { name: '重設密碼' })

    await resetButton.click()

    // Assert：應開啟 Dialog
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    // Dialog 應顯示用戶名稱（name 優先於 email）
    await expect(dialog.getByText('Quick Test User')).toBeVisible()

    // 填寫密碼
    const quickPassword = 'QuickReset123!'
    const dialogPasswordInputs = dialog.getByPlaceholder('輸入新密碼')
    await dialogPasswordInputs.first().fill(quickPassword)

    const dialogConfirmInputs = dialog.getByPlaceholder('再次輸入新密碼')
    await dialogConfirmInputs.first().fill(quickPassword)

    // 點擊確認
    await dialog.getByRole('button', { name: /確認重設/ }).click()

    // Assert：應顯示成功提示
    await expect(page.getByText(/已重設.*密碼/)).toBeVisible({ timeout: 5000 })
  })

  test('Admin 在使用者詳情頁重設密碼時密碼不一致 → 顯示錯誤', async ({
    page,
    request,
  }) => {
    // Arrange
    const mismatchUserEmail = `mismatch-test-${Date.now()}@example.com`

    const registerRes = await request.post('/api/auth/register', {
      data: {
        email: mismatchUserEmail,
        password: 'MismatchTest123!',
        name: 'Mismatch Test User',
      },
    })
    expect(registerRes.ok()).toBeTruthy()
    const mismatchUser = await registerRes.json()
    const mismatchUserId = mismatchUser.profileId

    await request.patch(`/api/admin/users/${mismatchUserId}`, {
      data: { is_active: true },
    })

    // Act
    await page.goto(`/admin/users/${mismatchUserId}`)

    // 填寫不一致的密碼
    const passwordInputs = page.getByPlaceholder('輸入新密碼')
    await passwordInputs.first().fill('Password123!')

    const confirmInputs = page.getByPlaceholder('再次輸入新密碼')
    await confirmInputs.first().fill('DifferentPass123!')

    // 點擊「確認重設密碼」
    await page.getByRole('button', { name: '確認重設密碼' }).click()

    // Assert
    await expect(
      page.getByText('兩次密碼輸入不一致')
    ).toBeVisible({ timeout: 5000 })
  })
})
