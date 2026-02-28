import { test, expect } from '@playwright/test';
import {
  createTestProject,
  createTestColumn,
  cleanupTestData,
  getRandomString
} from '../fixtures/test-helpers';

/**
 * 測試：專案和看板基礎功能
 */
test.describe('專案和看板管理', () => {
  let testProjectId: string;

  test.afterEach(async ({ page }) => {
    // 清理測試資料
    if (testProjectId) {
      await cleanupTestData(page, testProjectId);
    }
  });

  test('應該能夠建立新專案', async ({ page }) => {
    // 前往專案頁面
    await page.goto('/projects');

    // 點擊建立專案按鈕（需要檢查實際的 UI）
    const projectName = getRandomString('專案');

    // 使用 API 建立專案（因為 UI 可能還沒實作）
    const project = await createTestProject(page, projectName);
    testProjectId = project.id;

    expect(project.name).toBe(projectName);
    expect(project.id).toBeTruthy();
  });

  test('應該能夠顯示專案看板', async ({ page }) => {
    // 建立測試專案
    const project = await createTestProject(page, '測試看板');
    testProjectId = project.id;

    // 建立測試欄位
    const column = await createTestColumn(page, testProjectId, '待辦', 0);

    // 訪問專案頁面
    await page.goto(`/projects/${testProjectId}`);

    // 等待頁面載入
    await page.waitForLoadState('networkidle');

    // 驗證欄位顯示
    await expect(page.getByText('待辦')).toBeVisible();
  });

  test('應該能夠建立新欄位', async ({ page }) => {
    // 建立測試專案
    const project = await createTestProject(page, '測試欄位');
    testProjectId = project.id;

    // 訪問專案頁面
    await page.goto(`/projects/${testProjectId}`);
    await page.waitForLoadState('networkidle');

    // 點擊新增欄位按鈕
    const addColumnButton = page.getByText('+ 新增欄位');
    await addColumnButton.click();

    // 輸入欄位名稱
    const columnNameInput = page.locator('input[placeholder*="欄位名稱"]');
    await columnNameInput.fill('進行中');

    // 提交
    await page.locator('button[type="submit"]').first().click();

    // 等待 API 回應
    await page.waitForResponse(response =>
      response.url().includes('/api/projects') && response.status() === 200
    );

    // 驗證新欄位顯示
    await expect(page.getByText('進行中')).toBeVisible();
  });

  test('應該能夠顯示多個欄位', async ({ page }) => {
    // 建立測試專案
    const project = await createTestProject(page, '多欄位測試');
    testProjectId = project.id;

    // 建立多個欄位
    await createTestColumn(page, testProjectId, '待辦', 0);
    await createTestColumn(page, testProjectId, '進行中', 1);
    await createTestColumn(page, testProjectId, '完成', 2);

    // 訪問專案頁面
    await page.goto(`/projects/${testProjectId}`);
    await page.waitForLoadState('networkidle');

    // 驗證所有欄位都顯示
    await expect(page.getByText('待辦')).toBeVisible();
    await expect(page.getByText('進行中')).toBeVisible();
    await expect(page.getByText('完成')).toBeVisible();
  });
});
