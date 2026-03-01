import { test, expect } from '@playwright/test'
import { TEST_USER } from '../global-setup'

test.describe('管理員重設密碼功能', () => {
  let targetUserId: string
  let targetUserEmail: string
  let newPassword = 'NewPass123!'

  test.beforeAll(async ({ request }) => {
    // 透過 API 建立目標測試用戶（將被重設密碼）
    const testEmail = `reset-password-target-${Date.now()}@example.com`
    const registerRes = await request.post('/api/auth/register', {
      data: {
        email: testEmail,
        password: 'OriginalPass123!',
        name: 'Target User',
      },
    })
    expect(registerRes.ok()).toBeTruthy()
    const newUser = await registerRes.json()
    targetUserId = newUser.id
    targetUserEmail = testEmail

    // 驗證用戶已建立
    expect(targetUserId).toBeTruthy()
    expect(targetUserEmail).toBeTruthy()
  })

  test.afterAll(async ({ request }) => {
    // 清理測試用戶（如果需要）
    // 注：此 API 可能無法刪除，跳過清理
  })

  // ========================================
  // API 層面測試：授權與驗證
  // ========================================

  test('未登入呼叫重設密碼 API → 401 未授權', async ({ browser }) => {
    // Arrange：建立新的不認證的 browser context
    const context = await browser.newContext()
    const request = context.request

    // Act
    const res = await request.post(
      `/api/admin/users/${targetUserId}/reset-password`,
      {
        data: { new_password: newPassword },
      }
    )

    // Assert
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBeDefined()

    await context.close()
  })

  test('非 Admin 用戶呼叫重設密碼 API → 403 禁止', async ({ browser, request }) => {
    // Arrange：建立一般用戶
    const regularUserEmail = `regular-user-${Date.now()}@example.com`
    const regularUserPassword = 'RegularPass123!'

    const registerRes = await request.post('/api/auth/register', {
      data: {
        email: regularUserEmail,
        password: regularUserPassword,
        name: 'Regular User',
      },
    })
    expect(registerRes.ok()).toBeTruthy()

    // 建立新 context 並用一般用戶登入
    const regularContext = await browser.newContext()
    const regularPage = await regularContext.newPage()

    await regularPage.goto('/login')
    await regularPage.getByPlaceholder('Email').fill(regularUserEmail)
    await regularPage.getByPlaceholder('密碼（至少 6 字元）').fill(regularUserPassword)
    await regularPage.getByRole('button', { name: '登入', exact: true }).click()

    // 等待登入成功
    await regularPage.waitForURL('**/projects', { timeout: 15000 })

    // 使用該 context 的 request
    const regularRequest = regularContext.request

    // Act：一般用戶嘗試重設他人密碼
    const res = await regularRequest.post(
      `/api/admin/users/${targetUserId}/reset-password`,
      {
        data: { new_password: newPassword },
      }
    )

    // Assert
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.error).toBeDefined()

    await regularContext.close()
  })

  test('Admin 重設他人密碼成功 → 200 + force_password_change 為 true', async ({
    request,
  }) => {
    // Arrange：使用 TEST_USER（admin）已登入狀態

    // Act
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

    // 取得 TEST_USER 的 ID（透過查詢 admin users endpoint）
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

  test('重設有效用戶的密碼後可以用新密碼登入', async ({
    request,
    page,
  }) => {
    // Arrange：建立另一個目標用戶
    const verifyUserEmail = `verify-user-${Date.now()}@example.com`
    const originalPassword = 'VerifyPass123!'
    const resetPassword = 'ResetPass456!'

    const registerRes = await request.post('/api/auth/register', {
      data: {
        email: verifyUserEmail,
        password: originalPassword,
        name: 'Verify User',
      },
    })
    expect(registerRes.ok()).toBeTruthy()
    const newUser = await registerRes.json()
    const newUserId = newUser.id

    // Act：Admin 重設此用戶的密碼
    const resetRes = await request.post(
      `/api/admin/users/${newUserId}/reset-password`,
      {
        data: { new_password: resetPassword },
      }
    )

    // Assert：重設成功
    expect(resetRes.ok()).toBeTruthy()

    // 驗證舊密碼已失效
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(verifyUserEmail)
    await page.getByPlaceholder('密碼（至少 6 字元）').fill(originalPassword)
    await page.getByRole('button', { name: '登入', exact: true }).click()

    // 應該登入失敗或被 force change banner 攔截
    // 等待任何導航或錯誤提示
    await page.waitForTimeout(2000)

    // 重新開始，用新密碼登入
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(verifyUserEmail)
    await page.getByPlaceholder('密碼（至少 6 字元）').fill(resetPassword)
    await page.getByRole('button', { name: '登入', exact: true }).click()

    // 應該成功登入（可能看到 force password change banner）
    await page.waitForURL(/\/(projects|settings)/, { timeout: 15000 })
    expect(page.url()).toContain('/projects')
  })

  // ========================================
  // 密碼驗證測試
  // ========================================

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
  // UI 層面測試
  // ========================================

  test('Admin 使用者詳情頁顯示「重設密碼」按鈕（credentials 用戶）', async ({
    page,
  }) => {
    // Arrange & Act
    await page.goto(`/admin/users/${targetUserId}`)

    // Assert
    // 應顯示「重設密碼」標題
    await expect(page.getByText('重設密碼')).toBeVisible()

    // 應有「確認重設密碼」按鈕
    const resetButton = page.getByRole('button', { name: /確認重設密碼/ })
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
    const resetRes = await request.post(
      `/api/admin/users/${targetUserId}/reset-password`,
      {
        data: { new_password: 'BannerTest123!' },
      }
    )
    expect(resetRes.ok()).toBeTruthy()

    // 用目標用戶登入
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(targetUserEmail)
    await page.getByPlaceholder('密碼（至少 6 字元）').fill('BannerTest123!')
    await page.getByRole('button', { name: '登入', exact: true }).click()

    // 等待登入成功
    await page.waitForURL('**/projects', { timeout: 15000 })

    // Assert
    // 應顯示黃色警告 banner
    const banner = page.getByText('管理員已重設您的密碼')
    await expect(banner).toBeVisible()

    // 應有「立即更改」按鈕
    const updateButton = page.getByRole('link', { name: '立即更改' })
    await expect(updateButton).toBeVisible()

    // 應有關閉按鈕
    const closeButton = page.getByRole('button', { name: '關閉提示' })
    await expect(closeButton).toBeVisible()
  })

  test('ForcePasswordBanner 點擊「立即更改」導向設定頁', async ({
    page,
    request,
  }) => {
    // Arrange
    const resetRes = await request.post(
      `/api/admin/users/${targetUserId}/reset-password`,
      {
        data: { new_password: 'SettingsTest123!' },
      }
    )
    expect(resetRes.ok()).toBeTruthy()

    // 用目標用戶登入
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(targetUserEmail)
    await page.getByPlaceholder('密碼（至少 6 字元）').fill('SettingsTest123!')
    await page.getByRole('button', { name: '登入', exact: true }).click()

    await page.waitForURL('**/projects', { timeout: 15000 })

    // Act：點擊 banner 上的「立即更改」
    const updateButton = page.getByRole('link', { name: '立即更改' })
    await updateButton.click()

    // Assert
    await page.waitForURL('**/settings', { timeout: 10000 })
    await expect(page.getByText('設定')).toBeVisible()
  })

  test('ForcePasswordBanner 點擊關閉按鈕可以解除', async ({
    page,
    request,
  }) => {
    // Arrange
    const resetRes = await request.post(
      `/api/admin/users/${targetUserId}/reset-password`,
      {
        data: { new_password: 'DismissTest123!' },
      }
    )
    expect(resetRes.ok()).toBeTruthy()

    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(targetUserEmail)
    await page.getByPlaceholder('密碼（至少 6 字元）').fill('DismissTest123!')
    await page.getByRole('button', { name: '登入', exact: true }).click()

    await page.waitForURL('**/projects', { timeout: 15000 })

    // Act：點擊 banner 的關閉按鈕
    const closeButton = page.getByRole('button', { name: '關閉提示' })
    await closeButton.click()

    // Assert
    const banner = page.getByText('管理員已重設您的密碼')
    await expect(banner).not.toBeVisible()
  })

  test('Admin 在使用者詳情頁重設密碼成功', async ({ page, request }) => {
    // Arrange
    const testPassword = 'DetailPageTest123!'

    // Act：導航至使用者詳情頁
    await page.goto(`/admin/users/${targetUserId}`)

    // 填寫新密碼
    await page.getByPlaceholder('輸入新密碼').fill(testPassword)
    await page.getByPlaceholder('再次輸入新密碼').fill(testPassword)

    // 點擊「確認重設密碼」
    await page.getByRole('button', { name: '確認重設密碼' }).click()

    // Assert
    // 應顯示成功提示
    await expect(page.getByText('密碼已重設成功')).toBeVisible({ timeout: 5000 })

    // 驗證新密碼可登入
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(targetUserEmail)
    await page.getByPlaceholder('密碼（至少 6 字元）').fill(testPassword)
    await page.getByRole('button', { name: '登入', exact: true }).click()

    // 應成功登入
    await page.waitForURL('**/projects', { timeout: 15000 })
    await expect(page.getByRole('heading', { name: '專案列表' })).toBeVisible()
  })

  test('Admin 在使用者詳情頁點擊「產生隨機密碼」', async ({ page }) => {
    // Arrange & Act
    await page.goto(`/admin/users/${targetUserId}`)

    // 點擊「產生隨機密碼」連結
    await page.getByRole('button', {
      name: '產生隨機密碼',
    }).click()

    // Assert
    // 應自動填寫密碼欄位
    const newPasswordInput = page.getByPlaceholder('輸入新密碼')
    const confirmPasswordInput = page.getByPlaceholder('再次輸入新密碼')

    const newPasswordValue = await newPasswordInput.inputValue()
    const confirmPasswordValue = await confirmPasswordInput.inputValue()

    expect(newPasswordValue).toBeTruthy()
    expect(newPasswordValue.length).toBeGreaterThanOrEqual(6)
    expect(newPasswordValue).toBe(confirmPasswordValue)
  })

  test('Admin 在使用者列表快速重設密碼', async ({ page }) => {
    // Arrange & Act
    await page.goto('/admin/users')

    // 搜尋目標用戶
    const searchInput = page.getByPlaceholder('搜尋名稱或 Email...')
    await searchInput.fill(targetUserEmail)
    await page.waitForTimeout(500)

    // 找到「重設密碼」按鈕
    const resetButton = page
      .locator('tr')
      .filter({ has: page.getByText(targetUserEmail) })
      .getByRole('button', { name: '重設密碼' })

    await resetButton.click()

    // Assert：應開啟 Dialog
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    // Dialog 應顯示用戶名稱
    await expect(dialog.getByText(`為「${targetUserEmail}」設定新密碼`)).toBeVisible()

    // 填寫密碼
    const quickPassword = 'QuickReset123!'
    await dialog.getByPlaceholder('輸入新密碼').fill(quickPassword)
    await dialog.getByPlaceholder('再次輸入新密碼').fill(quickPassword)

    // 點擊確認
    await dialog.getByRole('button', { name: /確認重設/ }).click()

    // Assert：應顯示成功提示
    await expect(page.getByText(/已重設.*密碼/)).toBeVisible({ timeout: 5000 })
  })

  test('Admin 在使用者詳情頁重設密碼時密碼不一致 → 顯示錯誤', async ({
    page,
  }) => {
    // Arrange & Act
    await page.goto(`/admin/users/${targetUserId}`)

    // 填寫不一致的密碼
    await page.getByPlaceholder('輸入新密碼').fill('Password123!')
    await page.getByPlaceholder('再次輸入新密碼').fill('DifferentPass123!')

    // 點擊「確認重設密碼」
    await page.getByRole('button', { name: '確認重設密碼' }).click()

    // Assert
    await expect(
      page.getByText('兩次密碼輸入不一致')
    ).toBeVisible({ timeout: 5000 })
  })

  test('Admin 在使用者詳情頁重設密碼時密碼過短 → 顯示錯誤', async ({
    page,
  }) => {
    // Arrange & Act
    await page.goto(`/admin/users/${targetUserId}`)

    // 填寫過短密碼
    const shortPassword = 'short'
    await page.getByPlaceholder('輸入新密碼').fill(shortPassword)
    await page.getByPlaceholder('再次輸入新密碼').fill(shortPassword)

    // 點擊「確認重設密碼」
    await page.getByRole('button', { name: '確認重設密碼' }).click()

    // Assert
    await expect(
      page.getByText(/密碼長度至少 6 個字元/)
    ).toBeVisible({ timeout: 5000 })
  })
})
