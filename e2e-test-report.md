# E2E 測試報告

**日期:** 2026-03-01
**測試工具:** Playwright MCP + Playwright Test
**環境:** Windows 11 / Next.js 16 / React 19 / PostgreSQL
**Dev Server:** http://localhost:3000

---

## 測試摘要

| 項目 | 數量 |
|------|------|
| 測試旅程 | 10 |
| 截圖數量 | 43 |
| 發現問題 | 2（1 已修復，1 待處理）|
| Playwright 回歸測試 | 7 檔案 / 20 測試案例 / 全部通過 |

---

## 已完成的測試旅程

### 1. 專案建立流程
- **狀態:** ✅ 通過
- **步驟:**
  1. 進入 `/projects` 頁面
  2. 在輸入框填寫「E2E 測試專案」
  3. 點擊「建立」按鈕
  4. 確認專案出現在列表中
- **DB 驗證:** `SELECT * FROM projects WHERE name = 'E2E 測試專案'` — 記錄正確建立
- **截圖:** `01-initial-load`, `02-projects-page`, `03-project-created`

### 2. 看板視圖 — 欄位與卡片管理
- **狀態:** ✅ 通過
- **步驟:**
  1. 確認預設三欄位（To Do, In Progress, Done）
  2. 新增「Review」欄位
  3. 在 To Do 新增「設計首頁 UI」卡片
  4. 在 In Progress 新增「實作登入功能」、「撰寫 API 文件」卡片
  5. 在 Done 新增「完成資料庫設計」卡片
- **DB 驗證:** 四張卡片全部正確建立，column_id 和 position 正確
- **截圖:** `04-board-default-columns`, `05-review-column-added`, `06-cards-created`

### 3. 卡片 Modal 編輯
- **狀態:** ✅ 通過
- **步驟:**
  1. 點擊「設計首頁 UI」卡片開啟 Modal
  2. 編輯描述：「設計首頁的 UI/UX 介面」
  3. 設定指派人：王小明
  4. 設定截止日：2026-03-15
  5. 設定優先度：高
  6. 儲存並確認 Modal 關閉
- **DB 驗證:** cards 表的 description, due_date, priority 正確更新；card_assignees 記錄建立；activity_logs 有對應記錄
- **截圖:** `08-modal-opened`, `09-modal-filled`, `10-modal-saved`

### 4. 子任務管理
- **狀態:** ✅ 通過（修復 bug 後）
- **步驟:**
  1. 開啟「設計首頁 UI」卡片 Modal
  2. 新增子任務：「設計線框圖」、「選擇配色方案」、「製作原型」
  3. 勾選「設計線框圖」為完成
  4. 確認進度顯示 1/3
- **Bug 發現並修復:** 子任務 toggle 不生效。前端送 `{ id: subtask.id }` 但後端 API 期望 `{ subtask_id }`
  - **修復檔案:** `src/app/projects/[id]/page.tsx` 第 146 行
  - **修改內容:** `{ id: subtask.id, ... }` → `{ subtask_id: subtask.id, ... }`
- **DB 驗證:** subtasks 表正確建立 3 筆，toggle 後 is_completed 正確更新
- **截圖:** `11-subtasks-added`, `12-subtask-toggled`

### 5. Phase 階段管理
- **狀態:** ✅ 通過
- **步驟:**
  1. 點擊「+ 新增階段」
  2. 建立「設計階段」和「開發階段」
  3. 在 Modal 中將「設計首頁 UI」指派到「設計階段」
  4. 將「實作登入功能」指派到「開發階段」
  5. 點擊「設計階段」篩選器確認只顯示對應卡片
  6. 點擊「全部」恢復顯示所有卡片
- **DB 驗證:** phases 表正確建立，cards.phase_id 正確更新
- **截圖:** `15-phases-created`, `17-phase-filter-applied`

### 6. 列表視圖
- **狀態:** ✅ 通過
- **步驟:**
  1. 切換到 List 視圖
  2. 確認表格顯示標題、階段、優先度、欄位、指派、截止日、進度欄
  3. 確認四張卡片都在表格中
- **注意:** Phase 欄位對部分卡片顯示「-」，可能是因為未指派 Phase
- **截圖:** `19-list-view`

### 7. 日曆視圖
- **狀態:** ✅ 通過
- **步驟:**
  1. 切換到 Calendar 視圖
  2. 確認 2026 年 3 月日曆正確渲染
  3. 確認「設計首頁 UI」出現在 3/15 日期格
- **截圖:** `21-calendar-view`

### 8. 進度視圖
- **狀態:** ✅ 通過
- **步驟:**
  1. 切換到 Progress 視圖
  2. 確認「整體進度」顯示 25%（1/4 卡片在 Done）
  3. 確認各欄位 breakdown：To Do 1, In Progress 2, Done 1
- **截圖:** `23-progress-view`

