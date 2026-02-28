import { test, expect } from '@playwright/test';
import {
  createTestProject,
  createTestColumn,
  cleanupTestData,
  waitForApiResponse,
  getRandomString
} from '../fixtures/test-helpers';

/**
 * 測試：整合測試 - 完整的使用者流程
 */
test.describe('完整使用者流程整合測試', () => {
  let testProjectId: string;

  test.afterEach(async ({ page }) => {
    if (testProjectId) {
      await cleanupTestData(page, testProjectId);
    }
  });

  test('完整工作流：建立專案 → 新增欄位 → 建立卡片 → 編輯卡片 → 新增留言', async ({ page }) => {
    // 步驟 1: 建立專案
    const projectName = getRandomString('整合測試專案');
    const project = await createTestProject(page, projectName);
    testProjectId = project.id;

    // 步驟 2: 訪問專案頁面
    await page.goto(`/projects/${testProjectId}`);
    await page.waitForLoadState('networkidle');

    // 步驟 3: 建立第一個欄位
    const addColumnButton = page.getByText('+ 新增欄位');
    await addColumnButton.click();

    const columnNameInput = page.locator('input[placeholder*="欄位名稱"]');
    await columnNameInput.fill('待辦事項');

    await waitForApiResponse(
      page,
      '/api/projects',
      async () => {
        await page.locator('button[type="submit"]').first().click();
      }
    );

    // 驗證欄位建立成功
    await expect(page.getByText('待辦事項')).toBeVisible();

    // 步驟 4: 建立第二個欄位
    await addColumnButton.click();
    await columnNameInput.fill('進行中');
    await waitForApiResponse(
      page,
      '/api/projects',
      async () => {
        await page.locator('button[type="submit"]').first().click();
      }
    );

    await expect(page.getByText('進行中')).toBeVisible();

    // 步驟 5: 在第一個欄位建立卡片
    const addCardButton = page.getByText('+ 新增卡片').first();
    await addCardButton.click();

    const cardTitleInput = page.locator('input[placeholder*="卡片標題"]');
    const cardTitle = '完成專案文件';
    await cardTitleInput.fill(cardTitle);

    await waitForApiResponse(
      page,
      '/api/cards',
      async () => {
        await page.locator('button[type="submit"]').first().click();
      }
    );

    // 驗證卡片建立成功
    await expect(page.getByText(cardTitle)).toBeVisible();

    // 步驟 6: 開啟卡片進行編輯
    await page.getByText(cardTitle).click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    // 步驟 7: 編輯卡片詳細資訊
    const descriptionTextarea = page.locator('label:has-text("描述") + textarea');
    await descriptionTextarea.fill('需要撰寫完整的專案文件，包括 README 和 API 文件');

    const assigneeInput = page.locator('label:has-text("指派") + input');
    await assigneeInput.fill('張小明');

    const dueDateInput = page.locator('input[type="date"]');
    await dueDateInput.fill('2026-03-30');

    // 步驟 8: 新增留言
    const commentInput = page.locator('input[placeholder*="輸入評論"]');
    await commentInput.fill('已經開始撰寫 README');

    await waitForApiResponse(
      page,
      '/api/cards',
      async () => {
        await page.getByRole('button', { name: '送出' }).click();
      }
    );

    // 驗證留言顯示
    await expect(page.getByText('已經開始撰寫 README')).toBeVisible();

    // 步驟 9: 儲存所有變更
    await waitForApiResponse(
      page,
      '/api/cards',
      async () => {
        await page.getByRole('button', { name: '儲存' }).click();
      }
    );

    // 等待模態框關閉
    await page.waitForSelector('.fixed.inset-0', { state: 'hidden' });

    // 步驟 10: 驗證卡片上顯示資訊
    await expect(page.getByText('📅')).toBeVisible(); // 日期圖示
    await expect(page.getByText('👤')).toBeVisible(); // 指派圖示
    await expect(page.getByText('張小明')).toBeVisible();

    // 步驟 11: 重新開啟卡片驗證所有資料都已保存
    await page.getByText(cardTitle).click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    await expect(descriptionTextarea).toHaveValue('需要撰寫完整的專案文件，包括 README 和 API 文件');
    await expect(assigneeInput).toHaveValue('張小明');
    await expect(dueDateInput).toHaveValue('2026-03-30');
    await expect(page.getByText('已經開始撰寫 README')).toBeVisible();
  });

  test('多卡片操作流程：建立多個卡片並編輯', async ({ page }) => {
    // 建立測試環境
    const project = await createTestProject(page, '多卡片測試');
    testProjectId = project.id;

    const column = await createTestColumn(page, testProjectId, '任務清單', 0);

    // 訪問專案頁面
    await page.goto(`/projects/${testProjectId}`);
    await page.waitForLoadState('networkidle');

    // 建立多個卡片
    const tasks = ['任務A', '任務B', '任務C'];

    for (const task of tasks) {
      const addCardButton = page.getByText('+ 新增卡片').first();
      await addCardButton.click();

      const cardTitleInput = page.locator('input[placeholder*="卡片標題"]');
      await cardTitleInput.fill(task);

      await waitForApiResponse(
        page,
        '/api/cards',
        async () => {
          await page.locator('button[type="submit"]').first().click();
        }
      );

      await expect(page.getByText(task)).toBeVisible();
    }

    // 驗證所有卡片都顯示
    for (const task of tasks) {
      await expect(page.getByText(task)).toBeVisible();
    }

    // 驗證欄位顯示正確的卡片數量
    await expect(page.getByText('3')).toBeVisible();

    // 編輯其中一個卡片
    await page.getByText('任務B').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    const descriptionTextarea = page.locator('label:has-text("描述") + textarea');
    await descriptionTextarea.fill('任務B的詳細描述');

    await waitForApiResponse(
      page,
      '/api/cards',
      async () => {
        await page.getByRole('button', { name: '儲存' }).click();
      }
    );

    await page.waitForSelector('.fixed.inset-0', { state: 'hidden' });

    // 重新開啟驗證
    await page.getByText('任務B').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    await expect(descriptionTextarea).toHaveValue('任務B的詳細描述');
  });

  test('錯誤處理：測試各種邊界情況', async ({ page }) => {
    // 建立測試環境
    const project = await createTestProject(page, '錯誤處理測試');
    testProjectId = project.id;

    const column = await createTestColumn(page, testProjectId, '測試欄位', 0);

    await page.goto(`/projects/${testProjectId}`);
    await page.waitForLoadState('networkidle');

    // 測試：嘗試建立空標題的卡片
    const addCardButton = page.getByText('+ 新增卡片').first();
    await addCardButton.click();

    const cardTitleInput = page.locator('input[placeholder*="卡片標題"]');

    // 輸入空白字串
    await cardTitleInput.fill('   ');

    // 嘗試提交（應該不會建立卡片或顯示錯誤）
    await page.locator('button[type="submit"]').first().click();

    // 等待一下
    await page.waitForTimeout(500);

    // 取消操作
    const cancelButton = page.getByRole('button', { name: '取消' });
    if (await cancelButton.count() > 0) {
      await cancelButton.click();
    }

    // 建立正常的卡片用於後續測試
    await addCardButton.click();
    await cardTitleInput.fill('正常卡片');
    await waitForApiResponse(
      page,
      '/api/cards',
      async () => {
        await page.locator('button[type="submit"]').first().click();
      }
    );

    // 開啟卡片
    await page.getByText('正常卡片').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    // 測試：空留言處理
    const commentInput = page.locator('input[placeholder*="輸入評論"]');
    await commentInput.fill('   ');
    await page.getByRole('button', { name: '送出' }).click();

    // 等待一下確保沒有錯誤
    await page.waitForTimeout(500);

    // 測試：正常留言
    await commentInput.fill('這是正常的留言');
    await waitForApiResponse(
      page,
      '/api/cards',
      async () => {
        await page.getByRole('button', { name: '送出' }).click();
      }
    );

    await expect(page.getByText('這是正常的留言')).toBeVisible();
  });
});
