import { test, expect } from '@playwright/test';
import {
  createTestProject,
  createTestColumn,
  createTestCard,
  cleanupTestData,
  getRandomString,
  waitForApiResponse
} from '../fixtures/test-helpers';

/**
 * 測試：卡片 CRUD 操作
 */
test.describe('卡片基礎操作', () => {
  let testProjectId: string;
  let testColumnId: string;

  test.beforeEach(async ({ page }) => {
    // 建立測試環境
    const project = await createTestProject(page, '卡片測試專案');
    testProjectId = project.id;

    const column = await createTestColumn(page, testProjectId, '待辦', 0);
    testColumnId = column.id;
  });

  test.afterEach(async ({ page }) => {
    if (testProjectId) {
      await cleanupTestData(page, testProjectId);
    }
  });

  test('應該能夠建立新卡片', async ({ page }) => {
    // 訪問專案頁面
    await page.goto(`/projects/${testProjectId}`);
    await page.waitForLoadState('networkidle');

    // 點擊新增卡片按鈕
    const addCardButton = page.getByText('+ 新增卡片').first();
    await addCardButton.click();

    // 輸入卡片標題
    const cardTitle = getRandomString('卡片');
    const cardTitleInput = page.locator('input[placeholder*="卡片標題"]');
    await cardTitleInput.fill(cardTitle);

    // 提交
    await waitForApiResponse(
      page,
      '/api/cards',
      async () => {
        await page.locator('button[type="submit"]').first().click();
      }
    );

    // 驗證卡片顯示
    await expect(page.getByText(cardTitle)).toBeVisible();
  });

  test('應該能夠點擊卡片開啟詳細資訊', async ({ page }) => {
    // 建立測試卡片
    const card = await createTestCard(page, testColumnId, '測試卡片詳情');

    // 訪問專案頁面
    await page.goto(`/projects/${testProjectId}`);
    await page.waitForLoadState('networkidle');

    // 點擊卡片
    await page.getByText('測試卡片詳情').click();

    // 等待模態框出現
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    // 驗證模態框顯示
    await expect(page.getByText('卡片詳情')).toBeVisible();
    await expect(page.getByText('測試卡片詳情')).toBeVisible();
  });

  test('應該能夠編輯卡片標題', async ({ page }) => {
    // 建立測試卡片
    const card = await createTestCard(page, testColumnId, '原始標題');

    // 訪問專案頁面
    await page.goto(`/projects/${testProjectId}`);
    await page.waitForLoadState('networkidle');

    // 點擊卡片開啟模態框
    await page.getByText('原始標題').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    // 編輯標題
    const titleInput = page.locator('input').filter({ hasText: '原始標題' }).or(
      page.locator('label:has-text("標題") + input')
    );
    await titleInput.fill('');
    await titleInput.fill('新標題');

    // 儲存
    await waitForApiResponse(
      page,
      `/api/cards/${card.id}`,
      async () => {
        await page.getByRole('button', { name: '儲存' }).click();
      }
    );

    // 等待模態框關閉
    await page.waitForSelector('.fixed.inset-0', { state: 'hidden' });

    // 驗證標題已更新
    await expect(page.getByText('新標題')).toBeVisible();
  });

  test('應該能夠編輯卡片描述', async ({ page }) => {
    // 建立測試卡片
    const card = await createTestCard(page, testColumnId, '測試描述編輯');

    // 訪問專案頁面
    await page.goto(`/projects/${testProjectId}`);
    await page.waitForLoadState('networkidle');

    // 開啟卡片
    await page.getByText('測試描述編輯').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    // 編輯描述
    const descriptionTextarea = page.locator('label:has-text("描述") + textarea');
    await descriptionTextarea.fill('這是新的描述內容');

    // 儲存
    await waitForApiResponse(
      page,
      `/api/cards/${card.id}`,
      async () => {
        await page.getByRole('button', { name: '儲存' }).click();
      }
    );

    // 重新開啟卡片驗證
    await page.getByText('測試描述編輯').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    await expect(descriptionTextarea).toHaveValue('這是新的描述內容');
  });

  test('應該能夠設定截止日期', async ({ page }) => {
    // 建立測試卡片
    const card = await createTestCard(page, testColumnId, '測試截止日');

    // 訪問專案頁面
    await page.goto(`/projects/${testProjectId}`);
    await page.waitForLoadState('networkidle');

    // 開啟卡片
    await page.getByText('測試截止日').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    // 設定截止日期
    const dueDateInput = page.locator('input[type="date"]');
    const testDate = '2026-12-31';
    await dueDateInput.fill(testDate);

    // 儲存
    await waitForApiResponse(
      page,
      `/api/cards/${card.id}`,
      async () => {
        await page.getByRole('button', { name: '儲存' }).click();
      }
    );

    // 驗證日期顯示在卡片上
    await expect(page.getByText('📅')).toBeVisible();
  });

  test('應該能夠指派人員', async ({ page }) => {
    // 建立測試卡片
    const card = await createTestCard(page, testColumnId, '測試指派');

    // 訪問專案頁面
    await page.goto(`/projects/${testProjectId}`);
    await page.waitForLoadState('networkidle');

    // 開啟卡片
    await page.getByText('測試指派').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    // 指派人員
    const assigneeInput = page.locator('label:has-text("指派") + input');
    await assigneeInput.fill('張三');

    // 儲存
    await waitForApiResponse(
      page,
      `/api/cards/${card.id}`,
      async () => {
        await page.getByRole('button', { name: '儲存' }).click();
      }
    );

    // 驗證指派人員顯示
    await expect(page.getByText('👤')).toBeVisible();
    await expect(page.getByText('張三')).toBeVisible();
  });

  test('應該能夠取消編輯', async ({ page }) => {
    // 建立測試卡片
    const card = await createTestCard(page, testColumnId, '測試取消');

    // 訪問專案頁面
    await page.goto(`/projects/${testProjectId}`);
    await page.waitForLoadState('networkidle');

    // 開啟卡片
    await page.getByText('測試取消').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    // 修改標題但不儲存
    const titleInput = page.locator('label:has-text("標題") + input');
    await titleInput.fill('');
    await titleInput.fill('不應該儲存的標題');

    // 點擊取消
    await page.getByRole('button', { name: '取消' }).click();

    // 驗證模態框已關閉
    await page.waitForSelector('.fixed.inset-0', { state: 'hidden' });

    // 驗證原始標題仍然存在
    await expect(page.getByText('測試取消')).toBeVisible();
    await expect(page.getByText('不應該儲存的標題')).not.toBeVisible();
  });
});