### 9. 拖放功能（API 驗證）
- **狀態:** ✅ 通過
- **步驟:**
  1. 透過 `/api/cards/move` API 將「設計首頁 UI」從 To Do 移到 In Progress
  2. 使用 snake_case 參數名（card_id, source_column_id, dest_column_id, source_index, dest_index）
  3. 重新載入頁面確認卡片已移動
- **注意:** API 只接受 snake_case 參數名，camelCase 會導致 500 錯誤
- **DB 驗證:** cards 表的 column_id 和 position 正確更新
- **截圖:** `26-after-card-move`

### 10. 跨裝置響應式測試
- **狀態:** ✅ 通過（有佈局問題記錄）
- **測試視窗:**
  - 手機 (375×812): 首頁、專案列表、看板四視圖
  - 平板 (768×1024): 看板四視圖
  - 桌面 (1440×900): 看板四視圖
- **發現:** 手機版 header 佈局擠壓（專案名稱垂直換行、「返回專案」文字垂直排列）
- **截圖:** `30-mobile-board-view` ~ `43-mobile-projects-list`

---

## 發現的問題

### 已修復

| # | 問題 | 嚴重度 | 檔案 | 修復內容 |
|---|------|--------|------|----------|
| 1 | 子任務 toggle 不生效 | 高 | `src/app/projects/[id]/page.tsx:146` | 前端參數名 `id` → `subtask_id` |

### 待處理

| # | 問題 | 嚴重度 | 檔案 | 說明 |
|---|------|--------|------|------|
| 1 | 手機版 header 佈局擠壓 | 低 | `src/app/projects/[id]/page.tsx` header 區域 | 375px 寬度時專案名稱和按鈕文字垂直換行 |

### 程式碼分析發現（Bug 搜尋子代理）

| # | 問題 | 嚴重度 | 檔案 | 說明 |
|---|------|--------|------|------|
| 1 | 卡片移動缺少 transaction 保護 | 中 | `src/app/api/cards/move/route.ts` | 多個 UPDATE 語句無 transaction，並發時可能導致 position 混亂 |
| 2 | 子任務/標籤 API 缺少 Zod 驗證 | 中 | `src/app/api/cards/[id]/subtasks/route.ts` | 輸入未經 Zod schema 驗證 |
| 3 | COALESCE boolean 問題 | 低 | `src/app/api/cards/[id]/subtasks/route.ts:64` | `COALESCE($2, is_completed)` 當 `is_completed=false` 時 COALESCE 會跳過 |
| 4 | 欄位刪除無確認對話框 | 低 | `src/app/projects/[id]/page.tsx` | 刪除欄位時沒有確認提示 |
| 5 | 卡片移動 API 只接受 snake_case | 低 | `src/app/api/cards/move/route.ts` | 前端使用的參數名需與後端完全一致 |

---

## Playwright 回歸測試

所有測試檔位於 `tests/e2e/`，可用 `npx playwright test` 執行。

| 測試檔 | 測試數 | 涵蓋範圍 |
|--------|--------|----------|
| `home.spec.ts` | 3 | 首頁標題、功能卡片、導航到專案列表 |
| `project-crud.spec.ts` | 3 | 專案列表頁、建立專案、進入專案 |
| `board-view.spec.ts` | 4 | 預設欄位、新增欄位、新增卡片、四視圖切換 |
| `card-modal.spec.ts` | 2 | 開啟 Modal 編輯、新增子任務 |
| `phase-management.spec.ts` | 2 | 新增 Phase、篩選器 |
| `card-move.spec.ts` | 1 | 卡片跨欄移動 API |
| `subtask.spec.ts` | 1 | 子任務 CRUD API（含 subtask_id 參數） |
| `responsive.spec.ts` | 4 | 手機/平板/桌面三種視窗佈局 |

**執行結果:** 20 passed (56.4s)

---

## 截圖索引

所有截圖保存在 `e2e-screenshots/` 目錄：

| 編號 | 名稱 | 說明 |
|------|------|------|
| 00 | initial-load | 應用首次載入 |
| 01-03 | projects-* | 專案建立流程 |
| 04-06 | board-* | 看板欄位與卡片 |
| 08-10 | modal-* | 卡片 Modal 編輯 |
| 11-12 | subtasks-* | 子任務管理 |
| 15-17 | phase-* | Phase 建立與篩選 |
| 19 | list-view | 列表視圖 |
| 21 | calendar-view | 日曆視圖 |
| 23 | progress-view | 進度視圖 |
| 26 | after-card-move | 拖放後結果 |
| 30-33 | mobile-* | 手機 375×812 視圖 |
| 34-37 | tablet-* | 平板 768×1024 視圖 |
| 38-41 | desktop-* | 桌面 1440×900 視圖 |
| 42-43 | mobile-home/projects | 手機首頁/專案列表 |
