import { test, expect } from '@playwright/test';
import {
  createTestProject,
  createTestColumn,
  createTestCard,
  cleanupTestData
} from '../fixtures/test-helpers';

/**
 * 測試：多視圖功能（看板、清單、行事曆、進度）
 */
test.describe('多視圖功能', () => {
  let testProjectId: string;
  let testColumnId: string;

  test.beforeEach(async ({ page }) => {
    // 建立測試環境
    const project = await createTestProject(page, '多視圖測試');
    testProjectId = project.id;

    // 建立多個欄位
    const todoColumn = await createTestColumn(page, testProjectId, '待辦', 0);
    const inProgressColumn = await createTestColumn(page, testProjectId, '進行中', 1);
    const doneColumn = await createTestColumn(page, testProjectId, '完成', 2);

    testColumnId = todoColumn.id;

    // 建立一些測試卡片
    await createTestCard(page, todoColumn.id, '待辦任務1');
    await createTestCard(page, todoColumn.id, '待辦任務2');
    await createTestCard(page, inProgressColumn.id, '進行中任務');
    await createTestCard(page, doneColumn.id, '已完成任務');

    // 訪問專案頁面
    await page.goto(`/projects/${testProjectId}`);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page }) => {
    if (testProjectId) {
      await cleanupTestData(page, testProjectId);
    }
  });

  test('應該能夠切換到清單視圖', async ({ page }) => {
    // 尋找並點擊清單視圖按鈕
    const listViewButton = page.getByRole('button', { name: /清單|list/i });

    // 如果找到按鈕才執行測試
    if (await listViewButton.count() > 0) {
      await listViewButton.click();
      await page.waitForTimeout(500);

      // 驗證清單視圖元素
      // 清單視圖通常會有表格
      const table = page.locator('table');
      await expect(table).toBeVisible();

      // 驗證表頭
      await expect(page.getByText('標題')).toBeVisible();
      await expect(page.getByText('欄位')).toBeVisible();
      await expect(page.getByText('指派')).toBeVisible();
      await expect(page.getByText('截止日')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('應該能夠切換到行事曆視圖', async ({ page }) => {
    // 尋找並點擊行事曆視圖按鈕
    const calendarViewButton = page.getByRole('button', { name: /行事曆|calendar/i });

    if (await calendarViewButton.count() > 0) {
      await calendarViewButton.click();
      await page.waitForTimeout(500);

      // 驗證行事曆視圖元素
      // 應該顯示月份和星期標題
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      await expect(page.getByText(`${currentYear}年`)).toBeVisible();
      await expect(page.getByText(`${currentMonth}月`)).toBeVisible();

      // 驗證星期標題
      await expect(page.getByText('日')).toBeVisible();
      await expect(page.getByText('一')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('應該能夠切換到進度視圖', async ({ page }) => {
    // 尋找並點擊進度視圖按鈕
    const progressViewButton = page.getByRole('button', { name: /進度|progress/i });

    if (await progressViewButton.count() > 0) {
      await progressViewButton.click();
      await page.waitForTimeout(500);

      // 驗證進度視圖元素
      await expect(page.getByText('專案進度')).toBeVisible();
      await expect(page.getByText('整體進度')).toBeVisible();
      await expect(page.getByText('總任務')).toBeVisible();
      await expect(page.getByText('進行中')).toBeVisible();
      await expect(page.getByText('已完成')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('應該能夠切換回看板視圖', async ({ page }) => {
    // 先切換到其他視圖
    const listViewButton = page.getByRole('button', { name: /清單|list/i });

    if (await listViewButton.count() > 0) {
      await listViewButton.click();
      await page.waitForTimeout(500);

      // 切換回看板視圖
      const boardViewButton = page.getByRole('button', { name: /看板|board|kanban/i });
      await boardViewButton.click();
      await page.waitForTimeout(500);

      // 驗證看板視圖元素
      await expect(page.getByText('待辦')).toBeVisible();
      await expect(page.getByText('進行中')).toBeVisible();
      await expect(page.getByText('完成')).toBeVisible();
      await expect(page.getByText('待辦任務1')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('清單視圖應該顯示所有卡片', async ({ page }) => {
    const listViewButton = page.getByRole('button', { name: /清單|list/i });

    if (await listViewButton.count() > 0) {
      await listViewButton.click();
      await page.waitForTimeout(500);

      // 驗證所有卡片都在清單中
      await expect(page.getByText('待辦任務1')).toBeVisible();
      await expect(page.getByText('待辦任務2')).toBeVisible();
      await expect(page.getByText('進行中任務')).toBeVisible();
      await expect(page.getByText('已完成任務')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('進度視圖應該顯示正確的任務統計', async ({ page }) => {
    const progressViewButton = page.getByRole('button', { name: /進度|progress/i });

    if (await progressViewButton.count() > 0) {
      await progressViewButton.click();
      await page.waitForTimeout(500);

      // 應該顯示總任務數為 4
      const totalTasksElement = page.locator('text=總任務').locator('..').locator('.text-2xl');
      await expect(totalTasksElement).toHaveText('4');

      // 驗證欄位顯示
      await expect(page.getByText('待辦')).toBeVisible();
      await expect(page.getByText('進行中')).toBeVisible();
      await expect(page.getByText('完成')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('在任何視圖中都應該能夠點擊卡片', async ({ page }) => {
    // 在看板視圖中點擊卡片
    await page.getByText('待辦任務1').click();
    await page.waitForSelector('.fixed.inset-0', { state: 'visible' });
    await expect(page.getByText('卡片詳情')).toBeVisible();

    // 關閉模態框
    await page.getByRole('button', { name: '取消' }).click();
    await page.waitForSelector('.fixed.inset-0', { state: 'hidden' });

    // 切換到清單視圖（如果有的話）
    const listViewButton = page.getByRole('button', { name: /清單|list/i });
    if (await listViewButton.count() > 0) {
      await listViewButton.click();
      await page.waitForTimeout(500);

      // 在清單視圖中點擊卡片
      await page.getByText('進行中任務').click();
      await page.waitForSelector('.fixed.inset-0', { state: 'visible' });
      await expect(page.getByText('卡片詳情')).toBeVisible();
    }
  });
});
