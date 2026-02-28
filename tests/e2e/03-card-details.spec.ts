import { test, expect } from '@playwright/test';
import {
  createTestProject,
  createTestColumn,
  createTestCard,
  cleanupTestData,
  waitForApiResponse
} from '../fixtures/test-helpers';

/**
 * 測試：卡片詳細功能（標籤、子任務、留言）
 */
test.describe('卡片詳細功能', () => {
  let testProjectId: string;
  let testColumnId: string;
  let testCardId: string;

  test.beforeEach(async ({ page }) => {
    // 建立測試環境
    const project = await createTestProject(page, '卡片詳細測試');
    testProjectId = project.id;

    const column = await createTestColumn(page, testProjectId, '待辦', 0);
    testColumnId = column.id;

    const card = await createTestCard(page, testColumnId, '測試卡片');
    testCardId = card.id;

    // 訪問專案頁面
    await page.goto(`/projects/${testProjectId}`);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page }) => {
    if (testProjectId) {
      await cleanupTestData(page, testProjectId);
    }
  });

  test('應該能夠新增留言', async ({ page }) => {
    // 開啟卡片
    await page.getByText('測試卡片').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    // 輸入留言
    const commentInput = page.locator('input[placeholder*="輸入評論"]');
    await commentInput.fill('這是一條測試留言');

    // 送出留言
    await waitForApiResponse(
      page,
      `/api/cards/${testCardId}/comments`,
      async () => {
        await page.getByRole('button', { name: '送出' }).click();
      }
    );

    // 驗證留言顯示
    await expect(page.getByText('這是一條測試留言')).toBeVisible();

    // 驗證輸入框已清空
    await expect(commentInput).toHaveValue('');
  });

  test('應該能夠顯示多條留言', async ({ page }) => {
    // 先用 API 新增幾條留言
    await page.request.post(`/api/cards/${testCardId}/comments`, {
      data: { content: '第一條留言', author_name: '使用者A' }
    });
    await page.request.post(`/api/cards/${testCardId}/comments`, {
      data: { content: '第二條留言', author_name: '使用者B' }
    });
    await page.request.post(`/api/cards/${testCardId}/comments`, {
      data: { content: '第三條留言', author_name: '使用者C' }
    });

    // 開啟卡片
    await page.getByText('測試卡片').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    // 驗證所有留言都顯示
    await expect(page.getByText('第一條留言')).toBeVisible();
    await expect(page.getByText('第二條留言')).toBeVisible();
    await expect(page.getByText('第三條留言')).toBeVisible();
    await expect(page.getByText('使用者A')).toBeVisible();
    await expect(page.getByText('使用者B')).toBeVisible();
    await expect(page.getByText('使用者C')).toBeVisible();
  });

  test('應該能夠處理空留言', async ({ page }) => {
    // 開啟卡片
    await page.getByText('測試卡片').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    // 取得留言區域的初始狀態
    const commentsSection = page.locator('.space-y-2.mb-2');
    const initialComments = await commentsSection.locator('> div').count();

    // 嘗試送出空留言
    const commentInput = page.locator('input[placeholder*="輸入評論"]');
    await commentInput.fill('   '); // 只有空白
    await page.getByRole('button', { name: '送出' }).click();

    // 等待一下確保沒有新增
    await page.waitForTimeout(500);

    // 驗證沒有新增留言
    const currentComments = await commentsSection.locator('> div').count();
    expect(currentComments).toBe(initialComments);
  });

  test('應該正確顯示留言作者資訊', async ({ page }) => {
    // 開啟卡片
    await page.getByText('測試卡片').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    // 新增留言（會使用預設的 'User' 作為作者）
    const commentInput = page.locator('input[placeholder*="輸入評論"]');
    await commentInput.fill('測試作者顯示');

    await waitForApiResponse(
      page,
      `/api/cards/${testCardId}/comments`,
      async () => {
        await page.getByRole('button', { name: '送出' }).click();
      }
    );

    // 驗證作者名稱顯示
    await expect(page.getByText('User:')).toBeVisible();
  });

  test('應該在儲存後保留所有資料', async ({ page }) => {
    // 開啟卡片
    await page.getByText('測試卡片').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    // 填寫所有欄位
    const titleInput = page.locator('label:has-text("標題") + input');
    await titleInput.fill('');
    await titleInput.fill('完整測試卡片');

    const descriptionTextarea = page.locator('label:has-text("描述") + textarea');
    await descriptionTextarea.fill('這是完整的描述');

    const assigneeInput = page.locator('label:has-text("指派") + input');
    await assigneeInput.fill('測試人員');

    const dueDateInput = page.locator('input[type="date"]');
    await dueDateInput.fill('2026-12-25');

    // 新增留言
    const commentInput = page.locator('input[placeholder*="輸入評論"]');
    await commentInput.fill('測試留言內容');
    await waitForApiResponse(
      page,
      `/api/cards/${testCardId}/comments`,
      async () => {
        await page.getByRole('button', { name: '送出' }).click();
      }
    );

    // 儲存
    await waitForApiResponse(
      page,
      `/api/cards/${testCardId}`,
      async () => {
        await page.getByRole('button', { name: '儲存' }).click();
      }
    );

    // 等待模態框關閉
    await page.waitForSelector('.fixed.inset-0', { state: 'hidden' });

    // 重新開啟卡片驗證所有資料
    await page.getByText('完整測試卡片').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    // 驗證所有欄位
    await expect(titleInput).toHaveValue('完整測試卡片');
    await expect(descriptionTextarea).toHaveValue('這是完整的描述');
    await expect(assigneeInput).toHaveValue('測試人員');
    await expect(dueDateInput).toHaveValue('2026-12-25');
    await expect(page.getByText('測試留言內容')).toBeVisible();
  });

  test('應該能夠處理日期格式', async ({ page }) => {
    // 開啟卡片
    await page.getByText('測試卡片').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    // 測試各種日期格式
    const dueDateInput = page.locator('input[type="date"]');

    // 設定日期
    await dueDateInput.fill('2026-03-15');

    // 儲存
    await waitForApiResponse(
      page,
      `/api/cards/${testCardId}`,
      async () => {
        await page.getByRole('button', { name: '儲存' }).click();
      }
    );

    // 等待並重新載入
    await page.waitForSelector('.fixed.inset-0', { state: 'hidden' });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 開啟卡片驗證日期
    await page.getByText('測試卡片').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });

    // 驗證日期值
    await expect(dueDateInput).toHaveValue('2026-03-15');
  });
});
