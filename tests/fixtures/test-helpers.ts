import { Page } from '@playwright/test';

/**
 * 測試輔助函數
 */

/**
 * 等待 API 請求完成
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  action: () => Promise<void>
) {
  const responsePromise = page.waitForResponse(
    response => {
      const url = response.url();
      const matches = typeof urlPattern === 'string'
        ? url.includes(urlPattern)
        : urlPattern.test(url);
      return matches && response.status() >= 200 && response.status() < 300;
    },
    { timeout: 10000 }
  );

  await action();
  return await responsePromise;
}

/**
 * 清理測試資料
 */
export async function cleanupTestData(page: Page, projectId?: string) {
  // 如果有提供專案 ID，清理該專案
  if (projectId) {
    await page.request.delete(`/api/projects/${projectId}`);
  }
}

/**
 * 建立測試專案
 */
export async function createTestProject(page: Page, name: string = '測試專案') {
  const response = await page.request.post('/api/projects', {
    data: { name, description: '自動化測試專案' }
  });

  if (!response.ok()) {
    throw new Error(`建立專案失敗: ${response.status()}`);
  }

  const project = await response.json();
  return project;
}

/**
 * 建立測試欄位
 */
export async function createTestColumn(
  page: Page,
  projectId: string,
  name: string = '待辦',
  position: number = 0
) {
  const response = await page.request.post(`/api/projects/${projectId}/columns`, {
    data: { name, position }
  });

  if (!response.ok()) {
    throw new Error(`建立欄位失敗: ${response.status()}`);
  }

  const column = await response.json();
  return column;
}

/**
 * 建立測試卡片
 */
export async function createTestCard(
  page: Page,
  columnId: string,
  title: string = '測試卡片'
) {
  const response = await page.request.post('/api/cards', {
    data: {
      column_id: columnId,
      title,
      description: '測試描述',
      position: 0
    }
  });

  if (!response.ok()) {
    throw new Error(`建立卡片失敗: ${response.status()}`);
  }

  const card = await response.json();
  return card;
}

/**
 * 取得隨機字串
 */
export function getRandomString(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * 截圖輔助函數
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `test-results/screenshots/${name}-${Date.now()}.png`,
    fullPage: true
  });
}
